import { vi } from 'vitest';
import { TmuxDriver } from '../../../src/sessions/TmuxDriver';
import * as asyncUtils from '../../../src/core/utils/async';

vi.mock('../../../src/core/utils/async');

describe('TmuxDriver', () => {
  const mockExecCommandSafe = asyncUtils.execCommandSafe as vi.MockedFunction<
    typeof asyncUtils.execCommandSafe
  >;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when tmux is available', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '/usr/bin/tmux',
        stderr: '',
        code: 0,
      });

      const result = await TmuxDriver.isAvailable();
      expect(result).toBe(true);
      expect(mockExecCommandSafe).toHaveBeenCalledWith('which', ['tmux']);
    });

    it('should return false when tmux is not available', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'tmux not found',
        code: 1,
      });

      const result = await TmuxDriver.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('isInsideTmux', () => {
    it('should return true when TMUX env var is set', () => {
      const originalTmux = process.env['TMUX'];
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      expect(TmuxDriver.isInsideTmux()).toBe(true);

      if (originalTmux !== undefined) {
        process.env['TMUX'] = originalTmux;
      } else {
        delete process.env['TMUX'];
      }
    });

    it('should return false when TMUX env var is not set', () => {
      const originalTmux = process.env['TMUX'];
      delete process.env['TMUX'];

      expect(TmuxDriver.isInsideTmux()).toBe(false);

      if (originalTmux !== undefined) {
        process.env['TMUX'] = originalTmux;
      }
    });
  });

  describe('listSessions', () => {
    it('should parse session list correctly', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'session1|2|1234567890|1|mygroup\nsession2|3|1234567891|0|\n',
        stderr: '',
        code: 0,
      });

      const sessions = await TmuxDriver.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        name: 'session1',
        windows: 2,
        created: 1234567890,
        attached: true,
        group: 'mygroup',
      });
      expect(sessions[1]).toEqual({
        name: 'session2',
        windows: 3,
        created: 1234567891,
        attached: false,
        group: undefined,
      });
    });

    it('should return empty array on error', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'no sessions',
        code: 1,
      });

      const sessions = await TmuxDriver.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return session info when found', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'session1|2|1234567890|1|\nsession2|3|1234567891|0|\n',
        stderr: '',
        code: 0,
      });

      const session = await TmuxDriver.getSession('session1');
      expect(session).toEqual({
        name: 'session1',
        windows: 2,
        created: 1234567890,
        attached: true,
        group: undefined,
      });
    });

    it('should return null when not found', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'session1|2|1234567890|1|\n',
        stderr: '',
        code: 0,
      });

      const session = await TmuxDriver.getSession('nonexistent');
      expect(session).toBeNull();
    });
  });

  describe('createSession', () => {
    it('should create detached session with all options', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.createSession({
        sessionName: 'test-session',
        workingDirectory: '/home/user/project',
        windowName: 'main',
        detached: true,
        command: 'vim',
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        'test-session',
        '-c',
        '/home/user/project',
        '-n',
        'main',
        'vim',
      ]);
    });

    it('should create attached session when detached is false', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.createSession({
        sessionName: 'test-session',
        detached: false,
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-s',
        'test-session',
      ]);
    });
  });

  describe('killSession', () => {
    it('should kill session with sanitized name', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.killSession('test:session');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'kill-session',
        '-t',
        'test_session',
      ]);
    });
  });

  describe('createWindow', () => {
    it('should create window with all options', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.createWindow({
        sessionName: 'test-session',
        windowName: 'editor',
        workingDirectory: '/home/user',
        command: 'vim',
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'new-window',
        '-t',
        'test-session',
        '-n',
        'editor',
        '-c',
        '/home/user',
        'vim',
      ]);
    });
  });

  describe('listWindows', () => {
    it('should parse window list correctly', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'session1|0|bash|1|2\nsession1|1|vim|0|1\n',
        stderr: '',
        code: 0,
      });

      const windows = await TmuxDriver.listWindows('session1');

      expect(windows).toHaveLength(2);
      expect(windows[0]).toEqual({
        sessionName: 'session1',
        index: 0,
        name: 'bash',
        active: true,
        panes: 2,
      });
    });
  });

  describe('listPanes', () => {
    it('should parse pane list correctly', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '%0|session1|0|0|bash|Terminal\n%1|session1|0|1|vim|Editor\n',
        stderr: '',
        code: 0,
      });

      const panes = await TmuxDriver.listPanes('session1');

      expect(panes).toHaveLength(2);
      expect(panes[0]).toEqual({
        id: '%0',
        sessionName: 'session1',
        windowIndex: 0,
        paneIndex: 0,
        command: 'bash',
        title: 'Terminal',
      });
    });
  });

  describe('sendKeys', () => {
    it('should send keys with Enter', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.sendKeys('session1:0.0', ['echo', 'hello']);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'send-keys',
        '-t',
        'session1:0.0',
        'echo',
        'hello',
        'Enter',
      ]);
    });

    it('should send keys without Enter when specified', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.sendKeys('session1:0.0', ['hello'], false);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'send-keys',
        '-t',
        'session1:0.0',
        'hello',
      ]);
    });
  });

  describe('setOption', () => {
    it('should set global option', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setOption(null, 'mouse', 'on', true);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['set', '-g', 'mouse', 'on']);
    });

    it('should set session option', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setOption('session1', 'status', 'off', false);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'set',
        '-t',
        'session1',
        'status',
        'off',
      ]);
    });
  });

  describe('isPaneRunningCommand', () => {
    it('should return true when command is found', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '%0|session1|0|0|bash|\n%1|session1|0|1|claude|\n',
        stderr: '',
        code: 0,
      });

      const result = await TmuxDriver.isPaneRunningCommand('session1', 'claude');
      expect(result).toBe(true);
    });

    it('should return false when command is not found', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '%0|session1|0|0|bash|\n%1|session1|0|1|vim|\n',
        stderr: '',
        code: 0,
      });

      const result = await TmuxDriver.isPaneRunningCommand('session1', 'claude');
      expect(result).toBe(false);
    });
  });

  describe('bindKey', () => {
    it('should bind key with all options', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.bindKey('C-b', 'split-window -h', 'prefix', true);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'bind-key',
        '-T',
        'prefix',
        '-r',
        'C-b',
        'split-window -h',
      ]);
    });
  });

  describe('splitPane', () => {
    it('should split pane horizontally with percentage', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.splitPane({
        target: 'session1:0.0',
        horizontal: true,
        percentage: 50,
        workingDirectory: '/home/user',
        command: 'vim',
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'session1:0.0',
        '-h',
        '-p',
        '50',
        '-c',
        '/home/user',
        'vim',
      ]);
    });
  });
});
