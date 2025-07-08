<div align="center">
  
  <!-- Logo placeholder - add logo.svg to docs/images/ -->
  <h1>🌳</h1>
  
  <h1>🌳 Claude GWT 🚀</h1>
  
  <p><strong>Git Worktree Manager with Integrated Claude Code Orchestration</strong></p>
  
  <p>
    <em>Transform your multi-branch development workflow with AI-powered context isolation</em>
  </p>
  
  <p>
    <strong>⚠️ BETA SOFTWARE</strong> - This is experimental software under active development.<br>
    Please report issues and feedback on <a href="https://github.com/nazq/claude_gwt/issues">GitHub</a>
  </p>
  
  <p>
    <img src="https://img.shields.io/badge/status-beta-orange.svg?style=flat-square" alt="Beta Status">
    <a href="https://www.npmjs.com/package/claude-gwt"><img src="https://img.shields.io/npm/v/claude-gwt.svg?style=flat-square&color=00ADD8&label=npm" alt="NPM Version"></a>
    <a href="https://www.npmjs.com/package/claude-gwt"><img src="https://img.shields.io/npm/dm/claude-gwt.svg?style=flat-square&color=00ADD8" alt="NPM Downloads"></a>
    <a href="https://github.com/nazq/claude_gwt/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/claude-gwt.svg?style=flat-square&color=00ADD8" alt="License"></a>
    <a href="https://github.com/nazq/claude_gwt/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nazq/claude_gwt/ci.yml?branch=master&style=flat-square&label=build" alt="Build Status"></a>
    <a href="https://codecov.io/gh/nazq/claude_gwt"><img src="https://img.shields.io/codecov/c/github/nazq/claude_gwt?style=flat-square&color=00ADD8" alt="Coverage"></a>
    <a href="https://github.com/nazq/claude_gwt"><img src="https://img.shields.io/github/stars/nazq/claude_gwt?style=flat-square&color=00ADD8" alt="GitHub Stars"></a>
  </p>

  <p>
    <a href="#-why-claude-gwt">Why</a> •
    <a href="#-features">Features</a> •
    <a href="#-installation">Install</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-demo">Demo</a> •
    <a href="#-docs">Docs</a>
  </p>
  
  <br>
  
  <!-- Demo GIF placeholder - add demo.gif to docs/images/ -->
  
</div>

<br>

---

## 🎯 Why Claude GWT?

### The Multi-Branch Development Problem

<table>
<tr>
<td width="50%">

#### 😫 **Without Claude GWT**

```bash
# Switch branches loses AI context
git checkout feature-b
# Claude: "What were we working on?"

# Stash changes, lose mental state
git stash
git checkout main
git stash pop # Conflicts!

# Multiple terminals, multiple confusion
# Tab 1: feature-a
# Tab 2: feature-b
# Tab 3: Which branch am I in??
```

</td>
<td width="50%">

#### 🚀 **With Claude GWT**

```bash
# Each branch has its own directory
~/project/feature-a/
~/project/feature-b/

# Each branch has its own Claude
# with full context awareness!

# Switch instantly, no stashing
cgwt -a 1  # → feature-a + Claude
cgwt -a 2  # → feature-b + Claude

# List and switch with simple commands
cgwt -l    # List all projects
cgwt -la   # List only active sessions
```

</td>
</tr>
</table>

### 🧠 The Game Changer

**Claude GWT** gives each git branch its own:
- 📁 **Dedicated directory** (via git worktrees)
- 🤖 **Dedicated Claude instance** with persistent memory
- 🖥️ **Dedicated tmux session** for instant switching, and remote access
- 📝 **Dedicated context** that never gets lost

> _"It's like having a team of specialized AI assistants, each an expert in their own feature"_

### 🌐 Remote Access
Connect to **Claude GWT** from anywhere

