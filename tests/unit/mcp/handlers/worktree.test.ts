/**
 * Tests for MCP Worktree Handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock dependencies
vi.mock('../../../../src/cli/cgwt-program.js', () => ({
  listSessions: vi.fn(),
  parseWorktreeOutput: vi.fn(),
  createNewWorktree: vi.fn(),
  switchSession: vi.fn(),
}));

vi.mock('../../../../src/core/utils/async.js', () => ({
  execCommandSafe: vi.fn(),
}));

vi.mock('../../../../src/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../src/core/git/GitDetector.js', () => ({
  GitDetector: vi.fn().mockImplementation(() => ({
    detectState: vi.fn(),
  })),
}));

vi.mock('../../../../src/core/git/WorktreeManager.js', () => ({
  WorktreeManager: vi.fn(),
}));

describe('Worktree Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export worktreeTools function', async () => {
    const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
    expect(worktreeTools).toBeDefined();
    expect(typeof worktreeTools).toBe('function');
  });

  describe('list_worktrees tool', () => {
    it('should list worktrees successfully', async () => {
      const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
      const { execCommandSafe } = await import('../../../../src/core/utils/async.js');
      const { parseWorktreeOutput } = await import('../../../../src/cli/cgwt-program.js');

      const mockOutput = 'worktree /path/to/main\nHEAD abc123\nbranch refs/heads/main\n';
      (execCommandSafe as Mock).mockResolvedValue({
        code: 0,
        stdout: mockOutput,
        stderr: '',
      });

      (parseWorktreeOutput as Mock).mockReturnValue([
        {
          path: '/path/to/main',
          branch: 'refs/heads/main',
          head: 'abc123',
          isSupervisor: false,
        },
      ]);

      const tools = await worktreeTools();
      const listTool = tools.find((t) => t.tool.name === 'list_worktrees');
      expect(listTool).toBeDefined();

      const result = await listTool!.handler({ format: 'simple' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          path: '/path/to/main',
          branch: 'main',
          head: 'abc123',
          isSupervisor: false,
          isActive: false,
        },
      ]);
    });

    it('should handle list worktrees failure', async () => {
      const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
      const { execCommandSafe } = await import('../../../../src/core/utils/async.js');

      (execCommandSafe as Mock).mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: 'Not a git repository',
      });

      const tools = await worktreeTools();
      const listTool = tools.find((t) => t.tool.name === 'list_worktrees');

      const result = await listTool!.handler({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a git repository');
    });
  });

  describe('create_worktree tool', () => {
    it('should create worktree successfully', async () => {
      const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
      const { GitDetector } = await import('../../../../src/core/git/GitDetector.js');
      const { createNewWorktree } = await import('../../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      (GitDetector as unknown as Mock).mockImplementation(() => mockDetector);

      const tools = await worktreeTools();
      const createTool = tools.find((t) => t.tool.name === 'create_worktree');

      const result = await createTool!.handler({
        branch: 'feature-test',
        createBranch: true,
      });

      expect(createNewWorktree).toHaveBeenCalledWith('feature-test', true);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('path');
    });

    it('should fail when not in worktree repository', async () => {
      const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
      const { GitDetector } = await import('../../../../src/core/git/GitDetector.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      (GitDetector as unknown as Mock).mockImplementation(() => mockDetector);

      const tools = await worktreeTools();
      const createTool = tools.find((t) => t.tool.name === 'create_worktree');

      const result = await createTool!.handler({ branch: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in a Git worktree repository');
    });
  });

  describe('switch_worktree tool', () => {
    it('should switch worktree successfully', async () => {
      const { worktreeTools } = await import('../../../../src/mcp/handlers/worktree.js');
      const { switchSession } = await import('../../../../src/cli/cgwt-program.js');

      const tools = await worktreeTools();
      const switchTool = tools.find((t) => t.tool.name === 'switch_worktree');

      const result = await switchTool!.handler({ target: 'main' });

      expect(switchSession).toHaveBeenCalledWith('main');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ switched_to: 'main' });
    });
  });
});
