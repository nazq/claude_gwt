import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execCommandSafe } from '../../../src/core/utils/async.js';

// Mock all dependencies
vi.mock('../../../src/core/utils/async.js');
vi.mock('../../../src/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  Logger: {
    setLogLevel: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../src/core/git/GitDetector.js');
vi.mock('../../../src/core/git/WorktreeManager.js');
vi.mock('../../../src/sessions/TmuxManager.js');
vi.mock('../../../src/cli/ClaudeGWTApp.js');
vi.mock('../../../src/cli/ui/spinner.js');
vi.mock('inquirer');
vi.mock('simple-git');
vi.mock('fs');
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text) => text),
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    magenta: vi.fn((text) => text),
    dim: vi.fn((text) => text),
    hex: vi.fn(() => vi.fn((text) => text)),
  },
}));

const mockExecCommandSafe = vi.mocked(execCommandSafe);

// Import the guided experience helper functions that aren't exported
// We'll need to test these indirectly through runGuidedExperience
describe('cgwt-program guided experience helpers', () => {
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
  });

  describe('guideEmptyDirectory via runGuidedExperience', () => {
    it('should handle clone action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'empty' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'clone' }),
        },
      };
      const mockClaudeGWTApp = {
        run: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/cli/ClaudeGWTApp.js', () => ({
        ClaudeGWTApp: vi.fn().mockImplementation(() => mockClaudeGWTApp),
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      await runGuidedExperience({});

      expect(mockClaudeGWTApp.run).toHaveBeenCalled();
    });

    it('should handle init action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'empty' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'init' }),
        },
      };
      const mockClaudeGWTApp = {
        run: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/cli/ClaudeGWTApp.js', () => ({
        ClaudeGWTApp: vi.fn().mockImplementation(() => mockClaudeGWTApp),
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      await runGuidedExperience({});

      expect(mockClaudeGWTApp.run).toHaveBeenCalled();
    });
  });

  describe('guideClaudeGWTParent via runGuidedExperience', () => {
    it('should handle new worktree action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'claude-gwt-parent' }),
      };
      const mockManager = {
        listWorktrees: vi.fn().mockResolvedValue([]),
        addWorktree: vi.fn().mockResolvedValue('/test/path/feature'),
      };
      const mockInquirer = {
        default: {
          prompt: vi
            .fn()
            .mockResolvedValueOnce({ action: 'new' })
            .mockResolvedValueOnce({ branch: 'feature' }),
        },
      };
      const mockSpinner = {
        start: vi.fn(),
        succeed: vi.fn(),
      };
      const mockTmuxManager = {
        launchSession: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('../../../src/core/git/WorktreeManager.js', () => ({
        WorktreeManager: vi.fn().mockImplementation(() => mockManager),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/cli/ui/spinner.js', () => ({
        Spinner: vi.fn().mockImplementation(() => mockSpinner),
      }));
      vi.doMock('../../../src/sessions/TmuxManager.js', () => ({
        TmuxManager: mockTmuxManager,
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      mockExecCommandSafe.mockResolvedValue({
        code: 0,
        stdout: 'test-repo',
        stderr: '',
      });

      await runGuidedExperience({});

      expect(mockManager.addWorktree).toHaveBeenCalledWith('feature', false);
      expect(mockTmuxManager.launchSession).toHaveBeenCalled();
    });

    it('should handle supervisor action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'claude-gwt-parent' }),
      };
      const mockManager = {
        listWorktrees: vi.fn().mockResolvedValue([]),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'supervisor' }),
        },
      };
      const mockTmuxManager = {
        launchSession: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('../../../src/core/git/WorktreeManager.js', () => ({
        WorktreeManager: vi.fn().mockImplementation(() => mockManager),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/sessions/TmuxManager.js', () => ({
        TmuxManager: mockTmuxManager,
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      mockExecCommandSafe.mockResolvedValue({
        code: 0,
        stdout: 'test-repo',
        stderr: '',
      });

      await runGuidedExperience({});

      expect(mockTmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-test-repo--supervisor',
        workingDirectory: process.cwd(),
        branchName: 'supervisor',
        role: 'supervisor',
      });
    });

    it('should handle switch action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'claude-gwt-parent' }),
      };
      const mockManager = {
        listWorktrees: vi.fn().mockResolvedValue([]),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'switch' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('../../../src/core/git/WorktreeManager.js', () => ({
        WorktreeManager: vi.fn().mockImplementation(() => mockManager),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      // Mock listSessions which will be called
      mockExecCommandSafe.mockResolvedValue({
        code: 0,
        stdout: `worktree /test/path
HEAD abc123 main

`,
        stderr: '',
      });

      await runGuidedExperience({});

      // Should call listSessions (which internally calls git worktree list)
      expect(mockExecCommandSafe).toHaveBeenCalledWith('git', ['worktree', 'list', '--porcelain']);
    });

    it('should handle list action', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'claude-gwt-parent' }),
      };
      const mockManager = {
        listWorktrees: vi.fn().mockResolvedValue([]),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'list' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('../../../src/core/git/WorktreeManager.js', () => ({
        WorktreeManager: vi.fn().mockImplementation(() => mockManager),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      // Mock tmux sessions for listAllProjects
      mockExecCommandSafe.mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: '',
      });

      await runGuidedExperience({});

      // Should call tmux list-sessions for listAllProjects
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}',
      ]);
    });
  });

  describe('guideGitWorktree via runGuidedExperience', () => {
    it('should handle git-worktree state', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'exit' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGuidedExperience({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Git worktree detected'));

      consoleSpy.mockRestore();
    });

    it('should handle launch action in git-worktree', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-worktree' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'launch' }),
        },
      };
      const mockTmuxManager = {
        launchSession: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/sessions/TmuxManager.js', () => ({
        TmuxManager: mockTmuxManager,
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      mockExecCommandSafe.mockImplementation(async (command, args) => {
        if (command === 'git' && args?.[1] === '--show-current') {
          return { code: 0, stdout: 'feature-branch', stderr: '' };
        }
        return { code: 0, stdout: 'test-repo', stderr: '' };
      });

      await runGuidedExperience({});

      expect(mockTmuxManager.launchSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-test-repo--feature-branch',
        workingDirectory: process.cwd(),
        branchName: 'feature-branch',
        role: 'child',
      });
    });
  });

  describe('guideGitRepository via runGuidedExperience', () => {
    it('should handle git-repo state', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'exit' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGuidedExperience({});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Regular Git repository detected'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle convert action in git-repo', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'git-repo' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'convert' }),
        },
      };
      const mockSpinner = {
        start: vi.fn(),
        succeed: vi.fn(),
      };
      const mockGit = {
        cwd: vi.fn(),
        raw: vi.fn(),
      };
      const mockFs = {
        promises: {
          writeFile: vi.fn(),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/cli/ui/spinner.js', () => ({
        Spinner: vi.fn().mockImplementation(() => mockSpinner),
      }));
      vi.doMock('simple-git', () => ({
        simpleGit: vi.fn().mockReturnValue(mockGit),
      }));
      vi.doMock('fs', () => mockFs);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      mockExecCommandSafe.mockResolvedValue({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await runGuidedExperience({});

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Repository converted successfully!');
    });
  });

  describe('guideNonGitDirectory via runGuidedExperience', () => {
    it('should handle non-git state', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'non-git' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'exit' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGuidedExperience({});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Non-Git directory detected'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle init action in non-git directory', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'non-git' }),
      };
      const mockInquirer = {
        default: {
          prompt: vi.fn().mockResolvedValue({ action: 'init' }),
        },
      };
      const mockClaudeGWTApp = {
        run: vi.fn(),
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/cli/ClaudeGWTApp.js', () => ({
        ClaudeGWTApp: vi.fn().mockImplementation(() => mockClaudeGWTApp),
      }));
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      await runGuidedExperience({});

      expect(mockClaudeGWTApp.run).toHaveBeenCalled();
    });
  });

  describe('branch name validation', () => {
    it('should validate empty branch names', async () => {
      const { runGuidedExperience } = await import('../../../src/cli/cgwt-program.js');

      const mockDetector = {
        detectState: vi.fn().mockResolvedValue({ type: 'claude-gwt-parent' }),
      };
      const mockManager = {
        listWorktrees: vi.fn().mockResolvedValue([]),
      };
      const mockInquirer = {
        default: {
          prompt: vi
            .fn()
            .mockResolvedValueOnce({ action: 'new' })
            .mockResolvedValueOnce({ branch: '' }) // Empty branch name
            .mockResolvedValueOnce({ branch: 'valid-branch' }),
        },
      };
      const mockLogger = {
        setLogLevel: vi.fn(),
        info: vi.fn(),
      };

      vi.doMock('../../../src/core/git/GitDetector.js', () => ({
        GitDetector: vi.fn().mockImplementation(() => mockDetector),
      }));
      vi.doMock('../../../src/core/git/WorktreeManager.js', () => ({
        WorktreeManager: vi.fn().mockImplementation(() => mockManager),
      }));
      vi.doMock('inquirer', () => mockInquirer);
      vi.doMock('../../../src/core/utils/logger.js', () => ({
        Logger: mockLogger,
      }));

      // Capture the validation function by checking the prompt call
      await runGuidedExperience({});

      const promptCalls = mockInquirer.default.prompt.mock.calls;
      const branchPrompt = promptCalls.find((call) => call[0]?.[0]?.name === 'branch');

      if (branchPrompt?.[0]?.[0]?.validate) {
        const validator = branchPrompt[0][0].validate;
        expect(validator('')).toBe('Branch name cannot be empty');
        expect(validator('   ')).toBe('Branch name cannot be empty');
        expect(validator('valid-branch')).toBe(true);
      }
    });
  });
});
