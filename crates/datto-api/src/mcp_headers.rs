//! MCP context headers for propagating tool call context to downstream APIs.

use reqwest::RequestBuilder;

/// Headers injected into every outbound DRMM REST API call originating from an MCP tool invocation.
#[derive(Debug, Clone)]
pub struct McpCallHeaders {
    /// Agent identifier configured at MCP server startup.
    pub agent_id: String,
    /// Correlation ID derived from the MCP request context — ties API calls back to a tool invocation.
    pub correlation_id: String,
    /// Name of the MCP tool that triggered this call.
    pub tool_name: String,
    /// Semantic version of the tool.
    pub tool_version: String,
    /// Originating subsystem — always "mcp" for MCP-initiated calls.
    pub call_origin: &'static str,
}

impl McpCallHeaders {
    /// Chain all five MCP context headers onto `rb` and return the updated builder.
    pub fn apply_to(&self, rb: RequestBuilder) -> RequestBuilder {
        rb.header("X-Datto-Mcp-Agent-Id", &self.agent_id)
            .header("X-Datto-Mcp-Correlation-Id", &self.correlation_id)
            .header("X-Datto-Mcp-Tool-Name", &self.tool_name)
            .header("X-Datto-Mcp-Tool-Version", &self.tool_version)
            .header("X-Datto-Mcp-Call-Origin", self.call_origin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_headers() -> McpCallHeaders {
        McpCallHeaders {
            agent_id: "agent-1".into(),
            correlation_id: "corr-abc".into(),
            tool_name: "get-account".into(),
            tool_version: "0.2.0".into(),
            call_origin: "mcp",
        }
    }

    #[test]
    fn apply_to_sets_all_five_headers() {
        let client = reqwest::Client::new();
        let rb = client.get("http://example.com");

        let request = sample_headers().apply_to(rb).build().unwrap();
        let h = request.headers();

        assert_eq!(h.get("X-Datto-Mcp-Agent-Id").unwrap(), "agent-1");
        assert_eq!(h.get("X-Datto-Mcp-Correlation-Id").unwrap(), "corr-abc");
        assert_eq!(h.get("X-Datto-Mcp-Tool-Name").unwrap(), "get-account");
        assert_eq!(h.get("X-Datto-Mcp-Tool-Version").unwrap(), "0.2.0");
        assert_eq!(h.get("X-Datto-Mcp-Call-Origin").unwrap(), "mcp");
    }

    #[test]
    fn apply_to_preserves_existing_headers() {
        let client = reqwest::Client::new();
        let rb = client
            .get("http://example.com")
            .header("Authorization", "Bearer tok");

        let request = sample_headers().apply_to(rb).build().unwrap();
        let h = request.headers();

        // Pre-existing header must survive
        assert_eq!(h.get("Authorization").unwrap(), "Bearer tok");
        // MCP headers must also be present
        assert!(h.contains_key("X-Datto-Mcp-Agent-Id"));
    }

    #[test]
    fn apply_to_uses_provided_values_not_defaults() {
        let client = reqwest::Client::new();
        let rb = client.get("http://example.com");

        let headers = McpCallHeaders {
            agent_id: "custom-agent".into(),
            correlation_id: "req-999".into(),
            tool_name: "list-sites".into(),
            tool_version: "1.0.0".into(),
            call_origin: "mcp-server",
        };

        let request = headers.apply_to(rb).build().unwrap();
        let h = request.headers();

        assert_eq!(h.get("X-Datto-Mcp-Agent-Id").unwrap(), "custom-agent");
        assert_eq!(h.get("X-Datto-Mcp-Correlation-Id").unwrap(), "req-999");
        assert_eq!(h.get("X-Datto-Mcp-Tool-Name").unwrap(), "list-sites");
        assert_eq!(h.get("X-Datto-Mcp-Tool-Version").unwrap(), "1.0.0");
    }
}
