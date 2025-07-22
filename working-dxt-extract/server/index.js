#!/usr/bin/env node

/**
 * n8n MCP Server - DXT Entry Point
 * 
 * Desktop Extension (DXT) optimized version of the n8n MCP Server.
 * This entry point provides enhanced DXT compatibility, robust error handling,
 * and proper environment variable management for desktop environments.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// DXT configuration and metadata
const DXT_CONFIG = {
  name: 'n8n-mcp-server',
  version: '0.1.8',
  startup_timeout: 30000,
  shutdown_timeout: 10000,
  max_retries: 3,
  default_timeout: 30000,
};

let serverInstance = null;
let isShuttingDown = false;

/**
 * Enhanced logging for DXT environment with structured output
 */
function dxtLog(level, context, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    context,
    message,
    ...(data && { data })
  };
  
  // Use stderr for all logging to avoid interfering with MCP stdio communication
  console.error(JSON.stringify(logEntry));
}

/**
 * Environment configuration with DXT defaults and validation
 */
function getDxtEnvironmentConfig() {
  const config = {
    n8nApiUrl: process.env.N8N_API_URL || process.env.N8N_BASE_URL || 'http://localhost:5678/api/v1',
    n8nApiKey: process.env.N8N_API_KEY,
    n8nWebhookUsername: process.env.N8N_WEBHOOK_USERNAME,
    n8nWebhookPassword: process.env.N8N_WEBHOOK_PASSWORD,
    debug: process.env.DEBUG === 'true',
    timeout: parseInt(process.env.REQUEST_TIMEOUT || process.env.TIMEOUT) || DXT_CONFIG.default_timeout,
    maxResults: parseInt(process.env.MAX_RESULTS) || 50,
  };

  // Normalize API URL
  if (config.n8nApiUrl && !config.n8nApiUrl.includes('/api/v1')) {
    config.n8nApiUrl = config.n8nApiUrl.replace(/\/$/, '') + '/api/v1';
  }

  // Validation for required fields - but don't crash if missing, just log warnings
  if (!config.n8nApiKey) {
    dxtLog('warn', 'CONFIG', 'N8N_API_KEY environment variable not configured - extension will have limited functionality');
    config.n8nApiKey = 'not-configured';
  }

  if (!config.n8nApiUrl) {
    dxtLog('warn', 'CONFIG', 'N8N_API_URL environment variable not configured - using default');
    config.n8nApiUrl = 'http://localhost:5678/api/v1';
  }

  dxtLog('info', 'CONFIG', 'Environment configuration loaded', {
    n8nApiUrl: config.n8nApiUrl,
    hasApiKey: !!config.n8nApiKey,
    hasWebhookAuth: !!(config.n8nWebhookUsername && config.n8nWebhookPassword),
    debug: config.debug,
    timeout: config.timeout,
    maxResults: config.maxResults
  });

  return config;
}

/**
 * Create axios instance with DXT-optimized configuration
 */
