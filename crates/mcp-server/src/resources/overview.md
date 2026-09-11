# Datto RMM MCP Server - Overview

High-performance MCP server for Datto RMM built with Rust.

## Architecture

This server implements a **Hybrid Two-Tier Architecture**:

### 🌟 Tier 1: Task-Oriented Tools (13 tools)
High-level composite tools for common MSP workflows. These tools combine multiple API calls intelligently and return rich, formatted responses with recommendations.

**Use Tier 1 for:**
- Daily triage and prioritization
- Site health checks
- Device diagnostics
- Alert analysis
- Common workflows (80% of use cases)

### 🔧 Tier 2: API-Level Tools (52 tools)
Direct 1:1 mappings to Datto RMM API endpoints for granular control.

**Use Tier 2 for:**
- Specific API operations not covered by Tier 1
- Edge cases requiring precise control
- Custom workflows
- Advanced use cases (20% of use cases)

## Getting Started

1. **Start with Tier 1 tools** - They handle most common tasks efficiently
2. **Drop to Tier 2 when needed** - For specific operations or edge cases
3. **Mix and match** - Combine tools from both tiers as needed

## Recommended Workflow

```
get-account-dashboard
  ↓ Identify problem sites
find-sites-with-issues
  ↓ Drill into specific site
get-site-health
  ↓ Investigate device
get-device-health
  ↓ Take action
run-site-component
```

For more details, see:
- `datto://docs/workflows` - Common MSP workflows
- `datto://docs/tier1-tools` - Tier 1 tool reference
- `datto://docs/tier2-tools` - Tier 2 tool reference
