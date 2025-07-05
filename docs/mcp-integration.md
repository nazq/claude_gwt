# Claude GWT - MCP Integration

## What's Changed?

Claude GWT is now a **Model Context Protocol (MCP) server** that integrates directly with Claude Code, rather than a standalone CLI tool.

## Installation

```bash
# Install globally
npm install -g claude-gwt

# Add to Claude Code
claude mcp add git-worktree claude-gwt-mcp
```

## Usage

Once installed, Claude Code automatically detects Git worktree projects and provides these tools:

### Tools (Slash Commands)

- **`list_branches`** - List all Git worktree branches
- **`switch_branch <branch>`** - Switch to a different worktree
- **`create_branch <name>`** - Create a new worktree branch
- **`phoenix_mode`** - Enter supervisor mode for multi-branch coordination

### Resources (@ mentions)

- **`@worktree://current`** - Current branch information and task
- **`@worktree://branches`** - List of all branches
- **`@worktree://tasks`** - Tasks assigned to each branch

## Example Workflow

```
$ claude
Welcome to Claude Code

claude> list_branches
🌳 Git Worktree Branches (3):
• main
• feature-auth ← current
• feature-api

claude> Can you help me implement the login feature?
I see you're on the feature-auth branch. Let me help you implement 
the login feature...

claude> switch_branch feature-api
✅ Switched to branch: feature-api
📁 Working directory: /project/feature-api

claude> @worktree://current
# Current Branch: feature-api
**Task:** Implement REST API endpoints...

claude> phoenix_mode
🚁 Phoenix Supervisor Mode Activated!
I can now coordinate work across all 3 branches...
```

## Development

### Running the MCP Server

```bash
# Development
npm run dev:mcp

# Production
npm run build
claude-gwt-mcp
```

### Testing with Claude Code

```bash
# Local development
claude mcp add git-worktree "npm run dev:mcp" --local

# After publishing
claude mcp add git-worktree claude-gwt-mcp
```

## Migration from Standalone CLI

The standalone `claude-gwt` CLI is deprecated. All functionality is now available directly within Claude Code through the MCP integration.

## Benefits

✅ **Natural UX** - Works within Claude's existing interface
✅ **No Context Switching** - Stay in Claude Code
✅ **Better Integration** - Access worktree info with @ mentions
✅ **Automatic Detection** - Claude knows when you're in a worktree project