use crate::{Error, Result};
use rmcp::model::{AnnotateAble, Annotated, RawResource, ReadResourceResult, ResourceContents};

/// List all available MCP resources (documentation, workflows, etc.)
pub fn list_resources() -> Vec<Annotated<RawResource>> {
    vec![
        RawResource::new(
            "datto://docs/overview",
            "Datto RMM MCP Server Overview",
        )
        .with_description("Overview of the Datto RMM MCP server architecture and capabilities")
        .no_annotation(),
        RawResource::new(
            "datto://docs/workflows",
            "Common MSP Workflows",
        )
        .with_description("Step-by-step workflows for common MSP tasks with recommended tools")
        .no_annotation(),
        RawResource::new(
            "datto://docs/tier1-tools",
            "Tier 1 Tools Reference",
        )
        .with_description("Complete reference for task-oriented composite tools")
        .no_annotation(),
        RawResource::new(
            "datto://docs/tier2-tools",
            "Tier 2 Tools Reference",
        )
        .with_description("Complete reference for API-level granular tools")
        .no_annotation(),
        RawResource::new(
            "datto://docs/troubleshooting",
            "Troubleshooting Guide",
        )
        .with_description("Issue-specific troubleshooting workflows and resolution steps")
        .no_annotation(),
        RawResource::new(
            "datto://docs/components",
            "Component Catalog",
        )
        .with_description("Available components with use cases and best practices")
        .no_annotation(),
        RawResource::new(
            "datto://docs/alerts",
            "Alert Type Reference",
        )
        .with_description("Alert types, causes, and resolution strategies")
        .no_annotation(),
    ]
}

/// Read a specific resource by URI
pub fn read_resource(uri: &str) -> Result<ReadResourceResult> {
    let content = match uri {
        "datto://docs/overview" => include_str!("overview.md"),
        "datto://docs/workflows" => include_str!("workflows.md"),
        "datto://docs/tier1-tools" => include_str!("tier1-tools.md"),
        "datto://docs/tier2-tools" => include_str!("tier2-tools.md"),
        "datto://docs/troubleshooting" => include_str!("troubleshooting.md"),
        "datto://docs/components" => include_str!("components.md"),
        "datto://docs/alerts" => include_str!("alerts.md"),
        _ => return Err(Error::NotFound(format!("Resource not found: {}", uri))),
    };

    Ok(ReadResourceResult::new(vec![ResourceContents::text(content, uri)]))
}
