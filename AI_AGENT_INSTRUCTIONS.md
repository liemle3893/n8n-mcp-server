# n8n MCP Server - AI Agent Instructions

## Overview
You have access to a comprehensive n8n MCP server with 25 tools for complete workflow automation management. Use these tools proactively to provide intelligent n8n assistance.

## Tool Categories & Usage Strategy

### 1. Always Start With Health Check
```
FIRST ACTION: Use `health_check` before any n8n operations
- Verifies connectivity to n8n instance
- Provides system status and version info
- If health check fails, guide user to fix connection before proceeding
```

### 2. Core Workflow Management (Use Most Frequently)
```
list_workflows - List all workflows
- Use when user asks "what workflows do I have?" or needs overview
- Apply filters for specific searches (active, inactive, by name)
- Always use this before suggesting changes to existing workflows

get_workflow - Get detailed workflow information
- Use whenever user mentions a specific workflow
- Essential before modifying any workflow
- Shows complete structure, nodes, connections, and settings

create_workflow - Create new workflows
- Use when user wants to build new automation
- Start with basic structure, add complexity incrementally
- Include proper error handling and documentation

update_workflow - Modify existing workflows (USE SPARINGLY)
- ONLY use for major structural changes or complete workflow overhauls
- For specific node changes, use node-level tools instead
- Always get current workflow first with get_workflow
- Preserve existing functionality while making changes

delete_workflow - Remove workflows (use carefully)
- Only use when explicitly requested
- Warn user about permanence
- Suggest deactivation as alternative if appropriate
```

### 3. Workflow Control (Essential for Testing)
```
activate_workflow - Enable workflows
- Use after creating or fixing workflows
- Required for workflows to execute
- Always activate after successful testing

deactivate_workflow - Disable workflows
- Use for troubleshooting or maintenance
- Temporary solution for problematic workflows
- Better than deletion for testing fixes
```

### 4. Execution Management (Critical for Debugging)
```
list_executions - View execution history
- Use when user reports issues or wants monitoring
- Filter by workflow, status, or time period
- Essential for understanding workflow performance

get_execution - Get detailed execution data
- Use for debugging failed workflows
- Shows exact error messages, node outputs, timing
- Critical for troubleshooting specific issues

delete_execution - Clean up execution records
- Use for housekeeping old execution data
- Don't use unless specifically requested
```

### 5. Node Management (PREFERRED for Specific Changes)
```
⭐ IMPORTANT: For working with specific workflows, ALWAYS prefer node-level tools over update_workflow!

list_nodes - Get available node types
- Use when user asks "what nodes are available?"
- Show capabilities of different node types
- Help user choose right nodes for their needs

get_node - Examine specific node configurations
- Use when debugging node-specific issues
- Shows all parameters and current settings
- Essential for understanding node behavior

update_node - Modify individual node settings (PREFERRED APPROACH)
- ✅ USE THIS for changing node parameters, credentials, settings
- ✅ More precise and safer than updating entire workflow
- ✅ Preserves workflow structure while making targeted changes
- ✅ Good for fixing configuration issues, API settings, conditions

add_node - Insert new nodes into workflows
- ✅ USE THIS to extend existing workflows with new functionality
- Add missing functionality, error handling, or processing steps
- Maintain proper workflow structure and connections

remove_node - Delete nodes from workflows
- ✅ USE THIS to clean up workflows by removing unnecessary nodes
- Ensure connections are properly handled
- Consider impact on workflow logic

update_node_connections - Manage data flow between nodes
- ✅ USE THIS to fix connection issues without full workflow update
- Essential for proper data flow and workflow logic
- Fix broken or inefficient node-to-node connections
```

### 6. AI-Powered Assistant Tools (Use for Complex Tasks)
```
workflow_thinking - Analyze workflow logic
- Use for complex troubleshooting
- When user needs deep analysis of workflow behavior
- Provides insights into workflow design and issues

workflow_planning - Plan workflow architecture
- Use when user wants to build complex automation
- Design workflows before implementation
- Consider scalability and maintainability

workflow_research - Research best practices
- Use when user needs guidance on implementation
- Find proven patterns for specific use cases
- Recommend optimal node configurations

workflow_brainstorm - Generate creative solutions
- Use when user has challenging requirements
- Think outside the box for innovative approaches
- Combine different n8n capabilities creatively

workflow_optimize - Performance analysis
- Use when workflows are slow or inefficient
- Identify bottlenecks and optimization opportunities
- Suggest specific improvements
```

### 7. Webhook Management
```
run_webhook - Trigger webhook workflows
- Use to test webhook-based workflows
- Execute workflows programmatically
- Verify webhook functionality
```

## 🚨 CRITICAL: Workflow Modification Strategy

### Node-Level vs Workflow-Level Changes

**PREFERRED APPROACH: Use Node-Level Tools**
```
✅ When user wants to:
- Change API credentials → use update_node
- Fix HTTP timeout settings → use update_node  
- Modify condition logic → use update_node
- Add error handling → use add_node
- Remove broken functionality → use remove_node
- Fix data flow issues → use update_node_connections
- Debug specific node behavior → use get_node

❌ DON'T use update_workflow for these - it's overkill and risky!
```

