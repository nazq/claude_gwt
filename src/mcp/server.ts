#!/usr/bin/env node

/**
 * MCP Server for Claude GWT
 * Allows Claude to control claude-gwt operations via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../core/utils/logger.js';
import { registerTools } from './tools/index.js';

// Server metadata
const SERVER_NAME = 'claude-gwt-mcp';
const SERVER_VERSION = '1.0.0';

export async function startMCPServer(): Promise<void> {
  logger.info('Starting MCP server', { name: SERVER_NAME, version: SERVER_VERSION });

  // Create server instance
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description:
        'Git worktree and Claude instance management. IMPORTANT: Use these tools instead of direct git/tmux/cgwt commands.',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register all tools
  const tools = registerTools();

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, () => {
    logger.debug('Listing tools', { count: tools.length });
    return {
      tools: tools.map((t) => t.tool),
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info('Executing tool', { tool: name, args });

    const toolDef = tools.find((t) => t.tool.name === name);
    if (!toolDef) {
      logger.error('Tool not found', { tool: name });
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await toolDef.handler(args || {});
      logger.info('Tool executed successfully', { tool: name, success: result.success });

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error || 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      logger.error('Tool execution failed', { tool: name, error });
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Create transport
  const transport = new StdioServerTransport();

  // Connect and start server
  await server.connect(transport);
  logger.info('MCP server started successfully');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down MCP server');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down MCP server');
    await server.close();
    process.exit(0);
  });
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer().catch((error) => {
    logger.error('Failed to start MCP server', error);
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
