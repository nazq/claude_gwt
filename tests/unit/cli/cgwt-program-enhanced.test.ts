import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseWorktreeOutput, listSessions, switchSession } from '../../../src/cli/cgwt-program.js';
import * as async from '../../../src/core/utils/async.js';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/core/utils/async.js');
vi.mock('../../../src/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockExecCommandSafe = vi.mocked(async.execCommandSafe);

describe('cgwt-program enhanced features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    vi.spyOn(process, 'chdir').mockImplementation(() => undefined);
    vi.spyOn(process, 'cwd').mockReturnValue('/test/main');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseWorktreeOutput with supervisor support', () => {
    it('should parse supervisor (bare) session correctly', () => {
      const output = `
worktree /test/.bare
HEAD abc123def456
bare

worktree /test/main
HEAD def456abc123
branch refs/heads/main

worktree /test/feature
HEAD 123456abcdef
branch refs/heads/feature
`;
      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(3);

      // Supervisor should be first
      expect(sessions[0]).toEqual({
        path: '/test/.bare',
        head: 'abc123def456',
        isSupervisor: true,
      });

      // Regular branches follow, sorted alphabetically
      expect(sessions[1]).toEqual({
        path: '/test/feature',
        head: '123456abcdef',
        branch: 'refs/heads/feature',
      });

      expect(sessions[2]).toEqual({
        path: '/test/main',
        head: 'def456abc123',
        branch: 'refs/heads/main',
      });
    });

    it('should sort sessions with supervisor first', () => {
      const output = `
worktree /test/zebra
HEAD aaa111
branch refs/heads/zebra

worktree /test/.bare
HEAD bbb222
bare

worktree /test/alpha
HEAD ccc333
branch refs/heads/alpha
`;
      const sessions = parseWorktreeOutput(output);

      expect(sessions[0].isSupervisor).toBe(true);
      expect(sessions[1].branch).toContain('alpha');
      expect(sessions[2].branch).toContain('zebra');
    });
  });

  describe.skip('listSessions with enhanced display', () => {
    it('should display supervisor session with [SUP] indicator', async () => {
      const worktreeOutput = `worktree /test/.bare
HEAD abc123def456
bare

worktree /test/main
HEAD def456abc123
branch refs/heads/main
`;

      // Set TMUX env for getCurrentTmuxSession
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      // Mock implementation that returns appropriate values based on the command
      mockExecCommandSafe.mockImplementation(async (command: string, args: string[]) => {
        console.log('Mock called with:', command, args);
        if (
          command === 'git' &&
          args[0] === 'worktree' &&
          args[1] === 'list' &&
          args[2] === '--porcelain'
        ) {
          return { code: 0, stdout: worktreeOutput, stderr: '' };
        }
        if (command === 'tmux' && args[0] === 'display-message') {
          return { code: 0, stdout: 'cgwt-test-supervisor', stderr: '' };
        }
        if (command === 'git' && args[0] === 'remote' && args[1] === 'get-url') {
          return { code: 0, stdout: 'https://github.com/user/test.git', stderr: '' };
        }
        console.log('Returning default for:', command, args);
        return { code: 0, stdout: '', stderr: '' };
      });

      const sessions = await listSessions();

      delete process.env['TMUX'];

      expect(sessions).toHaveLength(2);

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      // Check for [SUP] indicator
      const supLine = outputLines.find(
        (line) => typeof line === 'string' && line.includes('[SUP]'),
      );
      expect(supLine).toBeDefined();
      expect(supLine).toContain('supervisor');

      // Check for colored markers
      const hasColoredMarkers = outputLines.some(
        (line) => typeof line === 'string' && (line.includes('●') || line.includes('○')),
      );
      expect(hasColoredMarkers).toBe(true);
    });

    it('should use different colors for main/master vs feature branches', async () => {
      const worktreeOutput = `worktree /test/.bare
HEAD abc123
bare

worktree /test/main
HEAD def456
branch refs/heads/main

worktree /test/feature-branch
HEAD 789abc
branch refs/heads/feature-branch
`;

      // No TMUX env means getCurrentTmuxSession returns null
      delete process.env['TMUX'];

      // Mock implementation that returns appropriate values based on the command
      mockExecCommandSafe.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'git' && args.includes('worktree')) {
          return { code: 0, stdout: worktreeOutput, stderr: '' };
        }
        if (command === 'git' && args.includes('remote') && args.includes('get-url')) {
          return { code: 0, stdout: 'https://github.com/user/test.git', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      });

      await listSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      // Check that main branch uses yellow color
      const mainLine = outputLines.find(
        (line) => typeof line === 'string' && line.includes('main') && !line.includes('Path:'),
      );
      expect(mainLine).toContain(chalk.yellow('main'));

      // Check that feature branch uses cyan color
      const featureLine = outputLines.find(
        (line) =>
          typeof line === 'string' && line.includes('feature-branch') && !line.includes('Path:'),
      );
      expect(featureLine).toContain(chalk.hex('#00D9FF')('feature-branch'));
    });

    it('should show active session with green background', async () => {
      const worktreeOutput = `worktree /test/main
HEAD abc123
branch refs/heads/main
`;

      // Set environment to be in tmux
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      // Mock implementation that returns appropriate values based on the command
      mockExecCommandSafe.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'git' && args.includes('worktree')) {
          return { code: 0, stdout: worktreeOutput, stderr: '' };
        }
        if (command === 'tmux' && args.includes('display-message')) {
          return { code: 0, stdout: 'cgwt-test-main', stderr: '' };
        }
        if (command === 'git' && args.includes('remote')) {
          return { code: 0, stdout: 'test', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      });

      await listSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const hasGreenBackground = logCalls.some((call) => {
        const arg = call[0];
        return (
          typeof arg === 'string' && arg.includes(chalk.bgGreenBright.black('').substring(0, 5))
        );
      });

      expect(hasGreenBackground).toBe(true);

      delete process.env['TMUX'];
    });
  });

  describe('switchSession with supervisor support', () => {
    const setupMocks = () => {
      mockExecCommandSafe.mockReset();
      mockExecCommandSafe
        .mockResolvedValueOnce({
          code: 0,
          stdout: `
worktree /test/.bare
HEAD abc123
bare

worktree /test/main
HEAD def456
branch refs/heads/main

worktree /test/develop
HEAD 789abc
branch refs/heads/develop
`,
          stderr: '',
        }) // git worktree list for getSessionsQuietly
        .mockResolvedValueOnce({ code: 0, stdout: 'test', stderr: '' }) // repo name
        .mockResolvedValue({ code: 1, stdout: '', stderr: 'tmux not found' }); // tmux commands fail by default
    };

    it('should switch to supervisor when index is 0', async () => {
      setupMocks();
      await switchSession('0');

      expect(process.chdir).toHaveBeenCalledWith('/test/.bare');
    });

    it('should switch to first branch when index is 1', async () => {
      setupMocks();
      await switchSession('1');

      // First branch alphabetically after supervisor
      expect(process.chdir).toHaveBeenCalledWith('/test/develop');
    });

    it('should switch to supervisor by name', async () => {
      setupMocks();
      await switchSession('supervisor');

      expect(process.chdir).toHaveBeenCalledWith('/test/.bare');
    });

    it('should switch to supervisor by short name', async () => {
      setupMocks();
      await switchSession('sup');

      expect(process.chdir).toHaveBeenCalledWith('/test/.bare');
    });

    it('should handle tmux session switching when in tmux', async () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      // Mock successful tmux switch
      mockExecCommandSafe.mockReset();
      mockExecCommandSafe
        .mockResolvedValueOnce({
          code: 0,
          stdout: `
worktree /test/.bare
HEAD abc123
bare

worktree /test/main
HEAD def456
branch refs/heads/main
`,
          stderr: '',
        }) // git worktree list
        .mockResolvedValueOnce({ code: 0, stdout: 'test', stderr: '' }) // repo name
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // tmux switch-client success

      await switchSession('main');

      // Should have called tmux switch-client
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'switch-client',
        '-t',
        'cgwt-test-main',
      ]);

      // Should not have called chdir since tmux switch succeeded
      expect(process.chdir).not.toHaveBeenCalled();

      delete process.env['TMUX'];
    });

    it('should fall back to chdir when tmux session does not exist', async () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      // Mock failed tmux switch
      mockExecCommandSafe.mockReset();
      mockExecCommandSafe
        .mockResolvedValueOnce({
          code: 0,
          stdout: `
worktree /test/main
HEAD def456
branch refs/heads/main
`,
          stderr: '',
        }) // git worktree list
        .mockResolvedValueOnce({ code: 0, stdout: 'test', stderr: '' }) // repo name
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'session not found' }); // tmux switch-client fails

      await switchSession('main');

      // Should have fallen back to chdir
      expect(process.chdir).toHaveBeenCalledWith('/test/main');

      delete process.env['TMUX'];
    });
  });

  describe.skip('index numbering', () => {
    it('should use 0 for supervisor and 1+ for branches', async () => {
      const worktreeOutput = `worktree /test/.bare
HEAD abc123
bare

worktree /test/alpha
HEAD def456
branch refs/heads/alpha

worktree /test/beta
HEAD 789abc
branch refs/heads/beta
`;

      // No TMUX env
      delete process.env['TMUX'];

      // Mock implementation that returns appropriate values based on the command
      mockExecCommandSafe.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'git' && args.includes('worktree')) {
          return { code: 0, stdout: worktreeOutput, stderr: '' };
        }
        if (command === 'git' && args.includes('remote')) {
          return { code: 0, stdout: 'test', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      });

      await listSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      // Find lines with indices
      const indexLines = outputLines.filter(
        (line) => typeof line === 'string' && /\[\d+\]/.test(line),
      );

      // Should have [0] for supervisor
      const supervisorLine = indexLines.find((line) => line.includes('[SUP]'));
      expect(supervisorLine).toContain('[0]');

      // Should have [1] for first branch
      const alphaLine = indexLines.find((line) => line.includes('alpha'));
      expect(alphaLine).toContain('[1]');

      // Should have [2] for second branch
      const betaLine = indexLines.find((line) => line.includes('beta'));
      expect(betaLine).toContain('[2]');
    });
  });

  describe('killAllSessions', () => {
    it('should kill all cgwt sessions for the current repo', async () => {
      mockExecCommandSafe
        .mockResolvedValueOnce({ code: 0, stdout: 'test-repo', stderr: '' }) // getRepoName
        .mockResolvedValueOnce({
          code: 0,
          stdout: 'cgwt-test-repo-main\ncgwt-test-repo-feature\ncgwt-other-repo\nregular-session',
          stderr: '',
        }) // tmux list-sessions
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // kill first session
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // kill second session

      const { killAllSessions } = await import('../../../src/cli/cgwt-program.js');
      await killAllSessions();

      // Should have tried to kill only the cgwt-test-repo sessions
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-test-repo-main',
      ]);
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-test-repo-feature',
      ]);

      // Should NOT kill other repo or regular sessions
      expect(mockExecCommandSafe).not.toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-other-repo',
      ]);
      expect(mockExecCommandSafe).not.toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'regular-session',
      ]);

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      expect(outputLines).toContainEqual(
        expect.stringContaining('Killing 2 Claude GWT session(s)'),
      );
      expect(outputLines).toContainEqual(
        expect.stringContaining('All Claude GWT sessions terminated'),
      );
    });

    it('should handle no tmux sessions gracefully', async () => {
      mockExecCommandSafe
        .mockResolvedValueOnce({ code: 0, stdout: 'test-repo', stderr: '' }) // getRepoName
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'no server running' }); // tmux list-sessions fails

      const { killAllSessions } = await import('../../../src/cli/cgwt-program.js');
      await killAllSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      expect(outputLines).toContainEqual(expect.stringContaining('No tmux sessions found'));
    });

    it('should handle no cgwt sessions for repo', async () => {
      mockExecCommandSafe
        .mockResolvedValueOnce({ code: 0, stdout: 'test-repo', stderr: '' }) // getRepoName
        .mockResolvedValueOnce({
          code: 0,
          stdout: 'cgwt-other-repo\nregular-session',
          stderr: '',
        }); // tmux list-sessions

      const { killAllSessions } = await import('../../../src/cli/cgwt-program.js');
      await killAllSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      expect(outputLines).toContainEqual(
        expect.stringContaining('No Claude GWT sessions found for this repository'),
      );
    });
  });
});
