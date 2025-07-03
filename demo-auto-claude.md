# Claude GWT - Auto Claude Management Demo

## New Behavior

### 1. Auto-Start Master Instance

When you're in a branch (worktree), the master Claude instance starts automatically:

```
✨ Git branch environment ready

📍 Current branch: main

🌿 Active branches (3):
  ● main /home/user/project/main ← current
  ○ feature-auth /home/user/project/feature-auth
  ○ bugfix-123 /home/user/project/bugfix-123

🤖 Starting master Claude instance...
✔ Master Claude instance ready!

🎯 Master: main
```

### 2. Auto-Create Child Instances

When creating a new branch, a child Claude instance is automatically created:

```
? What would you like to do? ➕ Create new branch
? Branch name: feature-payments

✔ Creating branch feature-payments...
✔ Branch created at /home/user/project/feature-payments
✔ Starting Claude instance for feature-payments...
✔ Claude instance started for feature-payments

🤖 Claude is ready in the new branch!
🎉 Ready to start coding!
Run 'cd feature-payments' to enter the branch
```

### 3. Auto-Stop on Branch Removal

When removing a branch, its Claude instance is automatically stopped:

```
? What would you like to do? 🗑️ Remove branch
? Select branch to remove: feature-old
? Are you sure you want to remove branch 'feature-old'? Yes

✔ Stopping Claude instance for feature-old...
✔ Claude instance stopped
✔ Removing branch feature-old...
✔ Branch removed successfully
```

### 4. Simplified Claude Menu

The Claude menu now focuses on viewing and managing existing instances:

```
? What would you like to do? 🤖 View Claude instances
? Claude instance management:
  📋 Show all Claude instances
  ⏹️ Stop child Claude instance
  🔄 Restart master instance
  ⬅️ Back to main menu
```

## Benefits

1. **Zero Configuration**: Claude instances are managed automatically
2. **Seamless Workflow**: Focus on coding, not orchestration
3. **Resource Efficient**: Instances start/stop with branches
4. **Clear Status**: Always know which Claude instances are running

## Architecture

```
Project Root (main branch)
├── Master Claude Instance (auto-started)
├── feature-auth/ → Child Instance (auto-created)
├── feature-payments/ → Child Instance (auto-created)
└── bugfix-123/ → Child Instance (auto-created)
```

Each branch gets its own Claude instance that can:
- Communicate with the master instance
- Focus on branch-specific tasks
- Share context and insights
- Be managed independently