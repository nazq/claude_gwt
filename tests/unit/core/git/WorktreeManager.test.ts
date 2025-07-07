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
  const mockGit = {
    raw: vi.fn(),
    branch: vi.fn(),
  };

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
    });
  });

  describe('listWorktrees', () => {
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
        'Failed to list worktrees: Git command failed',
      );
    });

    it('should handle non-Error rejection', async () => {
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
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
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
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
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
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'new-feature',
        '/project/new-feature',
      ]);
    });

    it('should throw GitOperationError on git command failure', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(
        'Failed to add worktree: Git command failed',
      );
    });

    it('should handle non-Error rejection in addWorktree', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.addWorktree('feature')).rejects.toThrow(
        'Failed to add worktree: Unknown error',
      );
    });
  });

  describe('removeWorktree', () => {
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

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/project/feature',
        '--force',
      ]);
    });

    it('should throw GitOperationError on git command failure', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(
        'Failed to remove worktree: Git command failed',
      );
    });

    it('should handle non-Error rejection in removeWorktree', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.removeWorktree('feature')).rejects.toThrow(
        'Failed to remove worktree: Unknown error',
      );
    });
  });

  describe('pruneWorktrees', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should prune worktrees successfully', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockResolvedValue('');

      await worktreeManager.pruneWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'prune']);
    });

    it('should throw GitOperationError on git command failure', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Git command failed',
      );
    });

    it('should handle non-Error rejection in pruneWorktrees', async () => {
      const worktreeManager = new WorktreeManager('/project');
      mockGit.raw.mockRejectedValue('String error');

      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(worktreeManager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Unknown error',
      );
    });
  });

  describe('parseWorktreeList edge cases', () => {
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
    });
  });
});
