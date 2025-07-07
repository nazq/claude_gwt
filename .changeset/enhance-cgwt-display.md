---
"claude-gwt": minor
---

Enhanced cgwt session display with improved formatting

- Added compact one-line-per-session display format
- Introduced supervisor session support with [SUP] indicator at index [0]
- Implemented color-coded branch names (yellow for main/master, cyan for others)
- Added active session highlighting with green background and ● marker
- Simplified output by removing Path/HEAD details from listing
- Added hidden `cgwt killall` command to terminate all Claude GWT tmux sessions
- Fixed index numbering to properly show [0] for supervisor, [1], [2], etc. for branches
- Improved visual hierarchy with cleaner, more scannable output