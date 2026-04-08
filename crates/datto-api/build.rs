//! Build script for generating Datto RMM API client from OpenAPI spec.
//!
//! Uses openapi-generator CLI to generate Rust client code.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    // Declare the custom cfg flag for cargo check-cfg
    println!("cargo::rustc-check-cfg=cfg(has_generated_api)");

    // Look for spec in multiple locations:
    // 1. Local copy (for crates.io publish) - this takes priority
    // 2. Monorepo location (for local development)
    let local_spec_path = Path::new("openapi.json");
    let monorepo_spec_path = Path::new("../../specs/datto-rmm-openapi.json");

    // Rerun if either spec changes
    println!("cargo:rerun-if-changed={}", local_spec_path.display());
    println!("cargo:rerun-if-changed={}", monorepo_spec_path.display());

    // Determine which spec path to use
    let spec_path = if local_spec_path.exists() {
        local_spec_path
    } else if monorepo_spec_path.exists() {
        // Copy the spec to local directory for future crates.io publish
        if let Err(e) = fs::copy(monorepo_spec_path, local_spec_path) {
            println!("cargo:warning=Failed to copy OpenAPI spec locally: {}", e);
        }
        monorepo_spec_path
    } else {
        println!(
            "cargo:warning=OpenAPI spec not found. Run 'pnpm sync:openapi' first."
        );
        println!("cargo:warning=Skipping API generation - client will have limited functionality");
        return;
    };

    // Check if openapi-generator is available
    let generator_check = Command::new("openapi-generator")
        .arg("version")
        .output();

    if generator_check.is_err() {
        println!("cargo:warning=openapi-generator not found. Install with: brew install openapi-generator");
        println!("cargo:warning=Skipping API generation - client will have limited functionality");
        return;
    }

    // Generate API client to src/generated directory
    let src_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let generated_dir = src_dir.join("src").join("generated");

    // Clean old generated code
    if generated_dir.exists() {
        let _ = fs::remove_dir_all(&generated_dir);
    }

    println!("cargo:warning=Generating Rust API client with openapi-generator...");
    println!("cargo:warning=Generating Rust API client with openapi-generator...");

    // Run openapi-generator to create the client
    let output = Command::new("openapi-generator")
        .arg("generate")
        .arg("-i")
        .arg(spec_path.to_str().unwrap())
        .arg("-g")
        .arg("rust")
        .arg("-o")
        .arg(generated_dir.to_str().unwrap())
        .arg("--skip-validate-spec")
        .arg("--additional-properties=packageName=datto-api-generated")
        .output()
        .expect("Failed to run openapi-generator");

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("cargo:warning=openapi-generator failed: {}", stderr);
        return;
    }

    // Move the src contents up one level (openapi-generator creates src/models, we want them in src/generated/models)
    let gen_src = generated_dir.join("src");
    if gen_src.exists() {
        // Move models directory
        let models_src = gen_src.join("models");
        let models_dest = generated_dir.join("models");
        
        if models_src.exists() {
            let _ = fs::rename(&models_src, &models_dest);
        }

        // Copy mod.rs from generated src/models/mod.rs to generated/models/mod.rs
        let src_models_mod = gen_src.join("models").join("mod.rs");
        if !src_models_mod.exists() {
            // The models dir was moved, try the new location
            let new_models_mod = models_dest.join("mod.rs");
            if !new_models_mod.exists() {
                // Create a basic mod.rs file
                create_models_mod_rs(&models_dest);
            }
        }

        // Clean up the src directory
        let _ = fs::remove_dir_all(&gen_src);
    }

    // Create generated/mod.rs
    create_generated_mod_rs(&generated_dir);

    // Clean up unnecessary generated files
    cleanup_generated_files(&generated_dir);

    // Fix known issues in generated code
    fix_generated_code(&generated_dir);

    println!("cargo:warning=API client generated successfully!");
    println!("cargo:rustc-cfg=has_generated_api");
}

