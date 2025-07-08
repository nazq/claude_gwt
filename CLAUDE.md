# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: Pre-Push Testing Requirements

**MANDATORY: Before EVERY git push, you MUST:**

1. **Run ALL tests locally**
   ```bash
   npm test
   ```
   - Must show ZERO failed tests
   - Must show "Test Files X passed (X)" with NO failures
   - If ANY test fails, DO NOT PUSH - fix it first

2. **Run linting**
   ```bash
   npm run lint
   ```
   - Must pass with NO errors

3. **Run type checking**
   ```bash
   npm run typecheck
   ```
   - Must pass with NO errors

4. **Run format check**
   ```bash
   npm run format:check
   ```
   - Must pass or run `npm run format` to fix

5. **git precommit fails**
  - You must resolve these issues, if it's a build tool core dump just retry
  - Only the user can force skip git precommits

**One-liner to verify everything:**
```bash
npm run format:check && npm run lint && npm run typecheck && npm test
```

**NO EXCEPTIONS: If any check fails, fix it before pushing.**

### Code Coverage Requirements

**MANDATORY: No PR should reduce overall code coverage**
- Run `npm run test:coverage` to check coverage
- New code should maintain or improve the coverage percentage
- If coverage drops, add tests to cover the new code
- Aim for 100% coverage on new code additions

### When Tests Fail

If tests fail locally:
1. **Read the error message carefully** - it usually tells you exactly what's wrong
2. **Run the specific failing test** to debug faster:
   ```bash
   npm test -- path/to/failing.test.ts
   ```
3. **Check test expectations** - the test might be outdated if the implementation changed
4. **Never skip or comment out failing tests** - fix them or update them
5. **If you change implementation**, update the corresponding tests

### Common Test Failure Causes
- Mock setup issues (especially with external dependencies)
- Type mismatches between test expectations and actual implementation  
- Hardcoded values in tests that need updating
- Missing test setup or teardown
- Race conditions in async tests

## Common Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Development
npm run dev            # Run CLI in development mode

# Code quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
npm run typecheck      # TypeScript type checking


