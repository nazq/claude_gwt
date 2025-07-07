import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { simpleGit, type SimpleGit } from 'simple-git';
import { GitRepository } from '../../src/core/git/GitRepository.js';
import { WorktreeManager } from '../../src/core/git/WorktreeManager.js';
import { execCommandSafe } from '../../src/core/utils/async.js';

describe('Existing Branch Worktree Integration', () => {
  let testDir: string;
  let git: SimpleGit;
  const PAR_RUN_REPO = 'https://github.com/nazq/par-run.git';

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-existing-branch-'));
    process.chdir(testDir);

    // Set up git config for tests
    await execCommandSafe('git', ['config', '--global', 'user.email', 'test@example.com']);
    await execCommandSafe('git', ['config', '--global', 'user.name', 'Test User']);

    git = simpleGit(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    process.chdir(os.tmpdir());
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('getBranchesWithoutWorktrees with par-run repo', () => {
    it('should correctly identify branches without worktrees in par-run repository', async () => {
      // Initialize repository with par-run
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      // Create worktree manager
      const worktreeManager = new WorktreeManager(testDir);

      // Initially, no worktrees should exist
      const initialWorktrees = await worktreeManager.listWorktrees();
      expect(initialWorktrees).toHaveLength(0);

      // Get branches without worktrees - should include all branches from par-run
      const branchesWithoutWorktrees = await worktreeManager.getBranchesWithoutWorktrees();

      // par-run repo has main branch and feature branches
      expect(branchesWithoutWorktrees).toContain('main');
      expect(branchesWithoutWorktrees.length).toBeGreaterThan(0);

      // Create a worktree for main branch
      await worktreeManager.addWorktree('main');

      // Now main should not be in the list
      const branchesAfterMain = await worktreeManager.getBranchesWithoutWorktrees();
      expect(branchesAfterMain).not.toContain('main');

      // But other branches should still be there
      const otherBranches = branchesWithoutWorktrees.filter((b) => b !== 'main');
      if (otherBranches.length > 0) {
        expect(branchesAfterMain).toContain(otherBranches[0]);
      }
    });

    it('should handle all existing branches in par-run repo', async () => {
      // Initialize repository with par-run
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      const worktreeManager = new WorktreeManager(testDir);

      // Get all branches
      const allBranches = await worktreeManager.getBranchesWithoutWorktrees();
      console.log('Par-run branches found:', allBranches);

      // Create worktrees for first few branches (limit to avoid timeout)
      const branchesToTest = allBranches.slice(0, 3);

      for (const branch of branchesToTest) {
        const worktreePath = await worktreeManager.addWorktree(branch);
        expect(worktreePath).toBe(path.join(testDir, branch));

        // Verify worktree exists
        const exists = await fs
          .access(worktreePath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }

      // Verify these branches are no longer in the list
      const remainingBranches = await worktreeManager.getBranchesWithoutWorktrees();
      for (const branch of branchesToTest) {
        expect(remainingBranches).not.toContain(branch);
      }
    });
  });

  describe('addWorktree for existing par-run branches', () => {
    it('should successfully create worktrees for par-run branches', async () => {
      // Initialize repository with par-run
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      const worktreeManager = new WorktreeManager(testDir);

      // Add main worktree first
      const mainPath = await worktreeManager.addWorktree('main');
      expect(mainPath).toBe(path.join(testDir, 'main'));

      // Verify main worktree exists
      const worktreeExists = await fs
        .access(mainPath)
        .then(() => true)
        .catch(() => false);
      expect(worktreeExists).toBe(true);

      // Check if we can run git status in the worktree
      const worktreeGit = simpleGit(mainPath);
      const status = await worktreeGit.status();
      expect(status.current).toBe('main');

      // Get list of other branches
      const branches = await worktreeManager.getBranchesWithoutWorktrees();

      // If there are feature branches, test one
      const featureBranch = branches.find(
        (b) => b.startsWith('feature/') || b.includes('fix') || b.includes('update'),
      );
      if (featureBranch) {
        const featurePath = await worktreeManager.addWorktree(featureBranch);
        expect(featurePath).toBe(path.join(testDir, featureBranch));

        // Verify worktree was created
        const exists = await fs
          .access(featurePath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }

      // Verify all worktrees are listed correctly
      const worktrees = await worktreeManager.listWorktrees();
      expect(worktrees.length).toBeGreaterThanOrEqual(1); // At least main

      const worktreeBranches = worktrees.map((wt) => wt.branch);
      expect(worktreeBranches).toContain('main');
      if (featureBranch) {
        expect(worktreeBranches).toContain(featureBranch);
      }
    });

    it('should create new branch when branch does not exist', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      const worktreeManager = new WorktreeManager(testDir);

      // Create worktree for non-existent branch - git will create it
      const newBranchPath = await worktreeManager.addWorktree('new-test-branch-xyz123');
      expect(newBranchPath).toBe(path.join(testDir, 'new-test-branch-xyz123'));

      // Verify the branch was created
      const worktrees = await worktreeManager.listWorktrees();
      const newBranchWorktree = worktrees.find((wt) => wt.branch === 'new-test-branch-xyz123');
      expect(newBranchWorktree).toBeDefined();
    });
  });

  describe('Complete workflow simulation with par-run', () => {
    it('should handle a complete workflow of managing par-run branches', async () => {
      // Initialize repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      const worktreeManager = new WorktreeManager(testDir);

      // Step 1: Check initial state - no worktrees
      const initialBranches = await worktreeManager.getBranchesWithoutWorktrees();
      expect(initialBranches.length).toBeGreaterThan(0);
      console.log(`Found ${initialBranches.length} branches in par-run repo`);

      // Step 2: Add main worktree
      const mainPath = await worktreeManager.addWorktree('main');
      expect(mainPath).toBe(path.join(testDir, 'main'));

      // Step 3: Verify main is no longer in available branches
      const branchesAfterMain = await worktreeManager.getBranchesWithoutWorktrees();
      expect(branchesAfterMain).not.toContain('main');
      expect(branchesAfterMain.length).toBe(initialBranches.length - 1);

      // Step 4: Add another branch if available
      if (branchesAfterMain.length > 0) {
        const nextBranch = branchesAfterMain[0];
        const nextPath = await worktreeManager.addWorktree(nextBranch);
        expect(nextPath).toBe(path.join(testDir, nextBranch));

        // Verify it's no longer available
        const branchesAfterNext = await worktreeManager.getBranchesWithoutWorktrees();
        expect(branchesAfterNext).not.toContain(nextBranch);
        expect(branchesAfterNext.length).toBe(branchesAfterMain.length - 1);
      }

      // Step 5: List all worktrees
      const allWorktrees = await worktreeManager.listWorktrees();
      expect(allWorktrees.length).toBeGreaterThanOrEqual(1);

      // Step 6: Remove main worktree and verify it appears in branches without worktrees again
      await worktreeManager.removeWorktree('main');

      const branchesAfterRemoval = await worktreeManager.getBranchesWithoutWorktrees();
      expect(branchesAfterRemoval).toContain('main');
    });

    it('should handle rapid worktree creation and removal', async () => {
      // Initialize repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository(PAR_RUN_REPO);

      const worktreeManager = new WorktreeManager(testDir);

      // Get all branches
      const allBranches = await worktreeManager.getBranchesWithoutWorktrees();

      // Test rapid operations on first 3 branches
      const testBranches = allBranches.slice(0, Math.min(3, allBranches.length));

      // Rapidly create all worktrees
      const createPromises = testBranches.map((branch) => worktreeManager.addWorktree(branch));
      const paths = await Promise.all(createPromises);

      // Verify all were created
      for (let i = 0; i < testBranches.length; i++) {
        expect(paths[i]).toBe(path.join(testDir, testBranches[i]));
      }

      // Verify no branches without worktrees (for our test branches)
      const remainingBranches = await worktreeManager.getBranchesWithoutWorktrees();
      for (const branch of testBranches) {
        expect(remainingBranches).not.toContain(branch);
      }

      // Rapidly remove all worktrees
      const removePromises = testBranches.map((branch) => worktreeManager.removeWorktree(branch));
      await Promise.all(removePromises);

      // Verify all branches are available again
      const finalBranches = await worktreeManager.getBranchesWithoutWorktrees();
      for (const branch of testBranches) {
        expect(finalBranches).toContain(branch);
      }
    });
  });
});
