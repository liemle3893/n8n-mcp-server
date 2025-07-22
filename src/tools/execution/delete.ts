/**
 * Delete Execution Tool
 * 
 * This tool deletes a specific workflow execution from n8n.
 */

import { BaseExecutionToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '../../errors/error-codes.js';

/**
 * Handler for the delete_execution tool
 */
export class DeleteExecutionHandler extends BaseExecutionToolHandler {
  /**
   * Execute the tool
   * 
   * @param args Tool arguments (executionId)
   * @returns Result of the deletion operation
   */
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async () => {
      // Validate required parameters
      if (!args.executionId) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Missing required parameter: executionId'
        );
      }
      
      // Store execution ID for response message
      const executionId = args.executionId;
      
      // Delete the execution
      await this.apiService.deleteExecution(executionId);
      
      return this.formatSuccess(
        { id: executionId, deleted: true },
        `Successfully deleted execution with ID: ${executionId}`
      );
    }, args);
  }
}

/**
 * Get tool definition for the delete_execution tool
 * 
 * @returns Tool definition
 */
export function getDeleteExecutionToolDefinition(): ToolDefinition {
  return {
    name: 'delete_execution',
    description: 'Delete a specific workflow execution from n8n',
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
  };
}
