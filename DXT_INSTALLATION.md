# n8n Workflow Automation Server - DXT Installation Guide

## Overview

This Desktop Extension (DXT) provides seamless integration between Claude Desktop and n8n workflow automation platform through the Model Context Protocol (MCP).

## Installation

### Prerequisites

1. **Claude Desktop** with DXT support
2. **n8n instance** (cloud or self-hosted) with API access
3. **n8n API key** with appropriate permissions

### Step 1: Install the DXT Extension

1. Download the `n8n-mcp-server.dxt` file
2. In Claude Desktop, go to Extensions or Settings
3. Import/Install the DXT file
4. The extension will appear as "n8n Workflow Automation Server"

### Step 2: Configuration

Configure the following settings in Claude Desktop's extension settings:

#### Required Settings

- **n8n API Key**: Your n8n API key
  - Get from: n8n Settings > API Keys
  - Format: `n8n_api_...`

- **n8n API URL**: Full URL to your n8n API
  - Cloud: `https://your-workspace.app.n8n.cloud/api/v1`
  - Self-hosted: `http://your-n8n-domain:5678/api/v1`
  - **Important**: Must include `/api/v1` at the end

#### Optional Settings

- **Webhook Username/Password**: For webhook authentication (if needed)
- **Request Timeout**: API request timeout (default: 30000ms)
- **Max Results**: Maximum items in list operations (default: 50)
- **Enable Debug**: Verbose logging for troubleshooting

### Step 3: Verification

After installation and configuration:

1. Restart Claude Desktop if needed
2. Test the connection by asking: "Check my n8n health status"
3. Verify with: "Show me all my n8n workflows"

## Usage Examples

Once installed, you can use natural language commands:

### Workflow Management
- "Show me all my n8n workflows"
- "Get details for workflow ID abc123"
- "Create a new workflow that sends email notifications"
- "Activate the 'customer-onboarding' workflow"
- "Deactivate the 'old-process' workflow"

### Execution Monitoring
- "Show me the last 10 workflow executions"
- "Get execution details for ID def456"
- "Show me failed executions from today"
- "Delete old executions for the data-sync workflow"

### Webhook Triggers
- "Trigger the 'process-order' webhook with this customer data"
- "Run the notification workflow via webhook"

### System Operations
- "Check my n8n instance health"
- "Test connectivity to my n8n server"

### Node-Level Operations
- "List all nodes in workflow abc123"
- "Show me details for the HTTP Request node in my workflow"
- "Update the API URL parameter in the webhook node"
- "Add a Slack notification node to workflow xyz789"
- "Remove the outdated email node from the workflow"
- "Connect the new node to the existing validation node"

### Workflow Analysis & Optimization
- "Validate my workflow for potential issues"
- "Show me performance statistics for workflow abc123"
- "Analyze execution patterns over the last 7 days"

### AI-Powered Workflow Design
- "Help me think through automating customer onboarding"
- "Create a detailed plan for processing invoice data"
- "Research best practices for email automation workflows"
- "Brainstorm creative solutions for inventory management"
- "Optimize my existing workflow for better performance"

## Available Tools

### Workflow Management (7 tools)
- `list_workflows` - Get all workflows
- `get_workflow` - Get specific workflow details
- `create_workflow` - Create new workflow
- `update_workflow` - Update existing workflow
- `delete_workflow` - Delete workflow
- `activate_workflow` - Activate workflow
- `deactivate_workflow` - Deactivate workflow

### Execution Management (4 tools)
- `list_executions` - Get workflow executions
- `get_execution` - Get execution details
- `delete_execution` - Delete execution record
- `run_webhook` - Trigger workflow via webhook

### Node Manipulation (6 tools)
- `list_nodes` - Extract and list all nodes from a workflow
- `get_node` - Get detailed information about a specific node
- `update_node` - Update a specific node's parameters
- `add_node` - Add a new node to an existing workflow
- `remove_node` - Remove a node from a workflow
- `update_node_connections` - Update connections between nodes

