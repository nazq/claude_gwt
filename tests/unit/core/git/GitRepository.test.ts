import { GitRepository } from '../../../../src/core/git/GitRepository';
import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';
import os from 'os';

jest.mock('simple-git');

describe('GitRepository', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGit: any;
  let testDir: string;
  let repo: GitRepository;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(os.tmpdir(), `claude-gwt-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Setup mock git
    mockGit = {
      init: jest.fn().mockResolvedValue(undefined),
      clone: jest.fn().mockResolvedValue(undefined),
      raw: jest.fn().mockResolvedValue('refs/heads/main'),
      branch: jest.fn().mockResolvedValue({ all: ['main', 'master'] }),
      fetch: jest.fn().mockResolvedValue(undefined),
      status: jest.fn().mockResolvedValue({
        current: 'main',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        isClean: () => true,
      }),
      addRemote: jest.fn().mockResolvedValue(undefined),
      subModule: jest.fn().mockRejectedValue(new Error('No submodules')),
      getRemotes: jest.fn().mockResolvedValue([]),
    };

    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    repo = new GitRepository(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('canConvertToWorktree', () => {
    it('should return true for a regular git repository', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false if no .git directory exists', async () => {
      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('No .git directory found');
    });

    it('should return false if already a worktree', async () => {
      // Create a .git file (not directory) with gitdir content
      const gitFile = path.join(testDir, '.git');
      await fs.writeFile(gitFile, 'gitdir: ./.bare\n');

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Already a worktree repository');
    });

    it('should return false if repository has uncommitted changes', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock dirty status
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockResolvedValue({
        current: 'main',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        isClean: () => false,
      });

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Repository has uncommitted changes');
    });

    it('should return false if repository has submodules', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock submodule existence
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.subModule.mockResolvedValue('submodule info');

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Repository contains submodules');
    });
  });

  describe('convertToWorktreeSetup', () => {
    it('should throw error if repository has uncommitted changes', async () => {
      // Mock dirty status
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockResolvedValue({
        current: 'main',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        isClean: () => false,
      });

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(
        /Cannot convert: repository has uncommitted changes/,
      );
    });

    it('should throw error if .git is not a directory', async () => {
      // Create a .git file instead of directory
      const gitFile = path.join(testDir, '.git');
      await fs.writeFile(gitFile, 'gitdir: ./.bare\n');

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(
        /This appears to already be a worktree repository/,
      );
    });

    it('should successfully convert a regular repository', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock the worktree git instance
      const mockWorktreeGit = {
        init: jest.fn().mockResolvedValue(undefined),
        addRemote: jest.fn().mockResolvedValue(undefined),
        fetch: jest.fn().mockResolvedValue(undefined),
        raw: jest.fn().mockResolvedValue(undefined),
      };

      // Return different git instances based on path
      (simpleGit as jest.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.convertToWorktreeSetup();

      expect(result.defaultBranch).toBe('main');
      expect(result.originalPath).toBe(testDir);

      // Verify .git is now a file pointing to .bare
      const gitFilePath = path.join(testDir, '.git');
      const gitFileContent = await fs.readFile(gitFilePath, 'utf-8');
      expect(gitFileContent).toBe('gitdir: ./.bare\n');

      // Verify bare repo was created
      const bareDir = path.join(testDir, '.bare');
      expect(await fs.stat(bareDir)).toBeTruthy();
    });

    it('should handle errors during conversion', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock fetch to fail
      const mockWorktreeGit = {
        init: jest.fn().mockResolvedValue(undefined),
        addRemote: jest.fn().mockResolvedValue(undefined),
        fetch: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      (simpleGit as jest.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(
        /Failed to convert repository:.*Network error/,
      );
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await repo.getCurrentBranch();
      expect(branch).toBe('main');
      // getCurrentBranch calls getDefaultBranch which tries getRemotes first
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.getRemotes).toHaveBeenCalled();
    });

    it('should return "main" if status fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockRejectedValue(new Error('Git error'));

      const branch = await repo.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });
});
