# MCP Server Implementation Plan for Claude GWT

## Overview
Build an MCP (Model Context Protocol) server that allows Claude to control claude-gwt, which in turn manages Claude instances across different git worktrees. This creates a recursive control loop where Claude can orchestrate its own instances.

## Architecture

### 1. MCP Server Structure
```
src/mcp/
├── server.ts           # Main MCP server entry point
├── handlers/           # Command handlers
│   ├── worktree.ts    # Git worktree operations
│   ├── session.ts     # Tmux session management
│   ├── branch.ts      # Branch operations
│   └── claude.ts      # Claude instance control
├── tools/             # MCP tool definitions
│   └── index.ts       # Tool registry
├── types/             # TypeScript types
│   └── index.ts       # MCP-specific types
└── utils/             # Helper functions
    └── converter.ts   # Convert cgwt commands to MCP format
```

### 2. Core MCP Tools to Implement

#### 2.1 Worktree Management
- `list_worktrees` - List all git worktrees in current project
- `create_worktree` - Create new worktree for a branch
- `delete_worktree` - Remove a worktree
- `switch_worktree` - Change to a different worktree

#### 2.2 Session Management
- `list_sessions` - List all Claude GWT sessions
- `list_projects` - List all projects with active sessions
- `list_active_sessions` - List only active sessions
- `attach_session` - Attach to a specific session
- `create_session` - Launch new Claude instance
- `kill_session` - Terminate a session
- `kill_all_sessions` - Terminate all sessions

#### 2.3 Branch Operations
- `list_branches` - List branches in current project
- `create_branch` - Create new branch with worktree
- `switch_branch` - Switch to different branch/worktree

#### 2.4 Claude Control
- `launch_claude` - Launch Claude in current worktree
- `launch_supervisor` - Launch Claude in supervisor mode
- `split_pane` - Split tmux pane with another session
- `sync_panes` - Synchronize commands across panes

#### 2.5 Information Tools
- `get_current_session` - Get current session info
- `get_session_status` - Check if session is active
- `get_project_info` - Get project details
- `show_tips` - Display keyboard shortcuts

### 3. Implementation Details

#### 3.1 MCP Server Setup
- Use `@modelcontextprotocol/sdk` for MCP implementation
- Implement stdio transport for communication
- Handle tool registration and command routing
- Proper error handling and response formatting

#### 3.2 Integration with Existing Code
- Reuse existing command implementations from `cgwt-program.ts`
- Wrap existing functions with MCP-compatible interfaces
- Maintain consistent error handling patterns
- Preserve all existing functionality

#### 3.3 Type Safety
- Define strict TypeScript interfaces for all tools
- Use proper MCP types from the SDK
- Implement validation for tool parameters
- Ensure type safety across the entire implementation

### 4. Example Tool Implementation

```typescript
// Example: list_worktrees tool
{
  name: "list_worktrees",
  description: "List all git worktrees in the current project",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["simple", "detailed", "json"],
        description: "Output format"
      }
    }
  },
  handler: async (args) => {
    const sessions = await listSessions();
    return formatWorktreeResponse(sessions, args.format);
  }
}
```

### 5. Testing Strategy
- Unit tests for each tool handler
- Integration tests with actual git repositories
- Mock tmux operations for testing
- Test error scenarios and edge cases
- Ensure 100% code coverage

### 6. Documentation
- Update README with MCP server usage
- Create MCP tool reference documentation
- Add examples of Claude using the MCP server
- Document the recursive control pattern

### 7. Security Considerations
- Validate all input parameters
- Prevent directory traversal attacks
- Sanitize shell command inputs
- Limit operations to project scope
- No arbitrary code execution

### 8. Future Enhancements
- WebSocket transport support
- Remote MCP server capabilities
- Multi-project orchestration
- Advanced supervisor mode features
- Integration with Claude's planning capabilities

## Implementation Steps

1. **Create MCP server structure** (src/mcp/)
2. **Implement core server with stdio transport**
3. **Add worktree management tools**
4. **Add session management tools**
5. **Add branch operation tools**
6. **Add Claude control tools**
7. **Write comprehensive tests**
8. **Update documentation and examples**
9. **Add build configuration for MCP server**
10. **Test with actual Claude instances**

## Success Criteria
- All cgwt commands accessible via MCP
- Claude can create and manage its own worktrees
- Claude can launch and control other Claude instances
- Proper error handling and feedback
- Comprehensive test coverage
- Clear documentation and examples