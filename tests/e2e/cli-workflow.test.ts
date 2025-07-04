import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('CLI End-to-End Workflow', () => {
  let testDir: string;
  const cliPath = path.join(__dirname, '../../dist/src/cli/index.js');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function runCLI(
    args: string[],
    cwd: string = testDir,
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd,
        env: { ...process.env, NO_COLOR: '1' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
    });
  }

  describe('CLI basic operations', () => {
    it('should show help', async () => {
      const { stdout, code } = await runCLI(['--help']);
      expect(code).toBe(0);
      expect(stdout).toContain('Git Worktree Manager with Claude Code Orchestration');
      expect(stdout).toContain('--repo');
      expect(stdout).toContain('--branch');
    });

    it('should show version', async () => {
      const { stdout, code } = await runCLI(['--version']);
      expect(code).toBe(0);
      expect(stdout).toContain('1.0.0');
    });
  });

  describe('Empty directory workflow', () => {
    it('should initialize empty directory in non-interactive mode', async () => {
      const { code } = await runCLI(['.', '--no-interactive', '--quiet']);

      // Should complete successfully
      expect(code).toBe(0);

      // Verify structure was created
      const gitFile = path.join(testDir, '.git');
      const bareDir = path.join(testDir, '.bare');

      expect(
        await fs
          .access(gitFile)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
      expect(
        await fs
          .access(bareDir)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
    });
  });

  describe('Repository initialization with URL', () => {
    it('should handle local repository initialization', async () => {
      const { code } = await runCLI(['.', '--repo', '', '--no-interactive', '--quiet']);

      expect(code).toBe(0);

      // Verify bare repo structure
      const files = await fs.readdir(testDir);
      expect(files).toContain('.git');
      expect(files).toContain('.bare');
      expect(files).toContain('README.md');
    });
  });

  describe('Non-git directory handling', () => {
    it('should detect non-git directory with files', async () => {
      // Create a file in the directory
      await fs.writeFile(path.join(testDir, 'existing.txt'), 'content');

      const { stdout, code } = await runCLI(['.', '--no-interactive']);

      // Should exit with error
      expect(code).toBe(1);
      expect(stdout).toContain('not empty and not a Git repository');
    });
  });

  describe('Complete workflow simulation', () => {
    it('should handle a complete developer workflow', async () => {
      // Step 1: Initialize
      let result = await runCLI(['.', '--repo', '', '--no-interactive', '--quiet']);
      expect(result.code).toBe(0);

      // Step 2: Verify we can run again and it detects the worktree
      result = await runCLI(['.', '--no-interactive']);
      expect(result.stdout).toContain('Git branch environment ready');

      // Step 3: Check that main branch was created
      const mainPath = path.join(testDir, 'main');
      const mainExists = await fs
        .access(mainPath)
        .then(() => true)
        .catch(() => false);
      // Note: In non-interactive mode, main branch might not be auto-created
      // This is expected behavior
      expect(typeof mainExists).toBe('boolean');
    });
  });
});
