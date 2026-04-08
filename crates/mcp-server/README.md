# Datto RMM MCP Server (Rust)

High-performance MCP server for Datto RMM built with Rust, enabling AI assistants to interact with Datto RMM through the Model Context Protocol.

## Features

- **Hybrid Two-Tier Architecture**: 13 high-level task-oriented tools (Tier 1) + 52 API-level tools (Tier 2) = 65 total
- **High Performance**: Native Rust implementation with async/await
- **Type Safety**: Compile-time guarantees and schema validation
- **Single Binary**: No runtime dependencies, easy deployment
- **Composite Operations**: Tier 1 tools combine multiple API calls intelligently
- **Progressive Complexity**: Start simple with Tier 1, drop to Tier 2 for granular control

## Installation

### From Source

```bash
cargo build --release
```

The binary will be available at `target/release/datto-rmm-mcp`.

## Configuration

Configure via environment variables or `.env` file:

```bash
# Required
DATTO_PLATFORM=pinotage  # See supported platforms below
DATTO_API_KEY=your_api_key
DATTO_API_SECRET=your_api_secret

# Optional
RUST_LOG=info  # Log level (trace, debug, info, warn, error)
```

### Supported Platforms

The server supports all Datto RMM regional platforms:

- **Production**: `pinotage`, `merlot`, `concord`, `vidal`, `zinfandel`, `syrah`
- **Development**: `sandbox`, `devb`, `staging`

## Usage

### Run the Server

```bash
# Using environment variables
DATTO_PLATFORM=pinotage \
DATTO_API_KEY=xxx \
DATTO_API_SECRET=yyy \
./target/release/datto-rmm-mcp

# Or with .env file
./target/release/datto-rmm-mcp
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop, Cline):

```json
{
  "mcpServers": {
    "datto-rmm": {
      "command": "/path/to/datto-rmm-mcp",
      "env": {
        "DATTO_PLATFORM": "pinotage",
        "DATTO_API_KEY": "your_key",
        "DATTO_API_SECRET": "your_secret"
      }
    }
  }
}
```

## Architecture

### Tier 1 Tools (Task-Oriented)

High-level composite tools for common MSP workflows:

- **Account Overview** (4 tools): Dashboard, find issues, search devices, analytics
- **Site Operations** (5 tools): Site health, device listing, alerts, job execution, bulk updates
- **Device Operations** (2 tools): Device health, diagnostics
- **Alert Management** (2 tools): Alert investigation, trending

**Total: 13 Tier 1 tools**

### Tier 2 Tools (API-Level)

Direct 1:1 API endpoint mappings for granular control:

- **Account Operations** (8 tools): Account, sites, devices, alerts, components, variables, users
- **Site Operations** (9 tools): Site CRUD, devices, alerts, settings, variables, filters
- **Device Operations** (9 tools): Device lookup, alerts, move, UDF, warranty, quick jobs
- **Alert Operations** (2 tools): Get, resolve
- **Job Operations** (5 tools): Job details, results, components, stdout, stderr
- **Audit Operations** (5 tools): Device audit, software, MAC lookup, ESXi, printer
- **Activity Operations** (1 tool): Activity logs
- **System & Filter Operations** (5 tools): Status, rate limit, pagination, filters
- **Variable & Proxy Operations** (8 tools): CRUD for account/site variables and proxies

**Total: 52 Tier 2 tools**

## Project Structure

```
crates/mcp-server/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Library exports
│   ├── config.rs            # Configuration handling
│   ├── server.rs            # MCP server setup
│   ├── error.rs             # Error types
│   ├── tools/               # Tool implementations
│   │   ├── mod.rs           # Tool registry
│   │   ├── tier1/           # Task-oriented composite tools
│   │   │   ├── account.rs   # Account overview tools
│   │   │   ├── site.rs      # Site operation tools
│   │   │   ├── device.rs    # Device operation tools
│   │   │   └── alert.rs     # Alert management tools
│   │   └── tier2/           # Auto-generated API-level tools
│   │       └── mod.rs       # Generated tool wrappers
│   ├── resources/           # MCP resources (documentation)
│   │   └── mod.rs
│   └── utils/               # Shared utilities
│       ├── mod.rs
│       ├── formatting.rs    # Markdown formatting helpers
│       └── resolver.rs      # Name-to-UID resolution
├── Cargo.toml
└── README.md
```

## Development

### Build

```bash
cargo build
```

### Run in Development

```bash
cargo run
```

### Test

```bash
cargo test
```

### Format Code

```bash
cargo fmt
```

### Lint

```bash
cargo clippy
```

## Performance Comparison

Rust vs TypeScript MCP Server:

- **Startup Time**: ~10ms vs ~200ms
- **Memory Usage**: ~8MB vs ~50MB
- **Tool Call Latency**: ~50% faster for Tier 1 composite tools
- **Binary Size**: ~5MB (stripped) vs ~30MB (with Node.js)

## Related Projects

- [datto-api](../datto-api/) - Rust client for Datto RMM API
- [datto-rmm-api](../../packages/api/) - TypeScript client for Datto RMM API
- [MCP TypeScript Server](../../apps/mcp-server/) - Original TypeScript implementation

## License

MIT
