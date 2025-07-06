import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execCommandSafe } from '../../src/core/utils/async';
import { TmuxManager } from '../../src/sessions/TmuxManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Safe tests for cgwt command that replace the skipped tests
 * These tests don't create real tmux sessions to avoid conflicts
 */
describe('cgwt command safe tests', () => {
  let testDir: string;
  let originalCwd: string;
  const cgwtPath = path.join(__dirname, '../../dist/src/cli/cgwt.js');

  beforeEach(async () => {
    originalCwd = process.cwd();
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-safe-test-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    // Clean up the temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('cgwt help and version', () => {
    it('should show help when no arguments provided', () => {
      const output = execSync(`node ${cgwtPath}`, { encoding: 'utf8' });

      expect(output).toContain('Usage: cgwt');
      expect(output).toContain('Commands:');
      expect(output).toContain('l|list');
      expect(output).toContain('s|switch');
    });

    it('should show version', () => {
      const output = execSync(`node ${cgwtPath} --version`, { encoding: 'utf8' });

      expect(output).toMatch(/\d+\.\d+\.\d+/); // Semantic version
    });

    it('should show help with --help flag', () => {
      const output = execSync(`node ${cgwtPath} --help`, { encoding: 'utf8' });

      expect(output).toContain('Usage: cgwt');
      expect(output).toContain('Quick session switcher for Claude GWT');
    });
  });

  describe('cgwt list validation', () => {
    it('should validate git worktree setup', async () => {
      // Simpler approach: clone a small repo
      await execCommandSafe('git', [
        'clone',
        '--bare',
        'https://github.com/nazq/par-run.git',
        '.bare',
      ]);
      await fs.writeFile('.git', 'gitdir: .bare');

      // Add worktree
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });

      const output = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      expect(output).toContain('Git Worktree Sessions');
      expect(output).toContain('[1]');
      expect(output).toContain('main');
      expect(output).toContain('Path:');
    }, 30000);

    it('should handle empty worktree list gracefully', async () => {
      // Initialize bare repo but don't add worktrees
      await execCommandSafe('git', ['init', '--bare', '.bare']);
      await fs.writeFile('.git', 'gitdir: .bare');

      const output = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      expect(output).toContain('No Git worktree sessions found');
    });
  });

  describe('cgwt switch validation', () => {
    it('should validate branch exists before switching', async () => {
      // Set up worktree
      await execCommandSafe('git', ['init', '--bare', '.bare']);
      await fs.writeFile('.git', 'gitdir: .bare');

      // Create commit
      const treeHash = await execCommandSafe('git', ['write-tree'], { cwd: '.bare' });
      const commitHash = await execCommandSafe(
        'git',
        ['commit-tree', treeHash.stdout.trim(), '-m', 'Initial'],
        { cwd: '.bare' },
      );
      await execCommandSafe('git', ['update-ref', 'refs/heads/main', commitHash.stdout.trim()], {
        cwd: '.bare',
      });
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });

      // Try to switch to non-existent branch
      const output = execSync(`node ${cgwtPath} s nonexistent 2>&1 || true`, { encoding: 'utf8' });

      expect(output).toContain("Branch 'nonexistent' not found");
      expect(output).toContain('Available branches:');
    });

    it('should validate index range', async () => {
      // Set up worktree
      await execCommandSafe('git', ['init', '--bare', '.bare']);
      await fs.writeFile('.git', 'gitdir: .bare');

      const treeHash = await execCommandSafe('git', ['write-tree'], { cwd: '.bare' });
      const commitHash = await execCommandSafe(
        'git',
        ['commit-tree', treeHash.stdout.trim(), '-m', 'Initial'],
        { cwd: '.bare' },
      );
      await execCommandSafe('git', ['update-ref', 'refs/heads/main', commitHash.stdout.trim()], {
        cwd: '.bare',
      });
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });

      // Try invalid indices
      const output1 = execSync(`node ${cgwtPath} 0 2>&1 || true`, { encoding: 'utf8' });
      expect(output1).toContain('Index 0 is out of range');

      const output2 = execSync(`node ${cgwtPath} 99 2>&1 || true`, { encoding: 'utf8' });
      expect(output2).toContain('Index 99 is out of range');
    });
  });

  describe('cgwt output formatting', () => {
    it('should format branch names correctly', async () => {
      // Clone repo and create branches
      await execCommandSafe('git', [
        'clone',
        '--bare',
        'https://github.com/nazq/par-run.git',
        '.bare',
      ]);
      await fs.writeFile('.git', 'gitdir: .bare');

      // Create additional branches in the bare repo
      await execCommandSafe('git', ['branch', 'feature-test'], { cwd: '.bare' });
      await execCommandSafe('git', ['branch', 'bugfix-123'], { cwd: '.bare' });

      // Add worktrees
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });
      await execCommandSafe('git', ['worktree', 'add', 'feature', 'feature-test'], {
        cwd: '.bare',
      });
      await execCommandSafe('git', ['worktree', 'add', 'bugfix', 'bugfix-123'], { cwd: '.bare' });

      const output = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      // Check proper formatting
      expect(output).toContain('[1]');
      expect(output).toContain('[2]');
      expect(output).toContain('[3]');
      expect(output).toContain('main');
      expect(output).toContain('feature-test');
      expect(output).toContain('bugfix-123');
      expect(output).not.toContain('refs/heads/'); // Should strip refs/heads/ prefix
    }, 30000);
  });
});