function createApiClient(config) {
  const client = axios.create({
    baseURL: config.n8nApiUrl,
    timeout: config.timeout,
    headers: {
      'X-N8N-API-KEY': config.n8nApiKey,
      'Content-Type': 'application/json',
      'User-Agent': `n8n-mcp-server-dxt/${DXT_CONFIG.version}`,
    },
    maxRedirects: 3,
    validateStatus: (status) => status < 500, // Don't throw on 4xx errors
  });

  // Request interceptor for debugging
  if (config.debug) {
    client.interceptors.request.use((request) => {
      dxtLog('debug', 'HTTP_REQUEST', 'API request', {
        method: request.method?.toUpperCase(),
        url: request.url,
        headers: { ...request.headers, 'X-N8N-API-KEY': '[REDACTED]' }
      });
      return request;
    });

    client.interceptors.response.use(
      (response) => {
        dxtLog('debug', 'HTTP_RESPONSE', 'API response', {
          status: response.status,
          url: response.config.url,
          dataLength: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        dxtLog('error', 'HTTP_ERROR', 'API error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  return client;
}

/**
 * Test n8n API connectivity with detailed error reporting
 */
async function testConnectivity(apiClient, config) {
  try {
    dxtLog('info', 'CONNECTIVITY', 'Testing n8n API connectivity...');
    
    const response = await apiClient.get('/workflows', {
      params: { limit: 1 }
    });

    if (response.status === 200) {
      dxtLog('info', 'CONNECTIVITY', 'Successfully connected to n8n API', {
        url: config.n8nApiUrl,
        responseStatus: response.status
      });
      return true;
    } else if (response.status === 401) {
      throw new Error('Authentication failed - check your N8N_API_KEY');
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to n8n instance at ${config.n8nApiUrl} - is n8n running?`);
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed - check your N8N_API_KEY configuration');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Connection timeout after ${config.timeout}ms - check network connectivity`);
    } else {
      throw new Error(`n8n API connectivity test failed: ${error.message}`);
    }
  }
}

/**
 * Enhanced tool execution with DXT error handling
 */
async function executeToolWithErrorHandling(toolName, args, apiClient, config) {
  const startTime = Date.now();
  
  try {
    dxtLog('debug', 'TOOL_EXEC', `Executing tool: ${toolName}`, { args });

    // Check if API is configured for tools that require it
    const requiresApiKey = !['health_check'].includes(toolName);
    const isConfigured = config.n8nApiKey !== 'not-configured';
    
    if (requiresApiKey && !isConfigured) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Configuration required',
            message: `Tool '${toolName}' requires n8n API configuration. Please configure your n8n API key in extension settings.`,
            configuration_needed: {
              n8n_api_key: 'Required - Get from n8n Settings > API Keys',
              n8n_api_url: 'Required - Your n8n instance API URL'
            }
          }, null, 2)
        }],
        isError: true,
      };
    }

    let result;
    
    switch (toolName) {
      case 'health_check':
        if (isConfigured) {
          try {
            await testConnectivity(apiClient, config);
            result = {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'healthy',
                  n8n_url: config.n8nApiUrl,
                  timestamp: new Date().toISOString(),
                  version: DXT_CONFIG.version,
                  response_time_ms: Date.now() - startTime,
                  configuration: 'complete'
                }, null, 2)
              }],
              isError: false,
            };
          } catch (connectivityError) {
            result = {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  status: 'unhealthy',
                  error: connectivityError.message,
                  n8n_url: config.n8nApiUrl,
                  timestamp: new Date().toISOString(),
                  version: DXT_CONFIG.version,
                  response_time_ms: Date.now() - startTime,
                  configuration: 'complete'
                }, null, 2)
              }],
              isError: true,
            };
          }
        } else {
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'not-configured',
                message: 'n8n MCP Server is running but not configured',
                configuration_needed: {
                  n8n_api_key: 'Required - Get from n8n Settings > API Keys',
                  n8n_api_url: 'Required - Your n8n instance API URL (include /api/v1)'
                },
                timestamp: new Date().toISOString(),
                version: DXT_CONFIG.version,
                response_time_ms: Date.now() - startTime
              }, null, 2)
            }],
            isError: false,
          };
        }
        break;

      case 'list_workflows':
        const workflowsResponse = await apiClient.get('/workflows', {
          params: { limit: config.maxResults }
        });
        
        if (workflowsResponse.status !== 200) {
          throw new Error(`Failed to fetch workflows: ${workflowsResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflows: workflowsResponse.data.data || workflowsResponse.data,
              total: workflowsResponse.data.data?.length || 0,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'get_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const workflowResponse = await apiClient.get(`/workflows/${args.workflowId}`);
        
        if (workflowResponse.status === 404) {
          throw new Error(`Workflow with ID ${args.workflowId} not found`);
        } else if (workflowResponse.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${workflowResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify(workflowResponse.data, null, 2)
          }],
          isError: false,
        };
        break;

      case 'list_executions':
        const params = {};
        if (args.workflowId) params.workflowId = args.workflowId;
        if (args.status) params.status = args.status;
        if (args.limit) params.limit = Math.min(args.limit, config.maxResults);
        else params.limit = config.maxResults;

        const executionsResponse = await apiClient.get('/executions', { params });
        
        if (executionsResponse.status !== 200) {
          throw new Error(`Failed to fetch executions: ${executionsResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              executions: executionsResponse.data.data || executionsResponse.data,
              total: executionsResponse.data.data?.length || 0,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'run_webhook':
        if (!args.workflowName && !args.webhookUrl) {
          throw new Error('Either workflowName or webhookUrl is required');
        }

        let webhookUrl = args.webhookUrl;
        if (!webhookUrl && args.workflowName) {
          // Construct webhook URL from workflow name
          const baseUrl = config.n8nApiUrl.replace('/api/v1', '');
          webhookUrl = `${baseUrl}/webhook/${args.workflowName}`;
        }

        const webhookOptions = {
          method: args.method || 'POST',
          url: webhookUrl,
          timeout: config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status < 500,
        };

        if (args.data) {
          webhookOptions.data = args.data;
        }

        // Add basic auth if configured
        if (config.n8nWebhookUsername && config.n8nWebhookPassword) {
          webhookOptions.auth = {
            username: config.n8nWebhookUsername,
            password: config.n8nWebhookPassword,
          };
        }

        const webhookResponse = await axios(webhookOptions);
        
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: webhookResponse.status,
              response: webhookResponse.data,
              success: webhookResponse.status < 400
            }, null, 2)
          }],
          isError: webhookResponse.status >= 400,
        };
        break;

      case 'create_workflow':
        if (!args.name) {
          throw new Error('name is required');
        }
        if (!args.nodes || !Array.isArray(args.nodes)) {
          throw new Error('nodes array is required');
        }

        const createWorkflowPayload = {
          name: args.name,
          nodes: args.nodes,
          connections: args.connections || {},
          settings: {
            saveExecutionProgress: true,
            saveManualExecutions: true,
            saveDataErrorExecution: "all",
            saveDataSuccessExecution: "all",
            executionTimeout: 3600,
            timezone: "UTC"
          }
        };

        const createResponse = await apiClient.post('/workflows', createWorkflowPayload);
        
        if (createResponse.status !== 200 && createResponse.status !== 201) {
          throw new Error(`Failed to create workflow: ${createResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflow: createResponse.data,
              message: `Workflow "${args.name}" created successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'update_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        // Get current workflow first
        const currentWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (currentWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch current workflow: ${currentWorkflowResp.status}`);
        }

        const updatePayload = { ...currentWorkflowResp.data };
        if (args.name !== undefined) updatePayload.name = args.name;
        if (args.nodes !== undefined) updatePayload.nodes = args.nodes;
        if (args.connections !== undefined) updatePayload.connections = args.connections;

        // Remove read-only properties
        delete updatePayload.id;
        delete updatePayload.active;
        delete updatePayload.createdAt;
        delete updatePayload.updatedAt;
        delete updatePayload.tags;

        const updateResponse = await apiClient.put(`/workflows/${args.workflowId}`, updatePayload);
        
        if (updateResponse.status !== 200) {
          throw new Error(`Failed to update workflow: ${updateResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflow: updateResponse.data,
              message: `Workflow updated successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'delete_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const deleteResponse = await apiClient.delete(`/workflows/${args.workflowId}`);
        
        if (deleteResponse.status !== 200 && deleteResponse.status !== 204) {
          throw new Error(`Failed to delete workflow: ${deleteResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: `Workflow ${args.workflowId} deleted successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'activate_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const activateResponse = await apiClient.post(`/workflows/${args.workflowId}/activate`);
        
        if (activateResponse.status !== 200) {
          throw new Error(`Failed to activate workflow: ${activateResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflow: activateResponse.data,
              message: `Workflow activated successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'deactivate_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const deactivateResponse = await apiClient.post(`/workflows/${args.workflowId}/deactivate`);
        
        if (deactivateResponse.status !== 200) {
          throw new Error(`Failed to deactivate workflow: ${deactivateResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflow: deactivateResponse.data,
              message: `Workflow deactivated successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'get_execution':
        if (!args.executionId) {
          throw new Error('executionId is required');
        }

        const executionResponse = await apiClient.get(`/executions/${args.executionId}`);
        
        if (executionResponse.status === 404) {
          throw new Error(`Execution with ID ${args.executionId} not found`);
        } else if (executionResponse.status !== 200) {
          throw new Error(`Failed to fetch execution: ${executionResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify(executionResponse.data, null, 2)
          }],
          isError: false,
        };
        break;

      case 'delete_execution':
        if (!args.executionId) {
          throw new Error('executionId is required');
        }

        const deleteExecutionResponse = await apiClient.delete(`/executions/${args.executionId}`);
        
        if (deleteExecutionResponse.status !== 200 && deleteExecutionResponse.status !== 204) {
          throw new Error(`Failed to delete execution: ${deleteExecutionResponse.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: `Execution ${args.executionId} deleted successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'list_nodes':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const listNodesWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (listNodesWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${listNodesWorkflowResp.status}`);
        }

        const workflow = listNodesWorkflowResp.data;
        const nodesSummary = workflow.nodes.map(node => ({
          id: node.id,
          name: node.name,
          type: node.type,
          position: node.position || [0, 0],
          typeVersion: node.typeVersion || 1,
          parametersCount: Object.keys(node.parameters || {}).length,
          hasCredentials: !!node.credentials
        }));

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflowId: args.workflowId,
              workflowName: workflow.name,
              nodes: nodesSummary,
              totalNodes: nodesSummary.length,
              connections: workflow.connections || {},
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'get_node':
        if (!args.workflowId || !args.nodeId) {
          throw new Error('workflowId and nodeId are required');
        }

        const getNodeWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (getNodeWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${getNodeWorkflowResp.status}`);
        }

        const getNodeWorkflow = getNodeWorkflowResp.data;
        const targetNode = getNodeWorkflow.nodes.find(node => 
          node.id === args.nodeId || node.name === args.nodeId
        );

        if (!targetNode) {
          throw new Error(`Node with ID or name '${args.nodeId}' not found in workflow`);
        }

        // Find connections involving this node
        const nodeConnections = {};
        const workflowConnections = getNodeWorkflow.connections || {};
        
        // Outgoing connections
        if (workflowConnections[targetNode.name]) {
          nodeConnections.outgoing = workflowConnections[targetNode.name];
        }
        
        // Incoming connections
        Object.keys(workflowConnections).forEach(sourceName => {
          if (workflowConnections[sourceName].main) {
            workflowConnections[sourceName].main.forEach((mainConnections, outputIndex) => {
              if (mainConnections) {
                mainConnections.forEach(conn => {
                  if (conn.node === targetNode.name) {
                    if (!nodeConnections.incoming) nodeConnections.incoming = [];
                    nodeConnections.incoming.push({
                      sourceNode: sourceName,
                      outputIndex,
                      inputIndex: conn.index || 0
                    });
                  }
                });
              }
            });
          }
        });

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              node: targetNode,
              connections: nodeConnections,
              workflowName: getNodeWorkflow.name,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'update_node':
        if (!args.workflowId || !args.nodeId) {
          throw new Error('workflowId and nodeId are required');
        }

        const updateNodeWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (updateNodeWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${updateNodeWorkflowResp.status}`);
        }

        const updateNodeWorkflow = { ...updateNodeWorkflowResp.data };
        const nodeIndex = updateNodeWorkflow.nodes.findIndex(node => 
          node.id === args.nodeId || node.name === args.nodeId
        );

        if (nodeIndex === -1) {
          throw new Error(`Node with ID or name '${args.nodeId}' not found in workflow`);
        }

        const originalNode = updateNodeWorkflow.nodes[nodeIndex];
        const updatedNode = { ...originalNode };

        // Update node properties
        if (args.parameters !== undefined) {
          updatedNode.parameters = { ...originalNode.parameters, ...args.parameters };
        }
        if (args.name !== undefined) {
          // If name is changing, update connections too
          if (args.name !== originalNode.name && updateNodeWorkflow.connections) {
            const oldName = originalNode.name;
            const newName = args.name;
            
            // Update outgoing connections
            if (updateNodeWorkflow.connections[oldName]) {
              updateNodeWorkflow.connections[newName] = updateNodeWorkflow.connections[oldName];
              delete updateNodeWorkflow.connections[oldName];
            }
            
            // Update incoming connections
            Object.keys(updateNodeWorkflow.connections).forEach(sourceName => {
              if (updateNodeWorkflow.connections[sourceName].main) {
                updateNodeWorkflow.connections[sourceName].main.forEach(mainConns => {
                  if (mainConns) {
                    mainConns.forEach(conn => {
                      if (conn.node === oldName) {
                        conn.node = newName;
                      }
                    });
                  }
                });
              }
            });
          }
          updatedNode.name = args.name;
        }
        if (args.position !== undefined && Array.isArray(args.position)) {
          updatedNode.position = args.position;
        }

        updateNodeWorkflow.nodes[nodeIndex] = updatedNode;

        // Remove read-only properties
        delete updateNodeWorkflow.id;
        delete updateNodeWorkflow.active;
        delete updateNodeWorkflow.createdAt;
        delete updateNodeWorkflow.updatedAt;
        delete updateNodeWorkflow.tags;

        const updateNodeResp = await apiClient.put(`/workflows/${args.workflowId}`, updateNodeWorkflow);
        if (updateNodeResp.status !== 200) {
          throw new Error(`Failed to update workflow: ${updateNodeResp.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              updatedNode: updatedNode,
              message: `Node '${updatedNode.name}' updated successfully`,
              changes: {
                parameters: args.parameters !== undefined,
                name: args.name !== undefined,
                position: args.position !== undefined
              },
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'add_node':
        if (!args.workflowId || !args.nodeType || !args.name) {
          throw new Error('workflowId, nodeType, and name are required');
        }

        const addNodeWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (addNodeWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${addNodeWorkflowResp.status}`);
        }

        const addNodeWorkflow = { ...addNodeWorkflowResp.data };
        
        // Check if node name already exists
        const nameExists = addNodeWorkflow.nodes.some(node => node.name === args.name);
        if (nameExists) {
          throw new Error(`Node with name '${args.name}' already exists in workflow`);
        }

        // Generate a unique ID for the new node
        const generateNodeId = () => {
          const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        let newNodeId = generateNodeId();
        while (addNodeWorkflow.nodes.some(node => node.id === newNodeId)) {
          newNodeId = generateNodeId();
        }

        // Calculate position if not provided
        let position = args.position || [0, 0];
        if (!args.position) {
          // Position new node to the right of existing nodes
          const maxX = addNodeWorkflow.nodes.reduce((max, node) => {
            const nodeX = node.position ? node.position[0] : 0;
            return Math.max(max, nodeX);
          }, 0);
          position = [maxX + 300, 100];
        }

        const newNode = {
          id: newNodeId,
          name: args.name,
          type: args.nodeType,
          typeVersion: 1,
          position: position,
          parameters: args.parameters || {}
        };

        addNodeWorkflow.nodes.push(newNode);

        // Initialize connections for the new node if not exists
        if (!addNodeWorkflow.connections) {
          addNodeWorkflow.connections = {};
        }

        // Remove read-only properties
        delete addNodeWorkflow.id;
        delete addNodeWorkflow.active;
        delete addNodeWorkflow.createdAt;
        delete addNodeWorkflow.updatedAt;
        delete addNodeWorkflow.tags;

        const addNodeResp = await apiClient.put(`/workflows/${args.workflowId}`, addNodeWorkflow);
        if (addNodeResp.status !== 200) {
          throw new Error(`Failed to update workflow: ${addNodeResp.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              newNode: newNode,
              message: `Node '${args.name}' added successfully`,
              totalNodes: addNodeWorkflow.nodes.length,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'remove_node':
        if (!args.workflowId || !args.nodeId) {
          throw new Error('workflowId and nodeId are required');
        }

        const removeNodeWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (removeNodeWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${removeNodeWorkflowResp.status}`);
        }

        const removeNodeWorkflow = { ...removeNodeWorkflowResp.data };
        const nodeToRemoveIndex = removeNodeWorkflow.nodes.findIndex(node => 
          node.id === args.nodeId || node.name === args.nodeId
        );

        if (nodeToRemoveIndex === -1) {
          throw new Error(`Node with ID or name '${args.nodeId}' not found in workflow`);
        }

        const nodeToRemove = removeNodeWorkflow.nodes[nodeToRemoveIndex];
        const nodeName = nodeToRemove.name;

        // Remove the node
        removeNodeWorkflow.nodes.splice(nodeToRemoveIndex, 1);

        // Clean up connections
        if (removeNodeWorkflow.connections) {
          // Remove outgoing connections from this node
          delete removeNodeWorkflow.connections[nodeName];

          // Remove incoming connections to this node
          Object.keys(removeNodeWorkflow.connections).forEach(sourceName => {
            if (removeNodeWorkflow.connections[sourceName].main) {
              removeNodeWorkflow.connections[sourceName].main = 
                removeNodeWorkflow.connections[sourceName].main.map(mainConns => {
                  if (mainConns) {
                    return mainConns.filter(conn => conn.node !== nodeName);
                  }
                  return mainConns;
                });
            }
          });
        }

        // Remove read-only properties
        delete removeNodeWorkflow.id;
        delete removeNodeWorkflow.active;
        delete removeNodeWorkflow.createdAt;
        delete removeNodeWorkflow.updatedAt;
        delete removeNodeWorkflow.tags;

        const removeNodeResp = await apiClient.put(`/workflows/${args.workflowId}`, removeNodeWorkflow);
        if (removeNodeResp.status !== 200) {
          throw new Error(`Failed to update workflow: ${removeNodeResp.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              removedNode: nodeToRemove,
              message: `Node '${nodeName}' removed successfully`,
              totalNodes: removeNodeWorkflow.nodes.length,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'update_node_connections':
        if (!args.workflowId || !args.connections) {
          throw new Error('workflowId and connections are required');
        }

        const updateConnWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (updateConnWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${updateConnWorkflowResp.status}`);
        }

        const updateConnWorkflow = { ...updateConnWorkflowResp.data };
        
        // Validate that all referenced nodes exist
        const nodeNames = updateConnWorkflow.nodes.map(node => node.name);
        const validateConnections = (connections) => {
          Object.keys(connections).forEach(sourceName => {
            if (!nodeNames.includes(sourceName)) {
              throw new Error(`Source node '${sourceName}' does not exist in workflow`);
            }
            if (connections[sourceName].main) {
              connections[sourceName].main.forEach(mainConns => {
                if (mainConns) {
                  mainConns.forEach(conn => {
                    if (!nodeNames.includes(conn.node)) {
                      throw new Error(`Target node '${conn.node}' does not exist in workflow`);
                    }
                  });
                }
              });
            }
          });
        };

        validateConnections(args.connections);

        // Update connections
        updateConnWorkflow.connections = args.connections;

        // Remove read-only properties
        delete updateConnWorkflow.id;
        delete updateConnWorkflow.active;
        delete updateConnWorkflow.createdAt;
        delete updateConnWorkflow.updatedAt;
        delete updateConnWorkflow.tags;

        const updateConnResp = await apiClient.put(`/workflows/${args.workflowId}`, updateConnWorkflow);
        if (updateConnResp.status !== 200) {
          throw new Error(`Failed to update workflow: ${updateConnResp.status}`);
        }

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              connections: args.connections,
              message: `Workflow connections updated successfully`,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'validate_workflow':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const validateWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (validateWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${validateWorkflowResp.status}`);
        }

        const validateWorkflow = validateWorkflowResp.data;
        const issues = [];
        const warnings = [];
        const suggestions = [];

        // Check for orphaned nodes (nodes with no connections)
        const connectedNodes = new Set();
        const validationConnections = validateWorkflow.connections || {};
        
        Object.keys(validationConnections).forEach(sourceName => {
          connectedNodes.add(sourceName);
          if (validationConnections[sourceName].main) {
            validationConnections[sourceName].main.forEach(mainConns => {
              if (mainConns) {
                mainConns.forEach(conn => {
                  connectedNodes.add(conn.node);
                });
              }
            });
          }
        });

        validateWorkflow.nodes.forEach(node => {
          if (!connectedNodes.has(node.name) && validateWorkflow.nodes.length > 1) {
            warnings.push({
              type: 'orphaned_node',
              message: `Node '${node.name}' (${node.type}) has no connections`,
              node: node.name
            });
          }
        });

        // Check for missing required parameters
        validateWorkflow.nodes.forEach(node => {
          if (!node.parameters) {
            warnings.push({
              type: 'missing_parameters',
              message: `Node '${node.name}' (${node.type}) has no parameters configured`,
              node: node.name
            });
          }
        });

        // Check for nodes without proper positioning
        validateWorkflow.nodes.forEach(node => {
          if (!node.position || !Array.isArray(node.position)) {
            warnings.push({
              type: 'missing_position',
              message: `Node '${node.name}' has invalid or missing position`,
              node: node.name
            });
          }
        });

        // Check for trigger nodes
        const triggerTypes = [
          'n8n-nodes-base.manualTrigger',
          'n8n-nodes-base.cronTrigger',
          'n8n-nodes-base.webhookTrigger',
          'n8n-nodes-base.httpTrigger'
        ];
        
        const hasTrigger = validateWorkflow.nodes.some(node => 
          triggerTypes.some(triggerType => node.type.includes('trigger') || node.type === triggerType)
        );

        if (!hasTrigger && validateWorkflow.nodes.length > 0) {
          suggestions.push({
            type: 'add_trigger',
            message: 'Consider adding a trigger node to start the workflow automatically',
            action: 'Add a Manual Trigger, Cron Trigger, or Webhook Trigger node'
          });
        }

        // Check for error handling
        const hasErrorWorkflow = validateWorkflow.nodes.some(node => 
          node.parameters && node.parameters.continueOnFail
        );

        if (!hasErrorWorkflow && validateWorkflow.nodes.length > 3) {
          suggestions.push({
            type: 'error_handling',
            message: 'Consider adding error handling to make the workflow more robust',
            action: 'Enable "Continue on Fail" for critical nodes or add error handling logic'
          });
        }

        // Performance suggestions
        if (validateWorkflow.nodes.length > 10) {
          suggestions.push({
            type: 'performance',
            message: 'Large workflow detected - consider breaking into sub-workflows',
            action: 'Use Execute Workflow nodes to split complex workflows'
          });
        }

        const validationScore = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5));
        const isValid = issues.length === 0;

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflowId: args.workflowId,
              workflowName: validateWorkflow.name,
              isValid: isValid,
              validationScore: validationScore,
              summary: {
                totalNodes: validateWorkflow.nodes.length,
                totalConnections: Object.keys(validationConnections).length,
                issues: issues.length,
                warnings: warnings.length,
                suggestions: suggestions.length
              },
              issues: issues,
              warnings: warnings,
              suggestions: suggestions,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'get_workflow_stats':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const days = args.days || 30;
        const statsWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (statsWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${statsWorkflowResp.status}`);
        }

        // Get executions for this workflow
        const executionsResp = await apiClient.get('/executions', {
          params: { 
            workflowId: args.workflowId,
            limit: config.maxResults 
          }
        });
        
        if (executionsResp.status !== 200) {
          throw new Error(`Failed to fetch executions: ${executionsResp.status}`);
        }

        const statsWorkflow = statsWorkflowResp.data;
        const executions = executionsResp.data.data || executionsResp.data || [];
        
        // Calculate statistics
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        
        const recentExecutions = executions.filter(exec => {
          const execDate = new Date(exec.startedAt || exec.createdAt);
          return execDate >= cutoffDate;
        });

        const successfulExecutions = recentExecutions.filter(exec => 
          exec.status === 'success' || exec.finished === true && !exec.stoppedAt
        );
        const failedExecutions = recentExecutions.filter(exec => 
          exec.status === 'error' || exec.status === 'failed'
        );
        const runningExecutions = recentExecutions.filter(exec => 
          exec.status === 'running' || exec.status === 'waiting'
        );

        // Calculate execution times
        const executionTimes = recentExecutions
          .filter(exec => exec.startedAt && exec.stoppedAt)
          .map(exec => {
            const start = new Date(exec.startedAt);
            const stop = new Date(exec.stoppedAt);
            return stop.getTime() - start.getTime();
          });

        const avgExecutionTime = executionTimes.length > 0
          ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
          : 0;

        const maxExecutionTime = executionTimes.length > 0 
          ? Math.max(...executionTimes) 
          : 0;

        const successRate = recentExecutions.length > 0 
          ? (successfulExecutions.length / recentExecutions.length) * 100 
          : 0;

        // Group executions by day
        const executionsByDay = {};
        recentExecutions.forEach(exec => {
          const date = new Date(exec.startedAt || exec.createdAt);
          const dayKey = date.toISOString().split('T')[0];
          if (!executionsByDay[dayKey]) {
            executionsByDay[dayKey] = 0;
          }
          executionsByDay[dayKey]++;
        });

        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              workflowId: args.workflowId,
              workflowName: statsWorkflow.name,
              isActive: statsWorkflow.active,
              period: `${days} days`,
              totalExecutions: recentExecutions.length,
              stats: {
                successful: successfulExecutions.length,
                failed: failedExecutions.length,
                running: runningExecutions.length,
                successRate: Math.round(successRate * 100) / 100,
                avgExecutionTimeMs: Math.round(avgExecutionTime),
                maxExecutionTimeMs: maxExecutionTime,
                avgExecutionsPerDay: Math.round((recentExecutions.length / days) * 100) / 100
              },
              executionsByDay: executionsByDay,
              performance: {
                rating: successRate >= 95 ? 'excellent' : 
                       successRate >= 85 ? 'good' : 
                       successRate >= 70 ? 'fair' : 'poor',
                avgExecutionTime: avgExecutionTime < 10000 ? 'fast' :
                                avgExecutionTime < 30000 ? 'moderate' : 'slow'
              },
              lastExecution: recentExecutions.length > 0 ? {
                date: recentExecutions[0].startedAt,
                status: recentExecutions[0].status || (recentExecutions[0].finished ? 'success' : 'unknown')
              } : null,
              success: true
            }, null, 2)
          }],
          isError: false,
        };
        break;

      case 'workflow_thinking':
        if (!args.goal) {
          throw new Error('goal is required');
        }

        const thinkingAnalysis = `# Workflow Design Analysis

## User Goal
${args.goal}

${args.context ? `## Additional Context\n${args.context}\n` : ''}

## 1. Problem Decomposition

### Core Objective Analysis
Breaking down the main goal into atomic, actionable components:

**Primary Goal**: ${args.goal}
- **What** needs to be automated?
- **When** should it trigger?
- **Who** or **what** initiates it?
- **Where** does the data come from?
- **How** should it be processed?

### Task Breakdown
1. **Data Sources**: Identify all input data sources and their formats
2. **Processing Steps**: List required transformations and business logic
3. **Output Destinations**: Define where results should be sent/stored
4. **Error Scenarios**: Consider what could go wrong at each step

## 2. Technical Requirements

### n8n Integration Needs
- **Trigger Mechanism**: Manual, Webhook, Schedule, or External trigger?
- **Node Types Required**: HTTP Request, Database, Email, File operations, etc.
- **Authentication**: API keys, OAuth, basic auth requirements
- **Data Transformations**: JSON manipulation, filtering, aggregation needs

### Infrastructure Considerations
- **Rate Limits**: API call frequency restrictions
- **Data Volume**: Expected throughput and storage needs
- **Dependencies**: External service availability requirements
- **Security**: Sensitive data handling and encryption needs

## 3. Workflow Architecture Design

### High-Level Structure
\`\`\`
[Trigger] -> [Data Collection] -> [Processing] -> [Output] -> [Notifications]
\`\`\`

### Node Sequence Planning
1. **Entry Point**: How the workflow starts
2. **Data Gathering**: Collect required information
3. **Validation**: Ensure data quality and completeness
4. **Business Logic**: Apply transformations and rules
5. **Storage/Output**: Save results and send notifications
6. **Error Handling**: Manage failures gracefully

## 4. Potential Challenges & Solutions

### Technical Challenges
- **API Rate Limiting**: Implement delays and retry logic
- **Data Consistency**: Use transactions and validation
- **Scalability**: Design for growth in data volume
- **Monitoring**: Add logging and alerting

### Business Challenges
- **User Adoption**: Make the workflow intuitive
- **Change Management**: Plan for requirement changes
- **Compliance**: Ensure data handling meets regulations
- **Performance**: Optimize for user experience

## 5. Success Metrics & Validation

### Key Performance Indicators
- **Execution Success Rate**: Target >95%
- **Processing Time**: Define acceptable latency
- **Error Recovery**: Automatic vs manual intervention
- **User Satisfaction**: Feedback and adoption metrics

### Testing Strategy
- **Unit Testing**: Individual node validation
- **Integration Testing**: End-to-end workflow testing
- **Load Testing**: Performance under expected volume
- **Error Testing**: Failure scenario validation

## 6. Implementation Roadmap

### Phase 1: MVP (Minimum Viable Product)
- Core functionality with manual triggers
- Basic error handling
- Simple notifications

### Phase 2: Enhancement
- Automated triggers and scheduling
- Advanced error handling and retries
- Rich notifications and reporting

### Phase 3: Optimization
- Performance tuning
- Advanced monitoring
- Integration with additional systems

## Next Steps
1. Review this analysis with stakeholders
2. Use the workflow_planning tool to create detailed implementation steps
3. Research specific n8n nodes and integrations needed
4. Begin with a simple prototype workflow`;

        result = {
          content: [{
            type: 'text',
            text: thinkingAnalysis
          }],
          isError: false,
        };
        break;

      case 'workflow_planning':
        if (!args.requirements) {
          throw new Error('requirements is required');
        }

        const workflowPlan = `# Workflow Implementation Plan

## Requirements Summary
${args.requirements}

${args.constraints ? `## Constraints & Limitations\n${args.constraints}\n` : ''}

## 1. Workflow Architecture

### Node Sequence Design
Based on the requirements analysis, here's the recommended node structure:

#### Step 1: Trigger Setup
- **Node Type**: Manual Trigger (for testing) or Webhook/Cron Trigger
- **Purpose**: Initiate the workflow
- **Configuration**: Define trigger conditions and data inputs
- **Testing**: Start with manual trigger for development

#### Step 2: Data Collection
- **Node Type**: HTTP Request, Database, or File operations
- **Purpose**: Gather required input data
- **Configuration**: API endpoints, query parameters, authentication
- **Error Handling**: Timeout settings, retry logic

#### Step 3: Data Validation & Processing
- **Node Type**: Function, Set, or Code nodes
- **Purpose**: Validate inputs and apply business logic
- **Configuration**: Data transformation rules, validation criteria
- **Error Handling**: Data quality checks, fallback values

#### Step 4: External Integrations
- **Node Type**: Service-specific nodes (Gmail, Slack, etc.)
- **Purpose**: Interact with external systems
- **Configuration**: API credentials, message formatting
- **Error Handling**: Service availability checks, alternative actions

#### Step 5: Output & Storage
- **Node Type**: Database, File operations, or HTTP Request
- **Purpose**: Store results and persist important data
- **Configuration**: Storage locations, data formats
- **Error Handling**: Backup storage options, transaction rollback

#### Step 6: Notifications & Reporting
- **Node Type**: Email, Slack, SMS, or Webhook
- **Purpose**: Inform stakeholders of completion
- **Configuration**: Recipient lists, message templates
- **Error Handling**: Fallback notification methods

## 2. Node Configuration Details

### Connection Strategy
\`\`\`json
{
  "connections": {
    "Trigger Node": {
      "main": [
        [{"node": "Data Collection", "type": "main", "index": 0}]
      ]
    },
    "Data Collection": {
      "main": [
        [{"node": "Validation", "type": "main", "index": 0}]
      ]
    },
    "Validation": {
      "main": [
        [{"node": "Processing", "type": "main", "index": 0}]
      ]
    }
  }
}
\`\`\`

### Error Handling Architecture
- **Continue on Fail**: Enable for non-critical nodes
- **Error Workflows**: Create dedicated error handling branches
- **Retry Logic**: Configure automatic retries for transient failures
- **Alerting**: Set up notifications for critical failures

## 3. Implementation Sequence

### Phase 1: Core Workflow (Week 1)
1. Create workflow with manual trigger
2. Implement basic data collection nodes
3. Add simple processing logic
4. Test with sample data
5. Verify basic functionality

### Phase 2: Error Handling (Week 2)
1. Add error handling to all nodes
2. Implement retry mechanisms
3. Create error notification system
4. Test failure scenarios
5. Document error recovery procedures

### Phase 3: Automation & Optimization (Week 3)
1. Replace manual trigger with automated trigger
2. Optimize performance and reduce execution time
3. Add comprehensive logging
4. Implement monitoring and alerting
5. Conduct load testing

### Phase 4: Production Deployment (Week 4)
1. Deploy to production environment
2. Monitor initial executions closely
3. Gather user feedback
4. Make performance improvements
5. Plan future enhancements

## 4. Testing Strategy

### Development Testing
- **Unit Testing**: Test each node individually
- **Data Testing**: Validate with various input scenarios
- **Error Testing**: Simulate failure conditions
- **Performance Testing**: Measure execution times

### Production Readiness
- **Integration Testing**: End-to-end workflow validation
- **Load Testing**: Test with expected production volume
- **Security Testing**: Verify data handling and authentication
- **User Acceptance Testing**: Validate business requirements

## 5. Monitoring & Maintenance

### Key Metrics to Track
- **Execution Success Rate**: Monitor for degradation
- **Execution Time**: Track performance trends
- **Error Patterns**: Identify common failure points
- **Resource Usage**: Monitor system resource consumption

### Maintenance Schedule
- **Daily**: Review execution logs and error reports
- **Weekly**: Analyze performance trends and optimization opportunities
- **Monthly**: Review and update error handling procedures
- **Quarterly**: Assess workflow effectiveness and plan improvements

## 6. Next Steps

### Immediate Actions
1. Use workflow_research tool to investigate specific n8n nodes needed
2. Set up development environment and create initial workflow
3. Configure required API credentials and test connections
4. Implement the first phase nodes and test basic functionality

### Tools to Use
- \`create_workflow\`: Create the initial workflow structure
- \`add_node\`: Add each node according to the plan
- \`update_node_connections\`: Set up the connection flow
- \`validate_workflow\`: Check for issues before testing

This plan provides a structured approach to implementing your workflow. Each phase builds upon the previous one, ensuring a stable and reliable automation solution.`;

        result = {
          content: [{
            type: 'text',
            text: workflowPlan
          }],
          isError: false,
        };
        break;

      case 'workflow_research':
        if (!args.topic) {
          throw new Error('topic is required');
        }

        let researchContext = '';
        if (args.workflowId) {
          try {
            const researchWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
            if (researchWorkflowResp.status === 200) {
              const workflow = researchWorkflowResp.data;
              researchContext = `\n## Current Workflow Context\n- **Workflow**: ${workflow.name}\n- **Nodes**: ${workflow.nodes.length} total\n- **Active**: ${workflow.active ? 'Yes' : 'No'}\n- **Node Types**: ${[...new Set(workflow.nodes.map(n => n.type.split('.').pop()))].join(', ')}\n`;
            }
          } catch (error) {
            // Continue without context if workflow fetch fails
          }
        }

        const researchResults = `# n8n Workflow Research: ${args.topic}

${researchContext}

## 1. Available n8n Nodes & Integrations

### Core Node Categories

#### **Trigger Nodes**
- **Manual Trigger**: For testing and on-demand execution
- **Cron Trigger**: Time-based scheduling (daily, weekly, custom cron)
- **Webhook Trigger**: HTTP endpoint for external systems
- **Email Trigger (IMAP)**: React to incoming emails
- **File Trigger**: Monitor file system changes

#### **Data Processing Nodes**
- **Function Node**: Custom JavaScript code execution
- **Code Node**: Python, JavaScript code with full environment
- **Set Node**: Data manipulation and variable assignment
- **Filter Node**: Conditional data filtering
- **Sort Node**: Data ordering and arrangement
- **Aggregate Node**: Data grouping and calculation

#### **HTTP & API Nodes**
- **HTTP Request**: Generic REST API calls
- **Webhook**: Send HTTP requests to external endpoints
- **GraphQL**: Query GraphQL endpoints
- **RSS Feed Read**: Parse RSS/Atom feeds
- **XML Parser**: Convert XML to JSON

#### **Database Nodes**
- **MySQL**: Direct database operations
- **PostgreSQL**: Advanced SQL database integration
- **MongoDB**: NoSQL document database
- **Redis**: In-memory data store
- **SQLite**: Lightweight database operations

#### **Communication Nodes**
- **Gmail**: Email sending and reading
- **Slack**: Team communication integration
- **Microsoft Teams**: Enterprise communication
- **Telegram**: Bot and messaging
- **SMS**: Text message sending

#### **File Operation Nodes**
- **Read/Write Binary File**: File system operations
- **FTP/SFTP**: Remote file transfer
- **Google Drive**: Cloud storage integration
- **Dropbox**: File sharing and storage
- **AWS S3**: Cloud object storage

#### **Popular SaaS Integrations**
- **Google Sheets**: Spreadsheet automation
- **Airtable**: Database and collaboration
- **Notion**: Workspace and documentation
- **Salesforce**: CRM operations
- **HubSpot**: Marketing and sales
- **Stripe**: Payment processing
- **PayPal**: Financial transactions
- **Shopify**: E-commerce platform

## 2. Best Practices for ${args.topic}

### Authentication & Security
- **API Keys**: Store in n8n credentials, never in node parameters
- **OAuth**: Use built-in OAuth flows when available
- **Basic Auth**: Secure username/password storage
- **Bearer Tokens**: JWT and token-based authentication
- **Webhooks**: Secure endpoint configuration with validation

### Performance Optimization
- **Batch Processing**: Group API calls to reduce overhead
- **Caching**: Use Set nodes to store frequently accessed data
- **Conditional Execution**: Use IF nodes to avoid unnecessary processing
- **Parallel Execution**: Split workflows for concurrent processing
- **Resource Management**: Monitor execution time and memory usage

### Error Handling Strategies
- **Continue on Fail**: Enable for non-critical operations
- **Retry Logic**: Configure automatic retries with backoff
- **Error Workflows**: Create dedicated error handling paths
- **Logging**: Add comprehensive logging for debugging
- **Alerting**: Set up notifications for critical failures

### Data Management
- **Data Validation**: Always validate input data structure
- **Type Conversion**: Handle data type mismatches
- **Null Handling**: Check for missing or empty values
- **Data Transformation**: Use Set and Function nodes for complex transformations
- **Memory Management**: Clear unnecessary data in long workflows

## 3. Integration Recommendations for ${args.topic}

### Recommended Node Sequence
1. **Start**: Appropriate trigger based on use case
2. **Collect**: Gather data from required sources
3. **Validate**: Check data quality and completeness
4. **Process**: Apply business logic and transformations
5. **Store**: Persist results if needed
6. **Notify**: Send notifications or trigger downstream systems

### Common Integration Patterns
- **API Orchestration**: Coordinate multiple API calls
- **Data Synchronization**: Keep systems in sync
- **Event Processing**: React to system events
- **Batch Processing**: Handle large data volumes
- **Notification Systems**: Alert users of important events

## 4. Troubleshooting Common Issues

### Connection Problems
- **Timeouts**: Increase timeout settings for slow APIs
- **Rate Limits**: Implement delays between requests
- **Authentication**: Verify credentials and permissions
- **Network Issues**: Add retry logic for temporary failures

### Data Issues
- **Format Mismatches**: Use Function nodes for data conversion
- **Missing Fields**: Check for required data before processing
- **Large Datasets**: Implement pagination for large API responses
- **Encoding Issues**: Handle character encoding properly

### Performance Issues
- **Slow Execution**: Optimize API calls and data processing
- **Memory Usage**: Clear unnecessary data between nodes
- **Concurrent Limits**: Respect system concurrency limits
- **Resource Contention**: Schedule heavy workflows during off-peak hours

## 5. Testing & Validation

### Development Testing
- **Manual Triggers**: Test workflows manually during development
- **Sample Data**: Use representative test data
- **Error Scenarios**: Test failure conditions
- **Edge Cases**: Validate boundary conditions

### Production Monitoring
- **Execution Logs**: Monitor workflow execution details
- **Error Tracking**: Track and analyze failures
- **Performance Metrics**: Monitor execution time and resource usage
- **Data Quality**: Validate output data integrity

## 6. Next Steps

### Implementation Actions
1. **Choose Nodes**: Select appropriate nodes based on research
2. **Test Connections**: Verify all integrations work correctly
3. **Implement Gradually**: Build workflow incrementally
4. **Monitor Performance**: Track execution and optimize as needed

### Useful Commands
- \`list_workflows\`: See existing workflows for reference
- \`create_workflow\`: Create new workflow with researched nodes
- \`validate_workflow\`: Check workflow health before deployment
- \`get_workflow_stats\`: Monitor performance after implementation

This research provides the foundation for implementing robust and efficient workflows using n8n's extensive integration capabilities.`;

        result = {
          content: [{
            type: 'text',
            text: researchResults
          }],
          isError: false,
        };
        break;

      case 'workflow_brainstorm':
        if (!args.problem) {
          throw new Error('problem is required');
        }

        const industryContext = args.industry ? `\n## Industry Context: ${args.industry}\nTailoring solutions for the ${args.industry} industry with relevant integrations and compliance considerations.\n` : '';

        const brainstormingSolutions = `# Workflow Brainstorming Session: ${args.problem}

${industryContext}

## 1. Creative Solution Approaches

### Approach A: Traditional Sequential Processing
**Concept**: Step-by-step linear workflow with clear handoffs
- **Trigger**: Manual, scheduled, or event-based initiation
- **Flow**: Data collection → Processing → Validation → Output
- **Benefits**: Simple to understand, easy to debug, predictable execution
- **Best For**: Straightforward processes with clear dependencies

### Approach B: Parallel Processing Architecture  
**Concept**: Split tasks into concurrent streams for efficiency
- **Trigger**: Single entry point that fans out to multiple branches
- **Flow**: Parallel data gathering → Synchronized processing → Merge results
- **Benefits**: Faster execution, better resource utilization, scalability
- **Best For**: Independent tasks that can run simultaneously

### Approach C: Event-Driven Reactive System
**Concept**: Respond to events as they occur with intelligent routing
- **Trigger**: Multiple webhook endpoints for different event types
- **Flow**: Event classification → Dynamic routing → Context-aware processing
- **Benefits**: Real-time responsiveness, flexible handling, efficient resource use
- **Best For**: Systems with unpredictable timing and varying data types

### Approach D: Microservice Orchestration
**Concept**: Coordinate multiple specialized workflows
- **Trigger**: Master workflow that calls sub-workflows
- **Flow**: Task delegation → Specialized processing → Result aggregation
- **Benefits**: Modular design, reusable components, easier maintenance
- **Best For**: Complex processes that benefit from separation of concerns

### Approach E: Self-Healing Adaptive System
**Concept**: Intelligent workflow that adapts to failures and changes
- **Trigger**: Primary and backup trigger mechanisms
- **Flow**: Health checks → Adaptive routing → Self-correction → Learning
- **Benefits**: High reliability, automatic recovery, continuous improvement
- **Best For**: Mission-critical processes requiring high availability

## 2. Industry-Specific Innovations

### E-commerce Automation
- **Inventory Sync**: Real-time stock level synchronization across platforms
- **Order Processing**: Automated fulfillment with shipping integration
- **Customer Service**: Automated response system with escalation rules
- **Marketing Automation**: Personalized campaigns based on behavior data

### Healthcare Process Optimization
- **Patient Data Integration**: Secure EHR synchronization with compliance
- **Appointment Scheduling**: Automated booking with availability optimization
- **Insurance Processing**: Claims validation and submission automation
- **Reporting**: Automated compliance reporting with audit trails

### Financial Services Automation
- **Transaction Monitoring**: Real-time fraud detection and alerting
- **Compliance Reporting**: Automated regulatory report generation
- **Customer Onboarding**: KYC process automation with document verification
- **Risk Assessment**: Automated credit scoring and risk evaluation

### Manufacturing & Supply Chain
- **Production Scheduling**: Automated workflow based on demand forecasting
- **Quality Control**: Automated testing and compliance verification
- **Supplier Integration**: Real-time communication with supply chain partners
- **Maintenance Management**: Predictive maintenance scheduling

## 3. Innovative Integration Ideas

### AI-Powered Enhancements
- **Natural Language Processing**: Parse emails/messages for action items
- **Image Recognition**: Automated document processing and classification
- **Predictive Analytics**: Forecast trends and automate proactive responses
- **Chatbot Integration**: Automated customer interaction with escalation

### IoT and Sensor Integration
- **Environmental Monitoring**: Automated responses to sensor data
- **Asset Tracking**: Real-time location and status updates
- **Maintenance Alerts**: Automated scheduling based on equipment status
- **Energy Management**: Automated optimization of resource usage

### Advanced Communication Patterns
- **Multi-Channel Notifications**: Intelligent routing based on urgency/preference
- **Collaborative Workflows**: Multi-user approval processes with tracking
- **External Partner Integration**: Secure B2B workflow automation
- **Mobile-First Design**: Optimized for mobile team member participation

## 4. Edge Case Considerations

### High-Volume Scenarios
- **Batch Processing**: Handle large data volumes efficiently
- **Queue Management**: Manage workflow backlogs intelligently
- **Resource Scaling**: Dynamic resource allocation based on demand
- **Performance Optimization**: Caching and data reduction strategies

### Security & Compliance Scenarios
- **Data Encryption**: End-to-end encryption for sensitive data
- **Audit Logging**: Comprehensive activity tracking for compliance
- **Access Control**: Role-based permissions and workflow access
- **Data Retention**: Automated cleanup and archival policies

### Disaster Recovery Scenarios
- **Backup Workflows**: Alternative processing paths for system failures
- **Data Recovery**: Automated backup and restoration procedures
- **Failover Logic**: Seamless switching to backup systems
- **Communication Plans**: Automated stakeholder notification during incidents

## 5. Optimization Opportunities

### Cost Reduction Strategies
- **API Call Optimization**: Minimize external service costs
- **Resource Pooling**: Share resources across multiple workflows
- **Scheduling Optimization**: Run resource-intensive tasks during off-peak
- **Data Compression**: Reduce storage and transfer costs

### User Experience Enhancements
- **Status Dashboards**: Real-time workflow status visibility
- **Mobile Notifications**: Instant updates on mobile devices
- **Self-Service Options**: Allow users to trigger workflows independently
- **Feedback Loops**: Collect and act on user experience data

### Performance Improvements
- **Caching Strategies**: Store frequently accessed data
- **Parallel Execution**: Run independent tasks simultaneously
- **Lazy Loading**: Process data only when needed
- **Result Memoization**: Cache computed results for reuse

## 6. Implementation Roadmap

### Quick Wins (Week 1-2)
- Start with simplest approach that solves core problem
- Implement basic error handling and logging
- Add manual triggers for testing and validation
- Create simple notification system

### Medium-term Goals (Month 1-2)
- Add automation and scheduling capabilities
- Implement advanced error handling and recovery
- Optimize performance and reduce execution time
- Add monitoring and analytics capabilities

### Long-term Vision (Month 3-6)
- Implement AI-powered enhancements where valuable
- Add advanced integrations and partner connectivity
- Create comprehensive reporting and analytics
- Build self-service capabilities for end users

## 7. Next Steps & Action Items

### Immediate Research Needed
1. **Technical Feasibility**: Verify required integrations are possible
2. **Cost Analysis**: Estimate API costs and resource requirements  
3. **Compliance Review**: Ensure solution meets regulatory requirements
4. **Stakeholder Alignment**: Validate approach with key stakeholders

### Prototype Development
1. **MVP Definition**: Choose simplest viable approach
2. **Proof of Concept**: Build minimal workflow to test core functionality
3. **Feedback Collection**: Gather input from intended users
4. **Iteration Planning**: Plan improvements based on feedback

### Tools to Use Next
- \`workflow_planning\`: Create detailed implementation plan for chosen approach
- \`workflow_research\`: Deep dive into specific integrations needed
- \`create_workflow\`: Build the initial workflow structure
- \`validate_workflow\`: Ensure workflow meets quality standards

This brainstorming session provides multiple creative approaches to solve your automation challenge. Choose the approach that best fits your specific requirements, constraints, and long-term goals.`;

        result = {
          content: [{
            type: 'text',
            text: brainstormingSolutions
          }],
          isError: false,
        };
        break;

      case 'workflow_optimize':
        if (!args.workflowId) {
          throw new Error('workflowId is required');
        }

        const focusArea = args.focusArea || 'all';
        
        // Get workflow details for analysis
        const optimizeWorkflowResp = await apiClient.get(`/workflows/${args.workflowId}`);
        if (optimizeWorkflowResp.status !== 200) {
          throw new Error(`Failed to fetch workflow: ${optimizeWorkflowResp.status}`);
        }

        // Get execution statistics for performance analysis
        const optimizeExecutionsResp = await apiClient.get('/executions', {
          params: { 
            workflowId: args.workflowId,
            limit: config.maxResults 
          }
        });

        const optimizeWorkflow = optimizeWorkflowResp.data;
        const optimizeExecutions = optimizeExecutionsResp.status === 200 ? 
          (optimizeExecutionsResp.data.data || optimizeExecutionsResp.data || []) : [];

        // Analyze workflow structure
        const nodes = optimizeWorkflow.nodes || [];
        const optimizeConnections = optimizeWorkflow.connections || {};
        const nodeTypes = nodes.map(n => n.type);
        const uniqueNodeTypes = [...new Set(nodeTypes)];

        // Performance analysis
        const recentOptimizeExecutions = optimizeExecutions.slice(0, 20);
        const optimizeExecutionTimes = recentOptimizeExecutions
          .filter(exec => exec.startedAt && exec.stoppedAt)
          .map(exec => new Date(exec.stoppedAt) - new Date(exec.startedAt));
        
        const avgOptimizeExecutionTime = optimizeExecutionTimes.length > 0 
          ? optimizeExecutionTimes.reduce((sum, time) => sum + time, 0) / optimizeExecutionTimes.length 
          : 0;

        const successfulOptimizeExecutions = recentOptimizeExecutions.filter(exec => 
          exec.status === 'success' || (exec.finished === true && !exec.stoppedAt)
        ).length;
        
        const optimizeSuccessRate = recentOptimizeExecutions.length > 0 
          ? (successfulOptimizeExecutions / recentOptimizeExecutions.length) * 100 
          : 100;

        const optimizationReport = `# Workflow Optimization Analysis: ${optimizeWorkflow.name}

## Current Workflow Analysis

### Workflow Overview
- **ID**: ${args.workflowId}
- **Name**: ${optimizeWorkflow.name}
- **Status**: ${optimizeWorkflow.active ? 'Active' : 'Inactive'}
- **Total Nodes**: ${nodes.length}
- **Node Types**: ${uniqueNodeTypes.length} unique types
- **Connections**: ${Object.keys(optimizeConnections).length} connection points

### Performance Metrics (Last 20 Executions)
- **Success Rate**: ${Math.round(optimizeSuccessRate)}%
- **Average Execution Time**: ${Math.round(avgOptimizeExecutionTime)}ms
- **Total Executions Analyzed**: ${recentOptimizeExecutions.length}

## Optimization Recommendations

${focusArea === 'performance' || focusArea === 'all' ? `
### 🚀 Performance Optimization

#### Current Performance Issues
${avgOptimizeExecutionTime > 30000 ? '- **Slow Execution**: Average execution time exceeds 30 seconds' : ''}
${nodes.length > 15 ? '- **Complex Workflow**: High node count may impact performance' : ''}
${nodeTypes.filter(type => type.includes('httpRequest')).length > 5 ? '- **Multiple API Calls**: Many HTTP requests may cause delays' : ''}

#### Performance Improvement Actions
1. **Batch API Requests**
   - Combine multiple HTTP requests where possible
   - Use bulk operations for database interactions
   - Implement request queuing for rate-limited APIs

2. **Optimize Data Processing**
   - Use Set nodes instead of Function nodes for simple transformations
   - Minimize data passed between nodes (remove unnecessary fields)
   - Process data in chunks for large datasets

3. **Parallel Execution**
   - Split independent operations into parallel branches
   - Use multiple webhook endpoints for concurrent processing
   - Implement fan-out/fan-in patterns where appropriate

4. **Caching Strategy**
   - Cache frequently accessed data in Set nodes
   - Implement result memoization for expensive operations
   - Use external caching systems (Redis) for shared data

**Expected Impact**: 30-50% reduction in execution time
` : ''}

${focusArea === 'reliability' || focusArea === 'all' ? `
### 🛡️ Reliability Enhancement

#### Current Reliability Issues
${optimizeSuccessRate < 95 ? `- **Low Success Rate**: ${Math.round(optimizeSuccessRate)}% success rate needs improvement` : ''}
${!nodes.some(n => n.parameters?.continueOnFail) ? '- **No Error Handling**: Workflow lacks error handling mechanisms' : ''}
${!nodeTypes.includes('n8n-nodes-base.noOp') ? '- **No Error Branches**: Missing dedicated error handling paths' : ''}

#### Reliability Improvement Actions
1. **Comprehensive Error Handling**
   - Enable "Continue on Fail" for non-critical nodes
   - Add error handling branches with NoOp nodes
   - Implement retry logic with exponential backoff
   - Create fallback operations for critical failures

2. **Data Validation**
   - Add validation nodes before critical operations
   - Implement data type checking and conversion
   - Create data quality gates with clear error messages
   - Add input sanitization for external data

3. **Monitoring & Alerting**
   - Add logging nodes at key workflow points
   - Implement health check mechanisms
   - Create automated failure notifications
   - Set up monitoring dashboards for real-time status

4. **Recovery Mechanisms**
   - Implement automatic retry with delays
   - Create manual intervention points for complex failures
   - Add rollback capabilities for data modifications
   - Implement graceful degradation for partial failures

**Expected Impact**: 95%+ success rate, faster recovery from failures
` : ''}

${focusArea === 'maintainability' || focusArea === 'all' ? `
### 🔧 Maintainability Improvements

#### Current Maintainability Issues
${!nodes.some(n => n.notes) ? '- **Missing Documentation**: Nodes lack descriptive notes' : ''}
${nodes.filter(n => n.name.includes('Node')).length > 3 ? '- **Poor Naming**: Many nodes use default names' : ''}
${Object.keys(optimizeConnections).length / nodes.length > 2 ? '- **Complex Connections**: High connectivity may indicate need for simplification' : ''}

#### Maintainability Enhancement Actions
1. **Documentation & Naming**
   - Add descriptive names to all nodes (avoid "Node", "Node1", etc.)
   - Include notes explaining complex logic
   - Document data flow and transformation logic
   - Create workflow description and purpose documentation

2. **Code Organization**
   - Group related nodes visually on canvas
   - Use consistent naming conventions
   - Separate concerns into logical sections
   - Consider breaking large workflows into sub-workflows

3. **Configuration Management**
   - Move hardcoded values to environment variables
   - Use global settings for common configurations
   - Implement configuration validation
   - Create development/staging/production configurations

4. **Testing & Validation**
   - Add workflow validation steps
   - Create test data sets for development
   - Implement automated testing where possible
   - Document testing procedures and edge cases

**Expected Impact**: Faster debugging, easier modifications, reduced maintenance time
` : ''}

${focusArea === 'cost' || focusArea === 'all' ? `
### 💰 Cost Optimization

#### Current Cost Factors
${nodeTypes.filter(type => type.includes('httpRequest')).length > 0 ? `- **API Calls**: ${nodeTypes.filter(type => type.includes('httpRequest')).length} HTTP request nodes may incur API costs` : ''}
${avgOptimizeExecutionTime > 10000 ? '- **Long Execution Times**: Extended runtime increases compute costs' : ''}
${recentOptimizeExecutions.length > 0 ? `- **Execution Frequency**: ${recentOptimizeExecutions.length} recent executions` : ''}

#### Cost Reduction Actions
1. **API Cost Optimization**
   - Implement intelligent caching to reduce API calls
   - Use bulk operations instead of individual requests
   - Optimize API call frequency and timing
   - Negotiate better API pricing tiers if usage is high

2. **Execution Efficiency**
   - Reduce unnecessary data processing
   - Optimize trigger frequency (avoid over-polling)
   - Implement smart scheduling for batch operations
   - Use conditional logic to skip unnecessary operations

3. **Resource Management**
   - Monitor and optimize memory usage
   - Reduce data transfer between nodes
   - Implement efficient data structures
   - Clean up temporary data promptly

4. **Workflow Consolidation**
   - Combine similar workflows to reduce overhead
   - Share common operations across workflows
   - Implement workflow templates for consistency
   - Eliminate duplicate functionality

**Expected Impact**: 20-40% reduction in operational costs
` : ''}

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
- Add error handling to critical nodes
- Improve node naming and documentation
- Implement basic monitoring
- Optimize obvious performance bottlenecks

### Phase 2: Structural Improvements (Week 2-3)
- Redesign data flow for efficiency
- Implement parallel processing where beneficial
- Add comprehensive validation and error branches
- Optimize API call patterns

### Phase 3: Advanced Optimization (Week 4+)
- Implement caching strategies
- Add predictive monitoring and alerting
- Create automated testing procedures
- Fine-tune performance based on production metrics

## Monitoring & Success Metrics

### Key Performance Indicators
- **Execution Success Rate**: Target >95%
- **Average Execution Time**: Target <${Math.max(5000, avgOptimizeExecutionTime * 0.7)}ms
- **Cost per Execution**: Track API and compute costs
- **Time to Recovery**: Measure failure recovery time

### Validation Steps
1. **Before Changes**: Capture baseline metrics
2. **After Each Phase**: Measure improvement impact
3. **Ongoing Monitoring**: Track long-term trends
4. **User Feedback**: Collect stakeholder satisfaction data

## Next Steps

### Immediate Actions
1. **Backup Current Workflow**: Export current version before changes
2. **Prioritize Changes**: Focus on highest-impact, lowest-risk improvements
3. **Test Environment**: Set up safe testing environment for changes
4. **Stakeholder Review**: Present optimization plan for approval

### Tools to Use
- \`validate_workflow\`: Check workflow health after each change
- \`get_workflow_stats\`: Monitor performance improvements
- \`update_node\`: Implement individual node optimizations
- \`get_workflow\`: Export/backup workflow before major changes

This optimization analysis provides a comprehensive roadmap for improving your workflow's ${focusArea === 'all' ? 'overall performance, reliability, maintainability, and cost efficiency' : focusArea}. Implement changes gradually and monitor results to ensure improvements meet expectations.`;

        result = {
          content: [{
            type: 'text',
            text: optimizationReport
          }],
          isError: false,
        };
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}. Available tools: health_check, list_workflows, get_workflow, create_workflow, update_workflow, delete_workflow, activate_workflow, deactivate_workflow, list_executions, get_execution, delete_execution, run_webhook, list_nodes, get_node, update_node, add_node, remove_node, update_node_connections, validate_workflow, get_workflow_stats, workflow_thinking, workflow_planning, workflow_research, workflow_brainstorm, workflow_optimize`);
    }

    const executionTime = Date.now() - startTime;
    dxtLog('debug', 'TOOL_SUCCESS', `Tool executed successfully: ${toolName}`, {
      executionTime,
      resultSize: JSON.stringify(result).length
    });

    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    dxtLog('error', 'TOOL_ERROR', `Tool execution failed: ${toolName}`, {
      error: errorMessage,
      executionTime,
      args
    });

    // Provide user-friendly error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Cannot connect to n8n instance. Please check your n8n URL and ensure n8n is running.';
    } else if (errorMessage.includes('401') || errorMessage.includes('Authentication failed')) {
      userMessage = 'Authentication failed. Please check your n8n API key configuration.';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Request timed out. Please check your network connection or increase timeout settings.';
    }

    return {
      content: [{
        type: 'text',
        text: `Error executing ${toolName}: ${userMessage}`,
      }],
      isError: true,
    };
  }
}

/**
 * Configure and return the MCP server instance
 */
function configureServer(config) {
  const apiClient = createApiClient(config);

  const server = new Server(
    {
      name: DXT_CONFIG.name,
      version: DXT_CONFIG.version,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Enhanced error handling
  server.onerror = (error) => {
    dxtLog('error', 'MCP_SERVER', 'Server error occurred', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
  };

  // Tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'health_check',
          description: 'Check n8n instance health and connectivity',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        // Workflow Management Tools
        {
          name: 'list_workflows',
          description: 'Retrieve a list of all workflows available in n8n',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of workflows to return',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_workflow',
          description: 'Retrieve a specific workflow by ID',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to retrieve',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'create_workflow',
          description: 'Create a new workflow in n8n',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name for the new workflow',
              },
              nodes: {
                type: 'array',
                description: 'Array of node objects that define the workflow',
                items: {
                  type: 'object',
                },
              },
              connections: {
                type: 'object',
                description: 'Connection mappings between nodes',
              },
            },
            required: ['name', 'nodes'],
          },
        },
        {
          name: 'update_workflow',
          description: 'Update an existing workflow in n8n',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to update',
              },
              name: {
                type: 'string',
                description: 'New name for the workflow',
              },
              nodes: {
                type: 'array',
                description: 'Updated array of node objects that define the workflow',
                items: {
                  type: 'object',
                },
              },
              connections: {
                type: 'object',
                description: 'Updated connection mappings between nodes',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'delete_workflow',
          description: 'Delete a workflow from n8n',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to delete',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'activate_workflow',
          description: 'Activate a workflow to start automatic execution',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to activate',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'deactivate_workflow',
          description: 'Deactivate a workflow to stop automatic execution',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to deactivate',
              },
            },
            required: ['workflowId'],
          },
        },
        // Execution Management Tools
        {
          name: 'list_executions',
          description: 'Retrieve a list of workflow executions from n8n',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'Optional ID of workflow to filter executions by',
              },
              status: {
                type: 'string',
                description: 'Optional status to filter by (success, error, waiting, canceled)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of executions to return',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_execution',
          description: 'Retrieve detailed information about a specific execution',
          inputSchema: {
            type: 'object',
            properties: {
              executionId: {
                type: 'string',
                description: 'ID of the execution to retrieve',
              },
            },
            required: ['executionId'],
          },
        },
        {
          name: 'delete_execution',
          description: 'Delete a specific execution record',
          inputSchema: {
            type: 'object',
            properties: {
              executionId: {
                type: 'string',
                description: 'ID of the execution to delete',
              },
            },
            required: ['executionId'],
          },
        },
        {
          name: 'run_webhook',
          description: 'Execute a workflow via webhook with optional input data',
          inputSchema: {
            type: 'object',
            properties: {
              workflowName: {
                type: 'string',
                description: 'Name of the workflow webhook to trigger',
              },
              webhookUrl: {
                type: 'string',
                description: 'Full webhook URL (alternative to workflowName)',
              },
              data: {
                type: 'object',
                description: 'Optional data to send with the webhook',
              },
              method: {
                type: 'string',
                description: 'HTTP method (default: POST)',
                enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
              },
            },
            required: [],
          },
        },
        // Node Manipulation Tools
        {
          name: 'list_nodes',
          description: 'Extract and list all nodes from a workflow with their details',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to list nodes from',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'get_node',
          description: 'Get detailed information about a specific node in a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow containing the node',
              },
              nodeId: {
                type: 'string',
                description: 'ID of the node to retrieve (can be node ID or node name)',
              },
            },
            required: ['workflowId', 'nodeId'],
          },
        },
        {
          name: 'update_node',
          description: 'Update a specific node\'s parameters in a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow containing the node',
              },
              nodeId: {
                type: 'string',
                description: 'ID of the node to update (can be node ID or node name)',
              },
              parameters: {
                type: 'object',
                description: 'New parameters for the node',
              },
              name: {
                type: 'string',
                description: 'New name for the node',
              },
              position: {
                type: 'array',
                description: 'New position for the node [x, y]',
                items: {
                  type: 'number',
                },
              },
            },
            required: ['workflowId', 'nodeId'],
          },
        },
        {
          name: 'add_node',
          description: 'Add a new node to an existing workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to add the node to',
              },
              nodeType: {
                type: 'string',
                description: 'Type of the node (e.g., n8n-nodes-base.httpRequest)',
              },
              name: {
                type: 'string',
                description: 'Name for the new node',
              },
              parameters: {
                type: 'object',
                description: 'Parameters for the new node',
              },
              position: {
                type: 'array',
                description: 'Position for the new node [x, y]',
                items: {
                  type: 'number',
                },
              },
            },
            required: ['workflowId', 'nodeType', 'name'],
          },
        },
        {
          name: 'remove_node',
          description: 'Remove a node from a workflow and clean up connections',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow containing the node',
              },
              nodeId: {
                type: 'string',
                description: 'ID of the node to remove (can be node ID or node name)',
              },
            },
            required: ['workflowId', 'nodeId'],
          },
        },
        {
          name: 'update_node_connections',
          description: 'Update connections between nodes in a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to update connections in',
              },
              connections: {
                type: 'object',
                description: 'New connection mappings between nodes',
              },
            },
            required: ['workflowId', 'connections'],
          },
        },
        // Workflow Analysis Tools
        {
          name: 'validate_workflow',
          description: 'Validate a workflow for common issues and best practices',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to validate',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'get_workflow_stats',
          description: 'Get execution statistics and performance metrics for a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to get statistics for',
              },
              days: {
                type: 'number',
                description: 'Number of days to look back for statistics (default: 30)',
              },
            },
            required: ['workflowId'],
          },
        },
        // AI-Powered Workflow Assistant Tools
        {
          name: 'workflow_thinking',
          description: 'AI-powered deep analysis and problem decomposition for workflow design',
          inputSchema: {
            type: 'object',
            properties: {
              goal: {
                type: 'string',
                description: 'The automation goal or problem to analyze',
              },
              context: {
                type: 'string',
                description: 'Additional context about the business process or requirements',
              },
            },
            required: ['goal'],
          },
        },
        {
          name: 'workflow_planning',
          description: 'AI-powered workflow implementation planning with step-by-step guidance',
          inputSchema: {
            type: 'object',
            properties: {
              requirements: {
                type: 'string',
                description: 'Analyzed requirements from thinking phase or direct requirements',
              },
              constraints: {
                type: 'string',
                description: 'Any constraints or limitations to consider',
              },
            },
            required: ['requirements'],
          },
        },
        {
          name: 'workflow_research',
          description: 'AI-powered research for best practices and integration options',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Specific integration or technical question to research',
              },
              workflowId: {
                type: 'string',
                description: 'Optional workflow ID for context-aware research',
              },
            },
            required: ['topic'],
          },
        },
        {
          name: 'workflow_brainstorm',
          description: 'AI-powered creative workflow solution brainstorming',
          inputSchema: {
            type: 'object',
            properties: {
              problem: {
                type: 'string',
                description: 'Business problem or automation challenge to brainstorm solutions for',
              },
              industry: {
                type: 'string',
                description: 'Industry or domain context for more relevant solutions',
              },
            },
            required: ['problem'],
          },
        },
        {
          name: 'workflow_optimize',
          description: 'AI-powered workflow optimization analysis and recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'ID of the workflow to optimize',
              },
              focusArea: {
                type: 'string',
                description: 'Specific area to focus on: performance, reliability, maintainability, or cost',
                enum: ['performance', 'reliability', 'maintainability', 'cost', 'all']
              },
            },
            required: ['workflowId'],
          },
        },
      ],
    };
  });

  // Prompts list handler (empty but required for DXT compatibility)
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: []
    };
  });

  // Resources handlers (for future expansion)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: []
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: []
    };
  });

  // Tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    const result = await executeToolWithErrorHandling(toolName, args, apiClient, config);
    
    return {
      content: result.content,
      isError: result.isError,
    };
  });

  return server;
}

/**
 * Graceful shutdown handler with enhanced DXT compatibility
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    dxtLog('warn', 'SHUTDOWN', 'Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  dxtLog('info', 'SHUTDOWN', 'Initiating graceful shutdown', { signal });
  
  const shutdownPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      dxtLog('error', 'SHUTDOWN', 'Shutdown timeout reached, forcing exit');
      resolve();
    }, DXT_CONFIG.shutdown_timeout);

    (async () => {
      try {
        if (serverInstance) {
          dxtLog('info', 'SHUTDOWN', 'Closing MCP server connection...');
          await serverInstance.close();
          dxtLog('info', 'SHUTDOWN', 'MCP server closed successfully');
        }
        clearTimeout(timer);
        resolve();
      } catch (error) {
        dxtLog('error', 'SHUTDOWN', 'Error during shutdown', {
          error: error instanceof Error ? error.message : error
        });
        clearTimeout(timer);
        resolve();
      }
    })();
  });
  
  await shutdownPromise;
  dxtLog('info', 'SHUTDOWN', 'n8n MCP Server shutdown complete');
  process.exit(0);
}

/**
 * Main function with comprehensive DXT startup handling
 */
async function main() {
  const startTime = Date.now();
  
  try {
    dxtLog('info', 'STARTUP', 'Starting n8n MCP Server for DXT', {
      version: DXT_CONFIG.version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });

    // Load and validate configuration
    const config = getDxtEnvironmentConfig();

    // Test connectivity with retry logic - but don't crash if not configured
    const apiClient = createApiClient(config);
    let connectivityTestPassed = false;
    
    if (config.n8nApiKey === 'not-configured') {
      dxtLog('warn', 'CONNECTIVITY', 'Skipping connectivity test - API key not configured');
      dxtLog('info', 'CONNECTIVITY', 'Server will start in limited mode - configure API key to enable full functionality');
    } else {
      for (let attempt = 1; attempt <= DXT_CONFIG.max_retries; attempt++) {
        try {
          await testConnectivity(apiClient, config);
          connectivityTestPassed = true;
          break;
        } catch (error) {
          dxtLog('warn', 'CONNECTIVITY', `Connectivity test attempt ${attempt} failed`, {
            error: error.message,
            attempt,
            maxAttempts: DXT_CONFIG.max_retries
          });
          
          if (attempt === DXT_CONFIG.max_retries) {
            dxtLog('error', 'CONNECTIVITY', 'All connectivity attempts failed - server will start in limited mode');
            dxtLog('info', 'CONNECTIVITY', 'Please check your n8n configuration in extension settings');
            break; // Don't throw, just continue with limited functionality
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Create and configure the MCP server
    const server = configureServer(config);
    serverInstance = server;
    
    // Set up stdio transport
    dxtLog('info', 'STARTUP', 'Establishing stdio transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    const startupTime = Date.now() - startTime;
    dxtLog('info', 'STARTUP', 'n8n MCP Server started successfully', {
      startupTime,
      ready: true
    });

  } catch (error) {
    const startupTime = Date.now() - startTime;
    dxtLog('error', 'STARTUP', 'Server failed to start', {
      error: error instanceof Error ? error.message : error,
      startupTime,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Provide actionable error information for DXT users
    let helpMessage = '';
    if (error.message.includes('N8N_API_KEY')) {
      helpMessage = 'Please configure your n8n API key in the extension settings.';
    } else if (error.message.includes('ECONNREFUSED')) {
      helpMessage = 'Please ensure your n8n instance is running and accessible at the configured URL.';
    } else if (error.message.includes('timeout')) {
      helpMessage = 'Please check your network connectivity and n8n instance status.';
    }
    
    if (helpMessage) {
      dxtLog('info', 'HELP', helpMessage);
    }
    
    process.exit(1);
  }
}

// Set up signal handlers for graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  dxtLog('error', 'UNCAUGHT_EXCEPTION', 'Uncaught exception occurred', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  dxtLog('error', 'UNHANDLED_REJECTION', 'Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Don't exit on unhandled rejection for DXT compatibility
});

// Start the server
main().catch((error) => {
  dxtLog('error', 'MAIN', 'Fatal error in main function', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});