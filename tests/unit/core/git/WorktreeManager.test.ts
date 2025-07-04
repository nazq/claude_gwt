import { WorktreeManager } from '../../../../src/core/git/WorktreeManager';
import { GitOperationError } from '../../../../src/core/errors/CustomErrors';
import simpleGit from 'simple-git';
import * as path from 'path';

jest.mock('simple-git');

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  let mockGit: any;
  const testBasePath = '/test/repo';

  beforeEach(() => {
    mockGit = {
      raw: jest.fn(),
      branch: jest.fn(),
    };
    (simpleGit as unknown as jest.Mock).mockReturnValue(mockGit);
    manager = new WorktreeManager(testBasePath);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listWorktrees', () => {
    it('should list and parse worktrees correctly', async () => {
      const worktreeOutput = `worktree /test/repo/main
HEAD abc123
branch refs/heads/main

worktree /test/repo/feature
HEAD def456
branch refs/heads/feature
locked

worktree /test/repo/.bare
HEAD ghi789
branch refs/heads/master`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const worktrees = await manager.listWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
      expect(worktrees).toHaveLength(2); // .bare should be filtered out
      expect(worktrees[0]).toEqual({
        path: '/test/repo/main',
        HEAD: 'abc123',
        branch: 'main',
        isLocked: false,
        prunable: false,
      });
      expect(worktrees[1]).toEqual({
        path: '/test/repo/feature',
        HEAD: 'def456',
        branch: 'feature',
        isLocked: true,
        prunable: false,
      });
    });

    it('should handle prunable worktrees', async () => {
      const worktreeOutput = `worktree /test/repo/old-feature
HEAD xyz789
branch refs/heads/old-feature
prunable`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const worktrees = await manager.listWorktrees();

      expect(worktrees[0]!.prunable).toBe(true);
    });

    it('should throw GitOperationError on failure', async () => {
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Git command failed',
      );
    });

    it('should handle non-Error failures', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.listWorktrees()).rejects.toThrow(
        'Failed to list worktrees: Unknown error',
      );
    });
  });

  describe('addWorktree', () => {
    it('should add worktree with base branch', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await manager.addWorktree('feature/new', 'main');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature/new',
        path.join(testBasePath, 'feature/new'),
        'main',
      ]);
      expect(result).toBe(path.join(testBasePath, 'feature/new'));
    });

    it('should add worktree for existing local branch', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/existing', 'develop'],
        branches: {},
        current: 'main',
      });
      mockGit.raw.mockResolvedValue('');

      await manager.addWorktree('feature/existing');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        path.join(testBasePath, 'feature/existing'),
        'feature/existing',
      ]);
    });

    it('should track remote branch if exists', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'remotes/origin/feature/remote'],
        branches: {},
        current: 'main',
      });
      mockGit.raw.mockResolvedValue('');

      await manager.addWorktree('feature/remote');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature/remote',
        path.join(testBasePath, 'feature/remote'),
        'origin/feature/remote',
      ]);
    });

    it('should create new branch if none exists', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main'],
        branches: {},
        current: 'main',
      });
      mockGit.raw.mockResolvedValue('');

      await manager.addWorktree('feature/brand-new');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature/brand-new',
        path.join(testBasePath, 'feature/brand-new'),
      ]);
    });

    it('should throw GitOperationError on failure', async () => {
      mockGit.raw.mockRejectedValue(new Error('Add worktree failed'));

      await expect(manager.addWorktree('feature/fail', 'main')).rejects.toThrow(GitOperationError);
      await expect(manager.addWorktree('feature/fail', 'main')).rejects.toThrow(
        'Failed to add worktree: Add worktree failed',
      );
    });

    it('should handle non-Error failures', async () => {
      // Need to set up branch mock since addWorktree without baseBranch calls git.branch
      mockGit.branch.mockResolvedValue({
        all: ['main'],
        branches: {},
        current: 'main',
      });
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.addWorktree('feature/fail')).rejects.toThrow(
        'Failed to add worktree: Unknown error',
      );
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree by branch name', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('feature/old');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        path.join(testBasePath, 'feature/old'),
      ]);
    });

    it('should remove worktree by full path', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('/absolute/path/to/worktree');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/absolute/path/to/worktree',
      ]);
    });

    it('should force remove when requested', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.removeWorktree('feature/force', true);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        path.join(testBasePath, 'feature/force'),
        '--force',
      ]);
    });

    it('should throw GitOperationError on failure', async () => {
      mockGit.raw.mockRejectedValue(new Error('Remove failed'));

      await expect(manager.removeWorktree('feature/fail')).rejects.toThrow(GitOperationError);
      await expect(manager.removeWorktree('feature/fail')).rejects.toThrow(
        'Failed to remove worktree: Remove failed',
      );
    });

    it('should handle non-Error failures', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.removeWorktree('feature/fail')).rejects.toThrow(
        'Failed to remove worktree: Unknown error',
      );
    });
  });

  describe('pruneWorktrees', () => {
    it('should prune worktrees', async () => {
      mockGit.raw.mockResolvedValue('');

      await manager.pruneWorktrees();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'prune']);
    });

    it('should throw GitOperationError on failure', async () => {
      mockGit.raw.mockRejectedValue(new Error('Prune failed'));

      await expect(manager.pruneWorktrees()).rejects.toThrow(GitOperationError);
      await expect(manager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Prune failed',
      );
    });

    it('should handle non-Error failures', async () => {
      mockGit.raw.mockRejectedValue('String error');

      await expect(manager.pruneWorktrees()).rejects.toThrow(
        'Failed to prune worktrees: Unknown error',
      );
    });
  });

  describe('parseWorktreeList', () => {
    it('should handle empty output', async () => {
      mockGit.raw.mockResolvedValue('');

      const worktrees = await manager.listWorktrees();

      expect(worktrees).toEqual([]);
    });

    it('should handle worktree without branch (detached HEAD)', async () => {
      const worktreeOutput = `worktree /test/repo/detached
HEAD abc123`;

      mockGit.raw.mockResolvedValue(worktreeOutput);

      const worktrees = await manager.listWorktrees();

      // When branch is not in output, it won't be set in the object
      // This may cause type issues since GitWorktreeInfo requires branch
      expect(worktrees[0]!).toEqual({
        path: '/test/repo/detached',
        HEAD: 'abc123',
        isLocked: false,
        prunable: false,
      });
    });
  });
});
