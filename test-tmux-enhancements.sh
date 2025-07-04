#!/bin/bash

# Test script for tmux enhancements in claude-gwt

set -e

echo "Testing tmux enhancements for claude-gwt..."

# Build the project first
echo "Building project..."
npm run build

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed"
    exit 1
fi

# Test cgwt commands
echo -e "\nTesting cgwt commands..."

echo -e "\n1. Help command:"
node dist/src/cli/cgwt.js

echo -e "\n2. List sessions:"
node dist/src/cli/cgwt.js l

echo -e "\n3. Show layouts:"
node dist/src/cli/cgwt.js layouts

echo -e "\n4. Status check:"
node dist/src/cli/cgwt.js ?

echo -e "\nTmux enhancement test complete!"
echo "You can now:"
echo "  - Run 'claude-gwt' in a git repository to test full functionality"
echo "  - Use 'cgwt compare' inside a tmux session to test comparison layout"
echo "  - Use 'cgwt sync' to test synchronized panes"
echo "  - Use 'cgwt dashboard' to test the dashboard view"