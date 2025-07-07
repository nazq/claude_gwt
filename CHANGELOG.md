# Changelog

## 0.3.0

### Minor Changes

- [#20](https://github.com/nazq/claude_gwt/pull/20) [`4ef3489`](https://github.com/nazq/claude_gwt/commit/4ef34898ac86dc2c7f67f8299b2159faa7dc80b9) Thanks [@nazq](https://github.com/nazq)! - Add comprehensive test coverage improvements and changesets for version management
  - Add tests for cgwt-program.ts covering all CLI commands and edge cases
  - Add CI artifact uploads for build outputs, coverage reports, and test results
  - Integrate changesets for better version and changelog management
  - Update CLAUDE.md with PR workflow and branch cleanup instructions
  - Configure changesets with GitHub changelog generator

- [#24](https://github.com/nazq/claude_gwt/pull/24) [`915dca5`](https://github.com/nazq/claude_gwt/commit/915dca5979d4c511d1885796ebd3763a7577d202) Thanks [@nazq](https://github.com/nazq)! - feat: refactor TmuxColor from enum to class with factory methods
  - Converted `TmuxColor` from enum to class with static factory methods
  - Added `TmuxColor.from(number)` to generate any of the 256 terminal colors
  - Added `TmuxColor.fromString(string)` for custom color values
  - Removed arbitrary numbered color constants (Colour0, Colour25, etc.)
  - Kept standard color constants (Black, Red, Green, etc.)
  - Updated all internal usage to use the new class structure
  - Example: `TmuxColor.from(135)` creates a color object that converts to `'colour135'`

All notable changes to claude-gwt will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta.1] - 2025-07-05

### 🎉 Initial Beta Release

#### Added

- **Core Features**
  - Git worktree management with seamless creation and switching
  - Claude AI integration with dedicated instances per branch
  - Tmux session orchestration for persistent development environments
  - Supervisor mode for overseeing all branches
  - Beautiful interactive CLI with colors and animations

- **Advanced Features**
  - Visual tmux layouts for different workflows
  - Command synchronization across panes
  - Session persistence and recovery
  - Token tracking per branch
  - MCP (Model Context Protocol) server integration

- **Developer Experience**
  - Zero-configuration setup for new projects
  - Support for existing Git repositories
  - Non-interactive mode for automation
  - Comprehensive error handling and recovery
  - Extensive logging and debugging options

- **Security**
  - Input validation and sanitization
  - Sandboxed worktree environments
  - Secure session management
  - Protected tmux sessions

#### Technical Details

- Written in TypeScript with full type safety
- 100% test coverage requirement
- Comprehensive e2e tests with minimal mocking
- CI/CD pipeline with multi-platform testing
- Docker support for containerized workflows

[0.1.0-beta.1]: https://github.com/nazq/claude_gwt/releases/tag/v0.1.0-beta.1
