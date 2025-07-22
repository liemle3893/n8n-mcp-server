# n8n MCP Server

A Model Context Protocol (MCP) server for n8n workflow automation.

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