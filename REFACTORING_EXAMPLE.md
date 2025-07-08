# Error Handling Refactoring Example

## Case Study: Refactoring ClaudeGWTApp Error Handling

This document demonstrates a concrete example of refactoring the error handling in `ClaudeGWTApp.ts` to make it more testable.

### Current Implementation Problems

```typescript
// Current implementation in ClaudeGWTApp.ts
async run(): Promise<void> {
  try {
    if (!this.options.quiet) {
      showBanner();
    }
    
    const detector = new GitDetector(this.basePath);
    const state = await detector.detectState();
    
    await this.handleDirectoryState(state);
  } catch (error) {
    Logger.error('Fatal error in ClaudeGWTApp', error);
    console.error(
      theme.error('\n✖ Error:'),
      error instanceof Error ? error.message : 'Unknown error',
    );
    console.error(theme.muted(`\nCheck logs at: .claude-gwt.log`));
    process.exit(1);  // UNTESTABLE!
  }
}
```

**Problems:**
1. `process.exit(1)` makes it impossible to test error scenarios
2. Error formatting logic is inline and untestable
3. No way to verify console output in tests
4. Error type checking is repeated throughout the codebase

### Refactored Implementation

```typescript
// Step 1: Create an error handler interface
export interface ErrorHandler {
  formatError(error: unknown): string;
  displayError(message: string): void;
  exitProcess(code: number): never;
}

// Step 2: Create a default implementation
export class DefaultErrorHandler implements ErrorHandler {
  formatError(error: unknown): string {
    if (error instanceof GitOperationError) {
      return `Git operation '${error.operation}' failed: ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unexpected error occurred';
  }

  displayError(message: string): void {
    console.error(theme.error('\n✖ Error:'), message);
    console.error(theme.muted(`\nCheck logs at: .claude-gwt.log`));
  }

  exitProcess(code: number): never {
    process.exit(code);
  }
}

// Step 3: Create a test implementation
export class TestErrorHandler implements ErrorHandler {
  public errors: string[] = [];
  public exitCode: number | null = null;

  formatError(error: unknown): string {
    return new DefaultErrorHandler().formatError(error);
  }

  displayError(message: string): void {
    this.errors.push(message);
  }

  exitProcess(code: number): never {
    this.exitCode = code;
    throw new Error(`Process would exit with code ${code}`);
  }
}

// Step 4: Refactor ClaudeGWTApp to use the error handler
export class ClaudeGWTApp {
  private errorHandler: ErrorHandler;

  constructor(
    private basePath: string,
    private options: CLIOptions,
    errorHandler?: ErrorHandler
  ) {
    this.basePath = path.resolve(basePath);
    this.options = options;
    this.errorHandler = errorHandler ?? new DefaultErrorHandler();
  }

  async run(): Promise<void> {
    Logger.info('Starting ClaudeGWTApp', { basePath: this.basePath, options: this.options });

    try {
      if (!this.options.quiet) {
        showBanner();
      }

      const detector = new GitDetector(this.basePath);
      const state = await detector.detectState();

      await this.handleDirectoryState(state);
    } catch (error) {
      this.handleFatalError(error);
    }
  }

