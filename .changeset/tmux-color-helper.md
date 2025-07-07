---
"claude-gwt": minor
---

feat: refactor TmuxColor from enum to class with factory methods

- Converted `TmuxColor` from enum to class with static factory methods
- Added `TmuxColor.from(number)` to generate any of the 256 terminal colors
- Added `TmuxColor.fromString(string)` for custom color values
- Removed arbitrary numbered color constants (Colour0, Colour25, etc.)
- Kept standard color constants (Black, Red, Green, etc.)
- Updated all internal usage to use the new class structure
- Example: `TmuxColor.from(135)` creates a color object that converts to `'colour135'`