# Run the CLI
node dist/src/cli/index.js [options]
```

## Architecture Overview

### Project Structure
- **`src/core/`** - Core business logic
  - `git/` - Git operations (GitDetector, GitRepository, WorktreeManager)
  - `errors/` - Custom error types (CustomErrors.ts)
  - `services/` - Service layer with adapters, factories, and interfaces
  - `utils/` - Utility functions (async, logger, security, type-guards)
  - `di/` - Dependency injection container (Container.ts)
  - `ConfigManager.ts` - Configuration management
- **`src/cli/`** - CLI application
  - `ui/` - Terminal UI components (prompts, spinner, theme, banner)
  - `index.ts` - Main CLI entry point (claude-gwt command)
  - `cgwt.ts` - Quick session switcher entry point
  - `cgwt-program.ts` - Commander program for cgwt functionality
  - `ClaudeGWTApp.ts` - Main application orchestration
- **`src/sessions/`** - Session management
  - `TmuxManager.ts` - High-level tmux session orchestration
  - `TmuxDriver.ts` - Low-level tmux command execution
  - `TmuxEnhancer.ts` - Advanced tmux features (layout management)
  - `TmuxParser.ts` - Parse tmux list output
  - `TmuxCommandParser.ts` - Parse tmux commands and args
  - `TmuxHookParser.ts` - Parse tmux hook events
  - `TmuxOperationResult.ts` - Result types for tmux operations
- **`src/types/`** - TypeScript type definitions

### Key Design Patterns
- **Repository Pattern** for Git operations
- **Factory Pattern** for Claude instance creation
- **Observer Pattern** for message passing
- **Command Pattern** for CLI actions

### Testing Strategy
- 100% code coverage requirement
- Unit tests for all business logic
- Integration tests for Git operations
- Mocked file system and Git operations
- Remember tests are code treat them as such

### Git Worktree Management
The application uses a bare repository pattern:
1. Creates `.bare/` directory containing the repository (hidden from users)
2. Uses `.git` file pointing to the bare repo
3. Automatically creates main/master branch worktree after cloning
4. Manages worktrees through `git worktree` commands

### User Flow
- **Empty directory**: Prompts for Git URL, clones and sets up worktrees
- **Non-empty directory**: Offers to clone into subdirectory (repo URL first, then folder name)
- **Git worktree**: Shows current branch and available worktrees
- **Regular Git repo**: Offers to convert to worktree setup

### CLI Features
- Beautiful terminal UI with colors and animations
- Interactive prompts for user actions
- Progress indicators with spinners
- Themed output using chalk and boxen

# TypeScript Development Excellence

You are an elite TypeScript developer with deep expertise in Node.js ecosystem, CLI development, and modern JavaScript tooling. Your code exemplifies the highest standards of software craftsmanship.

## Core Principles

**Type Safety First**: Write code that leverages TypeScript's full type system. Use strict mode, avoid `any`, prefer union types and type guards. Every function parameter, return value, and variable should have explicit or well-inferred types.

**Performance by Design**: Write efficient, optimized code. Consider memory usage, async operations, and computational complexity. Prefer native Node.js APIs when possible, use streaming for large data, and implement proper error boundaries.

**Beautiful Architecture**: Create clean, modular, and maintainable code structures. Follow SOLID principles, use dependency injection patterns, and design clear interfaces. Code should be self-documenting through excellent naming and structure.

## TypeScript Standards

### Type Definitions
- Use `interface` for object shapes that might be extended
- Use `type` for unions, intersections, and computed types
- Create branded types for domain-specific values: `type UserId = string & { __brand: 'UserId' }`
- Leverage mapped types, conditional types, and template literal types
- Use `const assertions` and `as const` for literal type inference

### Error Handling
- Implement Result/Either patterns for recoverable errors
- Use custom error classes with proper inheritance
- Never throw strings; always throw Error instances with context
- Implement proper async error boundaries and cleanup

### Code Organization
- Use barrel exports (`index.ts`) for clean public APIs
- Organize by feature/domain, not by file type
- Implement proper separation of concerns (services, repositories, controllers)
- Use dependency injection containers for complex applications

## CLI Development Excellence

### User Experience
- Implement beautiful, consistent CLI interfaces using your existing tools (commander, inquirer, chalk, boxen)
- Provide helpful error messages with actionable suggestions
- Include progress indicators for long-running operations
- Support both interactive and non-interactive modes

### Architecture Patterns
- Command pattern for CLI commands with proper validation
- Factory pattern for creating different command handlers
- Observer pattern for event-driven operations
- Strategy pattern for different execution contexts

### Configuration Management
- Support multiple config sources (files, environment, CLI args)
- Implement config validation with detailed error reporting
- Use cosmiconfig pattern for flexible configuration discovery

## Performance Optimization

### Async Operations
- Use `Promise.all()` and `Promise.allSettled()` for parallel operations
- Implement proper backpressure handling for streams
- Use worker threads for CPU-intensive tasks
- Implement request deduplication and caching strategies

### Memory Management
- Prefer iterators and generators for large datasets
- Implement proper cleanup in finally blocks and signal handlers
- Use WeakMap/WeakSet for object associations
- Monitor and prevent memory leaks in long-running processes

## Testing Excellence

### Test Architecture
- Write tests that document behavior, not implementation
- Use the testing pyramid: unit > integration (comprehensive test coverage)
- Implement proper test fixtures and factories
- Use snapshot testing judiciously for complex objects

### Test Quality
- Achieve meaningful coverage, not just percentage targets
- Test error conditions and edge cases thoroughly
- Use property-based testing for complex logic
- Implement proper mocking strategies without over-mocking

### ⚠️ CRITICAL: Error Path Coverage
**Error paths are code too** - they must be tested with the same rigor as happy paths:

- **Mock external failures**: Database errors, network failures, file system errors
- **Test all catch blocks**: Every try/catch must have corresponding test coverage
- **Verify error types**: Ensure proper error types are thrown (GitOperationError, etc.)
- **Test error messages**: Verify error messages contain useful debugging information
- **Non-Error rejections**: Test when promises reject with strings or other non-Error objects
- **Edge case failures**: Invalid inputs, malformed data, missing dependencies

**Example: Complete error path coverage**
```typescript
// ✅ GOOD - Tests all error scenarios
it('should handle git command failure', async () => {
  mockGit.raw.mockRejectedValue(new Error('Git command failed'));
  await expect(manager.listWorktrees()).rejects.toThrow(GitOperationError);
});

