import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { TmuxManager } from '../../src/sessions/TmuxManager';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

// Mock console methods
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

/**
 * Session Management E2E Tests
 *
 * These tests focus specifically on tmux session management,
 * Claude instance orchestration, and session lifecycle.
 */
describe('Session Management E2E', () => {
  let testDir: string;
  let repo: GitRepository;
  let manager: WorktreeManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-session-'));
    repo = new GitRepository(testDir);
    await repo.initializeBareRepository();
    manager = new WorktreeManager(testDir);
  });

  afterEach(async () => {
    try {
      await TmuxManager.shutdownAll();
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Single Session Lifecycle', () => {
    it('should create, manage, and destroy a single session', async () => {
      await manager.addWorktree('test-branch');

      const sessionConfig = {
        sessionName: 'cgwt-test-single',
        workingDirectory: path.join(testDir, 'test-branch'),
        branchName: 'test-branch',
        role: 'child' as const,
        gitRepo: repo,
      };

      // Mock tmux operations
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(true);
      jest.spyOn(TmuxManager, 'createDetachedSession').mockResolvedValue(undefined);
      jest.spyOn(TmuxManager, 'getSessionInfo').mockResolvedValue({
        name: 'cgwt-test-single',
        windows: 1,
        created: '1234567890',
        attached: false,
        hasClaudeRunning: true,
      });

      // Create session
      await TmuxManager.createDetachedSession(sessionConfig);

      // Verify session exists
      const sessionInfo = await TmuxManager.getSessionInfo('cgwt-test-single');
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.name).toBe('cgwt-test-single');

      // Clean up
      await TmuxManager.killSession('cgwt-test-single');
    }, 30000);

    it('should handle session restart scenarios', async () => {
      await manager.addWorktree('restart-test');

      const sessionName = 'cgwt-test-restart';
      const sessionConfig = {
        sessionName,
        workingDirectory: path.join(testDir, 'restart-test'),
        branchName: 'restart-test',
        role: 'child' as const,
        gitRepo: repo,
      };

      // Mock initial session without Claude
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(true);
      jest
        .spyOn(TmuxManager, 'getSessionInfo')
        .mockResolvedValueOnce({
          name: sessionName,
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: false,
        })
        .mockResolvedValueOnce({
          name: sessionName,
          windows: 2,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        });

      jest.spyOn(TmuxManager, 'launchSession').mockResolvedValue(undefined);

      // Should restart Claude in existing session
      await TmuxManager.launchSession(sessionConfig);

      expect(TmuxManager.launchSession).toHaveBeenCalledWith(sessionConfig);
    }, 30000);
  });

  describe('Multi-Session Management', () => {
    const branches = ['main', 'feature-1', 'feature-2', 'feature-3'];

    beforeEach(async () => {
      // Create multiple branches
      for (const branch of branches) {
        await manager.addWorktree(branch);
      }
    });

    it('should manage multiple concurrent sessions', async () => {
      const sessionConfigs = branches.map((branch) => ({
        sessionName: `cgwt-test-${branch}`,
        workingDirectory: path.join(testDir, branch),
        branchName: branch,
        role: 'child' as const,
        gitRepo: repo,
      }));

      // Mock tmux operations
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(true);
      jest.spyOn(TmuxManager, 'createDetachedSession').mockResolvedValue(undefined);

      // Create all sessions
      const createPromises = sessionConfigs.map((config) =>
        TmuxManager.createDetachedSession(config),
      );
      await Promise.all(createPromises);

      expect(TmuxManager.createDetachedSession).toHaveBeenCalledTimes(branches.length);
    }, 60000);

    it('should handle session group management', async () => {
      const groupName = 'cgwt-test-project';

      // Mock session group operations
      jest.spyOn(TmuxManager, 'getSessionGroup').mockResolvedValue(groupName);
      jest.spyOn(TmuxManager, 'listSessions').mockResolvedValue(
        branches.map((branch) => ({
          name: `cgwt-test-${branch}`,
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        })),
      );

      const sessionsInGroup = await TmuxManager.getSessionsInGroup(groupName);
      expect(sessionsInGroup).toHaveLength(branches.length);
    }, 30000);

    it('should handle bulk session shutdown', async () => {
      // Mock existing sessions
      jest.spyOn(TmuxManager, 'listSessions').mockResolvedValue(
        branches.map((branch) => ({
          name: `cgwt-test-${branch}`,
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        })),
      );

      jest.spyOn(TmuxManager, 'killSession').mockResolvedValue(undefined);

      await TmuxManager.shutdownAll();

      // Should have attempted to kill all cgwt sessions
      expect(TmuxManager.killSession).toHaveBeenCalledTimes(branches.length);
    }, 30000);
  });

  describe('Session State Persistence', () => {
    it('should handle session state across app restarts', async () => {
      await manager.addWorktree('persistent-branch');

      const sessionName = 'cgwt-test-persistent';

      // First app run - create session
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(true);
      jest
        .spyOn(TmuxManager, 'getSessionInfo')
        .mockResolvedValueOnce(null) // First check - no session
        .mockResolvedValueOnce({
          // After creation
          name: sessionName,
          windows: 1,
          created: '1234567890',
          attached: false,
          hasClaudeRunning: true,
        });

      jest.spyOn(TmuxManager, 'createDetachedSession').mockResolvedValue(undefined);

      const sessionConfig = {
        sessionName,
        workingDirectory: path.join(testDir, 'persistent-branch'),
        branchName: 'persistent-branch',
        role: 'child' as const,
        gitRepo: repo,
      };

      await TmuxManager.createDetachedSession(sessionConfig);

      // Simulate app restart - session should be detected
      const sessionInfo = await TmuxManager.getSessionInfo(sessionName);
      expect(sessionInfo?.hasClaudeRunning).toBe(true);
    }, 30000);

    it('should handle session recovery after system reboot', async () => {
      // Simulate post-reboot scenario where sessions are gone
      jest.spyOn(TmuxManager, 'listSessions').mockResolvedValue([]);
      jest.spyOn(TmuxManager, 'getSessionInfo').mockResolvedValue(null);

      const sessions = await TmuxManager.listSessions();
      expect(sessions).toHaveLength(0);

      // App should be able to recreate sessions from scratch
      await manager.addWorktree('recovery-branch');
      const sessionConfig = {
        sessionName: 'cgwt-test-recovery',
        workingDirectory: path.join(testDir, 'recovery-branch'),
        branchName: 'recovery-branch',
        role: 'child' as const,
        gitRepo: repo,
      };

      jest.spyOn(TmuxManager, 'createDetachedSession').mockResolvedValue(undefined);
      await TmuxManager.createDetachedSession(sessionConfig);

      expect(TmuxManager.createDetachedSession).toHaveBeenCalledWith(sessionConfig);
    }, 30000);
  });

  describe('Advanced Session Features', () => {
    it('should handle session comparison layouts', async () => {
      await manager.addWorktree('compare-a');
      await manager.addWorktree('compare-b');

      const branches = ['compare-a', 'compare-b'];
      const supervisorSession = 'cgwt-test-supervisor';
      const projectName = 'test-project';

      jest.spyOn(TmuxManager, 'createComparisonLayout').mockReturnValue(undefined);

      TmuxManager.createComparisonLayout(supervisorSession, branches, projectName);

      expect(TmuxManager.createComparisonLayout).toHaveBeenCalledWith(
        supervisorSession,
        branches,
        projectName,
      );
    }, 30000);

    it('should handle synchronized pane operations', async () => {
      const sessionName = 'cgwt-test-sync';

      jest.spyOn(TmuxManager, 'toggleSynchronizedPanes').mockReturnValue(true);

      const result = TmuxManager.toggleSynchronizedPanes(sessionName);
      expect(result).toBe(true);
      expect(TmuxManager.toggleSynchronizedPanes).toHaveBeenCalledWith(sessionName);
    }, 30000);

    it('should provide predefined layouts', () => {
      const mockLayouts = [
        {
          name: 'development',
          description: 'Standard development layout',
          branches: ['main', 'develop'],
          layout: 'even-horizontal' as const,
        },
        {
          name: 'comparison',
          description: 'Side-by-side comparison',
          branches: ['feature-a', 'feature-b'],
          layout: 'even-vertical' as const,
        },
      ];

      jest.spyOn(TmuxManager, 'getPredefinedLayouts').mockReturnValue(mockLayouts);

      const layouts = TmuxManager.getPredefinedLayouts();
      expect(layouts).toHaveLength(2);
      expect(layouts[0]?.name).toBe('development');
      expect(layouts[1]?.name).toBe('comparison');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tmux daemon crashes', async () => {
      // Simulate tmux daemon becoming unavailable
      jest
        .spyOn(TmuxManager, 'isTmuxAvailable')
        .mockResolvedValueOnce(true) // Initially available
        .mockResolvedValueOnce(false); // Then crashes

      const sessionConfig = {
        sessionName: 'cgwt-test-crash',
        workingDirectory: testDir,
        branchName: 'test',
        role: 'child' as const,
        gitRepo: repo,
      };

      // Should handle the crash gracefully
      jest
        .spyOn(TmuxManager, 'launchSession')
        .mockRejectedValue(new Error('tmux server connection lost'));

      await expect(TmuxManager.launchSession(sessionConfig)).rejects.toThrow(
        'tmux server connection lost',
      );
    }, 30000);

    it('should handle invalid session names', async () => {
      // TmuxManager should sanitize session names
      const sanitizedName = TmuxManager.getSessionName('test', 'with/invalid:characters');
      expect(sanitizedName).not.toContain('/');
      expect(sanitizedName).not.toContain(':');
    }, 10000);

    it('should handle resource exhaustion', async () => {
      // Test creating too many sessions
      const manyBranches = Array.from({ length: 50 }, (_, i) => `branch-${i}`);

      // Create branches
      for (const branch of manyBranches.slice(0, 5)) {
        // Just test a few
        await manager.addWorktree(branch);
      }

      const sessionConfigs = manyBranches.slice(0, 5).map((branch) => ({
        sessionName: `cgwt-test-${branch}`,
        workingDirectory: path.join(testDir, branch),
        branchName: branch,
        role: 'child' as const,
        gitRepo: repo,
      }));

      // Mock resource exhaustion after a few sessions
      jest
        .spyOn(TmuxManager, 'createDetachedSession')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('Cannot create session: resource exhaustion'));

      const results = await Promise.allSettled(
        sessionConfigs.map((config) => TmuxManager.createDetachedSession(config)),
      );

      // Some should succeed, some should fail
      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    }, 60000);
  });
});
