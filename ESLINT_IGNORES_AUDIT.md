# ESLint Ignores Audit

This document tracks all ESLint disable comments and `@ts-expect-error` annotations added during the ESLint migration. Each should be reviewed to see if it can be removed or replaced with proper types.

## Files with ESLint Ignores

### 1. `/tests/helpers/ci-helper.ts`
- **No ignores added** ✅

### 2. `/tests/unit/cli/ClaudeGWTApp.test.ts`
Multiple instances of:
- `@ts-expect-error Testing private method`
- `eslint-disable-next-line @typescript-eslint/no-unsafe-call`
- `eslint-disable-next-line @typescript-eslint/unbound-method`

**Action Items:**
- [ ] Consider exposing methods for testing or using a testing utility pattern
- [ ] Review if private method testing is necessary
- [ ] Consider creating a test-specific interface

### 3. `/tests/unit/cli/extractRepoName.test.ts`
- `@ts-expect-error Testing private method`
- `eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return`

**Action Items:**
- [ ] Consider making `extractRepoNameFromUrl` a public static method if it's useful for testing

### 4. `/tests/unit/core/errors/CustomErrors.test.ts`
Multiple instances of:
- `eslint-disable-next-line @typescript-eslint/no-unsafe-assignment`
- `eslint-disable-next-line @typescript-eslint/no-unsafe-member-access`

**Action Items:**
- [ ] Create typed interfaces for serialized error objects
- [ ] Use type assertions with proper interfaces instead of `any`

### 5. `/tests/unit/core/git/GitDetector.test.ts`
- Changed all `as any` to `as unknown` ✅
- **No eslint-disable comments added** ✅

### 6. `/tests/unit/core/git/GitRepository.test.ts`
- File-level disable: `/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */`
- `eslint-disable-next-line @typescript-eslint/no-explicit-any` for `mockGit`

**Action Items:**
- [ ] Create proper type definitions for git mocks
- [ ] Consider using a mock factory with proper types
- [ ] Remove file-level disable by fixing individual issues

### 7. `/tests/unit/sessions/tmux-bind-key.test.ts`
Multiple instances of:
- `eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing`

**Action Items:**
- [ ] Review if these are truly boolean operations that shouldn't use `??`
- [ ] Consider adjusting ESLint rule configuration if these are valid uses

### 8. `/tests/unit/sessions/TmuxManager.test.ts`
- `eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access`
- `eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access`
- `eslint-disable-next-line @typescript-eslint/no-unsafe-assignment`
- `eslint-disable-next-line @typescript-eslint/unbound-method`

**Action Items:**
- [ ] Replace `require` with proper imports
- [ ] Type the `mockSpawnSync` properly
- [ ] Review unbound method warnings for mock assertions

## Summary Statistics

- Total files with ignores: 7/8
- Total ignore comments: ~25-30
- Most common ignores:
  1. `@typescript-eslint/no-unsafe-*` (testing with mocks)
  2. `@ts-expect-error` (accessing private methods)
  3. `@typescript-eslint/unbound-method` (jest expectations)

## Recommended Actions

### Short Term (Quick Fixes)
1. Create typed mock factories for commonly mocked modules
2. Use `as unknown as TypedInterface` pattern instead of `any`
3. Configure ESLint rules that are too strict for test files

### Medium Term (Refactoring)
1. Create test utilities for accessing private methods safely
2. Refactor tests to not need private method access
3. Create proper type definitions for all mocks

### Long Term (Architecture)
1. Consider dependency injection for better testability
2. Use factory patterns for complex mocks
3. Separate test concerns from implementation details

## ESLint Configuration Improvements

Consider adding test-specific ESLint configuration:

```javascript
// .eslintrc.js
module.exports = {
  // ... base config
  overrides: [
    {
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Less strict in tests
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/unbound-method': ['error', {
          ignoreStatic: true
        }]
      }
    }
  ]
};
```

## Review Schedule

- [ ] Week 1: Review and fix `@ts-expect-error` annotations
- [ ] Week 2: Address `no-unsafe-*` warnings with proper types
- [ ] Week 3: Review `prefer-nullish-coalescing` disables
- [ ] Week 4: Create typed mock utilities
- [ ] Month 2: Refactor tests to eliminate need for accessing private methods

## Notes

- Many of these ignores are in test files, which is common
- The pattern of testing private methods should be reconsidered
- Mock typing is the biggest source of `any` usage
- Consider using libraries like `ts-mockito` or `jest-mock-extended` for better typed mocks