import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { TmuxManager } from '../../src/sessions/TmuxManager';
import { execCommandSafe } from '../../src/core/utils/async';
import { Logger } from '../../src/core/utils/logger';

// Only mock process.exit
jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

// Silence logs
if (!process.env['DEBUG']) {
  jest.spyOn(Logger, 'info').mockImplementation();
  jest.spyOn(Logger, 'debug').mockImplementation();
  jest.spyOn(Logger, 'warn').mockImplementation();
}

/**
 * Advanced Workflows E2E Tests
 *
 * Tests complete real-world workflows combining multiple features
 */
describe('Advanced Workflows E2E', () => {
  let testDir: string;
  let tmuxAvailable: boolean;

  beforeAll(async () => {
    tmuxAvailable = await TmuxManager.isTmuxAvailable();

    // Set up git config for tests
    await execCommandSafe('git', ['config', '--global', 'user.email', 'test@example.com']);
    await execCommandSafe('git', ['config', '--global', 'user.name', 'Test User']);
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-advanced-'));
  });

  afterEach(async () => {
    try {
      if (tmuxAvailable) {
        const sessions = await TmuxManager.listSessions();
        for (const session of sessions) {
          if (session.name.includes('cgwt-advanced')) {
            await TmuxManager.killSession(session.name);
          }
        }
      }
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Multi-Branch Development Workflow', () => {
    it('should support typical feature development workflow', async () => {
      // Initialize repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);

      // Create main branch with initial content
      const mainPath = await manager.addWorktree('main');
      await fs.writeFile(path.join(mainPath, 'README.md'), '# Project\n\nMain branch content');
      await fs.writeFile(path.join(mainPath, 'index.js'), 'console.log("v1.0");');

      // Commit initial content
      await execCommandSafe('git', ['add', '.'], { cwd: mainPath });
      await execCommandSafe('git', ['commit', '-m', 'Initial commit'], { cwd: mainPath });

      // Create feature branches
      const featureUIPath = await manager.addWorktree('feature-ui', 'main');
      const featureAPIPath = await manager.addWorktree('feature-api', 'main');

      // Work on feature-ui
      await fs.writeFile(
        path.join(featureUIPath, 'ui.js'),
        'export const UI = { version: "2.0" };',
      );
      await execCommandSafe('git', ['add', '.'], { cwd: featureUIPath });
      await execCommandSafe('git', ['commit', '-m', 'Add UI module'], { cwd: featureUIPath });

      // Work on feature-api
      await fs.writeFile(
        path.join(featureAPIPath, 'api.js'),
        'export const API = { endpoint: "/v2" };',
      );
      await execCommandSafe('git', ['add', '.'], { cwd: featureAPIPath });
      await execCommandSafe('git', ['commit', '-m', 'Add API module'], { cwd: featureAPIPath });

      // Verify branches have diverged
      const uiLog = await execCommandSafe('git', ['log', '--oneline', '-1'], {
        cwd: featureUIPath,
      });
      const apiLog = await execCommandSafe('git', ['log', '--oneline', '-1'], {
        cwd: featureAPIPath,
      });

      expect(uiLog.stdout).toContain('Add UI module');
      expect(apiLog.stdout).toContain('Add API module');

      // List all worktrees
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(3);
      expect(worktrees.map((wt) => wt.branch).sort()).toEqual([
        'feature-api',
        'feature-ui',
        'main',
      ]);
    }, 60000);

    it('should handle merging branches back to main', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);

      // Setup main branch
      const mainPath = await manager.addWorktree('main');
      await fs.writeFile(path.join(mainPath, 'base.txt'), 'Base content');
      await execCommandSafe('git', ['add', '.'], { cwd: mainPath });
      await execCommandSafe('git', ['commit', '-m', 'Base commit'], { cwd: mainPath });

      // Create and modify feature branch
      const featurePath = await manager.addWorktree('feature-merge', 'main');
      await fs.writeFile(path.join(featurePath, 'feature.txt'), 'Feature content');
      await execCommandSafe('git', ['add', '.'], { cwd: featurePath });
      await execCommandSafe('git', ['commit', '-m', 'Add feature'], { cwd: featurePath });

      // Merge feature back to main
      await execCommandSafe('git', ['merge', 'feature-merge'], { cwd: mainPath });

      // Verify merge
      const mainFiles = await fs.readdir(mainPath);
      expect(mainFiles).toContain('base.txt');
      expect(mainFiles).toContain('feature.txt');
    }, 30000);
  });

  describe('Session Persistence and Recovery', () => {
    it('should maintain session state across restarts', async () => {
      if (!tmuxAvailable) {
        console.log('Skipping: tmux not available');
        return;
      }

      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('persistent-test');

      // Create session with specific configuration
      const sessionName = 'cgwt-advanced-persist';
      await TmuxManager.createDetachedSession({
        sessionName,
        workingDirectory: path.join(testDir, 'persistent-test'),
        branchName: 'persistent-test',
        role: 'child',
        gitRepo: repo,
      });

      // Verify session exists
      let info = await TmuxManager.getSessionInfo(sessionName);
      expect(info).not.toBeNull();
      const originalWindows = info?.windows;

      // Create additional window in session
      await execCommandSafe('tmux', ['new-window', '-t', sessionName, '-n', 'extra']);

      // Verify window was added
      info = await TmuxManager.getSessionInfo(sessionName);
      expect(info?.windows).toBe((originalWindows ?? 0) + 1);

      // Session should persist with all windows
      const windows = await execCommandSafe('tmux', [
        'list-windows',
        '-t',
        sessionName,
        '-F',
        '#{window_name}',
      ]);
      expect(windows.stdout).toContain('extra');
    }, 30000);
  });

  describe('Complex Repository Operations', () => {
    it('should handle repository with many branches and commits', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);

      // Create main branch with history
      const mainPath = await manager.addWorktree('main');

      // Create multiple commits
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(mainPath, `file${i}.txt`), `Content ${i}`);
        await execCommandSafe('git', ['add', '.'], { cwd: mainPath });
        await execCommandSafe('git', ['commit', '-m', `Commit ${i}`], { cwd: mainPath });
      }

      // Create multiple branches at different points
      const branches = ['develop', 'feature-1', 'feature-2', 'hotfix-1'];
      for (const branch of branches) {
        await manager.addWorktree(branch, 'main');
      }

      // Make unique changes in each branch
      for (const branch of branches) {
        const branchPath = path.join(testDir, branch);
        await fs.writeFile(path.join(branchPath, `${branch}.txt`), `${branch} specific content`);
        await execCommandSafe('git', ['add', '.'], { cwd: branchPath });
        await execCommandSafe('git', ['commit', '-m', `${branch} changes`], { cwd: branchPath });
      }

      // Verify all branches exist and have unique content
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branches.length + 1); // +1 for main

      // Check commit history
      const mainHistory = await execCommandSafe('git', ['log', '--oneline'], { cwd: mainPath });
      expect(mainHistory.stdout.split('\n').length).toBeGreaterThanOrEqual(5);
    }, 60000);

    it('should handle stashing and applying changes across branches', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);

      // Setup branches
      const mainPath = await manager.addWorktree('main');
      await fs.writeFile(path.join(mainPath, 'base.txt'), 'Base');
      await execCommandSafe('git', ['add', '.'], { cwd: mainPath });
      await execCommandSafe('git', ['commit', '-m', 'Base'], { cwd: mainPath });

      const featurePath = await manager.addWorktree('feature-stash', 'main');

      // Make changes in feature branch
      await fs.writeFile(path.join(featurePath, 'work.txt'), 'Work in progress');
      await execCommandSafe('git', ['add', '.'], { cwd: featurePath });

      // Stash changes
      await execCommandSafe('git', ['stash'], { cwd: featurePath });

      // Verify working directory is clean
      const status = await execCommandSafe('git', ['status', '--porcelain'], { cwd: featurePath });
      expect(status.stdout.trim()).toBe('');

      // Apply stash
      await execCommandSafe('git', ['stash', 'pop'], { cwd: featurePath });

      // Verify changes are back
      const workFile = await fs.readFile(path.join(featurePath, 'work.txt'), 'utf-8');
      expect(workFile).toBe('Work in progress');
    }, 30000);
  });

  describe('Performance with Large Repositories', () => {
    it('should handle repository with many files efficiently', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      const manager = new WorktreeManager(testDir);

      const mainPath = await manager.addWorktree('main');

      // Create many files
      const fileCount = 100;
      const startCreate = Date.now();

      await fs.mkdir(path.join(mainPath, 'src'), { recursive: true });
      const filePromises = Array.from({ length: fileCount }, (_, i) =>
        fs.writeFile(
          path.join(mainPath, 'src', `module${i}.js`),
          `export const module${i} = ${i};`,
        ),
      );
      await Promise.all(filePromises);

      const createDuration = Date.now() - startCreate;
      expect(createDuration).toBeLessThan(5000); // Should create 100 files in < 5s

      // Add and commit all files
      const startCommit = Date.now();
      await execCommandSafe('git', ['add', '.'], { cwd: mainPath });
      await execCommandSafe('git', ['commit', '-m', 'Add many modules'], { cwd: mainPath });
      const commitDuration = Date.now() - startCommit;
      expect(commitDuration).toBeLessThan(10000); // Should commit in < 10s

      // Create new worktree should be fast
      const startWorktree = Date.now();
      await manager.addWorktree('performance-test', 'main');
      const worktreeDuration = Date.now() - startWorktree;
      expect(worktreeDuration).toBeLessThan(5000); // Should create worktree in < 5s
    }, 30000);
  });
});
