import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CLI Debug Tests', () => {
  it('should run cgwt app and capture all output', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'cgwt-debug-'));
    const originalCwd = process.cwd();

    try {
      process.chdir(testDir);

      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolve) => {
          const child = spawn(
            'node',
            [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app', '--help'],
            {
              cwd: process.cwd(),
              stdio: ['pipe', 'pipe', 'pipe'],
            },
          );

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

          // Auto-exit after 2 seconds
          setTimeout(() => {
            child.kill();
          }, 2000);
        },
      );

      console.log('Exit Code:', result.code);
      console.log('STDOUT:', JSON.stringify(result.stdout));
      console.log('STDERR:', JSON.stringify(result.stderr));

      expect(result.stdout).toContain('Guided setup experience or explicit app commands');
    } finally {
      process.chdir(originalCwd);
      await rm(testDir, { recursive: true }).catch(() => {});
    }
  });

  it('should run cgwt app without help and see guided experience', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'cgwt-debug-2-'));
    const originalCwd = process.cwd();

    try {
      process.chdir(testDir);

      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolve) => {
          const child = spawn('node', [join(originalCwd, 'dist/src/cli/cgwt.js'), 'app'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              NODE_ENV: 'test',
              CI: 'true', // Some libraries skip interactive mode in CI
            },
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            console.log('STDOUT chunk:', JSON.stringify(text));
          });

          child.stderr?.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            console.log('STDERR chunk:', JSON.stringify(text));
          });

          child.on('exit', (code) => {
            resolve({ code, stdout, stderr });
          });

          // Send Ctrl+C after a short delay
          setTimeout(() => {
            child.stdin?.write('\x03'); // Ctrl+C
          }, 1000);

          // Force kill after 3 seconds
          setTimeout(() => {
            child.kill();
          }, 3000);
        },
      );

      console.log('Final Exit Code:', result.code);
      console.log('Final STDOUT:', JSON.stringify(result.stdout));
      console.log('Final STDERR:', JSON.stringify(result.stderr));

      // At minimum, should start the guided experience
      expect(result.stdout).toMatch(/Claude GWT|directory detected|Regular Git repository/);
    } finally {
      process.chdir(originalCwd);
      await rm(testDir, { recursive: true }).catch(() => {});
    }
  });
});