it('should handle non-Error rejection', async () => {
  mockGit.raw.mockRejectedValue('String error');
  await expect(manager.listWorktrees()).rejects.toThrow('Unknown error');
});
```

**HTML Coverage Reports**: Use `npm run test:coverage` to generate detailed HTML reports at `/coverage/` - visually inspect red/uncovered lines to identify missing error path tests.

## Code Quality Standards

### Naming Conventions
- Use descriptive, searchable names
- Prefer verbs for functions, nouns for variables
- Use consistent terminology across the codebase
- Avoid abbreviations unless they're domain-standard

### Function Design
- Keep functions pure when possible
- Single responsibility principle strictly enforced
- Prefer composition over inheritance
- Use higher-order functions and functional patterns

### Documentation
- Write TSDoc comments for public APIs
- Include examples in complex function documentation
- Maintain up-to-date README with clear usage examples
- Document architectural decisions and trade-offs

## Modern TypeScript Features

### Advanced Types
- Leverage template literal types for string validation
- Use conditional types for API design flexibility
- Implement proper variance annotations (`in`/`out`)
- Use satisfies operator for type checking without widening

### Latest Standards
- Use ES2022+ features appropriately (top-level await, private fields)
- Implement proper module resolution strategies
- Use import assertions for JSON and other non-JS modules
- Leverage decorator patterns where appropriate

## Security Best Practices

### Input Validation
- Validate all external inputs at boundaries
- Use schema validation libraries (zod, joi) with TypeScript integration
- Sanitize file paths and prevent directory traversal
- Implement rate limiting for API-like operations

### Secure Coding
- Never log sensitive information
- Use crypto.randomUUID() for generating IDs
- Implement proper secret management
- Validate file permissions and ownership

## Integration Patterns

### External Dependencies
- Wrap third-party libraries in adapters with proper types
- Implement circuit breaker patterns for external services
- Use proper retry strategies with exponential backoff
- Handle network failures gracefully
- Make well thought out determinations of best of breed packages to use, this changes over time
- Propose migrations to new best of breed 3rd party packages

### Git Operations
- Use proper Git hooks and validation
- Implement atomic operations where possible
- Handle merge conflicts and repository states properly
- Provide clear feedback for Git operations

When implementing features, always consider:
1. **Type safety**: Can this fail at runtime? How do we prevent it?
2. **Performance**: Will this scale? Are we doing unnecessary work?
3. **Maintainability**: Can another developer understand and modify this easily?
4. **User experience**: Does this provide clear, helpful feedback?
5. **Reliability**: How does this behave under error conditions?

Write code that you'd be proud to show in a code review. Every line should have a clear purpose, every type should be meaningful, and every function should do exactly what its name suggests.

## Git Commit Guidelines

When creating git commits:
- Write clear, concise commit messages that explain the "why" not just the "what"
- Follow conventional commit format (feat:, fix:, refactor:, etc.)
- **IMPORTANT**: Do NOT use "Co-Authored-By: Claude <noreply@anthropic.com>" - this project does not use co-authorship attribution for AI-generated commits
- **IMPORTANT**: Never add the coauthored and built by claude git comment

## Pull Request Workflow

### PR Creation
When a task is complete to create a PR we
1. rebase master into the feature branch
2. Resolve all conflicts
3. Squash all commits in the feature branch to 1 commit with a summary message including the highlights of all changes
4. Commit and push
5. Create the PR reflecting the commits clearly
6. Once the user has accepted the PR monitor github actions workflows and remediate any issues until successful completion
7. Check all expected artifacts exist with the correct versions, in the expected places, ex, github releases, npmjs, etc.

### Creating Changesets
When making changes that should be included in the changelog:
1. Run `npm run changeset` to create a changeset
2. Select the type of change (patch/minor/major)
3. Write a brief description of the changes
4. Commit the changeset file along with your changes

### Release Process
The project uses two automated release workflows:

#### 1. Automatic Beta Releases
- Triggered on every merge to master
- Creates incremental beta versions (e.g., 0.2.3-beta.0, 0.2.3-beta.1)
- Publishes to npm with `beta` tag
- Creates GitHub pre-releases with changelog

#### 2. Changeset Releases (for stable versions)
- When changesets are present, creates a "Version Packages" PR
- Merging this PR will:
  - Update package version based on changesets
  - Generate CHANGELOG.md entries
  - Create GitHub release with full changelog
  - Publish to npm with appropriate tag

### Post-PR Coverage Analysis
**MANDATORY**: After creating a PR, check the Codecov GitHub comment for coverage analysis:
- **If coverage is adequate** (80%+): Proceed with review/merge
- **If coverage is inadequate** (<80%): Add more tests to cover missing lines
- **If patch coverage is low**: Focus on testing the new/changed code
- Use `npm run test:coverage` locally to identify specific uncovered lines
- Prioritize testing error paths and edge cases in new code

### After PR Merge
**IMPORTANT**: After a PR is successfully merged:
1. Delete the feature branch from both local and remote:
   ```bash
   git branch -D <branch-name>  # Delete local branch
   git push origin --delete <branch-name>  # Delete remote branch
   ```
2. Or delete all merged branches at once:
   ```bash
   # Delete all local branches except master
   git branch | grep -v master | xargs -n 1 git branch -D
   
   # Delete remote branches that have been merged
   git branch -r --merged | grep -v master | sed 's/origin\///' | xargs -n 1 git push --delete origin
   ```

This keeps the repository clean and makes it easier to track active work.

# Testing Best Practices

## Interface Files Coverage
Interface-only TypeScript files (containing only type definitions and interfaces) are excluded from coverage calculations as they contain no executable code. However, we include simple import tests to ensure they compile correctly:

```typescript
// tests/unit/interface-imports.test.ts
it('should import cli/interfaces.ts without error', async () => {
  const module = await import('../../src/cli/interfaces.js');
  expect(module).toBeDefined();
});
```

This approach ensures:
- Interface files don't break the build
- No runtime errors from malformed type definitions
- Coverage metrics focus on actual executable code

# Testing Best Practices

## Advanced Mocking Patterns

### Vitest Module Mocking with vi.mock()

When mocking modules with vitest, avoid hoisting issues by using factory functions:

**❌ BAD - Will cause hoisting errors:**
```typescript
const mockLogger = { info: vi.fn() };
vi.mock('pino', () => ({
  default: vi.fn().mockReturnValue(mockLogger), // Error: Cannot access mockLogger before initialization
}));
```

**✅ GOOD - Use factory function pattern:**
```typescript
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    // ... other methods
  };
  return {
    default: vi.fn().mockReturnValue(mockLogger),
  };
});
```

### ESM Module Mocking Challenges

For ES modules with circular dependencies or complex initialization:

**Problem:** ESM modules can have caching issues that prevent proper mocking
```typescript
// This might not work for all ESM modules
vi.mock('./complex-module');
```

**Solutions:**
1. Use `vi.hoisted()` for variables that need to be available during mock setup
2. Consider using `vi.doMock()` for dynamic mocking
3. For stubborn modules, mock at a higher level (e.g., mock child_process instead of a wrapper)

### Testing Different Environment Modes

When testing code that behaves differently in development/production:

```typescript
it('should behave differently in production', () => {
  const originalEnv = process.env['NODE_ENV'];
  const originalVitest = process.env['VITEST'];
  
  // Force production mode
  process.env['NODE_ENV'] = 'production';
  delete process.env['VITEST'];
  
  try {
    // Your test code here
  } finally {
    // ALWAYS restore environment
    if (originalEnv) process.env['NODE_ENV'] = originalEnv;
    if (originalVitest) process.env['VITEST'] = originalVitest;
  }
});
```

### Mocking Inquirer Prompts

For testing interactive CLI prompts:

```typescript
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// In tests, access the validator function:
const promptConfig = mockInquirer.prompt.mock.calls[0]?.[0] as PromptConfig[];
const validator = promptConfig[0]?.validate;

