<<<<<<< HEAD
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { GitOperationError } from '../../../../src/core/errors/CustomErrors';
import * as fs from 'fs';
import { simpleGit } from 'simple-git';

// Mock dependencies
vi.mock('fs');
vi.mock('simple-git');

describe('WorktreeManager', () => {
  const mockFs = vi.mocked(fs);
  const mockSimpleGit = vi.mocked(simpleGit);
=======
import { vi } from 'vitest';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { GitOperationError } from '../../../../src/core/errors/CustomErrors';
import type { GitWorktreeInfo } from '../../../../src/types';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(),
}));

import { existsSync } from 'fs';
import { simpleGit } from 'simple-git';

describe('WorktreeManager', () => {
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
  const mockGit = {
    raw: vi.fn(),
    branch: vi.fn(),
  };

<<<<<<< HEAD
  beforeEach(() => {
    vi.clearAllMocks();
    mockSimpleGit.mockReturnValue(mockGit as any);
  });

  describe('constructor', () => {
    it('should use .bare directory when it exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      new WorktreeManager('/project');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/project/.bare');
      expect(mockSimpleGit).toHaveBeenCalledWith('/project/.bare');
    });

    it('should use base path when .bare directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      new WorktreeManager('/project');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/project/.bare');
      expect(mockSimpleGit).toHaveBeenCalledWith('/project');
=======
  const mockExistsSync = vi.mocked(existsSync);
  const mockSimpleGit = vi.mocked(simpleGit);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSimpleGit.mockReturnValue(mockGit as any);
    mockExistsSync.mockReturnValue(false);
  });

  describe('constructor', () => {
    it('should initialize with regular git repository', () => {
      mockExistsSync.mockReturnValue(false);

      const manager = new WorktreeManager('/path/to/repo');

      expect(mockSimpleGit).toHaveBeenCalledWith('/path/to/repo');
    });

    it('should initialize with bare repository setup', () => {
      mockExistsSync.mockReturnValue(true);

      const manager = new WorktreeManager('/path/to/repo');

      expect(mockSimpleGit).toHaveBeenCalledWith('/path/to/repo/.bare');
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
    });
  });

  describe('listWorktrees', () => {
<<<<<<< HEAD
    it('should parse and filter worktree list correctly', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project
HEAD 1234567890abcdef
branch main

worktree /project/feature
HEAD abcdef1234567890
branch feature

worktree /project/.bare
HEAD 1234567890abcdef
branch main`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toEqual([
        {
          path: '/project',
          HEAD: '1234567890abcdef',
          branch: 'main',
          isLocked: false,
          prunable: false,
        },
        {
          path: '/project/feature',
          HEAD: 'abcdef1234567890',
          branch: 'feature',
          isLocked: false,
          prunable: false,
        },
      ]);
      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
    });

    it('should handle worktrees with refs/heads/ prefix', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project/feature
HEAD abcdef1234567890
branch refs/heads/feature`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result[0].branch).toBe('feature');
    });

    it('should handle locked and prunable worktrees', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project/locked-feature
HEAD abcdef1234567890
branch locked-feature
locked

worktree /project/prunable-feature
HEAD abcdef1234567890
branch prunable-feature
prunable`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toEqual([
        expect.objectContaining({
          path: '/project/locked-feature',
          branch: 'locked-feature',
          isLocked: true,
          prunable: false,
        }),
        expect.objectContaining({
          path: '/project/prunable-feature',
          branch: 'prunable-feature',
          isLocked: false,
          prunable: true,
        }),
      ]);
    });

    it('should handle empty worktree output', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.listWorktrees();

      expect(result).toEqual([]);
    });

    it('should handle incomplete worktree data', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project/incomplete
worktree /project/complete
HEAD abcdef1234567890
branch complete`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toEqual([
        {
          path: '/project/incomplete',
          isLocked: false,
          prunable: false,
        },
        {
          path: '/project/complete',
          HEAD: 'abcdef1234567890',
          branch: 'complete',
          isLocked: false,
          prunable: false,
        },
      ]);
    });

    it('should throw GitOperationError on git command failure', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.listWorktrees()).rejects.toThrow(
=======
    it('should list worktrees successfully', async () => {
      const worktreeOutput = `worktree /path/to/repo/main
HEAD 1234567890abcdef
branch refs/heads/main

worktree /path/to/repo/feature
HEAD abcdef1234567890
branch refs/heads/feature
`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: '/path/to/repo/main',
        HEAD: '1234567890abcdef',
        branch: 'main',
        isLocked: false,
        prunable: false,
      });
      expect(result[1]).toEqual({
        path: '/path/to/repo/feature',
        HEAD: 'abcdef1234567890',
        branch: 'feature',
        isLocked: false,
        prunable: false,
      });
    });

    it('should filter out .bare directory', async () => {
      const worktreeOutput = `worktree /path/to/repo/.bare
HEAD 1234567890abcdef
branch refs/heads/main

worktree /path/to/repo/main
HEAD 1234567890abcdef
branch refs/heads/main
`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/path/to/repo/main');
    });

    it('should handle locked and prunable worktrees', async () => {
      const worktreeOutput = `worktree /path/to/repo/locked-branch
HEAD 1234567890abcdef
branch refs/heads/locked-branch
locked

worktree /path/to/repo/prunable-branch
HEAD 0000000000000000
prunable
`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: '/path/to/repo/locked-branch',
        HEAD: '1234567890abcdef',
        branch: 'locked-branch',
        isLocked: true,
        prunable: false,
      });
      expect(result[1]).toEqual({
        path: '/path/to/repo/prunable-branch',
        HEAD: '0000000000000000',
        prunable: true,
        isLocked: false,
      });
    });

    it('should handle empty worktree list', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result).toHaveLength(0);
    });

    it('should throw GitOperationError on git command failure', async () => {
      const gitError = new Error('Git command failed');
      mockGit.raw.mockRejectedValue(gitError);

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.listWorktrees()).rejects.toThrow(
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
        'Failed to list worktrees: Git command failed',
      );
    });

    it('should handle non-Error rejection', async () => {
<<<<<<< HEAD
      mockFs.existsSync.mockReturnValue(false);
      const worktreeManager = new WorktreeManager('/project');

      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Unknown error',
      );
    });
  });

  describe('addWorktree', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should add worktree with base branch', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.addWorktree('feature', 'main');

      expect(result).toBe('/project/feature');
=======
      mockGit.raw.mockRejectedValue('String error');

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Unknown error',
      );
    });

    it('should handle malformed worktree output', async () => {
      const malformedOutput = `worktree /path/to/repo/main
HEAD
invalid line
branch
`;

      mockGit.raw.mockResolvedValue(malformedOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      // Should still parse what it can
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/path/to/repo/main');
      expect(result[0].branch).toBeUndefined();
    });
  });

  describe('addWorktree', () => {
    it('should add worktree with base branch', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.addWorktree('feature-branch', 'main');

>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
<<<<<<< HEAD
        'feature',
        '/project/feature',
        'main',
      ]);
    });

    it('should add worktree for existing local branch', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature', 'remotes/origin/main'],
      });

      const result = await worktreeManager.addWorktree('feature');

      expect(result).toBe('/project/feature');
      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'add', '/project/feature', 'feature']);
    });

    it('should add worktree for existing remote branch', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');
      mockGit.branch.mockResolvedValue({
        all: ['main', 'remotes/origin/main', 'remotes/origin/feature'],
      });

      const result = await worktreeManager.addWorktree('feature');

      expect(result).toBe('/project/feature');
=======
        'feature-branch',
        '/path/to/repo/feature-branch',
        'main',
      ]);
      expect(result).toBe('/path/to/repo/feature-branch');
    });

    it('should add worktree for existing local branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature-branch'],
      });
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.addWorktree('feature-branch');

      expect(mockGit.branch).toHaveBeenCalledWith(['-a']);
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '/path/to/repo/feature-branch',
        'feature-branch',
      ]);
      expect(result).toBe('/path/to/repo/feature-branch');
    });

    it('should add worktree for existing remote branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'remotes/origin/feature-branch'],
      });
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.addWorktree('feature-branch');

