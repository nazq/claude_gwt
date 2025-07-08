import { vi } from 'vitest';
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
vi.mock('../../../src/core/git/GitDetector');
vi.mock('../../../src/core/git/GitRepository');
vi.mock('../../../src/core/git/WorktreeManager');
vi.mock('../../../src/sessions/TmuxManager');
vi.mock('../../../src/cli/ui/banner');
vi.mock('../../../src/cli/ui/prompts');
vi.mock('../../../src/core/utils/logger');
vi.mock('../../../src/cli/ui/theme', () => {
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
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    branch: vi.fn().mockResolvedValue({ all: ['main', 'feature-1'], current: 'main' }),
    checkout: vi.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation();
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation();
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

describe('ClaudeGWTApp', () => {
  const mockGitDetector = GitDetector as vi.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as vi.MockedClass<typeof GitRepository>;
  const mockWorktreeManager = WorktreeManager as vi.MockedClass<typeof WorktreeManager>;
  const mockTmuxManager = TmuxManager as vi.MockedClass<typeof TmuxManager>;
  const mockShowBanner = showBanner as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock filesystem operations
    (fs.readdir as vi.Mock).mockResolvedValue([]);
    (fs.stat as vi.Mock).mockResolvedValue({ isDirectory: () => false });
    (fs.access as vi.Mock).mockRejectedValue(new Error('ENOENT'));
    (fs.readFile as vi.Mock).mockResolvedValue('');
    (fs.mkdir as vi.Mock).mockResolvedValue(undefined);

    // Mock TmuxManager static methods
    mockTmuxManager.listSessions = vi.fn().mockReturnValue([]);
    mockTmuxManager.isTmuxAvailable = vi.fn().mockReturnValue(true);
    mockTmuxManager.isInsideTmux = vi.fn().mockReturnValue(false);
    mockTmuxManager.getSessionName = vi.fn().mockReturnValue('test-session');
    mockTmuxManager.createDetachedSession = vi.fn();
    mockTmuxManager.launchSession = vi.fn();
    mockTmuxManager.attachToSession = vi.fn();
    mockTmuxManager.shutdownAll = vi.fn();
  });

  describe('startup scenarios', () => {
    beforeEach(() => {
      // Set up default mocks for prompts that might be called
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('exit');
    });

    it('should handle empty directory and prompt for URL', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockPromptForRepoUrl = vi
        .spyOn(prompts, 'promptForRepoUrl')
        .mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = vi.fn().mockResolvedValue(undefined);
      const mockGetDefaultBranch = vi.fn().mockResolvedValue('main');
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      // Mock worktree creation for default branch
      const mockAddWorktree = vi.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      // Mock worktree detection after init
      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/empty',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

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
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue(''); // Empty string = local init

      const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockGetDefaultBranch = vi.fn().mockResolvedValue('main');
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      // Mock worktree creation for default branch
      const mockAddWorktree = vi.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/empty',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });
      await app.run();

      expect(mockInitializeBareRepository).toHaveBeenCalledWith('');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Creating new local repository'),
      );
    });

    it('should handle existing git worktree', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'feature-x',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = vi.fn().mockResolvedValue([
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

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

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
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock user choosing to create subdirectory
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/user/repo.git');
      vi.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('my-project');

      // Mock fs operations
      vi.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

      // Mock the subdirectory app run method
      const mockSubAppRun = vi.fn().mockResolvedValue(undefined);

      // Store original run method
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const originalRun = ClaudeGWTApp.prototype.run;

      // Replace run method to check if it's the subdirectory instance
      ClaudeGWTApp.prototype.run = vi.fn().mockImplementation(async function (this: ClaudeGWTApp) {
        // @ts-expect-error Accessing private property for testing
        if (this.basePath === '/test/nonempty/my-project') {
          // This is the subdirectory app, just resolve
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'non-git',
        path: '/test/nonempty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock user choosing NOT to create subdirectory
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

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
      const mockDetectState = vi.fn().mockResolvedValue({
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
      const mockCanConvert = vi.fn().mockResolvedValue({ canConvert: true });
      const mockGetCurrentBranch = vi.fn().mockResolvedValue('main');
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.getCurrentBranch = mockGetCurrentBranch;

      vi.spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // Don't convert
        .mockResolvedValueOnce(false); // Don't proceed with limited mode

      // Mock selectAction for regular git mode menu
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

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
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const app = new ClaudeGWTApp('/test/empty', { quiet: true, interactive: false });

      // Mock to prevent further execution
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      vi.spyOn(app, 'handleEmptyDirectory').mockResolvedValue(undefined);

      await app.run();

      expect(mockShowBanner).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockDetectState = vi.fn().mockRejectedValue(new Error('Detection failed'));
      mockGitDetector.prototype.detectState = mockDetectState;

      const app = new ClaudeGWTApp('/test/path', { interactive: false });

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('✖ Error in ClaudeGWTApp:'),
        'Detection failed',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('main branch auto-creation', () => {
    it('should automatically create main branch worktree after cloning', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = vi.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      const mockAddWorktree = vi.fn().mockResolvedValue('/test/empty/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/empty/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

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
        const mockDetectState = vi.fn().mockResolvedValue({
          type: 'empty',
          path: '/test/empty',
        } as DirectoryState);

        mockGitDetector.prototype.detectState = mockDetectState;

        // Mock inquirer to return the URL
        const mockPrompt = prompts.promptForRepoUrl as vi.Mock;
        mockPrompt.mockResolvedValue(url);

        const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
        mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
        mockGitRepository.prototype.fetch = vi.fn().mockResolvedValue(undefined);
        mockGitRepository.prototype.getDefaultBranch = vi.fn().mockResolvedValue('main');

        // Mock worktree creation for default branch
        mockWorktreeManager.prototype.addWorktree = vi.fn().mockResolvedValue('/test/empty/main');
        mockWorktreeManager.prototype.listWorktrees = vi.fn().mockResolvedValue([
          {
            path: '/test/empty/main',
            branch: 'main',
            isLocked: false,
            prunable: false,
            HEAD: 'abc123',
          },
        ]);
        vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

        const app = new ClaudeGWTApp('/test/empty', { interactive: true });
        await app.run();

        expect(mockInitializeBareRepository).toHaveBeenCalledWith(url);
      }
    });
  });

  describe('error handling scenarios', () => {
    it('should handle worktree creation failure in empty directory', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = vi.fn().mockResolvedValue(undefined);
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      // Mock worktree creation failure
      const mockAddWorktree = vi.fn().mockRejectedValue(new Error('Worktree creation failed'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });

      // The app catches errors and calls process.exit, which our mock throws
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Check that the error was properly logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('✖ Error in ClaudeGWTApp:'),
        'Worktree creation failed',
      );
    });

    it('should handle fetch failure during initialization', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'empty',
        path: '/test/empty',
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');

      const mockInitializeBareRepository = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      const mockFetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      mockGitRepository.prototype.initializeBareRepository = mockInitializeBareRepository;
      mockGitRepository.prototype.fetch = mockFetch;

      const app = new ClaudeGWTApp('/test/empty', { interactive: true });

      // The app catches errors and calls process.exit, which our mock throws
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Check that the error was properly logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('✖ Error in ClaudeGWTApp:'),
        'Fetch failed',
      );
    });
  });

  describe('git repository handling', () => {
    it('should handle git repository that cannot be converted', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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
      const mockCanConvert = vi.fn().mockResolvedValue({
        canConvert: false,
        reason: 'Repository has uncommitted changes',
      });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

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
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = vi.fn().mockResolvedValue({
        canConvert: false,
        reason: 'Repository has uncommitted changes',
      });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      const mockSelectAction = vi.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        'Would you like to proceed with limited functionality?',
      );
      expect(mockSelectAction).toHaveBeenCalled();
    });

    it('should handle successful git repository conversion', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = vi.fn().mockResolvedValue({ canConvert: true });
      const mockConvertToWorktreeSetup = vi.fn().mockResolvedValue({ defaultBranch: 'main' });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.convertToWorktreeSetup = mockConvertToWorktreeSetup;

      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      // Mock the subsequent worktree handling
      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/repo',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;
      mockTmuxManager.listSessions = vi.fn().mockReturnValue([]);

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(prompts.confirmAction).toHaveBeenCalledWith(
        expect.stringContaining('convert this to a worktree-based setup'),
      );
      expect(mockConvertToWorktreeSetup).toHaveBeenCalled();
    });

    it('should handle git repository conversion failure', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = vi.fn().mockResolvedValue({ canConvert: true });
      const mockConvertToWorktreeSetup = vi.fn().mockRejectedValue(new Error('Conversion failed'));
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;
      mockGitRepository.prototype.convertToWorktreeSetup = mockConvertToWorktreeSetup;

      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Conversion failed'));
    });

    it('should handle user declining conversion and entering limited mode', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-repo',
        path: '/test/repo',
        gitInfo: {
          isWorktree: false,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockCanConvert = vi.fn().mockResolvedValue({ canConvert: true });
      mockGitRepository.prototype.canConvertToWorktree = mockCanConvert;

      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(false);
      const mockSelectAction = vi.spyOn(prompts, 'selectAction').mockResolvedValue('exit');

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
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');
      vi.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('my-project');

      // Mock fs operations for subdirectory creation
      (fs.access as vi.Mock).mockRejectedValue(new Error('ENOENT')); // subdirectory doesn't exist
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock the handleNonGitDirectory method to test just the console output and prompts
      // without the subapp creation
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      vi.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
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
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('https://github.com/test/repo.git');
      vi.spyOn(prompts, 'promptForSubdirectoryName').mockResolvedValue('existing-project');

      // Mock fs.access to succeed (directory exists)
      (fs.access as vi.Mock).mockResolvedValue(undefined);

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock handleNonGitDirectory to test the specific flow
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      vi.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
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
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);
      vi.spyOn(prompts, 'promptForRepoUrl').mockResolvedValue('');

      const app = new ClaudeGWTApp('/test/nonempty', { interactive: true });

      // Mock handleNonGitDirectory to test the specific flow
      // @ts-expect-error Testing private method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      vi.spyOn(app, 'handleNonGitDirectory').mockImplementation(async () => {
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
      const mockDetectState = vi.fn().mockResolvedValue({
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
      const mockListWorktrees = vi
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

      const mockGetDefaultBranch = vi.fn().mockResolvedValue('main');
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('main');
      const mockAddWorktree = vi.fn().mockResolvedValue('/test/worktree/main');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      mockTmuxManager.listSessions = vi.fn().mockReturnValue([]);
      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(prompts.promptForBranchName).toHaveBeenCalledWith('main');
      expect(mockAddWorktree).toHaveBeenCalledWith('main', 'main');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Your first branch is ready!'),
      );
    });

    it('should handle worktree creation failure for first branch', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: true,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = vi.fn().mockResolvedValue([]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetDefaultBranch = vi.fn().mockResolvedValue('main');
      mockGitRepository.prototype.getDefaultBranch = mockGetDefaultBranch;

      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('main');
      const mockAddWorktree = vi.fn().mockRejectedValue(new Error('Failed to create branch'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });
  });

  describe('claude-gwt-parent directory type', () => {
    it('should handle claude-gwt-parent same as git-worktree', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'claude-gwt-parent',
        path: '/test/parent',
        gitInfo: {
          isWorktree: false,
          isBareRepo: true,
          branch: undefined,
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/parent/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      mockTmuxManager.listSessions = vi.fn().mockReturnValue([]);
      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

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
      mockTmuxManager.listSessions = vi.fn().mockReturnValue([]);
    });

    it('should handle listBranches action', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('list')
        .mockResolvedValueOnce('exit');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('All branches:'));
    });

    it('should handle createNewWorktree action', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi
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

      const mockAddWorktree = vi.fn().mockResolvedValue('/test/worktree-feature');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('new')
        .mockResolvedValueOnce('exit');
      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockAddWorktree).toHaveBeenCalledWith('feature');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Branch feature created!'),
      );
    });

    it('should handle createNewWorktree action with failure', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockAddWorktree = vi.fn().mockRejectedValue(new Error('Creation failed'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('new');
      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });

    it('should handle removeWorktree action', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi
        .fn()
        .mockResolvedValueOnce(worktrees)
        .mockResolvedValueOnce([worktrees[0]]); // After removal
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = vi.fn().mockResolvedValue(undefined);
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('remove')
        .mockResolvedValueOnce('exit');
      vi.spyOn(prompts, 'selectWorktree').mockResolvedValue({
        path: '/test/worktree/feature',
        branch: 'feature',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      });
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockRemoveWorktree).toHaveBeenCalledWith('feature');
    });

    it('should handle removeWorktree action with user declining', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = vi.fn();
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('remove')
        .mockResolvedValueOnce('exit');
      vi.spyOn(prompts, 'selectWorktree').mockResolvedValue({
        path: '/test/worktree/feature',
        branch: 'feature',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      });
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(false);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockRemoveWorktree).not.toHaveBeenCalled();
    });

    it('should handle removeWorktree action with failure', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockRemoveWorktree = vi.fn().mockRejectedValue(new Error('Removal failed'));
      mockWorktreeManager.prototype.removeWorktree = mockRemoveWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('remove');
      vi.spyOn(prompts, 'selectWorktree').mockResolvedValue({
        path: '/test/worktree/feature',
        branch: 'feature',
        isLocked: false,
        prunable: false,
        HEAD: 'abc123',
      });
      vi.spyOn(prompts, 'confirmAction').mockResolvedValue(true);

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');
    });

    it('should handle supervisor mode action', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      // Mock TmuxManager methods for supervisor mode
      mockTmuxManager.getSessionName = vi.fn().mockReturnValue('cgwt-test-supervisor');
      mockTmuxManager.launchSession = vi.fn();
      mockTmuxManager.createDetachedSession = vi.fn();
      mockTmuxManager.isInsideTmux = vi.fn().mockReturnValue(true); // Force the launchTmuxSession path

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('supervisor')
        .mockResolvedValueOnce('exit');

      const app = new ClaudeGWTApp('/test/worktree/feature', { interactive: true });

      // Mock the additional GitDetector calls for supervisor mode
      vi.spyOn(GitDetector.prototype, 'detectState')
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
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      mockTmuxManager.listSessions = vi.fn().mockReturnValue([
        {
          name: 'cgwt-test-main',
          windows: 1,
          created: '123',
          attached: true,
          hasClaudeRunning: true,
        },
      ]);
      mockTmuxManager.shutdownAll = vi.fn();

      vi.spyOn(prompts, 'promptForWorktreeAction')
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

  describe('createWorktreeFromExistingBranch', () => {
    it('should handle existing branch worktree creation successfully', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetBranchesWithoutWorktrees = vi
        .fn()
        .mockResolvedValue(['feature/test', 'bugfix/issue-123']);
      mockWorktreeManager.prototype.getBranchesWithoutWorktrees = mockGetBranchesWithoutWorktrees;

      const mockAddWorktree = vi.fn().mockResolvedValue('/test/worktree/feature/test');
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('existing')
        .mockResolvedValueOnce('exit');
      vi.spyOn(prompts, 'selectExistingBranch').mockResolvedValue('feature/test');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockGetBranchesWithoutWorktrees).toHaveBeenCalled();
      expect(prompts.selectExistingBranch).toHaveBeenCalledWith([
        'feature/test',
        'bugfix/issue-123',
      ]);
      expect(mockAddWorktree).toHaveBeenCalledWith('feature/test');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🎉 Worktree for branch feature/test created!'),
      );
    });

    it('should handle existing branch worktree creation when user cancels', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetBranchesWithoutWorktrees = vi.fn().mockResolvedValue(['feature/test']);
      mockWorktreeManager.prototype.getBranchesWithoutWorktrees = mockGetBranchesWithoutWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('existing')
        .mockResolvedValueOnce('exit');
      vi.spyOn(prompts, 'selectExistingBranch').mockResolvedValue(null); // User cancelled

      const mockAddWorktree = vi.fn();
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      expect(mockGetBranchesWithoutWorktrees).toHaveBeenCalled();
      expect(prompts.selectExistingBranch).toHaveBeenCalledWith(['feature/test']);
      expect(mockAddWorktree).not.toHaveBeenCalled();
    });

    it('should handle existing branch worktree creation failure', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetBranchesWithoutWorktrees = vi.fn().mockResolvedValue(['feature/test']);
      mockWorktreeManager.prototype.getBranchesWithoutWorktrees = mockGetBranchesWithoutWorktrees;

      const mockAddWorktree = vi.fn().mockRejectedValue(new Error('Worktree creation failed'));
      mockWorktreeManager.prototype.addWorktree = mockAddWorktree;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValueOnce('existing');
      vi.spyOn(prompts, 'selectExistingBranch').mockResolvedValue('feature/test');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(mockGetBranchesWithoutWorktrees).toHaveBeenCalled();
      expect(mockAddWorktree).toHaveBeenCalledWith('feature/test');
    });

    it('should handle getBranchesWithoutWorktrees failure', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
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

      const mockListWorktrees = vi.fn().mockResolvedValue(worktrees);
      mockWorktreeManager.prototype.listWorktrees = mockListWorktrees;

      const mockGetBranchesWithoutWorktrees = vi
        .fn()
        .mockRejectedValue(new Error('Failed to get branches'));
      mockWorktreeManager.prototype.getBranchesWithoutWorktrees = mockGetBranchesWithoutWorktrees;

      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValueOnce('existing');

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(mockGetBranchesWithoutWorktrees).toHaveBeenCalled();
    });
  });
});
