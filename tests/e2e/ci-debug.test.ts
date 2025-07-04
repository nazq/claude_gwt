import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { simpleGit } from 'simple-git';

// This test file is specifically for debugging CI issues
// Skip in CI since these tests are for local debugging of CI problems
const isCI = process.env['CI'] === 'true';
const describeCI = !isCI ? describe : describe.skip;

describeCI('CI Environment Debug Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-gwt-ci-debug-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  it('should log environment information', () => {
    console.log('=== CI Debug Information ===');
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('CI:', process.env['CI']);
    console.log('GitHub Actions:', process.env['GITHUB_ACTIONS']);
    console.log('Runner OS:', process.env['RUNNER_OS']);
    console.log('Runner Temp:', process.env['RUNNER_TEMP']);
    console.log('Home:', process.env['HOME']);
    console.log('User:', process.env['USER']);
    console.log('===========================');
  });

  it('should test basic git operations', async () => {
    const git = simpleGit(testDir);

    try {
      // Test 1: Git version
      const version = await git.raw(['--version']);
      console.log('Git version:', version.trim());

      // Test 2: Git config
      const userName = await git.raw(['config', '--global', 'user.name']).catch(() => 'Not set');
      const userEmail = await git.raw(['config', '--global', 'user.email']).catch(() => 'Not set');
      console.log('Git user.name:', userName.trim());
      console.log('Git user.email:', userEmail.trim());

      // Test 3: Initialize repository
      console.log('Initializing git repository...');
      await git.init();
      console.log('✓ Git init successful');

      // Test 4: Create a file and commit
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      await git.add('.');
      await git.commit('Initial commit');
      console.log('✓ Initial commit successful');

      // Test 5: Create bare repository
      const bareDir = path.join(testDir, '.bare');
      await fs.mkdir(bareDir);
      const bareGit = simpleGit(bareDir);
      await bareGit.clone(testDir, '.', ['--bare']);
      console.log('✓ Bare clone successful');
    } catch (error) {
      console.error('Git operation failed:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('Error message:', error.message);
      }
      throw error;
    }
  });

  it('should test file permissions', async () => {
    try {
      // Test file creation
      const testFile = path.join(testDir, 'test-perms.txt');
      await fs.writeFile(testFile, 'test');
      const stats = await fs.stat(testFile);
      console.log('File permissions:', stats.mode.toString(8));
      console.log('File owner UID:', stats.uid);
      console.log('File owner GID:', stats.gid);

      // Test directory permissions
      const dirStats = await fs.stat(testDir);
      console.log('Directory permissions:', dirStats.mode.toString(8));

      // Test executable permissions
      await fs.chmod(testFile, 0o755);
      const newStats = await fs.stat(testFile);
      console.log('Updated permissions:', newStats.mode.toString(8));
    } catch (error) {
      console.error('Permission test failed:', error);
      throw error;
    }
  });

  it('should test CLI spawning', async () => {
    const cliPath = path.join(__dirname, '../../dist/src/cli/index.js');

    try {
      // Check if CLI exists
      await fs.access(cliPath);
      console.log('✓ CLI file exists');

      // Check file stats
      const stats = await fs.stat(cliPath);
      console.log('CLI permissions:', stats.mode.toString(8));

      // Try to spawn with different methods
      console.log('Testing spawn methods...');

      // Method 1: Direct node execution
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [cliPath, '--version'], {
          cwd: testDir,
          env: { ...process.env },
          stdio: 'pipe',
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data;
        });
        child.stderr.on('data', (data) => {
          stderr += data;
        });

        child.on('close', (code) => {
          console.log('Direct spawn exit code:', code);
          console.log('Direct spawn stdout:', stdout);
          console.log('Direct spawn stderr:', stderr);

          if (code === 0) {
            console.log('✓ Direct spawn successful');
            resolve();
          } else {
            reject(new Error(`Direct spawn failed with code ${code}`));
          }
        });

        child.on('error', (error) => {
          console.error('Direct spawn error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('CLI spawn test failed:', error);
      throw error;
    }
  });

  it('should test timeout behavior', async () => {
    // Test if timeouts are causing issues
    const delays = [100, 500, 1000, 2000];

    for (const delay of delays) {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, delay));
      const elapsed = Date.now() - start;
      console.log(`Delay ${delay}ms took ${elapsed}ms (diff: ${elapsed - delay}ms)`);
    }
  });
});
