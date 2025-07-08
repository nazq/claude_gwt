import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeGWTApp } from '../../../src/cli/ClaudeGWTApp.js';
import { TestErrorHandler } from '../../../src/core/errors/ErrorHandler.js';
import { GitDetector } from '../../../src/core/git/GitDetector.js';
import { showBanner } from '../../../src/cli/ui/banner.js';

vi.mock('../../../src/core/git/GitDetector.js');
vi.mock('../../../src/cli/ui/banner.js');

describe('ClaudeGWTApp Error Handling', () => {
  let errorHandler: TestErrorHandler;
  let app: ClaudeGWTApp;
  const testPath = '/test/path';

  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler = new TestErrorHandler();
    app = new ClaudeGWTApp(testPath, {}, errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Fatal error handling in run()', () => {
    it('should handle GitDetector constructor failure', async () => {
      vi.mocked(GitDetector).mockImplementation(() => {
        throw new Error('GitDetector initialization failed');
      });

      await expect(app.run()).rejects.toThrow('Fatal error: GitDetector initialization failed');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0]).toEqual({
        error: expect.objectContaining({ message: 'GitDetector initialization failed' }),
        context: 'ClaudeGWTApp',
      });
    });

    it('should handle detectState failure', async () => {
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue(new Error('Failed to detect state')),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: Failed to detect state');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].context).toBe('ClaudeGWTApp');
    });

    it('should handle non-Error rejection from detectState', async () => {
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue('String rejection'),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: String rejection');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0]).toEqual({
        error: 'String rejection',
        context: 'ClaudeGWTApp',
      });
    });

    it('should handle null rejection', async () => {
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue(null),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: Unknown error');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toBe(null);
    });

    it('should handle undefined rejection', async () => {
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue(undefined),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: Unknown error');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toBe(undefined);
    });

    it('should handle object rejection', async () => {
      const errorObject = { code: 'ENOENT', syscall: 'stat' };
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue(errorObject),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: [object Object]');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0].error).toBe(errorObject);
    });
  });

  describe('Error context preservation', () => {
    it('should preserve error context through the handler', async () => {
      const originalError = new Error('Original error with stack trace');
      const mockDetector = {
        detectState: vi.fn().mockRejectedValue(originalError),
      };
      vi.mocked(GitDetector).mockImplementation(() => mockDetector as any);

      await expect(app.run()).rejects.toThrow('Fatal error: Original error with stack trace');

      // The original error object is preserved
      expect(errorHandler.errors[0].error).toBe(originalError);
      expect(errorHandler.errors[0].error).toHaveProperty('stack');
    });
  });
});
