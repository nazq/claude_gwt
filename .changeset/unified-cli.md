---
"claude-gwt": minor
---

Unified CLI: Merged claude-gwt and cgwt into single cgwt command with clear separation

- **Breaking**: `claude-gwt` command is now deprecated (shows warning and redirects to cgwt)
- **New Structure**: Commands separated into quick operations and app management:
  - Quick commands (top-level): `cgwt 1`, `cgwt -l`, `cgwt -a x.y`
  - App commands (under `cgwt app`):
    - `cgwt app init` - Initialize new Git worktree project  
    - `cgwt app new <branch>` - Create new worktree
    - `cgwt app launch` - Launch Claude in current worktree
    - `cgwt app setup` - Convert existing repo to worktree structure
    - `cgwt app logs` - Show log file location
- **New**: Multi-project support with hierarchical indexing:
  - `cgwt -l` - List all projects
  - `cgwt -l X` - List branches in project X
  - `cgwt -a x.y` - Attach to project.branch
  - `cgwt -la` - List only active sessions
- **Changed**: Session naming format to `cgwt-${repo}--${branch}` (double dash separator)
- **Improved**: Mobile-friendly display with aligned columns and clear indexing
- Maintains backward compatibility with existing cgwt quick-switch commands

This unification simplifies the CLI experience by providing all functionality through a single `cgwt` command while preserving the quick-switching ergonomics that make it efficient to use.