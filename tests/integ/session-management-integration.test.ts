import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { vi } from 'vitest';
import { TmuxManager } from '../../src/sessions/TmuxManager';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { execCommandSafe } from '../../src/core/utils/async';
import { Logger } from '../../src/core/utils/logger';

// For these e2e tests, we only mock process.exit to prevent test runner from exiting
vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

// Silence logs during tests unless debugging
if (!process.env['DEBUG']) {
  vi.spyOn(Logger, 'info').mockImplementation();
  vi.spyOn(Logger, 'debug').mockImplementation();
  vi.spyOn(Logger, 'warn').mockImplementation();
}

/**
 * Session Management E2E Tests
 *
 * These tests focus specifically on tmux session management,
 * Claude instance orchestration, and session lifecycle.
 *
 * Note: Many of these tests require tmux to be installed
 */
describe('Session Management Integration', () => {
  let testDir: string;
  let repo: GitRepository;
  let manager: WorktreeManager;
  let tmuxAvailable: boolean;

  beforeAll(async () => {
    // Check tmux availability once
    tmuxAvailable = await TmuxManager.isTmuxAvailable();
    if (!tmuxAvailable) {
      console.log('⚠️  Tmux not available - most tests will be skipped');
    }

    // Set up git config for tests
    await execCommandSafe('git', ['config', '--global', 'user.email', 'test@example.com']);
    await execCommandSafe('git', ['config', '--global', 'user.name', 'Test User']);
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-session-'));
    repo = new GitRepository(testDir);
    await repo.initializeBareRepository();
    manager = new WorktreeManager(testDir);
  });

  afterEach(async () => {
    try {
      // Clean up any tmux sessions that might have been created
      if (tmuxAvailable) {
        const sessions = await TmuxManager.listSessions();
        for (const session of sessions) {
          if (session.name.includes('cgwt-session-test')) {
            await TmuxManager.killSession(session.name);
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real Tmux Session Operations', () => {
    it('should detect tmux availability correctly', async () => {
      const isAvailable = await TmuxManager.isTmuxAvailable();
      expect(typeof isAvailable).toBe('boolean');

      if (isAvailable) {
        // If tmux is available, we should be able to get version
        const result = await execCommandSafe('tmux', ['-V']);
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('tmux');
      }
    });

    it('should create real tmux sessions', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      await manager.addWorktree('test-branch');

      const sessionName = 'cgwt-session-test-real';
      const sessionConfig = {
        sessionName,
        workingDirectory: path.join(testDir, 'test-branch'),
        branchName: 'test-branch',
        role: 'child' as const,
        gitRepo: repo,
      };

      // Create real session
      await TmuxManager.createDetachedSession(sessionConfig);

      // Verify using tmux commands
      const result = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);
      expect(result.stdout).toContain(sessionName);

      // Get session info
      const sessionInfo = await TmuxManager.getSessionInfo(sessionName);
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.name).toBe(sessionName);
      expect(sessionInfo?.windows).toBeGreaterThanOrEqual(1);

      // Kill session
      await TmuxManager.killSession(sessionName);

      // Verify it's gone
      const resultAfter = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);
      expect(resultAfter.stdout).not.toContain(sessionName);
    }, 30000);

    it('should handle session restart when Claude is not running', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      await manager.addWorktree('restart-test');

      const sessionName = 'cgwt-session-test-restart';

      // Create a session manually without Claude
      await execCommandSafe('tmux', [
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        path.join(testDir, 'restart-test'),
      ]);

      // Session should exist but without Claude
      let sessionInfo = await TmuxManager.getSessionInfo(sessionName);
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.hasClaudeRunning).toBe(false);

      // Launch Claude in the existing session
      const sessionConfig = {
        sessionName,
        workingDirectory: path.join(testDir, 'restart-test'),
        branchName: 'restart-test',
        role: 'child' as const,
        gitRepo: repo,
      };

      // Always create detached session in tests to avoid attaching to terminal
      await TmuxManager.createDetachedSession(sessionConfig);

      // Verify the session exists
      sessionInfo = await TmuxManager.getSessionInfo(sessionName);
      expect(sessionInfo).not.toBeNull();

      // Clean up
      await TmuxManager.killSession(sessionName);
    }, 30000);
  });

  describe('Multi-Session Management', () => {
    it('should manage multiple concurrent sessions', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      const branches = ['main', 'feature-1', 'feature-2', 'feature-3'];

      // Create branches
      for (const branch of branches) {
        await manager.addWorktree(branch);
      }

      const sessionNames = [];

      // Create sessions
      for (const branch of branches) {
        const sessionName = `cgwt-session-test-${branch}`;
        sessionNames.push(sessionName);

        await TmuxManager.createDetachedSession({
          sessionName,
          workingDirectory: path.join(testDir, branch),
          branchName: branch,
          role: 'child' as const,
          gitRepo: repo,
        });
      }

      // Verify all sessions exist
      const sessions = await TmuxManager.listSessions();
      for (const sessionName of sessionNames) {
        expect(sessions.find((s) => s.name === sessionName)).toBeDefined();
      }

      // Clean up all sessions
      for (const sessionName of sessionNames) {
        await TmuxManager.killSession(sessionName);
      }

      // Verify cleanup
      const sessionsAfter = await TmuxManager.listSessions();
      for (const sessionName of sessionNames) {
        expect(sessionsAfter.find((s) => s.name === sessionName)).toBeUndefined();
      }
    }, 60000);

    it('should handle session groups', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // const groupName = 'cgwt-test-group';  // Not used in this test
      const sessionNames = ['cgwt-test-group-main', 'cgwt-test-group-feature'];

      // Create sessions in a group
      for (const sessionName of sessionNames) {
        await execCommandSafe('tmux', ['new-session', '-d', '-s', sessionName, '-c', testDir]);
      }

      // List sessions and check they exist
      const sessions = await TmuxManager.listSessions();
      for (const sessionName of sessionNames) {
        expect(sessions.find((s) => s.name === sessionName)).toBeDefined();
      }

      // Clean up
      for (const sessionName of sessionNames) {
        await TmuxManager.killSession(sessionName);
      }
    }, 30000);
  });

  describe('Session Features', () => {
    it('should get correct session names', () => {
      const repoName = 'test-repo';
      const branches = ['main', 'feature/auth', 'bugfix/issue-123'];

      for (const branch of branches) {
        const sessionName = TmuxManager.getSessionName(repoName, branch);
        expect(sessionName).toMatch(/^cgwt-test-repo-/);
        expect(sessionName).not.toContain('/');
        expect(sessionName).not.toContain(':');
      }
    });

    it('should handle tmux inside tmux detection', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // Check if we're inside tmux (this test environment might be in tmux)
      const insideTmux = TmuxManager.isInsideTmux();
      expect(typeof insideTmux).toBe('boolean');

      // Create a session and check from inside
      const sessionName = 'cgwt-session-test-inside';
      await execCommandSafe('tmux', [
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        testDir,
        'echo $TMUX',
      ]);

      // The TMUX environment variable would be set inside the session
      // but we can't easily test that from here without actually attaching

      // Clean up
      await TmuxManager.killSession(sessionName);
    }, 30000);

    it('should provide predefined layouts', () => {
      const layouts = TmuxManager.getPredefinedLayouts();

      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);

      // Check layout structure
      for (const layout of layouts) {
        expect(layout).toHaveProperty('name');
        expect(layout).toHaveProperty('description');
        expect(layout).toHaveProperty('branches');
        expect(layout).toHaveProperty('layout');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation errors gracefully', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // Try to create session with invalid name
      const invalidConfig = {
        sessionName: '', // Empty name
        workingDirectory: testDir,
        branchName: 'test',
        role: 'child' as const,
        gitRepo: repo,
      };

      await expect(TmuxManager.createDetachedSession(invalidConfig)).rejects.toThrow();
    }, 30000);

    it('should handle non-existent session queries', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      const sessionInfo = await TmuxManager.getSessionInfo('non-existent-session-xyz');
      expect(sessionInfo).toBeNull();
    }, 30000);

    it('should handle killing non-existent sessions', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // Should not throw
      await expect(TmuxManager.killSession('non-existent-session-xyz')).resolves.not.toThrow();
    }, 30000);
  });

  describe('Performance Tests', () => {
    it('should handle rapid session creation and deletion', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const sessionName = `cgwt-session-test-rapid-${i}`;

        const start = Date.now();

        // Create
        await TmuxManager.createDetachedSession({
          sessionName,
          workingDirectory: testDir,
          branchName: `rapid-${i}`,
          role: 'child' as const,
          gitRepo: repo,
        });

        // Verify
        const sessionInfo = await TmuxManager.getSessionInfo(sessionName);
        expect(sessionInfo).not.toBeNull();

        // Delete
        await TmuxManager.killSession(sessionName);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(5000); // Should complete quickly
      }
    }, 60000);

    it('should list many sessions efficiently', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      const sessionCount = 10;
      const sessionNames = [];

      // Create many sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionName = `cgwt-session-test-list-${i}`;
        sessionNames.push(sessionName);

        await execCommandSafe('tmux', ['new-session', '-d', '-s', sessionName, '-c', testDir]);
      }

      // Time the list operation
      const start = Date.now();
      const sessions = await TmuxManager.listSessions();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should be fast

      // Verify all our sessions are in the list
      for (const sessionName of sessionNames) {
        expect(sessions.find((s) => s.name === sessionName)).toBeDefined();
      }

      // Clean up
      for (const sessionName of sessionNames) {
        await TmuxManager.killSession(sessionName);
      }
    }, 90000);
  });
});