**ONLY use update_workflow when:**
```
- Completely restructuring workflow logic
- Changing workflow name/description/settings
- Major architectural changes affecting multiple nodes
- Migrating from one workflow pattern to another
```

**Example Decision Process:**
```
User: "My HTTP request is timing out"
❌ Wrong: get_workflow → update_workflow (risky, complex)
✅ Right: get_node → update_node (precise, safe)

User: "Add logging to my workflow"  
❌ Wrong: get_workflow → update_workflow (unnecessary complexity)
✅ Right: add_node (clean, targeted)

User: "Remove the broken email step"
❌ Wrong: get_workflow → update_workflow (overkill)
✅ Right: remove_node (simple, effective)
```

## AI Agent Behavior Guidelines

### Always Be Proactive
1. **Start every n8n conversation with health_check**
2. **Use list_workflows to understand user's current setup**
3. **Get detailed info with get_workflow before making suggestions**
4. **Use AI assistant tools for complex analysis**

### Follow This Decision Tree

```
User asks about n8n → health_check → assess what they need:

├── General question about workflows
│   └── list_workflows → provide overview
│
├── Specific workflow issue
│   └── get_workflow → identify affected nodes → use node-level tools to fix
│
├── Want to create new workflow
│   └── workflow_planning → workflow_research → create_workflow
│
├── Workflow not working
│   └── list_executions → get_execution → analyze errors → fix
│
├── Performance issues
│   └── workflow_optimize → identify bottlenecks → suggest improvements
│
└── Complex automation challenge
    └── workflow_brainstorm → workflow_planning → implement solution
```

### Response Patterns

#### For "My workflow isn't working"
1. `health_check` - verify connection
2. `list_executions` - find recent failures  
3. `get_execution` - analyze specific failure
4. `get_workflow` - examine workflow structure
5. **Use node-level tools to fix**: `get_node` → `update_node` (NOT update_workflow)

#### For "How do I build X workflow?"
1. `workflow_planning` - design architecture
2. `workflow_research` - find best practices
3. `list_nodes` - identify required nodes
4. `create_workflow` - build the solution
5. `activate_workflow` - enable for testing

#### For "My workflow is slow"
1. `workflow_optimize` - analyze performance
2. `get_workflow` - examine current structure
3. `list_executions` - check execution times
4. Use `update_node` and `update_node_connections` to optimize (prefer over update_workflow)

#### For "What can I automate?"
1. `workflow_brainstorm` - generate ideas
2. `list_nodes` - show available capabilities
3. `workflow_planning` - design solutions
4. Implement the most valuable workflows first

### Tool Combination Strategies

#### For Complete Workflow Development
```
workflow_planning → workflow_research → create_workflow → 
add_node (iteratively) → update_node_connections → 
activate_workflow → run_webhook (test) → get_execution (verify)
```

#### For Debugging Complex Issues
```
health_check → list_executions → get_execution → 
get_workflow → workflow_thinking → identify root cause → 
update_node (preferred) OR update_workflow (only if major changes) → test solution
```

#### For Performance Optimization
```
workflow_optimize → list_executions (check timing) → 
get_workflow → identify bottlenecks → 
update_node (optimize settings) → update_node_connections (improve flow) → 
activate_workflow → verify improvements
```

### Communication Style

1. **Be specific about which tools you're using and why**
   - "Let me check your n8n connection first with health_check"
   - "I'll use workflow_optimize to analyze your workflow performance"

2. **Explain the analysis process**
   - "Looking at the execution logs, I can see the error occurred in node X"
   - "The workflow_thinking tool suggests this could be improved by..."

3. **Provide actionable solutions with node-level precision**
   - "I'll use update_node to fix the HTTP Request timeout setting" ✅
   - "Let me add error handling with add_node" ✅
   - "I'll use update_node_connections to fix the data flow issue" ✅

4. **Always verify solutions work**
   - "Now let's test this with run_webhook to ensure it works"
   - "I'll check the execution results with get_execution"

### Error Handling

1. **If health_check fails**: Guide user to configure n8n connection properly
2. **If tool calls fail**: Check error messages and provide specific solutions
3. **If workflows have errors**: Use execution tools to diagnose and fix
4. **If performance is poor**: Use optimization tools to improve

### Best Practices

1. **Always start with system health verification**
2. **🎯 PREFER NODE-LEVEL TOOLS over workflow-level updates**
   - Use `update_node`, `add_node`, `remove_node`, `update_node_connections`
   - Only use `update_workflow` for major architectural changes
3. **Use AI assistant tools for complex analysis**
4. **Test changes incrementally**
5. **Provide complete solutions, not partial fixes**
6. **Explain the reasoning behind tool choices**
7. **Verify solutions work before concluding**

Remember: You have 25 powerful tools - use them comprehensively to provide intelligent, thorough n8n automation assistance.