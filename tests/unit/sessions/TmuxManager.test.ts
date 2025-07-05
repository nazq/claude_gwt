import * as fs from 'fs';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { SessionConfig } from '../../../src/sessions/TmuxManager';

// Mock child_process
jest.mock('child_process', () => ({
  spawnSync: jest.fn().mockReturnValue({
    status: 0,
    signal: null,
    pid: 1234,
    output: [],
    stdout: '',
    stderr: '',
  }),
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/core/utils/logger');

// Mock TmuxEnhancer
jest.mock('../../../src/sessions/TmuxEnhancer');

// Mock TmuxDriver
jest.mock('../../../src/core/drivers/TmuxDriver', () => ({
  TmuxDriver: {
    isAvailable: jest.fn().mockResolvedValue(true),
    isInsideTmux: jest.fn().mockReturnValue(false),
    getSession: jest.fn().mockResolvedValue(null),
    isPaneRunningCommand: jest.fn().mockResolvedValue(false),
    createSession: jest.fn().mockResolvedValue(undefined),
    createWindow: jest.fn().mockResolvedValue(undefined),
    killSession: jest.fn().mockResolvedValue(undefined),
    listSessions: jest.fn().mockResolvedValue([]),
    setOption: jest.fn().mockResolvedValue(undefined),
    getOption: jest.fn().mockResolvedValue(null),
    sendKeys: jest.fn().mockResolvedValue(undefined),
    switchClient: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock ConfigManager
jest.mock('../../../src/core/ConfigManager', () => ({
  ConfigManager: {
    getInstance: jest.fn(() => ({
      getContext: jest.fn().mockReturnValue('test context'),
      get: jest.fn(),
      set: jest.fn(),
    })),
  },
}));

describe('TmuxManager', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['TMUX'];
  });

  afterEach(() => {
    mockProcessExit.mockClear();
  });

  describe('getSessionName', () => {
    it('should generate valid tmux session names', () => {
      expect(TmuxManager.getSessionName('my-repo', 'feature/test')).toBe(
        'cgwt-my-repo-feature-test',
      );
      expect(TmuxManager.getSessionName('repo@2.0', 'fix/bug#123')).toBe(
        'cgwt-repo-2-0-fix-bug-123',
      );
      expect(TmuxManager.getSessionName('--repo--', '--branch--')).toBe('cgwt-repo-branch');
    });

    it('should handle special characters correctly', () => {
      expect(TmuxManager.getSessionName('repo!@#$%', 'branch^&*()')).toBe('cgwt-repo-branch');
      expect(TmuxManager.getSessionName('my.repo', 'my.branch')).toBe('cgwt-my-repo-my-branch');
    });
  });

  describe('isTmuxAvailable', () => {
    it('should return true when tmux is available', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);

      expect(await TmuxManager.isTmuxAvailable()).toBe(true);
    });

    it('should return false when tmux is not available', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(false);

      expect(await TmuxManager.isTmuxAvailable()).toBe(false);
    });
  });

  describe('isInsideTmux', () => {
    it('should return true when inside tmux', () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isInsideTmux.mockReturnValue(true);

      expect(TmuxManager.isInsideTmux()).toBe(true);
    });

    it('should return false when not inside tmux', () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isInsideTmux.mockReturnValue(false);

      expect(TmuxManager.isInsideTmux()).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info when session exists', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getSession.mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 2,
        created: 1234567890,
        attached: true,
      });
      TmuxDriver.isPaneRunningCommand.mockResolvedValue(true);

      const info = await TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toEqual({
        name: 'cgwt-repo-main',
        windows: 2,
        created: '1234567890',
        attached: true,
        hasClaudeRunning: true,
      });
    });

    it('should return null when session does not exist', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getSession.mockResolvedValue(null);

      const info = await TmuxManager.getSessionInfo('non-existent');

      expect(info).toBeNull();
    });

    it('should handle sessions without Claude running', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getSession.mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      TmuxDriver.isPaneRunningCommand.mockResolvedValue(false);

      const info = await TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toEqual({
        name: 'cgwt-repo-main',
        windows: 1,
        created: '1234567890',
        attached: false,
        hasClaudeRunning: false,
      });
    });

    it('should handle errors when checking for Claude', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getSession.mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      TmuxDriver.isPaneRunningCommand.mockRejectedValue(new Error('tmux error'));

      const info = await TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toBeNull();
    });
  });

  describe('launchSession', () => {
    const mockConfig: SessionConfig = {
      sessionName: 'cgwt-repo-main',
      workingDirectory: '/path/to/repo',
      branchName: 'main',
      role: 'child',
    };

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should check tmux availability', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(false);

      await expect(TmuxManager.launchSession(mockConfig)).rejects.toThrow('tmux is not installed');
    });

    it('should create context file', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue(null);

      await TmuxManager.launchSession(mockConfig);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/path/to/repo/.claude-context.md',
        expect.stringContaining('test context'),
      );
    });

    it('should create new session when it does not exist', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue(null);
      TmuxDriver.isInsideTmux.mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      // Should exit after creating session since it's attached
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should restart Claude in existing session without Claude', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      TmuxDriver.isPaneRunningCommand.mockResolvedValue(false);
      TmuxDriver.isInsideTmux.mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      expect(TmuxDriver.createWindow).toHaveBeenCalled();
    });

    it('should attach to existing session with Claude running', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      TmuxDriver.isPaneRunningCommand.mockResolvedValue(true);
      TmuxDriver.isInsideTmux.mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      // Should exit after attaching to session
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle being inside tmux differently', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue(null);
      TmuxDriver.isInsideTmux.mockReturnValue(true);

      await TmuxManager.launchSession(mockConfig);

      expect(TmuxDriver.switchClient).toHaveBeenCalledWith('cgwt-repo-main');
    });
  });

  describe('createDetachedSession', () => {
    const mockConfig: SessionConfig = {
      sessionName: 'cgwt-repo-feature',
      workingDirectory: '/path/to/repo/feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should create a detached session', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isAvailable.mockResolvedValue(true);
      TmuxDriver.getSession.mockResolvedValue(null);

      await TmuxManager.createDetachedSession(mockConfig);

      expect(TmuxDriver.createSession).toHaveBeenCalledWith({
        sessionName: 'cgwt-repo-feature',
        workingDirectory: '/path/to/repo/feature',
        windowName: 'claude',
        detached: true,
      });
      expect(TmuxDriver.sendKeys).toHaveBeenCalled();
    });
  });

  describe('attachToSession', () => {
    it('should use switch-client when inside tmux', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isInsideTmux.mockReturnValue(true);

      await TmuxManager.attachToSession('cgwt-repo-main');

      expect(TmuxDriver.switchClient).toHaveBeenCalledWith('cgwt-repo-main');
    });

    it('should use attach-session when outside tmux', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.isInsideTmux.mockReturnValue(false);

      await TmuxManager.attachToSession('cgwt-repo-main');

      // Should exit after attaching to session
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('killSession', () => {
    it('should kill the specified session', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');

      await TmuxManager.killSession('cgwt-repo-main');

      expect(TmuxDriver.killSession).toHaveBeenCalledWith('cgwt-repo-main');
    });
  });

  describe('listSessions', () => {
    it('should return list of cgwt sessions', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.listSessions.mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'other-session', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for cgwt sessions
      TmuxDriver.getSession
        .mockResolvedValueOnce({
          name: 'cgwt-repo-main',
          windows: 2,
          created: 1234567890,
          attached: true,
        })
        .mockResolvedValueOnce({
          name: 'cgwt-repo-feature',
          windows: 1,
          created: 1234567891,
          attached: false,
        });

      TmuxDriver.isPaneRunningCommand.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const sessions = await TmuxManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        name: 'cgwt-repo-main',
        windows: 2,
        created: '1234567890',
        attached: true,
        hasClaudeRunning: true,
      });
      expect(sessions[1]).toEqual({
        name: 'cgwt-repo-feature',
        windows: 1,
        created: '1234567891',
        attached: false,
        hasClaudeRunning: false,
      });
    });

    it('should return empty array when no sessions exist', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.listSessions.mockRejectedValue(new Error('no sessions'));

      const sessions = await TmuxManager.listSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('shutdownAll', () => {
    it('should kill all cgwt sessions', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.listSessions.mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'other-session', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for cgwt sessions
      TmuxDriver.getSession
        .mockResolvedValueOnce({
          name: 'cgwt-repo-main',
          windows: 2,
          created: 1234567890,
          attached: true,
        })
        .mockResolvedValueOnce({
          name: 'cgwt-repo-feature',
          windows: 1,
          created: 1234567891,
          attached: false,
        });

      TmuxDriver.isPaneRunningCommand.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await TmuxManager.shutdownAll();

      expect(TmuxDriver.killSession).toHaveBeenCalledWith('cgwt-repo-feature');
      expect(TmuxDriver.killSession).toHaveBeenCalledWith('cgwt-repo-main');
      expect(TmuxDriver.killSession).not.toHaveBeenCalledWith('other-session');
    });
  });

  describe('createComparisonLayout', () => {
    it('should create comparison layout for two branches', () => {
      TmuxManager.createComparisonLayout(
        'cgwt-repo-supervisor',
        ['main', 'feature'],
        'test-project',
      );

      expect(TmuxEnhancer.createComparisonLayout).toHaveBeenCalledWith(
        'cgwt-repo-supervisor',
        ['main', 'feature'],
        'test-project',
      );
    });
  });

  describe('toggleSynchronizedPanes', () => {
    it('should toggle pane synchronization', () => {
      (TmuxEnhancer.toggleSynchronizedPanes as jest.Mock).mockReturnValue(true);

      const result = TmuxManager.toggleSynchronizedPanes('cgwt-repo-main');

      expect(result).toBe(true);
      expect(TmuxEnhancer.toggleSynchronizedPanes).toHaveBeenCalledWith('cgwt-repo-main');
    });
  });

  describe('getPredefinedLayouts', () => {
    it('should return predefined layouts from TmuxEnhancer', () => {
      const mockLayouts = [
        { name: 'test', description: 'test layout', branches: [], layout: 'tiled' as const },
      ];
      (TmuxEnhancer.getPredefinedLayouts as jest.Mock).mockReturnValue(mockLayouts);

      const layouts = TmuxManager.getPredefinedLayouts();

      expect(layouts).toEqual(mockLayouts);
    });
  });

  describe('getSessionGroup', () => {
    it('should return session group name', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getOption.mockResolvedValue('cgwt-repo');

      const group = await TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBe('cgwt-repo');
    });

    it('should return null when session has no group', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');
      TmuxDriver.getOption.mockRejectedValue(new Error('no group'));

      const group = await TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBeNull();
    });
  });

  describe('getSessionsInGroup', () => {
    it('should return sessions in the specified group', async () => {
      const { TmuxDriver } = require('../../../src/core/drivers/TmuxDriver');

      // Mock listSessions
      TmuxDriver.listSessions.mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'cgwt-other-main', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for all sessions
      TmuxDriver.getSession
        .mockResolvedValueOnce({
          name: 'cgwt-repo-main',
          windows: 2,
          created: 1234567890,
          attached: true,
        })
        .mockResolvedValueOnce({
          name: 'cgwt-repo-feature',
          windows: 1,
          created: 1234567891,
          attached: false,
        })
        .mockResolvedValueOnce({
          name: 'cgwt-other-main',
          windows: 1,
          created: 1234567892,
          attached: false,
        });

      TmuxDriver.isPaneRunningCommand
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      // Mock getSessionGroup for each session
      TmuxDriver.getOption
        .mockResolvedValueOnce('cgwt-repo')
        .mockResolvedValueOnce('cgwt-repo')
        .mockResolvedValueOnce('cgwt-other');

      const sessions = await TmuxManager.getSessionsInGroup('cgwt-repo');

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.name).toBe('cgwt-repo-main');
      expect(sessions[1]?.name).toBe('cgwt-repo-feature');
    });
  });
});
