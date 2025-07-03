# Claude GWT - Shell Alias Setup

To make branch switching easier, you can add this alias to your shell configuration:

## For Bash (~/.bashrc)
```bash
# Claude GWT branch switcher
cgwt() {
  if [ -z "$1" ]; then
    claude-gwt
  else
    # Switch to branch if it exists
    if [ -d "$1" ]; then
      cd "$1" && claude-gwt
    else
      echo "Branch directory '$1' not found"
    fi
  fi
}
```

## For Zsh (~/.zshrc)
```zsh
# Claude GWT branch switcher
cgwt() {
  if [ -z "$1" ]; then
    claude-gwt
  else
    # Switch to branch if it exists
    if [ -d "$1" ]; then
      cd "$1" && claude-gwt
    else
      echo "Branch directory '$1' not found"
    fi
  fi
}
```

## Usage
```bash
# Start claude-gwt in current directory
cgwt

# Switch to a branch directly
cgwt main
cgwt feature-auth

# From anywhere in your project
cd ~/dev/my-project
cgwt feature-payments
```

This makes it much easier to switch between branches without manually typing cd commands!