<div align="center">
  
  <!-- Logo placeholder - add logo.svg to docs/images/ -->
  <h1>🌳</h1>
  
  <h1>🌳 Claude GWT</h1>
  
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
    <a href="https://github.com/nazq/claude_gwt/actions"><img src="https://img.shields.io/github/actions/workflow/status/nazq/claude_gwt/ci.yml?branch=master&style=flat-square&label=build" alt="Build Status"></a>
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
cgwt 1  # → feature-a + Claude
cgwt 2  # → feature-b + Claude

# Supervisor Claude sees everything
cgwt 0  # → Overview of all branches
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
# Create a new directory and initialize
mkdir my-project && cd my-project
claude-gwt

# Or clone an existing repository
claude-gwt --url https://github.com/user/repo.git
```

### 2️⃣ Create Feature Branches

```bash
# Interactive menu appears:
? What would you like to do?
  ❯ Create new worktree
    List branches
    Switch to supervisor mode
    Remove worktree
    Shutdown all sessions
```

The interactive CLI will guide you:
1. Select **"Create new worktree"**
2. Enter branch name (e.g., `feature-auth`)
3. Claude launches with branch context

### 3️⃣ Switch Between Branches

Use the `cgwt` command for quick navigation:

```bash
# List all sessions
cgwt l

# Switch by index
cgwt 1  # Switch to first session
cgwt 2  # Switch to second session

# Switch by branch name
cgwt s feature-auth
cgwt s main

# Or use the interactive menu
claude-gwt
```

### 4️⃣ Supervisor Overview

```bash
# Launch supervisor Claude
cgwt 0

# Or start with supervisor mode
claude-gwt --supervisor
```

---

## 🎬 Demo

<div align="center">
  <p><strong>🎥 Demo Video Coming Soon!</strong></p>
  <p><em>Check out the examples below to see claude-gwt in action</em></p>
</div>

### Real-World Workflow Example

```bash
# Start working on authentication
$ claude-gwt
? What would you like to do? › Create new worktree
? Enter branch name: › feature-auth
✓ Created worktree at ~/project/feature-auth
✓ Launching Claude...

# Claude (feature-auth): "I see we're implementing authentication. 
# Based on the project structure, I'll help you set up JWT..."

# Meanwhile, start API development in parallel
$ claude-gwt
? What would you like to do? › Create new worktree
? Enter branch name: › feature-api
✓ Created worktree at ~/project/feature-api
✓ Launching Claude...

# Claude (feature-api): "I notice we're building the API layer.
# I can see the auth branch is implementing JWT..."

# Supervisor can coordinate
$ cgwt 0
# Claude (supervisor): "I can see both features progressing.
# The auth system should expose these endpoints for the API..."
```

---

## 📖 Documentation

### Command Reference

#### Main CLI: `claude-gwt`

```bash
claude-gwt [options]

Options:
  -V, --version          Show version
  -u, --url <url>       Git repository URL
  -b, --branch <name>   Initial branch name  
  -q, --quiet           Non-interactive mode
  -v, --verbose         Verbose output
  -s, --supervisor      Start in supervisor mode
  -h, --help           Show help
```

#### Quick Switcher: `cgwt`

```bash
# List all sessions
cgwt l
cgwt list

# Switch by index (1-based)
cgwt <number>
cgwt 1    # Switch to first session
cgwt 2    # Switch to second session

# Switch by branch name
cgwt s <branch>
cgwt switch <branch>
cgwt s main
cgwt s feature-auth
```

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
    "defaultAction": "list"
  },
  "git": {
    "defaultBranch": "main",
    "autoFetch": true
  },
  "claude": {
    "autoLaunchSupervisor": true,
    "sessionPrefix": "cgwt"
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

---

## 🛡️ Security

Claude GWT prioritizes security:

- ✅ **Sandboxed Environments** - Each worktree is isolated
- ✅ **Input Validation** - All inputs sanitized
- ✅ **No Arbitrary Execution** - Commands are validated
- ✅ **Secure Sessions** - Tmux sessions are protected

Report security issues to security@claude-gwt.dev

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
