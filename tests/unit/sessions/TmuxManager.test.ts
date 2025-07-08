import { vi } from 'vitest';
import * as fs from 'fs';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver } from '../../../src/sessions/TmuxDriver';
import type { SessionConfig } from '../../../src/sessions/TmuxManager';

// Mock child_process
vi.mock('child_process', () => ({
  spawnSync: vi.fn().mockReturnValue({
    status: 0,
    signal: null,
    pid: 1234,
    output: [],
    stdout: '',
    stderr: '',
  }),
  exec: vi.fn((cmd, cb) => {
    if (cb) {
      cb(null, '', '');
    }
  }),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/core/utils/logger');

// Mock TmuxDriver
vi.mock('../../../src/sessions/TmuxDriver');

// Mock TmuxEnhancer
vi.mock('../../../src/sessions/TmuxEnhancer');

// Mock ConfigManager
vi.mock('../../../src/core/ConfigManager', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => ({
      getContext: vi.fn().mockReturnValue('test context'),
      get: vi.fn(),
      set: vi.fn(),
    })),
  },
}));

describe('TmuxManager', () => {
  const mockFs = fs as vi.Mocked<typeof fs>;
  const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['TMUX'];

    // Set up default mock implementations
    vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
    vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);
    vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);
    vi.mocked(TmuxDriver.isPaneRunningCommand).mockResolvedValue(false);
    vi.mocked(TmuxDriver.createSession).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    vi.mocked(TmuxDriver.createWindow).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    vi.mocked(TmuxDriver.killSession).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    vi.mocked(TmuxDriver.listSessions).mockResolvedValue([]);
    vi.mocked(TmuxDriver.setOption).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    vi.mocked(TmuxDriver.getOption).mockResolvedValue(null);
    vi.mocked(TmuxDriver.sendKeys).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    vi.mocked(TmuxDriver.switchClient).mockResolvedValue({ code: 0, stdout: '', stderr: '' });

    // Mock TmuxEnhancerV2 methods
    vi.mocked(TmuxEnhancer.createComparisonLayout).mockImplementation(() => {});
    vi.mocked(TmuxEnhancer.toggleSynchronizedPanes).mockReturnValue(true);
    vi.mocked(TmuxEnhancer.createDashboardWindow).mockImplementation(() => {});
    vi.mocked(TmuxEnhancer.getPredefinedLayouts).mockReturnValue([
      {
        name: 'main-feature',
        description: 'Main branch and feature branch side by side',
        branches: ['main', 'feature/*'],
        layout: 'even-horizontal',
      },
      {
        name: 'triple-review',
        description: 'Three branches for code review',
        branches: ['main', 'develop', 'feature/*'],
        layout: 'even-horizontal',
      },
      {
        name: 'quad-split',
        description: 'Four branches in grid layout',
        branches: ['*', '*', '*', '*'],
        layout: 'tiled',
      },
      {
        name: 'main-develop',
        description: 'Main branch with develop branch below',
        branches: ['main', 'develop'],
        layout: 'main-horizontal',
      },
    ]);
    vi.mocked(TmuxDriver.attachSession).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  afterEach(() => {
    mockProcessExit.mockClear();
  });

  describe('getSessionName', () => {
    it('should generate valid tmux session names', () => {
      expect(TmuxManager.getSessionName('my-repo', 'feature/test')).toBe(
        'cgwt-my-repo--feature-test',
      );
      expect(TmuxManager.getSessionName('repo@2.0', 'fix/bug#123')).toBe(
        'cgwt-repo-2-0--fix-bug-123',
      );
      expect(TmuxManager.getSessionName('--repo--', '--branch--')).toBe('cgwt-repo--branch');
    });

    it('should handle special characters correctly', () => {
      expect(TmuxManager.getSessionName('repo!@#$%', 'branch^&*()')).toBe('cgwt-repo--branch');
      expect(TmuxManager.getSessionName('my.repo', 'my.branch')).toBe('cgwt-my-repo--my-branch');
    });
  });

  describe('isTmuxAvailable', () => {
    it('should return true when tmux is available', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);

      expect(await TmuxManager.isTmuxAvailable()).toBe(true);
    });

    it('should return false when tmux is not available', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(false);

      expect(await TmuxManager.isTmuxAvailable()).toBe(false);
    });
  });

  describe('isInsideTmux', () => {
    it('should return true when inside tmux', () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      expect(TmuxManager.isInsideTmux()).toBe(true);
    });

    it('should return false when not inside tmux', () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      expect(TmuxManager.isInsideTmux()).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info when session exists', async () => {
      vi.mocked(TmuxDriver.getSession).mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 2,
        created: 1234567890,
        attached: true,
      });
      vi.mocked(TmuxDriver.isPaneRunningCommand).mockResolvedValue(true);

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
      vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);

      const info = await TmuxManager.getSessionInfo('non-existent');

      expect(info).toBeNull();
    });

    it('should handle sessions without Claude running', async () => {
      vi.mocked(TmuxDriver.getSession).mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      vi.mocked(TmuxDriver.isPaneRunningCommand).mockResolvedValue(false);

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
      vi.mocked(TmuxDriver.getSession).mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      vi.mocked(TmuxDriver.isPaneRunningCommand).mockRejectedValue(new Error('tmux error'));

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
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(false);

      await expect(TmuxManager.launchSession(mockConfig)).rejects.toThrow('tmux is not installed');
    });

    it('should create context file', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);

      await TmuxManager.launchSession(mockConfig);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/path/to/repo/.claude-context.md',
        expect.stringContaining('test context'),
      );
    });

    it('should create new session when it does not exist', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      // Should exit after creating session since it's attached
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should restart Claude in existing session without Claude', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      vi.mocked(TmuxDriver.isPaneRunningCommand).mockResolvedValue(false);
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      expect(TmuxDriver.createWindow).toHaveBeenCalled();
    });

    it('should attach to existing session with Claude running', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue({
        name: 'cgwt-repo-main',
        windows: 1,
        created: 1234567890,
        attached: false,
      });
      vi.mocked(TmuxDriver.isPaneRunningCommand).mockResolvedValue(true);
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      await TmuxManager.launchSession(mockConfig);

      // Should exit after attaching to session
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle being inside tmux differently', async () => {
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

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
      vi.mocked(TmuxDriver.isAvailable).mockResolvedValue(true);
      vi.mocked(TmuxDriver.getSession).mockResolvedValue(null);

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
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await TmuxManager.attachToSession('cgwt-repo-main');

      expect(TmuxDriver.switchClient).toHaveBeenCalledWith('cgwt-repo-main');
    });

    it('should use attach-session when outside tmux', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      await TmuxManager.attachToSession('cgwt-repo-main');

      // Should exit after attaching to session
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('killSession', () => {
    it('should kill the specified session', async () => {
      await TmuxManager.killSession('cgwt-repo-main');

      expect(TmuxDriver.killSession).toHaveBeenCalledWith('cgwt-repo-main');
    });
  });

  describe('listSessions', () => {
    it('should return list of cgwt sessions', async () => {
      vi.mocked(TmuxDriver.listSessions).mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'other-session', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for cgwt sessions
      vi.mocked(TmuxDriver.getSession)
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

      vi.mocked(TmuxDriver.isPaneRunningCommand)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

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
      vi.mocked(TmuxDriver.listSessions).mockRejectedValue(new Error('no sessions'));

      const sessions = await TmuxManager.listSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('shutdownAll', () => {
    it('should kill all cgwt sessions', async () => {
      vi.mocked(TmuxDriver.listSessions).mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'other-session', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for cgwt sessions
      vi.mocked(TmuxDriver.getSession)
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

      vi.mocked(TmuxDriver.isPaneRunningCommand)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

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
      (TmuxEnhancer.toggleSynchronizedPanes as vi.Mock).mockReturnValue(true);

      const result = TmuxManager.toggleSynchronizedPanes('cgwt-repo-main');

      expect(result).toBe(true);
      expect(TmuxEnhancer.toggleSynchronizedPanes).toHaveBeenCalledWith('cgwt-repo-main');
    });
  });

  describe('getPredefinedLayouts', () => {
    it('should return predefined layouts from TmuxEnhancer', () => {
      const layouts = TmuxManager.getPredefinedLayouts();

      expect(layouts).toEqual([
        {
          name: 'main-feature',
          description: 'Main branch and feature branch side by side',
          branches: ['main', 'feature/*'],
          layout: 'even-horizontal',
        },
        {
          name: 'triple-review',
          description: 'Three branches for code review',
          branches: ['main', 'develop', 'feature/*'],
          layout: 'even-horizontal',
        },
        {
          name: 'quad-split',
          description: 'Four branches in grid layout',
          branches: ['*', '*', '*', '*'],
          layout: 'tiled',
        },
        {
          name: 'main-develop',
          description: 'Main branch with develop branch below',
          branches: ['main', 'develop'],
          layout: 'main-horizontal',
        },
      ]);
    });
  });

  describe('getSessionGroup', () => {
    it('should return session group name', async () => {
      vi.mocked(TmuxDriver.getOption).mockResolvedValue('cgwt-repo');

      const group = await TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBe('cgwt-repo');
    });

    it('should return null when session has no group', async () => {
      vi.mocked(TmuxDriver.getOption).mockRejectedValue(new Error('no group'));

      const group = await TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBeNull();
    });
  });

  describe('getSessionsInGroup', () => {
    it('should return sessions in the specified group', async () => {
      // Mock listSessions
      vi.mocked(TmuxDriver.listSessions).mockResolvedValue([
        { name: 'cgwt-repo-main', windows: 2, created: 1234567890, attached: true },
        { name: 'cgwt-repo-feature', windows: 1, created: 1234567891, attached: false },
        { name: 'cgwt-other-main', windows: 1, created: 1234567892, attached: false },
      ]);

      // Mock getSessionInfo for all sessions
      vi.mocked(TmuxDriver.getSession)
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

      vi.mocked(TmuxDriver.isPaneRunningCommand)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      // Mock getSessionGroup for each session
      vi.mocked(TmuxDriver.getOption)
        .mockResolvedValueOnce('cgwt-repo')
        .mockResolvedValueOnce('cgwt-repo')
        .mockResolvedValueOnce('cgwt-other');

      const sessions = await TmuxManager.getSessionsInGroup('cgwt-repo');

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.name).toBe('cgwt-repo-main');
      expect(sessions[1]?.name).toBe('cgwt-repo-feature');
    });
  });

  describe('createDashboard', () => {
    it('should create dashboard window', () => {
      TmuxManager.createDashboard(
        'cgwt-repo-supervisor',
        ['main', 'develop'],
        '/path/to/worktrees',
      );

      expect(TmuxEnhancer.createDashboardWindow).toHaveBeenCalledWith(
        'cgwt-repo-supervisor',
        ['main', 'develop'],
        '/path/to/worktrees',
      );
    });
  });

  describe('enhanceSession', () => {
    it('should enhance existing session', async () => {
      await TmuxManager.enhanceSession('cgwt-repo-main', {
        branchName: 'main',
        role: 'supervisor',
      });

      expect(TmuxEnhancer.configureSession).toHaveBeenCalledWith('cgwt-repo-main', {
        sessionName: 'cgwt-repo-main',
        branchName: 'main',
        role: 'supervisor',
      });
    });

    it('should enhance session with git repository', async () => {
      const mockGitRepo = { fetch: vi.fn() } as any;

      await TmuxManager.enhanceSession('cgwt-repo-feature', {
        branchName: 'feature-branch',
        role: 'child',
        gitRepo: mockGitRepo,
      });

      expect(TmuxEnhancer.configureSession).toHaveBeenCalledWith('cgwt-repo-feature', {
        sessionName: 'cgwt-repo-feature',
        branchName: 'feature-branch',
        role: 'child',
        gitRepo: mockGitRepo,
      });
    });
  });
});
