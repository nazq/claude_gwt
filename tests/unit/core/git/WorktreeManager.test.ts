import { vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import path from 'path';

// Mock fs and simple-git
vi.mock('fs');
vi.mock('simple-git');

const mockFs = fs as vi.Mocked<typeof fs>;

// Import after mocking
import { simpleGit } from 'simple-git';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { GitOperationError } from '../../../../src/core/errors/CustomErrors';

const mockSimpleGit = vi.mocked(simpleGit);

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  let mockGit: any;
  const basePath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock git operations
    mockGit = {
      raw: vi.fn(),
      branch: vi.fn(),
    };

    mockSimpleGit.mockReturnValue(mockGit);
    mockFs.existsSync.mockReturnValue(false); // Default: no .bare directory
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with regular git repo when .bare does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      manager = new WorktreeManager(basePath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(basePath, '.bare'));
      expect(mockSimpleGit).toHaveBeenCalledWith(basePath);
    });

    it('should initialize with bare setup when .bare directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager = new WorktreeManager(basePath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(basePath, '.bare'));
      expect(mockSimpleGit).toHaveBeenCalledWith(path.join(basePath, '.bare'));
    });
  });

  describe('listWorktrees', () => {
    beforeEach(() => {
      manager = new WorktreeManager(basePath);
    });

    it('should parse and return worktrees correctly', async () => {
      const gitOutput = `worktree /test/project/main
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/feature
HEAD abcdef1234567890
branch refs/heads/feature

worktree /test/project/.bare
HEAD 1234567890abcdef
bare`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
      expect(result).toHaveLength(2); // .bare filtered out
      expect(result[0]).toEqual({
        path: '/test/project/main',
        HEAD: '1234567890abcdef',
        branch: 'main',
        isLocked: false,
        prunable: false,
      });
      expect(result[1]).toEqual({
        path: '/test/project/feature',
        HEAD: 'abcdef1234567890',
        branch: 'feature',
        isLocked: false,
        prunable: false,
      });
    });

    it('should handle worktrees with locked status', async () => {
      const gitOutput = `worktree /test/project/main
HEAD 1234567890abcdef
branch refs/heads/main
locked`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result[0].isLocked).toBe(true);
    });

    it('should handle worktrees with prunable status', async () => {
      const gitOutput = `worktree /test/project/feature
HEAD abcdef1234567890
branch refs/heads/feature
prunable`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result[0].prunable).toBe(true);
    });

    it('should handle locked and prunable together', async () => {
      const gitOutput = `worktree /test/project/feature
HEAD abcdef1234567890
branch refs/heads/feature
locked
prunable`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result[0].isLocked).toBe(true);
      expect(result[0].prunable).toBe(true);
    });

    it('should handle empty worktree list', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await manager.listWorktrees();

      expect(result).toEqual([]);
    });

    it('should throw GitOperationError when git command fails', async () => {
      const error = new Error('Git command failed');
      mockGit.raw.mockRejectedValue(error);

      await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Git command failed',
      );
    });

    it('should handle non-Error rejections', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Unknown error',
      );
    });
  });

  describe('addWorktree', () => {
    beforeEach(() => {
      manager = new WorktreeManager(basePath);
    });

    it('should add worktree with base branch', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await manager.addWorktree('feature-branch', 'main');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature-branch',
        '/test/project/feature-branch',
        'main',
      ]);
      expect(result).toBe('/test/project/feature-branch');
    });

    it('should add worktree for existing local branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature-branch'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockResolvedValue('');

      const result = await manager.addWorktree('feature-branch');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '/test/project/feature-branch',
        'feature-branch',
      ]);
      expect(result).toBe('/test/project/feature-branch');
    });

    it('should add worktree for existing remote branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'remotes/origin/feature-branch'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockResolvedValue('');

      const result = await manager.addWorktree('feature-branch');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature-branch',
        '/test/project/feature-branch',
        'origin/feature-branch',
      ]);
      expect(result).toBe('/test/project/feature-branch');
    });

    it('should create new branch when branch does not exist', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockResolvedValue('');

      const result = await manager.addWorktree('new-feature');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'new-feature',
        '/test/project/new-feature',
      ]);
      expect(result).toBe('/test/project/new-feature');
    });

    it('should throw GitOperationError when git command fails', async () => {
      const error = new Error('Git add worktree failed');
      mockGit.raw.mockRejectedValue(error);

      await expect(manager.addWorktree('feature-branch', 'main')).rejects.toThrow(
        GitOperationError,
      );
      await expect(manager.addWorktree('feature-branch', 'main')).rejects.toThrow(
        'Failed to add worktree: Git add worktree failed',
      );
    });

    it('should handle non-Error rejections in addWorktree', async () => {
      // Mock branch method to succeed, but raw to fail with string
      mockGit.branch.mockResolvedValue({
        all: ['main'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.addWorktree('feature-branch')).rejects.toThrow(
        'Failed to add worktree: Unknown error',
      );
    });
  });

  describe('removeWorktree', () => {
    beforeEach(() => {
      manager = new WorktreeManager(basePath);
    });

    it('should remove worktree by branch name', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('feature-branch');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/test/project/feature-branch',
      ]);
    });

    it('should remove worktree by full path', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('/custom/path/feature-branch');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/custom/path/feature-branch',
      ]);
    });

    it('should remove worktree with force flag', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('feature-branch', true);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/test/project/feature-branch',
        '--force',
      ]);
    });

    it('should throw GitOperationError when git command fails', async () => {
      const error = new Error('Git remove worktree failed');
      mockGit.raw.mockRejectedValue(error);

      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(
        'Failed to remove worktree: Git remove worktree failed',
      );
    });

    it('should handle non-Error rejections in removeWorktree', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(GitOperationError);
      await expect(manager.removeWorktree('feature-branch')).rejects.toThrow(
        'Failed to remove worktree: Unknown error',
      );
    });
  });

  describe('pruneWorktrees', () => {
    beforeEach(() => {
      manager = new WorktreeManager(basePath);
    });

    it('should prune worktrees successfully', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.pruneWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'prune']);
    });

    it('should throw GitOperationError when git command fails', async () => {
      const error = new Error('Git prune worktrees failed');
      mockGit.raw.mockRejectedValue(error);

      await expect(manager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Git prune worktrees failed',
      );
    });

    it('should handle non-Error rejections in pruneWorktrees', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Unknown error',
      );
    });
  });

  describe('parseWorktreeList', () => {
    beforeEach(() => {
      manager = new WorktreeManager(basePath);
    });

    it('should parse complex worktree output with all states', async () => {
      const gitOutput = `worktree /test/project/main
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/feature
HEAD abcdef1234567890
branch feature
locked

worktree /test/project/stale
HEAD 0000000000000000
branch refs/heads/stale
prunable

worktree /test/project/locked-prunable
HEAD ffffffffffffffff
branch refs/heads/locked-prunable
locked
prunable`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result).toHaveLength(4);

      // Main worktree
      expect(result[0]).toEqual({
        path: '/test/project/main',
        HEAD: '1234567890abcdef',
        branch: 'main',
        isLocked: false,
        prunable: false,
      });

      // Locked worktree
      expect(result[1]).toEqual({
        path: '/test/project/feature',
        HEAD: 'abcdef1234567890',
        branch: 'feature',
        isLocked: true,
        prunable: false,
      });

      // Prunable worktree
      expect(result[2]).toEqual({
        path: '/test/project/stale',
        HEAD: '0000000000000000',
        branch: 'stale',
        isLocked: false,
        prunable: true,
      });

      // Both locked and prunable
      expect(result[3]).toEqual({
        path: '/test/project/locked-prunable',
        HEAD: 'ffffffffffffffff',
        branch: 'locked-prunable',
        isLocked: true,
        prunable: true,
      });
    });

    it('should handle worktree without branch info', async () => {
      const gitOutput = `worktree /test/project/detached
HEAD 1234567890abcdef`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: '/test/project/detached',
        HEAD: '1234567890abcdef',
        isLocked: false,
        prunable: false,
        // branch undefined
      });
    });

    it('should filter out .bare directory', async () => {
      const gitOutput = `worktree /test/project/main
HEAD 1234567890abcdef
branch refs/heads/main

worktree /test/project/.bare
HEAD 1234567890abcdef
bare`;

      mockGit.raw.mockResolvedValue(gitOutput);

      const result = await manager.listWorktrees();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/test/project/main');
    });
  });
});
