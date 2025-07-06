# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# IMPORTANT: Before committing
# Always run full test suite locally to ensure CI will pass:
npm run lint && npm run typecheck && npm test

# Run the CLI
node dist/src/cli/index.js [options]
```

## Architecture Overview

### Project Structure
- **`src/core/`** - Core business logic
  - `git/` - Git operations (detector, repository, worktree manager)
  - `errors/` - Custom error types
  - `services/` - Service layer with adapters and factories
  - `utils/` - Utility functions (async, logger, security)
  - `di/` - Dependency injection container
  - `drivers/` - External tool drivers (tmux)
- **`src/cli/`** - CLI application
  - `ui/` - Terminal UI components (prompts, spinner, theme)
  - `index.ts` - Main CLI entry point (claude-gwt)
  - `cgwt.ts` - Quick session switcher
  - `ClaudeGWTApp.ts` - Main app orchestration
- **`src/sessions/`** - Session management
  - `TmuxManager.ts` - Tmux session orchestration
  - `TmuxEnhancer.ts` - Advanced tmux features
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
- Use the testing pyramid: unit > integration > e2e
- Implement proper test fixtures and factories
- Use snapshot testing judiciously for complex objects

### Test Quality
- Achieve meaningful coverage, not just percentage targets
- Test error conditions and edge cases thoroughly
- Use property-based testing for complex logic
- Implement proper mocking strategies without over-mocking

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

# Testing Best Practices

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
```

**MANDATORY**: The entire test suite MUST pass locally with 100% success before pushing ANY code to remote. No exceptions unless explicitly overridden by the user. This includes:
- All unit tests passing
- All integration tests passing
- All e2e tests passing
- Zero test failures
- Zero unhandled errors
- Lint passing
- Type checking passing

## Pre-commit Verification
**CRITICAL**: We should ALWAYS know if CI will pass before pushing code. Run the complete verification suite locally:

```bash
# Full CI simulation - run this before EVERY commit
npm run lint && npm run typecheck && npm test

# If any of these fail, fix the issues before committing
```

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