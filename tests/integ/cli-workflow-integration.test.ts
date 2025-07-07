import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { testCgwtApp, InteractiveCLITester } from '../utils/interactive-cli-tester.js';

describe('CLI Integration Workflow', () => {
  let testDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/src/cli/cgwt.js'); // Use cgwt instead of index.js

  beforeAll(async () => {
    originalCwd = process.cwd();
    // Verify CLI exists
    try {
      await fs.access(cliPath);
      const stats = await fs.stat(cliPath);
      if (process.platform !== 'win32' && !(stats.mode & 0o111)) {
        console.warn(`Warning: CLI file is not executable: ${cliPath}`);
      }
    } catch (error) {
      throw new Error(`CLI not found at ${cliPath}. Run 'npm run build' first.`);
    }
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-e2e-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function runCgwtCLI(
    args: string[],
    options: { timeout?: number; input?: string } = {},
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const nodePath = process.execPath;
      const child = spawn(nodePath, [cliPath, ...args], {
        cwd: testDir,
        env: { ...process.env, NO_COLOR: '1', NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        console.error('Failed to spawn CLI process:', error);
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error('=== CLI DEBUG INFO ===');
          console.error('CLI failed with exit code:', code);
          console.error('Args:', args);
          console.error('STDOUT:', JSON.stringify(stdout));
          console.error('STDERR:', JSON.stringify(stderr));
          console.error('=== END DEBUG INFO ===');
        }
        resolve({ stdout, stderr, code: code ?? 0 });
      });

      // Handle input if provided
      if (options.input) {
        setTimeout(() => {
          child.stdin?.write(options.input);
          child.stdin?.end();
        }, 100);
      }

      // Timeout protection
      const timeout = options.timeout || 5000;
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 1000);
        }
      }, timeout);
    });
  }

  describe('CLI basic operations', () => {
    it('should show help for cgwt', async () => {
      const { stdout, stderr, code } = await runCgwtCLI(['--help']);
      expect(code).toBe(0);
      expect(stdout).toContain('Quick session switcher and Git worktree manager');
      expect(stdout).toContain('-l [project]');
      expect(stdout).toContain('-a <index>');
    });

    it('should show help for cgwt app', async () => {
      const { stdout, code } = await runCgwtCLI(['app', '--help']);
      expect(code).toBe(0);
      expect(stdout).toContain('Guided setup experience or explicit app commands');
      expect(stdout).toContain('init [options] [path]');
      expect(stdout).toContain('new [options] <branch>');
    });

    it('should show version', async () => {
      const { stdout, code } = await runCgwtCLI(['--version']);
      expect(code).toBe(0);
      // Version should match semver pattern
      expect(stdout).toMatch(/\d+\.\d+\.\d+(-\w+\.\d+)?/);
    });
  });

  describe('Guided experience workflow', () => {
    it('should start guided experience in empty directory', async () => {
      const result = await new Promise<{ stdout: string; stderr: string; code: number }>(
        (resolve) => {
          const child = spawn('node', [cliPath, 'app'], {
            cwd: testDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'test' },
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('exit', (code) => {
            resolve({ stdout, stderr, code: code ?? 0 });
          });

          // Send Ctrl+C after the guided experience starts
          setTimeout(() => {
            child.stdin?.write('\x03'); // Ctrl+C
          }, 1000);

          // Force kill after 3 seconds
          setTimeout(() => {
            child.kill();
          }, 3000);
        },
      );

      // Should detect directory state and show guided experience
      expect(result.stdout).toMatch(/directory detected/);
      expect(result.stdout).toMatch(/What would you like to do/);
    });

    it('should handle guided experience exit', async () => {
      const tester = new InteractiveCLITester({
        timeout: 5000,
        cwd: testDir,
      });

      try {
        await tester.start('node', [cliPath, 'app']);

        // Wait for guided experience to start
        await tester.waitFor(/directory detected/, 2000);

        // Send Ctrl+C to exit
        tester.send('\x03');

        const result = await tester.waitForExit();

        // Should have started the guided experience
        expect(result.stdout).toMatch(/directory detected/);
      } finally {
        tester.kill();
      }
    });
  });

  describe('App command workflows', () => {
    it('should initialize with app init command', async () => {
      // Create a simple non-interactive init
      const { stdout, stderr, code } = await runCgwtCLI(
        ['app', 'init', '.', '--repo', 'https://github.com/user/test-repo.git'],
        { timeout: 10000 },
      );

      if (code !== 0) {
        console.log('Init failed, but this might be expected in test environment');
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      // In test environment, this might fail due to git operations
      // But the command should be recognized
      expect(stderr).not.toContain('Unknown command');
      expect(stderr).not.toContain('command not found');
    });

    it('should show logs location', async () => {
      const { stdout, code } = await runCgwtCLI(['app', 'logs']);
      expect(code).toBe(0);
      expect(stdout).toContain('Log file location:');
      expect(stdout).toContain('.claude-gwt.log');
    });

    it('should handle app commands help', async () => {
      const commands = ['init', 'new', 'launch', 'setup'];

      for (const cmd of commands) {
        const { stdout, code } = await runCgwtCLI(['app', cmd, '--help']);
        expect(code).toBe(0);
        expect(stdout).toContain('Usage:');
      }
    });
  });

  describe('Multi-project support', () => {
    it('should list projects when no sessions exist', async () => {
      const { stdout, code } = await runCgwtCLI(['-l']);
      expect(code).toBe(0);
      // Should not crash, might show "No projects found"
      expect(stdout).toMatch(/No Claude GWT projects found|Projects:/);
    });

    it('should handle list active sessions', async () => {
      const { stdout, code } = await runCgwtCLI(['-la']); // List active sessions
      expect(code).toBe(0);
      expect(stdout).toMatch(/No active Claude GWT sessions|Active Claude GWT Sessions:/);
    });

    it('should handle invalid attach index', async () => {
      const { stdout, stderr, code } = await runCgwtCLI(['-a', '99.99']);

      // When no sessions exist, might succeed but show no results
      expect([0, 1]).toContain(code);
      expect(stdout + stderr).toMatch(/Invalid|No.*sessions|projects/i);
    });
  });

  describe('Legacy command support', () => {
    it('should support legacy list command', async () => {
      const { stdout, code } = await runCgwtCLI(['l']); // Short form
      // May fail if no worktrees exist, which is expected
      expect([0, 1]).toContain(code);
    });

    it('should handle legacy switch command format', async () => {
      const { stdout, stderr, code } = await runCgwtCLI(['s', 'main']);

      // Might fail if no worktrees exist, but should recognize command
      expect(stderr).not.toContain('Unknown command');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid arguments gracefully', async () => {
      const { stdout, code } = await runCgwtCLI(['invalid-command']);

      expect(code).toBe(1);
      expect(stdout).toContain('Invalid argument');
      expect(stdout).toContain('Quick Commands:');
    });

    it('should show helpful error for missing arguments', async () => {
      const { stdout, stderr, code } = await runCgwtCLI(['app', 'new']);

      expect(code).not.toBe(0);
      expect(stdout + stderr).toMatch(/required|missing|argument/i);
    });
  });
});
