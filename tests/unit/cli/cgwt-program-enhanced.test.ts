import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseWorktreeOutput,
  listSessions,
  switchSession,
  isSessionActive,
} from '../../../src/cli/cgwt-program.js';
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

describe('cgwt-program enhanced features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    vi.spyOn(process, 'chdir').mockImplementation(() => undefined);
    vi.spyOn(process, 'cwd').mockReturnValue('/test/main');

    // Set up default mock to prevent errors
    vi.mocked(async.execCommandSafe).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
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

  describe('listSessions with enhanced display', () => {
    it('should parse worktree output with supervisor correctly', () => {
      const output = `worktree /test/.bare
HEAD abc123def456
bare

worktree /test/main
HEAD def456abc123
branch refs/heads/main
`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isSupervisor).toBe(true);
      expect(sessions[0].path).toBe('/test/.bare');
      expect(sessions[1].branch).toBe('refs/heads/main');
    });

    it('should parse sessions with multiple branches correctly', () => {
      const output = `worktree /test/.bare
HEAD abc123
bare

worktree /test/main
HEAD def456
branch refs/heads/main

worktree /test/feature-branch
HEAD 789abc
branch refs/heads/feature-branch
`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(3);
      expect(sessions[0].isSupervisor).toBe(true);
      expect(sessions[1].branch).toBe('refs/heads/feature-branch');
      expect(sessions[2].branch).toBe('refs/heads/main');
    });

    it('should identify active session based on current directory', () => {
      // Test isSessionActive function
      const mockCwd = vi.spyOn(process, 'cwd');

      mockCwd.mockReturnValue('/test/main');
      expect(isSessionActive('/test/main')).toBe(true);
      expect(isSessionActive('/test/other')).toBe(false);

      mockCwd.mockReturnValue('/test/feature');
      expect(isSessionActive('/test/feature')).toBe(true);
      expect(isSessionActive('/test/main')).toBe(false);
    });
  });

  describe('switchSession with supervisor support', () => {
    const setupMocks = () => {
      vi.mocked(async.execCommandSafe).mockReset();
      vi.mocked(async.execCommandSafe)
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
      vi.mocked(async.execCommandSafe).mockReset();
      vi.mocked(async.execCommandSafe)
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
      expect(vi.mocked(async.execCommandSafe)).toHaveBeenCalledWith('tmux', [
        'switch-client',
        '-t',
        'cgwt-test--main',
      ]);

      // Should not have called chdir since tmux switch succeeded
      expect(process.chdir).not.toHaveBeenCalled();

      delete process.env['TMUX'];
    });

    it('should fall back to chdir when tmux session does not exist', async () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      // Mock failed tmux switch
      vi.mocked(async.execCommandSafe).mockReset();
      vi.mocked(async.execCommandSafe)
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

  describe('index numbering', () => {
    it('should correctly sort supervisor first then branches alphabetically', () => {
      const output = `worktree /test/beta
HEAD 789abc
branch refs/heads/beta

worktree /test/.bare
HEAD abc123
bare

worktree /test/alpha
HEAD def456
branch refs/heads/alpha
`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(3);
      // Supervisor should be first
      expect(sessions[0].isSupervisor).toBe(true);
      expect(sessions[0].path).toBe('/test/.bare');
      // Then branches alphabetically
      expect(sessions[1].branch).toBe('refs/heads/alpha');
      expect(sessions[2].branch).toBe('refs/heads/beta');
    });
  });

  describe('killAllSessions', () => {
    it('should kill all cgwt sessions for the current repo', async () => {
      vi.mocked(async.execCommandSafe)
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
      expect(vi.mocked(async.execCommandSafe)).toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-test-repo-main',
      ]);
      expect(vi.mocked(async.execCommandSafe)).toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-test-repo-feature',
      ]);

      // Should NOT kill other repo or regular sessions
      expect(vi.mocked(async.execCommandSafe)).not.toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'cgwt-other-repo',
      ]);
      expect(vi.mocked(async.execCommandSafe)).not.toHaveBeenCalledWith('tmux', [
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
      vi.mocked(async.execCommandSafe)
        .mockResolvedValueOnce({ code: 0, stdout: 'test-repo', stderr: '' }) // getRepoName
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'no server running' }); // tmux list-sessions fails

      const { killAllSessions } = await import('../../../src/cli/cgwt-program.js');
      await killAllSessions();

      const logCalls = vi.mocked(console.log).mock.calls;
      const outputLines = logCalls.map((call) => call[0]);

      expect(outputLines).toContainEqual(expect.stringContaining('No tmux sessions found'));
    });

    it('should handle no cgwt sessions for repo', async () => {
      vi.mocked(async.execCommandSafe)
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
