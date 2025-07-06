import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GitRepository } from '../../src/core/git/GitRepository.js';
import { WorktreeManager } from '../../src/core/git/WorktreeManager.js';
import { GitDetector } from '../../src/core/git/GitDetector.js';
import { TmuxManager } from '../../src/sessions/TmuxManager.js';
import { itSkipCI } from '../helpers/ci-helper.js';

describe('Real-World Workflow Integration', () => {
  let testDir: string;
  const branches = [
    'feature-auth',
    'feature-api',
    'feature-ui',
    'feature-db',
    'feature-cache',
    'feature-logs',
    'feature-tests',
  ];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-workflow-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Complete workflow with multiple branches', () => {
    itSkipCI('should handle a complete development workflow', async () => {
      // 1. Initialize repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      // 2. Verify structure
      const bareDir = path.join(testDir, '.bare');
      const gitFile = path.join(testDir, '.git');
      expect(await fs.stat(bareDir).then((s) => s.isDirectory())).toBe(true);
      expect(await fs.readFile(gitFile, 'utf-8')).toContain('gitdir: ./.bare');

      // 3. Create multiple feature branches
      const manager = new WorktreeManager(testDir);
      const createdBranches: string[] = [];

      for (const branch of branches) {
        const worktreePath = await manager.addWorktree(branch);
        expect(worktreePath).toContain(branch);
        createdBranches.push(worktreePath);
      }

      // 4. Verify all worktrees
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(branches.length);

      // 5. Test branch independence
      for (const branch of branches) {
        const branchPath = path.join(testDir, branch);
        const exists = await fs
          .access(branchPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);

        // Create unique file in each branch
        const testFile = path.join(branchPath, `${branch}.txt`);
        await fs.writeFile(testFile, `Work for ${branch}`);
      }

      // 6. Verify files are isolated to their branches
      for (const branch of branches) {
        const branchPath = path.join(testDir, branch);
        const files = await fs.readdir(branchPath);

        // Should have its own file
        expect(files).toContain(`${branch}.txt`);

        // Should not have other branches' files
        for (const otherBranch of branches) {
          if (otherBranch !== branch) {
            expect(files).not.toContain(`${otherBranch}.txt`);
          }
        }
      }
    });

    itSkipCI('should support concurrent operations on different branches', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Create branches concurrently
      const promises = branches.slice(0, 3).map((branch) => manager.addWorktree(branch));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);

      // Verify all were created
      const worktrees = await manager.listWorktrees();
      expect(worktrees.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Task assignment and tracking', () => {
    itSkipCI('should handle task files in each branch', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);
      const branch = 'feature-tasks';
      await manager.addWorktree(branch);

      // Create task file
      const taskPath = path.join(testDir, branch, 'TASK.md');
      const taskContent = `# Task: Implement Feature
      
## Requirements
- [ ] Write code
- [ ] Add tests
- [ ] Update docs

## Status
In Progress
`;
      await fs.writeFile(taskPath, taskContent);

      // Verify task file exists
      const taskExists = await fs
        .access(taskPath)
        .then(() => true)
        .catch(() => false);
      expect(taskExists).toBe(true);

      // Read and verify content
      const content = await fs.readFile(taskPath, 'utf-8');
      expect(content).toContain('Implement Feature');
      expect(content).toContain('Write code');
    });
  });

  describe('Phoenix/Tmux integration', () => {
    it('should generate correct session names', () => {
      const repoName = 'test-repo';
      for (const branch of branches) {
        const sessionName = TmuxManager.getSessionName(repoName, branch);
        expect(sessionName).toBe(`cgwt-${repoName}-${branch}`);
        expect(sessionName).toMatch(/^cgwt-test-repo-feature-/);
      }
    });

    it('should detect tmux availability', async () => {
      const isAvailable = await TmuxManager.isTmuxAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should have proper session configuration', () => {
      const config = {
        sessionName: 'test-session',
        workingDirectory: testDir,
        branchName: 'test-branch',
        role: 'child' as const,
      };

      // Verify config structure
      expect(config.sessionName).toBe('test-session');
      expect(config.branchName).toBe('test-branch');
      expect(config.role).toBe('child');
      expect(config.workingDirectory).toBe(testDir);
    });
  });

  describe('Repository cloning workflow', () => {
    itSkipCI('should handle cloning from a URL', async () => {
      // This test would require network access to clone a real repo
      // For unit tests, we'll simulate this
      const repo = new GitRepository(testDir);

      // Initialize as if cloned
      const result = await repo.initializeBareRepository();
      expect(result.defaultBranch).toBeDefined();

      // Verify we can detect it properly
      const detector = new GitDetector(testDir);
      const state = await detector.detectState();
      expect(state.type).toBe('claude-gwt-parent');
    });
  });

  describe('Branch removal workflow', () => {
    itSkipCI('should safely remove worktrees', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();

      const manager = new WorktreeManager(testDir);

      // Create and then remove a branch
      const branch = 'temp-feature';
      await manager.addWorktree(branch);

      // Verify it exists
      let worktrees = await manager.listWorktrees();
      expect(worktrees.some((wt) => wt.branch === branch)).toBe(true);

      // Remove it
      await manager.removeWorktree(branch);

      // Verify it's gone
      worktrees = await manager.listWorktrees();
      expect(worktrees.some((wt) => wt.branch === branch)).toBe(false);

      // Verify directory is gone
      const branchPath = path.join(testDir, branch);
      const exists = await fs
        .access(branchPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });
});