>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
<<<<<<< HEAD
        'feature',
        '/project/feature',
        'origin/feature',
      ]);
    });

    it('should create new branch when it does not exist', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');
      mockGit.branch.mockResolvedValue({
        all: ['main', 'remotes/origin/main'],
      });

      const result = await worktreeManager.addWorktree('new-feature');

      expect(result).toBe('/project/new-feature');
=======
        'feature-branch',
        '/path/to/repo/feature-branch',
        'origin/feature-branch',
      ]);
      expect(result).toBe('/path/to/repo/feature-branch');
    });

    it('should create new branch when branch does not exist', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main'],
      });
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.addWorktree('new-feature');

>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'new-feature',
<<<<<<< HEAD
        '/project/new-feature',
      ]);
    });

    it('should throw GitOperationError on git command failure', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(
        'Failed to add worktree: Git command failed',
=======
        '/path/to/repo/new-feature',
      ]);
      expect(result).toBe('/path/to/repo/new-feature');
    });

    it('should throw GitOperationError on git command failure', async () => {
      const gitError = new Error('Worktree add failed');
      mockGit.branch.mockResolvedValue({ all: [] });
      mockGit.raw.mockRejectedValue(gitError);

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(
        'Failed to add worktree: Worktree add failed',
      );
    });

    it('should throw GitOperationError on branch list failure', async () => {
      const branchError = new Error('Branch list failed');
      mockGit.branch.mockRejectedValue(branchError);

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(
        'Failed to add worktree: Branch list failed',
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      );
    });

    it('should handle non-Error rejection in addWorktree', async () => {
<<<<<<< HEAD
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(
=======
      mockGit.branch.mockResolvedValue({ all: [] });
      mockGit.raw.mockRejectedValue('String error');

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
        'Failed to add worktree: Unknown error',
      );
    });
  });

  describe('removeWorktree', () => {
<<<<<<< HEAD
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should remove worktree by branch name', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree('feature');

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'remove', '/project/feature']);
    });

    it('should remove worktree by full path', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree('/custom/path/feature');

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'remove', '/custom/path/feature']);
    });

    it('should remove worktree with force flag', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.removeWorktree('feature', true);
=======
    it('should remove worktree by branch name', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      await manager.removeWorktree('feature-branch');
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
<<<<<<< HEAD
        '/project/feature',
=======
        '/path/to/repo/feature-branch',
      ]);
    });

    it('should remove worktree by full path', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      await manager.removeWorktree('/full/path/to/worktree');

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'remove', '/full/path/to/worktree']);
    });

    it('should remove worktree with force flag', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      await manager.removeWorktree('feature-branch', true);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/path/to/repo/feature-branch',
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
        '--force',
      ]);
    });

    it('should throw GitOperationError on git command failure', async () => {
<<<<<<< HEAD
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(
        'Failed to remove worktree: Git command failed',
=======
      const gitError = new Error('Worktree remove failed');
      mockGit.raw.mockRejectedValue(gitError);

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(
        'Failed to remove worktree: Worktree remove failed',
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      );
    });

    it('should handle non-Error rejection in removeWorktree', async () => {
<<<<<<< HEAD
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(
=======
      mockGit.raw.mockRejectedValue('String error');

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
        'Failed to remove worktree: Unknown error',
      );
    });
  });

  describe('pruneWorktrees', () => {
<<<<<<< HEAD
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should prune worktrees successfully', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.pruneWorktrees();
=======
    it('should prune worktrees successfully', async () => {
      mockGit.raw.mockResolvedValue('');

      const manager = new WorktreeManager('/path/to/repo');
      await manager.pruneWorktrees();
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'prune']);
    });

    it('should throw GitOperationError on git command failure', async () => {
<<<<<<< HEAD
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Git command failed',
=======
      const gitError = new Error('Worktree prune failed');
      mockGit.raw.mockRejectedValue(gitError);

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Worktree prune failed',
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      );
    });

    it('should handle non-Error rejection in pruneWorktrees', async () => {
<<<<<<< HEAD
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(
=======
      mockGit.raw.mockRejectedValue('String error');

      const manager = new WorktreeManager('/path/to/repo');

      await expect(manager.pruneWorktrees()).rejects.toThrow(
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
        'Failed to prune worktrees: Unknown error',
      );
    });
  });

  describe('parseWorktreeList edge cases', () => {
<<<<<<< HEAD
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should handle unknown line types gracefully', async () => {
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project/feature
HEAD abcdef1234567890
branch feature
unknown-line-type value
custom-attribute something`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toEqual([
        {
          path: '/project/feature',
          HEAD: 'abcdef1234567890',
          branch: 'feature',
          isLocked: false,
          prunable: false,
        },
      ]);
    });

    it('should handle multiple worktrees with different states', async () => {
      const worktreeManager = new WorktreeManager('/project');

      const gitOutput = `worktree /project
HEAD 1234567890abcdef
branch main

worktree /project/locked-branch
HEAD abcdef1234567890
branch locked-branch
locked

worktree /project/prunable-branch
HEAD fedcba0987654321
branch prunable-branch
prunable

worktree /project/both-states
HEAD 1111222233334444
branch both-states
locked
prunable`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await worktreeManager.listWorktrees();

      expect(result).toHaveLength(4);
      expect(result[1]).toEqual(
        expect.objectContaining({
          isLocked: true,
          prunable: false,
        }),
      );
      expect(result[2]).toEqual(
        expect.objectContaining({
          isLocked: false,
          prunable: true,
        }),
      );
      expect(result[3]).toEqual(
        expect.objectContaining({
          isLocked: true,
          prunable: true,
        }),
      );
=======
    it('should handle worktree output without final newline', async () => {
      const worktreeOutput = `worktree /path/to/repo/main
HEAD 1234567890abcdef
branch refs/heads/main`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('main');
    });

    it('should handle incomplete worktree entry', async () => {
      const worktreeOutput = `worktree /path/to/repo/incomplete`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: '/path/to/repo/incomplete',
        isLocked: false,
        prunable: false,
      });
    });

    it('should handle branch names without refs/heads prefix', async () => {
      const worktreeOutput = `worktree /path/to/repo/main
HEAD 1234567890abcdef
branch main
`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result[0].branch).toBe('main');
    });

    it('should handle empty HEAD value', async () => {
      const worktreeOutput = `worktree /path/to/repo/main
HEAD 
branch refs/heads/main
`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const manager = new WorktreeManager('/path/to/repo');
      const result = await manager.listWorktrees();

      expect(result[0].HEAD).toBe('');
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
    });
  });
});
