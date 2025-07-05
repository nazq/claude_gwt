# Changelog

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