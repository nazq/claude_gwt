import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { vi } from 'vitest';
import { ClaudeGWTApp } from '../../src/cli/ClaudeGWTApp';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { TmuxManager } from '../../src/sessions/TmuxManager';
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
 * End-to-End Local Test Suite for Claude GWT
 *
 * These tests exercise the full application workflow including:
 * - CLI initialization with various parameters
 * - Multi-branch repository setup
 * - Supervisor mode operations
 * - Session management
 * - Restart scenarios
 *
 * Note: These tests run locally only and may require tmux to be installed
 */
describe('Claude GWT Full E2E Workflow', () => {
  let testDir: string;
  let originalCwd: string;
  let tmuxAvailable: boolean;

  beforeAll(async () => {
    originalCwd = process.cwd();
    // Check tmux availability once
    tmuxAvailable = await TmuxManager.isTmuxAvailable();
    if (!tmuxAvailable) {
      console.log('⚠️  Tmux not available - some tests will be skipped');
    }

    // Skip tmux tests if requested via env var
    if (process.env['SKIP_TMUX_TESTS'] === 'true') {
      console.log('⚠️  SKIP_TMUX_TESTS=true - tmux tests will be skipped');
      tmuxAvailable = false;
    }

    // Set up git config for tests
    await execCommandSafe('git', ['config', '--global', 'user.email', 'test@example.com']);
    await execCommandSafe('git', ['config', '--global', 'user.name', 'Test User']);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-e2e-'));
  });

  afterEach(async () => {
    try {
      // Clean up any tmux sessions that might have been created
      if (tmuxAvailable) {
        const sessions = await TmuxManager.listSessions();
        for (const session of sessions) {
          if (session.name.includes('cgwt-e2e')) {
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

  describe('Real Git Operations', () => {
    it('should initialize a bare repository and create worktrees', async () => {
      const repo = new GitRepository(testDir);
      const result = await repo.initializeBareRepository();

      expect(result.defaultBranch).toBeDefined();
      expect(result.defaultBranch).toMatch(/^(main|master)$/);

      // Verify bare repo structure
      const bareDir = path.join(testDir, '.bare');
      const gitFile = path.join(testDir, '.git');

      expect(await fs.stat(bareDir).then((s) => s.isDirectory())).toBe(true);
      expect(await fs.readFile(gitFile, 'utf-8')).toContain('gitdir: ./.bare');

      // Create actual worktrees
      const manager = new WorktreeManager(testDir);
      const worktreePath = await manager.addWorktree('feature-test');

      expect(worktreePath).toBe(path.join(testDir, 'feature-test'));
      expect(await fs.stat(worktreePath).then((s) => s.isDirectory())).toBe(true);

      // List worktrees
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]?.branch).toBe('feature-test');
    }, 30000);

    it('should handle concurrent worktree creation', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const branches = ['feature-a', 'feature-b', 'feature-c', 'feature-d'];

      // Create worktrees concurrently
      const promises = branches.map((branch) => manager.addWorktree(branch));
      const results = await Promise.all(promises);

      // Verify all were created
      expect(results).toHaveLength(branches.length);
      results.forEach((result, index) => {
        expect(result).toBe(path.join(testDir, branches[index]!));
      });

      // Verify worktree list
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branches.length);

      // Verify each worktree is independent
      for (const branch of branches) {
        const branchPath = path.join(testDir, branch);
        const testFile = path.join(branchPath, `${branch}.txt`);
        await fs.writeFile(testFile, `Content for ${branch}`);

        // File should only exist in its own worktree
        for (const otherBranch of branches) {
          if (otherBranch !== branch) {
            const otherPath = path.join(testDir, otherBranch, `${branch}.txt`);
            await expect(fs.access(otherPath)).rejects.toThrow();
          }
        }
      }
    }, 60000);
  });

  describe('CLI Application Flow', () => {
    it('should handle empty directory initialization', async () => {
      const app = new ClaudeGWTApp(testDir, {
        repo: undefined,
        quiet: true,
        interactive: false,
      });

      // Run the app - it should initialize an empty repo and exit
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Verify repo was initialized
      const bareDir = path.join(testDir, '.bare');
      expect(
        await fs
          .access(bareDir)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
    }, 30000);

    it('should handle existing worktree directory', async () => {
      // Set up a worktree first
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('main');
      await manager.addWorktree('feature');

      // Now run the app in the parent directory
      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      await expect(app.run()).rejects.toThrow('process.exit called');

      // Should have detected the worktrees
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(2);
    }, 30000);

    it('should detect when conversion is not possible', async () => {
      // Test 1: Already a worktree
      await execCommandSafe('git', ['init', '--bare', '.bare'], { cwd: testDir });
      await fs.writeFile(path.join(testDir, '.git'), 'gitdir: .bare');

      const repo1 = new GitRepository(testDir);
      const { canConvert: canConvert1, reason: reason1 } = await repo1.canConvertToWorktree();
      expect(canConvert1).toBe(false);
      expect(reason1).toBeDefined();
      expect(reason1).toContain('Already a worktree');

      // Test 2: Regular repo can be converted
      const regularRepo = path.join(testDir, 'regular');
      await fs.mkdir(regularRepo);
      await execCommandSafe('git', ['init'], { cwd: regularRepo });

      // Create initial commit
      const testFile = path.join(regularRepo, 'README.md');
      await fs.writeFile(testFile, '# Test Repo');
      await execCommandSafe('git', ['add', '.'], { cwd: regularRepo });
      await execCommandSafe('git', ['commit', '-m', 'Initial commit'], { cwd: regularRepo });

      const repo2 = new GitRepository(regularRepo);
      const { canConvert: canConvert2 } = await repo2.canConvertToWorktree();
      expect(canConvert2).toBe(true);
    }, 30000);
  });

  describe('Tmux Session Management (if available)', () => {
    it('should create and manage tmux sessions', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // Set up repository with branches
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('main');
      await manager.addWorktree('feature-auth');

      // Create a detached session
      const sessionName = 'cgwt-e2e-test-main';
      const sessionConfig = {
        sessionName,
        workingDirectory: path.join(testDir, 'main'),
        branchName: 'main',
        role: 'child' as const,
        gitRepo: repo,
      };

      await TmuxManager.createDetachedSession(sessionConfig);

      // Verify session was created
      const sessions = await TmuxManager.listSessions();
      const ourSession = sessions.find((s) => s.name === sessionName);
      expect(ourSession).toBeDefined();
      expect(ourSession?.name).toBe(sessionName);

      // Get session info
      const sessionInfo = await TmuxManager.getSessionInfo(sessionName);
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.windows).toBeGreaterThanOrEqual(1);

      // Clean up
      await TmuxManager.killSession(sessionName);

      // Verify cleanup
      const sessionsAfter = await TmuxManager.listSessions();
      expect(sessionsAfter.find((s) => s.name === sessionName)).toBeUndefined();
    }, 60000);

    it('should handle supervisor mode with multiple branches', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      // Set up repository with multiple branches
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const branches = ['main', 'feature-a', 'feature-b'];

      for (const branch of branches) {
        await manager.addWorktree(branch);
      }

      // Create supervisor session
      const supervisorName = 'cgwt-e2e-test-supervisor';
      await TmuxManager.createDetachedSession({
        sessionName: supervisorName,
        workingDirectory: testDir,
        branchName: 'supervisor',
        role: 'supervisor',
        gitRepo: repo,
      });

      // Create branch sessions
      const branchSessions = [];
      for (const branch of branches) {
        const sessionName = `cgwt-e2e-test-${branch}`;
        branchSessions.push(sessionName);

        await TmuxManager.createDetachedSession({
          sessionName,
          workingDirectory: path.join(testDir, branch),
          branchName: branch,
          role: 'child',
          gitRepo: repo,
        });
      }

      // Verify all sessions exist
      const sessions = await TmuxManager.listSessions();
      expect(sessions.find((s) => s.name === supervisorName)).toBeDefined();

      for (const sessionName of branchSessions) {
        expect(sessions.find((s) => s.name === sessionName)).toBeDefined();
      }

      // Test shutdown all
      const testSessions = sessions.filter((s) => s.name.includes('cgwt-e2e-test'));
      for (const session of testSessions) {
        await TmuxManager.killSession(session.name);
      }

      // Verify cleanup
      const sessionsAfter = await TmuxManager.listSessions();
      expect(sessionsAfter.filter((s) => s.name.includes('cgwt-e2e-test'))).toHaveLength(0);
    }, 90000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-empty non-git directory', async () => {
      // Create some files
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'existing content');
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'console.log("test");');

      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      // Should exit with error
      await expect(app.run()).rejects.toThrow('process.exit called');

      // Directory should still have original files
      expect(await fs.readFile(path.join(testDir, 'existing.txt'), 'utf-8')).toBe(
        'existing content',
      );
    }, 30000);

    it('should handle worktree removal', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Create worktree
      await manager.addWorktree('temp-feature');
      let worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(1);

      // Remove worktree
      await manager.removeWorktree('temp-feature');

      // Verify removal
      worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(0);

      // Directory should be gone
      const branchPath = path.join(testDir, 'temp-feature');
      await expect(fs.access(branchPath)).rejects.toThrow();
    }, 30000);

    it('should handle invalid branch names', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Test invalid branch names
      const invalidNames = [
        'feature..test', // double dots
        '.hidden', // starts with dot
        'test/branch/', // ends with slash
        'test.lock', // ends with .lock
        'test branch', // contains space
      ];

      for (const name of invalidNames) {
        await expect(manager.addWorktree(name)).rejects.toThrow();
      }

      // Verify no worktrees were created
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(0);
    }, 30000);
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid worktree creation and deletion', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const branchName = `rapid-test-${i}`;

        // Create
        const start = Date.now();
        await manager.addWorktree(branchName);
        const createTime = Date.now() - start;

        // Verify
        const worktrees = await manager.listWorktrees();
        expect(worktrees.some((wt) => wt.branch === branchName)).toBe(true);

        // Remove
        const removeStart = Date.now();
        await manager.removeWorktree(branchName);
        const removeTime = Date.now() - removeStart;

        // Performance check - operations should be reasonably fast
        expect(createTime).toBeLessThan(5000);
        expect(removeTime).toBeLessThan(5000);
      }
    }, 60000);

    it('should handle many concurrent file operations', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const branchCount = 10;
      const fileCount = 10;

      // Create branches
      const branches = Array.from({ length: branchCount }, (_, i) => `perf-test-${i}`);
      await Promise.all(branches.map((branch) => manager.addWorktree(branch)));

      // Concurrent file operations across all branches
      const fileOps = [];
      for (const branch of branches) {
        for (let i = 0; i < fileCount; i++) {
          const filePath = path.join(testDir, branch, `file-${i}.txt`);
          fileOps.push(fs.writeFile(filePath, `Content for ${branch} file ${i}`));
        }
      }

      const start = Date.now();
      await Promise.all(fileOps);
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);

      // Verify all files were created
      for (const branch of branches) {
        const files = await fs.readdir(path.join(testDir, branch));
        expect(files.filter((f) => f.startsWith('file-')).length).toBe(fileCount);
      }
    }, 120000);
  });
});
