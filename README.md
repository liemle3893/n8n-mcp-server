# n8n MCP Server

A Model Context Protocol (MCP) server for n8n workflow automation.

## Installation

### From GitHub Package Registry

```bash
# Configure npm to use GitHub Package Registry for this scope
echo "@liemle3893:registry=https://npm.pkg.github.com" >> ~/.npmrc

# For public packages, you may need to authenticate with GitHub
# Create a GitHub Personal Access Token with 'read:packages' scope
# Then configure authentication:
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc

# Install the package
npm install -g @liemle3893/n8n-mcp-server
```

**Note**: If the package is public, authentication may not be required. Try without the auth token first.

### From Source

```bash
# Clone the repository
git clone https://github.com/liemle3893/n8n-mcp-server.git
cd n8n-mcp-server

# Install dependencies and build
npm install
npm run build

# Install globally (optional)
npm link
```

### Claude Desktop Extension (DXT)

Download the appropriate `.dxt` file for your platform from the [latest release](https://github.com/liemle3893/n8n-mcp-server/releases):

- **macOS Intel**: `n8n-mcp-server-darwin-x64.dxt`
- **macOS Apple Silicon**: `n8n-mcp-server-darwin-arm64.dxt`
- **Linux x64**: `n8n-mcp-server-linux-x64.dxt`
- **Linux ARM64**: `n8n-mcp-server-linux-arm64.dxt`  
- **Windows x64**: `n8n-mcp-server-win32-x64.dxt`
- **Windows ARM64**: `n8n-mcp-server-win32-arm64.dxt`

Then drag the `.dxt` file into Claude Desktop.

## Configuration

### For npm package usage:
Create a `.env` file or set environment variables:
```bash
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

### For Claude Desktop DXT:
Configure the extension settings in Claude Desktop with your n8n instance URL and API key.

## Build

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build DXT package
./build-dxt.sh
```

## Tools

### Workflow Management
- `list_workflows` - List all workflows with filtering options
- `get_workflow` - Get workflow details and structure  
- `create_workflow` - Create new workflows
- `update_workflow` - Modify existing workflows
- `delete_workflow` - Remove workflows
- `activate_workflow` - Enable workflows
- `deactivate_workflow` - Disable workflows

### Execution Management
- `list_executions` - View execution history
- `get_execution` - Get execution details and logs
- `delete_execution` - Remove execution records
- `run_webhook` - Trigger webhook workflows

### Node Management
- `list_nodes` - List workflow nodes
- `get_node` - Get node configuration
- `update_node` - Modify node settings
- `add_node` - Insert new nodes
- `remove_node` - Delete nodes
- `update_node_connections` - Manage node connections

### Analysis & AI Tools
- `validate_workflow` - Check workflow integrity
- `get_workflow_stats` - Performance statistics
- `workflow_thinking` - AI workflow analysis
- `workflow_planning` - AI workflow design
- `workflow_research` - AI best practices research
- `workflow_brainstorm` - AI creative solutions
- `workflow_optimize` - AI performance optimization

### System
- `health_check` - Check n8n connectivity

**Total: 25 tools**