  private handleFatalError(error: unknown): never {
    Logger.error('Fatal error in ClaudeGWTApp', error);
    
    const errorMessage = this.errorHandler.formatError(error);
    this.errorHandler.displayError(errorMessage);
    
    return this.errorHandler.exitProcess(1);
  }
}
```

### Testing the Refactored Code

Now we can write comprehensive tests for error scenarios:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeGWTApp } from './ClaudeGWTApp';
import { TestErrorHandler } from './TestErrorHandler';
import { GitOperationError } from '../core/errors/CustomErrors';
import { GitDetector } from '../core/git/GitDetector';

vi.mock('../core/git/GitDetector');

describe('ClaudeGWTApp Error Handling', () => {
  let errorHandler: TestErrorHandler;
  let app: ClaudeGWTApp;

  beforeEach(() => {
    errorHandler = new TestErrorHandler();
    app = new ClaudeGWTApp('/test/path', { quiet: true }, errorHandler);
  });

  describe('run() error handling', () => {
    it('should handle GitOperationError with proper formatting', async () => {
      const gitError = new GitOperationError('Repository not found', 'detectState');
      vi.mocked(GitDetector).mockImplementation(() => ({
        detectState: vi.fn().mockRejectedValue(gitError)
      }) as any);

      await expect(app.run()).rejects.toThrow('Process would exit with code 1');

      expect(errorHandler.errors).toHaveLength(1);
      expect(errorHandler.errors[0]).toBe(
        "Git operation 'detectState' failed: Repository not found"
      );
      expect(errorHandler.exitCode).toBe(1);
    });

    it('should handle generic Error', async () => {
      const error = new Error('Network timeout');
      vi.mocked(GitDetector).mockImplementation(() => ({
        detectState: vi.fn().mockRejectedValue(error)
      }) as any);

      await expect(app.run()).rejects.toThrow('Process would exit with code 1');

      expect(errorHandler.errors[0]).toBe('Network timeout');
      expect(errorHandler.exitCode).toBe(1);
    });

    it('should handle non-Error rejections', async () => {
      vi.mocked(GitDetector).mockImplementation(() => ({
        detectState: vi.fn().mockRejectedValue('String error')
      }) as any);

      await expect(app.run()).rejects.toThrow('Process would exit with code 1');

      expect(errorHandler.errors[0]).toBe('String error');
    });

    it('should handle unknown error types', async () => {
      vi.mocked(GitDetector).mockImplementation(() => ({
        detectState: vi.fn().mockRejectedValue({ weird: 'object' })
      }) as any);

      await expect(app.run()).rejects.toThrow('Process would exit with code 1');

      expect(errorHandler.errors[0]).toBe('An unexpected error occurred');
    });

    it('should log errors before displaying them', async () => {
      const logSpy = vi.spyOn(Logger, 'error');
      const error = new Error('Test error');
      
      vi.mocked(GitDetector).mockImplementation(() => ({
        detectState: vi.fn().mockRejectedValue(error)
      }) as any);

      await expect(app.run()).rejects.toThrow();

      expect(logSpy).toHaveBeenCalledWith('Fatal error in ClaudeGWTApp', error);
    });
  });

  describe('error formatting', () => {
    it('should format different error types correctly', () => {
      const handler = new DefaultErrorHandler();

      expect(handler.formatError(new Error('Simple error'))).toBe('Simple error');
      expect(handler.formatError('String error')).toBe('String error');
      expect(handler.formatError(null)).toBe('An unexpected error occurred');
      expect(handler.formatError(undefined)).toBe('An unexpected error occurred');
      expect(handler.formatError(123)).toBe('An unexpected error occurred');
    });
  });
});
```

### Benefits of This Refactoring

1. **100% Testable**: We can now test all error paths including process exit
2. **Reusable**: The ErrorHandler can be used throughout the application
3. **Mockable**: Easy to mock for testing
4. **Separation of Concerns**: Error formatting, display, and exit are separate
5. **Extensible**: Can easily add new error types or change formatting

### Next Steps

Apply similar patterns to other problematic areas:

1. **cgwt-program.ts**: Extract error handling from command handlers
2. **GitRepository.ts**: Separate cleanup logic from error handling
3. **TmuxManager.ts**: Implement error recovery strategies

### Integration Test Example

```typescript
describe('ClaudeGWTApp Integration Tests', () => {
  it('should show user-friendly error when git is not installed', async () => {
    // Mock git not being available
    vi.mocked(GitDetector).mockImplementation(() => ({
      detectState: vi.fn().mockRejectedValue(
        new Error('git: command not found')
      )
    }) as any);

    const errorHandler = new TestErrorHandler();
    const app = new ClaudeGWTApp('/test/path', {}, errorHandler);

    await expect(app.run()).rejects.toThrow();

    expect(errorHandler.errors[0]).toContain('git: command not found');
    expect(errorHandler.exitCode).toBe(1);
  });
});
```

This refactoring pattern can be applied incrementally throughout the codebase, improving testability one component at a time.