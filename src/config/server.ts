/**
 * Server Configuration
 * 
 * This module configures the MCP server with tools and resources
 * for n8n workflow management.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getEnvConfig } from './environment.js';
import { setupWorkflowTools } from '../tools/workflow/index.js';
import { setupExecutionTools } from '../tools/execution/index.js';
import { setupResourceHandlers } from '../resources/index.js';
import { createApiService } from '../api/n8n-client.js';

// Import types
import { ToolCallResult } from '../types/index.js';

/**
 * Configure and return an MCP server instance with all tools and resources
 * 
 * @returns Configured MCP server instance
 */
export async function configureServer(): Promise<Server> {
  // Get validated environment configuration
  const envConfig = getEnvConfig();
  
  // Create n8n API service
  const apiService = createApiService(envConfig);
  
  // Verify n8n API connectivity
  try {
    console.error('Verifying n8n API connectivity...');
    await apiService.checkConnectivity();
    console.error(`Successfully connected to n8n API at ${envConfig.n8nApiUrl}`);
  } catch (error) {
    console.error('ERROR: Failed to connect to n8n API:', error instanceof Error ? error.message : error);
    throw error;
  }

  // Create server instance
  const server = new Server(
    {
      name: 'n8n-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Set up all request handlers
  setupToolListRequestHandler(server);
  setupToolCallRequestHandler(server);
  setupPromptsListRequestHandler(server);
  setupResourceHandlers(server, envConfig);

  return server;
}

/**
 * Set up the tool list request handler for the server
 * 
 * @param server MCP server instance
 */
function setupToolListRequestHandler(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Combine tools from workflow and execution modules
    const workflowTools = await setupWorkflowTools();
    const executionTools = await setupExecutionTools();

    return {
      tools: [...workflowTools, ...executionTools],
    };
  });
}

/**
 * Set up the prompts list request handler for the server
 * 
 * @param server MCP server instance
 */
function setupPromptsListRequestHandler(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: []
    };
  });
}

/**
 * Set up the tool call request handler for the server
 * Enhanced for DXT with comprehensive error handling and health check support
 * 
 * @param server MCP server instance
 */
function setupToolCallRequestHandler(server: Server): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    const startTime = Date.now();

    let result: ToolCallResult;

    try {
      // Health check tool for DXT diagnostics
      if (toolName === 'health_check') {
        const envConfig = getEnvConfig();
        const apiService = createApiService(envConfig);
        
        try {
          await apiService.checkConnectivity();
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                status: 'healthy',
                n8n_url: envConfig.n8nApiUrl,
                timestamp: new Date().toISOString(),
                version: '0.1.8'
              }, null, 2)
            }],
            isError: false,
          };
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                n8n_url: envConfig.n8nApiUrl,
                timestamp: new Date().toISOString()
              }, null, 2)
            }],
            isError: true,
          };
        }
      }

      // Import handlers dynamically for better performance
      const { 
        ListWorkflowsHandler, 
        GetWorkflowHandler,
        CreateWorkflowHandler,
        UpdateWorkflowHandler,
        DeleteWorkflowHandler,
        ActivateWorkflowHandler,
        DeactivateWorkflowHandler
      } = await import('../tools/workflow/index.js');
      
      const {
        ListExecutionsHandler,
        GetExecutionHandler,
        DeleteExecutionHandler,
        RunWebhookHandler
      } = await import('../tools/execution/index.js');
      
      // Enhanced tool routing with timing
      const handlers: Record<string, () => Promise<ToolCallResult>> = {
        'list_workflows': async () => {
          const handler = new ListWorkflowsHandler();
          return await handler.execute(args);
        },
        'get_workflows': async () => { // Alias for DXT manifest compatibility
          const handler = new ListWorkflowsHandler();
          return await handler.execute(args);
        },
        'get_workflow': async () => {
          const handler = new GetWorkflowHandler();
          return await handler.execute(args);
        },
        'create_workflow': async () => {
          const handler = new CreateWorkflowHandler();
          return await handler.execute(args);
        },
        'update_workflow': async () => {
          const handler = new UpdateWorkflowHandler();
          return await handler.execute(args);
        },
        'delete_workflow': async () => {
          const handler = new DeleteWorkflowHandler();
          return await handler.execute(args);
        },
        'activate_workflow': async () => {
          const handler = new ActivateWorkflowHandler();
          return await handler.execute(args);
        },
        'deactivate_workflow': async () => {
          const handler = new DeactivateWorkflowHandler();
          return await handler.execute(args);
        },
        'list_executions': async () => {
          const handler = new ListExecutionsHandler();
          return await handler.execute(args);
        },
        'get_executions': async () => { // Alias for DXT manifest compatibility
          const handler = new ListExecutionsHandler();
          return await handler.execute(args);
        },
        'get_execution': async () => {
          const handler = new GetExecutionHandler();
          return await handler.execute(args);
        },
        'delete_execution': async () => {
          const handler = new DeleteExecutionHandler();
          return await handler.execute(args);
        },
        'run_webhook': async () => {
          const handler = new RunWebhookHandler();
          return await handler.execute(args);
        },
        'execute_workflow': async () => { // Alias for DXT manifest compatibility
          const handler = new RunWebhookHandler();
          return await handler.execute(args);
        },
        'get_credentials': async () => {
          // Basic credentials listing (read-only for security)
          return {
            content: [{
              type: 'text',
              text: 'Credentials listing is not supported for security reasons. Use the n8n UI to manage credentials.'
            }],
            isError: false,
          };
        }
      };

      const handlerFn = handlers[toolName];
      if (!handlerFn) {
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${Object.keys(handlers).join(', ')}`);
      }

      result = await handlerFn();

      // Add execution timing for debugging
      const executionTime = Date.now() - startTime;
      if (getEnvConfig().debug) {
        console.error(`[TOOL_EXECUTION] ${toolName} completed in ${executionTime}ms`);
      }

      // Converting to MCP SDK expected format
      return {
        content: result.content,
        isError: result.isError,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const timestamp = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[${timestamp}] [TOOL_ERROR] ${toolName} failed after ${executionTime}ms: ${errorMessage}`);
      
      // Provide helpful error context for DXT users
      let helpfulError = errorMessage;
      if (errorMessage.includes('ECONNREFUSED')) {
        helpfulError = `Cannot connect to n8n instance. Please check that n8n is running at the configured URL and is accessible.`;
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        helpfulError = `Authentication failed. Please check your n8n API key configuration.`;
      } else if (errorMessage.includes('timeout')) {
        helpfulError = `Request timed out. Please check your network connection or increase the timeout setting.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${toolName}: ${helpfulError}`,
          },
        ],
        isError: true,
      };
    }
  });
}
