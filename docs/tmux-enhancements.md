# Tmux Enhancements for Claude GWT

This document describes the enhanced tmux features available in claude-gwt for improved session management and productivity.

## Enhanced Status Bar

Each tmux session now features an enhanced status bar that displays:

- **Session role** (SUPERVISOR or branch name)
- **Git branch information**
- **Real-time clock**
- **Visual styling** with role-specific colors:
  - Blue background for supervisor sessions
  - Darker blue for child branch sessions

The status bar automatically refreshes every 2 seconds to show the latest information.

## Better Copy/Paste Configuration

The tmux sessions are configured with improved copy/paste functionality:

### Vi-mode keybindings:
- `Ctrl+b [` - Enter copy mode
- `v` - Begin selection (in copy mode)
- `y` - Copy selection and exit
- `Ctrl+v` - Rectangle selection toggle
- `Escape` - Cancel copy mode

### Mouse support:
- Click and drag to select text
- Scroll with mouse wheel
- Selections automatically copy to system clipboard (requires `xclip` on Linux)

### Paste:
- `Ctrl+b ]` - Paste from clipboard

## Session Management Commands

New `cgwt` commands for enhanced session management:

### `cgwt compare`
Creates a multi-pane layout for comparing branches side by side:
- Splits the current window into horizontal panes
- Each pane shows a different branch
- Useful for code review and comparing implementations

### `cgwt sync`
Toggles synchronized input across all panes:
- When ON: Commands typed in one pane appear in all panes
- When OFF: Each pane operates independently
- Useful for running the same command across multiple branches

### `cgwt dashboard`
Creates a dashboard window showing all branches:
- Opens a new tmux window with tiled layout
- Each pane shows git status and recent commits for a branch
- Maximum of 6 branches displayed for readability

### `cgwt layouts`
Shows predefined layout templates:
- `main-feature`: Main and feature branch side by side
- `triple-review`: Three branches for code review
- `quad-split`: Four branches in grid layout
- `main-develop`: Main branch with develop below

## Session Groups

Sessions are automatically grouped by project:
- All sessions from the same repository share a group
- Supervisor sessions have special visual indicators
- Makes it easier to manage multiple projects

## Key Bindings

Enhanced tmux key bindings available in all claude-gwt sessions:

### Session Navigation:
- `Ctrl+b S` - Show session tree (visual session switcher)

### Pane Navigation:
- `Ctrl+b h/j/k/l` - Navigate panes (vim-style)
- `Ctrl+b H/J/K/L` - Resize panes (hold to repeat)

### Quick Layouts:
- `Ctrl+b =` - Even horizontal split
- `Ctrl+b |` - Even vertical split
- `Ctrl+b +` - Main horizontal (one large pane on top)
- `Ctrl+b _` - Main vertical (one large pane on left)

### Branch Comparison:
- `Ctrl+b b` - Split horizontal with same directory
- `Ctrl+b B` - Split vertical with same directory
- `Ctrl+b y` - Toggle synchronized panes

## Usage Examples

### Compare two branches side by side:
```bash
# In a claude-gwt tmux session
cgwt compare
```

### Run tests on all branches simultaneously:
```bash
# In a session with multiple panes
cgwt sync
npm test  # Runs in all panes
cgwt sync  # Toggle off
```

### Quick branch overview:
```bash
cgwt dashboard
```

### Switch between projects:
```bash
cgwt l  # List all sessions grouped by project
cgwt s project-name/branch  # Switch to specific branch
cgwt 0  # Quick switch to supervisor
```

## Requirements

- tmux 2.8 or higher (for full feature support)
- xclip (Linux) for clipboard integration
- Git repository with claude-gwt setup

## Troubleshooting

### Copy/paste not working with system clipboard:
- Install `xclip`: `sudo apt-get install xclip` (Ubuntu/Debian)
- On macOS, clipboard integration should work out of the box

### Status bar not updating:
- Some older tmux versions may not support all status bar features
- Try updating tmux to the latest version

### Key bindings not working:
- Check if you have custom tmux configuration that conflicts
- Claude-gwt tmux settings are applied per-session and shouldn't affect your global config