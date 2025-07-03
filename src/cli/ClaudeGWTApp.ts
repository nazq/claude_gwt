import path from 'path';
import { promises as fs } from 'fs';
import { GitDetector } from '../core/git/GitDetector';
import { GitRepository } from '../core/git/GitRepository';
import { WorktreeManager } from '../core/git/WorktreeManager';
import { ClaudeOrchestrator } from '../core/ClaudeOrchestrator';
import { SessionManager } from '../core/claude/SessionManager';
import { showBanner } from './ui/banner';
import { theme } from './ui/theme';
import { Spinner } from './ui/spinner';
import * as prompts from './ui/prompts';
import type { CLIOptions, DirectoryState } from '../types';

export class ClaudeGWTApp {
  private basePath: string;
  private options: CLIOptions;
  private orchestrator: ClaudeOrchestrator | null = null;
  private sessionManager: SessionManager;
  
  constructor(basePath: string, options: CLIOptions) {
    this.basePath = path.resolve(basePath);
    this.options = options;
    this.sessionManager = new SessionManager();
  }
  
  async run(): Promise<void> {
    try {
      if (!this.options.quiet) {
        showBanner();
      }
      
      const detector = new GitDetector(this.basePath);
      const state = await detector.detectState();
      
      await this.handleDirectoryState(state);
    } catch (error) {
      console.error(theme.error('\n✖ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
  
  private async handleDirectoryState(state: DirectoryState): Promise<void> {
    switch (state.type) {
      case 'empty':
        await this.handleEmptyDirectory();
        break;
      case 'claude-gwt-parent':
        await this.handleGitWorktree(); // Same handling as git-worktree
        break;
      case 'git-worktree':
        await this.handleGitWorktree();
        break;
      case 'git-repo':
        await this.handleGitRepository();
        break;
      case 'non-git':
        this.handleNonGitDirectory();
        break;
    }
  }
  
  private async handleEmptyDirectory(): Promise<void> {
    console.log(theme.info('\n📂 Empty directory detected'));
    console.log(theme.muted(`Path: ${this.basePath}`));
    
    let repoUrl = this.options.repo;
    if (!repoUrl && this.options.interactive !== false) {
      console.log(theme.primary('\n🚀 Let\'s set up your Git branch environment!'));
      repoUrl = await prompts.promptForRepoUrl();
    }
    
    if (!repoUrl && this.options.interactive !== false) {
      // User pressed enter without URL - create local repo
      console.log(theme.info('\nCreating new local repository...'));
    }
    
    const spinner = new Spinner('Initializing Git repository...');
    spinner.start();
    
    try {
      const repo = new GitRepository(this.basePath);
      
      if (repoUrl) {
        spinner.setText('Cloning repository...');
      }
      
      const { defaultBranch } = await repo.initializeBareRepository(repoUrl);
      
      if (repoUrl) {
        spinner.setText('Fetching repository...');
        await repo.fetch();
        spinner.succeed('Repository cloned successfully!');
        
        // Automatically create the main branch
        console.log(theme.info(`\nCreating default branch: ${theme.branch(defaultBranch)}`));
        
        const worktreeManager = new WorktreeManager(this.basePath);
        const worktreeSpinner = new Spinner(`Creating ${defaultBranch} branch...`);
        worktreeSpinner.start();
        
        try {
          const worktreePath = await worktreeManager.addWorktree(defaultBranch);
          worktreeSpinner.succeed(`Branch created at ${theme.info(worktreePath)}`);
          
          console.log(theme.success('\n🎉 Repository ready!'));
          console.log(theme.primary(`\n${theme.branch(defaultBranch)} branch created.`));
          console.log(theme.info(`\nYou can now:`));
          console.log(theme.muted(`  • Create additional branches`));
          console.log(theme.muted(`  • Switch to a branch to start working with Claude`));
        } catch (error) {
          worktreeSpinner.fail('Failed to create branch');
          throw error;
        }
      } else {
        spinner.succeed('Local repository initialized!');
      }
      
      // Now handle as a git worktree
      await this.handleGitWorktree();
    } catch (error) {
      spinner.fail('Failed to initialize repository');
      throw error;
    }
  }
  
  private async handleGitWorktree(): Promise<void> {
    console.log(theme.success('\n✨ Git branch environment ready'));
    
    const worktreeManager = new WorktreeManager(this.basePath);
    let worktrees = await worktreeManager.listWorktrees();
    
    // If no worktrees exist (just initialized), create the first one
    if (worktrees.length === 0) {
      console.log(theme.warning('\nNo branches found. Let\'s create your first branch.'));
      
      const repo = new GitRepository(this.basePath);
      const defaultBranch = await repo.getDefaultBranch();
      
      const branchName = await prompts.promptForBranchName(defaultBranch);
      const spinner = new Spinner(`Creating branch ${theme.branch(branchName)}...`);
      spinner.start();
      
      try {
        const worktreePath = await worktreeManager.addWorktree(branchName, defaultBranch);
        spinner.succeed(`Branch created at ${theme.info(worktreePath)}`);
        
        console.log(theme.success('\n🎉 Your first branch is ready!'));
        console.log(theme.info(`\nCreate more branches or switch to ${theme.branch(branchName)} to start working.`));
        
        // Refresh worktrees list
        worktrees = await worktreeManager.listWorktrees();
      } catch (error) {
        spinner.fail('Failed to create branch');
        throw error;
      }
    }
    
    // Find current worktree
    const currentWorktree = worktrees.find(wt => wt.path === this.basePath);
    const isInWorktree = currentWorktree !== undefined;
    
    if (currentWorktree) {
      console.log(theme.primary(`\n📍 Current branch: ${theme.branch(currentWorktree.branch || 'detached')}`));
    } else {
      console.log(theme.warning(`\n⚠️  You are in the parent directory.`));
      console.log(theme.info(`To work with Claude, either:`));
      console.log(theme.muted(`  • Create a new branch using the menu`));
      console.log(theme.muted(`  • Use "Switch to branch" to get the cd command`));
    }
    
    if (worktrees.length > 0) {
      console.log(theme.info(`\n${theme.icons.branch} Active branches (${worktrees.length}):`));
      
      for (const wt of worktrees) {
        const isCurrent = wt.path === this.basePath;
        const status = isCurrent ? theme.statusActive : theme.statusIdle;
        const marker = isCurrent ? ' ← current' : '';
        console.log(`  ${status} ${theme.branch(wt.branch || 'detached')} ${theme.dim(wt.path)}${theme.success(marker)}`);
      }
    }
    
    // Auto-start master Claude instance if we're in a worktree
    if (isInWorktree && !this.orchestrator) {
      console.log(theme.claude('\n🤖 Starting master Claude instance...'));
      const spinner = new Spinner('Initializing Claude orchestrator...');
      spinner.start();
      
      try {
        this.orchestrator = new ClaudeOrchestrator(this.basePath);
        await this.orchestrator.initialize();
        spinner.succeed('Master Claude instance ready!');
        
        // List current instances
        const { master, children } = await this.orchestrator.listInstances();
        if (master) {
          console.log(theme.claude(`\n🎯 Master: ${theme.branch(master.branch)}`));
        }
        if (children.length > 0) {
          console.log(theme.secondary('\n👶 Child instances:'));
          for (const child of children) {
            console.log(`  ${child.status === 'active' ? theme.statusActive : theme.statusIdle} ${theme.branch(child.branch)}`);
          }
        }
      } catch (error) {
        spinner.fail('Failed to start master Claude instance');
        console.error(theme.error('Error:'), error instanceof Error ? error.message : 'Unknown error');
        // Continue without orchestrator
      }
    }
    
    if (this.options.interactive !== false && worktrees.length > 0) {
      await this.interactiveWorktreeMenu(worktreeManager, worktrees, isInWorktree);
    }
  }
  
  private async handleGitRepository(): Promise<void> {
    console.log(theme.warning('\n⚠️  Regular Git repository detected'));
    console.log(theme.muted('This tool is designed for Git branch workflows.'));
    
    const convert = await prompts.confirmAction('Would you like to convert this to a branch-based repository?');
    
    if (convert) {
      const spinner = new Spinner('Converting to branch setup...');
      spinner.start();
      
      try {
        // Implementation for conversion would go here
        spinner.warn('Conversion not yet implemented');
      } catch (error) {
        spinner.fail('Failed to convert repository');
        throw error;
      }
    }
  }
  
  private async handleNonGitDirectory(): Promise<void> {
    console.log(theme.error('\n❌ Directory is not empty and not a Git repository'));
    
    if (this.options.interactive !== false) {
      const createSubdir = await prompts.confirmAction(
        'Would you like to clone a Git repository into a subdirectory?'
      );
      
      if (createSubdir) {
        // Ask for repo URL first
        const repoUrl = await prompts.promptForRepoUrl();
        
        if (!repoUrl) {
          console.log(theme.warning('\nNo repository URL provided.'));
          process.exit(1);
        }
        
        // Extract repo name from URL to suggest as folder name
        const defaultDirName = this.extractRepoNameFromUrl(repoUrl);
        const subdirName = await prompts.promptForSubdirectoryName(defaultDirName);
        const subdirPath = path.join(this.basePath, subdirName);
        
        // Check if subdirectory already exists
        try {
          await fs.access(subdirPath);
          console.log(theme.error(`\nDirectory '${subdirName}' already exists!`));
          process.exit(1);
        } catch {
          // Directory doesn't exist, we can create it
        }
        
        // Create subdirectory and run the app there with the repo URL
        await fs.mkdir(subdirPath, { recursive: true });
        console.log(theme.info(`\nCreated subdirectory: ${subdirPath}`));
        
        // Create new app instance for subdirectory with repo option
        const subApp = new ClaudeGWTApp(subdirPath, { ...this.options, repo: repoUrl });
        await subApp.run();
        return;
      }
    }
    
    console.log(theme.warning('\nTo use claude-gwt, you can:'));
    console.log(theme.info('  1. Run in an empty directory to create a new repository'));
    console.log(theme.info('  2. Run in an existing Git repository or branch'));
    console.log(theme.info('  3. Create a subdirectory: mkdir my-project && claude-gwt my-project'));
    console.log(theme.muted('\nExample: claude-gwt --repo https://github.com/user/repo.git'));
    process.exit(1);
  }
  
  private extractRepoNameFromUrl(url: string): string {
    // Handle various Git URL formats
    // https://github.com/user/repo.git -> repo
    // git@github.com:user/repo.git -> repo
    // https://gitlab.com/group/subgroup/repo -> repo
    
    // Remove trailing .git
    let cleanUrl = url.replace(/\.git$/, '');
    
    // Extract the last path segment
    const parts = cleanUrl.split(/[/:]/);
    const repoName = parts[parts.length - 1] || 'my-project';
    
    // Clean up any special characters
    return repoName.replace(/[^a-zA-Z0-9._-]/g, '-');
  }
  
  private async interactiveWorktreeMenu(
    worktreeManager: WorktreeManager,
    worktrees: any[],
    isInWorktree: boolean
  ): Promise<void> {
    while (true) {
      const action = await prompts.promptForWorktreeAction(worktrees, isInWorktree);
      
      switch (action) {
        case 'new':
          await this.createNewWorktree(worktreeManager);
          break;
        case 'list':
          await this.listBranches(worktrees);
          break;
        case 'switch':
          await this.switchWorktree(worktrees);
          break;
        case 'remove':
          await this.removeWorktree(worktreeManager, worktrees);
          break;
        case 'supervisor':
          await this.enterSupervisorMode();
          break;
        case 'claude':
          if (isInWorktree) {
            await this.claudeInstanceMenu();
          } else {
            console.log(theme.error('\n❌ You must be in a branch to manage Claude instances.'));
            console.log(theme.info('Please cd into one of the branches listed above.'));
          }
          break;
        case 'exit':
          console.log(theme.muted('\nGoodbye! 👋'));
          if (this.orchestrator) {
            await this.orchestrator.shutdown();
          }
          return;
      }
      
      // Refresh worktrees
      worktrees = await worktreeManager.listWorktrees();
    }
  }
  
  private async listBranches(worktrees: any[]): Promise<void> {
    console.log(theme.primary('\n📋 All branches:'));
    
    if (worktrees.length === 0) {
      console.log(theme.muted('  No branches found'));
      return;
    }
    
    const currentPath = this.basePath;
    
    for (const wt of worktrees) {
      const isCurrent = wt.path === currentPath;
      const status = isCurrent ? theme.statusActive : theme.statusIdle;
      const marker = isCurrent ? ' ← you are here' : '';
      const branchName = wt.branch || 'detached';
      
      console.log(`  ${status} ${theme.branch(branchName)} ${theme.dim(`(${path.basename(wt.path)})`)}${theme.success(marker)}`);
    }
    
    console.log(theme.muted(`\nTo switch: cd <branch-name>`));
  }
  
  private async createNewWorktree(worktreeManager: WorktreeManager): Promise<void> {
    const branchName = await prompts.promptForBranchName();
    
    const spinner = new Spinner(`Creating branch ${theme.branch(branchName)}...`);
    spinner.start();
    
    try {
      const worktreePath = await worktreeManager.addWorktree(branchName);
      spinner.succeed(`Branch created at ${theme.info(worktreePath)}`);
      
      // Auto-create Claude session for the new branch
      const claudeSpinner = new Spinner(`Starting Claude session for ${theme.branch(branchName)}...`);
      claudeSpinner.start();
      
      try {
        await this.sessionManager.createSession(branchName, worktreePath);
        claudeSpinner.succeed(`Claude session ready for ${theme.branch(branchName)}`);
        console.log(theme.claude('\n🤖 Claude is ready in the new branch!'));
      } catch (error) {
        claudeSpinner.fail('Failed to start Claude session');
        console.error(theme.error('Error:'), error instanceof Error ? error.message : 'Unknown error');
        // Continue without session
      }
      
      console.log(theme.success(`\n🎉 Branch ${theme.branch(branchName)} created!`));
      console.log(theme.info(`\nYou can create more branches or switch to this one to start working.`));
    } catch (error) {
      spinner.fail('Failed to create branch');
      throw error;
    }
  }
  
  private async switchWorktree(worktrees: any[]): Promise<void> {
    const selection = await prompts.selectWorktree(worktrees, 'Select branch to work in:');
    const selected = worktrees.find(wt => wt.branch === selection || wt.path === selection);
    
    if (selected) {
      console.log(theme.success(`\n${theme.icons.check} Switching to ${theme.branch(selected.branch || 'branch')}...`));
      
      // Launch our Claude wrapper in the selected branch directory
      await this.launchClaudeWrapper(selected.path, selected.branch || 'branch');
    }
  }
  
  private async removeWorktree(worktreeManager: WorktreeManager, worktrees: any[]): Promise<void> {
    const selection = await prompts.selectWorktree(
      worktrees.filter(wt => wt.path !== this.basePath),
      'Select branch to remove:'
    );
    
    const confirmed = await prompts.confirmAction(
      `Are you sure you want to remove branch '${theme.branch(selection)}'?`
    );
    
    if (confirmed) {
      // Check if there's a Claude instance for this branch
      if (this.orchestrator) {
        const { children } = await this.orchestrator.listInstances();
        const hasClaudeInstance = children.some(child => child.branch === selection);
        
        if (hasClaudeInstance) {
          const claudeSpinner = new Spinner(`Stopping Claude instance for ${theme.branch(selection)}...`);
          claudeSpinner.start();
          
          try {
            await this.orchestrator.removeChildForWorktree(selection, false);
            claudeSpinner.succeed('Claude instance stopped');
          } catch (error) {
            claudeSpinner.fail('Failed to stop Claude instance');
            // Continue with branch removal anyway
          }
        }
      }
      
      const spinner = new Spinner(`Removing branch ${theme.branch(selection)}...`);
      spinner.start();
      
      try {
        await worktreeManager.removeWorktree(selection);
        spinner.succeed('Branch removed successfully');
      } catch (error) {
        spinner.fail('Failed to remove branch');
        throw error;
      }
    }
  }
  
  private async claudeInstanceMenu(): Promise<void> {
    while (true) {
      const action = await prompts.promptForClaudeAction();
      
      switch (action) {
        case 'list':
          await this.listClaudeInstances();
          break;
        case 'stop-child':
          await this.stopChildInstance();
          break;
        case 'restart-master':
          await this.restartMasterInstance();
          break;
        case 'back':
          return;
      }
    }
  }
  
  private async stopChildInstance(): Promise<void> {
    if (!this.orchestrator) {
      console.log(theme.error('No orchestrator running'));
      return;
    }
    
    const { children } = await this.orchestrator.listInstances();
    
    if (children.length === 0) {
      console.log(theme.warning('No child instances running'));
      return;
    }
    
    const childBranches = children.map(child => ({
      path: child.worktreePath,
      branch: child.branch,
      isLocked: false,
      prunable: false,
      HEAD: '',
    }));
    
    const branch = await prompts.selectWorktree(
      childBranches,
      'Select child instance to stop:'
    );
    
    const removeBranch = await prompts.confirmAction(
      'Also remove the branch?'
    );
    
    const spinner = new Spinner(`Stopping child instance for ${theme.branch(branch)}...`);
    spinner.start();
    
    try {
      await this.orchestrator.removeChildForWorktree(branch, removeBranch);
      spinner.succeed('Child instance stopped');
    } catch (error) {
      spinner.fail('Failed to stop child instance');
      console.error(error);
    }
  }
  
  private async listClaudeInstances(): Promise<void> {
    if (!this.orchestrator) {
      console.log(theme.warning('No orchestrator running'));
      return;
    }
    
    const { master, children } = await this.orchestrator.listInstances();
    
    console.log(theme.primary('\n=== Claude Instances ==='));
    
    if (master) {
      console.log(theme.bold('\nMaster:'));
      console.log(`  ${master.status === 'active' ? theme.statusActive : theme.statusIdle} ${theme.branch(master.branch)} ${theme.dim(`(${master.id})`)}`);
    }
    
    if (children.length > 0) {
      console.log(theme.bold('\nChildren:'));
      for (const child of children) {
        console.log(`  ${child.status === 'active' ? theme.statusActive : theme.statusIdle} ${theme.branch(child.branch)} ${theme.dim(`(${child.id})`)}`);
      }
    } else {
      console.log(theme.muted('\nNo child instances'));
    }
  }
  
  private async restartMasterInstance(): Promise<void> {
    if (!this.orchestrator) {
      console.log(theme.warning('No master instance is running'));
      return;
    }
    
    console.log(theme.warning('\nRestarting master Claude instance...'));
    
    // First shutdown the orchestrator
    const shutdownSpinner = new Spinner('Shutting down current instance...');
    shutdownSpinner.start();
    
    try {
      await this.orchestrator.shutdown();
      shutdownSpinner.succeed('Instance shut down');
    } catch (error) {
      shutdownSpinner.fail('Failed to shutdown instance');
    }
    
    // Then start a new one
    const startSpinner = new Spinner('Starting new master instance...');
    startSpinner.start();
    
    try {
      this.orchestrator = new ClaudeOrchestrator(this.basePath);
      await this.orchestrator.initialize();
      startSpinner.succeed('Master Claude instance restarted successfully');
    } catch (error) {
      startSpinner.fail('Failed to restart master instance');
      console.error(error);
      this.orchestrator = null;
    }
  }
  
  private async enterSupervisorMode(): Promise<void> {
    console.clear();
    await this.launchClaudeWrapper(this.basePath, 'supervisor');
  }
  
  private async launchClaudeWrapper(worktreePath: string, branchName: string): Promise<void> {
    // Create or get session through manager
    const wrapper = await this.sessionManager.createSession(branchName, worktreePath);
    
    // Set up event handlers
    wrapper.on('exit', () => {
      console.log(theme.info('\nReturning to branch manager...'));
    });
    
    wrapper.on('request-exit', async () => {
      await this.sessionManager.closeSession(branchName);
    });
    
    wrapper.on('list-sessions', async () => {
      console.log(theme.primary('\n=== Claude Sessions ==='));
      
      // Get active sessions from manager
      const sessions = this.sessionManager.listSessions();
      
      // Always show supervisor first
      const isSupervisor = branchName === 'supervisor';
      const supervisorMarker = isSupervisor ? ' ← current' : '';
      const supervisorSession = sessions.find(s => s.branch === 'supervisor');
      const supervisorStatus = supervisorSession?.isActive ? '●' : '○';
      console.log(`  [0] ${supervisorStatus} ${theme.claude('supervisor')}${theme.success(supervisorMarker)}`);
      
      // Show other sessions
      const childSessions = sessions.filter(s => s.branch !== 'supervisor');
      childSessions.forEach((session, index) => {
        const isCurrent = session.branch === branchName && !isSupervisor;
        const marker = isCurrent ? ' ← current' : '';
        const status = session.isActive ? '●' : '○';
        console.log(`  [${index + 1}] ${status} ${theme.branch(session.branch)}${theme.success(marker)}`);
      });
      
      console.log('');
    });
    
    wrapper.on('select-session', async (selection: string) => {
      if (selection === 'supervisor' || selection === '0') {
        if (branchName === 'supervisor') {
          console.log(theme.info('Already in supervisor mode'));
          return;
        }
        console.log(theme.info('\nSwitching to supervisor mode...'));
        await wrapper.shutdown();
        await this.enterSupervisorMode();
        return;
      }
      
      // Try to parse as number first
      const sessionIndex = parseInt(selection, 10);
      let targetBranch: string | undefined;
      
      if (!isNaN(sessionIndex) && this.orchestrator) {
        const { children } = await this.orchestrator.listInstances();
        const child = children[sessionIndex - 1];
        if (child) {
          targetBranch = child.branch;
        }
      } else {
        // Treat as branch name
        targetBranch = selection;
      }
      
      if (targetBranch) {
        console.log(theme.info(`\nSwitching to ${theme.branch(targetBranch)}...`));
        await wrapper.shutdown();
        
        // Find the worktree path
        const worktreeManager = new WorktreeManager(this.basePath);
        const worktrees = await worktreeManager.listWorktrees();
        const target = worktrees.find(wt => wt.branch === targetBranch);
        
        if (target) {
          await this.launchClaudeWrapper(target.path, targetBranch);
        } else {
          console.log(theme.error(`Session/branch '${targetBranch}' not found`));
        }
      } else {
        console.log(theme.error(`Invalid selection: ${selection}`));
      }
    });
    
    wrapper.on('broadcast-message', async (message: string) => {
      console.log(theme.info(`\n📢 Broadcasting: ${message}`));
      await this.sessionManager.broadcastMessage(message, branchName);
      console.log(theme.success('Message broadcast to all sessions'));
    });
    
    await wrapper.start();
  }
}