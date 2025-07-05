# Lint Ignore Categories Analysis

This document categorizes all ESLint and TypeScript ignores in the codebase for review and remediation.

## Summary Statistics
- **Total files with ignores**: 11 files (1 source, 10 test files)
- **Most common ignores**: `@ts-expect-error` (64), `@ts-ignore` (80+), `eslint-disable` (various)

## Category 1: Testing Private Methods
**Pattern**: `@ts-expect-error Testing private method`
**Count**: 16 instances
**Files**: 
- `tests/unit/cli/ClaudeGWTApp.test.ts`
- `tests/unit/cli/extractRepoName.test.ts`

**Action Plan**:
1. **Option A**: Create a testing interface that exposes private methods in test environment
2. **Option B**: Refactor tests to only test public API
3. **Option C**: Use reflection patterns or test utilities

**Example Fix**:
```typescript
// Instead of:
// @ts-expect-error Testing private method
app.handleEmptyDirectory()

// Consider:
// 1. Making method protected and extending for tests
// 2. Testing through public API
// 3. Using a test helper that safely accesses internals
```

## Category 2: Unsafe Operations (any/unknown)
**Patterns**: 
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/no-explicit-any`

**Count**: ~25 instances
**Files**: Multiple test files

**Action Plan**:
1. Create proper type definitions for mocks
2. Use type assertions with specific interfaces
3. Create mock factories with proper types

**Example Fix**:
```typescript
// Instead of:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGit: any;

// Use:
interface MockGit {
  status: jest.Mock<Promise<StatusResult>>;
  fetch: jest.Mock<Promise<void>>;
  // ... other methods
}
let mockGit: MockGit;
```

## Category 3: Unbound Methods
**Pattern**: `@typescript-eslint/unbound-method`
**Count**: 4 instances
**Files**: `tests/unit/sessions/TmuxManager.test.ts`

**Action Plan**:
1. Review if these are false positives for jest expectations
2. Consider updating ESLint config for test files
3. Use arrow functions where appropriate

## Category 4: Prefer Nullish Coalescing
**Pattern**: `@typescript-eslint/prefer-nullish-coalescing`
**Count**: 4 instances
**Files**: `tests/unit/sessions/tmux-bind-key.test.ts`

**Action Plan**:
1. Review each case - some are legitimate boolean operations
2. Use `??` only for null/undefined checks
3. Configure rule to allow `||` in boolean contexts

## Category 5: File-Level Disables
**Pattern**: `/* eslint-disable ... */`
**Count**: 3 files
**Files**:
- `tests/unit/core/git/GitRepository.test.ts`
- `tests/unit/core/git/GitDetector.test.ts`

**Action Plan**:
1. Replace with specific line-level disables
2. Fix underlying issues to remove need for disables
3. Create proper types to avoid unsafe operations

## Category 6: Production Code Ignores
**Pattern**: Various in `src/sessions/TmuxManager.ts`
**Count**: 1 file

**Action Plan**:
1. **PRIORITY**: Review and fix - production code should have minimal ignores
2. Create proper types for child_process operations
3. Handle type safety properly

## Remediation Priority

### High Priority (Production Code)
1. [ ] Fix ignores in `src/sessions/TmuxManager.ts`

### Medium Priority (Common Patterns)
1. [ ] Create typed mock factories for common modules
2. [ ] Establish testing patterns for private methods
3. [ ] Review and fix file-level disables

### Low Priority (Test-Specific)
1. [ ] Review nullish coalescing warnings
2. [ ] Update unbound method warnings
3. [ ] Clean up individual test ignores

## Recommended Actions by Week

### Week 1: Production Code
- Remove all ignores from source files
- Create proper types for external modules
- Document any necessary exceptions

### Week 2: Mock Types
- Create `tests/types/mocks.ts` with common mock interfaces
- Update all `any` mocks to use proper types
- Create factory functions for complex mocks

### Week 3: Testing Patterns
- Decide on approach for testing private methods
- Create testing utilities if needed
- Update all private method tests

### Week 4: Cleanup
- Remove file-level disables
- Review each remaining ignore
- Update ESLint config for test-specific rules

## ESLint Configuration Updates

Consider these updates to `.eslintrc.js`:

```javascript
module.exports = {
  // ... base config
  overrides: [
    {
      files: ['tests/**/*.ts'],
      rules: {
        // Relax certain rules for tests
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/unbound-method': ['error', {
          ignoreStatic: true
        }],
        // Allow || in boolean contexts
        '@typescript-eslint/prefer-nullish-coalescing': ['error', {
          ignorePrimitives: { boolean: true }
        }]
      }
    }
  ]
};
```

## Next Steps

1. **Immediate**: Fix production code ignores
2. **This Sprint**: Create mock type definitions
3. **Next Sprint**: Establish testing patterns
4. **Future**: Achieve zero ignores in codebase

## Tracking Progress

- [x] Source files: 1/1 cleaned ✅
- [ ] Test files: 1/10 cleaned (GitDetector.test.ts uses targeted eslint-disable)
- [ ] Mock types created: 0/5 (attempted but reverted due to complexity)
- [ ] Testing utilities created: 0/2
- [ ] ESLint config updated: No