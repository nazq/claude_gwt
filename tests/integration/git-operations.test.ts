import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GitDetector } from '../../src/core/git/GitDetector';
import { GitRepository } from '../../src/core/git/GitRepository';
import { WorktreeManager } from '../../src/core/git/WorktreeManager';
import { simpleGit } from 'simple-git';

describe('Git Operations Integration', () => {
  let testDir: string;
  
  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-test-'));
  });
  
  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('GitDetector', () => {
    it('should detect empty directory', async () => {
      const detector = new GitDetector(testDir);
      const state = await detector.detectState();
      
      expect(state.type).toBe('empty');
      expect(state.path).toBe(testDir);
    });
    
    it('should detect non-git directory with files', async () => {
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');
      
      const detector = new GitDetector(testDir);
      const state = await detector.detectState();
      
      expect(state.type).toBe('non-git');
    });
    
    it('should detect regular git repository', async () => {
      const git = simpleGit(testDir);
      await git.init();
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await git.add('README.md');
      await git.commit('Initial commit');
      
      const detector = new GitDetector(testDir);
      const state = await detector.detectState();
      
      expect(state.type).toBe('git-repo');
      expect(state.gitInfo?.isWorktree).toBe(false);
      expect(state.gitInfo?.branch).toBeDefined();
    });
  });
  
  describe('GitRepository', () => {
    it('should initialize bare repository', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      
      // Check that .bare directory exists
      const bareDir = path.join(testDir, '.bare');
      const bareStat = await fs.stat(bareDir);
      expect(bareStat.isDirectory()).toBe(true);
      
      // Check that .git file exists
      const gitFile = path.join(testDir, '.git');
      const gitContent = await fs.readFile(gitFile, 'utf-8');
      expect(gitContent).toContain('gitdir: ./.bare');
      
      // Verify it's a valid git repo
      const git = simpleGit(testDir);
      const status = await git.status();
      expect(status).toBeDefined();
    });
    
    it('should get default branch', async () => {
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      
      const defaultBranch = await repo.getDefaultBranch();
      expect(['main', 'master']).toContain(defaultBranch);
    });
  });
  
  describe('WorktreeManager', () => {
    let repo: GitRepository;
    
    beforeEach(async () => {
      repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
    });
    
    it('should list worktrees', async () => {
      const manager = new WorktreeManager(testDir);
      const worktrees = await manager.listWorktrees();
      
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0]?.path).toBe(testDir);
    });
    
    it('should add new worktree', async () => {
      const manager = new WorktreeManager(testDir);
      const branchName = 'feature-test';
      
      const worktreePath = await manager.addWorktree(branchName);
      
      expect(worktreePath).toContain(branchName);
      
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(2);
      
      const newWorktree = worktrees.find(wt => wt.branch === branchName);
      expect(newWorktree).toBeDefined();
      expect(newWorktree?.path).toBe(worktreePath);
    });
    
    it('should remove worktree', async () => {
      const manager = new WorktreeManager(testDir);
      const branchName = 'temp-branch';
      
      // Add a worktree
      await manager.addWorktree(branchName);
      
      // Verify it exists
      let worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(2);
      
      // Remove it
      await manager.removeWorktree(branchName);
      
      // Verify it's gone
      worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(1);
      expect(worktrees.find(wt => wt.branch === branchName)).toBeUndefined();
    });
  });
  
  describe('Full workflow', () => {
    it('should handle complete worktree setup', async () => {
      // 1. Detect empty directory
      const detector = new GitDetector(testDir);
      let state = await detector.detectState();
      expect(state.type).toBe('empty');
      
      // 2. Initialize bare repository
      const repo = new GitRepository(testDir);
      await repo.initializeBareRepository();
      
      // 3. Detect again - should be git-worktree
      state = await detector.detectState();
      expect(state.type).toBe('git-worktree');
      expect(state.gitInfo?.isBareRepo).toBe(true);
      
      // 4. Create worktrees
      const manager = new WorktreeManager(testDir);
      await manager.addWorktree('feature-a');
      await manager.addWorktree('feature-b');
      
      // 5. List all worktrees
      const worktrees = await manager.listWorktrees();
      expect(worktrees).toHaveLength(3); // main + 2 features
      
      const branches = worktrees.map(wt => wt.branch).sort();
      expect(branches).toContain('feature-a');
      expect(branches).toContain('feature-b');
    });
  });
});