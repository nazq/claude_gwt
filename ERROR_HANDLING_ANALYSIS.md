# Error Handling Analysis - Claude GWT Codebase

## Executive Summary

This analysis identifies error handling patterns in the Claude GWT codebase that make testing difficult and presents opportunities for refactoring to improve testability, maintainability, and reliability.

## Key Issues Identified

### 1. Deeply Nested Try-Catch Blocks

**Problem**: Multiple levels of error handling make it difficult to test specific error scenarios and understand error flow.

**Example**: `ClaudeGWTApp.ts`
```typescript
async run(): Promise<void> {
  try {
    // High-level error handling
    const state = await detector.detectState();
    await this.handleDirectoryState(state);
  } catch (error) {
    // Generic error handling that swallows details
    console.error(theme.error('\n✖ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

private async handleEmptyDirectory(): Promise<void> {
  try {
    // Another layer of try-catch
    const worktreePath = await worktreeManager.addWorktree(defaultBranch);
  } catch (error) {
    // Re-throws without context
    worktreeSpinner.fail('Failed to create branch');
    throw error;
  }
}
```

**Impact**: 
- Hard to test intermediate error states
- Difficult to verify error messages shown to users
- Error context is lost as it bubbles up

### 2. Complex Error Propagation

**Problem**: Errors are caught, partially handled, and re-thrown multiple times, making it hard to track error flow.

**Example**: `GitRepository.ts` - `convertToWorktreeSetup()`
```typescript
async convertToWorktreeSetup(): Promise<{ defaultBranch: string; originalPath: string }> {
  let tempDir: string | undefined;
  let backupDir: string | undefined;
  
  try {
    // Complex conversion logic
  } catch (error) {
    // Cleanup on error
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Restore backup if it exists
    if (backupDir) {
      try {
        // Restoration logic
      } catch {
        // Ignore restore errors
      }
    }
    
    throw new GitOperationError(
      `Failed to convert repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'convert',
    );
  }
}
```

**Impact**:
- Cleanup logic is hard to test independently
- Silent failures in cleanup/restore can leave system in bad state
- Multiple error paths increase complexity

### 3. Mixed Error Handling Strategies

**Problem**: Inconsistent error handling between async/await and callbacks, making error flow unpredictable.

**Example**: `cgwt-program.ts`
```typescript
// Sometimes errors are handled with try-catch
try {
  const result = await execCommandSafe('git', ['worktree', 'list']);
  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to list worktrees');
  }
} catch (error) {
  handleGitError(error);
}

// Sometimes errors are handled with callbacks
const tmux = spawn('tmux', ['attach-session', '-t', targetSession], {
  stdio: 'inherit',
});

