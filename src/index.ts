#!/usr/bin/env node
/**
 * n8n MCP Server - Main Entry Point
 * 
 * This file serves as the entry point for the n8n MCP Server,
 * which allows AI assistants to interact with n8n workflows through the MCP protocol.
 * 
 * Designed for DXT (Desktop Extension) compatibility with robust error handling,
 * timeout management, and proper stdio communication.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadEnvironmentVariables } from './config/environment.js';
import { configureServer } from './config/server.js';

// Load environment variables
loadEnvironmentVariables();

// Global configuration for DXT compatibility
const SERVER_CONFIG = {
  name: 'n8n-mcp-server',
  version: '0.1.8',
  startup_timeout: 30000, // 30 seconds startup timeout
  shutdown_timeout: 10000, // 10 seconds shutdown timeout
};

let serverInstance: any = null;
let isShuttingDown = false;

/**
 * Enhanced error handling with structured logging
 */
function logError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[${timestamp}] [${context}] ERROR: ${errorMessage}`);
  if (stack && process.env.NODE_ENV === 'development') {
    console.error(`[${timestamp}] [${context}] STACK: ${stack}`);
  }
}

/**
 * Enhanced logging for DXT debugging
 */
function logInfo(context: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${context}] ${message}`);
}

/**
 * Graceful shutdown handler with timeout
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logInfo('SHUTDOWN', 'Shutdown already in progress, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  logInfo('SHUTDOWN', `Received ${signal}, initiating graceful shutdown...`);
  
  const shutdownPromise = new Promise<void>((resolve) => {
    (async () => {
      try {
        if (serverInstance) {
          logInfo('SHUTDOWN', 'Closing MCP server connection...');
          await serverInstance.close();
          logInfo('SHUTDOWN', 'MCP server closed successfully');
        }
        resolve();
      } catch (error) {
        logError('SHUTDOWN', error);
        resolve(); // Still resolve to continue shutdown
      }
    })();
  });
  
  // Force shutdown after timeout
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      logError('SHUTDOWN', 'Shutdown timeout reached, forcing exit');
      resolve();
    }, SERVER_CONFIG.shutdown_timeout);
  });
  
  await Promise.race([shutdownPromise, timeoutPromise]);
  logInfo('SHUTDOWN', 'n8n MCP Server shutdown complete');
  process.exit(0);
}

/**
 * Main function to start the n8n MCP Server with DXT enhancements
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.error(`[STARTUP] Starting ${SERVER_CONFIG.name} v${SERVER_CONFIG.version}...`);
    console.error(`[STARTUP] Node.js version: ${process.version}`);
    console.error(`[STARTUP] Platform: ${process.platform} ${process.arch}`);
    console.error(`[STARTUP] Working directory: ${process.cwd()}`);
    console.error(`[STARTUP] Environment check:`);
    console.error(`[STARTUP] - N8N_API_URL: ${process.env.N8N_API_URL || 'not set'}`);
    console.error(`[STARTUP] - N8N_API_KEY: ${process.env.N8N_API_KEY ? 'SET' : 'not set'}`);
    console.error(`[STARTUP] - DEBUG: ${process.env.DEBUG || 'not set'}`);
    
    // Create startup timeout
    const startupPromise = new Promise<void>((resolve, reject) => {
      (async () => {
        try {
          // Create and configure the MCP server
          console.error(`[STARTUP] About to configure MCP server...`);
          const server = await configureServer();
          console.error(`[STARTUP] Server configured successfully`);
          serverInstance = server;
          
          // Enhanced error handling with context
          server.onerror = (error: unknown) => {
            console.error(`[MCP_SERVER] Server error:`, error);
            
            // For DXT, we should be more resilient to errors
            // Don't exit unless it's a critical failure
            if (error instanceof Error && error.message.includes('CRITICAL')) {
              console.error(`[MCP_SERVER] Critical error detected, shutting down`);
              gracefulShutdown('CRITICAL_ERROR');
            }
          };
          
          // Connect to the server transport (stdio)
          console.error(`[STARTUP] Establishing stdio transport...`);
          const transport = new StdioServerTransport();
          console.error(`[STARTUP] Created transport, connecting...`);
          await server.connect(transport);
          console.error(`[STARTUP] Server connected to transport successfully`);
          
          const startupTime = Date.now() - startTime;
          console.error(`[STARTUP] ${SERVER_CONFIG.name} started successfully in ${startupTime}ms`);
          console.error(`[STARTUP] Server running on stdio, ready to handle MCP requests`);
          
          resolve();
        } catch (error) {
          console.error(`[STARTUP] ERROR in startup promise:`, error);
          reject(error);
        }
      })();
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Server startup timeout after ${SERVER_CONFIG.startup_timeout}ms`));
      }, SERVER_CONFIG.startup_timeout);
    });
    
    await Promise.race([startupPromise, timeoutPromise]);
    
  } catch (error) {
    const startupTime = Date.now() - startTime;
    logError('STARTUP', error);
    logError('STARTUP', `Server failed to start after ${startupTime}ms`);
    
    // For DXT compatibility, provide actionable error information
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        logError('STARTUP', 'n8n API connection refused - check your n8n_base_url and ensure n8n is running');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        logError('STARTUP', 'Authentication failed - check your n8n_api_key configuration');
      } else if (error.message.includes('timeout')) {
        logError('STARTUP', 'Connection timeout - check network connectivity and n8n instance status');
      } else if (error.message.includes('Cannot resolve')) {
        logError('STARTUP', 'Module resolution error - the extension may need to be rebuilt');
      }
    }
    
    // Add delay before exit to ensure logs are written in Windows
    logError('STARTUP', 'Server will exit in 3 seconds to allow log writing...');
    setTimeout(() => {
      process.exit(1);
    }, 3000);
  }
}

// Set up enhanced signal handlers for DXT
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logError('UNCAUGHT_EXCEPTION', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logError('UNHANDLED_REJECTION', `Unhandled Rejection at Promise: ${promise}, reason: ${reason}`);
  // Don't exit on unhandled rejection, just log it for DXT compatibility
});

// Start the server with comprehensive error handling
main().catch((error) => {
  logError('MAIN', error);
  process.exit(1);
});
