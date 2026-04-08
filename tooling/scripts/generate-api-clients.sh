#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Generating API Clients ==="
echo ""

# Optionally sync the spec first
if [ "$SYNC_SPEC" = "true" ]; then
    echo "Syncing OpenAPI spec..."
    "$SCRIPT_DIR/sync-openapi-spec.sh"
    echo ""
fi

# Check if spec exists
SPEC_FILE="$WORKSPACE_ROOT/specs/datto-rmm-openapi.json"
if [ ! -f "$SPEC_FILE" ]; then
    echo "Error: OpenAPI spec not found at $SPEC_FILE"
    echo "Run 'pnpm sync:openapi' first to fetch the spec."
    exit 1
fi

# Generate TypeScript client
echo "Generating TypeScript client..."
cd "$WORKSPACE_ROOT"
pnpm --filter datto-rmm-api generate

# Generate Rust client (if cargo is available)
if command -v cargo &> /dev/null; then
    echo ""
    echo "Generating Rust client (via openapi-generator in build.rs)..."
    
    # Check if openapi-generator is installed
    if ! command -v openapi-generator &> /dev/null; then
        echo "Warning: openapi-generator not found"
        echo "Install with: brew install openapi-generator"
        echo "Skipping Rust client generation"
    else
        cd "$WORKSPACE_ROOT"
        # Building will trigger the build.rs script which runs openapi-generator
        cargo build -p datto-api 2>&1 | grep -v "^   Compiling" | grep -v "^    Finished" | grep -E "(warning: datto-api|error)" || true
        echo "Rust client generated successfully!"
    fi
else
    echo ""
    echo "Skipping Rust client (cargo not found)"
fi

echo ""
echo "=== Generation Complete ==="
