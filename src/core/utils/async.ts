import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Options for executing commands
 */
export interface ExecOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Current working directory */
  cwd?: string;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Maximum buffer size for stdout/stderr */
  maxBuffer?: number;
  /** Encoding for the output */
  encoding?: BufferEncoding;
}

/**
 * Result from command execution
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Executes a command asynchronously with timeout support
 * @param command The command to execute
 * @param options Execution options
 * @returns The execution result
 */
export async function execCommand(command: string, options: ExecOptions = {}): Promise<ExecResult> {
  const {
    timeout = 30000,
    cwd = process.cwd(),
    env = process.env,
    maxBuffer = 10 * 1024 * 1024, // 10MB
    encoding = 'utf8',
  } = options;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env,
      timeout,
      maxBuffer,
      encoding,
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      code: 0,
    };
  } catch (error) {
    // If the command failed, we still want to return the output
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: execError.stdout?.trim() ?? '',
      stderr: execError.stderr?.trim() ?? execError.message,
      code: execError.code ?? 1,
    };
  }
}

/**
 * Executes a command with arguments using spawn for better security
 * @param command The command to execute
 * @param args The arguments to pass to the command
 * @param options Execution options
 * @returns The execution result
 */
export function execCommandSafe(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const { timeout = 30000, cwd = process.cwd(), env = process.env, encoding = 'utf8' } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false, // Disable shell to prevent injection
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set up timeout
    const timeoutId = timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }, timeout)
      : null;

    // Collect stdout
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString(encoding);
    });

    // Collect stderr
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString(encoding);
    });

    // Handle process exit
    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms`));
      } else {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: code ?? 0,
        });
      }
    });

    // Handle errors
    child.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Executes a function with a timeout
 * @param fn The async function to execute
 * @param timeoutMs The timeout in milliseconds
 * @param timeoutError Optional custom timeout error message
 * @returns The result of the function
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(timeoutError ?? `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([fn(), timeoutPromise]);
}

/**
 * Executes multiple promises in parallel with individual timeouts
 * @param tasks Array of tasks with optional timeouts
 * @returns Array of results
 */
export function parallelWithTimeout<T>(
  tasks: Array<{
    fn: () => Promise<T>;
    timeout?: number;
    timeoutError?: string;
  }>,
): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: Error }>> {
  const promises = tasks.map(({ fn, timeout, timeoutError }) => {
    const promise = timeout ? withTimeout(fn, timeout, timeoutError) : fn();
    return promise
      .then((value) => ({ status: 'fulfilled' as const, value }))
      .catch((reason: Error) => ({ status: 'rejected' as const, reason }));
  });

  return Promise.all(promises);
}

/**
 * Retries an async operation with exponential backoff
 * @param fn The async function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds
 * @returns The result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<T> {
  let lastError: Error;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError!;
}

/**
 * Creates a debounced version of an async function
 * @param fn The async function to debounce
 * @param delayMs The delay in milliseconds
 * @returns The debounced function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number,
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<unknown> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    pendingPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        void (async (): Promise<void> => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error as Error);
          } finally {
            timeoutId = null;
            pendingPromise = null;
          }
        })();
      }, delayMs);
    });

    return pendingPromise;
  }) as T;

  const cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingPromise = null;
  };

  return Object.assign(debounced, { cancel }) as T & { cancel: () => void };
}
