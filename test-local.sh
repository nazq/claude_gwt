#!/bin/bash

# Script to build and test claude-gwt locally

set -e

echo "🔨 Building claude-gwt..."
npm run build:clean

echo "📦 Creating local package..."
npm pack

# Get the package filename
PACKAGE_FILE=$(ls claude-gwt-*.tgz | head -n 1)

echo "📁 Creating test directory..."
TEST_DIR="/tmp/claude-gwt-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📥 Installing claude-gwt locally..."
npm init -y
npm install "$OLDPWD/$PACKAGE_FILE"

echo "✅ Installation complete!"
echo
echo "Test claude-gwt with:"
echo "  cd $TEST_DIR"
echo "  npx claude-gwt"
echo
echo "Or install globally for testing:"
echo "  npm install -g $OLDPWD/$PACKAGE_FILE"
echo "  claude-gwt"