tmux.on('exit', (code) => {
  process.exit(code ?? 0);
});
```

### 4. Process.exit() in Error Handlers

**Problem**: Direct process termination makes it impossible to test error recovery paths.

**Example**: Multiple locations in `ClaudeGWTApp.ts` and `cgwt-program.ts`
```typescript
catch (error) {
  console.error(theme.error('\n✖ Error:'), error.message);
  process.exit(1);  // Hard to test
}
```

### 5. Untestable Error Recovery Logic

**Problem**: Error recovery is tightly coupled with business logic, making it difficult to test error scenarios in isolation.

**Example**: `TmuxManager.ts`
```typescript
static async createDetachedSession(config: SessionConfig): Promise<void> {
  try {
    // Session creation logic
  } catch (error) {
    Logger.error('Failed to create detached session', error);
    throw error;  // No recovery attempted
  }
}
```

## Code Smells Identified

### 1. Generic Error Messages
- "Unknown error" appears 15+ times in the codebase
- Loss of debugging context
- Poor user experience

### 2. Silent Error Swallowing
- Empty catch blocks that ignore errors
- Cleanup failures that don't bubble up
- Makes debugging production issues difficult

### 3. Inconsistent Error Types
- Sometimes throws Error, sometimes GitOperationError
- String errors vs Error objects
- Makes error handling unpredictable

### 4. Missing Error Context
- Errors re-thrown without additional context
- Stack traces lost during error propagation
- Hard to trace error origin

## Refactoring Recommendations

### 1. Extract Error Handlers

**Before**:
```typescript
async run(): Promise<void> {
  try {
    // Complex logic
  } catch (error) {
    console.error(theme.error('\n✖ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
```

**After**:
```typescript
async run(): Promise<void> {
  try {
    // Complex logic
  } catch (error) {
    this.handleFatalError(error);
  }
}

private handleFatalError(error: unknown): never {
  const errorMessage = this.formatError(error);
  this.displayError(errorMessage);
  this.exitGracefully(1);
}

// Now these methods are independently testable
private formatError(error: unknown): string {
  if (error instanceof GitOperationError) {
    return `Git operation failed: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
```

### 2. Implement Result Pattern

**Before**:
```typescript
async addWorktree(branch: string): Promise<string> {
  try {
    // Complex operation
    return worktreePath;
  } catch (error) {
    throw new GitOperationError(`Failed to add worktree: ${error.message}`);
  }
}
```

**After**:
```typescript
type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

async addWorktree(branch: string): Promise<Result<string, GitOperationError>> {
  try {
    // Complex operation
    return { success: true, value: worktreePath };
  } catch (error) {
    return {
      success: false,
      error: new GitOperationError(`Failed to add worktree: ${error.message}`)
    };
  }
}

// Usage becomes more explicit
const result = await worktreeManager.addWorktree(branch);
if (!result.success) {
  // Handle error case
  return this.handleWorktreeError(result.error);
}
// Use result.value
```

### 3. Separate Cleanup Logic

**Before**:
```typescript
async convertToWorktreeSetup() {
  let tempDir;
  try {
    // Complex logic
  } catch (error) {
    // Inline cleanup
    if (tempDir) {
      try {
        await fs.rm(tempDir);
      } catch { }
    }
    throw error;
  }
}
```

**After**:
```typescript
async convertToWorktreeSetup() {
  const cleanup = new CleanupManager();
  
  try {
    const tempDir = await this.createTempDir();
    cleanup.register(() => fs.rm(tempDir, { recursive: true }));
    
    // Complex logic
    
    cleanup.success(); // Marks cleanup as not needed
    return result;
  } catch (error) {
    await cleanup.execute(); // Runs all registered cleanups
    throw new GitOperationError(error, { cleanupFailed: cleanup.hasFailures() });
  }
}

// CleanupManager is independently testable
class CleanupManager {
  private cleanups: Array<() => Promise<void>> = [];
  private failures: Error[] = [];
  
  register(cleanup: () => Promise<void>): void {
    this.cleanups.push(cleanup);
  }
  
  async execute(): Promise<void> {
    for (const cleanup of this.cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        this.failures.push(error as Error);
      }
    }
  }
}
```

### 4. Error Boundary Pattern

**Before**:
```typescript
async launchTmuxSession(path: string, branch: string): Promise<void> {
  try {
    // Multiple operations that can fail
    await TmuxManager.launchSession(config);
  } catch (error) {
    Logger.error('Failed to launch tmux session', error);
    console.error(theme.error('\n❌ Failed to launch session'));
    throw error;
  }
}
```

**After**:
```typescript
async launchTmuxSession(path: string, branch: string): Promise<void> {
  return this.withErrorBoundary(
    async () => {
      await TmuxManager.launchSession(config);
    },
    {
      errorType: 'tmux-launch',
      context: { path, branch },
      onError: (error, context) => {
        Logger.error('Failed to launch tmux session', { error, ...context });
        this.ui.showError('Failed to launch session', error);
      }
    }
  );
}

// Reusable error boundary
private async withErrorBoundary<T>(
  operation: () => Promise<T>,
  options: ErrorBoundaryOptions
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const enhancedError = this.enhanceError(error, options);
    options.onError?.(enhancedError, options.context);
    throw enhancedError;
  }
}
```

### 5. Testable Exit Strategy

**Before**:
```typescript
catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
```

**After**:
```typescript
// Inject exit handler
class ClaudeGWTApp {
  constructor(
    private basePath: string,
    private options: CLIOptions,
    private exitHandler: (code: number) => never = process.exit
  ) {}
  
  private handleFatalError(error: unknown): never {
    this.displayError(error);
    this.exitHandler(1);
  }
}

// In tests
const mockExit = vi.fn().mockImplementation(() => {
  throw new Error('Process would exit');
});

const app = new ClaudeGWTApp(path, options, mockExit);
// Can now test that exit was called with correct code
```

## Testing Improvements

### 1. Error Path Coverage
```typescript
describe('WorktreeManager error handling', () => {
  it('should handle git command failures gracefully', async () => {
    mockGit.raw.mockRejectedValue(new Error('Git command failed'));
    
    const result = await manager.addWorktree('feature');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(GitOperationError);
    expect(result.error.operation).toBe('addWorktree');
  });
  
  it('should handle non-Error rejections', async () => {
    mockGit.raw.mockRejectedValue('String error');
    
    const result = await manager.addWorktree('feature');
    
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Unknown error');
  });
  
  it('should cleanup on failure', async () => {
    const cleanupSpy = vi.fn();
    manager.onCleanup(cleanupSpy);
    
    mockGit.worktree.mockRejectedValue(new Error('Worktree failed'));
    
    await manager.addWorktree('feature');
    
    expect(cleanupSpy).toHaveBeenCalled();
  });
});
```

### 2. Isolated Error Handler Tests
```typescript
describe('Error formatting', () => {
  it('should format GitOperationError with context', () => {
    const error = new GitOperationError('Failed', 'fetch');
    const formatted = errorFormatter.format(error);
    
    expect(formatted).toContain('Git operation failed: fetch');
    expect(formatted).toContain('Failed');
  });
  
  it('should handle unknown error types', () => {
    const formatted = errorFormatter.format({ weird: 'object' });
    
    expect(formatted).toBe('An unexpected error occurred');
  });
});
```

## Implementation Priority

1. **High Priority** - Process.exit() refactoring
   - Blocks all error path testing
   - Simple to implement with dependency injection

2. **High Priority** - Extract error handlers
   - Improves testability immediately
   - Low risk refactoring

3. **Medium Priority** - Implement Result pattern
   - Better error handling ergonomics
   - Requires more code changes

4. **Medium Priority** - Cleanup manager
   - Prevents resource leaks
   - Makes cleanup testable

5. **Low Priority** - Error boundary pattern
   - Nice to have for consistency
   - Can be implemented gradually

## Metrics to Track

- Error path test coverage (target: 90%+)
- Number of untestable catch blocks (target: 0)
- Mean time to identify error source in production
- User-reported "Unknown error" occurrences

## Conclusion

The current error handling makes it difficult to achieve high test coverage and maintain code quality. By implementing these refactoring patterns, we can:

1. Achieve 90%+ test coverage on error paths
2. Make error handling predictable and consistent
3. Improve debugging and error messages for users
4. Reduce the risk of silent failures

The refactoring can be done incrementally, starting with the highest impact areas (process.exit and error handler extraction) and gradually improving the entire codebase.