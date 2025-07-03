# Improved UX for Directory Navigation

## Problem Solved
Users couldn't `cd` into branches while the CLI was running, making the tool frustrating to use.

## Solutions Implemented

### 1. Better Instructions
Instead of just showing `cd` commands, we now show the full workflow:
```
To enter the new branch, run:
    cd feature-auth && claude-gwt
```

### 2. Switch with Exit Option
When switching branches, users now get:
```
? Select branch to switch to: feature-payments

✓ To switch to feature-payments, run:

    cd feature-payments && claude-gwt

? Exit now to switch branches? (y/N)
```

If they choose yes, the app cleanly exits so they can run the command.

### 3. Clear Parent Directory Guidance
When in the parent directory:
```
⚠️  You are in the parent directory.
To work with Claude, either:
  • Create a new branch using the menu
  • Use "Switch to branch" to get the cd command
```

### 4. Consistent Messaging
All branch creation flows now show the same clear pattern:
- After cloning: `cd main && claude-gwt`
- After creating branch: `cd feature-x && claude-gwt`
- After switching: Shows command and offers to exit

## Bonus: Shell Alias
Users can set up a helpful alias:
```bash
cgwt() {
  if [ -z "$1" ]; then
    claude-gwt
  else
    cd "$1" && claude-gwt
  fi
}
```

Then simply: `cgwt feature-auth`

## Result
- No more confusion about how to navigate
- Clear, actionable instructions
- Option to exit when needed
- Better overall workflow