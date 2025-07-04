# Claude GWT (Git Worktree Tool)

[![CI](https://github.com/nazq/claude_gwt/actions/workflows/ci.yml/badge.svg)](https://github.com/nazq/claude_gwt/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/claude-gwt.svg)](https://www.npmjs.com/package/claude-gwt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/gh/nazq/claude_gwt/branch/master/graph/badge.svg)](https://codecov.io/gh/nazq/claude_gwt)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

A powerful Git worktree manager with integrated Claude AI orchestration. Manage multiple Git branches in parallel with dedicated Claude instances for each branch.

## 🚀 Features

- 🌳 **Git Worktree Management** - Create, switch, and manage Git worktrees effortlessly
- 🤖 **Claude AI Orchestration** - Run supervisor and branch-specific Claude instances via tmux
- 🔄 **Session Management** - Quick switching between Claude sessions with `cgwt` command
- 🎨 **Beautiful CLI** - Interactive terminal UI with colors and animations
- ⚙️ **Flexible Configuration** - Customize contexts for supervisor and branch workers
- 🐳 **Docker Support** - Run in containers with full functionality

## 📦 Installation

### NPM (Recommended)
```bash
npm install -g claude-gwt
```

### Docker
```bash
docker pull nazq/claude-gwt
docker run -it -v $(pwd):/workspace nazq/claude-gwt
```

### From Source
```bash
git clone https://github.com/nazq/claude-gwt.git
cd claude-gwt
npm install
npm run build
npm link
```

For detailed installation instructions, see [docs/installation.md](docs/installation.md).

## 🚀 Quick Start

```bash
# Initialize in an empty directory
claude-gwt

# Clone and set up a repository
claude-gwt --repo https://github.com/user/repo.git

# Work with existing directory
claude-gwt /path/to/project

# Non-interactive mode
claude-gwt --repo URL --quiet
```

## 🎯 Core Concepts

### Git Worktree Structure
```
project/
├── .bare/          # Bare repository (hidden)
├── .git            # Points to .bare
├── main/           # Main branch worktree
├── feature-x/      # Feature branch worktree
└── bugfix-y/       # Bugfix branch worktree
```

### Claude Session Architecture
- **Supervisor Session** - Orchestrates work across all branches (index 0)
- **Branch Sessions** - Dedicated Claude instances per branch (index 1, 2, 3...)
- **Tmux Integration** - All sessions run in tmux for persistence

## 🛠️ Usage

### Main CLI (`claude-gwt`)

```bash
# Interactive mode (default)
claude-gwt

# With options
claude-gwt --repo <url>          # Clone repository
claude-gwt --quiet               # Non-interactive mode
claude-gwt --clean               # Start fresh Claude sessions
claude-gwt --help                # Show help
```

### Session Manager (`cgwt`)

```bash
# List all sessions
cgwt l

# Switch to supervisor
cgwt 0

# Switch to branch by index
cgwt 1

# Switch to branch by name
cgwt s feature-auth

# Show status
cgwt ?

# Advanced features
cgwt compare             # Compare branches side-by-side
cgwt dashboard           # Show all branches dashboard
cgwt sync                # Synchronize input across panes

# Configuration
cgwt config init         # Initialize configuration
cgwt config edit         # Edit configuration
cgwt config show         # Display configuration
```

## ⚙️ Configuration

Configuration files are stored in `~/.config/claude-gwt/`:

```bash
~/.config/claude-gwt/
├── config.json                    # Main configuration
├── contexts/
│   ├── projects/
│   │   ├── my-project.md         # Project-specific context
│   │   └── my-project/
│   │       └── feature-x.md      # Branch-specific context
│   └── templates/
│       └── api-development.md     # Reusable templates
```

### Example Configuration

```json
{
  "context": {
    "global": "Global context for all sessions...",
    "supervisor": "Supervisor-specific context...",
    "child": "Branch worker context..."
  },
  "ui": {
    "theme": "default",
    "showTokenUsage": true,
    "autoLaunchSupervisor": true
  },
  "sessions": {
    "alwaysContinue": true,
    "maxParallelSessions": 10
  }
}
```

## 🔌 MCP Server Integration

Claude GWT includes a Model Context Protocol server for Claude Code. For detailed MCP integration instructions, see [docs/mcp-integration.md](docs/mcp-integration.md).

### Quick Setup
```json
{
  "mcpServers": {
    "claude-gwt": {
      "command": "claude-gwt-mcp",
      "args": ["/path/to/project"]
    }
  }
}
```

## 📊 Token Tracking

Claude GWT automatically tracks token usage across all sessions. For comprehensive token tracking documentation, see [docs/token-tracking.md](docs/token-tracking.md).

### Quick Commands
```bash
# View current session
cgwt tokens

# Today's usage
cgwt tokens --today

# Cost analysis
cgwt tokens --cost
```

## 🎨 Advanced Features

### Working with Regular Git Repositories

Claude GWT can work with regular (non-worktree) Git repositories:

```bash
# In a regular Git repo
claude-gwt

# Options:
# 1. Convert to worktree setup (recommended)
# 2. Use with limited functionality
```

### Tmux Layouts

```bash
# Compare branches side-by-side
cgwt compare feature-a feature-b

# Create dashboard view
cgwt dashboard

# Synchronize typing across panes
cgwt sync
```

### Custom Contexts

Create project-specific contexts:

```bash
# Initialize config
cgwt config init

# Edit configuration
cgwt config edit

# Add project context
echo "# Project Guidelines" > ~/.config/claude-gwt/contexts/projects/my-project.md
```

## 🐛 Troubleshooting

### Common Issues

1. **Tmux not found**
   ```bash
   # Install tmux
   sudo apt-get install tmux  # Ubuntu/Debian
   brew install tmux          # macOS
   ```

2. **Permission denied**
   ```bash
   # Ensure scripts are executable
   chmod +x ~/.npm-global/lib/node_modules/claude-gwt/dist/src/cli/*.js
   ```

3. **Claude asking for login repeatedly**
   ```bash
   # Set trust dialog
   claude config set hasTrustDialogAccepted true
   ```

### Debug Mode

```bash
# Enable verbose logging
export DEBUG=claude-gwt:*
claude-gwt

# Check logs
tail -f .claude-gwt.log
```

## 📚 Documentation

For detailed documentation, see the [docs](docs/) directory, which includes:
- [Installation Guide](docs/installation.md)
- [MCP Integration](docs/mcp-integration.md)
- [Token Tracking](docs/token-tracking.md)
- [Tmux Enhancements](docs/tmux-enhancements.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone
git clone https://github.com/nazq/claude-gwt.git
cd claude-gwt

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk)
- Powered by [Claude AI](https://claude.ai)
- Terminal UI with [Chalk](https://github.com/chalk/chalk) and [Inquirer](https://github.com/SBoudrias/Inquirer.js)

## 📞 Support

- 📧 Email: support@claude-gwt.dev
- 💬 Discord: [Join our community](https://discord.gg/claude-gwt)
- 🐛 Issues: [GitHub Issues](https://github.com/nazq/claude-gwt/issues)

---

Made with ❤️ by the Claude GWT team