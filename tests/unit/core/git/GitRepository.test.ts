import { vi } from 'vitest';
import { GitRepository } from '../../../../src/core/git/GitRepository';
import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';
import os from 'os';

vi.mock('simple-git');

describe('GitRepository', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGit: any;
  let testDir: string;
  let repo: GitRepository;

  beforeEach(async () => {
    // Create a unique test directory with random suffix
    testDir = path.join(
      os.tmpdir(),
      `claude-gwt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(testDir, { recursive: true });

    // Setup mock git
    mockGit = {
      init: vi.fn().mockResolvedValue(undefined),
      clone: vi.fn().mockResolvedValue(undefined),
      raw: vi.fn().mockResolvedValue('refs/heads/main'),
      branch: vi.fn().mockResolvedValue({ all: ['main', 'master'] }),
      fetch: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        current: 'main',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        isClean: () => true,
      }),
      addRemote: vi.fn().mockResolvedValue(undefined),
      subModule: vi.fn().mockRejectedValue(new Error('No submodules')),
      getRemotes: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    (simpleGit as vi.Mock).mockReturnValue(mockGit);
    repo = new GitRepository(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
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
    it('should handle missing current branch in status', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock status with no current branch
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockResolvedValue({
        current: null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        isClean: () => true,
      });

      // Mock the worktree git instance
      const mockWorktreeGit = {
        init: vi.fn().mockResolvedValue(undefined),
        addRemote: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue(undefined),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.convertToWorktreeSetup();

      expect(result.defaultBranch).toBe('main'); // Falls back to 'main'
      expect(result.originalPath).toBe(testDir);
    });

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
      // Ensure clean slate - remove any existing .bare directory
      const existingBareDir = path.join(testDir, '.bare');
      await fs.rm(existingBareDir, { recursive: true, force: true });

      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock the worktree git instance
      const mockWorktreeGit = {
        init: vi.fn().mockResolvedValue(undefined),
        addRemote: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue(undefined),
      };

      // Return different git instances based on path
      (simpleGit as vi.Mock).mockImplementation((path) => {
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

      // Verify no temp directories were left behind in parent directory
      const parentDir = path.dirname(testDir);
      const entries = await fs.readdir(parentDir);
      const tempDirs = entries.filter((entry) => entry.startsWith('.claude-gwt-convert-'));
      expect(tempDirs).toHaveLength(0);
    });

    it('should handle errors during conversion', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock fetch to fail
      const mockWorktreeGit = {
        init: vi.fn().mockResolvedValue(undefined),
        addRemote: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
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

      // Verify temp directories were cleaned up even on error
      const parentDir = path.dirname(testDir);
      const entries = await fs.readdir(parentDir);
      const tempDirs = entries.filter((entry) => entry.startsWith('.claude-gwt-convert-'));
      expect(tempDirs).toHaveLength(0);

      // Verify .git directory was restored
      const gitDirExists = await fs
        .access(gitDir)
        .then(() => true)
        .catch(() => false);
      expect(gitDirExists).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock fetch to fail
      const mockWorktreeGit = {
        init: vi.fn().mockResolvedValue(undefined),
        addRemote: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      // Mock fs.rm to fail during cleanup
      const rmSpy = vi.spyOn(fs, 'rm').mockRejectedValueOnce(new Error('Cleanup error'));

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(
        /Failed to convert repository:.*Network error/,
      );

      rmSpy.mockRestore();
    });

    it('should handle backup restoration errors gracefully', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock the conversion to fail after backup is created
      const mockWorktreeGit = {
        init: vi.fn().mockResolvedValue(undefined),
        addRemote: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockRejectedValue(new Error('Worktree add failed')),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockWorktreeGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(/Failed to convert repository/);
    });

    it('should handle non-Error exceptions during conversion', async () => {
      // Create a mock .git directory
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock branch to throw a string
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.branch.mockRejectedValue('String error');

      await expect(repo.convertToWorktreeSetup()).rejects.toThrow(
        /Failed to convert repository:.*Unknown error/,
      );
    });
  });

  describe('initializeBareRepository', () => {
    it('should handle invalid HEAD ref format', async () => {
      const mockBareGit = {
        clone: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue('invalid-format'), // No match for refs/heads/
        branch: vi.fn().mockResolvedValue({ all: ['main'] }),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('main'); // Falls back to main when HEAD doesn't match pattern
    });

    it('should handle empty branch list', async () => {
      const mockBareGit = {
        clone: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockRejectedValue(new Error('No HEAD')),
        branch: vi.fn().mockResolvedValue({ all: [] }),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('main'); // Falls back to main when no branches
    });

    it('should initialize bare repository with URL', async () => {
      const mockBareGit = {
        clone: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue('refs/heads/develop'),
        branch: vi.fn().mockResolvedValue({ all: ['main', 'develop'] }),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('develop');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockBareGit.clone).toHaveBeenCalledWith('https://github.com/test/repo.git', '.', [
        '--bare',
      ]);
    });

    it('should handle missing HEAD ref and fall back to master branch', async () => {
      const mockBareGit = {
        clone: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockRejectedValue(new Error('No HEAD')),
        branch: vi.fn().mockResolvedValue({ all: ['master', 'feature'] }),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      const result = await repo.initializeBareRepository('https://github.com/test/repo.git');

      expect(result.defaultBranch).toBe('master');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockBareGit.branch).toHaveBeenCalled();
    });

    it('should initialize bare repository without URL', async () => {
      const mockBareGit = {
        init: vi.fn().mockResolvedValue(undefined),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      // Also mock the git operations for creating initial commit
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.add.mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.commit.mockResolvedValue(undefined);

      const result = await repo.initializeBareRepository();

      expect(result.defaultBranch).toBe('main');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockBareGit.init).toHaveBeenCalledWith(['--bare']);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.add).toHaveBeenCalledWith('README.md');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.commit).toHaveBeenCalledWith('Initial commit');
    });

    it('should throw GitOperationError on failure', async () => {
      const mockBareGit = {
        init: vi.fn().mockRejectedValue(new Error('Permission denied')),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      await expect(repo.initializeBareRepository()).rejects.toThrow(
        /Failed to initialize bare repository.*Permission denied/,
      );
    });

    it('should handle non-Error rejection', async () => {
      const mockBareGit = {
        init: vi.fn().mockRejectedValue('String error'),
      };

      (simpleGit as vi.Mock).mockImplementation((path) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (path.includes('.bare')) {
          return mockBareGit;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockGit;
      });

      await expect(repo.initializeBareRepository()).rejects.toThrow(
        /Failed to initialize bare repository.*Unknown error/,
      );
    });
  });

  describe('fetch', () => {
    it('should fetch all remotes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.fetch.mockResolvedValue(undefined);

      await repo.fetch();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.fetch).toHaveBeenCalledWith(['--all']);
    });

    it('should throw GitOperationError on failure', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.fetch.mockRejectedValue(new Error('Network error'));

      await expect(repo.fetch()).rejects.toThrow(/Failed to fetch.*Network error/);
    });

    it('should handle non-Error rejection', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.fetch.mockRejectedValue('String error');

      await expect(repo.fetch()).rejects.toThrow(/Failed to fetch.*Unknown error/);
    });
  });

  describe('canConvertToWorktree error handling', () => {
    it('should handle .git file that does not contain gitdir', async () => {
      // Create a .git file without gitdir content
      const gitFile = path.join(testDir, '.git');
      await fs.writeFile(gitFile, 'some other content\n');

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(true);
    });

    it('should handle stat errors gracefully', async () => {
      // Mock fs.stat to throw an error
      const statSpy = vi.spyOn(fs, 'stat').mockRejectedValue(new Error('Permission denied'));

      try {
        const result = await repo.canConvertToWorktree();

        expect(result.canConvert).toBe(false);
        expect(result.reason).toBe('No .git directory found');
      } finally {
        statSpy.mockRestore();
      }
    });

    it('should handle non-Error exceptions', async () => {
      const gitDir = path.join(testDir, '.git');
      await fs.mkdir(gitDir);

      // Mock status to throw a string (non-Error)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockImplementation(() => {
        throw 'String error'; // This will trigger the outer catch
      });

      const result = await repo.canConvertToWorktree();

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Unknown error');
    });
  });

  describe('getBareGitPath', () => {
    it('should return the bare git path', () => {
      const barePath = repo.getBareGitPath();
      expect(barePath).toBe(path.join(testDir, '.bare'));
    });
  });

  describe('getDefaultBranch', () => {
    it('should get default branch from remote HEAD', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.getRemotes.mockResolvedValue([{ name: 'origin', refs: {} }]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.raw.mockResolvedValue('refs/remotes/origin/develop\n');

      const branch = await repo.getDefaultBranch();
      expect(branch).toBe('develop');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.raw).toHaveBeenCalledWith(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    });

    it('should handle malformed remote HEAD', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.getRemotes.mockResolvedValue([{ name: 'origin', refs: {} }]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.raw.mockResolvedValue('invalid-ref');

      const branch = await repo.getDefaultBranch();
      expect(branch).toBe('main');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should fall back to current branch when no remotes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.getRemotes.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockResolvedValue({ current: 'feature-branch' });

      const branch = await repo.getDefaultBranch();
      expect(branch).toBe('feature-branch');
    });

    it('should return main when status.current is null', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.getRemotes.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.status.mockResolvedValue({ current: null });

      const branch = await repo.getDefaultBranch();
      expect(branch).toBe('main');
    });

    it('should return main when all operations fail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGit.getRemotes.mockRejectedValue(new Error('Remote error'));

      const branch = await repo.getDefaultBranch();
      expect(branch).toBe('main');
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
