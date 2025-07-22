#!/bin/bash

# n8n MCP Server DXT Builder Script
# Builds the DXT package with proper validation and cleanup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DXT_NAME="n8n-mcp-server"
DXT_SOURCE_DIR="dxt"
OUTPUT_FILE="${DXT_NAME}.dxt"

echo -e "${BLUE}🔧 n8n MCP Server DXT Builder${NC}"
echo "=================================="

# Check if we're in the right directory
if [ ! -d "$DXT_SOURCE_DIR" ]; then
    echo -e "${RED}❌ Error: '$DXT_SOURCE_DIR' directory not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Get version from git tags or package.json
echo -e "${YELLOW}🔍 Detecting version...${NC}"
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
if [ -n "$GIT_TAG" ]; then
    VERSION=${GIT_TAG#v}  # Remove 'v' prefix if present
    echo -e "${BLUE}📌 Using git tag version: $VERSION${NC}"
else
    VERSION=$(jq -r '.version' package.json)
    echo -e "${BLUE}📦 Using package.json version: $VERSION${NC}"
    echo -e "${YELLOW}⚠️  No git tag found, using package.json version${NC}"
fi

# Sync build artifacts to DXT first
echo -e "${YELLOW}🔄 Syncing build artifacts to DXT...${NC}"
if [ -f "sync-to-dxt.sh" ]; then
    ./sync-to-dxt.sh
else
    echo -e "${YELLOW}⚠️  sync-to-dxt.sh not found, using existing DXT files${NC}"
fi

# Update manifest version to match detected version
echo -e "${YELLOW}📝 Updating manifest version to $VERSION...${NC}"
jq --arg version "$VERSION" '.version = $version' "$DXT_SOURCE_DIR/manifest.json" > tmp.json && mv tmp.json "$DXT_SOURCE_DIR/manifest.json"

# Update DXT package.json version to match
echo -e "${YELLOW}📝 Updating DXT package.json version to $VERSION...${NC}"
jq --arg version "$VERSION" '.version = $version' "$DXT_SOURCE_DIR/package.json" > tmp.json && mv tmp.json "$DXT_SOURCE_DIR/package.json"

# Check required files
echo -e "${YELLOW}📋 Validating DXT structure...${NC}"

REQUIRED_FILES=(
    "$DXT_SOURCE_DIR/manifest.json"
    "$DXT_SOURCE_DIR/server/index.js"
    "$DXT_SOURCE_DIR/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing required file: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required files present${NC}"

# Validate manifest.json
echo -e "${YELLOW}🔍 Validating manifest.json...${NC}"

# Check if manifest is valid JSON
if ! jq . "$DXT_SOURCE_DIR/manifest.json" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: manifest.json is not valid JSON${NC}"
    exit 1
fi

# Count tools in manifest
MANIFEST_TOOLS=$(jq '.tools | length' "$DXT_SOURCE_DIR/manifest.json")
echo -e "${BLUE}📊 Tools registered in manifest: $MANIFEST_TOOLS${NC}"

# Count tools in server implementation
SERVER_TOOLS=$(grep -c "name: '[a-zA-Z_]*'," "$DXT_SOURCE_DIR/server/index.js" || echo "0")
echo -e "${BLUE}📊 Tools implemented in server: $SERVER_TOOLS${NC}"

# Warn if counts don't match
if [ "$MANIFEST_TOOLS" != "$SERVER_TOOLS" ]; then
    echo -e "${YELLOW}⚠️  Warning: Tool count mismatch between manifest ($MANIFEST_TOOLS) and server ($SERVER_TOOLS)${NC}"
    echo -e "${YELLOW}   This may result in some tools not being available in Claude Desktop.${NC}"
fi

# Remove existing DXT file if it exists
if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${YELLOW}🗑️  Removing existing $OUTPUT_FILE...${NC}"
    rm "$OUTPUT_FILE"
fi

# Create DXT package
echo -e "${YELLOW}📦 Building DXT package...${NC}"

cd "$DXT_SOURCE_DIR"

# Use official DXT packing tool
npx @anthropic-ai/dxt pack . "../$OUTPUT_FILE"

cd ..

# Verify the created DXT
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ Error: Failed to create $OUTPUT_FILE${NC}"
    exit 1
fi

# Get file size
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo -e "${GREEN}✅ DXT package created successfully!${NC}"
echo ""
echo -e "${BLUE}📁 Output: $OUTPUT_FILE${NC}"
echo -e "${BLUE}📏 Size: $FILE_SIZE${NC}"
echo ""

# List contents for verification
echo -e "${YELLOW}📋 Package contents:${NC}"
unzip -l "$OUTPUT_FILE" | head -20

if [ $(unzip -l "$OUTPUT_FILE" | wc -l) -gt 25 ]; then
    echo "   ... (showing first 20 entries)"
fi

echo ""

# Provide installation instructions
echo -e "${GREEN}🚀 Installation Instructions:${NC}"
echo "1. Drag $OUTPUT_FILE into Claude Desktop, or"
echo "2. Double-click $OUTPUT_FILE to install"
echo ""
echo -e "${BLUE}⚙️  Configuration:${NC}"
echo "After installation, configure your n8n settings in:"
echo "Claude Desktop → Extensions → n8n Workflow Automation Server"
echo ""
echo -e "${GREEN}✨ Expected tools: $MANIFEST_TOOLS${NC}"

# Optional: Verify tools list
echo ""
echo -e "${YELLOW}🔧 Tools included in this DXT:${NC}"
jq -r '.tools[] | "  • " + .name + " - " + .description' "$DXT_SOURCE_DIR/manifest.json" | head -10

if [ "$MANIFEST_TOOLS" -gt 10 ]; then
    echo "  ... and $((MANIFEST_TOOLS - 10)) more tools"
fi

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"