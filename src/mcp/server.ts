#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { listBranchesTool } from './tools/branches.js';
import { switchBranchTool } from './tools/switch.js';
import { createBranchTool } from './tools/create.js';
// import { supervisorModeTool } from './tools/supervisor.js'; // TODO: Re-enable after core app is working
import { WorktreeResourceProvider } from './resources/worktree.js';

class GitWorktreeMCPServer {
  private server: Server;
  private resourceProvider: WorktreeResourceProvider;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-gwt-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.resourceProvider = new WorktreeResourceProvider();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, () =>
      Promise.resolve({
        tools: [
          listBranchesTool.definition,
          switchBranchTool.definition,
          createBranchTool.definition,
          // supervisorModeTool.definition, // TODO: Re-enable after core app is working
        ],
      }),
    );

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list_branches':
          return await listBranchesTool.handler(args ?? {});
        case 'switch_branch':
          return await switchBranchTool.handler(args as { branch: string });
        case 'create_branch':
          return await createBranchTool.handler(
            args as { branch: string; baseBranch?: string; setupWorktree?: boolean },
          );
        // case 'supervisor_mode': // TODO: Re-enable after core app is working
        //   return await supervisorModeTool.handler(args ?? {});
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: await this.resourceProvider.listResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return await this.resourceProvider.readResource(uri);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git Worktree MCP Server running...');
  }
}

// Start the server
const server = new GitWorktreeMCPServer();
server.run().catch(console.error);