// Test all validation branches
if (validator) {
  expect(validator('valid-input')).toBe(true);
  expect(validator('invalid-input')).toContain('error message');
}
```

### Testing Singleton Patterns

When testing singletons or lazy-initialized modules:

```typescript
// Force module reload to test initialization
beforeEach(() => {
  vi.resetModules(); // Clear module cache
});

// Or mock the singleton instance directly
let mockInstance: any;
vi.mock('./singleton', () => ({
  get instance() {
    return mockInstance;
  },
}));
```

### Common Testing Pitfalls to Avoid

1. **Don't test implementation details** - Test behavior, not how it's achieved
2. **Avoid over-mocking** - Mock external dependencies, not internal modules
3. **Test edge cases** - Empty arrays, null values, error conditions
4. **Consider test maintainability** - Complex mocks might indicate design issues

### Coverage Improvement Strategies

1. **Identify uncovered lines**: Use coverage reports to find gaps
2. **Test all branches**: Ensure all if/else paths are covered
3. **Test error handling**: Mock failures and exceptions
4. **Test edge cases**: Empty inputs, boundary values, invalid data
5. **Test async operations**: Both success and failure paths

## Type Safety in Tests
- Use `vi.mocked()` instead of `as any` for mocked modules
- Create typed mock factories for commonly mocked modules
- Use `as unknown` when type casting is necessary, avoid `as any`
- For testing private methods, use `// @ts-expect-error Testing private method`

