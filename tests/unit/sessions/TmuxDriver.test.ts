import { vi } from 'vitest';
import {
  TmuxDriver,
  TmuxStatusPosition,
  TmuxStatusJustify,
  TmuxColor,
  TmuxKeyTable,
  TmuxPaneBorderStatus,
  TmuxHook,
  TmuxLayout,
} from '../../../src/sessions/TmuxDriver';
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

    it('should split pane vertically without horizontal flag', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.splitPane({
        target: 'session1:0.0',
        horizontal: false,
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'session1:0.0',
        '-v',
      ]);
    });

    it('should split pane without percentage', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.splitPane({
        target: 'session1:0.0',
        horizontal: true,
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'session1:0.0',
        '-h',
      ]);
    });

    it('should split pane without working directory', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.splitPane({
        target: 'session1:0.0',
        horizontal: true,
        percentage: 30,
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'session1:0.0',
        '-h',
        '-p',
        '30',
      ]);
    });

    it('should split pane without command', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.splitPane({
        target: 'session1:0.0',
        horizontal: false,
        workingDirectory: '/home/user',
      });

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'session1:0.0',
        '-v',
        '-c',
        '/home/user',
      ]);
    });
  });

  // Error handling tests
  describe('error handling', () => {
    it('should handle listSessions error', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const sessions = await TmuxDriver.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should handle listSessions non-zero exit code', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'no sessions',
        code: 1,
      });

      const sessions = await TmuxDriver.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should handle listWindows error', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const windows = await TmuxDriver.listWindows('test-session');

      expect(windows).toEqual([]);
    });

    it('should handle listWindows non-zero exit code', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'no windows',
        code: 1,
      });

      const windows = await TmuxDriver.listWindows('test-session');

      expect(windows).toEqual([]);
    });

    it('should handle listPanes error', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const panes = await TmuxDriver.listPanes('test-session');

      expect(panes).toEqual([]);
    });

    it('should handle listPanes non-zero exit code', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'no panes',
        code: 1,
      });

      const panes = await TmuxDriver.listPanes('test-session');

      expect(panes).toEqual([]);
    });
  });

  // Utility methods tests
  describe('utility methods', () => {
    describe('setPaneBorderStatus', () => {
      it('should set pane border status to top', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setPaneBorderStatus('session1', 'top');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'session1',
          'pane-border-status',
          'top',
        ]);
      });

      it('should set pane border status to bottom', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setPaneBorderStatus('session1', 'bottom');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'session1',
          'pane-border-status',
          'bottom',
        ]);
      });

      it('should set pane border status to off', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setPaneBorderStatus('session1', 'off');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'session1',
          'pane-border-status',
          'off',
        ]);
      });
    });

    describe('refreshClient', () => {
      it('should refresh client without target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.refreshClient();

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['refresh-client']);
      });

      it('should refresh client with target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.refreshClient('session1');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'refresh-client',
          '-t',
          'session1',
        ]);
      });
    });

    describe('Additional uncovered methods', () => {
      it('should handle attachSession', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.attachSession('test-session');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'attach-session',
          '-t',
          'test-session',
        ]);
      });

      it('should handle switchClient', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.switchClient('test-session');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'switch-client',
          '-t',
          'test-session',
        ]);
      });

      it('should handle unbindKey', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.unbindKey('C-b');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['unbind-key', 'C-b']);
      });

      it('should handle unbindKey with table', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.unbindKey('v', 'copy-mode-vi');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'unbind-key',
          '-T',
          'copy-mode-vi',
          'v',
        ]);
      });

      it('should handle setWindowOption', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setWindowOption('session1', 'automatic-rename', 'off');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'setw',
          '-t',
          'session1',
          'automatic-rename',
          'off',
        ]);
      });

      it('should handle getOption', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: 'on',
          stderr: '',
          code: 0,
        });

        const result = await TmuxDriver.getOption('session1', 'mouse');

        expect(result).toBe('on');
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'show',
          '-t',
          'session1',
          '-v',
          'mouse',
        ]);
      });

      it('should handle getOption error', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: 'unknown option',
          code: 1,
        });

        const result = await TmuxDriver.getOption('session1', 'invalid');

        expect(result).toBeNull();
      });

      it('should handle killPane', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.killPane('session1:0.1');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'kill-pane',
          '-t',
          'session1:0.1',
        ]);
      });

      it('should handle killPane with killAll flag', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.killPane('session1:0', true);

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'kill-pane',
          '-a',
          '-t',
          'session1:0',
        ]);
      });

      it('should handle setPaneTitle', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setPaneTitle('session1:0.1', 'Editor');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'select-pane',
          '-t',
          'session1:0.1',
          '-T',
          'Editor',
        ]);
      });

      it('should handle setHook', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setHook('window-linked', 'display-message "Window linked"');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set-hook',
          '-g',
          'window-linked',
          'display-message "Window linked"',
        ]);
      });

      it('should handle displayMessage without target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.displayMessage('Hello, World!');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'display-message',
          'Hello, World!',
        ]);
      });

      it('should handle displayMessage with target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.displayMessage('Hello, Session!', 'test-session');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'display-message',
          '-t',
          'test-session',
          'Hello, Session!',
        ]);
      });

      it('should handle synchronizePanes enabled', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.synchronizePanes('test-session:1', true);

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'setw',
          '-t',
          'test-session:1',
          'synchronize-panes',
          'on',
        ]);
      });

      it('should handle synchronizePanes disabled', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.synchronizePanes('test-session:1', false);

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'setw',
          '-t',
          'test-session:1',
          'synchronize-panes',
          'off',
        ]);
      });

      it('should handle setPaneBorderStatus', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.setPaneBorderStatus('test-session', 'top');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'pane-border-status',
          'top',
        ]);
      });

      it('should handle refreshClient without target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.refreshClient();

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['refresh-client']);
      });

      it('should handle refreshClient with target', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.refreshClient('test-session');

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'refresh-client',
          '-t',
          'test-session',
        ]);
      });
    });

    describe('SDK methods', () => {
      it('should configure status bar', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.configureStatusBar('test-session', {
          enabled: true,
          position: TmuxStatusPosition.Bottom,
          interval: 5,
          justify: TmuxStatusJustify.Centre,
          style: {
            background: TmuxColor.from(32),
            foreground: TmuxColor.from(255),
          },
          left: 'left content',
          right: 'right content',
        });

        // Should be called multiple times for different options
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status',
          'on',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-position',
          'bottom',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-interval',
          '5',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-justify',
          'centre',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-style',
          'bg=colour32,fg=colour255',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-left',
          'left content',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status-right',
          'right content',
        ]);
      });

      it('should configure status bar with partial config', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.configureStatusBar('test-session', {
          enabled: false,
        });

        // Should only set the provided options
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'status',
          'off',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledTimes(1);
      });

      it('should configure key bindings', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.configureKeyBindings([
          { key: 'h', command: 'select-pane -L' },
          { key: 'H', command: 'resize-pane -L 5', table: TmuxKeyTable.Root, repeat: true },
        ]);

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'bind-key',
          'h',
          'select-pane -L',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'bind-key',
          '-T',
          'root',
          '-r',
          'H',
          'resize-pane -L 5',
        ]);
      });

      it('should configure pane borders', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.configurePaneBorders('test-session', {
          status: TmuxPaneBorderStatus.Top,
          style: {
            inactive: 'fg=colour240',
            active: 'fg=colour32,bold',
          },
          format: '#{pane_title}',
        });

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'pane-border-status',
          'top',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'pane-border-style',
          'fg=colour240',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'pane-active-border-style',
          'fg=colour32,bold',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-t',
          'test-session',
          'pane-border-format',
          '#{pane_title}',
        ]);
      });

      it('should enable vi copy mode', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.enableViCopyMode('test-session');

        // Should set vi mode
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-g',
          '-t',
          'test-session',
          'mode-keys',
          'vi',
        ]);
        // Should enable mouse
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set',
          '-g',
          '-t',
          'test-session',
          'mouse',
          'on',
        ]);
        // Should configure copy bindings
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'bind-key',
          '-T',
          'copy-mode-vi',
          'v',
          'send-keys -X begin-selection',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'bind-key',
          '-T',
          'copy-mode-vi',
          'y',
          'send-keys -X copy-selection-and-cancel',
        ]);
        // Should unbind mouse drag
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['unbind-key', 'MouseDrag1Pane']);
      });

      it('should configure monitoring', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.configureMonitoring('test-session', {
          [TmuxHook.AlertActivity]: 'display-message "Activity"',
          [TmuxHook.SessionCreated]: 'display-message "Created"',
        });

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set-hook',
          '-g',
          'alert-activity',
          'display-message "Activity"',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'set-hook',
          '-g',
          'session-created',
          'display-message "Created"',
        ]);
      });

      it('should apply layout', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.applyLayout('test-session:1', TmuxLayout.EvenHorizontal);

        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'send-keys',
          '-t',
          'test-session:1',
          'select-layout even-horizontal',
        ]);
      });

      it('should create multi-pane window', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        await TmuxDriver.createMultiPaneWindow('test-session', 'multi', 3, TmuxLayout.Tiled);

        // Should create window
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'new-window',
          '-t',
          'test-session',
          '-n',
          'multi',
        ]);
        // Should split panes
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'split-window',
          '-t',
          'test-session:multi',
          '-v',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'split-window',
          '-t',
          'test-session:multi',
          '-h',
        ]);
        // Should apply layout
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'send-keys',
          '-t',
          'test-session:multi',
          'select-layout tiled',
        ]);
      });

      it('should create layout builder', () => {
        const builder = TmuxDriver.createLayoutBuilder('test-session');
        expect(builder).toBeDefined();
        expect(builder.addPane).toBeDefined();
        expect(builder.build).toBeDefined();
      });
    });

    describe('TmuxColor', () => {
      it('should create colors from numbers', () => {
        expect(TmuxColor.from(0).toString()).toBe('colour0');
        expect(TmuxColor.from(42).toString()).toBe('colour42');
        expect(TmuxColor.from(128).toString()).toBe('colour128');
        expect(TmuxColor.from(255).toString()).toBe('colour255');
      });

      it('should throw error for invalid color numbers', () => {
        expect(() => TmuxColor.from(-1)).toThrow('Color number must be between 0 and 255');
        expect(() => TmuxColor.from(256)).toThrow('Color number must be between 0 and 255');
        expect(() => TmuxColor.from(1000)).toThrow('Color number must be between 0 and 255');
      });

      it('should work with decimal numbers by truncating', () => {
        expect(TmuxColor.from(42.7).toString()).toBe('colour42');
        expect(TmuxColor.from(128.1).toString()).toBe('colour128');
      });

      it('should have standard color constants', () => {
        expect(TmuxColor.Black.toString()).toBe('black');
        expect(TmuxColor.Red.toString()).toBe('red');
        expect(TmuxColor.Green.toString()).toBe('green');
        expect(TmuxColor.Yellow.toString()).toBe('yellow');
        expect(TmuxColor.Blue.toString()).toBe('blue');
        expect(TmuxColor.Magenta.toString()).toBe('magenta');
        expect(TmuxColor.Cyan.toString()).toBe('cyan');
        expect(TmuxColor.White.toString()).toBe('white');
        expect(TmuxColor.Default.toString()).toBe('default');
      });

      it('should create colors from strings', () => {
        expect(TmuxColor.fromString('custom').toString()).toBe('custom');
        expect(TmuxColor.fromString('colour100').toString()).toBe('colour100');
      });
    });

    describe('TmuxLayoutBuilder', () => {
      it('should build layout with multiple panes', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        const builder = TmuxDriver.createLayoutBuilder('test-session');
        builder
          .addPane({ command: 'vim', workingDirectory: '/src', title: 'Editor' })
          .addPane({ command: 'npm run dev', workingDirectory: '/src', title: 'Dev Server' })
          .addPane({ command: 'git status', workingDirectory: '/src', title: 'Git' });

        await builder.build('dev', TmuxLayout.Tiled);

        // Should create window with first pane
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'new-window',
          '-t',
          'test-session',
          '-n',
          'dev',
          '-c',
          '/src',
          'vim',
        ]);
        // Should split for additional panes
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'split-window',
          '-t',
          'test-session:dev',
          '-v',
          '-c',
          '/src',
          'npm run dev',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'split-window',
          '-t',
          'test-session:dev',
          '-h',
          '-c',
          '/src',
          'git status',
        ]);
        // Should set pane titles
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'select-pane',
          '-t',
          'test-session:dev.1',
          '-T',
          'Dev Server',
        ]);
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'select-pane',
          '-t',
          'test-session:dev.2',
          '-T',
          'Git',
        ]);
        // Should apply layout
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'send-keys',
          '-t',
          'test-session:dev',
          'select-layout tiled',
        ]);
      });

      it('should handle empty builder', async () => {
        const builder = TmuxDriver.createLayoutBuilder('test-session');
        await builder.build('empty', TmuxLayout.Tiled);

        // Should not call any commands
        expect(mockExecCommandSafe).not.toHaveBeenCalled();
      });

      it('should handle single pane', async () => {
        mockExecCommandSafe.mockResolvedValue({
          stdout: '',
          stderr: '',
          code: 0,
        });

        const builder = TmuxDriver.createLayoutBuilder('test-session');
        builder.addPane({ command: 'vim' });

        await builder.build('single', TmuxLayout.Tiled);

        // Should only create window
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'new-window',
          '-t',
          'test-session',
          '-n',
          'single',
          'vim',
        ]);
        // Should apply layout even for single pane
        expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
          'send-keys',
          '-t',
          'test-session:single',
          'select-layout tiled',
        ]);
        // Should not split or set titles
        expect(mockExecCommandSafe).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getVersion', () => {
    it('should parse version from tmux output', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'tmux 3.2a',
        stderr: '',
        code: 0,
      });

      const version = await TmuxDriver.getVersion();
      expect(version).toBe('tmux 3.2a');
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['-V']);
    });

    it('should return null on error', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        code: 1,
      });

      const version = await TmuxDriver.getVersion();
      expect(version).toBeNull();
    });

    it('should handle malformed version output', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'invalid output',
        stderr: '',
        code: 0,
      });

      const version = await TmuxDriver.getVersion();
      expect(version).toBe('invalid output');
    });
  });

  describe('sessionExists', () => {
    it('should return true when session exists', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'session1|2|1234567890|1|',
        stderr: '',
        code: 0,
      });

      const exists = await TmuxDriver.sessionExists('session1');
      expect(exists).toBe(true);
    });

    it('should return false when session does not exist', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'session not found',
        code: 1,
      });

      const exists = await TmuxDriver.sessionExists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('attachSession', () => {
    it('should attach to session', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.attachSession('test-session');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'attach-session',
        '-t',
        'test-session',
      ]);
    });
  });

  describe('switchClient', () => {
    it('should switch client to session', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.switchClient('test-session');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'switch-client',
        '-t',
        'test-session',
      ]);
    });
  });

  describe('setWindowOption', () => {
    it('should set window option', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setWindowOption('session1', 'synchronize-panes', 'on');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'setw',
        '-t',
        'session1',
        'synchronize-panes',
        'on',
      ]);
    });
  });

  describe('getOption', () => {
    it('should get option value', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: 'on',
        stderr: '',
        code: 0,
      });

      const value = await TmuxDriver.getOption('session1', 'mouse');
      expect(value).toBe('on');
      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'show',
        '-t',
        'session1',
        '-v',
        'mouse',
      ]);
    });

    it('should return null on error', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: 'option not found',
        code: 1,
      });

      const value = await TmuxDriver.getOption('session1', 'nonexistent');
      expect(value).toBeNull();
    });
  });

  describe('killPane', () => {
    it('should kill specific pane', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.killPane('session1:0.1');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['kill-pane', '-t', 'session1:0.1']);
    });

    it('should kill all panes when all=true', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.killPane('session1:0', true);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'kill-pane',
        '-a',
        '-t',
        'session1:0',
      ]);
    });
  });

  describe('selectPane', () => {
    it('should select pane', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.selectPane('session1:0.1');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        'session1:0.1',
      ]);
    });
  });

  describe('setPaneTitle', () => {
    it('should set pane title', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setPaneTitle('session1:0.1', 'Editor');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        'session1:0.1',
        '-T',
        'Editor',
      ]);
    });
  });

  describe('unbindKey', () => {
    it('should unbind key with table', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.unbindKey('C-b', 'prefix');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'unbind-key',
        '-T',
        'prefix',
        'C-b',
      ]);
    });

    it('should unbind key without table', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.unbindKey('C-b');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['unbind-key', 'C-b']);
    });
  });

  describe('setHook', () => {
    it('should set hook', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setHook('session-created', 'display-message "Session created"');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'set-hook',
        '-g',
        'session-created',
        'display-message "Session created"',
      ]);
    });
  });

  describe('displayMessage', () => {
    it('should display message to all clients', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.displayMessage('Hello World');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['display-message', 'Hello World']);
    });

    it('should display message to specific target', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.displayMessage('Hello World', 'session1');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'display-message',
        '-t',
        'session1',
        'Hello World',
      ]);
    });
  });

  describe('synchronizePanes', () => {
    it('should enable synchronized panes', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.synchronizePanes('session1:0', true);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'setw',
        '-t',
        'session1:0',
        'synchronize-panes',
        'on',
      ]);
    });

    it('should disable synchronized panes', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.synchronizePanes('session1:0', false);

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'setw',
        '-t',
        'session1:0',
        'synchronize-panes',
        'off',
      ]);
    });
  });

  describe('setPaneBorderStatus', () => {
    it('should set pane border status', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.setPaneBorderStatus('session1:0', 'top');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'set',
        '-t',
        'session1:0',
        'pane-border-status',
        'top',
      ]);
    });
  });

  describe('refreshClient', () => {
    it('should refresh all clients when no target specified', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.refreshClient();

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', ['refresh-client']);
    });

    it('should refresh specific client when target specified', async () => {
      mockExecCommandSafe.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await TmuxDriver.refreshClient('session1');

      expect(mockExecCommandSafe).toHaveBeenCalledWith('tmux', [
        'refresh-client',
        '-t',
        'session1',
      ]);
    });
  });

  describe('error handling coverage', () => {
    it('should handle isAvailable errors', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const result = await TmuxDriver.isAvailable();
      expect(result).toBe(false);
    });

    it('should handle listSessions errors', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const sessions = await TmuxDriver.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should handle listWindows errors', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const windows = await TmuxDriver.listWindows('session1');
      expect(windows).toEqual([]);
    });

    it('should handle listPanes errors', async () => {
      mockExecCommandSafe.mockRejectedValue(new Error('Command failed'));

      const panes = await TmuxDriver.listPanes('session1');
      expect(panes).toEqual([]);
    });
  });
});
