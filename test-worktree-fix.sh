#!/bin/bash

# Test script to verify worktree paths are created correctly

echo "Testing worktree path fix..."
echo "============================"

# Create a test directory
TEST_DIR="/tmp/test-gwt-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Test directory: $TEST_DIR"
echo

# Run claude-gwt with a test repo
echo "Running claude-gwt..."
node /home/nazq/dev/claude_gwt/dist/src/cli/index.js --repo https://github.com/octocat/Hello-World.git

echo
echo "Checking created structure..."
find . -type d -name ".git" -o -name ".bare" -o -name "main" -o -name "master" | sort

echo
echo "Expected structure:"
echo "  ./.bare (bare repository)"
echo "  ./main or ./master (branch worktree)"
echo
echo "If branches are created inside the project directory, the fix is working!"