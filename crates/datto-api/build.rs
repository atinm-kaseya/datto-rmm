//! Build script for generating Datto RMM API client from OpenAPI spec.

use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;

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

    let out_dir = env::var("OUT_DIR").unwrap();
    let out_file = Path::new(&out_dir).join("generated.rs");

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
        // Create empty generated file to allow compilation
        let mut file = fs::File::create(&out_file).expect("Failed to create generated file");
        writeln!(file, "// OpenAPI spec not found - no types generated").unwrap();
        return;
    };

    // Read the spec as a string first
    let spec_content = match fs::read_to_string(spec_path) {
        Ok(c) => c,
        Err(e) => {
            println!("cargo:warning=Failed to read OpenAPI spec: {}", e);
            let mut file = fs::File::create(&out_file).expect("Failed to create generated file");
            writeln!(file, "// Failed to read spec: {}", e).unwrap();
            return;
        }
    };

    // Downgrade OpenAPI 3.1.0 to 3.0.3 for progenitor compatibility
    // progenitor doesn't support OpenAPI 3.1.0 yet
    let spec_content = spec_content.replace("\"openapi\": \"3.1.0\"", "\"openapi\": \"3.0.3\"");

    // Parse as JSON first to filter deprecated operations
    let mut spec_json: serde_json::Value = match serde_json::from_str(&spec_content) {
        Ok(s) => s,
        Err(e) => {
            println!("cargo:warning=Failed to parse OpenAPI spec as JSON: {}", e);
            let mut file = fs::File::create(&out_file).expect("Failed to create generated file");
            writeln!(file, "// Failed to parse spec: {}", e).unwrap();
            return;
        }
    };

    // Filter out deprecated operations
    let mut deprecated_count = 0;
    let mut paths_to_remove: Vec<String> = Vec::new();

    if let Some(paths) = spec_json.get_mut("paths").and_then(|p| p.as_object_mut()) {
        for (path_name, path_item) in paths.iter_mut() {
            if let Some(operations) = path_item.as_object_mut() {
                let methods_to_remove: Vec<String> = operations
                    .iter()
                    .filter(|(method, operation)| {
                        *method != "parameters" &&
                        operation.get("deprecated").and_then(|d| d.as_bool()).unwrap_or(false)
                    })
                    .map(|(method, _)| {
                        println!("cargo:warning=Excluding deprecated: {} {}", method.to_uppercase(), path_name);
                        deprecated_count += 1;
                        method.clone()
                    })
                    .collect();

                for method in methods_to_remove {
                    operations.remove(&method);
                }

                // Check if path has any operations left (excluding 'parameters')
                let has_operations = operations.keys().any(|k| k != "parameters");
                if !has_operations {
                    paths_to_remove.push(path_name.clone());
                }
            }
        }

        // Remove empty paths
        for path in &paths_to_remove {
            paths.remove(path);
        }
    }

    if deprecated_count > 0 {
        let msg = if !paths_to_remove.is_empty() {
            format!("Filtered {} deprecated operation(s) and removed {} empty path(s)",
                    deprecated_count, paths_to_remove.len())
        } else {
            format!("Filtered {} deprecated operation(s)", deprecated_count)
        };
        println!("cargo:warning={}", msg);
    }

    // Convert back to string for OpenAPI parsing
    let filtered_spec_content = serde_json::to_string(&spec_json)
        .expect("Failed to serialize filtered spec");

    // Parse as OpenAPI spec
    let spec: openapiv3::OpenAPI = match serde_json::from_str(&filtered_spec_content) {
        Ok(s) => s,
        Err(e) => {
            println!("cargo:warning=Failed to parse filtered OpenAPI spec: {}", e);
            let mut file = fs::File::create(&out_file).expect("Failed to create generated file");
            writeln!(file, "// Failed to parse spec: {}", e).unwrap();
            return;
        }
    };

    let mut generator = progenitor::Generator::default();

    let tokens = match generator.generate_tokens(&spec) {
        Ok(t) => t,
        Err(e) => {
            println!("cargo:warning=Failed to generate from OpenAPI spec: {}", e);
            let mut file = fs::File::create(&out_file).expect("Failed to create generated file");
            writeln!(file, "// Failed to generate: {}", e).unwrap();
            return;
        }
    };

    let content = tokens.to_string();

    // Format with prettyplease if possible
    let formatted = match syn::parse_file(&content) {
        Ok(syntax_tree) => prettyplease::unparse(&syntax_tree),
        Err(_) => content,
    };

    fs::write(&out_file, formatted).expect("Failed to write generated file");

    println!("cargo:rustc-cfg=has_generated_api");
}
