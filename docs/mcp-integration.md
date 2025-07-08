# Claude GWT - MCP Integration

## Overview

Claude GWT now includes a **Model Context Protocol (MCP) server** that allows Claude to control claude-gwt operations. This creates a powerful recursive control pattern where Claude can orchestrate its own instances across different git worktrees.

## Installation & Setup

### 1. Install Claude GWT
```bash
npm install -g claude-gwt
```

### 2. Configure MCP in Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claude-gwt": {
      "command": "npx",
      "args": ["claude-gwt", "mcp:server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The MCP server will now be available in Claude.

## Available Tools

### Worktree Management

#### `list_worktrees`
Lists all git worktrees in the current project.
- **Parameters**:
  - `format`: Output format (`simple`, `detailed`, `json`)
- **Returns**: Array of worktree information

#### `create_worktree`
Creates a new git worktree for a branch.
- **Parameters**:
  - `branch`: Name of the branch
  - `createBranch`: Create branch if it doesn't exist
  - `baseBranch`: Base branch for new branch
- **Returns**: Path to the created worktree

#### `delete_worktree`
Removes a git worktree.
- **Parameters**:
  - `branch`: Name of the branch/worktree
  - `force`: Force removal even with uncommitted changes
- **Returns**: Confirmation of removal

#### `switch_worktree`
Switches to a different git worktree.
- **Parameters**:
  - `target`: Branch name or index to switch to
- **Returns**: Confirmation of switch

### Session Management

#### `list_sessions`
Lists all Claude GWT tmux sessions.
- **Parameters**:
  - `projectFilter`: Filter by project name
  - `activeOnly`: Show only active sessions
- **Returns**: Array of session information

#### `list_projects`
Lists all projects with Claude GWT sessions.
- **Returns**: Array of project information with branches

#### `attach_session`
Attaches to a specific Claude GWT session.
- **Parameters**:
  - `index`: Session index (x.y format) or name
- **Returns**: Confirmation of attachment

#### `create_session`
Creates a new Claude GWT session.
- **Parameters**:
  - `branch`: Branch name for the session
  - `supervisor`: Create as supervisor session
- **Returns**: Created session name

#### `kill_session`
Kills a specific Claude GWT session.
- **Parameters**:
  - `sessionName`: Name of session to kill
  - `index`: Alternative to sessionName
- **Returns**: Confirmation of termination

#### `kill_all_sessions`
Kills all Claude GWT sessions for the current project.
- **Returns**: Confirmation message

### Branch Operations

#### `list_branches`
Lists all branches in the current git repository.
- **Parameters**:
  - `remote`: Include remote branches
  - `all`: Include both local and remote
- **Returns**: Array of branch information

#### `create_branch`
Creates a new branch with optional worktree.
- **Parameters**:
  - `name`: Branch name
  - `baseBranch`: Base branch to create from
  - `withWorktree`: Also create worktree
- **Returns**: Created branch information

#### `switch_branch`
Switches to a different branch/worktree.
- **Parameters**:
  - `branch`: Branch name or index
- **Returns**: Confirmation of switch

#### `delete_branch`
Deletes a git branch.
- **Parameters**:
  - `branch`: Branch name
  - `force`: Force delete even if not merged
  - `remote`: Also delete remote branch
- **Returns**: Deletion confirmation

### Claude Control

#### `launch_claude`
Launches Claude Code in the current or specified worktree.
- **Parameters**:
  - `supervisor`: Launch in supervisor mode
  - `branch`: Branch to launch Claude in
- **Returns**: Launch confirmation

#### `split_pane`
Splits current tmux pane and launches another session.
- **Parameters**:
  - `target`: Branch name or session index
  - `horizontal`: Split horizontally vs vertically
  - `percentage`: Size percentage for new pane
- **Returns**: Split confirmation

#### `sync_panes`
Toggles synchronization of commands across panes.
- **Parameters**:
  - `enable`: Enable or disable sync
- **Returns**: Sync status

#### `get_current_session`
Gets information about the current Claude GWT session.
- **Returns**: Current session details

#### `show_tips`
Displays tmux keyboard shortcuts and tips.
- **Returns**: Tips and shortcuts text

## Example Usage in Claude

### Basic Workflow
```
Human: Can you list all the worktrees in this project?

Claude: I'll list the worktrees in your project.

[Uses list_worktrees tool]

Here are the git worktrees in your project:
- main (active)
- feature-auth
- feature-api
- bugfix-login