# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Development
npm run dev            # Run CLI in development mode

# Code quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
npm run typecheck      # TypeScript type checking

# Run the CLI
node dist/src/cli/index.js [options]
```

## Architecture Overview

### Project Structure
- **`src/core/`** - Core business logic
  - `git/` - Git operations (detector, repository, worktree manager)
  - `claude/` - Claude instance management (pending implementation)
  - `messaging/` - Inter-instance communication (pending implementation)
  - `errors/` - Custom error types
- **`src/cli/`** - CLI application
  - `ui/` - Terminal UI components (prompts, spinner, theme)
  - Main app orchestration
- **`src/types/`** - TypeScript type definitions

### Key Design Patterns
- **Repository Pattern** for Git operations
- **Factory Pattern** for Claude instance creation
- **Observer Pattern** for message passing
- **Command Pattern** for CLI actions

### Testing Strategy
- 100% code coverage requirement
- Unit tests for all business logic
- Integration tests for Git operations
- Mocked file system and Git operations

### Git Worktree Management
The application uses a bare repository pattern:
1. Creates `.bare/` directory containing the repository (hidden from users)
2. Uses `.git` file pointing to the bare repo
3. Automatically creates main/master branch worktree after cloning
4. Manages worktrees through `git worktree` commands

### User Flow
- **Empty directory**: Prompts for Git URL, clones and sets up worktrees
- **Non-empty directory**: Offers to clone into subdirectory (repo URL first, then folder name)
- **Git worktree**: Shows current branch and available worktrees
- **Regular Git repo**: Offers to convert to worktree setup

### CLI Features
- Beautiful terminal UI with colors and animations
- Interactive prompts for user actions
- Progress indicators with spinners
- Themed output using chalk and boxen

## Development Notes

- Always maintain 100% test coverage
- Follow TypeScript strict mode requirements
- Use async/await for all asynchronous operations
- Handle errors with custom error types
- Keep the CLI output concise and beautiful