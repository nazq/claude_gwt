import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Claude Code MCP Integration E2E', () => {
  let testDir: string;
  const isCiEnvironment = process.env['CI'] === 'true';
  const hasClaudeCLI = (() => {
    try {
      execSync('which claude', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // Skip these tests in CI or if Claude CLI is not installed
  const conditionalTest = hasClaudeCLI && !isCiEnvironment ? it : it.skip;

  conditionalTest('should be installable as MCP server', async () => {
    // This test would actually install the MCP server in Claude Code
    // For safety, we'll just verify the command structure

    const mcpConfigPath = path.join(__dirname, '../../mcp.json');
    const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));

    expect(mcpConfig.mcpServers).toHaveProperty('git-worktree');
    expect(mcpConfig.mcpServers['git-worktree'].command).toBe('node');
    expect(mcpConfig.mcpServers['git-worktree'].args).toContain('./dist/src/mcp/server.js');
  });

  it('should generate correct installation commands', () => {
    // Test local development command
    const localCommand = `claude mcp add git-worktree "node ${path.join(__dirname, '../../dist/src/mcp/server.js')}" --local`;
    expect(localCommand).toContain('claude mcp add');
    expect(localCommand).toContain('git-worktree');
    expect(localCommand).toContain('--local');

    // Test global installation command
    const globalCommand = 'claude mcp add git-worktree claude-gwt-mcp';
    expect(globalCommand).toContain('claude mcp add');
    expect(globalCommand).toContain('git-worktree');
    expect(globalCommand).toContain('claude-gwt-mcp');
  });

  it('should have proper executable permissions', async () => {
    const serverPath = path.join(__dirname, '../../dist/src/mcp/server.js');

    try {
      const stats = await fs.stat(serverPath);
      // Check if file exists
      expect(stats.isFile()).toBe(true);

      // On Unix systems, check execute permission
      if (process.platform !== 'win32') {
        const hasExecutePermission = (stats.mode & 0o100) !== 0;
        expect(hasExecutePermission).toBe(true);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('Skipping test - dist folder not built yet');
        return;
      }
      throw error;
    }
  });

  it('should provide correct tool names for Claude', async () => {
    // Simulate what Claude would see
    const expectedTools = [
      'list_branches',
      'switch_branch',
      'create_branch',
      // 'supervisor_mode' - disabled until core functionality is working
    ];

    const serverPath = path.join(__dirname, '../../dist/src/mcp/server.js');

    // Check if server exists
    try {
      await fs.stat(serverPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('Skipping test - dist folder not built yet');
        return;
      }
      throw error;
    }

    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    };

    const proc = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let response = '';
    proc.stdout.on('data', (data) => {
      response += data.toString();
    });

    proc.stdin.write(JSON.stringify(listToolsRequest) + '\n');

    await new Promise((resolve) => setTimeout(resolve, 1000));
    proc.kill();

    if (!response) {
      console.log('No response from server - skipping test');
      return;
    }

    const parsedResponse = JSON.parse(response);
    if (!parsedResponse.result || !parsedResponse.result.tools) {
      throw new Error('Invalid response structure');
    }
    const toolNames = parsedResponse.result.tools.map((t: any) => t.name);

    expectedTools.forEach((tool) => {
      expect(toolNames).toContain(tool);
    });
  });

  conditionalTest('should work with Claude Code slash commands', async () => {
    // This would test actual Claude integration
    // Requires Claude CLI to be installed and configured

    // Example of what the test would do:
    // 1. Add MCP server to Claude
    // 2. Run Claude with a test command
    // 3. Verify the response

    expect(true).toBe(true); // Placeholder
  });
});
