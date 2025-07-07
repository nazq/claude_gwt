# Release Process for Claude GWT

This document outlines the automated beta release and manual production release processes for claude-gwt.

## 🤖 Automated Beta Releases

**Every merge to master automatically creates a beta release!**

When a PR is merged to master:
1. CI automatically runs tests
2. Version is bumped to next beta (e.g., 0.2.2 → 0.2.3-beta.0)
3. Git tag is created and pushed
4. Package is published to npm with `beta` tag
5. Users can install with: `npm install -g claude-gwt@beta`

### Beta Version Progression
- First beta after stable: `0.2.2` → `0.2.3-beta.0`
- Subsequent betas: `0.2.3-beta.0` → `0.2.3-beta.1` → `0.2.3-beta.2`
- Production release: `0.2.3-beta.2` → `0.2.3`

## 🚀 Production Releases

Production releases are **manually triggered** when you decide a beta is stable.

### Release Types

- **Patch Release** (0.2.2 → 0.2.3): Bug fixes and minor updates
- **Minor Release** (0.2.3 → 0.3.0): New features, no breaking changes
- **Major Release** (0.2.3 → 1.0.0): Breaking changes or major milestones

### Pre-Release Checklist

1. **Review beta feedback**
   ```bash
   # Check latest beta version
   npm view claude-gwt@beta version
   
   # Test the beta
   npm install -g claude-gwt@beta
   claude-gwt --version
   ```

2. **Ensure clean state**
   ```bash
   git status  # Should be clean
   git pull origin master
   ```

3. **All tests passing**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

### Creating a Production Release

```bash
# For patch releases (bug fixes)
npm run release:patch

# For minor releases (new features)
npm run release:minor

# For major releases (breaking changes)
npm run release:major
```

The script will:
1. Run all tests
2. Build the project
3. Bump version (removes beta suffix if present)
4. Update CLI version string
5. Create git commit and tag
6. Push to GitHub
7. Trigger GitHub Actions to publish to npm

## 📊 Version Management

### Current Flow
```
Development → PR → Merge to master → Auto Beta → Manual Prod Release
     ↓          ↓         ↓                ↓              ↓
  Feature    Review   0.2.3-beta.0   0.2.3-beta.1     0.2.3
```

### Checking Versions
```bash
# Current package version
cat package.json | grep version

# Latest stable version on npm
npm view claude-gwt version

# Latest beta version on npm
npm view claude-gwt@beta version

# All published versions
npm view claude-gwt versions --json

# Git tags
git tag -l | sort -V
```

## 🐛 Troubleshooting

### Beta Not Publishing
If auto-beta fails:
1. Check GitHub Actions: https://github.com/nazq/claude_gwt/actions
2. Ensure NPM_TOKEN secret is set
3. Check for `[skip ci]` in commit message

### Version Conflicts
If versions get out of sync:
```bash
# Reset to match npm latest
npm view claude-gwt version
# Update package.json to match
npm version --no-git-tag-version <version>
git add package.json package-lock.json
git commit -m "chore: sync version with npm"
```

### Manual Beta Release (Emergency)
If automation fails:
```bash
# Increment beta manually
npm version prerelease --preid=beta
npm publish --tag beta
git push origin master --tags
```

## 📝 Release Notes

### v0.2.2 (Current Stable)
- Fixed release workflow issues
- Updated CLI version management
- Improved temp directory cleanup

### v0.2.1
- Fixed temp directory collision issues
- Added proper cleanup in tests

### v0.2.0
- Initial production release
- Complete TypeScript rewrite
- 474 comprehensive tests
- Full CI/CD pipeline

## 🔍 Post-Release Verification

After a production release:

1. **Verify npm**
   ```bash
   npm view claude-gwt version
   npm view claude-gwt@beta version  # Should be newer than stable
   ```

2. **Test installation**
   ```bash
   npm install -g claude-gwt@latest
   claude-gwt --version
   ```

3. **Check GitHub Release**
   - Visit: https://github.com/nazq/claude_gwt/releases
   - Ensure release notes were generated

## 🚨 Emergency Procedures

### Unpublishing
Within 24 hours:
```bash
npm unpublish claude-gwt@VERSION
```

After 24 hours:
```bash
npm deprecate claude-gwt@VERSION "Reason for deprecation"
```

### Reverting a Bad Release
```bash
# Publish previous version as latest
npm install claude-gwt@PREVIOUS_VERSION
cd node_modules/claude-gwt
npm publish
```

## 📋 Workflow Summary

1. **Development**: Work on feature branches
2. **Review**: Create PR to master
3. **Auto Beta**: Merge triggers automatic beta release
4. **Testing**: Community tests beta versions
5. **Production**: Manually release stable version when ready

This approach ensures:
- Every merge is immediately available for testing
- Production releases are deliberate and stable
- Version history is clean and traceable
- Users can choose stability (latest) or features (beta)