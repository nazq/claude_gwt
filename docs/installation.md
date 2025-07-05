# Installation Guide for Claude GWT

## Prerequisites

1. **Node.js 18+** - Required for running claude-gwt
2. **Git** - Required for git worktree management
3. **Claude CLI** - Required for Claude integration

### Installing Claude CLI

Claude GWT depends on the Claude CLI being available. Install it with:

```bash
# If Claude CLI is available via npm (check official docs)
npm install -g @anthropic-ai/claude-cli

# Or follow the official installation guide
```

## Development Installation

### 1. Clone and Build

```bash
git clone <repo-url>
cd claude_gwt
npm install
npm run build
```

### 2. Test Locally

```bash
# Create a local package
npm run pack:local

# Test in isolation
./test-local.sh
```

### 3. Install Globally (for development)

```bash
# From the project directory
npm install -g .

# Now you can use it anywhere
claude-gwt
```

## Production Installation

Once published to npm:

```bash
npm install -g claude-gwt
```

## Verifying Installation

```bash
# Check if installed
which claude-gwt

# Check if Claude CLI is available
which claude

# Test basic functionality
claude-gwt --version
```

## Troubleshooting

### "Claude CLI not found" Error

If you see this error when entering supervisor or branch mode:
- Ensure Claude CLI is installed and in your PATH
- Try running `claude --version` to verify
- The tool will show a demo mode if Claude is not available

### Permission Errors

If you get permission errors during global install:
- Use a Node version manager (nvm, fnm)
- Or use npx: `npx claude-gwt`

### Build Errors

If TypeScript compilation fails:
- Ensure you're using Node 18+
- Run `npm install` to get all dependencies
- Check for any TypeScript errors with `npm run typecheck`