/// Extract field names that are timestamps from the OpenAPI spec.
/// Looks for properties with "format": "date-time".
fn extract_timestamp_fields_from_openapi() -> Vec<String> {
    let openapi_path = PathBuf::from("openapi.json");
    let mut timestamp_fields = Vec::new();

    if let Ok(content) = fs::read_to_string(&openapi_path) {
        if let Ok(spec) = serde_json::from_str::<serde_json::Value>(&content) {
            // Navigate to components/schemas
            if let Some(schemas) = spec.get("components")
                .and_then(|c| c.get("schemas"))
                .and_then(|s| s.as_object())
            {
                for (_schema_name, schema) in schemas {
                    if let Some(properties) = schema.get("properties")
                        .and_then(|p| p.as_object())
                    {
                        for (field_name, field_spec) in properties {
                            // Check if this field has format: date-time
                            if let Some(format) = field_spec.get("format")
                                .and_then(|f| f.as_str())
                            {
                                if format == "date-time" {
                                    // Convert camelCase to snake_case
                                    let snake_case = to_snake_case(field_name);
                                    if !timestamp_fields.contains(&snake_case) {
                                        timestamp_fields.push(snake_case);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    timestamp_fields
}

/// Convert camelCase to snake_case (simple implementation).
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(ch.to_lowercase().next().unwrap());
        } else {
            result.push(ch);
        }
    }
    result
}

fn fix_generated_code(generated_dir: &Path) {
    // Fix duplicate 'oid' field in SnmpProbeContext
    // The OpenAPI spec has both "OID" and "oid" which become the same field name in Rust
    let snmp_file = generated_dir.join("models").join("snmp_probe_context.rs");
    if snmp_file.exists() {
        if let Ok(content) = fs::read_to_string(&snmp_file) {
            // Replace the first occurrence of `pub oid:` with `pub oid_upper:`
            // This is the one with serde(rename = "OID")
            let fixed = content.replacen(
                "#[serde(rename = \"OID\", skip_serializing_if = \"Option::is_none\")]\n    pub oid: Option<String>,",
                "#[serde(rename = \"OID\", skip_serializing_if = \"Option::is_none\")]\n    pub oid_upper: Option<String>,",
                1
            ).replace(
                "            oid: None,\n            rule_name: None,",
                "            oid_upper: None,\n            rule_name: None,"
            );
            
            let _ = fs::write(&snmp_file, fixed);
        }
    }

    // Fix timestamp fields that should be i64 but are generated as String
    fix_timestamp_fields(generated_dir);
}

fn fix_timestamp_fields(generated_dir: &Path) {
    let models_dir = generated_dir.join("models");
    if !models_dir.exists() {
        return;
    }

    // Extract timestamp field names from OpenAPI spec
    let timestamp_fields = extract_timestamp_fields_from_openapi();

    if let Ok(entries) = fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("rs") {
                continue;
            }
            if path.file_stem().and_then(|s| s.to_str()) == Some("mod") {
                continue;
            }

            if let Ok(mut content) = fs::read_to_string(&path) {
                let mut modified = false;

                // Add import for serde_helpers if we have timestamp fields
                for field in &timestamp_fields {
                    if content.contains(&format!("pub {}: Option<String>", field))
                        || content.contains(&format!("pub {}: String", field))
                    {
                        // Add the use statement if not already present
                        if !content.contains("use crate::serde_helpers") {
                            if let Some(pos) = content.find("use serde::{Deserialize, Serialize};") {
                                let end = pos + "use serde::{Deserialize, Serialize};".len();
                                content.insert_str(
                                    end,
                                    "\nuse crate::serde_helpers::{deserialize_flexible_timestamp, deserialize_required_flexible_timestamp};"
                                );
                                modified = true;
                            }
                        }
                        break;
                    }
                }

                // Fix each timestamp field
                for field in &timestamp_fields {
                    // Optional timestamp: Option<String> -> Option<i64>
                    let old_optional = format!("pub {}: Option<String>", field);
                    if content.contains(&old_optional) {
                        // Find the serde attribute line above
                        let search_pattern = format!(
                            r#"(#\[serde\([^\]]+\)\]\s+)pub {}: Option<String>"#,
                            field
                        );
                        
                        // Simple replacement: change type and add deserializer
                        content = content.replace(
                            &old_optional,
                            &format!(
                                "#[serde(deserialize_with = \"deserialize_flexible_timestamp\")]\n    pub {}: Option<i64>",
                                field
                            )
                        );
                        modified = true;
                    }

                    // Required timestamp: String -> i64
                    let old_required = format!("pub {}: String", field);
                    if content.contains(&old_required) {
                        content = content.replace(
                            &old_required,
                            &format!(
                                "#[serde(deserialize_with = \"deserialize_required_flexible_timestamp\")]\n    pub {}: i64",
                                field
                            )
                        );
                        modified = true;
                    }
                }

                if modified {
                    let _ = fs::write(&path, content);
                }
            }
        }
    }
}

fn create_models_mod_rs(models_dir: &Path) {
    let mod_file = models_dir.join("mod.rs");
    if mod_file.exists() {
        return;
    }

    // Read all .rs files in the models directory
    let mut model_names = Vec::new();
    if let Ok(entries) = fs::read_dir(models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("rs") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if stem != "mod" {
                        model_names.push(stem.to_string());
                    }
                }
            }
        }
    }

    model_names.sort();

    let mut content = String::from("// Auto-generated module declarations\n\n");
    for name in &model_names {
        content.push_str(&format!("pub mod {};\n", name));
    }
    content.push('\n');
    for name in &model_names {
        content.push_str(&format!("pub use self::{}::*;\n", name));
    }

    let _ = fs::write(mod_file, content);
}

fn create_generated_mod_rs(generated_dir: &Path) {
    let mod_file = generated_dir.join("mod.rs");
    let content = r#"//! Generated API types from OpenAPI spec.
//!
//! These types are auto-generated by openapi-generator and should not be modified manually.

pub mod models;

// Re-export commonly used types
pub use models::*;
"#;
    let _ = fs::write(mod_file, content);
}

fn cleanup_generated_files(generated_dir: &Path) {
    // Remove files we don't need
    let files_to_remove = [
        ".gitignore",
        ".travis.yml",
        ".openapi-generator-ignore",
        "git_push.sh",
        "Cargo.toml",
        "README.md",
    ];

    for file in &files_to_remove {
        let path = generated_dir.join(file);
        let _ = fs::remove_file(path);
    }

    // Remove directories we don't need
    let dirs_to_remove = [".openapi-generator", "docs", "src", "apis"];
    for dir in &dirs_to_remove {
        let path = generated_dir.join(dir);
        let _ = fs::remove_dir_all(path);
    }
}
