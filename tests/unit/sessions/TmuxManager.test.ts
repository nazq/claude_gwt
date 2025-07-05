import { execSync } from 'child_process';
import * as fs from 'fs';
import { TmuxManager } from '../../../src/sessions/TmuxManager';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { SessionConfig } from '../../../src/sessions/TmuxManager';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(),
}));
jest.mock('fs');
jest.mock('../../../src/core/utils/logger');
jest.mock('../../../src/sessions/TmuxEnhancer');

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
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
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const mockSpawnSync = require('child_process').spawnSync;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['TMUX'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockSpawnSync.mockReturnValue({ status: 0, signal: null });
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
    it('should return true when tmux is available', () => {
      mockExecSync.mockReturnValue('/usr/bin/tmux' as any);

      expect(TmuxManager.isTmuxAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('which tmux', { stdio: 'ignore' });
    });

    it('should return false when tmux is not available', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      expect(TmuxManager.isTmuxAvailable()).toBe(false);
    });
  });

  describe('isInsideTmux', () => {
    it('should return true when TMUX env var is set', () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';
      expect(TmuxManager.isInsideTmux()).toBe(true);
    });

    it('should return false when TMUX env var is not set', () => {
      delete process.env['TMUX'];
      expect(TmuxManager.isInsideTmux()).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info when session exists', () => {
      mockExecSync
        .mockReturnValueOnce('cgwt-repo-main:2:1234567890:1' as any)
        .mockReturnValueOnce('claude\nbash\n' as any);

      const info = TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toEqual({
        name: 'cgwt-repo-main',
        windows: 2,
        created: '1234567890',
        attached: true,
        hasClaudeRunning: true,
      });
    });

    it('should return null when session does not exist', () => {
      mockExecSync.mockReturnValue('' as any);

      const info = TmuxManager.getSessionInfo('non-existent');

      expect(info).toBeNull();
    });

    it('should handle sessions without Claude running', () => {
      mockExecSync
        .mockReturnValueOnce('cgwt-repo-main:1:1234567890:0' as any)
        .mockReturnValueOnce('bash\nvim\n' as any);

      const info = TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toEqual({
        name: 'cgwt-repo-main',
        windows: 1,
        created: '1234567890',
        attached: false,
        hasClaudeRunning: false,
      });
    });

    it('should handle errors when checking for Claude', () => {
      mockExecSync
        .mockReturnValueOnce('cgwt-repo-main:1:1234567890:0' as any)
        .mockImplementationOnce(() => {
          throw new Error('tmux error');
        });

      const info = TmuxManager.getSessionInfo('cgwt-repo-main');

      expect(info).toEqual({
        name: 'cgwt-repo-main',
        windows: 1,
        created: '1234567890',
        attached: false,
        hasClaudeRunning: false,
      });
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
      mockExecSync.mockReturnValue('' as any);
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should check tmux availability', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd === 'which tmux') throw new Error('tmux not found');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return '' as any;
      });

      expect(() => TmuxManager.launchSession(mockConfig)).toThrow('tmux is not installed');
    });

    it('should create context file', () => {
      mockExecSync.mockReturnValue('' as any);
      mockFs.existsSync.mockReturnValue(false);

      TmuxManager.launchSession(mockConfig);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/repo/.claude-context.md',
        expect.stringContaining('test context'),
      );
    });

    it('should create new session when it does not exist', () => {
      // First call to getSessionInfo returns null
      mockExecSync.mockReturnValueOnce('/usr/bin/tmux' as any); // which tmux
      mockExecSync.mockReturnValueOnce('' as any); // getSessionInfo returns empty

      TmuxManager.launchSession(mockConfig);

      // Check that new session was created
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tmux new-session -s cgwt-repo-main'),
        { stdio: 'inherit' },
      );
    });

    it('should restart Claude in existing session without Claude', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/bin/tmux' as any) // which tmux
        .mockReturnValueOnce('cgwt-repo-main:1:1234567890:0' as any) // session exists
        .mockReturnValueOnce('bash\n' as any); // no Claude running

      TmuxManager.launchSession(mockConfig);

      // Should create new window with Claude
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tmux new-window -t cgwt-repo-main'),
      );
    });

    it('should attach to existing session with Claude running', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/bin/tmux' as any) // which tmux
        .mockReturnValueOnce('cgwt-repo-main:1:1234567890:0' as any) // session exists
        .mockReturnValueOnce('claude\n' as any); // Claude is running

      TmuxManager.launchSession(mockConfig);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'tmux',
        ['attach-session', '-t', 'cgwt-repo-main'],
        {
          stdio: 'inherit',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          env: expect.any(Object),
        },
      );
    });

    it('should handle being inside tmux differently', () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';
      mockExecSync
        .mockReturnValueOnce('/usr/bin/tmux' as any) // which tmux
        .mockReturnValueOnce('' as any); // no existing session

      TmuxManager.launchSession(mockConfig);

      // Should use switch-client instead of attach-session
      expect(mockExecSync).toHaveBeenCalledWith('tmux switch-client -t cgwt-repo-main');
    });
  });

  describe('createDetachedSession', () => {
    const mockConfig: SessionConfig = {
      sessionName: 'cgwt-repo-feature',
      workingDirectory: '/path/to/repo/feature',
      branchName: 'feature',
      role: 'child',
    };

    beforeEach(() => {
      mockExecSync.mockReturnValue('' as any);
    });

    it('should create a detached session', () => {
      TmuxManager.createDetachedSession(mockConfig);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tmux new-session -d -s cgwt-repo-feature'),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tmux send-keys -t cgwt-repo-feature'),
      );
    });
  });

  describe('attachToSession', () => {
    it('should use switch-client when inside tmux', () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';

      TmuxManager.attachToSession('cgwt-repo-main');

      expect(mockExecSync).toHaveBeenCalledWith('tmux switch-client -t cgwt-repo-main');
    });

    it('should use attach-session when outside tmux', () => {
      delete process.env['TMUX'];

      TmuxManager.attachToSession('cgwt-repo-main');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'tmux',
        ['attach-session', '-t', 'cgwt-repo-main'],
        {
          stdio: 'inherit',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          env: expect.any(Object),
        },
      );
    });
  });

  describe('killSession', () => {
    it('should kill the specified session', () => {
      TmuxManager.killSession('cgwt-repo-main');

      expect(mockExecSync).toHaveBeenCalledWith('tmux kill-session -t cgwt-repo-main 2>/dev/null');
    });
  });

  describe('listSessions', () => {
    it('should return list of cgwt sessions', () => {
      // First call returns list of all sessions
      mockExecSync.mockReturnValueOnce('cgwt-repo-main\ncgwt-repo-feature\nother-session\n' as any);
      // Then for each cgwt session, getSessionInfo is called
      mockExecSync.mockReturnValueOnce('cgwt-repo-main:2:1234567890:1' as any); // session info for main
      mockExecSync.mockReturnValueOnce('claude\nbash\n' as any); // panes for main
      mockExecSync.mockReturnValueOnce('cgwt-repo-feature:1:1234567891:0' as any); // session info for feature
      mockExecSync.mockReturnValueOnce('bash\n' as any); // panes for feature

      const sessions = TmuxManager.listSessions();

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

    it('should return empty array when no sessions exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('no sessions');
      });

      const sessions = TmuxManager.listSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('shutdownAll', () => {
    it('should kill all cgwt sessions', () => {
      // First call returns list of all sessions
      mockExecSync.mockReturnValueOnce('cgwt-repo-main\ncgwt-repo-feature\nother-session\n' as any);
      // Then for each cgwt session, getSessionInfo is called
      mockExecSync.mockReturnValueOnce('cgwt-repo-main:2:1234567890:1' as any); // session info for main
      mockExecSync.mockReturnValueOnce('claude\nbash\n' as any); // panes for main
      mockExecSync.mockReturnValueOnce('cgwt-repo-feature:1:1234567891:0' as any); // session info for feature
      mockExecSync.mockReturnValueOnce('bash\n' as any); // panes for feature

      TmuxManager.shutdownAll();

      expect(mockExecSync).toHaveBeenCalledWith('tmux kill-session -t cgwt-repo-main 2>/dev/null');
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux kill-session -t cgwt-repo-feature 2>/dev/null',
      );
      expect(mockExecSync).not.toHaveBeenCalledWith(
        'tmux kill-session -t other-session 2>/dev/null',
      );
    });
  });

  describe('createComparisonLayout', () => {
    it('should create comparison layout for two branches', () => {
      TmuxManager.createComparisonLayout(
        'cgwt-repo-supervisor',
        ['main', 'feature'],
        'test-project',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
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
    it('should return session group name', () => {
      mockExecSync.mockReturnValue('cgwt-repo' as any);

      const group = TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBe('cgwt-repo');
    });

    it('should return null when session has no group', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('no group');
      });

      const group = TmuxManager.getSessionGroup('cgwt-repo-main');

      expect(group).toBeNull();
    });
  });

  describe('getSessionsInGroup', () => {
    it('should return sessions in the specified group', () => {
      // First call: listSessions
      mockExecSync.mockReturnValueOnce(
        'cgwt-repo-main\ncgwt-repo-feature\ncgwt-other-main\n' as any,
      );

      // For each session, getSessionInfo calls
      mockExecSync.mockReturnValueOnce('cgwt-repo-main:2:1234567890:1' as any); // session info for main
      mockExecSync.mockReturnValueOnce('claude\n' as any); // panes for main

      mockExecSync.mockReturnValueOnce('cgwt-repo-feature:1:1234567891:0' as any); // session info for feature
      mockExecSync.mockReturnValueOnce('bash\n' as any); // panes for feature

      mockExecSync.mockReturnValueOnce('cgwt-other-main:1:1234567892:0' as any); // session info for other
      mockExecSync.mockReturnValueOnce('bash\n' as any); // panes for other

      // Then getSessionGroup calls for each session
      mockExecSync.mockReturnValueOnce('cgwt-repo' as any); // group for main
      mockExecSync.mockReturnValueOnce('cgwt-repo' as any); // group for feature
      mockExecSync.mockReturnValueOnce('cgwt-other' as any); // group for other

      const sessions = TmuxManager.getSessionsInGroup('cgwt-repo');

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.name).toBe('cgwt-repo-main');
      expect(sessions[1]?.name).toBe('cgwt-repo-feature');
    });
  });
});
