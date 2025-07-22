#!/bin/bash

echo "🔧 n8n MCP DXT Cache Fix Script"
echo "==============================="

# Check if Claude Desktop is running
if pgrep -x "Claude" > /dev/null; then
    echo "❌ Claude Desktop is still running!"
    echo "Please quit Claude Desktop completely before running this script."
    echo "1. Right-click Claude Desktop in dock → Quit"
    echo "2. Or press Cmd+Q when Claude Desktop is focused"
    exit 1
fi

echo "✅ Claude Desktop appears to be closed"

# Backup current config
CLAUDE_DIR="$HOME/Library/Application Support/Claude"
BACKUP_DIR="$HOME/Library/Application Support/Claude_Backup_$(date +%Y%m%d_%H%M%S)"

echo "📦 Creating backup at: $BACKUP_DIR"
cp -r "$CLAUDE_DIR" "$BACKUP_DIR"

# Clear DXT-related cache files
echo "🧹 Clearing DXT cache files..."

# Remove extensions installations record
if [ -f "$CLAUDE_DIR/extensions-installations.json" ]; then
    echo "🗑️  Removing extensions-installations.json"
    rm "$CLAUDE_DIR/extensions-installations.json"
fi

# Remove any cached DXT extensions
if [ -d "$CLAUDE_DIR/Claude Extensions" ]; then
    echo "🗑️  Clearing Claude Extensions directory"
    find "$CLAUDE_DIR/Claude Extensions" -name "*n8n*" -type d -exec rm -rf {} + 2>/dev/null
    find "$CLAUDE_DIR/Claude Extensions" -name "*leonard*" -type d -exec rm -rf {} + 2>/dev/null
fi

# Remove extension settings
if [ -d "$CLAUDE_DIR/Claude Extensions Settings" ]; then
    echo "🗑️  Clearing Claude Extensions Settings"
    find "$CLAUDE_DIR/Claude Extensions Settings" -name "*n8n*" -type f -delete 2>/dev/null
    find "$CLAUDE_DIR/Claude Extensions Settings" -name "*leonard*" -type f -delete 2>/dev/null
fi

echo "✅ Cache cleared successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Install the new DXT: /private/tmp/test-n8n-mcp/n8n-mcp-server/n8n-mcp-server.dxt"
echo "2. Drag the DXT file into Claude Desktop or double-click it"
echo "3. Configure your n8n API settings in Claude Desktop → Extensions"
echo ""
echo "💡 If you still see only 13 tools after installation, try:"
echo "   - Completely restart Claude Desktop again"
echo "   - Check for any other n8n MCP servers in your system"
echo ""
echo "📁 Backup created at: $BACKUP_DIR"