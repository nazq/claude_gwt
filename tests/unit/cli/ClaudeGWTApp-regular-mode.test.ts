import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp';
import * as prompts from '../../../src/cli/ui/prompts';
import { GitDetector } from '../../../src/core/git/GitDetector';
import { GitRepository } from '../../../src/core/git/GitRepository';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import type { DirectoryState } from '../../../src/types';
import simpleGit from 'simple-git';

// Mock all dependencies
jest.mock('../../../src/cli/ui/banner');
jest.mock('../../../src/cli/ui/prompts');
jest.mock('../../../src/cli/ui/spinner');
jest.mock('../../../src/core/git/GitDetector');
jest.mock('../../../src/core/git/GitRepository');
jest.mock('../../../src/core/git/WorktreeManager');
jest.mock('../../../src/sessions/TmuxManager');
jest.mock('../../../src/core/utils/logger');
jest.mock('simple-git');

describe('ClaudeGWTApp - Regular Git Mode', () => {
  const mockGitDetector = GitDetector as jest.MockedClass<typeof GitDetector>;
  const mockGitRepository = GitRepository as jest.MockedClass<typeof GitRepository>;
  const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  jest.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as never);

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    mockConsoleLog.mockImplementation();
    mockConsoleError.mockImplementation();

    // Mock TmuxManager static methods
    jest.spyOn(TmuxManager, 'launchSession').mockResolvedValue(undefined);
    jest.spyOn(TmuxManager, 'getSessionName').mockReturnValue('cgwt-test-main');
  });

  describe('handleRegularGitMode', () => {
    it('should handle regular git mode with switch branch action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: jest.fn().mockResolvedValue(undefined),
        checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      jest.spyOn(prompts, 'selectBranch').mockResolvedValue('feature');

      // Mock decline launching supervisor
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify switch branch was called
      expect(mockGit.checkout).toHaveBeenCalledWith('feature');
    });

    it('should handle regular git mode with create branch action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion first, then confirming supervisor launch
      jest
        .spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // decline conversion
        .mockResolvedValueOnce(true); // confirm launching supervisor

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: jest.fn().mockResolvedValue(undefined),
        checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('new-feature');

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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock supervisor action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('supervisor');

      // Override the default mock to simulate real behavior - tmux launches and exits
      jest.spyOn(TmuxManager, 'launchSession').mockImplementation(async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion first time, then accepting second time
      jest
        .spyOn(prompts, 'confirmAction')
        .mockResolvedValueOnce(false) // decline conversion first time
        .mockResolvedValueOnce(true); // accept conversion second time

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock convert action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('convert');

      // Mock successful conversion
      mockGitRepository.prototype.convertToWorktreeSetup.mockResolvedValue({
        defaultBranch: 'main',
        originalPath: '/test/repo',
      });

      // Mock WorktreeManager for handleGitWorktree
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
      const WorktreeManager = require('../../../src/core/git/WorktreeManager').WorktreeManager;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      WorktreeManager.prototype.listWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/repo/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);

      // Mock worktree action prompt to exit
      jest.spyOn(prompts, 'promptForWorktreeAction').mockResolvedValue('exit');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });

      // Should exit gracefully
      await app.run();

      // Verify conversion was attempted
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGitRepository.prototype.convertToWorktreeSetup).toHaveBeenCalled();
    });

    it('should handle branch switch error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: jest.fn().mockRejectedValue(new Error('Branch checkout failed')),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      jest.spyOn(prompts, 'selectBranch').mockResolvedValue('feature');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Branch checkout failed'),
      );
    });

    it('should handle create branch error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkoutLocalBranch: jest.fn().mockRejectedValue(new Error('Branch already exists')),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('existing-branch');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify error was logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Branch already exists'),
      );
    });

    it('should handle empty branch name in create action', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
        checkoutLocalBranch: jest.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock create branch action with empty name
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('create');
      jest.spyOn(prompts, 'promptForBranchName').mockResolvedValue('');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify no branch creation was attempted
      expect(mockGit.checkoutLocalBranch).not.toHaveBeenCalled();
    });

    it('should handle cancel in branch switch', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'feature', 'remotes/origin/main'],
          current: 'main',
        }),
        checkout: jest.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock switch branch action with cancel
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('switch');
      jest.spyOn(prompts, 'selectBranch').mockResolvedValue('cancel');

      const app = new ClaudeGWTApp('/test/repo', { interactive: true });
      await app.run();

      // Verify no checkout was attempted
      expect(mockGit.checkout).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle launchTmuxSession error', async () => {
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

      // Mock canConvertToWorktree - can convert
      mockGitRepository.prototype.canConvertToWorktree.mockResolvedValue({
        canConvert: true,
        reason: undefined,
      });

      // Mock user declining conversion
      jest.spyOn(prompts, 'confirmAction').mockResolvedValueOnce(false);

      // Mock getCurrentBranch
      mockGitRepository.prototype.getCurrentBranch.mockResolvedValue('main');

      // Mock simple-git branch info
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          all: ['main', 'remotes/origin/main'],
          current: 'main',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      mockSimpleGit.mockReturnValue(mockGit as any);

      // Mock supervisor action
      jest.spyOn(prompts, 'selectAction').mockResolvedValue('supervisor');

      // Override the default mock to reject with an error
      jest
        .spyOn(TmuxManager, 'launchSession')
        .mockImplementation(() => Promise.reject(new Error('Failed to launch tmux session')));

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
      const mockDetectState = jest.fn().mockResolvedValue({
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
      const mockListWorktrees = jest.fn().mockResolvedValue([
        {
          path: '/test/parent/main',
          branch: 'main',
          isLocked: false,
          prunable: false,
          HEAD: 'abc123',
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
      const WorktreeManager = require('../../../src/core/git/WorktreeManager').WorktreeManager;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      WorktreeManager.prototype.listWorktrees = mockListWorktrees;

      // Mock shutdown action selection
      jest
        .spyOn(prompts, 'promptForWorktreeAction')
        .mockResolvedValueOnce('shutdown')
        .mockResolvedValueOnce('exit');

      // Mock sessions exist
      (TmuxManager.listSessions as jest.Mock) = jest.fn().mockReturnValue([
        {
          name: 'cgwt-test-main',
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        },
      ]);

      // Mock shutdown failure
      (TmuxManager.shutdownAll as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new Error('Failed to shutdown');
      });

      const app = new ClaudeGWTApp('/test/worktree', { interactive: true });
      await app.run();

      // Should log the error but continue
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Goodbye'));
    });
  });
});
