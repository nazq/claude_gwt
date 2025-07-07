import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeManager } from '../../../../src/core/git/WorktreeManager.js';
import { GitOperationError } from '../../../../src/core/errors/CustomErrors.js';
import { Logger } from '../../../../src/core/utils/logger.js';
import { simpleGit } from 'simple-git';
import type { SimpleGit, BranchSummary } from 'simple-git';

vi.mock('../../../../src/core/utils/logger.js');
vi.mock('simple-git');

describe('WorktreeManager - Existing Branches', () => {
  let mockGit: {
    raw: ReturnType<typeof vi.fn>;
    branch: ReturnType<typeof vi.fn>;
  };
  let worktreeManager: WorktreeManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock git instance
    mockGit = {
      raw: vi.fn(),
      branch: vi.fn(),
    };

    // Mock simpleGit to return our mockGit
    vi.mocked(simpleGit).mockReturnValue(mockGit as unknown as SimpleGit);

    worktreeManager = new WorktreeManager('/test/repo');
  });

  describe('getBranchesWithoutWorktrees', () => {
    it('should return branches that do not have worktrees', async () => {
      // Mock branch list
      const mockBranchSummary: BranchSummary = {
        all: ['main', 'feature/test', 'bugfix/issue-123', 'develop'],
        branches: {},
        current: 'main',
        detached: false,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);

      // Mock worktree list - only main and develop have worktrees
      mockGit.raw.mockResolvedValue(`worktree /test/repo
HEAD abc123
branch refs/heads/main

worktree /test/repo/develop
HEAD def456
branch refs/heads/develop
`);

      const result = await worktreeManager.getBranchesWithoutWorktrees();

      expect(result).toEqual(['feature/test', 'bugfix/issue-123']);
      expect(mockGit.branch).toHaveBeenCalled();
      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
    });

    it('should handle branches with refs/heads/ prefix', async () => {
      const mockBranchSummary: BranchSummary = {
        all: ['refs/heads/main', 'refs/heads/feature/new'],
        branches: {},
        current: 'main',
        detached: false,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);

      mockGit.raw.mockResolvedValue(`worktree /test/repo
HEAD abc123
branch refs/heads/main
`);

      const result = await worktreeManager.getBranchesWithoutWorktrees();

      expect(result).toEqual(['refs/heads/feature/new']);
    });

    it('should return empty array when all branches have worktrees', async () => {
      const mockBranchSummary: BranchSummary = {
        all: ['main', 'develop'],
        branches: {},
        current: 'main',
        detached: false,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);

      mockGit.raw.mockResolvedValue(`worktree /test/repo
HEAD abc123
branch refs/heads/main

worktree /test/repo/develop
HEAD def456
branch refs/heads/develop
`);

      const result = await worktreeManager.getBranchesWithoutWorktrees();

      expect(result).toEqual([]);
    });

    it('should handle empty branch list', async () => {
      const mockBranchSummary: BranchSummary = {
        all: [],
        branches: {},
        current: '',
        detached: true,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);

      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.getBranchesWithoutWorktrees();

      expect(result).toEqual([]);
    });

    it('should throw GitOperationError when branch listing fails', async () => {
      mockGit.branch.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.getBranchesWithoutWorktrees()).rejects.toThrow(
        GitOperationError,
      );
      expect(Logger.error).toHaveBeenCalledWith(
        'Failed to get branches without worktrees',
        expect.any(Error),
      );
    });

    it('should throw GitOperationError when worktree listing fails', async () => {
      const mockBranchSummary: BranchSummary = {
        all: ['main'],
        branches: {},
        current: 'main',
        detached: false,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);
      mockGit.raw.mockRejectedValue(new Error('Worktree command failed'));

      await expect(worktreeManager.getBranchesWithoutWorktrees()).rejects.toThrow(
        GitOperationError,
      );
    });

    it('should filter out worktrees without branch names', async () => {
      const mockBranchSummary: BranchSummary = {
        all: ['main', 'feature/test'],
        branches: {},
        current: 'main',
        detached: false,
      };
      mockGit.branch.mockResolvedValue(mockBranchSummary);

      // Worktree with detached HEAD (no branch)
      mockGit.raw.mockResolvedValue(`worktree /test/repo
HEAD abc123
branch refs/heads/main

worktree /test/repo/detached
HEAD def456
`);

      const result = await worktreeManager.getBranchesWithoutWorktrees();

      expect(result).toEqual(['feature/test']);
    });
  });

  describe('addWorktree for existing branch', () => {
    it('should create worktree for existing branch', async () => {
      // Mock branch check - branch exists locally
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/existing'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockResolvedValue(''); // Success

      const result = await worktreeManager.addWorktree('feature/existing');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '/test/repo/feature/existing',
        'feature/existing',
      ]);
      expect(result).toBe('/test/repo/feature/existing');
    });

    it('should handle branch names with slashes', async () => {
      // Mock branch check - branch exists locally
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/deep/nested/branch'],
        branches: {},
        current: 'main',
        detached: false,
      });
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.addWorktree('feature/deep/nested/branch');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '/test/repo/feature/deep/nested/branch',
        'feature/deep/nested/branch',
      ]);
      expect(result).toBe('/test/repo/feature/deep/nested/branch');
    });
  });
});