### Workflow Analysis (2 tools)
- `validate_workflow` - Validate workflow for issues and best practices
- `get_workflow_stats` - Get execution statistics and performance metrics

### AI-Powered Workflow Assistant (5 tools)
- `workflow_thinking` - Deep analysis and problem decomposition
- `workflow_planning` - Implementation planning with step-by-step guidance
- `workflow_research` - Research best practices and integration options
- `workflow_brainstorm` - Creative workflow solution brainstorming
- `workflow_optimize` - Optimization analysis and recommendations

### System Tools (1 tool)
- `health_check` - Test n8n connectivity and status

## Troubleshooting

### Common Issues

#### "Cannot connect to n8n instance"
- Verify your n8n API URL is correct and includes `/api/v1`
- Ensure n8n is running and accessible
- Check firewall/network connectivity

#### "Authentication failed"
- Regenerate your n8n API key
- Verify the API key is correctly configured
- Ensure the API key has necessary permissions

#### "Request timeout"
- Increase the timeout setting
- Check network connectivity
- Verify n8n instance performance

### Enable Debug Logging

For detailed troubleshooting:

1. Enable "Debug Logging" in extension settings
2. Restart Claude Desktop
3. Reproduce the issue
4. Check Claude Desktop logs for detailed error information

### Log Analysis

Debug logs include:
- HTTP request/response details
- Authentication status
- Connection timing
- Error stack traces
- Environment configuration

## Security Notes

- API keys are stored securely and never logged
- Webhook credentials are optional and encrypted
- All communication uses HTTPS for cloud instances
- Extension runs locally with no external dependencies

## Technical Details

- **DXT Version**: 0.1.9
- **Extension Version**: 0.1.8 (Enhanced)
- **Node.js Requirements**: >=20.0.0
- **Supported Platforms**: macOS, Windows, Linux
- **Protocol**: Model Context Protocol (MCP) 2025-06-18
- **Total Tools**: 25 (was 5 in previous versions)

## New Features in This Version

### Enhanced Workflow Management
- **Complete CRUD Operations**: Full create, read, update, delete support for workflows
- **Workflow Activation Control**: Activate and deactivate workflows programmatically
- **Advanced Execution Management**: Get detailed execution information and clean up old records

### Node-Level Manipulation
- **Granular Node Control**: List, inspect, update, add, and remove individual nodes
- **Connection Management**: Update workflow connections and node relationships
- **Smart Positioning**: Automatic node positioning when adding new nodes
- **Name Conflict Resolution**: Intelligent handling of node naming and ID generation

### Intelligent Workflow Analysis
- **Comprehensive Validation**: Check for orphaned nodes, missing parameters, and best practices
- **Performance Analytics**: Detailed execution statistics, success rates, and timing analysis
- **Health Scoring**: Workflow quality assessment with actionable recommendations

### AI-Powered Workflow Assistant
- **Strategic Thinking**: Deep problem analysis and requirement decomposition
- **Implementation Planning**: Step-by-step workflow design with technical details
- **Research Assistant**: Best practices research and integration recommendations
- **Creative Brainstorming**: Multiple solution approaches and innovative ideas
- **Optimization Analysis**: Performance, reliability, and cost optimization recommendations

### Claude-Optimized Experience
- **Natural Language Processing**: Designed to work seamlessly with Claude's reasoning capabilities
- **Structured Output**: Comprehensive reports and actionable insights
- **Context-Aware**: Tools that understand your existing workflows and provide relevant suggestions

## Support

- **GitHub Issues**: https://github.com/liemle3893/n8n-mcp-server/issues
- **Documentation**: https://github.com/liemle3893/n8n-mcp-server/blob/main/README.md
- **n8n Documentation**: https://docs.n8n.io/

## Version History

### v0.1.8
- Initial DXT release
- Full MCP protocol compliance
- Comprehensive error handling
- Debug logging capabilities
- Support for cloud and self-hosted n8n instances