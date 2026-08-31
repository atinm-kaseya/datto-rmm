//! Per-call context passed from the MCP request into tool handlers.

use datto_api::McpCallHeaders;

/// Context available to every tool handler for a single MCP tool call.
pub struct ToolContext {
    pub tool_name: String,
    pub tool_version: String,
    pub correlation_id: String,
}

impl ToolContext {
    /// Build the five-header struct needed to annotate outbound REST API calls.
    pub fn to_mcp_headers(&self, agent_id: &str) -> McpCallHeaders {
        McpCallHeaders {
            agent_id: agent_id.to_string(),
            correlation_id: self.correlation_id.clone(),
            tool_name: self.tool_name.clone(),
            tool_version: self.tool_version.clone(),
            call_origin: "mcp",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_context() -> ToolContext {
        ToolContext {
            tool_name: "rmm_get_device_health".into(),
            tool_version: "1.2.3".into(),
            correlation_id: "corr-456".into(),
        }
    }

    #[test]
    fn to_mcp_headers_maps_all_fields() {
        let headers = sample_context().to_mcp_headers("agent-xyz");

        assert_eq!(headers.agent_id, "agent-xyz");
        assert_eq!(headers.correlation_id, "corr-456");
        assert_eq!(headers.tool_name, "rmm_get_device_health");
        assert_eq!(headers.tool_version, "1.2.3");
        assert_eq!(headers.call_origin, "mcp");
    }

    #[test]
    fn to_mcp_headers_call_origin_is_always_mcp() {
        let ctx = ToolContext {
            tool_name: "any".into(),
            tool_version: "0.1.0".into(),
            correlation_id: "id".into(),
        };
        assert_eq!(ctx.to_mcp_headers("x").call_origin, "mcp");
    }

    #[test]
    fn to_mcp_headers_clones_correlation_id_independently() {
        let ctx = sample_context();
        let h1 = ctx.to_mcp_headers("a1");
        let h2 = ctx.to_mcp_headers("a2");
        // Each call produces an independent copy — modifying one doesn't affect the other
        assert_eq!(h1.correlation_id, h2.correlation_id);
        assert_ne!(h1.agent_id, h2.agent_id);
    }

    #[test]
    fn to_mcp_headers_agent_id_comes_from_argument() {
        let ctx = sample_context();
        assert_eq!(ctx.to_mcp_headers("agent-A").agent_id, "agent-A");
        assert_eq!(ctx.to_mcp_headers("agent-B").agent_id, "agent-B");
    }
}
