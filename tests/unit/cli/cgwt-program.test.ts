import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock child_process before importing modules that use it
vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));

// Now import after the mock is set up
import { execSync } from 'child_process';
import {
  createProgram,
  listSessions,
  switchSession,
  getSessionsQuietly,
  listTmuxSessions,
  handleGitError,
  parseWorktreeOutput,
  isSessionActive,
} from '../../../src/cli/cgwt-program.js';

describe('cgwt-program', () => {
  let mockConsoleLog: Mock;
  let mockProcessExit: Mock;
  let mockProcessChdir: Mock;
  let mockProcessCwd: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    mockProcessChdir = vi.spyOn(process, 'chdir').mockImplementation(() => {});
    mockProcessCwd = vi.spyOn(process, 'cwd').mockReturnValue('/test/path');

    // Reset mock implementation to default
    vi.mocked(execSync).mockReset();
    vi.mocked(execSync).mockReturnValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createProgram', () => {
    it('should create a command program with correct configuration', () => {
      const program = createProgram();
      expect(program.name()).toBe('cgwt');
      expect(program.description()).toBe('Quick session switcher for Claude GWT');
    });

    it('should have list command', () => {
      const program = createProgram();
      const listCmd = program.commands.find((cmd) => cmd.name() === 'l');
      expect(listCmd).toBeDefined();
      expect(listCmd?.alias()).toBe('list');
    });

    it('should have switch command', () => {
      const program = createProgram();
      const switchCmd = program.commands.find((cmd) => cmd.name() === 's');
      expect(switchCmd).toBeDefined();
      expect(switchCmd?.alias()).toBe('switch');
    });
  });

  describe('parseWorktreeOutput', () => {
    it('should parse worktree output correctly', () => {
      const output = `worktree /test/main
HEAD abc123def456
branch refs/heads/main

worktree /test/feature
HEAD 123456abcdef
branch refs/heads/feature
`;
      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        path: '/test/main',
        head: 'abc123def456',
        branch: 'refs/heads/main',
      });
      expect(sessions[1]).toEqual({
        path: '/test/feature',
        head: '123456abcdef',
        branch: 'refs/heads/feature',
      });
    });

    it('should handle empty output', () => {
      const sessions = parseWorktreeOutput('');
      expect(sessions).toEqual([]);
    });

    it('should filter out sessions without branches', () => {
      const output = `worktree /test/detached
HEAD abc123
`;
      const sessions = parseWorktreeOutput(output);
      expect(sessions).toEqual([]);
    });
  });

  describe('isSessionActive', () => {
    it('should return true for current directory', () => {
      mockProcessCwd.mockReturnValue('/test/active');
      expect(isSessionActive('/test/active')).toBe(true);
    });

    it('should return false for different directory', () => {
      mockProcessCwd.mockReturnValue('/test/current');
      expect(isSessionActive('/test/other')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockProcessCwd.mockImplementation(() => {
        throw new Error('cwd error');
      });
      expect(isSessionActive('/test/path')).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should handle empty worktree list', () => {
      vi.mocked(execSync).mockReturnValue('');

      const sessions = listSessions();

      expect(sessions).toHaveLength(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No Git worktree sessions found.'),
      );
    });

    it('should handle git errors', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(() => listSessions()).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Not in a Git repository'),
      );
    });
  });

  describe('switchSession', () => {
    const mockSessions =
      'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n\n' +
      'worktree /test/feature\nHEAD def456\nbranch refs/heads/feature\n\n' +
      'worktree /test/develop\nHEAD ghi789\nbranch refs/heads/develop\n';

    beforeEach(() => {
      // Mock execSync for both git worktree and tmux
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('git worktree')) {
          return mockSessions;
        }
        if (command.includes('tmux')) {
          throw new Error('no tmux');
        }
        return '';
      });
    });

    it('should switch to session by index', () => {
      switchSession('2');

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/feature');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('feature'));
    });

    it('should switch to session by branch name', () => {
      switchSession('develop');

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/develop');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('develop'));
    });

    it('should handle index out of range', () => {
      expect(() => switchSession('10')).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Index 10 is out of range'),
      );
    });

    it('should handle branch not found', () => {
      expect(() => switchSession('nonexistent')).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Branch 'nonexistent' not found"),
      );
    });

    it('should handle no sessions', () => {
      vi.mocked(execSync).mockReturnValue('');

      expect(() => switchSession('1')).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No Git worktree sessions found'),
      );
    });

    it('should accept zero-based index 0 for first session', () => {
      switchSession('1');
      expect(mockProcessChdir).toHaveBeenCalledWith('/test/main');
    });
  });

  describe('getSessionsQuietly', () => {
    it('should return sessions without logging', () => {
      vi.mocked(execSync).mockReturnValue(
        'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n',
      );

      const sessions = getSessionsQuietly();

      expect(sessions).toHaveLength(1);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should return empty array on error', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('git error');
      });

      const sessions = getSessionsQuietly();

      expect(sessions).toEqual([]);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('listTmuxSessions', () => {
    it('should handle no tmux sessions', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('no sessions');
      });

      listTmuxSessions();

      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Tmux Sessions:'));
    });

    it('should handle empty tmux output', () => {
      vi.mocked(execSync).mockReturnValue('');

      listTmuxSessions();

      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Tmux Sessions:'));
    });

    it('should filter only cgwt sessions', () => {
      vi.mocked(execSync).mockReturnValue('regular-session: 1 windows\n');

      listTmuxSessions();

      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Tmux Sessions:'));
    });
  });

  describe('handleGitError', () => {
    it('should handle not a git repository error', () => {
      const error = new Error('not a git repository');
      expect(() => handleGitError(error)).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Not in a Git repository'),
      );
    });

    it('should handle worktree error', () => {
      const error = new Error('worktree command failed');
      expect(() => handleGitError(error)).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Git worktree command failed'),
      );
    });

    it('should handle generic git error', () => {
      const error = new Error('some git error');
      expect(() => handleGitError(error)).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Git error:', 'some git error');
    });

    it('should handle non-Error objects', () => {
      expect(() => handleGitError('string error')).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error occurred'),
      );
    });

    it('should handle null error', () => {
      expect(() => handleGitError(null)).toThrow('process.exit(1)');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error occurred'),
      );
    });
  });

  describe('command integration', () => {
    it('should handle invalid command gracefully', async () => {
      const program = createProgram();
      program.exitOverride(); // Prevent process.exit

      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'cgwt', 'invalid-command']);
      } catch (error: any) {
        // Commander will throw an error on unknown command
        errorThrown = true;
        expect(error).toBeDefined();
      }

      expect(errorThrown).toBe(true);
    });
  });

  describe('command actions', () => {
    it('should execute listSessions when l command is called', async () => {
      vi.mocked(execSync).mockReturnValue('');
      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'cgwt', 'l']);
      } catch (error: any) {
        // Command will exit after execution
        expect(error.code).toBe(0);
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No Git worktree sessions found.'),
      );
    });

    it('should execute switchSession when s command is called', async () => {
      const mockSessions =
        'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n\n' +
        'worktree /test/feature\nHEAD def456\nbranch refs/heads/feature\n';

      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('git worktree')) {
          return mockSessions;
        }
        if (command.includes('tmux')) {
          throw new Error('no tmux');
        }
        return '';
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'cgwt', 's', 'main']);
      } catch (error: any) {
        // Command will exit after execution
        expect(error.code).toBe(0);
      }

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/main');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to'));
    });

    it('should show help when no arguments provided', async () => {
      const program = createProgram();
      program.exitOverride();
      const mockOutputHelp = vi.spyOn(program, 'outputHelp').mockImplementation(() => {});

      try {
        await program.parseAsync(['node', 'cgwt']);
      } catch (error: any) {
        // Command may exit after help
        expect(error.code).toBe(0);
      }

      expect(mockOutputHelp).toHaveBeenCalled();
    });

    it('should handle numeric index in default action', async () => {
      const mockSessions =
        'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n\n' +
        'worktree /test/feature\nHEAD def456\nbranch refs/heads/feature\n';

      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('git worktree')) {
          return mockSessions;
        }
        if (command.includes('tmux')) {
          throw new Error('no tmux');
        }
        return '';
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'cgwt', '2']);
      } catch (error: any) {
        // Command will exit after execution
        expect(error.code).toBe(0);
      }

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/feature');
    });

    it('should handle invalid argument in default action', async () => {
      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'cgwt', 'invalid-arg']);
      } catch (error: any) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Invalid argument: invalid-arg'),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });
  });

  describe('parseWorktreeOutput edge cases', () => {
    it('should handle multiple worktrees with partial data', () => {
      const output = `worktree /test/first
HEAD abc123
branch refs/heads/first

worktree /test/second
HEAD def456

worktree /test/third
HEAD ghi789
branch refs/heads/third
`;
      const sessions = parseWorktreeOutput(output);

      // Should only return sessions with branches (first and third)
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        path: '/test/first',
        head: 'abc123',
        branch: 'refs/heads/first',
      });
      expect(sessions[1]).toEqual({
        path: '/test/third',
        head: 'ghi789',
        branch: 'refs/heads/third',
      });
    });

    it('should handle parsing with existing current session', () => {
      const output = `worktree /test/existing
HEAD existing123

worktree /test/main
HEAD abc123
branch refs/heads/main
`;
      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].path).toBe('/test/main');
    });
  });

  describe('switchSession additional coverage', () => {
    it('should handle index at range boundary (index 1)', () => {
      const mockSessions = 'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n';

      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('git worktree')) {
          return mockSessions;
        }
        if (command.includes('tmux')) {
          throw new Error('no tmux');
        }
        return '';
      });

      switchSession('1');

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/main');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to'));
    });

    it('should handle branch search by exact branch match', () => {
      const mockSessions = 'worktree /test/main\nHEAD abc123\nbranch refs/heads/main\n';

      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('git worktree')) {
          return mockSessions;
        }
        if (command.includes('tmux')) {
          throw new Error('no tmux');
        }
        return '';
      });

      switchSession('refs/heads/main');

      expect(mockProcessChdir).toHaveBeenCalledWith('/test/main');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to'));
    });
  });
});
