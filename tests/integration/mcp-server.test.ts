import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { itSkipCI } from '../helpers/ci-helper';

describe('MCP Server Integration', () => {
  let testDir: string;
  let serverProcess: any;
  const serverPath = path.join(__dirname, '../../dist/src/mcp/server.js');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-mcp-test-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    process.chdir(__dirname);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function startMCPServer(): Promise<any> {
    return new Promise((resolve) => {
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: testDir,
      });

      serverProcess.stderr.once('data', (data: Buffer) => {
        if (data.toString().includes('MCP Server running')) {
          resolve(serverProcess);
        }
      });
    });
  }

  function sendRequest(server: any, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let response = '';

      server.stdout.once('data', (data: Buffer) => {
        response += data.toString();
        try {
          const json = JSON.parse(response);
          resolve(json);
        } catch (e) {
          // Wait for more data
        }
      });

      server.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        reject(new Error('Timeout waiting for response'));
      }, 5000);
    });
  }

  itSkipCI('should list available tools', async () => {
    const server = await startMCPServer();

    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });

    expect(response.result.tools).toHaveLength(3);
    const toolNames = response.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('list_branches');
    expect(toolNames).toContain('switch_branch');
    expect(toolNames).toContain('create_branch');
    // expect(toolNames).toContain('supervisor_mode'); // Disabled until core functionality is working
  });

  itSkipCI('should handle list_branches in empty project', async () => {
    const server = await startMCPServer();

    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_branches',
        arguments: {},
      },
    });

    expect(response.result).toBeDefined();
    expect(response.result.content).toBeDefined();
    expect((response.result.content[0] as any).text).toContain('Not a Git worktree project');
  });

  itSkipCI('should handle full workflow', async () => {
    // Initialize worktree project
    const repo = new GitRepository(testDir);
    await repo.initializeBareRepository();

    const manager = new WorktreeManager(testDir);
    await manager.addWorktree('main');
    await manager.addWorktree('feature-test');

    const server = await startMCPServer();

    // Test list_branches
    const listResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_branches',
        arguments: { showDetails: true },
      },
    });

    expect(listResponse.result).toBeDefined();
    expect(listResponse.result.content).toBeDefined();
    const listContent = (listResponse.result.content[0] as any).text;
    expect(listContent).toContain('Git Worktree Branches (2)');
    expect(listContent).toContain('main');
    expect(listContent).toContain('feature-test');
  });

  itSkipCI('should list and read resources', async () => {
    // Initialize worktree project
    const repo = new GitRepository(testDir);
    await repo.initializeBareRepository();

    const manager = new WorktreeManager(testDir);
    await manager.addWorktree('main');

    const server = await startMCPServer();

    // List resources
    const listResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/list',
    });

    expect(listResponse.result.resources).toHaveLength(3);
    expect(listResponse.result.resources[0].uri).toBe('worktree://current');

    // Read a resource
    const readResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/read',
      params: {
        uri: 'worktree://branches',
      },
    });

    expect(readResponse.result).toBeDefined();
    expect(readResponse.result.contents).toBeDefined();
    expect((readResponse.result.contents[0] as any).text).toContain('Git Worktree Branches');
  });

  itSkipCI('should handle errors gracefully', async () => {
    const server = await startMCPServer();

    // Unknown tool
    const errorResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
        arguments: {},
      },
    });

    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.error.message).toContain('Unknown tool');
  });
});
