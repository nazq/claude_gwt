# Claude GWT - New Workflow Demo

## Workflow Overview

### 1. Initial Setup
```
🎉 Repository ready!

main branch created.

You can now:
  • Create additional branches
  • Switch to a branch to start working with Claude
```

Users stay in the parent directory and manage branches from there.

### 2. Branch Management
```
? What would you like to do?
  ➕ Create new branch
  📋 List all branches
  🚀 Work in branch      <-- This launches Claude wrapper
  🗑️ Remove branch
  🤖 View Claude instances
  🚪 Exit
```

### 3. Claude Wrapper

When selecting "Work in branch", users enter our Claude wrapper:

```
🤖 Launching Claude in feature-auth...

Working directory: /home/user/project/feature-auth
Type :help for meta-commands or :exit to return

>
```

### 4. Meta Commands

Inside the Claude wrapper, users can use `:` commands:

```
:l or :list          - Show all sessions with numbers
:s 2 or :s main      - Switch to session by number or name  
:s or :select        - Return to master session
:b Hello everyone    - Broadcast message to all children
:help                - Show commands
:exit                - Return to branch manager
```

Regular text goes to the currently selected Claude session.

## Example Session

```
> :l

=== Claude Sessions ===
  [0] master (orchestrator)
  [1] main
  [2] feature-auth ← current
  [3] bugfix-123

> :s 3

Switching to bugfix-123...

> Can you help me fix the login bug?
[Message sent to Claude in bugfix-123 branch]

> :b Team, I found the issue in auth.js line 42

📢 Broadcasting: Team, I found the issue in auth.js line 42

> :s

Switching to master session...

> :exit

Returning to branch manager...
```

## Architecture

```
claude-gwt (Branch Manager)
    │
    ├─> Work in branch
    │       │
    │       └─> Claude Wrapper (intercepts : commands)
    │               │
    │               ├─> Regular text → Selected Claude instance
    │               ├─> :list → Show sessions
    │               ├─> :select → Switch sessions
    │               └─> :broadcast → Send to all
    │
    └─> Manages git branches + Claude orchestration
```

## Benefits

1. **Clean Separation**: Branch management vs Claude interaction
2. **No Directory Juggling**: Stay in parent, wrapper handles context
3. **Powerful Meta Commands**: Control flow without leaving Claude
4. **Session Management**: Easy switching between branch contexts
5. **Team Coordination**: Broadcast messages to all instances