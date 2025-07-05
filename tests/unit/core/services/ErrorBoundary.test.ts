import { ErrorBoundary } from '../../../../src/core/services/ErrorBoundary';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

describe('ErrorBoundary', () => {
  let errorBoundary: ErrorBoundary;

  beforeEach(() => {
    jest.clearAllMocks();
    errorBoundary = new ErrorBoundary(mockLogger);
  });

  describe('async error handling', () => {
    it('should handle successful async operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await errorBoundary.handle(operation, 'test-context');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle async operation errors', async () => {
      const error = new Error('Async operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorBoundary.handle(operation, 'test-context')).rejects.toThrow(
        'Async operation failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith('[test-context] Async operation failed', error);
    });

    it('should handle non-Error objects in async operations', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(errorBoundary.handle(operation, 'test-context')).rejects.toBe('string error');

      expect(mockLogger.error).toHaveBeenCalledWith('[test-context] string error', 'string error');
    });

    it('should handle async operations without context', async () => {
      const error = new Error('No context error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorBoundary.handle(operation)).rejects.toThrow('No context error');

      expect(mockLogger.error).toHaveBeenCalledWith('[Unknown Context] No context error', error);
    });
  });

  describe('sync error handling', () => {
    it('should handle successful sync operations', () => {
      const operation = jest.fn().mockReturnValue('sync success');

      const result: unknown = errorBoundary.handleSync(operation, 'sync-context');

      expect(result).toBe('sync success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle sync operation errors', () => {
      const error = new Error('Sync operation failed');
      const operation = jest.fn<string, []>().mockImplementation(() => {
        throw error;
      });

      expect(() => errorBoundary.handleSync(operation, 'sync-context')).toThrow(
        'Sync operation failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith('[sync-context] Sync operation failed', error);
    });
  });

  describe('function wrapping', () => {
    it('should wrap async functions with error boundary', async () => {
      const originalFn = jest.fn().mockResolvedValue('wrapped result');
      const wrappedFn = errorBoundary.wrap(originalFn, 'wrap-context');

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('wrapped result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should wrap sync functions with error boundary', () => {
      const originalFn = jest.fn<string, [string, string]>().mockReturnValue('sync wrapped result');
      const wrappedFn = errorBoundary.wrapSync(originalFn, 'sync-wrap-context');

      const result = wrappedFn('arg1', 'arg2');

      expect(result).toBe('sync wrapped result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle errors in wrapped async functions', async () => {
      const error = new Error('Wrapped function error');
      const originalFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = errorBoundary.wrap(originalFn, 'wrap-error-context');

      await expect(wrappedFn()).rejects.toThrow('Wrapped function error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[wrap-error-context] Wrapped function error',
        error,
      );
    });

    it('should handle errors in wrapped sync functions', () => {
      const error = new Error('Wrapped sync function error');
      const originalFn = jest.fn<string, []>().mockImplementation(() => {
        throw error;
      });
      const wrappedFn = errorBoundary.wrapSync(originalFn, 'sync-wrap-error-context');

      expect(() => wrappedFn()).toThrow('Wrapped sync function error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[sync-wrap-error-context] Wrapped sync function error',
        error,
      );
    });
  });

  describe('context-specific error boundaries', () => {
    it('should create context-specific error boundary', async () => {
      const contextBoundary = errorBoundary.forContext('specific-context');

      const operation = jest.fn().mockResolvedValue('context result');
      const result = await contextBoundary.handle(operation);

      expect(result).toBe('context result');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should use context in context-specific error boundary', async () => {
      const contextBoundary = errorBoundary.forContext('specific-context');
      const error = new Error('Context-specific error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(contextBoundary.handle(operation)).rejects.toThrow('Context-specific error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[specific-context] Context-specific error',
        error,
      );
    });

    it('should handle sync operations in context-specific boundary', () => {
      const contextBoundary = errorBoundary.forContext('sync-specific-context');
      const operation = jest.fn<string, []>().mockReturnValue('sync context result');

      const result = contextBoundary.handleSync(operation);

      expect(result).toBe('sync context result');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('error message extraction', () => {
    it('should extract message from Error objects', async () => {
      const error = new Error('Standard error message');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(errorBoundary.handle(operation, 'error-test')).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('[error-test] Standard error message', error);
    });

    it('should extract message from string errors', async () => {
      const operation = jest.fn().mockRejectedValue('String error message');

      await expect(errorBoundary.handle(operation, 'string-test')).rejects.toBe(
        'String error message',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[string-test] String error message',
        'String error message',
      );
    });

    it('should extract message from objects with message property', async () => {
      const errorObj = { message: 'Object error message', code: 'ERR001' };
      const operation = jest.fn().mockRejectedValue(errorObj);

      await expect(errorBoundary.handle(operation, 'object-test')).rejects.toBe(errorObj);

      expect(mockLogger.error).toHaveBeenCalledWith('[object-test] Object error message', errorObj);
    });

    it('should handle unknown error types', async () => {
      const operation = jest.fn().mockRejectedValue(null);

      await expect(errorBoundary.handle(operation, 'unknown-test')).rejects.toBe(null);

      expect(mockLogger.error).toHaveBeenCalledWith('[unknown-test] Unknown error occurred', null);
    });
  });

  describe('edge cases', () => {
    it('should handle operations that return undefined', async () => {
      const operation = jest.fn().mockResolvedValue(undefined);

      const result = await errorBoundary.handle(operation, 'undefined-test');

      expect(result).toBeUndefined();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle operations that return null', () => {
      const operation = jest.fn<null, []>().mockReturnValue(null);

      const result = errorBoundary.handleSync(operation, 'null-test');

      expect(result).toBeNull();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle operations with multiple arguments', async () => {
      const operation = jest
        .fn()
        .mockImplementation((a: number, b: string, c: boolean) => `${a}-${b}-${c}`);

      const wrappedFn = errorBoundary.wrap(operation, 'multi-arg');
      const result = await wrappedFn(42, 'test', true);

      expect(result).toBe('42-test-true');
      expect(operation).toHaveBeenCalledWith(42, 'test', true);
    });
  });
});
