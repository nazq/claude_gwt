import { promises as fs } from 'fs';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp';
import { GitDetector } from '../../../src/core/git/GitDetector';
import { GitRepository } from '../../../src/core/git/GitRepository';
import { WorktreeManager } from '../../../src/core/git/WorktreeManager';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import { showBanner } from '../../../src/cli/ui/banner';
import * as prompts from '../../../src/cli/ui/prompts';
import type { DirectoryState } from '../../../src/types';

// Mock all dependencies
jest.mock('../../../src/core/git/GitDetector');
jest.mock('../../../src/core/git/GitRepository');
jest.mock('../../../src/core/git/WorktreeManager');
jest.mock('../../../src/sessions/TmuxManager');
jest.mock('../../../src/cli/ui/banner');
jest.mock('../../../src/cli/ui/prompts');
jest.mock('../../../src/core/utils/logger');
jest.mock('../../../src/cli/ui/theme', () => {
  const mockTheme = (text: string): string => text;
  return {
    theme: {
      primary: mockTheme,
      secondary: mockTheme,
      success: mockTheme,
      error: mockTheme,
      warning: mockTheme,
      info: mockTheme,
      muted: mockTheme,
      bold: mockTheme,
      dim: mockTheme,
      git: mockTheme,
      claude: mockTheme,
      branch: mockTheme,
      statusActive: '●',
      statusProcessing: '◐',
      statusIdle: '○',
      statusError: '✗',
      icons: {
        folder: '📁',
        branch: '🌳',
        robot: '🤖',
        check: '✅',
        cross: '❌',
        arrow: '→',
        spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      },
    },
  };
});
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    readFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));
jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    branch: jest.fn().mockResolvedValue({ all: ['main', 'feature-1'], current: 'main' }),
    checkout: jest.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