- 🔐 Use [Tailscale](https://tailscale.com) to trivially create your mesh VPN
- 🤖 Use [JuiceSSH](https://juicessh.com)/[Termius](https://termius.com) to connect from Android
- 🍎 Use [Termius](https://termius.com)/[Blink Shell](https://blink.sh)/[Secure ShellFish](https://secureshellfish.app) to connect from iOS

---

## ✨ Features

### 🎯 Core Capabilities

<table>
<tr>
<td width="33%" align="center">
  <h4>🌲 Git Worktree Magic</h4>
  <p>Work on multiple branches<br>simultaneously without stashing</p>
</td>
<td width="33%" align="center">
  <h4>🤖 AI Context Isolation</h4>
  <p>Each branch gets its own<br>Claude with full context</p>
</td>
<td width="33%" align="center">
  <h4>⚡ Instant Switching</h4>
  <p>Jump between features<br>without losing state</p>
</td>
</tr>
<tr>
<td width="33%" align="center">
  <h4>👥 Supervisor Mode <br><i>(coming soon)</i></h4>
  <p>Master Claude oversees<br>and coordinates all branches</p>
</td>
<td width="33%" align="center">
  <h4>🎨 Modern CLI</h4>
  <p>Intuitive interface with<br>colors and animations</p>
</td>
<td width="33%" align="center">
  <h4>🔐 Secure by Design</h4>
  <p>Sandboxed environments</p>
</td>
</tr>
</table>

### 🚀 Advanced Features (WIP)

- **📊 Visual Layouts** - Pre-configured tmux layouts for different workflows
- **🔄 Smart Syncing** - Synchronize commands across multiple panes
- **💾 Persistent Sessions** - Resume exactly where you left off
- **📈 Token Tracking** - Monitor Claude API usage per branch
- **🎯 MCP Integration** - Model Context Protocol server included
- **🐳 Docker Ready** - Run in containers with full functionality

---

## ⚡ Keyboard Shortcuts & Productivity Tips

### Tmux Pane Management

After starting a cgwt session, use these shortcuts for lightning-fast workflow:

**Quick Splits (no prefix needed):**
- `Alt+\` - Split vertically
- `Alt+-` - Split horizontally

**Standard Tmux (after Ctrl+B):**
- `|` - Split vertically
- `-` - Split horizontally  
- `h/j/k/l` - Navigate panes (vim-style)
- `H/J/K/L` - Resize panes (hold to repeat)
- `z` - Toggle pane zoom
- `x` - Close current pane

### Power User Tips

```bash
# Inside Claude, use ! prefix for commands
!cgwt split main      # Split and open main branch
!cgwt -l             # List all sessions
!cgwt tips           # Show all shortcuts

# Quick session switching
cgwt -a 1            # Jump to session 1
cgwt -a 2.1          # Jump to project 2, branch 1

# Split current pane with another branch
cgwt split            # Split with bash and helper text
cgwt split main       # Split vertically with main branch
cgwt split main -h    # Split horizontally with main branch
cgwt split main -p 30 # Split with 30% size for new pane
```

### Multi-Branch Workflow

1. Start with your feature: `cgwt -a 1`
2. Split for reference: `cgwt split main` 
3. Compare implementations side-by-side
4. Claude in each pane maintains separate context!

**Advanced Split Workflows:**
```bash
# Create a 4-pane comparison layout
cgwt -a 1                    # Start in feature branch
cgwt split main              # Add main branch (vertical)
cgwt split develop -h        # Add develop branch (horizontal)
cgwt split staging -h -p 33  # Add staging branch (33% height)

# Each pane has its own Claude instance with isolated context!
```

---

## 📊 Code Quality & Test Coverage

<div align="center">

[![Coverage (Master)](https://codecov.io/gh/nazq/claude_gwt/graph/badge.svg?branch=master)](https://codecov.io/gh/nazq/claude_gwt/tree/master)
[![Coverage (All Branches)](https://codecov.io/gh/nazq/claude_gwt/graph/badge.svg)](https://codecov.io/gh/nazq/claude_gwt)
[![Build Status](https://img.shields.io/github/actions/workflow/status/nazq/claude_gwt/ci.yml?branch=master&style=flat-square&label=build)](https://github.com/nazq/claude_gwt/actions/workflows/ci.yml)

**Comprehensive test coverage across all Node.js versions (18-24) on Ubuntu and macOS**

</div>

### 📈 Coverage Visualization

<details>
<summary><b>📊 Coverage by Module (Sunburst Chart)</b></summary>

<div align="center">
  <a href="https://codecov.io/gh/nazq/claude_gwt">
    <img src="https://codecov.io/gh/nazq/claude_gwt/graph/sunburst.svg" alt="Coverage Sunburst Chart" />
  </a>
</div>

</details>

<details>
<summary><b>🌳 Coverage Tree Map</b></summary>

<div align="center">
  <a href="https://codecov.io/gh/nazq/claude_gwt">
    <img src="https://codecov.io/gh/nazq/claude_gwt/graph/tree.svg" alt="Coverage Tree Map" />
  </a>
</div>

</details>

<details>
<summary><b>📋 Coverage Hierarchy (Icicle Chart)</b></summary>

<div align="center">
  <a href="https://codecov.io/gh/nazq/claude_gwt">
    <img src="https://codecov.io/gh/nazq/claude_gwt/graph/icicle.svg" alt="Coverage Icicle Chart" />
  </a>
</div>

</details>

### 🧪 Test Structure

- **468+ tests** across comprehensive test suite
- **Unit tests**: Core business logic and utilities
- **Integration tests**: Full workflow and system integration
- **CI Coverage**: All Node.js versions (18.x - 24.x) on Ubuntu + macOS
- **Zero skipping**: All tests run on all environments

---

## 📦 Installation

### Prerequisites

- **Node.js** ≥ 18.0.0 (LTS recommended)
- **Git** ≥ 2.20.0
- **Tmux** ≥ 3.0 (for session management)
- **Claude Desktop** - Get it from [claude.ai](https://claude.ai)

### Install Methods

<details>
<summary><b>📦 npm (Recommended)</b></summary>

```bash
npm install -g claude-gwt
```

</details>

<details>
<summary><b>🧶 yarn</b></summary>

```bash
yarn global add claude-gwt
```

</details>

<details>
<summary><b>🐳 Docker</b></summary>

```bash
docker pull nazq/claude-gwt
docker run -it -v $(pwd):/workspace nazq/claude-gwt
```

</details>

<details>
<summary><b>🔧 From Source</b></summary>

```bash
git clone https://github.com/nazq/claude_gwt.git
cd claude_gwt
npm install
npm run build
npm link
```

</details>

---

## 🚀 Quick Start

### 1️⃣ Initialize a New Project

```bash
# Create a new directory and run guided setup
mkdir my-project && cd my-project
cgwt app

# Or use specific commands for power users
cgwt app init --url https://github.com/user/repo.git
```

### 2️⃣ Guided Experience

The `cgwt app` command provides a guided experience that detects your environment:

```bash
# Auto-detects your situation and guides you
cgwt app

# Examples of what it detects:
# • Empty directory → Offers to clone a repository
# • Git repository → Offers to convert to worktree setup
# • Existing worktrees → Shows management options
```

### 3️⃣ Quick Navigation

Use `cgwt` for instant switching between projects and branches:

```bash
# List all projects and branches
cgwt -l

# List only active sessions  
cgwt -la

# Switch by index (supports x.y format for multi-project)
cgwt -a 1      # Switch to first session
cgwt -a 2.1    # Switch to project 2, branch 1

# Direct commands for power users
cgwt app new feature-auth    # Create new worktree
cgwt app launch main         # Launch specific branch
cgwt app setup               # Initial repository setup
```

### 4️⃣ Full Application Management

For complete control, use the `cgwt app` commands:

```bash
# Interactive guided experience
cgwt app

# Specific actions
cgwt app init           # Initialize new project
cgwt app new <branch>   # Create new worktree
cgwt app launch <branch> # Launch existing branch
cgwt app setup          # Setup existing repository
cgwt app logs           # View session logs
```

---

## 🎬 Demo

<div align="center">
  <p><strong>🎥 Demo Video Coming Soon!</strong></p>
  <p><em>Check out the examples below to see claude-gwt in action</em></p>
</div>

### Real-World Workflow Example

```bash
# Start with guided experience
$ cgwt app
? Directory detected: Git repository
? What would you like to do? › Convert to worktree setup
✓ Converted to worktree structure
✓ Main branch available at ~/project/main

# Create authentication feature
$ cgwt app new feature-auth
✓ Created worktree at ~/project/feature-auth  
✓ Launching Claude...

# Claude (feature-auth): "I see we're implementing authentication. 
# Based on the project structure, I'll help you set up JWT..."

# Meanwhile, start API development in parallel  
$ cgwt app new feature-api
✓ Created worktree at ~/project/feature-api
✓ Launching Claude...

# Claude (feature-api): "I notice we're building the API layer.
# I can see the auth branch is implementing JWT..."

# Quick switching between features
$ cgwt -l              # List all branches
$ cgwt -a 1            # Switch to feature-auth
$ cgwt -a 2            # Switch to feature-api

# Overview of all active work
$ cgwt -la             # Show only active sessions
```

---

## 📖 Documentation

### Command Reference

#### Unified CLI: `cgwt`

The main command now handles both quick operations and full application management:

##### Quick Commands (for instant switching)

```bash
# List projects and branches
cgwt -l [project]         # List all or specific project
cgwt -la                  # List only active sessions

# Switch by index  
cgwt -a <index>           # Switch to session by index
cgwt -a 1                 # Switch to first session
cgwt -a 2.1               # Switch to project 2, branch 1

# Show version
cgwt -V, --version        # Show version information
```

##### App Commands (for full management)

```bash
# Guided experience (detects your environment)
cgwt app [options]

# Specific actions
cgwt app init [options]          # Initialize new project
cgwt app new <branch>            # Create new worktree
cgwt app launch <branch>         # Launch existing branch
cgwt app setup                   # Setup existing repository
cgwt app logs                    # View session logs

# App command options
Options:
  -u, --url <url>               Git repository URL
  -b, --branch <name>           Initial branch name  
  -q, --quiet                   Non-interactive mode
  -v, --verbose                 Verbose output (-v, -vv, -vvv)
  -h, --help                    Show help
```

##### Utility Commands

```bash
# Split current tmux pane with another branch
cgwt split [target] [options]    # Split pane and launch another session
cgwt split                       # Split with bash and helper text
cgwt split main                  # Split and launch main branch
cgwt split -h                    # Split horizontally (top/bottom)
cgwt split -p 30                 # Split with 30% size
cgwt split feature-api -h -p 25  # Split horizontally, 25% size

# Show tips and keyboard shortcuts
cgwt tips                        # Display all tips and tmux shortcuts
```

#### Legacy Command: `claude-gwt` (deprecated)

The original `claude-gwt` command is still available but deprecated. It now redirects to `cgwt app` with a deprecation warning.

### Architecture

```
┌─────────────────────────────────────────┐
│          Claude GWT Orchestrator        │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────┐   │
│  │   Git    │  │  Tmux    │  │ MCP  │   │
│  │ Worktree │  │ Sessions │  │Server│   │
│  │          │  │          │  │(soon)│   │
│  └──────────┘  └──────────┘  └──────┘   │
│                                         │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴────────┬────────────┐
    │                  │            │
┌───▼────┐        ┌────▼───┐   ┌────▼───┐
│ Branch │        │ Branch │   │ Branch │
│   A    │        │   B    │   │   C    │
├────────┤        ├────────┤   ├────────┤
│ Claude │        │ Claude │   │ Claude │
│   #1   │        │   #2   │   │   #3   │
├────────┤        ├────────┤   ├────────┤
│ Work-  │        │ Work-  │   │ Work-  │
│ tree   │        │ tree   │   │ tree   │
└────────┘        └────────┘   └────────┘
```

### Configuration

Configuration is stored in `~/.config/claude-gwt/`:

```json
{
  "ui": {
    "theme": "ocean",
    "showBanner": true,
    "defaultAction": "guided"
  },
  "git": {
    "defaultBranch": "main",
    "autoFetch": true
  },
  "tmux": {
    "sessionPrefix": "cgwt",
    "defaultLayout": "main-vertical"
  },
  "app": {
    "guidedExperience": true,
    "autoDetectEnvironment": true
  }
}
```

---

## 🤝 Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/claude_gwt.git

# Use Claude GWT for development!
cd claude_gwt
npm install
npm run dev
```

### 📊 Code Quality Reports

Generate comprehensive code quality reports:

```bash
# Generate all reports
npm run reports

# View reports in browser
npm run reports:serve
```

This creates a beautiful dashboard at `reports/index.html` with:
- 📊 **Test Coverage** - Interactive coverage maps
- 🔧 **ESLint Analysis** - Code quality issues and statistics
- 🧪 **Test Results** - Execution timing and metrics
- 🕸️ **Dependency Graphs** - Visual architecture analysis
- 📝 **TypeScript Diagnostics** - Type checking results
- 🧬 **Mutation Testing** - Test quality analysis (optional)

---

## 🛡️ Security

Claude GWT prioritizes security:

- ✅ **Sandboxed Environments** - Each worktree is isolated
- ✅ **Input Validation** - All inputs sanitized
- ✅ **No Arbitrary Execution** - Commands are validated
- ✅ **Secure Sessions** - Tmux sessions are protected

For security issues, please follow responsible disclosure via GitHub Security.

---

## 📄 License

MIT © [Claude GWT Contributors](https://github.com/nazq/claude_gwt/graphs/contributors)

---

<div align="center">
  <br>
  <p>
    <sub>Built with ❤️ by developers who were tired of losing context</sub>
  </p>
  <p>
    <a href="https://github.com/nazq/claude_gwt/stargazers">⭐ Star us on GitHub</a>
  </p>
</div>
