/// Helper functions for creating MCP tools
use rmcp::model::{CallToolResult, Content};
use schemars::JsonSchema;
use serde_json::json;
use std::borrow::Cow;
use std::sync::Arc;

/// Create a Tool with proper schema conversion
pub fn create_tool<T: JsonSchema>(name: &'static str, description: &'static str) -> rmcp::model::Tool {
    let schema = schemars::schema_for!(T);
    let schema_json = serde_json::to_value(schema).unwrap();
    let schema_obj = schema_json.as_object().unwrap().clone();

    rmcp::model::Tool::new(
        Cow::Borrowed(name),
        Cow::Borrowed(description),
        Arc::new(schema_obj),
    )
}

/// Create a Tool with no parameters (empty object schema)
pub fn create_tool_no_params(name: &'static str, description: &'static str) -> rmcp::model::Tool {
    let schema = json!({
        "type": "object",
        "properties": {}
    });
    let schema_obj = schema.as_object().unwrap().clone();

    rmcp::model::Tool::new(
        Cow::Borrowed(name),
        Cow::Borrowed(description),
        Arc::new(schema_obj),
    )
}

/// Create a successful CallToolResult with text content
pub fn success_result(text: String) -> CallToolResult {
    let content = Content::text(text);
    CallToolResult::success(vec![content])
}

/// Create a CallToolResult with hybrid format (summary + data)
/// 
/// Returns JSON with two fields:
/// - `summary`: Formatted markdown text for display to users
/// - `data`: Structured JSON data for LLM to extract values for follow-up queries
///
/// This allows the LLM to show human-readable output while preserving
/// the ability to chain queries by extracting UIDs, names, etc.
pub fn hybrid_result(summary: String, data: serde_json::Value) -> CallToolResult {
    let result = json!({
        "summary": summary,
        "data": data
    });
    success_result(serde_json::to_string_pretty(&result).unwrap())
}

/// Create a CallToolResult with data and LLM instructions
/// 
/// Returns JSON with three fields:
/// - `data`: The structured data from the API
/// - `instructions`: Clear directions for the LLM on how to present this data
/// - `visualization_hints`: Suggested visualization types (optional)
/// 
/// This allows the LLM to choose appropriate formatting and visualizations
/// while ensuring it understands the context and purpose of the data.
pub fn instructed_result(
    data: serde_json::Value,
    instructions: &str,
    visualization_hints: Option<Vec<&str>>,
) -> CallToolResult {
    let mut result = json!({
        "data": data,
        "instructions": instructions,
    });
    
    if let Some(hints) = visualization_hints {
        result["visualization_hints"] = json!(hints);
    }
    
    success_result(serde_json::to_string_pretty(&result).unwrap())
}

/// Create a CallToolResult with formatted output and explicit LLM instructions
/// 
/// Uses the "Instructional Wrapper" pattern to tell the LLM how to present the data.
/// This prevents the LLM from dumping raw JSON and ensures proper formatting.
pub fn formatted_result(content: String, instruction: &str) -> CallToolResult {
    let wrapped = format!(
        "[FORMATTED_DATA]\n{}\n\n[INSTRUCTION] {}",
        content,
        instruction
    );
    success_result(wrapped)
}

/// Create an error CallToolResult
pub fn error_result(text: String) -> CallToolResult {
    let content = Content::text(text);
    CallToolResult::error(vec![content])
}
