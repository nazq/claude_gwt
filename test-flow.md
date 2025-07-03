# Claude GWT Flow Examples

## New Flow: Non-empty Directory

1. **User runs in non-empty directory**
   ```
   ❌ Directory is not empty and not a Git repository
   ? Would you like to clone a Git repository into a subdirectory? Yes
   ```

2. **Ask for repo URL first**
   ```
   ? Git repository URL (leave empty for local init): git@gitlab.com:princetonequity/fdd-ingest.git
   ```

3. **Suggest folder name based on repo**
   ```
   ? Subdirectory name: (fdd-ingest) 
   ```

4. **Create and setup**
   ```
   Created subdirectory: /home/user/dev/fdd-ingest
   Cloning repository...
   ✔ Repository cloned successfully!
   
   Creating worktree for default branch: main
   ✔ Worktree created at /home/user/dev/fdd-ingest/main
   
   🎉 Ready to start coding!
   📁 Main worktree: cd fdd-ingest/main
   ```

## Flow: Empty Directory

```
📂 Empty directory detected
Path: /home/user/dev/my-project

🚀 Let's set up your Git worktree environment!
? Git repository URL (leave empty for local init): https://github.com/user/repo.git
```

## Key Improvements

1. **Repo URL first** - More logical flow
2. **Smart folder naming** - Extracts repo name from URL
3. **Better messaging** - Clear, encouraging prompts
4. **Auto-setup** - Creates main branch worktree automatically