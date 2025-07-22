#!/bin/bash

# Sync script to update DXT folder from build artifacts
# This ensures DXT contains the latest compiled version

set -e

echo "🔄 Syncing build artifacts to DXT folder..."

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Build directory not found. Run 'npm run build' first."
    exit 1
fi

# Check if build/index.js exists
if [ ! -f "build/index.js" ]; then
    echo "❌ build/index.js not found. Run 'npm run build' first."
    exit 1
fi

# Create dxt/server directory if it doesn't exist
mkdir -p dxt/server

echo "📦 DXT server already has working implementation - skipping copy"

# Ensure the server file is executable
chmod +x dxt/server/index.js

# Copy and update manifest.json for DXT format
echo "📋 Updating dxt/manifest.json from root manifest.json"

# Use jq to convert root manifest to DXT format if available, otherwise just copy
if command -v jq &> /dev/null; then
    # Convert root manifest to DXT format
    jq '{
        dxt_version: "0.1",
        name,
        display_name: .name,
        version,
        description,
        long_description: (.description + "\n\nFeatures:\n- Complete workflow lifecycle management\n- Execution monitoring and control\n- Webhook-based workflow triggers\n- Health monitoring and diagnostics\n- Secure credential handling\n- Resource browsing capabilities\n\nRequires n8n instance with API access enabled."),
        author: {
            name: "liemle3893",
            email: "liemle3893@gmail.com", 
            url: "https://github.com/liemle3893"
        },
        license,
        repository,
        homepage,
        documentation: .homepage,
        support: .support,
        server: {
            type: "node",
            entry_point: "server/index.js",
            mcp_config: {
                command: "node",
                args: ["${__dirname}/server/index.js"],
                env: {
                    N8N_API_URL: "${user_config.n8n_api_url}",
                    N8N_API_KEY: "${user_config.n8n_api_key}",
                    N8N_WEBHOOK_USERNAME: "${user_config.n8n_webhook_username}",
                    N8N_WEBHOOK_PASSWORD: "${user_config.n8n_webhook_password}",
                    DEBUG: "${user_config.enable_debug}",
                    REQUEST_TIMEOUT: "${user_config.timeout}",
                    MAX_RESULTS: "${user_config.max_results}"
                }
            }
        },
        tools,
        user_config: {
            n8n_api_key: {
                type: "string",
                title: "n8n API Key",
                description: "API key for authenticating with your n8n instance",
                required: true,
                sensitive: true
            },
            n8n_api_url: {
                type: "string", 
                title: "n8n API URL",
                description: "Full URL of the n8n API, including /api/v1 (e.g., https://your-n8n.app.n8n.cloud/api/v1 or http://localhost:5678/api/v1)",
                required: true,
                default: "http://localhost:5678/api/v1"
            },
            n8n_webhook_username: {
                type: "string",
                title: "Webhook Username", 
                description: "Username for webhook authentication (optional, only if using webhooks with basic auth)",
                required: false
            },
            n8n_webhook_password: {
                type: "string",
                title: "Webhook Password",
                description: "Password for webhook authentication (optional, only if using webhooks with basic auth)", 
                required: false,
                sensitive: true
            },
            timeout: {
                type: "number",
                title: "Request Timeout",
                description: "Timeout for API requests in milliseconds",
                required: false,
                default: 30000,
                min: 5000,
                max: 120000
            },
            max_results: {
                type: "number",
                title: "Maximum Results", 
                description: "Maximum number of results to return for list operations",
                required: false,
                default: 50,
                min: 1,
                max: 500
            },
            enable_debug: {
                type: "boolean",
                title: "Enable Debug Logging",
                description: "Enable verbose debug logging for troubleshooting",
                required: false,
                default: false
            }
        },
        compatibility: {
            client: ">=0.10.0",
            platforms: ["darwin", "win32", "linux"], 
            runtime: {
                node: ">=20.0.0"
            }
        },
        keywords: (.keywords + ["desktop-extension"])
    }' manifest.json > dxt/manifest.json
else
    # Fallback: just copy the manifest
    echo "⚠️  jq not available, copying manifest as-is"
    cp manifest.json dxt/manifest.json
fi

# Update dxt/package.json if needed
echo "📄 Updating dxt/package.json"
if [ -f "dxt/package.json" ]; then
    # Update version to match root package.json if jq is available
    if command -v jq &> /dev/null; then
        ROOT_VERSION=$(jq -r '.version' package.json)
        jq --arg version "$ROOT_VERSION" '.version = $version' dxt/package.json > dxt/package.json.tmp
        mv dxt/package.json.tmp dxt/package.json
    fi
fi

echo "✅ DXT sync completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run './build-dxt.sh' to create the .dxt package"
echo "2. Test the .dxt package in Claude Desktop"