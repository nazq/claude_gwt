/**
 * Interactive CLI Testing Utility
 * Provides utilities for testing interactive CLI applications with Inquirer prompts
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface CLITestOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  debug?: boolean;
}

export interface CLIInteraction {
  expect?: string | RegExp;
  send?: string;
  delay?: number;
}

export interface CLITestResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
}

export class InteractiveCLITester extends EventEmitter {
  private process: ChildProcess | null = null;
  private stdout = '';
  private stderr = '';
  private startTime = 0;
  private options: CLITestOptions;

  constructor(options: CLITestOptions = {}) {
    super();
    this.options = {
      timeout: 30000,
      debug: false,
      ...options,
    };
  }

  /**
   * Start a CLI process
   */
  async start(command: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.startTime = Date.now();
      this.stdout = '';
      this.stderr = '';

      this.process = spawn(command, args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => {
        const text = data.toString();
        this.stdout += text;
        if (this.options.debug) {
          console.log('STDOUT:', text);
        }
        this.emit('stdout', text);
      });

      this.process.stderr?.on('data', (data) => {
        const text = data.toString();
        this.stderr += text;
        if (this.options.debug) {
          console.log('STDERR:', text);
        }
        this.emit('stderr', text);
      });

      this.process.on('spawn', () => {
        resolve();
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      // Timeout protection
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.kill();
          reject(new Error(`Process timed out after ${this.options.timeout}ms`));
        }
      }, this.options.timeout!);
    });
  }

  /**
   * Send input to the CLI process
   */
  send(input: string): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Process not started or stdin not available');
    }

    if (this.options.debug) {
      console.log('SENDING:', JSON.stringify(input));
    }

    this.process.stdin.write(input);
  }

  /**
   * Send a line (with newline) to the CLI process
   */
  sendLine(input: string = ''): void {
    this.send(input + '\n');
  }

  /**
   * Wait for specific output to appear
   */
  async waitFor(pattern: string | RegExp, timeoutMs = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }, timeoutMs);

      const checkOutput = () => {
        const match =
          typeof pattern === 'string' ? this.stdout.includes(pattern) : pattern.test(this.stdout);

        if (match) {
          clearTimeout(timeout);
          resolve(this.stdout);
        }
      };

      // Check immediately in case pattern is already present
      checkOutput();

      // Listen for new output
      this.on('stdout', checkOutput);

      // Clean up listener when done
      timeout.ref = () => {
        this.off('stdout', checkOutput);
        return timeout;
      };
    });
  }

  /**
   * Execute a series of interactions
   */
  async interact(interactions: CLIInteraction[]): Promise<void> {
    for (const interaction of interactions) {
      // Wait for expected output if specified
      if (interaction.expect) {
        await this.waitFor(interaction.expect);
      }

      // Add delay if specified
      if (interaction.delay) {
        await this.delay(interaction.delay);
      }

      // Send input if specified
      if (interaction.send !== undefined) {
        this.sendLine(interaction.send);
      }
    }
  }

  /**
   * Wait for process to exit and return results
   */
  async waitForExit(): Promise<CLITestResult> {
    return new Promise((resolve) => {
      if (!this.process) {
        throw new Error('Process not started');
      }

      this.process.on('exit', (code) => {
        const duration = Date.now() - this.startTime;
        resolve({
          exitCode: code,
          stdout: this.stdout,
          stderr: this.stderr,
          duration,
        });
      });
    });
  }

  /**
   * Kill the process
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.process && !this.process.killed) {
      this.process.kill(signal);
    }
  }

  /**
   * Get current output
   */
  getOutput(): { stdout: string; stderr: string } {
    return {
      stdout: this.stdout,
      stderr: this.stderr,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function for simple CLI tests
 */
export async function testCLI(
  command: string,
  args: string[],
  interactions: CLIInteraction[],
  options: CLITestOptions = {},
): Promise<CLITestResult> {
  const tester = new InteractiveCLITester(options);

  try {
    await tester.start(command, args);
    await tester.interact(interactions);
    return await tester.waitForExit();
  } finally {
    tester.kill();
  }
}

/**
 * Test helper for cgwt app commands
 * Finds the project root by looking for package.json
 */
export async function testCgwtApp(
  interactions: CLIInteraction[],
  options: CLITestOptions = {},
): Promise<CLITestResult> {
  const { join, dirname } = await import('path');
  const { existsSync } = await import('fs');
  const { fileURLToPath } = await import('url');

  // Find project root by looking for package.json
  let projectRoot = process.cwd();
  while (!existsSync(join(projectRoot, 'package.json')) && projectRoot !== '/') {
    projectRoot = dirname(projectRoot);
  }

  // If we can't find package.json, try to use the file location approach
  if (!existsSync(join(projectRoot, 'package.json'))) {
    // This file is in tests/utils/, so project root is ../../
    const currentFileUrl = import.meta.url;
    const currentFilePath = fileURLToPath(currentFileUrl);
    projectRoot = join(dirname(currentFilePath), '..', '..');
  }

  const cgwtPath = 'node';
  const args = [join(projectRoot, 'dist/src/cli/cgwt.js'), 'app'];

  return testCLI(cgwtPath, args, interactions, {
    ...options,
    env: {
      NODE_ENV: 'test',
      ...options.env,
    },
  });
}
