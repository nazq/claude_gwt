# Release Process

This document describes the release process for claude-gwt.

## Overview

The release process is automated using GitHub Actions and is triggered by creating git tags. The workflow:

1. Runs tests
2. Builds the package
3. Publishes to npm
4. Creates a GitHub Release
5. Updates the CHANGELOG.md (for stable releases)

## Prerequisites

1. **NPM_TOKEN** must be set in GitHub repository secrets
2. You must be on the `main` branch with all changes merged
3. All tests must be passing
4. No uncommitted changes

## Release Types

### Stable Release

For production-ready releases (e.g., 1.0.0, 1.1.0, 2.0.0):

```bash
# Patch release (bug fixes)
./scripts/release.sh patch

# Minor release (new features, backward compatible)
./scripts/release.sh minor

# Major release (breaking changes)
./scripts/release.sh major
```

### Pre-releases

For beta, alpha, or release candidate versions:

```bash
# Pre-release patch (1.0.0 → 1.0.1-beta.0)
./scripts/release.sh prepatch beta

# Pre-release minor (1.0.0 → 1.1.0-beta.0)
./scripts/release.sh preminor beta

# Pre-release major (1.0.0 → 2.0.0-beta.0)
./scripts/release.sh premajor beta

# Increment pre-release (1.0.0-beta.0 → 1.0.0-beta.1)
./scripts/release.sh prerelease
```

You can use different pre-release identifiers:
- `beta` (default)
- `alpha`
- `rc` (release candidate)
- `next`

## Manual Release Process

If you need to release manually:

```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Run tests
npm test

# 3. Build
npm run build:clean

# 4. Bump version
npm version patch  # or minor, major, etc.

# 5. Update CLI version
# Edit src/cli/index.ts to match new version

# 6. Rebuild
npm run build

# 7. Commit changes
git add -A
git commit -m "chore(release): v$(node -p "require('./package.json').version")"

# 8. Create and push tag
git tag -a "v$(node -p "require('./package.json').version")" -m "Release v$(node -p "require('./package.json').version")"
git push origin main
git push origin --tags
```

## Release Workflow

### What Happens When You Release

1. **Local (release.sh)**:
   - Validates branch and working directory
   - Runs tests
   - Bumps version in package.json
   - Updates version in CLI code
   - Creates git commit and tag
   - Pushes to GitHub

2. **GitHub Actions (release.yml)**:
   - Triggered by the new tag
   - Runs tests again
   - Builds the package
   - Publishes to npm with appropriate tag
   - Creates GitHub Release with changelog
   - Updates CHANGELOG.md (stable releases only)

### npm Tags

- **latest**: Stable releases (1.0.0, 1.1.0, etc.)
- **beta**: Beta pre-releases (1.0.0-beta.1)
- **alpha**: Alpha pre-releases (1.0.0-alpha.1)
- **next**: Next version pre-releases
- **rc**: Release candidates (1.0.0-rc.1)

### Installation

Users can install specific versions:

```bash
# Latest stable
npm install -g claude-gwt

# Latest beta
npm install -g claude-gwt@beta

# Specific version
npm install -g claude-gwt@1.0.0-beta.1
```

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions or fixes
- `chore:` Build process or auxiliary tool changes
- `ci:` CI configuration changes

Examples:
```
feat: add supervisor mode for multi-branch overview
fix: correct tmux session cleanup on exit
docs: update installation instructions
chore(release): 1.0.0
```

## Troubleshooting

### Version Mismatch Error

If you get a version mismatch error:
1. Ensure package.json version matches the tag
2. Update src/cli/index.ts version to match
3. Rebuild: `npm run build`

### npm Publish Fails

1. Check NPM_TOKEN is set in GitHub secrets
2. Ensure you have publish permissions on npm
3. Check if the version already exists on npm

### Tests Fail During Release

1. Fix the failing tests
2. Commit the fixes
3. Start the release process again

## Post-Release

After a successful release:

1. **Announce**: Consider announcing major releases
2. **Update Docs**: Update any version-specific documentation
3. **Monitor**: Check npm and GitHub for successful deployment
4. **Test Install**: `npm install -g claude-gwt@latest` to verify

## Reverting a Release

If you need to revert a release:

1. **npm deprecate** (don't unpublish):
   ```bash
   npm deprecate claude-gwt@1.0.0 "This version has critical bugs, please use 1.0.1"
   ```

2. **Create a patch release** with the fix

3. **Update GitHub Release** to note the deprecation