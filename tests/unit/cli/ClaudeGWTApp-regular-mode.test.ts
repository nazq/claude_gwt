import { vi } from 'vitest';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp';
import * as prompts from '../../../src/cli/ui/prompts';
import { GitDetector } from '../../../src/core/git/GitDetector';
import { GitRepository } from '../../../src/core/git/GitRepository';
import { WorktreeManager } from '../../../src/core/git/WorktreeManager';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import type { DirectoryState } from '../../../src/types';
import simpleGit from 'simple-git';

// Mock all dependencies
vi.mock('../../../src/cli/ui/banner');
vi.mock('../../../src/cli/ui/prompts');
vi.mock('../../../src/cli/ui/spinner');
vi.mock('../../../src/core/git/GitDetector');
vi.mock('../../../src/core/git/GitRepository');
vi.mock('../../../src/core/git/WorktreeManager');
vi.mock('../../../src/sessions/TmuxManager');
vi.mock('../../../src/core/utils/logger');
vi.mock('simple-git');

describe('ClaudeGWTApp - Regular Git Mode', () => {
  const mockGitDetector = GitDetector as vi.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as vi.MockedClass<typeof GitRepository>;
  const mockSimpleGit = simpleGit as vi.MockedFunction<typeof simpleGit>;
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation();
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation();
  vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as never);

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    mockConsoleLog.mockImplementation();
    mockConsoleError.mockImplementation();

    // Mock TmuxManager static methods
    vi.spyOn(TmuxManager, 'launchSession').mockResolvedValue(undefined);
    vi.spyOn(TmuxManager, 'getSessionName').mockReturnValue('cgwt-test-main');
  });

  describe('handleRegularGitMode', () => {
    it('should handle regular git mode with switch branch action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: vi.fn().mockResolvedValue(undefined),
        checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      vi.spyOn(prompts, 'selectBranch').mockResolvedValue('feature');

      // Mock decline launching supervisor
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify switch branch was called
      expect(mockGit.checkout).toHaveBeenCalledWith('feature');
    });

    it('should handle regular git mode with create branch action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion first, then confirming supervisor launch
      vi.spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // decline conversion
        .mockResolvedValueOnce(true); // confirm launching supervisor

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: vi.fn().mockResolvedValue(undefined),
        checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('new-feature');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });

      // Should run successfully
      await app.run();

      // Verify create branch was called
      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('new-feature');
      // Verify supervisor was launched
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(TmuxManager.launchSession).toHaveBeenCalled();
    });

    it('should handle regular git mode with supervisor action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock supervisor action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('supervisor');

      // Override the default mock to simulate real behavior - tmux launches and exits
      vi.spyOn(TmuxManager, 'launchSession').mockImplementation(async () => {
        process.exit(0);
      });

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });

      // Should exit after launching supervisor
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Verify supervisor was launched
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(TmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-test-main',
        workingDirectory: '/test/repo',
        branchName: 'main',
        role: 'supervisor',
      });
    });

    it('should handle regular git mode with convert action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion first time, then accepting second time
      vi.spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // decline conversion first time
        .mockResolvedValueOnce(true); // accept conversion second time

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock convert action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('convert');

      // Mock successful conversion
      mockGitRepository.prototype.convertToWorktreeSetup.mockResolvedValue({
        defaultBranch: 'main',
        originalPath: '/test/repo',
      });

      // Mock WorktreeManager for handleGitWorktree
      vi.mocked(WorktreeManager).prototype.listWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/repo/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);

      // Mock worktree action prompt to exit
      vi.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });

      // Should exit gracefully
      await app.run();

      // Verify conversion was attempted
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGitRepository.prototype.convertToWorktreeSetup).toHaveBeenCalled();
    });

    it('should handle branch switch error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: vi.fn().mockRejectedValue(new Error('Branch checkout failed')),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      vi.spyOn(prompts, 'selectBranch').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Branch checkout failed'),
      );
    });

    it('should handle create branch error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkoutLocalBranch: vi.fn().mockRejectedValue(new Error('Branch already exists')),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('existing-branch');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Branch already exists'),
      );
    });

    it('should handle empty branch name in create action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkoutLocalBranch: vi.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action with empty name
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      vi.spyOn(prompts, 'promptForBranchName').mockResolvedValue('');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify no branch creation was attempted
      expect(mockGit.checkoutLocalBranch).not.toHaveBeenCalled();
    });

    it('should handle cancel in branch switch', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: vi.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action with cancel
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      vi.spyOn(prompts, 'selectBranch').mockResolvedValue('cancel');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify no checkout was attempted
      expect(mockGit.checkout).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle launchTmuxSession error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      vi.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock supervisor action
      vi.spyOn(prompts, 'selectAction').mockResolvedValue('supervisor');

      // Override the default mock to reject with an error
      vi.spyOn(TmuxManager, 'launchSession').mockImplementation(() =>
        Promise.reject(new Error('Failed to launch tmux session')),
      );

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });

      // Should throw process.exit because the error is caught and logged
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('✖ Error:'),
        'Failed to launch tmux session',
      );
    });
  });

  describe('shutdownAllSessions error handling', () => {
    it('should handle shutdown error gracefully', async () => {
      const mockDetectState = vi.fn().mockResolvedValue({
        type: 'git-worktree',
        path: '/test/worktree',
        gitInfo: {
          isWorktree: true,
          isBareRepo: false,
          branch: 'main',
        },
      } as DirectoryState);

      mockGitDetector.prototype.detectState = mockDetectState;

      // Mock WorktreeManager
      const mockListWorktrees = vi.fn().mockResolvedValue([
        {
          path: '/test/parent/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);

      vi.mocked(WorktreeManager).prototype.listWorktrees = mockListWorktrees;

      // Mock shutdown action selection
      vi.spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('shutdown')
        .mockResolvedValueOnce('exit');

      // Mock sessions exist
      (TmuxManager.listSessions as vi.Mock) = vi.fn().mockReturnValue([
        {
          name: 'cgwt-test-main',
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        },
      ]);

      // Mock shutdown failure
      (TmuxManager.shutdownAll as vi.Mock) = vi.fn().mockImplementation(() => {
        throw new Error('Failed to shutdown');
      });

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      // Should log the error but continue
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Goodbye'));
    });
  });
});
