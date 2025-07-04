import { GitRepository } from '../../../../src/core/git/GitRepository';
import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';
import os from 'os';

jest.mock('simple-git');

describe('GitRepository', () => {
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
        isClean: () => true,
      }),
      addRemote: jest.fn().mockResolvedValue(undefined),
      subModule: jest.fn().mockRejectedValue(new Error('No submodules')),
      getRemotes: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
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
      mockGit.status.mockResolvedValue({
        current: 'main',
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
      mockGit.subModule.mockResolvedValue('submodule info');

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Repository contains submodules');
    });
  });

  describe('convertToWorktreeSetup', () => {
    it('should throw error if repository has uncommitted changes', async () => {
      // Mock dirty status
      mockGit.status.mockResolvedValue({
        current: 'main',
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
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
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
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
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
      expect(mockGit.getRemotes).toHaveBeenCalled();
    });

    it('should return "main" if status fails', async () => {
      mockGit.status.mockRejectedValue(new Error('Git error'));

      const branch = await repo.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('initializeBareRepository', () => {
    it('should clone from URL and detect default branch', async () => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.raw.mockResolvedValue('refs/heads/develop\n');

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('develop');
      expect(mockGit.clone).toHaveBeenCalledWith('https://github.com/test/repo.git', '.', [
        '--bare',
      ]);
    });

    it('should fallback to master branch if symbolic-ref fails', async () => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.raw.mockRejectedValue(new Error('No symbolic ref'));
      mockGit.branch.mockResolvedValue({ all: ['master', 'develop'] });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('master');
    });

    it('should use main as default if no master branch exists', async () => {
      mockGit.clone.mockResolvedValue(undefined);
      mockGit.raw.mockRejectedValue(new Error('No symbolic ref'));
      mockGit.branch.mockResolvedValue({ all: ['develop', 'feature'] });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('main');
    });

    it('should initialize empty repository when no URL provided', async () => {
      const mockBareGit = {
        init: jest.fn().mockResolvedValue(undefined),
      };

      (simpleGit as jest.Mock).mockImplementation((path) => {
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        return mockGit;
      });

      mockGit.init.mockResolvedValue(undefined);
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue(undefined);

      const result = await repo.initializeBareRepository();

      expect(result.defaultBranch).toBe('main');
      expect(mockBareGit.init).toHaveBeenCalledWith(['--bare']);

      // Check that README was created
      const readmePath = path.join(testDir, 'README.md');
      expect(await fs.readFile(readmePath, 'utf-8')).toBe('# Git Worktree Project\n');
    });

    it('should handle non-Error failures', async () => {
      mockGit.clone.mockRejectedValue('String error');

      await expect(
        repo.initializeBareRepository('https://github.com/test/repo.git'),
      ).rejects.toThrow('Failed to initialize bare repository: Unknown error');
    });
  });

  describe('getDefaultBranch', () => {
    it('should get default branch from remote HEAD', async () => {
      mockGit.getRemotes.mockResolvedValue([{ name: 'origin', refs: {} }]);
      mockGit.raw.mockResolvedValue('refs/remotes/origin/develop\n');

      const branch = await repo.getDefaultBranch();

      expect(branch).toBe('develop');
      expect(mockGit.raw).toHaveBeenCalledWith(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    });

    it('should return empty string for current if status has no current branch', async () => {
      mockGit.getRemotes.mockResolvedValue([]);
      mockGit.status.mockResolvedValue({ current: null, isClean: () => true });

      const branch = await repo.getDefaultBranch();

      expect(branch).toBe('main');
    });
  });

  describe('fetch', () => {
    it('should fetch all remotes', async () => {
      mockGit.fetch.mockResolvedValue(undefined);

      await repo.fetch();

      expect(mockGit.fetch).toHaveBeenCalledWith(['--all']);
    });

    it('should handle fetch errors', async () => {
      mockGit.fetch.mockRejectedValue(new Error('Network error'));

      await expect(repo.fetch()).rejects.toThrow('Failed to fetch: Network error');
    });

    it('should handle non-Error failures', async () => {
      mockGit.fetch.mockRejectedValue('String error');

      await expect(repo.fetch()).rejects.toThrow('Failed to fetch: Unknown error');
    });
  });
});
