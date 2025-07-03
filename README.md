# Claude GWT (Git Branch Manager)

A beautiful Git branch manager with integrated Claude Code orchestration. Manage multiple Git branches using worktrees and coordinate Claude AI instances across branches.

## Features

- 🌳 **Git Branch Management** - Create, switch, and remove Git branches effortlessly
- 🤖 **Claude Instance Orchestration** - Run master and child Claude instances across branches
- 💬 **Inter-Instance Communication** - Message passing between Claude instances
- 🎨 **Beautiful CLI** - Interactive terminal UI with colors and animations
- 🔄 **Workflow Automation** - Streamline your multi-branch development

## Installation

```bash
npm install -g claude-gwt
```

## Quick Start

```bash
# In an empty directory
claude-gwt

# With a repository URL
claude-gwt --repo https://github.com/user/repo.git

# In an existing directory
claude-gwt /path/to/project
```

## Usage

### Git Branch Operations

The tool manages Git branches using a worktree pattern:

1. **Initialize** - Creates a `.bare/` directory containing the repository
2. **Branches** - Each branch gets its own working directory
3. **Switch** - Move between branches without stashing

### Claude Instance Management

1. **Master Instance** - Coordinates work across all worktrees
2. **Child Instances** - Dedicated Claude instances per worktree
3. **Communication** - Message routing between instances

### Commands

When in the interactive menu:

- **Create new branch** - Add a new branch with its own directory
- **Switch branch** - Navigate to existing branches
- **Remove branch** - Delete branches and their directories
- **Manage Claude instances** - Start/stop Claude AI instances

### Claude Instance Commands

Within Claude instances, use these commands:

- `@list` - List all child instances
- `@status` - Show status of all instances
- `@send <target> <message>` - Send message to specific instance
- `@broadcast <message>` - Send message to all instances

## Architecture

```
Master Claude Instance (main branch)
├── Child Instance 1 (feature-a)
├── Child Instance 2 (feature-b)
└── Child Instance 3 (bugfix-x)
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build
npm run build
```

## Requirements

- Node.js >= 18.0.0
- Git
- Claude CLI (`claude`)

## License

MIT