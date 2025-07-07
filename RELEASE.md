# Release Process for Claude GWT

This document outlines the automated beta release and manual production release processes for claude-gwt.

## 🤖 Automated Beta Releases

**Every merge to master automatically creates a beta release!**

When a PR is merged to master:
1. The `auto-beta-publish` workflow triggers automatically
2. If changesets exist, they are consumed to determine version bump
3. Otherwise, a patch version is incremented
4. A timestamped beta version is created (e.g., `0.3.0-beta.1751891532`)
5. Package is published to npm with `beta` tag
6. GitHub pre-release is created
7. Users can install with: `npm install -g claude-gwt@beta`

### Beta Version Format
- Format: `<version>-beta.<timestamp>`
- Example: `0.3.0-beta.1751891532`
- Timestamp ensures unique versions for every merge

## 🚀 Production Releases

Production releases are **manually triggered** when you decide betas are stable.

### Release Types

- **Patch Release** (0.2.2 → 0.2.3): Bug fixes and minor updates
- **Minor Release** (0.2.3 → 0.3.0): New features, no breaking changes
- **Major Release** (0.2.3 → 1.0.0): Breaking changes or major milestones

### Pre-Release Checklist

1. **Review beta feedback**
   ```bash
   # Check latest beta version
   npm view claude-gwt@beta version
   
   # Clear npm cache if needed
   npm cache clean --force
   
   # Test the latest beta
   npm install -g claude-gwt@beta --force
   claude-gwt --version
   ```

2. **Ensure clean state**
   ```bash
   git status  # Should be clean
   git pull origin master
   ```

3. **All tests passing locally**
   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm test
   ```

### Creating a Production Release

Use the release script:
```bash
npm run release:prod
```

Or run directly:
```bash
./scripts/release-prod.sh
```

The script will:
1. Prompt you to select release type (patch/minor/major)
2. Trigger the "Create Release PR" workflow
3. Create a changeset with your selected version bump
4. Generate a "Version Packages" PR

### After PR Creation

1. **Review the Version PR**
   - Check CHANGELOG.md for accuracy
   - Verify version bump is correct
   - Ensure all changes are documented

2. **Merge the PR**
   - This triggers the `publish-production` workflow
   - Publishes to npm with `latest` tag
   - Creates GitHub release

## 📊 Version Management

### Current Flow
```
Development → PR → Merge to master → Auto Beta → Manual Prod Release
     ↓          ↓         ↓                ↓              ↓
  Feature    Review   0.3.0-beta.123   0.3.0-beta.124   0.3.0
```

### Checking Versions
```bash
# Current package version
cat package.json | grep '"version"'

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

### Beta Not Installing Latest Version
If `npm install -g claude-gwt@beta` installs an old version:
```bash
# Clear npm cache
npm cache clean --force

# Uninstall all versions
npm uninstall -g claude-gwt

# Install specific version
npm install -g claude-gwt@0.3.0-beta.1751891532

# Or force reinstall
npm install -g claude-gwt@beta --force
```

### Beta Not Publishing
If auto-beta fails:
1. Check GitHub Actions: https://github.com/nazq/claude_gwt/actions
2. Ensure NPM_TOKEN secret is set
3. Check for `[skip ci]` in commit message
4. Verify GITHUB_TOKEN is available in workflow

### Version PR Not Created
If the Create Release PR workflow fails:
1. Check GitHub Actions permissions are enabled
2. Ensure "Allow GitHub Actions to create and approve pull requests" is checked
3. Verify changeset configuration is valid

### Manual Changeset Creation
If you need to create a changeset manually:
```bash
# For regular changes during development
npm run changeset

# This will prompt you to:
# 1. Select changed packages (claude-gwt)
# 2. Select version bump type
# 3. Enter a description
```

## 📝 Workflow Configuration

### Key Workflows

1. **auto-beta-publish.yml**
   - Triggers: Push to master
   - Creates timestamped beta versions
   - Publishes to npm with beta tag

2. **create-release-pr.yml**
   - Triggers: Manual (workflow_dispatch)
   - Creates changeset based on release_type
   - Opens Version Packages PR

3. **publish-production.yml**
   - Triggers: Push to master when package.json changes
   - Only runs for "chore: version packages" commits
   - Publishes to npm with latest tag

### Important Notes

- Beta releases are **automatic** on every merge
- Production releases require **manual triggering**
- Changesets determine version bumps
- All releases create GitHub releases
- npm tags: `beta` for pre-releases, `latest` for production

## 🚨 Emergency Procedures

### Unpublishing (within 72 hours)
```bash
npm unpublish claude-gwt@VERSION
```

### Deprecating a Version
```bash
npm deprecate claude-gwt@VERSION "Security issue - please upgrade"
```

### Publishing Hotfix
1. Create changeset with fix
2. Run production release process
3. Communicate to users

## 📋 Release Checklist

- [ ] All tests passing locally
- [ ] Beta version tested in real projects
- [ ] No critical issues reported
- [ ] CHANGELOG.md is accurate
- [ ] Version bump is appropriate
- [ ] Documentation updated if needed

## 🔍 Post-Release Verification

After a production release:

1. **Verify npm**
   ```bash
   npm view claude-gwt version        # Should show new version
   npm view claude-gwt@beta version    # Beta should be newer
   ```

2. **Test installation**
   ```bash
   npm install -g claude-gwt@latest
   claude-gwt --version
   ```

3. **Check GitHub Release**
   - Visit: https://github.com/nazq/claude_gwt/releases
   - Ensure release notes were generated

4. **Monitor for issues**
   - Watch GitHub issues
   - Check npm downloads

## Summary

- **Betas**: Automatic on every master merge, timestamped versions
- **Production**: Manual via `npm run release:prod`, creates Version PR
- **Changesets**: Drive all version bumps and changelog generation
- **npm tags**: `beta` for pre-releases, `latest` for stable