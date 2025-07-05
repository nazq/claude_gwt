# ESLint Migration Guide & Prevention Strategies

This guide documents the common ESLint errors encountered during our migration and how to prevent them in the future.

## Common ESLint Errors and Their Fixes

### 1. Missing Return Types on Functions
**Error**: `Missing return type on function`

**Fix**: Always specify return types explicitly
```typescript
// ❌ Bad
export function skipInCI(reason = 'Skipping in CI environment') {

// ✅ Good
export function skipInCI(reason = 'Skipping in CI environment'): boolean {
```

### 2. Prefer Nullish Coalescing (`??`) over Logical OR (`||`)
**Error**: `Prefer using nullish coalescing operator`

**Fix**: Use `??` when dealing with nullable values, but keep `||` for boolean logic
```typescript
// ❌ Bad (when checking for null/undefined)
const branch = status.current || 'main';

// ✅ Good
const branch = status.current ?? 'main';

// ⚠️ Exception: Keep || for boolean operations
if (cmd.match(/pattern/) || cmd.match(/other/)) { // This is fine
```

### 3. Unsafe Operations with `any` Type
**Error**: Various unsafe operations (`no-unsafe-call`, `no-unsafe-member-access`, etc.)

**Fix**: Avoid `any`, use proper types or add targeted ESLint disables
```typescript
// ❌ Bad
let mockGit: any;

// ✅ Better - use unknown and cast when needed
mockFs.readdir.mockResolvedValue([] as unknown);

// ✅ Best - define proper types
let mockGit: {
  status: jest.Mock;
  fetch: jest.Mock;
  // ... other methods
};

// If you must use any, disable lint rules explicitly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGit: any;
```

### 4. Testing Private Methods
**Error**: TypeScript errors when accessing private methods in tests

**Fix**: Use `@ts-expect-error` with proper ESLint disables
```typescript
// ✅ Good pattern for testing private methods
// @ts-expect-error Testing private method
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
jest.spyOn(app, 'handleEmptyDirectory').mockResolvedValue(undefined);
```

### 5. Unbound Method References
**Error**: `Avoid referencing unbound methods`

**Fix**: Add ESLint disable when checking mocked methods
```typescript
// ✅ Good
// eslint-disable-next-line @typescript-eslint/unbound-method
expect(mockTmuxManager.launchSession).toHaveBeenCalled();
```

### 6. Unnecessary Escape Characters
**Error**: `Unnecessary escape character`

**Fix**: Remove unnecessary escapes in regex
```typescript
// ❌ Bad
const validName = /^[a-zA-Z0-9._\-]+$/.test(input);

// ✅ Good
const validName = /^[a-zA-Z0-9._-]+$/.test(input);
```

## Best Practices to Prevent Future Issues

### 1. Configure ESLint Properly
Ensure your `.eslintrc.js` has appropriate rules for your project:
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // Customize rules based on your needs
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
  },
};
```

### 2. Use Pre-commit Hooks
Install husky and lint-staged to catch issues before commit:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

### 3. Run Linting in CI
Add linting to your CI pipeline:
```yaml
- name: Run linter
  run: npm run lint
```

### 4. Type Your Mocks Properly
Create typed mocks to avoid `any` issues:
```typescript
// tests/mocks/git.ts
export const createMockGit = () => ({
  status: jest.fn(),
  fetch: jest.fn(),
  // ... other methods
});
```

### 5. Use TypeScript Strict Mode
Enable strict mode in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### 6. Regular Linting During Development
Make it a habit to run linting frequently:
```bash
# Add to package.json scripts
"lint:watch": "nodemon --watch src --watch tests --ext ts --exec 'npm run lint'"
```

### 7. Document ESLint Disable Usage
When you must disable ESLint rules, always document why:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Reason: Mock object needs to be flexible for testing various scenarios
let mockGit: any;
```

### 8. Use Type Guards Instead of Type Assertions
```typescript
// ❌ Avoid
const value = someValue as string;

// ✅ Prefer
if (typeof someValue === 'string') {
  // someValue is now typed as string
}
```

## Migration Checklist

When migrating or updating ESLint configuration:

1. [ ] Run `npx eslint . --ext .ts` to see all errors
2. [ ] Fix source files first, then test files
3. [ ] Use `--fix` flag for auto-fixable issues
4. [ ] Add return types to all functions
5. [ ] Replace `||` with `??` where appropriate
6. [ ] Replace `as any` with `as unknown` or proper types
7. [ ] Add ESLint disable comments only when necessary
8. [ ] Run prettier after ESLint fixes
9. [ ] Ensure all tests still pass
10. [ ] Update CI configuration if needed

## Common Patterns for Test Files

### Mocking Modules
```typescript
// Good pattern for mocking
jest.mock('simple-git');
const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
```

### Mocking File System
```typescript
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    // ... other methods
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
```

### Testing Async Errors
```typescript
await expect(async () => {
  await someAsyncFunction();
}).rejects.toThrow('Expected error');
```

## Conclusion

Following these guidelines will help maintain a clean, type-safe codebase with minimal ESLint errors. Remember:

1. **Fix issues immediately** - Don't let ESLint errors accumulate
2. **Use proper types** - Avoid `any` whenever possible
3. **Document exceptions** - When disabling rules, explain why
4. **Automate checks** - Use pre-commit hooks and CI
5. **Stay consistent** - Follow the same patterns across the codebase