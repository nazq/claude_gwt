import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClaudeGWTAppRefactored } from '../../../src/cli/ClaudeGWTApp.refactored';
import type { DirectoryState, GitWorktreeInfo, CLIOptions } from '../../../src/types';
import type {
  IGitDetector,
  IGitRepository,
  IWorktreeManager,
  ITmuxManager,
  ILogger,
  IFileSystem,
  IPrompts,
  ISpinner,
  ITheme,
  IBanner,
  ISimpleGit,
} from '../../../src/cli/interfaces';

describe('ClaudeGWTAppRefactored', () => {
  let mockGitDetector: IGitDetector;
  let mockGitRepository: IGitRepository;
  let mockWorktreeManager: IWorktreeManager;
  let mockTmuxManager: ITmuxManager;
  let mockLogger: ILogger;
  let mockTheme: ITheme;
  let mockPrompts: IPrompts;
  let mockSpinner: ISpinner;
  let mockShowBanner: IBanner;
  let mockFs: IFileSystem;
  let mockProcessExit: vi.Mock;
  let mockConsoleLog: vi.Mock;
  let mockConsoleError: vi.Mock;
  let mockSimpleGit: ISimpleGit;

  beforeEach(() => {
    mockGitDetector = {
      detectState: vi.fn(),
    };

    mockGitRepository = {
      initializeBareRepository: vi.fn(),
      getDefaultBranch: vi.fn(),
      fetch: vi.fn(),
      canConvertToWorktree: vi.fn(),
      convertToWorktreeSetup: vi.fn(),
    };

    mockWorktreeManager = {
      listWorktrees: vi.fn(),
      addWorktree: vi.fn(),
      removeWorktree: vi.fn(),
    };

    mockTmuxManager = {
      getSessionName: vi.fn(),
      launchSession: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockTheme = {
      info: vi.fn((text) => `[INFO] ${text}`),
      error: vi.fn((text) => `[ERROR] ${text}`),
      success: vi.fn((text) => `[SUCCESS] ${text}`),
      warning: vi.fn((text) => `[WARNING] ${text}`),
      primary: vi.fn((text) => `[PRIMARY] ${text}`),
      muted: vi.fn((text) => `[MUTED] ${text}`),
      branch: vi.fn((name) => `[BRANCH:${name}]`),
    };

    mockPrompts = {
      promptForRepoUrl: vi.fn(),
      promptForBranchName: vi.fn(),
      promptForWorktreeAction: vi.fn(),
      promptForParentAction: vi.fn(),
      promptForGitRepoAction: vi.fn(),
      promptToInitialize: vi.fn(),
      promptForNewBranchName: vi.fn(),
      promptForBaseBranch: vi.fn(),
      confirmAction: vi.fn(),
    };

    mockSpinner = {
      start: vi.fn(),
      setText: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      stop: vi.fn(),
    };

    mockShowBanner = vi.fn();

    mockFs = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
    };

    mockProcessExit = vi.fn(() => {
      throw new Error('Process exit');
    });

    mockConsoleLog = vi.fn();
    mockConsoleError = vi.fn();

    mockSimpleGit = {
      status: vi.fn().mockResolvedValue({ current: 'main' }),
    };
  });

  const createApp = (basePath: string, options: CLIOptions = {}) => {
    return new ClaudeGWTAppRefactored(basePath, options, {
      gitDetector: mockGitDetector,
      createGitRepository: () => mockGitRepository,
      createWorktreeManager: () => mockWorktreeManager,
      tmuxManager: mockTmuxManager,
      logger: mockLogger,
      theme: mockTheme,
      prompts: mockPrompts,
      createSpinner: () => mockSpinner,
      showBanner: mockShowBanner,
      fs: mockFs,
      createSimpleGit: () => mockSimpleGit,
      processExit: mockProcessExit as never,
      consoleLog: mockConsoleLog,
      consoleError: mockConsoleError,
    });
  };

  describe('run', () => {
    it('should show banner when not quiet', async () => {
      const app = createApp('/test/path', { quiet: false });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'empty' });
      vi.mocked(mockPrompts.promptForRepoUrl).mockResolvedValue(undefined);
      vi.mocked(mockGitRepository.initializeBareRepository).mockResolvedValue({
        defaultBranch: 'main',
      });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([]);
      vi.mocked(mockPrompts.promptForBranchName).mockResolvedValue('feature');
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/feature');
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockShowBanner).toHaveBeenCalled();
    });

    it('should not show banner when quiet', async () => {
      const app = createApp('/test/path', { quiet: true });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'empty' });
      vi.mocked(mockGitRepository.initializeBareRepository).mockResolvedValue({
        defaultBranch: 'main',
      });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([]);
      vi.mocked(mockPrompts.promptForBranchName).mockResolvedValue('feature');
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/feature');
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockShowBanner).not.toHaveBeenCalled();
    });

    it('should handle fatal errors', async () => {
      const app = createApp('/test/path', {});
      const error = new Error('Detection failed');
      vi.mocked(mockGitDetector.detectState).mockRejectedValue(error);

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockLogger.error).toHaveBeenCalledWith('Fatal error in ClaudeGWTApp', error);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] \n✖ Error:', 'Detection failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handleEmptyDirectory', () => {
    it('should clone repository when URL provided', async () => {
      const app = createApp('/test/path', { repo: 'https://github.com/test/repo.git' });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'empty' });
      vi.mocked(mockGitRepository.initializeBareRepository).mockResolvedValue({
        defaultBranch: 'main',
      });
      vi.mocked(mockGitRepository.fetch).mockResolvedValue();
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/main');
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        {
          path: '/test/path/main',
          branch: 'main',
          HEAD: 'abc123',
          isLocked: false,
          prunable: false,
        },
      ]);
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockGitRepository.initializeBareRepository).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
      );
      expect(mockGitRepository.fetch).toHaveBeenCalled();
      expect(mockWorktreeManager.addWorktree).toHaveBeenCalledWith('main');
    });

    it('should create local repository when no URL provided', async () => {
      const app = createApp('/test/path', { interactive: true });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'empty' });
      vi.mocked(mockPrompts.promptForRepoUrl).mockResolvedValue(undefined);
      vi.mocked(mockGitRepository.initializeBareRepository).mockResolvedValue({
        defaultBranch: 'main',
      });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([]);
      vi.mocked(mockPrompts.promptForBranchName).mockResolvedValue('main');
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/main');
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockGitRepository.initializeBareRepository).toHaveBeenCalledWith(undefined);
      expect(mockGitRepository.fetch).not.toHaveBeenCalled();
    });

    it('should handle repository initialization failure', async () => {
      const app = createApp('/test/path', { repo: 'https://github.com/test/repo.git' });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'empty' });
      vi.mocked(mockGitRepository.initializeBareRepository).mockRejectedValue(
        new Error('Clone failed'),
      );

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to initialize repository');
    });
  });

  describe('handleGitWorktree', () => {
    it('should launch session for existing worktree', async () => {
      const app = createApp('/test/path/main', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        {
          path: '/test/path/main',
          branch: 'main',
          HEAD: 'abc123',
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/path/feature',
          branch: 'feature',
          HEAD: 'def456',
          isLocked: false,
          prunable: false,
        },
      ]);
      vi.mocked(mockPrompts.promptForWorktreeAction).mockResolvedValue({ type: 'launch' });
      vi.mocked(mockTmuxManager.getSessionName).mockReturnValue('cgwt-test-main');
      vi.mocked(mockTmuxManager.launchSession).mockResolvedValue();

      await app.run();

      expect(mockPrompts.promptForWorktreeAction).toHaveBeenCalledWith(expect.any(Array), 'main');
      expect(mockTmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-test-main',
        workingDirectory: '/test/path/main',
        branchName: 'main',
        role: 'child',
        gitRepo: mockGitRepository,
      });
    });

    it('should switch to different branch', async () => {
      const app = createApp('/test/path/main', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        {
          path: '/test/path/main',
          branch: 'main',
          HEAD: 'abc123',
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/path/feature',
          branch: 'feature',
          HEAD: 'def456',
          isLocked: false,
          prunable: false,
        },
      ]);
      vi.mocked(mockPrompts.promptForWorktreeAction).mockResolvedValue({
        type: 'switch',
        branch: 'feature',
      });
      vi.mocked(mockTmuxManager.getSessionName).mockReturnValue('cgwt-test-feature');
      vi.mocked(mockTmuxManager.launchSession).mockResolvedValue();

      await app.run();

      expect(mockTmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-test-feature',
        workingDirectory: '/test/path/feature',
        branchName: 'feature',
        role: 'child',
        gitRepo: mockGitRepository,
      });
    });

    it('should create new branch', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees)
        .mockResolvedValueOnce([
          {
            path: '/test/path/main',
            branch: 'main',
            HEAD: 'abc123',
            isLocked: false,
            prunable: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            path: '/test/path/main',
            branch: 'main',
            HEAD: 'abc123',
            isLocked: false,
            prunable: false,
          },
          {
            path: '/test/path/feature',
            branch: 'feature',
            HEAD: 'def456',
            isLocked: false,
            prunable: false,
          },
        ]);
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValueOnce({ type: 'create' });
      vi.mocked(mockPrompts.promptForNewBranchName).mockResolvedValue('feature');
      vi.mocked(mockPrompts.promptForBaseBranch).mockResolvedValue('main');
      vi.mocked(mockGitRepository.getDefaultBranch).mockResolvedValue('main');
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/feature');
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValueOnce({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockWorktreeManager.addWorktree).toHaveBeenCalledWith('feature', 'main');
    });

    it('should remove branch', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees)
        .mockResolvedValueOnce([
          {
            path: '/test/path/main',
            branch: 'main',
            HEAD: 'abc123',
            isLocked: false,
            prunable: false,
          },
          {
            path: '/test/path/feature',
            branch: 'feature',
            HEAD: 'def456',
            isLocked: false,
            prunable: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            path: '/test/path/main',
            branch: 'main',
            HEAD: 'abc123',
            isLocked: false,
            prunable: false,
          },
        ]);
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValueOnce({
        type: 'remove',
        branch: 'feature',
      });
      vi.mocked(mockWorktreeManager.removeWorktree).mockResolvedValue();
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValueOnce({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockWorktreeManager.removeWorktree).toHaveBeenCalledWith('feature');
    });
  });

  describe('handleGitRepository', () => {
    it('should convert to worktree setup', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-repo' });
      vi.mocked(mockPrompts.promptForGitRepoAction).mockResolvedValue('convert');
      vi.mocked(mockGitRepository.canConvertToWorktree).mockResolvedValue({ canConvert: true });
      vi.mocked(mockPrompts.confirmAction).mockResolvedValue(true);
      vi.mocked(mockGitRepository.convertToWorktreeSetup).mockResolvedValue({
        defaultBranch: 'main',
        originalPath: '/test/path',
      });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        { path: '/test/path', branch: 'main', HEAD: 'abc123', isLocked: false, prunable: false },
      ]);
      vi.mocked(mockPrompts.promptForWorktreeAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockGitRepository.convertToWorktreeSetup).toHaveBeenCalled();
    });

    it('should handle conversion not possible', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-repo' });
      vi.mocked(mockPrompts.promptForGitRepoAction).mockResolvedValue('convert');
      vi.mocked(mockGitRepository.canConvertToWorktree).mockResolvedValue({
        canConvert: false,
        reason: 'Uncommitted changes',
      });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[ERROR] \nCannot convert: Uncommitted changes',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should continue with limited functionality', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-repo' });
      vi.mocked(mockPrompts.promptForGitRepoAction).mockResolvedValue('continue');

      vi.mocked(mockTmuxManager.getSessionName).mockReturnValue('cgwt-path-main');
      vi.mocked(mockTmuxManager.launchSession).mockResolvedValue();

      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[WARNING] \n⚠️  Proceeding with limited functionality',
      );
      expect(mockTmuxManager.launchSession).toHaveBeenCalled();
    });

    it('should exit when non-interactive', async () => {
      const app = createApp('/test/path', { interactive: false });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-repo' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[ERROR] \nError: Cannot proceed in non-interactive mode with a regular Git repository.',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handleNonGitDirectory', () => {
    it('should initialize when user confirms', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'non-git' });
      vi.mocked(mockPrompts.promptToInitialize).mockResolvedValue(true);
      vi.mocked(mockPrompts.promptForRepoUrl).mockResolvedValue(undefined);
      vi.mocked(mockGitRepository.initializeBareRepository).mockResolvedValue({
        defaultBranch: 'main',
      });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([]);
      vi.mocked(mockPrompts.promptForBranchName).mockResolvedValue('main');
      vi.mocked(mockWorktreeManager.addWorktree).mockResolvedValue('/test/path/main');
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({ type: 'quit' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockGitRepository.initializeBareRepository).toHaveBeenCalled();
    });

    it('should exit when user declines', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'non-git' });
      vi.mocked(mockPrompts.promptToInitialize).mockResolvedValue(false);

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should exit when non-interactive', async () => {
      const app = createApp('/test/path', { interactive: false });
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'non-git' });

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[ERROR] \nError: This is not a Git repository. Initialize with --repo <url> or run in an existing repository.',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should handle worktree creation failure', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([]);
      vi.mocked(mockGitRepository.getDefaultBranch).mockResolvedValue('main');
      vi.mocked(mockPrompts.promptForBranchName).mockResolvedValue('feature');
      vi.mocked(mockWorktreeManager.addWorktree).mockRejectedValue(new Error('Branch exists'));

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to create branch');
    });

    it('should handle session launch failure', async () => {
      const app = createApp('/test/path/main', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        {
          path: '/test/path/main',
          branch: 'main',
          HEAD: 'abc123',
          isLocked: false,
          prunable: false,
        },
      ]);
      vi.mocked(mockPrompts.promptForWorktreeAction).mockResolvedValue({ type: 'launch' });
      vi.mocked(mockTmuxManager.getSessionName).mockReturnValue('cgwt-test-main');
      vi.mocked(mockTmuxManager.launchSession).mockRejectedValue(new Error('Tmux not found'));

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to launch Claude');
    });

    it('should handle branch removal failure', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockResolvedValue({ type: 'git-worktree' });
      vi.mocked(mockWorktreeManager.listWorktrees).mockResolvedValue([
        {
          path: '/test/path/main',
          branch: 'main',
          HEAD: 'abc123',
          isLocked: false,
          prunable: false,
        },
        {
          path: '/test/path/feature',
          branch: 'feature',
          HEAD: 'def456',
          isLocked: false,
          prunable: false,
        },
      ]);
      vi.mocked(mockPrompts.promptForParentAction).mockResolvedValue({
        type: 'remove',
        branch: 'feature',
      });
      vi.mocked(mockWorktreeManager.removeWorktree).mockRejectedValue(new Error('Branch locked'));

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to remove branch');
    });

    it('should handle unknown error types', async () => {
      const app = createApp('/test/path', {});
      vi.mocked(mockGitDetector.detectState).mockRejectedValue('String error');

      await expect(app.run()).rejects.toThrow('Process exit');

      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] \n✖ Error:', 'Unknown error');
    });
  });
});
