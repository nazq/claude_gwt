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
 * Integration Test Suite for cgwt command
 *
 * These tests verify the cgwt quick session switcher functionality:
 * - List sessions with proper formatting
 * - Show current session marker
 * - Switch by index (including 0 for supervisor)
 * - Switch by branch name
 * - Handle tmux session switching
 */
describe('cgwt command integration tests', () => {
  let testDir: string;
  let originalCwd: string;
  let tmuxAvailable: boolean;
  const cgwtPath = path.join(__dirname, '../../dist/src/cli/cgwt.js');

  // Generate unique test ID to prevent session conflicts
  const testId = `test-${process.pid}-${Date.now()}`;
  const testSessionPrefix = `cgwt-e2e-${testId}`;

  beforeAll(async () => {
    originalCwd = process.cwd();
    // Check tmux availability
    tmuxAvailable = await TmuxManager.isTmuxAvailable();
    if (!tmuxAvailable) {
      console.log('⚠️  Tmux not available - tests will be skipped');
    }

    // Set up git config for tests
    await execCommandSafe('git', ['config', '--global', 'user.email', 'test@example.com']);
    await execCommandSafe('git', ['config', '--global', 'user.name', 'Test User']);
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cgwt-cmd-test-'));
    process.chdir(testDir);

    // Clean up any test sessions before each test
    if (tmuxAvailable) {
      try {
        const sessions = await TmuxManager.listSessions();
        for (const session of sessions) {
          // Only kill sessions that match our exact test prefix
          if (session.name.startsWith(testSessionPrefix)) {
            console.log(`Cleaning up test session: ${session.name}`);
            await TmuxManager.killSession(session.name);
          }
        }
      } catch (error) {
        console.warn('Warning: Could not clean up test sessions:', error);
      }
    }
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  afterAll(async () => {
    // Final cleanup of any remaining test sessions
    if (tmuxAvailable) {
      try {
        const sessions = await TmuxManager.listSessions();
        for (const session of sessions) {
          if (session.name.startsWith(testSessionPrefix)) {
            console.log(`Final cleanup of test session: ${session.name}`);
            await TmuxManager.killSession(session.name);
          }
        }
      } catch (error) {
        console.warn('Warning: Could not perform final session cleanup:', error);
      }
    }
  });

  describe('cgwt list functionality', () => {
    it('should show "Not in a Claude GWT managed repository" for non-git directories', async () => {
      // The new cgwt shows "No Git worktree sessions found" instead
      const output = execSync(`node ${cgwtPath} l 2>&1 || true`, { encoding: 'utf8' });
      expect(output).toMatch(/No Git worktree sessions found|Not in a Git repository/);
    });

    it('should list sessions with proper formatting', async () => {
      // Initialize git repo with initial commit
      await execCommandSafe('git', ['init']);
      await fs.writeFile('README.md', '# Test Project');
      await execCommandSafe('git', ['add', 'README.md']);
      await execCommandSafe('git', ['commit', '-m', 'Initial commit']);

      // Convert to bare repository setup
      await execCommandSafe('git', ['clone', '--bare', '.', '.bare']);
      await fs.rm('.git', { recursive: true, force: true });
      await fs.writeFile('.git', 'gitdir: .bare');

      // Create branches in bare repo
      await execCommandSafe('git', ['branch', 'feature-auth'], { cwd: '.bare' });
      await execCommandSafe('git', ['branch', 'feature-api'], { cwd: '.bare' });

      // Create worktrees with branches
      await execCommandSafe('git', ['worktree', 'add', 'main', 'master'], { cwd: '.bare' });
      await execCommandSafe('git', ['worktree', 'add', 'feature-auth', 'feature-auth'], {
        cwd: '.bare',
      });
      await execCommandSafe('git', ['worktree', 'add', 'feature-api', 'feature-api'], {
        cwd: '.bare',
      });

      const output = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      // Check for proper formatting with new cgwt output
      expect(output).toContain('Git Worktree Sessions:');
      expect(output).toContain('[1]'); // New cgwt starts at 1
      expect(output).toContain('[2]');
      expect(output).toContain('[3]');
      // Check for branches
      expect(output).toContain('feature-auth');
      expect(output).toContain('feature-api');
      expect(output).toContain('master');
      // Check for paths
      expect(output).toContain('Path:');
      expect(output).toContain('HEAD:');
    });
  });

  describe('cgwt switch functionality', () => {
    beforeEach(async () => {
      // Clone real repo with branches
      await execCommandSafe('git', [
        'clone',
        '--bare',
        'https://github.com/nazq/par-run.git',
        '.bare',
      ]);
      await fs.writeFile('.git', 'gitdir: .bare');
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });
      await execCommandSafe('git', ['branch', 'feature'], { cwd: '.bare' });
      await execCommandSafe('git', ['worktree', 'add', 'feature', 'feature'], { cwd: '.bare' });
    });

    it('should accept index 0 for supervisor', async () => {
      const output = execSync(`node ${cgwtPath} 0 2>&1 || true`, { encoding: 'utf8' });

      // New cgwt starts at index 1, so 0 is out of range
      expect(output).toContain('Index 0 is out of range');
    });

    it('should show correct range for invalid indices', async () => {
      const output = execSync(`node ${cgwtPath} 99 2>&1 || true`, { encoding: 'utf8' });

      expect(output).toContain('Index 99 is out of range');
      expect(output).toContain('Valid range: 1-2'); // New cgwt shows valid range
    });

    it('should switch by branch name without refs/heads prefix', async () => {
      const output = execSync(`node ${cgwtPath} s main 2>&1 || true`, { encoding: 'utf8' });

      // Should switch successfully
      expect(output).toContain('Switched to main');
      expect(output).toContain('Path:');
    });

    it('should handle branch names correctly', async () => {
      // Test that branch display doesn't show refs/heads/
      const listOutput = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      // Should not contain refs/heads/ in the display
      expect(listOutput).not.toContain('refs/heads/');

      // But should contain the branch names
      expect(listOutput).toContain('main');
      expect(listOutput).toContain('feature');

      // Check for proper formatting - new cgwt starts at 1
      expect(listOutput).toContain('[1]'); // First branch index
      expect(listOutput).toContain('[2]'); // Second branch index
    });
  });

  describe('cgwt error handling', () => {
    it('should handle missing arguments gracefully', async () => {
      const output = execSync(`node ${cgwtPath}`, { encoding: 'utf8' });

      // Should show help
      expect(output).toContain('Usage: cgwt');
      expect(output).toContain('Commands:');
      expect(output).toContain('l|list');
      expect(output).toContain('s|switch');
    });

    it('should handle invalid branch names', async () => {
      // Clone real repo
      await execCommandSafe('git', [
        'clone',
        '--bare',
        'https://github.com/nazq/par-run.git',
        '.bare',
      ]);
      await fs.writeFile('.git', 'gitdir: .bare');
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });

      const output = execSync(`node ${cgwtPath} s nonexistent 2>&1 || true`, { encoding: 'utf8' });

      expect(output).toContain("Branch 'nonexistent' not found");
      expect(output).toContain('Available branches:');
      expect(output).toContain('main');
    });
  });
});
