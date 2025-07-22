/**
 * Environment Configuration
 * 
 * This module handles loading and validating environment variables
 * required for connecting to the n8n API. Enhanced for DXT compatibility
 * with user configuration parameter support and comprehensive validation.
 */

import dotenv from 'dotenv';
import findConfig from 'find-config';
import path from 'path';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '../errors/error-codes.js';

// Environment variable names (supports DXT user_config parameter mapping)
export const ENV_VARS = {
  // Core n8n configuration (maps to DXT user_config)
  N8N_API_URL: 'N8N_API_URL',
  N8N_BASE_URL: 'n8n_base_url', // DXT user_config parameter
  N8N_API_KEY: 'N8N_API_KEY',
  N8N_API_KEY_CONFIG: 'n8n_api_key', // DXT user_config parameter
  
  // Webhook configuration (optional)
  N8N_WEBHOOK_USERNAME: 'N8N_WEBHOOK_USERNAME',
  N8N_WEBHOOK_PASSWORD: 'N8N_WEBHOOK_PASSWORD',
  
  // DXT user_config parameters
  TIMEOUT: 'timeout',
  MAX_RESULTS: 'max_results',
  ENABLE_DEBUG: 'enable_debug',
  
  // Legacy/fallback environment variables
  DEBUG: 'DEBUG',
};

// Default configuration values
export const DEFAULT_CONFIG = {
  timeout: 30000, // 30 seconds
  max_results: 50,
  enable_debug: false,
  n8n_base_url: 'http://localhost:5678',
};

// Interface for validated environment variables
export interface EnvConfig {
  n8nApiUrl: string;
  n8nApiKey: string;
  n8nWebhookUsername?: string;
  n8nWebhookPassword?: string;
  debug: boolean;
  
  // DXT configuration parameters
  timeout: number;
  maxResults: number;
}

/**
 * Load environment variables from .env file if present
 * Enhanced for DXT compatibility
 */
export function loadEnvironmentVariables(): void {
  const {
    N8N_API_URL,
    N8N_API_KEY,
    N8N_WEBHOOK_USERNAME,
    N8N_WEBHOOK_PASSWORD
  } = process.env;

  // Only load .env file if no environment variables are set
  if (
    !N8N_API_URL &&
    !N8N_API_KEY &&
    !N8N_WEBHOOK_USERNAME &&
    !N8N_WEBHOOK_PASSWORD &&
    !process.env[ENV_VARS.N8N_BASE_URL] &&
    !process.env[ENV_VARS.N8N_API_KEY_CONFIG]
  ) {
    const projectRoot = findConfig('package.json');
    if (projectRoot) {
      const envPath = path.resolve(path.dirname(projectRoot), '.env');
      dotenv.config({ path: envPath });
    }
  }
}

/**
 * Safely parse numeric configuration value
 */
function parseNumericConfig(value: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.error(`Warning: Invalid numeric value "${value}", using default ${defaultValue}`);
    return defaultValue;
  }
  
  if (min !== undefined && parsed < min) {
    console.error(`Warning: Value ${parsed} below minimum ${min}, using minimum`);
    return min;
  }
  
  if (max !== undefined && parsed > max) {
    console.error(`Warning: Value ${parsed} above maximum ${max}, using maximum`);
    return max;
  }
  
  return parsed;
}

/**
 * Safely parse boolean configuration value
 */
function parseBooleanConfig(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Validate and retrieve required environment variables
 * Enhanced for DXT user_config parameter support
 * 
 * @returns Validated environment configuration
 * @throws {McpError} If required environment variables are missing
 */
export function getEnvConfig(): EnvConfig {
  // Try DXT user_config parameters first, then fall back to legacy environment variables
  const n8nApiUrl = process.env[ENV_VARS.N8N_BASE_URL] || 
                    process.env[ENV_VARS.N8N_API_URL] || 
                    DEFAULT_CONFIG.n8n_base_url;
                    
  const n8nApiKey = process.env[ENV_VARS.N8N_API_KEY_CONFIG] || 
                    process.env[ENV_VARS.N8N_API_KEY];
                    
  const n8nWebhookUsername = process.env[ENV_VARS.N8N_WEBHOOK_USERNAME];
  const n8nWebhookPassword = process.env[ENV_VARS.N8N_WEBHOOK_PASSWORD];
  
  // DXT user_config parameters with validation
  const timeout = parseNumericConfig(
    process.env[ENV_VARS.TIMEOUT], 
    DEFAULT_CONFIG.timeout, 
    5000, 
    120000
  );
  
  const maxResults = parseNumericConfig(
    process.env[ENV_VARS.MAX_RESULTS], 
    DEFAULT_CONFIG.max_results, 
    1, 
    500
  );
  
  const debug = parseBooleanConfig(process.env[ENV_VARS.ENABLE_DEBUG], false) ||
                parseBooleanConfig(process.env[ENV_VARS.DEBUG], false);

  // For DXT compatibility, don't throw on missing API key - log warning instead
  if (!n8nApiKey) {
    console.error(`[CONFIG] [WARNING] Missing n8n API key. Server will start in limited mode.`);
    console.error(`[CONFIG] [WARNING] Please configure n8n_api_key in Claude Desktop Extensions settings.`);
    console.error(`[CONFIG] [WARNING] Tools requiring n8n connectivity will fail until configured.`);
  }

  // Validate URL format
  try {
    new URL(n8nApiUrl);
  } catch (error) {
    throw new McpError(
      ErrorCode.InitializationError,
      `Invalid n8n base URL format: ${n8nApiUrl}. Please provide a valid URL like https://your-n8n.app.n8n.cloud or http://localhost:5678`
    );
  }

  // Log configuration for debugging (without sensitive information)
  if (debug) {
    console.error(`[CONFIG] n8n Base URL: ${n8nApiUrl}`);
    console.error(`[CONFIG] API Key: ${n8nApiKey ? '***configured***' : 'missing'}`);
    console.error(`[CONFIG] Timeout: ${timeout}ms`);
    console.error(`[CONFIG] Max Results: ${maxResults}`);
    console.error(`[CONFIG] Debug Enabled: ${debug}`);
    console.error(`[CONFIG] Webhook Auth: ${n8nWebhookUsername ? 'configured' : 'not configured'}`);
  }

  return {
    n8nApiUrl,
    n8nApiKey: n8nApiKey || 'not-configured', // Provide placeholder for DXT compatibility
    n8nWebhookUsername: n8nWebhookUsername || undefined,
    n8nWebhookPassword: n8nWebhookPassword || undefined,
    debug,
    timeout,
    maxResults,
  };
}
