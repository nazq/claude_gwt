#!/bin/bash

# Release Script for Claude GWT
# This script automates the release process including version bumping, tagging, and triggering npm publish

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    print_error "You must be on main/master branch to release. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Pull latest changes
print_step "Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_step "Current version: $CURRENT_VERSION"

# Determine release type
if [ -z "$1" ]; then
    echo "Usage: $0 <release-type> [pre-id]"
    echo ""
    echo "Release types:"
    echo "  patch        - Bug fixes (1.0.0 → 1.0.1)"
    echo "  minor        - New features (1.0.0 → 1.1.0)"
    echo "  major        - Breaking changes (1.0.0 → 2.0.0)"
    echo "  prepatch     - Pre-release patch (1.0.0 → 1.0.1-beta.0)"
    echo "  preminor     - Pre-release minor (1.0.0 → 1.1.0-beta.0)"
    echo "  premajor     - Pre-release major (1.0.0 → 2.0.0-beta.0)"
    echo "  prerelease   - Increment pre-release (1.0.0-beta.0 → 1.0.0-beta.1)"
    echo ""
    echo "Examples:"
    echo "  $0 patch"
    echo "  $0 minor"
    echo "  $0 prerelease beta"
    echo ""
    exit 1
fi

RELEASE_TYPE=$1
PRE_ID=${2:-beta}

# For pre-releases, add the pre-id
if [[ "$RELEASE_TYPE" == pre* ]] && [ "$RELEASE_TYPE" != "prerelease" ]; then
    NPM_VERSION_ARGS="$RELEASE_TYPE --preid=$PRE_ID"
elif [ "$RELEASE_TYPE" == "prerelease" ]; then
    NPM_VERSION_ARGS="$RELEASE_TYPE"
else
    NPM_VERSION_ARGS="$RELEASE_TYPE"
fi

# Run tests
print_step "Running tests..."
npm test
print_success "Tests passed"

# Run build
print_step "Building project..."
npm run build:clean
print_success "Build completed"

# Update version in package.json and create git tag
print_step "Bumping version..."
NEW_VERSION=$(npm version $NPM_VERSION_ARGS --no-git-tag-version)
NEW_VERSION=${NEW_VERSION#v} # Remove 'v' prefix if present

# Update version in CLI file
print_step "Updating version in CLI..."
# Use a more robust sed command that handles special characters
sed -i "s/\.version('[^']*')/\.version('${NEW_VERSION//\//\\/}')/" src/cli/index.ts

# Rebuild with new version
print_step "Rebuilding with new version..."
npm run build

# Stage changes
git add -A

# Commit version bump
print_step "Committing version bump..."
git commit -m "chore(release): $NEW_VERSION

- Bump version to $NEW_VERSION
- Update CLI version string
- Prepare for release

[skip ci]"

# Create git tag
print_step "Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

print_success "Version bumped to $NEW_VERSION"

# Push changes
print_step "Pushing changes to remote..."
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

print_success "Release v$NEW_VERSION created successfully!"
echo ""
print_step "GitHub Actions will now:"
echo "  1. Create a GitHub Release"
echo "  2. Publish to npm"
echo "  3. Generate release notes"
echo ""

# Check if this is a pre-release
if [[ "$NEW_VERSION" == *-* ]]; then
    print_warning "This is a pre-release version ($NEW_VERSION)"
    echo "  - It will be published with the '$PRE_ID' tag on npm"
    echo "  - Users will need to install with: npm install claude-gwt@$PRE_ID"
else
    print_success "This is a stable release"
    echo "  - It will be published as 'latest' on npm"
    echo "  - Users can install with: npm install claude-gwt"
fi

echo ""
print_step "Monitor the release at:"
echo "  https://github.com/nazq/claude_gwt/actions"
echo "  https://github.com/nazq/claude_gwt/releases"