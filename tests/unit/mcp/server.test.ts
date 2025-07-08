/**
 * MCP Server Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock tool handlers
vi.mock('../../../src/mcp/handlers/worktree.js', () => ({
  worktreeTools: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/mcp/handlers/session.js', () => ({
  sessionTools: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/mcp/handlers/branch.js', () => ({
  branchTools: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/mcp/handlers/claude.js', () => ({
  claudeTools: vi.fn().mockReturnValue([]),
}));

describe('MCP Server', () => {
  let processExitSpy: Mock;
  let originalArgv: string[];

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    originalArgv = [...process.argv];
    vi.clearAllMocks();
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    process.argv = originalArgv;
  });

  it('should export startMCPServer function', async () => {
    const { startMCPServer } = await import('../../../src/mcp/server.js');
    expect(startMCPServer).toBeDefined();
    expect(typeof startMCPServer).toBe('function');
  });

  it('should start MCP server successfully', async () => {
    const { startMCPServer } = await import('../../../src/mcp/server.js');
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { logger } = await import('../../../src/core/utils/logger.js');

    await startMCPServer();

    expect(Server).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Starting MCP server', expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith('MCP server started successfully');
  });

  it('should handle process termination signals', async () => {
    const { startMCPServer } = await import('../../../src/mcp/server.js');
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

    await startMCPServer();

    const serverInstance = (Server as unknown as Mock).mock.results[0]?.value;
    expect(serverInstance.close).toBeDefined();

    // Simulate SIGINT
    const sigintListeners = process.listeners('SIGINT');
    const sigintHandler = sigintListeners[sigintListeners.length - 1] as Function;

    await expect(sigintHandler()).rejects.toThrow('process.exit called');
    expect(serverInstance.close).toHaveBeenCalled();
  });
});

describe('MCP Tool Registry', () => {
  it('should export registerTools function', async () => {
    const { registerTools } = await import('../../../src/mcp/tools/index.js');
    expect(registerTools).toBeDefined();
    expect(typeof registerTools).toBe('function');
  });

  it('should register all tool categories', async () => {
    const { registerTools } = await import('../../../src/mcp/tools/index.js');
    const { worktreeTools } = await import('../../../src/mcp/handlers/worktree.js');
    const { sessionTools } = await import('../../../src/mcp/handlers/session.js');
    const { branchTools } = await import('../../../src/mcp/handlers/branch.js');
    const { claudeTools } = await import('../../../src/mcp/handlers/claude.js');

    const tools = registerTools();

    expect(worktreeTools).toHaveBeenCalled();
    expect(sessionTools).toHaveBeenCalled();
    expect(branchTools).toHaveBeenCalled();
    expect(claudeTools).toHaveBeenCalled();
    expect(Array.isArray(tools)).toBe(true);
  });
});

describe('MCP Types', () => {
  it('should export type definitions', async () => {
    // This test ensures the types module can be imported without errors
    const types = await import('../../../src/mcp/types/index.js');
    expect(types).toBeDefined();
  });
});
