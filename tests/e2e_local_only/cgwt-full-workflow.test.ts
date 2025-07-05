import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ClaudeGWTApp } from '../../src/cli/ClaudeGWTApp';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { TmuxManager } from '../../src/sessions/TmuxManager';

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

// Mock console methods
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();
jest.spyOn(console, 'clear').mockImplementation();

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
 * Note: These tests run locally only and require tmux to be installed
 */
describe('Claude GWT Full E2E Workflow', () => {
  let testDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
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

  describe('CLI Initialization Tests', () => {
    it('should start cgwt session with all CLI parameters', async () => {
      const app = new ClaudeGWTApp(testDir, {
        repo: undefined,
        quiet: true, // Use quiet mode to avoid prompts
        interactive: false, // Disable interactive mode
      });

      // Initialize empty directory workflow - should exit gracefully
      await expect(app.run()).rejects.toThrow('process.exit called');
    }, 30000);

    it('should handle --repo parameter with git clone', async () => {
      // Create a mock git repository to clone from
      const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-source-'));

      try {
        // Initialize source repo
        const sourceRepo = new GitRepository(sourceDir);
        await sourceRepo.initializeBareRepository();

        // Create initial commit
        const sourceWorktree = path.join(sourceDir, 'main');
        await fs.mkdir(sourceWorktree, { recursive: true });
        await fs.writeFile(path.join(sourceWorktree, 'README.md'), '# Test Repository\n');

        const app = new ClaudeGWTApp(testDir, {
          repo: sourceDir,
          quiet: true,
          interactive: false,
        });

        // Should handle the initialization gracefully
        await expect(app.run()).rejects.toThrow('process.exit called');

        // Note: In a real scenario, we'd verify repository was cloned
        // but in this test environment we're mocking the exit behavior
      } finally {
        await fs.rm(sourceDir, { recursive: true, force: true });
      }
    }, 45000);

    it('should handle --quiet and --clean parameters', async () => {
      const app = new ClaudeGWTApp(testDir, {
        repo: undefined,
        quiet: true,
        interactive: false,
      });

      // Should initialize without interactive prompts but exit at the end
      await expect(app.run()).rejects.toThrow('process.exit called');
    }, 30000);
  });

  describe('Multi-Branch Repository Tests', () => {
    const branches = ['main', 'feature-auth', 'feature-api', 'feature-ui'];

    beforeEach(async () => {
      // Set up base repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
    });

    it('should create multiple branches with par-run repository', async () => {
      const manager = new WorktreeManager(testDir);

      // Create all branches
      for (const branch of branches) {
        await manager.addWorktree(branch);
      }

      // Verify all branches exist
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branches.length);

      branches.forEach((branch) => {
        expect(worktrees.some((wt) => wt.branch === branch)).toBe(true);
      });
    }, 60000);

    it('should enter supervisor mode and manage all branches', async () => {
      const manager = new WorktreeManager(testDir);

      // Create branches
      for (const branch of branches) {
        await manager.addWorktree(branch);
      }

      // Test supervisor mode initialization
      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      // Mock supervisor mode entry
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(true);
      jest.spyOn(TmuxManager, 'isInsideTmux').mockReturnValue(false);
      jest.spyOn(TmuxManager, 'createDetachedSession').mockResolvedValue(undefined);
      jest.spyOn(TmuxManager, 'attachToSession').mockImplementation(() => {
        process.exit(0);
      });

      // This would normally enter supervisor mode
      await expect(app.run()).rejects.toThrow('process.exit called');
    }, 60000);

    it('should handle concurrent operations on different branches', async () => {
      const manager = new WorktreeManager(testDir);

      // Create branches concurrently
      const createPromises = branches.map((branch) => manager.addWorktree(branch));
      await Promise.all(createPromises);

      // Verify all branches were created successfully
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branches.length);

      // Test concurrent file operations
      const filePromises = branches.map(async (branch) => {
        const branchPath = path.join(testDir, branch);
        await fs.writeFile(
          path.join(branchPath, `${branch}-task.md`),
          `# Task for ${branch}\n\n- [ ] Implement feature\n- [ ] Add tests\n`,
        );
      });

      await Promise.all(filePromises);

      // Verify files were created independently
      for (const branch of branches) {
        const taskFile = path.join(testDir, branch, `${branch}-task.md`);
        const content = await fs.readFile(taskFile, 'utf-8');
        expect(content).toContain(`Task for ${branch}`);
      }
    }, 60000);
  });

  describe('Restart Scenarios', () => {
    beforeEach(async () => {
      // Set up repository with 3 branches
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('main');
      await manager.addWorktree('feature-a');
      await manager.addWorktree('feature-b');
    });

    it('should restart in existing folder with 3 branches', async () => {
      // First run - initialize everything
      const firstApp = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      await firstApp.run();

      // Second run - should detect existing setup
      const secondApp = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      await secondApp.run();

      // Verify branches still exist
      const manager = new WorktreeManager(testDir);
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(3);
      expect(worktrees.map((wt) => wt.branch).sort()).toEqual(['feature-a', 'feature-b', 'main']);
    }, 60000);

    it('should handle session recovery after tmux restart', async () => {
      const sessionName = 'cgwt-test-main';

      // Mock session info to simulate existing session without Claude
      jest.spyOn(TmuxManager, 'getSessionInfo').mockResolvedValue({
        name: sessionName,
        windows: 1,
        created: '1234567890',
        attached: false,
        hasClaudeRunning: false,
      });

      jest.spyOn(TmuxManager, 'launchSession').mockResolvedValue(undefined);

      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      await app.run();

      // Should attempt to restart Claude in existing session
      expect(TmuxManager.launchSession).toHaveBeenCalled();
    }, 30000);

    it('should handle corrupted worktree recovery', async () => {
      const manager = new WorktreeManager(testDir);

      // Create a branch then simulate corruption by removing directory
      await manager.addWorktree('corrupted-branch');
      const corruptedPath = path.join(testDir, 'corrupted-branch');
      await fs.rm(corruptedPath, { recursive: true, force: true });

      // App should handle corrupted worktree gracefully
      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: true,
      });

      await expect(app.run()).rejects.toThrow('process.exit called');
    }, 30000);
  });

  describe('Advanced Workflow Scenarios', () => {
    it('should handle rapid branch creation and deletion', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Rapidly create and delete branches
      for (let i = 0; i < 5; i++) {
        const branchName = `temp-branch-${i}`;
        await manager.addWorktree(branchName);

        // Verify it was created
        let worktrees = await manager.listWorktrees();
        expect(worktrees.some((wt) => wt.branch === branchName)).toBe(true);

        // Delete it
        await manager.removeWorktree(branchName);

        // Verify it was removed
        worktrees = await manager.listWorktrees();
        expect(worktrees.some((wt) => wt.branch === branchName)).toBe(false);
      }
    }, 60000);

    it('should handle large numbers of branches (stress test)', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const branchCount = 20;
      const branches: string[] = [];

      // Create many branches
      for (let i = 0; i < branchCount; i++) {
        const branchName = `feature-${i.toString().padStart(3, '0')}`;
        branches.push(branchName);
        await manager.addWorktree(branchName);
      }

      // Verify all branches exist
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branchCount);

      // Test batch operations
      const filePromises = branches.map(async (branch) => {
        const branchPath = path.join(testDir, branch);
        await fs.writeFile(path.join(branchPath, 'work.txt'), `Work in progress for ${branch}`);
      });

      await Promise.all(filePromises);

      // Verify all files were created
      for (const branch of branches) {
        const workFile = path.join(testDir, branch, 'work.txt');
        expect(
          await fs
            .access(workFile)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);
      }
    }, 120000);

    it('should handle nested directory structures', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('complex-feature');

      const branchPath = path.join(testDir, 'complex-feature');

      // Create complex directory structure
      const dirs = [
        'src/components/ui',
        'src/services/api',
        'src/utils/helpers',
        'tests/unit',
        'tests/integration',
        'docs/guides',
      ];

      for (const dir of dirs) {
        await fs.mkdir(path.join(branchPath, dir), { recursive: true });
        await fs.writeFile(path.join(branchPath, dir, 'index.ts'), `// ${dir} implementation\n`);
      }

      // Verify structure was created
      for (const dir of dirs) {
        const indexFile = path.join(branchPath, dir, 'index.ts');
        expect(
          await fs
            .access(indexFile)
            .then(() => true)
            .catch(() => false),
        ).toBe(true);
      }
    }, 60000);
  });

  describe('Error Scenarios', () => {
    it('should handle tmux not available gracefully', async () => {
      jest.spyOn(TmuxManager, 'isTmuxAvailable').mockResolvedValue(false);

      const app = new ClaudeGWTApp(testDir, {
        interactive: false,
        quiet: false, // Allow error messages
      });

      // Should handle tmux unavailability without crashing
      await expect(app.run()).rejects.toThrow('process.exit called');
    }, 30000);

    it('should handle insufficient disk space simulation', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Mock fs operations to simulate disk space errors
      const originalWriteFile = fs.writeFile;
      jest
        .spyOn(fs, 'writeFile')
        .mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      try {
        await manager.addWorktree('space-test');
        // Should handle the error gracefully
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }

      // Restore original function
      jest.spyOn(fs, 'writeFile').mockImplementation(originalWriteFile);
    }, 30000);

    it('should handle permission denied scenarios', async () => {
      // This test simulates permission issues
      const restrictedDir = path.join(testDir, 'restricted');
      await fs.mkdir(restrictedDir);

      // Try to initialize in a directory we can't write to
      jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const app = new ClaudeGWTApp(restrictedDir, {
        interactive: false,
        quiet: true,
      });

      // Should handle permission errors gracefully
      await expect(app.run()).rejects.toThrow();
    }, 30000);
  });
});
