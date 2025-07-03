# Worktree Path Fix Summary

## Problem
When cloning a repository like `fdd-ingest`, worktrees were being created in the parent directory:
- Expected: `/home/nazq/dev/fdd-ingest/main`
- Actual: `/home/nazq/dev/main` ❌

This caused the error:
```
fatal: '/home/nazq/dev/main' already exists
```

## Root Cause
The `WorktreeManager` was calculating worktree paths incorrectly:
```typescript
// OLD (incorrect)
const worktreePath = path.join(path.dirname(this.basePath), branch);
```

This took the parent directory of the project and added the branch name.

## Solution
Fixed the path calculation to create branches inside the project directory:
```typescript
// NEW (correct)
const worktreePath = path.join(this.basePath, branch);
```

Also improved the git operations to work correctly with bare repositories:
1. Use `.bare` directory for git commands when it exists
2. Properly handle worktree paths in remove operations

## Expected Structure
```
/home/nazq/dev/fdd-ingest/
├── .bare/          # Bare git repository
├── .git            # Points to .bare
├── main/           # Main branch worktree
├── feature-xyz/    # Feature branch worktree
└── bugfix-123/     # Bugfix branch worktree
```

## Benefits
- Branches are properly contained within the project directory
- No conflicts with other projects in the parent directory
- Clean, organized structure that matches user expectations
- Compatible with existing git workflows and tools