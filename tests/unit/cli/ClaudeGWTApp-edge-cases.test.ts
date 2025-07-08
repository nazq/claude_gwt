import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp.js';
import { GitDetector } from '../../../src/core/git/GitDetector.js';
import { WorktreeManager } from '../../../src/core/git/WorktreeManager.js';
import { TmuxManager } from '../../../src/sessions/TmuxManager.js';
import * as prompts from '../../../src/cli/ui/prompts.js';
import { theme } from '../../../src/cli/ui/theme.js';
import { showBanner } from '../../../src/cli/ui/banner.js';
import { TestErrorHandler } from '../../../src/core/errors/ErrorHandler.js';
import { simpleGit } from 'simple-git';

vi.mock('../../../src/core/git/GitDetector.js');
vi.mock('../../../src/core/git/WorktreeManager.js');
vi.mock('../../../src/sessions/TmuxManager.js');
vi.mock('../../../src/cli/ui/prompts.js');
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
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('ClaudeGWTApp Edge Cases', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractRepoNameFromUrl edge cases', () => {
    it('should handle empty URL', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'non-git' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.promptForRepoUrl).mockResolvedValue('');
      vi.mocked(prompts.promptForSubdirectoryName).mockResolvedValue('my-project');

      await expect(app.run()).rejects.toThrow('process.exit called');

      // Verify it handled the empty URL
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No repository URL provided'),
      );
    });

    it('should handle null URL gracefully', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'non-git' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.promptForRepoUrl).mockResolvedValue(null as any);
      vi.mocked(prompts.promptForSubdirectoryName).mockResolvedValue('my-project');

      await expect(app.run()).rejects.toThrow('process.exit called');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No repository URL provided'),
      );
    });

    it('should extract repo name from various URL formats', async () => {
      // Test URL extraction through subdirectory creation flow
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'non-git' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      // fs is already mocked at module level
      const fs = await import('fs');
      vi.mocked(fs.promises.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.promptForRepoUrl).mockResolvedValue(
        'https://github.com/user/complex-repo-name.git',
      );
      vi.mocked(prompts.promptForSubdirectoryName).mockResolvedValue('complex-repo-name');

      // Mock nested GitDetector for subdirectory
      let detectorCallCount = 0;
      vi.mocked(GitDetector).mockImplementation((path) => {
        detectorCallCount++;
        if (detectorCallCount > 1) {
          // Second call is for subdirectory
          return { detectState: vi.fn().mockResolvedValue({ type: 'empty' }) } as any;
        }
        return mockDetector as any;
      });

      // Mock GitRepository for the nested app
      const GitRepository = (await import('../../../src/core/git/GitRepository.js')).GitRepository;
      vi.spyOn(GitRepository.prototype, 'initializeBareRepository').mockResolvedValue({
        defaultBranch: 'main',
      });

      await expect(app.run()).rejects.toThrow('process.exit called');

      // Verify mkdir was called
      expect(fs.promises.mkdir).toHaveBeenCalled();
      const mkdirCall = vi.mocked(fs.promises.mkdir).mock.calls[0];
      expect(mkdirCall?.[0]).toContain('complex-repo-name');
    });
  });

  describe('removeWorktree confirmation flow', () => {
    it('should handle user cancelling worktree removal', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      const mockWorktreeManager = {
        listWorktrees: vi.fn().mockResolvedValue([
          { path: testPath, branch: 'main' },
          { path: '/test/path/feature', branch: 'feature' },
        ]),
        removeWorktree: vi.fn(),
      };
      vi.mocked(WorktreeManager).mockImplementation(() => mockWorktreeManager as any);

      // User selects remove, then selects a worktree, but cancels confirmation
      // Mock TmuxManager sessions
      vi.mocked(TmuxManager.listSessions).mockResolvedValue([]);

      vi.mocked(prompts.promptForWorktreeAction)
        .mockResolvedValueOnce('remove')
        .mockResolvedValueOnce('exit');
      vi.mocked(prompts.selectWorktree).mockResolvedValue({
        path: '/test/path/feature',
        branch: 'feature',
      });
      vi.mocked(prompts.confirmAction).mockResolvedValue(false); // User cancels

      await app.run();

      // Verify removeWorktree was NOT called
      expect(mockWorktreeManager.removeWorktree).not.toHaveBeenCalled();
    });
  });

  describe('handleRegularGitMode supervisor case', () => {
    it('should handle supervisor launch in regular git mode', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      // Mock GitRepository
      const GitRepository = (await import('../../../src/core/git/GitRepository.js')).GitRepository;
      vi.spyOn(GitRepository.prototype, 'canConvertToWorktree').mockResolvedValue({
        canConvert: false,
        reason: 'Has uncommitted changes',
      });
      vi.spyOn(GitRepository.prototype, 'getCurrentBranch').mockResolvedValue('main');

      // Mock simpleGit
      vi.mocked(simpleGit).mockReturnValue({
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature'],
          current: 'main',
        }),
      } as any);

      // Mock TmuxManager
      vi.mocked(TmuxManager.getSessionName).mockReturnValue('test-session');
      vi.mocked(TmuxManager.launchSession).mockResolvedValue();

      // User proceeds with limited functionality, then selects supervisor
      vi.mocked(prompts.confirmAction).mockResolvedValue(true);
      vi.mocked(prompts.selectAction)
        .mockResolvedValueOnce('supervisor')
        .mockResolvedValueOnce('exit');

      await app.run();

      // Verify supervisor session was launched
      expect(TmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'test-session',
        workingDirectory: testPath,
        branchName: 'main',
        role: 'supervisor',
      });
    });
  });

  describe('switchBranchRegularMode with supervisor launch', () => {
    it('should handle supervisor launch after branch switch', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      // Mock GitRepository
      const GitRepository = (await import('../../../src/core/git/GitRepository.js')).GitRepository;
      vi.spyOn(GitRepository.prototype, 'canConvertToWorktree').mockResolvedValue({
        canConvert: false,
        reason: 'Has uncommitted changes',
      });
      vi.spyOn(GitRepository.prototype, 'getCurrentBranch').mockResolvedValue('main');

      // Mock simpleGit
      const gitInstance = {
        branch: vi.fn().mockResolvedValue({
          all: ['main', 'feature', 'develop'],
          current: 'main',
        }),
        checkout: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(simpleGit).mockReturnValue(gitInstance as any);

      // Mock TmuxManager
      vi.mocked(TmuxManager.getSessionName).mockReturnValue('test-session');
      vi.mocked(TmuxManager.launchSession).mockResolvedValue();

      // User proceeds with limited functionality, switches branch, then launches supervisor
      vi.mocked(prompts.confirmAction).mockResolvedValueOnce(true).mockResolvedValueOnce(true); // proceed, then launch
      vi.mocked(prompts.selectAction).mockResolvedValueOnce('switch').mockResolvedValueOnce('exit');
      vi.mocked(prompts.selectBranch).mockResolvedValue('feature');

      await app.run();

      // Verify branch was switched
      expect(gitInstance.checkout).toHaveBeenCalledWith('feature');

      // Verify supervisor session was launched for the new branch
      expect(TmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'test-session',
        workingDirectory: testPath,
        branchName: 'feature',
        role: 'supervisor',
      });
    });
  });

  describe('createWorktreeFromExistingBranch method', () => {
    it('should handle creating worktrees from existing branches', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      const mockWorktreeManager = {
        listWorktrees: vi.fn().mockResolvedValue([{ path: testPath, branch: 'main' }]),
        getBranchesWithoutWorktrees: vi.fn().mockResolvedValue(['feature', 'develop']),
        addWorktree: vi.fn().mockResolvedValue('/test/path/feature'),
      };
      vi.mocked(WorktreeManager).mockImplementation(() => mockWorktreeManager as any);

      // User selects create from existing branch
      // Mock TmuxManager sessions
      vi.mocked(TmuxManager.listSessions).mockResolvedValue([]);

      vi.mocked(prompts.promptForWorktreeAction)
        .mockResolvedValueOnce('existing')
        .mockResolvedValueOnce('exit');
      vi.mocked(prompts.selectExistingBranch).mockResolvedValue('feature');

      await app.run();

      // Verify the branch was fetched and worktree created
      expect(mockWorktreeManager.getBranchesWithoutWorktrees).toHaveBeenCalled();
      expect(mockWorktreeManager.addWorktree).toHaveBeenCalledWith('feature');
    });

    it('should handle when user cancels branch selection', async () => {
      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      const mockWorktreeManager = {
        listWorktrees: vi.fn().mockResolvedValue([{ path: testPath, branch: 'main' }]),
        getBranchesWithoutWorktrees: vi.fn().mockResolvedValue(['feature', 'develop']),
        addWorktree: vi.fn(),
      };
      vi.mocked(WorktreeManager).mockImplementation(() => mockWorktreeManager as any);

      // User selects create from existing branch but cancels selection
      // Mock TmuxManager sessions
      vi.mocked(TmuxManager.listSessions).mockResolvedValue([]);

      vi.mocked(prompts.promptForWorktreeAction)
        .mockResolvedValueOnce('existing')
        .mockResolvedValueOnce('exit');
      vi.mocked(prompts.selectExistingBranch).mockResolvedValue(null);

      await app.run();

      // Verify addWorktree was NOT called
      expect(mockWorktreeManager.addWorktree).not.toHaveBeenCalled();
    });
  });
});