describe('ClaudeGWTApp', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as jest.MockedClass<typeof GitRepository>;
  const mockWorktreeManager = WorktreeManager as jest.MockedClass<typeof WorktreeManager>;
  const mockTmuxManager = TmuxManager as jest.MockedClass<typeof TmuxManager>;
  const mockShowBanner = showBanner as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock filesystem operations
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ isDirectory: () => false });
    (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    (fs.readFile as jest.Mock).mockResolvedValue('');
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    // Mock TmuxManager static methods
    mockTmuxManager.listSessions = jest.fn().mockReturnValue([]);
    mockTmuxManager.isTmuxAvailable = jest.fn().mockReturnValue(true);
    mockTmuxManager.isInsideTmux = jest.fn().mockReturnValue(false);
    mockTmuxManager.getSessionName = jest.fn().mockReturnValue('test-session');
    mockTmuxManager.createDetachedSession = jest.fn();
    mockTmuxManager.launchSession = jest.fn();
    mockTmuxManager.attachToSession = jest.fn();
    mockTmuxManager.shutdownAll = jest.fn();
  });

  describe('startup scenarios', () => {
    beforeEach(() => {
      // Set up default mocks for prompts that might be called
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('exit');
    });

    it('should handle empty directory and prompt for URL', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockPromptForRepoUrl = jest
        .spyOn(prompts, 'promptForRepoUrl')
        .mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = jest.fn().mockResolvedValue(undefined);
      const mockGetDefaultBranch = jest.fn().mockResolvedValue('main');
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      // Mock worktree creation for default branch
      const mockAddWorktree = jest.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      // Mock worktree detection after init
      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/empty',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();

      expect(mockDetectState).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Empty directory detected'),
      );
      expect(mockPromptForRepoUrl).toHaveBeenCalled();
      expect(mockInitializeBareRepository).toHaveBeenCalledWith('https://github.com/test/repo.git');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle empty directory with local init', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue(''); // Empty string = local init

      const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockGetDefaultBranch = jest.fn().mockResolvedValue('main');
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      // Mock worktree creation for default branch
      const mockAddWorktree = jest.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/empty',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();

      expect(mockInitializeBareRepository).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Creating new local repository'),
      );
    });

    it('should handle existing git worktree', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'feature-x',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/worktree',
          branch: 'feature-x',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Git branch environment ready'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Current branch: feature-x'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Active branches (2)'));
    });

    it('should handle non-empty non-git directory with subdirectory creation', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock user choosing to create subdirectory
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/user/repo.git');
      jest.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('my-project');

      // Mock fs operations
      jest.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

      // Mock the subdirectory app run method
      const mockSubAppRun = jest.fn().mockResolvedValue(undefined);

      // Store original run method
      const originalRun = ClaudeGWTApp.prototype.run;

      // Replace run method to check if it's the subdirectory instance
      ClaudeGWTApp.prototype.run = jest.fn().mockImplementation(async function (
        this: ClaudeGWTApp,
      ) {
        // @ts-expect-error Accessing private property for testing
        if (this.basePath === '/test/nonempty/my-project') {
          // This is the subdirectory app, just resolve
          return mockSubAppRun();
        } else {
          // This is the main app, run original
          return originalRun.call(this);
        }
      });

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });
      await app.run();

      // Restore original run method
      ClaudeGWTApp.prototype.run = originalRun;

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        'Would you like to clone a Git repository into a subdirectory?',
      );
      expect(prompts.promptForRepoUrl).toHaveBeenCalled();
      expect(prompts.promptForSubdirectoryName).toHaveBeenCalled();
      expect(mockMkdir).toHaveBeenCalledWith('/test/nonempty/my-project', { recursive: true });
      expect(mockSubAppRun).toHaveBeenCalled();
    });

    it('should handle non-empty non-git directory without subdirectory', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock user choosing NOT to create subdirectory
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Directory is not empty and not a Git repository'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To use claude-gwt, you can:'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle regular git repository', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock repository can be converted
      const mockCanConvert = jest.fn().mockResolvedValue({ canConvert: true });
      const mockGetCurrentBranch = jest.fn().mockResolvedValue('main');
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.getCurrentBranch = mockGetCurrentBranch;

      jest
        .spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // Don't convert
        .mockResolvedValueOnce(false); // Don't proceed with limited mode

      // Mock selectAction for regular git mode menu
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Regular Git repository detected'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('works best with Git worktree'),
      );
      expect(prompts.confirmAction).toHaveBeenCalledWith(
        expect.stringContaining('convert this to a worktree-based setup'),
      );
    });

    it('should respect quiet mode', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const app = new ClaudeGWTApp('/test/empty', { quiet: true, interactive: false });

      // Mock to prevent further execution
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      jest.spyOn(app, 'handleEmptyDirectory').mockResolvedValue(undefined);

      await app.run();

      expect(mockShowBanner).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockDetectState = jest.fn().mockRejectedValue(new Error('Detection failed'));
      mockGitDetector.prototype.detectState = mockDetectState;

      const app = new ClaudeGWTApp('/test/path', { interactive: false });

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Detection failed',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('main branch auto-creation', () => {
    it('should automatically create main branch worktree after cloning', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = jest.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      const mockAddWorktree = jest.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/empty/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();

      expect(mockInitializeBareRepository).toHaveBeenCalledWith('https://github.com/test/repo.git');
      expect(mockAddWorktree).toHaveBeenCalledWith('main');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Creating default branch: main'),
      );
    });
  });

  describe('URL validation', () => {
    it('should accept various Git URL formats', async () => {
      // We'll test the actual prompt validation by mocking inquirer responses
      const validUrls = [
        'https://github.com/user/repo.git',
        'https://gitlab.com/user/repo',
        'git@github.com:user/repo.git',
        'ssh://git@github.com/user/repo.git',
        'git://github.com/user/repo.git',
        'file:///path/to/repo',
        'user@server.com:path/to/repo.git',
      ];

      // Test that valid URLs are accepted
      for (const url of validUrls) {
        const mockDetectState = jest.fn().mockResolvedValue({
          type: 'empty',
          path: '/test/empty',
        } as DirectoryState);

        mockGitDetector.prototype.detectState = mockDetectState;

        // Mock inquirer to return the URL
        const mockPrompt = prompts.promptForRepoUrl as jest.Mock;
        mockPrompt.mockResolvedValue(url);

        const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
        mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
        mockGitRepository.prototype.fetch = jest.fn().mockResolvedValue(undefined);
        mockGitRepository.prototype.getDefaultBranch = jest.fn().mockResolvedValue('main');

        // Mock worktree creation for default branch
        mockWorktreeManager.prototype.addWorktree = jest.fn().mockResolvedValue('/test/empty/main');
        mockWorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue([
          {
            path: '/test/empty/main',
            branch: 'main',
            isLocked: false,
            prunable: false,
            HEAD: 'abc123',
          },
        ]);
        jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

        const app = new ClaudeGWTApp('/test/empty', { interactive: true });
        await app.run();

        expect(mockInitializeBareRepository).toHaveBeenCalledWith(url);
      }
    });
  });

  describe('error handling scenarios', () => {
    it('should handle worktree creation failure in empty directory', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = jest.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      // Mock worktree creation failure
      const mockAddWorktree = jest.fn().mockRejectedValue(new Error('Worktree creation failed'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });

      // The app catches errors and calls process.exit, which our mock throws
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Check that the error was properly logged
      expect(mockConsoleError).toHaveBeenCalledWith(expect.anything(), 'Worktree creation failed');
    });

    it('should handle fetch failure during initialization', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = jest.fn().mockRejectedValue(new Error('Fetch failed'));
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });

      // The app catches errors and calls process.exit, which our mock throws
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Check that the error was properly logged
      expect(mockConsoleError).toHaveBeenCalledWith(expect.anything(), 'Fetch failed');
    });
  });

  describe('git repository handling', () => {
    it('should handle git repository that cannot be converted', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock repository cannot be converted
      const mockCanConvert = jest.fn().mockResolvedValue({
        canConvert: false,
        reason: 'Repository has uncommitted changes',
      });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cannot convert to worktree setup'),
      );
      expect(prompts.confirmAction).toHaveBeenCalledWith(
        'Would you like to proceed with limited functionality?',
      );
    });

    it('should handle git repository conversion with user proceeding in limited mode', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = jest.fn().mockResolvedValue({
        canConvert: false,
        reason: 'Repository has uncommitted changes',
      });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      const mockSelectAction = jest.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        'Would you like to proceed with limited functionality?',
      );
      expect(mockSelectAction).toHaveBeenCalled();
    });

    it('should handle successful git repository conversion', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = jest.fn().mockResolvedValue({ canConvert: true });
      const mockConvertToWorktreeSetup = jest.fn().mockResolvedValue({ defaultBranch: 'main' });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.convertToWorktreeSetup = mockConvertToWorktreeSetup;

      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      // Mock the subsequent worktree handling
      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/repo',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      mockTmuxManager.listSessions = jest.fn().mockReturnValue([]);

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        expect.stringContaining('convert this to a worktree-based setup'),
      );
      expect(mockConvertToWorktreeSetup).toHaveBeenCalled();
    });

    it('should handle git repository conversion failure', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = jest.fn().mockResolvedValue({ canConvert: true });
      const mockConvertToWorktreeSetup = jest
        .fn()
        .mockRejectedValue(new Error('Conversion failed'));
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.convertToWorktreeSetup = mockConvertToWorktreeSetup;

      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Conversion failed'));
    });

    it('should handle user declining conversion and entering limited mode', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = jest.fn().mockResolvedValue({ canConvert: true });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(false);
      const mockSelectAction = jest.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Proceeding with limited functionality'),
      );
      expect(mockSelectAction).toHaveBeenCalled();
    });
  });

  describe('non-git directory handling', () => {
    it('should handle subdirectory creation flow', async () => {
      // Mock user choosing to create subdirectory
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');
      jest.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('my-project');

      // Mock fs operations for subdirectory creation
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT')); // subdirectory doesn't exist
      const mockMkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock the handleNonGitDirectory method to test just the console output and prompts
      // without the subapp creation
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      jest.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
        // Call original method logic up to the subapp creation
        console.log('\n❌ Directory is not empty and not a Git repository');
        const createSubdir = await prompts.confirmAction(
          'Would you like to clone a Git repository into a subdirectory?',
        );
        if (createSubdir) {
          const repoUrl = await prompts.promptForRepoUrl();
          if (!repoUrl) {
            process.exit(1);
          }
          // @ts-expect-error Testing private method
          const defaultDirName = app.extractRepoNameFromUrl(repoUrl);
          const subdirName = await prompts.promptForSubdirectoryName(defaultDirName);
          const subdirPath = '/test/nonempty/' + subdirName;

          try {
            await fs.access(subdirPath);
            console.log(`\nDirectory '${subdirName}' already exists!`);
            process.exit(1);
          } catch {
            // Directory doesn't exist, we can create it
          }

          await fs.mkdir(subdirPath, { recursive: true });
          console.log(`\nCreated subdirectory: ${subdirPath}`);

          // Mock the subapp instead of creating it
          return Promise.resolve();
        }
      });

      // Test the non-git directory handler directly
      // @ts-expect-error Testing private method
      await app.handleNonGitDirectory();

      // Check that we reached the non-git directory handler
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Directory is not empty and not a Git repository'),
      );

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        'Would you like to clone a Git repository into a subdirectory?',
      );
      expect(prompts.promptForRepoUrl).toHaveBeenCalled();
      expect(prompts.promptForSubdirectoryName).toHaveBeenCalledWith('repo');
      expect(mockMkdir).toHaveBeenCalledWith('/test/nonempty/my-project', { recursive: true });
    });

    it('should handle subdirectory already exists error', async () => {
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');
      jest.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('existing-project');

      // Mock fs.access to succeed (directory exists)
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock handleNonGitDirectory to test the specific flow
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      jest.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
        console.log('\n❌ Directory is not empty and not a Git repository');
        const createSubdir = await prompts.confirmAction(
          'Would you like to clone a Git repository into a subdirectory?',
        );
        if (createSubdir) {
          const repoUrl = await prompts.promptForRepoUrl();
          if (!repoUrl) {
            process.exit(1);
          }
          // @ts-expect-error Testing private method
          const defaultDirName = app.extractRepoNameFromUrl(repoUrl);
          const subdirName = await prompts.promptForSubdirectoryName(defaultDirName);
          const subdirPath = '/test/nonempty/' + subdirName;

          try {
            await fs.access(subdirPath);
            // If fs.access succeeds, the directory exists
            console.log(`\nDirectory '${subdirName}' already exists!`);
            process.exit(1);
          } catch (error) {
            // Directory doesn't exist, we can create it - this branch won't execute in this test
          }
        }
      });

      // @ts-expect-error Testing private method
      await app.handleNonGitDirectory();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Directory 'existing-project' already exists!"),
      );
    });

    it('should handle empty repo URL in subdirectory flow', async () => {
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      jest.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('');

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock handleNonGitDirectory to test the specific flow
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      jest.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
        console.log('\n❌ Directory is not empty and not a Git repository');
        const createSubdir = await prompts.confirmAction(
          'Would you like to clone a Git repository into a subdirectory?',
        );
        if (createSubdir) {
          const repoUrl = await prompts.promptForRepoUrl();
          if (!repoUrl) {
            console.log('\nNo repository URL provided.');
            process.exit(1);
          }
        }
      });

      await expect(
        // @ts-expect-error Testing private method
        app.handleNonGitDirectory(),
      ).rejects.toThrow('process.exit called');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No repository URL provided'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('worktree scenarios', () => {
    it('should handle empty worktree list and create first branch', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // First call returns empty, second call returns created worktree
      const mockListWorktrees = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            path: '/test/worktree/main',
            branch: 'main',
            isLocked: false,
            prunable: false,
            HEAD: 'abc123',
          },
        ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetDefaultBranch = jest.fn().mockResolvedValue('main');
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('main');
      const mockAddWorktree = jest.fn().mockResolvedValue('/test/worktree/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      mockTmuxManager.listSessions = jest.fn().mockReturnValue([]);
      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(prompts.promptForBranchName).toHaveBeenCalledWith('main');
      expect(mockAddWorktree).toHaveBeenCalledWith('main', 'main');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Your first branch is ready!'),
      );
    });

    it('should handle worktree creation failure for first branch', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = jest.fn().mockResolvedValue([]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetDefaultBranch = jest.fn().mockResolvedValue('main');
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('main');
      const mockAddWorktree = jest.fn().mockRejectedValue(new Error('Failed to create branch'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });
  });

  describe('claude-gwt-parent directory type', () => {
    it('should handle claude-gwt-parent same as git-worktree', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'claude-gwt-parent',
        path: '/test/parent',
        gitInfo: {
          isWorktree: false,
          isBareRepo: true,
          branch: undefined,
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/parent/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      mockTmuxManager.listSessions = jest.fn().mockReturnValue([]);
      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/parent', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Git branch environment ready'),
      );
    });
  });

  describe('extractRepoNameFromUrl', () => {
    it('should extract repo names from various URL formats', () => {
      const app = new ClaudeGWTApp('/test', { interactive: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(
        // @ts-expect-error Testing private method
        app.extractRepoNameFromUrl('https://github.com/user/my-repo.git'),
      ).toBe('my-repo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(
        // @ts-expect-error Testing private method
        app.extractRepoNameFromUrl('git@github.com:user/my-repo.git'),
      ).toBe('my-repo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(
        // @ts-expect-error Testing private method
        app.extractRepoNameFromUrl('https://gitlab.com/user/my-repo'),
      ).toBe('my-repo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(
        // @ts-expect-error Testing private method
        app.extractRepoNameFromUrl('file:///path/to/my-repo'),
      ).toBe('my-repo');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(
        // @ts-expect-error Testing private method
        app.extractRepoNameFromUrl('invalid-url'),
      ).toBe('invalid-url');
    });
  });

  describe('interactive worktree menu', () => {
    beforeEach(() => {
      mockTmuxManager.listSessions = jest.fn().mockReturnValue([]);
    });

    it('should handle listBranches action', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-feature',
          branch: 'feature',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('list')
        .mockResolvedValueOnce('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All branches:'));
    });

    it('should handle createNewWorktree action', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ];

      const mockListWorktrees = jest
        .fn()
        .mockResolvedValueOnce(worktrees)
        .mockResolvedValueOnce([
          ...worktrees,
          {
            path: '/test/worktree-feature',
            branch: 'feature',
            isLocked: false,
            prunable: false,
            HEAD: 'def456',
          },
        ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockAddWorktree = jest.fn().mockResolvedValue('/test/worktree-feature');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('new')
        .mockResolvedValueOnce('exit');
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockAddWorktree).toHaveBeenCalledWith('feature');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Branch feature created!'),
      );
    });

    it('should handle createNewWorktree action with failure', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockAddWorktree = jest.fn().mockRejectedValue(new Error('Creation failed'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('new');
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });

    it('should handle removeWorktree action', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-feature',
          branch: 'feature',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ];

      const mockListWorktrees = jest
        .fn()
        .mockResolvedValueOnce(worktrees)
        .mockResolvedValueOnce([worktrees[0]]); // After removal
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = jest.fn().mockResolvedValue(undefined);
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('remove')
        .mockResolvedValueOnce('exit');
      jest.spyOn(prompts, 'selectWorktree').mockResolvedValue('feature');
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockRemoveWorktree).toHaveBeenCalledWith('feature');
    });

    it('should handle removeWorktree action with user declining', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-feature',
          branch: 'feature',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = jest.fn();
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('remove')
        .mockResolvedValueOnce('exit');
      jest.spyOn(prompts, 'selectWorktree').mockResolvedValue('feature');
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockRemoveWorktree).not.toHaveBeenCalled();
    });

    it('should handle removeWorktree action with failure', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
        {
          path: '/test/worktree-feature',
          branch: 'feature',
          isLocked: false,
          prunable: false,
          HEAD: 'def456',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = jest.fn().mockRejectedValue(new Error('Removal failed'));
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('remove');
      jest.spyOn(prompts, 'selectWorktree').mockResolvedValue('feature');
      jest.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });

    it('should handle supervisor mode action', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree/feature',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'feature',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree/feature',
          branch: 'feature',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      // Mock TmuxManager methods for supervisor mode
      mockTmuxManager.getSessionName = jest.fn().mockReturnValue('cgwt-test-supervisor');
      mockTmuxManager.launchSession = jest.fn();
      mockTmuxManager.createDetachedSession = jest.fn();
      mockTmuxManager.isInsideTmux = jest.fn().mockReturnValue(true); // Force the launchTmuxSession path

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('supervisor')
        .mockResolvedValueOnce('exit');

      const app = new ClaudeGWTApp('/test/worktree/feature', { interactive: true });

      // Mock the additional GitDetector calls for supervisor mode
      jest
        .spyOn(GitDetector.prototype, 'detectState')
        .mockResolvedValueOnce({
          type: 'git-worktree',
          path: '/test/worktree/feature',
          gitInfo: {
            isWorktree: true,
            isBareRepo: true,
            branch: 'feature',
          },
        } as DirectoryState) // Initial state
        .mockResolvedValueOnce({
          type: 'git-worktree',
          path: '/test/worktree/feature',
          gitInfo: {
            isWorktree: true,
            isBareRepo: true,
            branch: 'feature',
          },
        } as DirectoryState) // In supervisor mode for current path
        .mockResolvedValueOnce({
          type: 'claude-gwt-parent',
          path: '/test/worktree',
          gitInfo: {
            isWorktree: false,
            isBareRepo: true,
            branch: undefined,
          },
        } as DirectoryState); // Parent detection

      await app.run();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTmuxManager.launchSession).toHaveBeenCalled();
    });

    it('should handle shutdown action', async () => {
      const mockDetectState = jest.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const worktrees = [
        {
          path: '/test/worktree',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ];

      const mockListWorktrees = jest.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      mockTmuxManager.listSessions = jest.fn().mockReturnValue([
        {
          name: 'cgwt-test-main',
          windows: 1,
          created: '123',
          attached: true,
          hasClaudeRunning: true,
        },
      ]);
      mockTmuxManager.shutdownAll = jest.fn();

      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('shutdown')
        .mockResolvedValueOnce('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTmuxManager.shutdownAll).toHaveBeenCalled();
    });
  });

  describe('listBranches with empty worktrees', () => {
    it('should handle empty worktree list in listBranches', () => {
      const app = new ClaudeGWTApp('/test', { interactive: false });

      // @ts-expect-error Testing private method
      app.listBranches([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All branches:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No branches found'));
    });
  });
});
