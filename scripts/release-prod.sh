#!/bin/bash

# Script to trigger a production release

echo "🚀 Claude GWT Production Release Tool"
echo "===================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    echo "   Visit: https://cli.github.com/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".github" ]; then
    echo "❌ Please run this script from the root of the claude_gwt repository"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"
echo ""

# Prompt for release type
echo "Select release type:"
echo "  1) Patch (bug fixes)"
echo "  2) Minor (new features)"
echo "  3) Major (breaking changes)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        RELEASE_TYPE="patch"
        ;;
    2)
        RELEASE_TYPE="minor"
        ;;
    3)
        RELEASE_TYPE="major"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📋 This will:"
echo "  1. Create a Version Packages PR with a $RELEASE_TYPE version bump"
echo "  2. You review and merge the PR"
echo "  3. Production artifacts are automatically published after merge"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🏃 Triggering production release workflow..."
gh workflow run "Create Release PR" -f release_type=$RELEASE_TYPE

echo ""
echo "✅ Workflow triggered!"
echo ""
echo "📋 Next steps:"
echo "  1. Wait for the Version Packages PR to be created"
echo "  2. Review the PR (check CHANGELOG.md and version bump)"
echo "  3. Merge the PR"
echo "  4. Production release will publish automatically"
echo ""
echo "🔗 View workflow runs: https://github.com/nazq/claude_gwt/actions/workflows/create-release-pr.yml"