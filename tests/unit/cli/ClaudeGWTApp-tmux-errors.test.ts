import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp.js';
import { GitDetector } from '../../../src/core/git/GitDetector.js';
import { GitRepository } from '../../../src/core/git/GitRepository.js';
import { WorktreeManager } from '../../../src/core/git/WorktreeManager.js';
import { TmuxManager } from '../../../src/sessions/TmuxManager.js';
import * as prompts from '../../../src/cli/ui/prompts.js';
import { theme } from '../../../src/cli/ui/theme.js';
import { Logger } from '../../../src/core/utils/logger.js';
import { showBanner } from '../../../src/cli/ui/banner.js';
import { TestErrorHandler } from '../../../src/core/errors/ErrorHandler.js';
import { simpleGit } from 'simple-git';

vi.mock('../../../src/core/git/GitDetector.js');
vi.mock('../../../src/core/git/GitRepository.js');
vi.mock('../../../src/core/git/WorktreeManager.js');
vi.mock('../../../src/sessions/TmuxManager.js');
vi.mock('../../../src/cli/ui/prompts.js');
vi.mock('../../../src/core/utils/logger.js');
vi.mock('../../../src/cli/ui/theme.js', () => ({
  theme: {
    info: vi.fn((text: string) => text),
    primary: vi.fn((text: string) => text),
    muted: vi.fn((text: string) => text),
    warning: vi.fn((text: string) => text),
    error: vi.fn((text: string) => text),
    success: vi.fn((text: string) => text),
    branch: vi.fn((text: string) => text),
    dim: vi.fn((text: string) => text),
    statusActive: '●',
    statusIdle: '○',
    icons: { branch: '🔀' },
  },
}));
vi.mock('../../../src/cli/ui/banner.js');
vi.mock('simple-git');

describe('ClaudeGWTApp Tmux Error Paths', () => {
  let app: ClaudeGWTApp;
  let errorHandler: TestErrorHandler;
  const testPath = '/test/path';

  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler = new TestErrorHandler();
    app = new ClaudeGWTApp(testPath, {}, errorHandler);

    // Setup console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'clear').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock Logger
    vi.mocked(Logger.info).mockImplementation(() => {});
    vi.mocked(Logger.error).mockImplementation(() => {});
    vi.mocked(Logger.getLogPath).mockReturnValue('/test/logs/app.log');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tmux error handling', () => {
    it('should handle when tmux is not available using launchTmuxSession directly', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      // Mock GitRepository
      vi.mocked(GitRepository).mockImplementation(
        () =>
          ({
            canConvertToWorktree: vi
              .fn()
              .mockResolvedValue({ canConvert: false, reason: 'Has uncommitted changes' }),
            getCurrentBranch: vi.fn().mockResolvedValue('main'),
          }) as any,
      );

      // Mock simpleGit
      vi.mocked(simpleGit).mockReturnValue({
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature'],
          current: 'main',
        }),
      } as any);

      // Mock TmuxManager - tmux is NOT available
      vi.mocked(TmuxManager.isTmuxAvailable).mockResolvedValue(false);
      vi.mocked(TmuxManager.listSessions).mockResolvedValue([]);

      // User proceeds with limited functionality, then selects supervisor
      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.selectAction)
        .mockResolvedValueOnce('supervisor')
        .mockResolvedValueOnce('exit');

      // Call private method directly to test error handling
      // @ts-expect-error Testing private method
      await app.launchTmuxSession('/test/path', 'main', false);

      // Verify tmux not available error messages were shown
      expect(Logger.error).toHaveBeenCalledWith('tmux not available');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ tmux is not installed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Claude GWT requires tmux'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('macOS: brew install tmux'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Ubuntu/Debian: sudo apt-get install tmux'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Fedora/RHEL: sudo dnf install tmux'),
      );

      // Verify TmuxManager.launchSession was NOT called
      expect(TmuxManager.launchSession).not.toHaveBeenCalled();
    });

    it('should handle tmux session launch failure directly', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      // Mock GitRepository
      vi.mocked(GitRepository).mockImplementation(
        () =>
          ({
            canConvertToWorktree: vi
              .fn()
              .mockResolvedValue({ canConvert: false, reason: 'Has uncommitted changes' }),
            getCurrentBranch: vi.fn().mockResolvedValue('main'),
          }) as any,
      );

      // Mock simpleGit
      vi.mocked(simpleGit).mockReturnValue({
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature'],
          current: 'main',
        }),
      } as any);

      // Mock TmuxManager - tmux IS available but launch fails
      vi.mocked(TmuxManager.isTmuxAvailable).mockResolvedValue(true);
      vi.mocked(TmuxManager.getSessionName).mockReturnValue('test-session');
      vi.mocked(TmuxManager.launchSession).mockRejectedValue(
        new Error('Failed to create tmux session'),
      );
      vi.mocked(TmuxManager.listSessions).mockResolvedValue([]);

      // User proceeds with limited functionality, then selects supervisor
      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.selectAction)
        .mockResolvedValueOnce('supervisor')
        .mockResolvedValueOnce('exit');

      // Call private method directly - it will throw after logging
      await expect(
        // @ts-expect-error Testing private method
        app.launchTmuxSession('/test/path', 'main', false),
      ).rejects.toThrow('Failed to create tmux session');

      // Verify error handling happened before the throw
      expect(Logger.error).toHaveBeenCalledWith('Failed to launch tmux session', expect.any(Error));
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to launch session'),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Check logs at: /test/logs/app.log'),
      );
    });

    it('should handle tmux launch error in supervisor mode', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      const mockWorktreeManager = {
        listWorktrees: vi.fn().mockResolvedValue([
          { path: testPath, branch: 'main' },
          { path: '/test/path/feature', branch: 'feature' },
        ]),
      };
      vi.mocked(WorktreeManager).mockImplementation(() => mockWorktreeManager as any);

      // Test supervisor mode = true
      vi.mocked(TmuxManager.isTmuxAvailable).mockResolvedValue(false);

      // Call with supervisor = true
      // @ts-expect-error Testing private method
      await app.launchTmuxSession('/test/path', 'supervisor', true);

      // Should still show tmux not available error
      expect(Logger.error).toHaveBeenCalledWith('tmux not available');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ tmux is not installed'));
    });
  });
});
