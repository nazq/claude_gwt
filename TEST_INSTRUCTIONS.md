# Testing Claude GWT Locally

## Quick Test

The package `claude-gwt-1.0.0.tgz` has been created. You can now test it:

### Option 1: Install Globally

```bash
# From claude_gwt directory
npm install -g claude-gwt-1.0.0.tgz

# Test from anywhere
cd /home/nazq/dev/fdd-ingest
claude-gwt
```

### Option 2: Test in Isolation

```bash
# Run the test script
./test-local.sh

# This creates a test directory and installs claude-gwt there
```

### Option 3: Manual Test

```bash
# Create test directory
mkdir /tmp/test-claude-gwt
cd /tmp/test-claude-gwt

# Install the package
npm init -y
npm install /home/nazq/dev/claude_gwt/claude-gwt-1.0.0.tgz

# Run it
npx claude-gwt
```

## Expected Behavior

1. **In fdd-ingest directory**: Should recognize the existing `.bare` structure and show branch management menu with "Enter supervisor mode" option

2. **Supervisor Mode**: Will show an error if `claude` command is not installed, but will demonstrate the features in demo mode

3. **Branch Management**: All Git operations should work (create, list, remove branches)

## Testing Workflow

1. Test in existing project (fdd-ingest)
2. Test creating new project in empty directory
3. Test supervisor mode (with/without claude CLI)
4. Test branch switching and management

## Uninstall

```bash
# If installed globally
npm uninstall -g claude-gwt
```