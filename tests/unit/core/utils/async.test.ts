import { vi } from 'vitest';
import {
  execCommand,
  execCommandSafe,
  withTimeout,
  parallelWithTimeout,
  retryWithBackoff,
  debounceAsync,
} from '../../../../src/core/utils/async';

describe('Async Utilities', () => {
  describe('execCommand', () => {
    it('should execute simple commands', async () => {
      const result = await execCommand('echo "hello world"');
      expect(result.stdout).toBe('hello world');
      expect(result.stderr).toBe('');
      expect(result.code).toBe(0);
    });

    it('should handle command failures', async () => {
      const result = await execCommand('exit 1');
      expect(result.code).toBe(1);
    });

    it('should respect timeout', async () => {
      const result = await execCommand('sleep 2', { timeout: 100 });
      expect(result.code).not.toBe(0);
    }, 10000);

    it('should pass environment variables', async () => {
      const result = await execCommand('echo $TEST_VAR', {
        env: { ...process.env, TEST_VAR: 'test_value' },
      });
      expect(result.stdout).toBe('test_value');
    });

    it('should handle working directory', async () => {
      const result = await execCommand('pwd', { cwd: '/' });
      expect(result.stdout).toBe('/');
    });
  });

  describe('execCommandSafe', () => {
    it('should execute commands with arguments safely', async () => {
      const result = await execCommandSafe('echo', ['hello', 'world']);
      expect(result.stdout).toBe('hello world');
      expect(result.code).toBe(0);
    });

    it('should prevent shell injection', async () => {
      // This would be dangerous with execCommand but safe with execCommandSafe
      const result = await execCommandSafe('echo', ['$(whoami)']);
      expect(result.stdout).toBe('$(whoami)'); // Literal string, not executed
    });

    it('should handle command not found', async () => {
      await expect(execCommandSafe('nonexistentcommand123')).rejects.toThrow();
    });

    it('should respect timeout', async () => {
      await expect(execCommandSafe('sleep', ['2'], { timeout: 100 })).rejects.toThrow(
        'Command timed out',
      );
    }, 10000);
  });

  describe('withTimeout', () => {
    it('should complete fast operations', async () => {
      const result = await withTimeout(() => Promise.resolve('success'), 1000);
      expect(result).toBe('success');
    });

    it('should timeout slow operations', async () => {
      const slowFn = () => new Promise((resolve) => setTimeout(resolve, 200));
      await expect(withTimeout(slowFn, 50)).rejects.toThrow('Operation timed out');
    });

    it('should use custom timeout message', async () => {
      const slowFn = () => new Promise((resolve) => setTimeout(resolve, 200));
      await expect(withTimeout(slowFn, 50, 'Custom timeout error')).rejects.toThrow(
        'Custom timeout error',
      );
    });
  });

  describe('parallelWithTimeout', () => {
    it('should execute tasks in parallel', async () => {
      const start = Date.now();
      const tasks = [
        { fn: () => new Promise((resolve) => setTimeout(() => resolve(1), 100)) },
        { fn: () => new Promise((resolve) => setTimeout(() => resolve(2), 100)) },
        { fn: () => new Promise((resolve) => setTimeout(() => resolve(3), 100)) },
      ];

      const results = await parallelWithTimeout(tasks);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // Should run in parallel
      expect(results).toEqual([
        { status: 'fulfilled', value: 1 },
        { status: 'fulfilled', value: 2 },
        { status: 'fulfilled', value: 3 },
      ]);
    });

    it('should handle individual timeouts', async () => {
      const tasks = [
        { fn: () => Promise.resolve(1), timeout: 1000 },
        { fn: () => new Promise((resolve) => setTimeout(resolve, 200)), timeout: 50 },
        { fn: () => Promise.resolve(3), timeout: 1000 },
      ];

      const results = await parallelWithTimeout(tasks);

      expect(results[0]?.status).toBe('fulfilled');
      expect(results[0]?.value).toBe(1);
      expect(results[1]?.status).toBe('rejected');
      expect(results[2]?.status).toBe('fulfilled');
      expect(results[2]?.value).toBe(3);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        return Promise.resolve('success');
      });

      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      });

      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const fn = vi.fn(() => Promise.reject(new Error('always fails')));

      await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      let attempts = 0;
      const timestamps: number[] = [];

      const fn = vi.fn(() => {
        timestamps.push(Date.now());
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      });

      await retryWithBackoff(fn, 3, 100);

      // Check delays are increasing
      const delay1 = timestamps[1]! - timestamps[0]!;
      const delay2 = timestamps[2]! - timestamps[1]!;

      expect(delay1).toBeGreaterThanOrEqual(90); // ~100ms
      expect(delay2).toBeGreaterThanOrEqual(180); // ~200ms (doubled)
    });
  });

  describe('debounceAsync', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce multiple calls', async () => {
      const fn = vi.fn(() => Promise.resolve('result'));
      const debounced = debounceAsync(fn, 100);

      // Call multiple times quickly
      debounced();
      debounced();
      const promise3 = debounced();

      // Fast forward time
      vi.advanceTimersByTime(100);

      // Wait for the promise to resolve
      const result = await promise3;
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle different arguments', async () => {
      const fn = vi.fn((x: number) => Promise.resolve(x * 2));
      const debounced = debounceAsync(fn, 100);

      debounced(1);
      debounced(2);
      const promise = debounced(3);

      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe(6); // 3 * 2
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
    });

    it('should cancel pending calls', async () => {
      const fn = vi.fn(() => Promise.resolve('result'));
      const debounced = debounceAsync(fn, 100);

      debounced();
      debounced.cancel();

      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const fn = vi.fn(() => Promise.reject(new Error('test error')));
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();

      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('test error');
    });
  });
});
