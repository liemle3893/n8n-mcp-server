#!/bin/bash

# Quick DXT Builder - Simple version for fast rebuilds
# Usage: ./quick-build.sh

set -e

echo "🔧 Quick DXT Build..."

# Remove old DXT
rm -f n8n-mcp-server.dxt

# Build new DXT
cd dxt && zip -r ../n8n-mcp-server.dxt . > /dev/null && cd ..

echo "✅ DXT built: n8n-mcp-server.dxt ($(du -h n8n-mcp-server.dxt | cut -f1))"
echo "📦 Install by dragging into Claude Desktop"