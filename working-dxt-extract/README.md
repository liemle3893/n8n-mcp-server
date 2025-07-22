# n8n Workflow Automation Server - DXT Extension

A Desktop Extension (DXT) that provides seamless integration with n8n workflow automation platform through the Model Context Protocol (MCP).

## Overview

This extension enables AI assistants to interact with n8n instances to:
- Create, manage, and execute workflows
- Monitor workflow executions
- Trigger workflows via webhooks
- Perform health checks and diagnostics
- Browse workflow resources

## Prerequisites

- n8n instance (cloud or self-hosted) with API access enabled
- n8n API key with appropriate permissions
- Node.js 20 or later (for development)

## Configuration

After installing this extension in Claude Desktop, configure the following settings:

### Required Settings

- **n8n API Key**: Your n8n API key (get from n8n Settings > API Keys)
- **n8n API URL**: Full URL to your n8n API including `/api/v1`
  - Cloud: `https://your-workspace.app.n8n.cloud/api/v1`
  - Self-hosted: `http://your-n8n-domain:5678/api/v1`

### Optional Settings

- **Webhook Username/Password**: For webhook authentication (if using basic auth)
- **Request Timeout**: API request timeout in milliseconds (default: 30000)
- **Max Results**: Maximum items to return in list operations (default: 50)
- **Enable Debug**: Enable verbose logging for troubleshooting

## Available Tools

### Workflow Management
- `list_workflows` - Get all workflows
- `get_workflow` - Get specific workflow by ID
- `create_workflow` - Create new workflow
- `update_workflow` - Update existing workflow
- `delete_workflow` - Delete workflow
- `activate_workflow` - Activate workflow
- `deactivate_workflow` - Deactivate workflow

### Execution Management
- `list_executions` - Get workflow executions
- `get_execution` - Get specific execution details
- `delete_execution` - Delete execution
- `run_webhook` - Trigger workflow via webhook

### System Tools
- `health_check` - Test n8n connectivity
- `get_credentials` - List available credentials (read-only)

## Usage Examples

After installation and configuration, you can use natural language to:

- "Show me all my n8n workflows"
- "Create a new workflow that sends an email when a webhook is triggered"
- "Check the status of my n8n instance"
- "Run the 'customer-notification' workflow with this data"
- "Show me the last 10 executions of the 'data-sync' workflow"

## Troubleshooting

### Connection Issues
- Verify your n8n API URL includes `/api/v1`
- Ensure your n8n API key has the necessary permissions
- Check that your n8n instance is accessible from your machine

### Authentication Errors
- Regenerate your n8n API key
- Verify the API key is correctly configured in extension settings

### Enable Debug Logging
Turn on "Enable Debug" in the extension settings to see detailed request/response information in the logs.

## Security

- API keys are stored securely and never logged
- All communication uses HTTPS when connecting to cloud n8n instances
- Webhook credentials are optional and only used for authenticated webhooks

## Version

Extension Version: 0.1.8
DXT Specification: 0.1

## Support

- GitHub Issues: https://github.com/leonardsellem/n8n-mcp-server/issues
- Documentation: https://github.com/leonardsellem/n8n-mcp-server/blob/main/README.md