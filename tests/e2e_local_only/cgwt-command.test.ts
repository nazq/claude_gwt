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
 * End-to-End Test Suite for cgwt command
 *
 * These tests verify the cgwt quick session switcher functionality:
 * - List sessions with proper formatting
 * - Show current session marker
 * - Switch by index (including 0 for supervisor)
 * - Switch by branch name
 * - Handle tmux session switching
 */
describe('cgwt command E2E tests', () => {
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

    // Skip tmux tests if requested via env var
    if (process.env['SKIP_TMUX_TESTS'] === 'true') {
      console.log('⚠️  SKIP_TMUX_TESTS=true - tmux tests will be skipped');
      tmuxAvailable = false;
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
      const output = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });
      expect(output).toContain('Not in a Claude GWT managed repository');
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

      // Check for proper formatting
      expect(output).toContain('📋 Claude GWT Sessions:');
      expect(output).toContain('[0]');
      expect(output).toContain('[SUP]'); // Updated format
      expect(output).toContain('[1]');
      expect(output).toContain('[2]');
      // Par-run already has branches, check for the ones we created
      expect(output).toContain('feature-auth');
      expect(output).toContain('feature-api');
      expect(output).toContain('Switch with: cgwt <number> or cgwt s <branch>');

      // Should NOT have duplicate branch names in parentheses
      expect(output).not.toMatch(/main.*\(main\)/);

      // Check for colored output elements
      // When not in tmux, all sessions show as inactive
      expect(output).toContain('○'); // Inactive status indicator
    });

    it.skip('should show CURRENT marker for active tmux session', async () => {
      // SKIPPED: This test requires creating tmux sessions with specific names that cgwt expects
      // (cgwt-${repoName}-supervisor), which could conflict with real user sessions.
      // For safety, we skip this test to avoid interfering with active tmux sessions.

      if (!tmuxAvailable) {
        return;
      }

      // Clone real repo
      await execCommandSafe('git', [
        'clone',
        '--bare',
        'https://github.com/nazq/par-run.git',
        '.bare',
      ]);
      await fs.writeFile('.git', 'gitdir: .bare');
      await execCommandSafe('git', ['worktree', 'add', 'main', 'main'], { cwd: '.bare' });

      // Would need to create session with exact name pattern cgwt expects
      const repoName = path.basename(testDir);
      const sessionName = `cgwt-${repoName}-supervisor`; // This could conflict!

      // Run cgwt l inside the tmux session
      await execCommandSafe('tmux', [
        'send-keys',
        '-t',
        sessionName,
        `node ${cgwtPath} l`,
        'Enter',
      ]);

      // Wait a bit for command to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture pane content
      const paneOutput = await execCommandSafe('tmux', ['capture-pane', '-t', sessionName, '-p']);

      // The supervisor session should show active status (no CURRENT label)
      expect(paneOutput.stdout).not.toContain('CURRENT');
      expect(paneOutput.stdout).toContain('●'); // Active status indicator
      expect(paneOutput.stdout).toContain('[SUP]'); // Supervisor label

      // Clean up
      await execCommandSafe('tmux', ['kill-session', '-t', sessionName]);
    });

    it.skip('should detect current branch session correctly', async () => {
      // SKIPPED: This test requires creating tmux sessions with specific names that cgwt expects
      // (cgwt-${repoName}-${branch}), which could conflict with real user sessions.
      // For safety, we skip this test to avoid interfering with active tmux sessions.

      if (!tmuxAvailable) {
        return;
      }

      // Clone real repo and create test branch
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

      // Would need to create session with exact name pattern cgwt expects
      const repoName = path.basename(testDir);
      const sessionName = `cgwt-${repoName}-feature`; // This could conflict!

      // Run cgwt l inside the tmux session
      await execCommandSafe('tmux', [
        'send-keys',
        '-t',
        sessionName,
        `cd ${testDir}/feature && node ${cgwtPath} l`,
        'Enter',
      ]);

      // Wait for command to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture pane content
      const paneOutput = await execCommandSafe('tmux', ['capture-pane', '-t', sessionName, '-p']);

      // The feature session should show active status (no CURRENT label)
      const lines = paneOutput.stdout.split('\n');
      const featureLine = lines.find((line: string) => line.includes('feature'));
      expect(featureLine).not.toContain('CURRENT');
      expect(featureLine).toContain('●'); // Active status indicator

      // Clean up
      await execCommandSafe('tmux', ['kill-session', '-t', sessionName]);
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

      // Should not show "Invalid index: 0"
      expect(output).not.toContain('Invalid index: 0');

      // Should either switch or show tmux not found message
      expect(output).toMatch(/Switching to supervisor|Tmux session not found/);
    });

    it('should show correct range for invalid indices', async () => {
      const output = execSync(`node ${cgwtPath} 99 2>&1 || true`, { encoding: 'utf8' });

      expect(output).toContain('Invalid index: 99');
      expect(output).toContain('Available indices: 0-2'); // 0 (supervisor), 1 (main), 2 (feature)
    });

    it('should switch by branch name without refs/heads prefix', async () => {
      const output = execSync(`node ${cgwtPath} s main 2>&1 || true`, { encoding: 'utf8' });

      // Should attempt to switch
      expect(output).toMatch(/Switching to main|Tmux session not found/);

      // If tmux not found, should show helpful commands
      if (output.includes('Tmux session not found')) {
        expect(output).toContain('cd');
        expect(output).toContain('main');
        expect(output).toContain('claude-gwt');
      }
    });

    it('should handle branch names correctly', async () => {
      // Test that branch display doesn't show refs/heads/
      const listOutput = execSync(`node ${cgwtPath} l`, { encoding: 'utf8' });

      // Should not contain refs/heads/ in the display
      expect(listOutput).not.toContain('refs/heads/');

      // But should contain the branch names
      expect(listOutput).toContain('main');
      expect(listOutput).toContain('feature');

      // Check for proper formatting with colors and status indicators
      expect(listOutput).toContain('[0]'); // Supervisor index
      expect(listOutput).toContain('[1]'); // Main branch index
      expect(listOutput).toContain('[2]'); // Feature branch index
      expect(listOutput).toContain('[SUP]'); // Supervisor label
    });

    it.skip('should generate correct tmux session names', async () => {
      // SKIPPED: This test creates tmux sessions with names that could conflict with real user sessions.
      // For safety, we skip this test to avoid interfering with active tmux sessions.

      if (!tmuxAvailable) {
        return;
      }

      // Would create tmux sessions with expected names
      const repoName = path.basename(testDir);
      const supervisorSession = `cgwt-${repoName}-supervisor`; // Could conflict!
      const mainSession = `cgwt-${repoName}-main`; // Could conflict!

      await execCommandSafe('tmux', ['new-session', '-d', '-s', supervisorSession]);
      await execCommandSafe('tmux', ['new-session', '-d', '-s', mainSession]);

      // Test switching to supervisor
      const switchOutput = execSync(`node ${cgwtPath} 0 2>&1 || true`, { encoding: 'utf8' });
      expect(switchOutput).toContain('Switching to supervisor');

      // Clean up
      await execCommandSafe('tmux', ['kill-session', '-t', supervisorSession]);
      await execCommandSafe('tmux', ['kill-session', '-t', mainSession]);
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

      expect(output).toContain('Branch not found: nonexistent');
      expect(output).toContain('Available branches:');
      expect(output).toContain('main');
    });
  });
});
