---
"claude-gwt": minor
---

feat: add colorFrom helper to generate tmux color strings

- Added `TmuxDriver.colorFrom(number)` static method to generate color strings for any of the 256 terminal colors
- Simplifies using numbered colors beyond the predefined enum values
- Includes validation for color range (0-255) and handles decimal numbers by flooring
- Example: `TmuxDriver.colorFrom(135)` returns `'colour135'`