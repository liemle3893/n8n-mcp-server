# n8n MCP Server - Desktop Extension (DXT)

A comprehensive Model Context Protocol (MCP) server for n8n workflow automation, packaged as a Desktop Extension for seamless integration with AI assistants.

## Overview

This extension enables AI assistants to interact with n8n instances to:
- List, create, update, and delete workflows
- Execute workflows and manage executions
- Monitor n8n instance health
- Manage workflow activation/deactivation

## Features

### 🚀 Core Functionality
- **Workflow Management**: Complete CRUD operations for n8n workflows
- **Execution Control**: Trigger workflows and monitor execution history
- **Health Monitoring**: Built-in connectivity and health checks
- **Authentication**: Secure API key-based authentication

### 🛡️ DXT Enhancements
- **Configurable Timeouts**: User-configurable request timeouts (5s-120s)
- **Rate Limiting**: Configurable maximum results (1-500)
- **Debug Logging**: Optional verbose logging for troubleshooting
- **Error Resilience**: Comprehensive error handling with user-friendly messages
- **Graceful Shutdown**: Proper cleanup on termination

### 🔧 Technical Features
- **Stdio Transport**: Full MCP protocol compliance via stdin/stdout
- **TypeScript**: Fully typed implementation with comprehensive error handling
- **Cross-Platform**: Support for Windows, macOS, and Linux
- **Node.js 18+**: Modern JavaScript features and security

## Installation

### Prerequisites
- n8n instance (cloud or self-hosted) with API access enabled
- n8n API key with appropriate permissions

### DXT Installation
1. Download the extension package (`n8n-mcp-server.dxt`)
2. Install via your DXT-compatible AI assistant
3. Configure the required settings (see Configuration section)

### Manual Installation
```bash
# Clone and build
git clone https://github.com/liemle3893/n8n-mcp-server.git
cd n8n-mcp-server
npm install
npm run build

# Test the server
node build/index.js
```

## Configuration

### Required Settings
- **n8n_api_key**: Your n8n API key (get from n8n Settings > API Keys)
- **n8n_base_url**: Your n8n instance URL (e.g., `https://your-n8n.app.n8n.cloud` or `http://localhost:5678`)

### Optional Settings
- **timeout**: Request timeout in milliseconds (default: 30000, range: 5000-120000)
- **max_results**: Maximum results returned for list operations (default: 50, range: 1-500)
- **enable_debug**: Enable verbose debug logging (default: false)

### Getting Your n8n API Key

#### n8n Cloud
1. Go to your n8n cloud dashboard
2. Navigate to Settings > API Keys
3. Click "Create API Key"
4. Copy the generated key

#### Self-Hosted n8n
1. Open your n8n instance
2. Go to Settings > API Keys
3. Click "Create API Key"
4. Copy the generated key

## Available Tools

### Workflow Management
- `get_workflows` / `list_workflows`: List all workflows
- `get_workflow`: Get specific workflow by ID
- `create_workflow`: Create new workflow
- `update_workflow`: Update existing workflow
- `delete_workflow`: Delete workflow
- `activate_workflow`: Activate workflow
- `deactivate_workflow`: Deactivate workflow

### Execution Management
- `get_executions` / `list_executions`: List workflow executions
- `get_execution`: Get specific execution details
- `delete_execution`: Delete execution record
- `execute_workflow` / `run_webhook`: Execute workflow

### System
- `health_check`: Check n8n connectivity and server status
- `get_credentials`: Security information (read-only)

## Usage Examples

### Health Check
```javascript
// Check if n8n is accessible
await callTool('health_check')
```

### List Workflows
```javascript
// Get all workflows
const workflows = await callTool('get_workflows')

// Get specific workflow
const workflow = await callTool('get_workflow', { id: 'workflow-id' })
```

### Create Workflow
```javascript
const newWorkflow = await callTool('create_workflow', {
  name: 'My Automation',
  nodes: [
    {
      id: 'start',
      type: 'n8n-nodes-base.start',
      position: [250, 300],
      parameters: {}
    }
    // ... more nodes
  ],
  connections: {}
})
```

### Execute Workflow
```javascript
const execution = await callTool('execute_workflow', {
  id: 'workflow-id',
  data: { input: 'value' }
})
```

## Troubleshooting

### Common Issues

#### Connection Refused
**Error**: `Cannot connect to n8n instance`
**Solution**: 
- Verify n8n is running and accessible
- Check the n8n_base_url configuration
- Ensure no firewall is blocking the connection

#### Authentication Failed
**Error**: `Authentication failed`
**Solution**: 
- Verify the n8n_api_key is correct
- Ensure the API key has sufficient permissions
- Check if the API key has expired

#### Timeout Errors
**Error**: `Request timed out`
**Solution**: 
- Increase the timeout setting
- Check network connectivity
- Verify n8n instance performance

### Debug Mode
Enable debug logging for detailed troubleshooting:
1. Set `enable_debug: true` in DXT configuration
2. Restart the extension
3. Check logs for detailed request/response information

### Health Check
Use the built-in health check tool to diagnose connectivity:
```bash
# Via MCP call
{
  "method": "tools/call",
  "params": {
    "name": "health_check"
  }
}
```

## Security Considerations

- **API Key Storage**: API keys are stored securely by the DXT framework
- **Network Security**: All communication uses HTTPS (recommended)
- **Credentials Access**: Read-only access to credential metadata only
- **Input Validation**: All inputs are validated and sanitized

## Performance

- **Timeout Management**: Configurable timeouts prevent hanging requests
- **Result Limiting**: Configurable limits prevent memory issues
- **Error Resilience**: Graceful handling of API failures
- **Resource Cleanup**: Proper shutdown handling

## Development

### Building from Source
```bash
git clone https://github.com/liemle3893/n8n-mcp-server.git
cd n8n-mcp-server
npm install
npm run build
```

### Running Tests
```bash
npm run test
npm run test:coverage
```

### Linting
```bash
npm run lint
```

## Support

- **Issues**: [GitHub Issues](https://github.com/liemle3893/n8n-mcp-server/issues)
- **Documentation**: [GitHub Wiki](https://github.com/liemle3893/n8n-mcp-server)
- **Community**: n8n Community Forum

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v0.1.8
- DXT compatibility enhancements
- Configurable timeouts and result limits  
- Enhanced error handling and user feedback
- Health check tool
- Comprehensive logging system
- Cross-platform support improvements

---

**Note**: This extension requires an active n8n instance with API access. Ensure you have the necessary permissions and network connectivity before installation.