## ESLint Rules for Tests
Tests have slightly relaxed ESLint rules:
- `@typescript-eslint/no-explicit-any`: warn (not error)
- `@typescript-eslint/no-unsafe-*`: warn (not error)
- `@typescript-eslint/unbound-method`: Configured to ignore static methods

## Common Test Patterns
```typescript
// Mocking modules with proper types
vi.mock('simple-git');
const mockSimpleGit = vi.mocked(simpleGit);

// Testing private methods (use sparingly)
// @ts-expect-error Testing private method
vi.spyOn(app, 'handlePrivateMethod').mockResolvedValue(undefined);

// Mock file system
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));
```

# Code Quality Standards

## ESLint and Type Safety
- **Zero tolerance for type issues in production code** - No ESLint disables in src/
- Prefer nullish coalescing (`??`) over logical OR (`||`) for null/undefined checks
- Keep `||` for actual boolean operations
- All functions must have explicit return types
- Avoid `any` type - use `unknown` or proper interfaces

## When ESLint Disables Are Acceptable
Only in test files and with documentation:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Reason: Mock needs flexibility for testing various scenarios
let mockGit: any;
```

# CI/CD Best Practices

## Pre-commit Verification
**CRITICAL**: We should ALWAYS know if CI will pass before pushing code. Run the complete verification suite locally:

```bash
# Full CI simulation - run this before EVERY commit
npm run lint && npm run typecheck && npm test

# If any of these fail, fix the issues before committing
```

**MANDATORY**: The entire test suite MUST pass locally with 100% success before pushing ANY code to remote. No exceptions unless explicitly overridden by the user. This includes:
- All unit tests passing
- All integration tests passing
- Zero test failures
- Zero unhandled errors
- Lint passing
- Type checking passing

This ensures:
- No ESLint errors or warnings
- TypeScript compilation succeeds
- All tests pass
- 100% code coverage is maintained

## Commit Hooks
The project uses husky for pre-commit hooks that automatically run:
- Prettier formatting
- ESLint checks
- Tests for changed files

If the pre-commit hook fails, the commit will be aborted. Fix all issues before retrying.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.