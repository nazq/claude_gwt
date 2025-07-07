# Changelog

## 0.3.0

### Minor Changes

- [#20](https://github.com/nazq/claude_gwt/pull/20) [`4ef3489`](https://github.com/nazq/claude_gwt/commit/4ef34898ac86dc2c7f67f8299b2159faa7dc80b9) Thanks [@nazq](https://github.com/nazq)! - Add comprehensive test coverage improvements and automated release workflows
  - Add tests for cgwt-program.ts covering all CLI commands and edge cases
  - Add CI artifact uploads for build outputs, coverage reports, and test results
  - Integrate changesets for better version and changelog management
  - Update CLAUDE.md with PR workflow and branch cleanup instructions
  - Configure changesets with GitHub changelog generator

- [#33](https://github.com/nazq/claude_gwt/pull/33) [`b008d41`](https://github.com/nazq/claude_gwt/commit/b008d41862774b2e827f562d07ab7798812a8ee6) Thanks [@nazq](https://github.com/nazq)! - Enhanced cgwt session display with improved formatting
  - Added compact one-line-per-session display format
  - Introduced supervisor session support with [SUP] indicator at index [0]
  - Implemented color-coded branch names (yellow for main/master, cyan for others)
  - Added active session highlighting with green background and ● marker
  - Simplified output by removing Path/HEAD details from listing
  - Added hidden `cgwt killall` command to terminate all Claude GWT tmux sessions
  - Fixed index numbering to properly show [0] for supervisor, [1], [2], etc. for branches
  - Improved visual hierarchy with cleaner, more scannable output

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
