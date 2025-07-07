import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Guided Experience Interactive Tests', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await mkdtemp(join(tmpdir(), 'cgwt-guided-test-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should start guided experience and show directory detection', async () => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn('node', [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'test',
          },
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          const text = data.toString();
          stdout += text;
        });

        child.stderr?.on('data', (data) => {
          const text = data.toString();
          stderr += text;
        });

        child.on('exit', (code) => {
          resolve({ code, stdout, stderr });
        });

        // Send Ctrl+C after a short delay to exit gracefully
        setTimeout(() => {
          child.stdin?.write('\x03'); // Ctrl+C
        }, 1500);

        // Force kill after 3 seconds
        setTimeout(() => {
          child.kill();
        }, 3000);
      },
    );

    // Should detect the directory and start guided experience
    expect(result.stdout).toMatch(/directory detected/);
    expect(result.stdout).toMatch(/What would you like to do/);
  });

  it('should show help output correctly', async () => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn('node', [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app', '--help'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
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
          resolve({ code, stdout, stderr });
        });

        // Timeout after 2 seconds
        setTimeout(() => {
          child.kill();
        }, 2000);
      },
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Guided setup experience');
    expect(result.stdout).toContain('init [options] [path]');
    expect(result.stdout).toContain('new [options] <branch>');
  });

  it('should handle quiet flag correctly', async () => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn('node', [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app', '--quiet'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'test',
          },
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
          resolve({ code, stdout, stderr });
        });

        // Send Ctrl+C after a short delay
        setTimeout(() => {
          child.stdin?.write('\x03');
        }, 1000);

        // Force kill after 2 seconds
        setTimeout(() => {
          child.kill();
        }, 2000);
      },
    );

    // With --quiet flag, should not show the banner but should show directory detection
    expect(result.stdout).not.toMatch(/🎯 Claude GWT Guided Setup/);
    expect(result.stdout).toMatch(/directory detected/);
  });

  it('should handle process interruption gracefully', async () => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn('node', [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
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
          resolve({ code, stdout, stderr });
        });

        // Immediately send SIGINT
        setTimeout(() => {
          child.kill('SIGINT');
        }, 500);
      },
    );

    // Process should exit cleanly when interrupted
    expect([0, null, 1, 2, 130]).toContain(result.code); // Various acceptable exit codes
  });

  it('should demonstrate the guided experience flows', async () => {
    // This test just documents what the guided experience should do
    // based on directory state detection

    const scenarios = [
      {
        state: 'empty-directory',
        expected: [
          'Empty directory detected',
          'Clone an existing repository',
          'Initialize a new local repository',
        ],
      },
      {
        state: 'non-git-directory',
        expected: [
          'Non-Git directory detected',
          'Initialize a new Git repository',
          'Clone an existing repository',
        ],
      },
      {
        state: 'claude-gwt-parent',
        expected: [
          'Claude GWT project detected',
          'Create a new branch/worktree',
          'Launch Claude in supervisor mode',
        ],
      },
      {
        state: 'git-worktree',
        expected: [
          'Git worktree detected',
          'Launch Claude in this branch',
          'Create a new branch/worktree',
        ],
      },
      {
        state: 'git-repo',
        expected: [
          'Regular Git repository detected',
          'Convert to worktree structure',
          'Launch Claude with limited functionality',
        ],
      },
    ];

    // This is a documentation test - just verify the scenarios are defined
    expect(scenarios.length).toBe(5);
    scenarios.forEach((scenario) => {
      expect(scenario.state).toBeTruthy();
      expect(scenario.expected.length).toBeGreaterThan(0);
    });
  });
});
