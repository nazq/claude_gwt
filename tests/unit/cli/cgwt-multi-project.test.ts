import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    dim: (str: string) => str,
    magenta: (str: string) => str,
    hex: () => (str: string) => str,
  },
}));

// Mock execCommandSafe
vi.mock('../../../src/core/utils/async.js', () => ({
  execCommandSafe: vi.fn(),
}));

import { execCommandSafe } from '../../../src/core/utils/async.js';
import {
  listAllProjects,
  listProjectBranches,
  listActiveSessions,
  attachToSession,
} from '../../../src/cli/cgwt-program.js';

describe('cgwt multi-project support', () => {
  let mockConsoleLog: Mock;
  let mockProcessExit: Mock;
  let mockProcessEnv: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Save original env
    mockProcessEnv = { ...process.env };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = mockProcessEnv;
  });

  describe('listAllProjects', () => {
    it('should list all projects with branch counts', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout:
          'cgwt-project1--main\ncgwt-project1--feature\ncgwt-project2--main\ncgwt-project2--dev\ncgwt-project2--test',
        stderr: '',
      });

      await listAllProjects();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Claude GWT Projects:');
      expect(output).toContain('[0] project1 (2)');
      expect(output).toContain('[1] project2 (3)');
    });

    it('should show active marker for projects with active sessions', async () => {
      process.env['TMUX'] = '1';
      const mockExecCommand = vi.mocked(execCommandSafe);

      // Mock list-sessions
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main\ncgwt-project2--dev',
        stderr: '',
      });

      // Mock display-message for current session
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main',
        stderr: '',
      });

      await listAllProjects();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('● [0] project1 (1)');
      expect(output).toContain('  [1] project2 (1)');
    });

    it('should handle no projects found', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await listAllProjects();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('No Claude GWT projects found.');
    });
  });

  describe('listProjectBranches', () => {
    it('should list branches for a specific project', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout:
          'cgwt-project1--supervisor\ncgwt-project1--main\ncgwt-project1--feature\ncgwt-project2--main',
        stderr: '',
      });

      await listProjectBranches('0');

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('project1 branches:');
      expect(output).toContain('[0.0] project1');
      expect(output).toContain('[SUP]');
      expect(output).toContain('[0.1] project1');
      expect(output).toContain('[0.2] project1');
    });

    it('should handle invalid project index', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main',
        stderr: '',
      });

      await listProjectBranches('5');

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Invalid project index: 5');
      expect(output).toContain('Valid range: 0-0');
    });
  });

  describe('listActiveSessions', () => {
    it('should list only active sessions', async () => {
      process.env['TMUX'] = '1';
      const mockExecCommand = vi.mocked(execCommandSafe);

      // Mock list-sessions
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main\ncgwt-project2--dev\ncgwt-project3--test',
        stderr: '',
      });

      // Mock current session
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project2--dev',
        stderr: '',
      });

      await listActiveSessions();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Active Claude GWT Sessions:');
      expect(output).toContain('● [1.0] project2');
    });

    it('should handle no active sessions', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await listActiveSessions();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('No active Claude GWT sessions.');
    });
  });

  describe('attachToSession', () => {
    it('should attach to session by x.y index', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);

      // Mock list-sessions
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main\ncgwt-project1--feature\ncgwt-project2--main',
        stderr: '',
      });

      // Mock current session (needed for parseSessionsIntoProjects)
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      // Mock switch-client
      process.env['TMUX'] = '1';
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await attachToSession('0.1');

      // The last call should be the switch-client with the correct session
      const calls = mockExecCommand.mock.calls;
      const switchCall = calls.find((call) => call[1][0] === 'switch-client');
      expect(switchCall).toBeDefined();
      expect(switchCall![1]).toEqual(['switch-client', '-t', 'cgwt-project1--main']);
    });

    it('should attach to supervisor with x format', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);

      // Mock list-sessions
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--supervisor\ncgwt-project1--main',
        stderr: '',
      });

      // Mock current session (needed for parseSessionsIntoProjects)
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      // Mock switch-client
      process.env['TMUX'] = '1';
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await attachToSession('0');

      expect(mockExecCommand).toHaveBeenCalledWith('tmux', [
        'switch-client',
        '-t',
        'cgwt-project1--supervisor',
      ]);
    });

    it('should handle invalid project index', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1--main',
        stderr: '',
      });

      // Mock current session (needed for parseSessionsIntoProjects)
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await attachToSession('5.0');

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Invalid project index: 5');
    });

    it('should handle legacy session name format', async () => {
      const mockExecCommand = vi.mocked(execCommandSafe);

      // Mock list-sessions with legacy format
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: 'cgwt-project1-main\ncgwt-project2-dev',
        stderr: '',
      });

      // Mock current session (needed for parseSessionsIntoProjects)
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      // Mock switch-client
      process.env['TMUX'] = '1';
      mockExecCommand.mockResolvedValueOnce({
        code: 0,
        stdout: '',
        stderr: '',
      });

      await attachToSession('1.0');

      expect(mockExecCommand).toHaveBeenCalledWith('tmux', [
        'switch-client',
        '-t',
        'cgwt-project2-dev',
      ]);
    });
  });
});
