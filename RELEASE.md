# Release Process for Claude GWT

This document outlines the exact steps to release claude-gwt to ensure version synchronization between Git tags and npm.

## 🎯 Release Types

### Patch Release (0.2.0 → 0.2.1)
For bug fixes and minor updates.

### Minor Release (0.2.1 → 0.3.0)
For new features that don't break existing functionality.

### Major Release (0.3.0 → 1.0.0)
For breaking changes or significant milestones.

## 📋 Pre-Release Checklist

1. **All tests passing**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

2. **Clean working directory**
   ```bash
   git status  # Should be clean
   ```

3. **Up to date with origin**
   ```bash
   git pull origin master
   ```

4. **Version decision made**
   - What type of release? (patch/minor/major)
   - Any breaking changes?
   - Any new features?

## 🚀 Release Steps

### Method 1: Using Scripts (Recommended)

```bash
# For patch releases
npm run release:patch

# For minor releases  
npm run release:minor

# For major releases
npm run release:major
```

### Method 2: Manual Process

1. **Bump version**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Verify changes**
   ```bash
   git log --oneline -2
   git tag -l | tail -5
   ```

3. **Build and test**
   ```bash
   npm run build:clean
   npm test
   ```

4. **Publish**
   ```bash
   npm publish
   ```

5. **Push tags**
   ```bash
   git push origin master --tags
   ```

## 📝 Release Notes

### v0.2.1 (Current)
- Fix version sync between Git tags and npm
- Add formal release process documentation
- Ensure proper tagging workflow

### v0.2.0
- Initial production release
- Complete TypeScript rewrite from bash scripts
- 474 comprehensive tests
- Full CI/CD pipeline

### v1.0.0 (Yanked)
- Accidentally published as 1.0.0
- Unpublished and replaced with 0.2.0

## 🐛 Troubleshooting

### Version Mismatch
If git tags and npm versions don't match:

1. Check current state:
   ```bash
   git tag -l | sort -V
   npm view claude-gwt version
   cat package.json | grep version
   ```

2. If npm is ahead, create a git tag:
   ```bash
   git tag v$(cat package.json | jq -r .version)
   git push origin --tags
   ```

3. If git is ahead, bump package.json:
   ```bash
   npm version --no-git-tag-version $(git describe --tags --abbrev=0 | sed 's/^v//')
   git add package.json package-lock.json
   git commit -m "chore: sync version with git tag"
   ```

## 🔍 Verification

After each release:

1. **Check npm**
   ```bash
   npm view claude-gwt version
   ```

2. **Check git tags**
   ```bash
   git tag -l | sort -V | tail -5
   ```

3. **Test installation**
   ```bash
   npm install -g claude-gwt@latest
   claude-gwt --version
   ```

## 🚨 Emergency: Unpublishing

If you need to unpublish a version:

```bash
# Within 24 hours of publishing
npm unpublish claude-gwt@VERSION

# After 24 hours, you can only deprecate
npm deprecate claude-gwt@VERSION "Reason for deprecation"
```

## 📋 Post-Release Tasks

1. Update CHANGELOG.md
2. Create GitHub release with notes
3. Update README if needed
4. Announce on social media
5. Close related GitHub issues

## 🎯 Version Strategy

- **0.x.x**: Beta/experimental phase
- **1.x.x**: Production ready, stable API
- **2.x.x**: Major architectural changes

Current: Beta phase - expect frequent updates and potential breaking changes.