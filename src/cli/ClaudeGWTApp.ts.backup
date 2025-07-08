import path from 'path';
import { promises as fs } from 'fs';
import { simpleGit } from 'simple-git';
import { GitDetector } from '../core/git/GitDetector.js';
import { GitRepository } from '../core/git/GitRepository.js';
import { WorktreeManager } from '../core/git/WorktreeManager.js';
import { TmuxManager } from '../sessions/TmuxManager.js';
import { Logger } from '../core/utils/logger.js';
import { showBanner } from './ui/banner.js';
import { theme } from './ui/theme.js';
import { Spinner } from './ui/spinner.js';
import * as prompts from './ui/prompts.js';
import type { CLIOptions, DirectoryState, GitWorktreeInfo } from '../types/index.js';

export class ClaudeGWTApp {
  private basePath: string;
  private options: CLIOptions;

  constructor(basePath: string, options: CLIOptions) {
    this.basePath = path.resolve(basePath);
    this.options = options;
  }

  async run(): Promise<void> {
    Logger.info('Starting ClaudeGWTApp', { basePath: this.basePath, options: this.options });

    try {
      if (!this.options.quiet) {
        showBanner();
      }

      const detector = new GitDetector(this.basePath);
      const state = await detector.detectState();

      await this.handleDirectoryState(state);
    } catch (error) {
      Logger.error('Fatal error in ClaudeGWTApp', error);
      console.error(
        theme.error('\n✖ Error:'),
        error instanceof Error ? error.message : 'Unknown error',
      );
      console.error(theme.muted(`\nCheck logs at: .claude-gwt.log`));
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
        await this.handleNonGitDirectory();
        break;
    }
  }

  private async handleEmptyDirectory(): Promise<void> {
    console.log(theme.info('\n📂 Empty directory detected'));
    console.log(theme.muted(`Path: ${this.basePath}`));

    let repoUrl = this.options.repo;
    if (!repoUrl && this.options.interactive !== false) {
      console.log(theme.primary("\n🚀 Let's set up your Git branch environment!"));
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
    if (worktrees.length === 0 && this.options.interactive !== false) {
      console.log(theme.warning("\nNo branches found. Let's create your first branch."));

      const repo = new GitRepository(this.basePath);
      const defaultBranch = await repo.getDefaultBranch();

      const branchName = await prompts.promptForBranchName(defaultBranch);
      const spinner = new Spinner(`Creating branch ${theme.branch(branchName)}...`);
      spinner.start();

      try {
        const worktreePath = await worktreeManager.addWorktree(branchName, defaultBranch);
        spinner.succeed(`Branch created at ${theme.info(worktreePath)}`);

        console.log(theme.success('\n🎉 Your first branch is ready!'));
        console.log(
          theme.info(
            `\nCreate more branches or switch to ${theme.branch(branchName)} to start working.`,
          ),
        );

        // Refresh worktrees list
        worktrees = await worktreeManager.listWorktrees();
      } catch (error) {
        spinner.fail('Failed to create branch');
        throw error;
      }
    }

    // Find current worktree
    const currentWorktree = worktrees.find((wt) => wt.path === this.basePath);

    if (currentWorktree) {
      console.log(
        theme.primary(`\n📍 Current branch: ${theme.branch(currentWorktree.branch || 'detached')}`),
      );
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
        console.log(
          `  ${status} ${theme.branch(wt.branch || 'detached')} ${theme.dim(wt.path)}${theme.success(marker)}`,
        );
      }
    }

    if (this.options.interactive !== false && worktrees.length > 0) {
      await this.interactiveWorktreeMenu(worktreeManager, worktrees);
    } else if (this.options.interactive === false) {
      // In non-interactive mode, exit after showing status
      process.exit(0);
    }
  }

  private async handleGitRepository(): Promise<void> {
    console.log(theme.warning('\n⚠️  Regular Git repository detected'));
    console.log(
      theme.muted('Claude GWT works best with Git worktree setups for branch isolation.'),
    );

    const repo = new GitRepository(this.basePath);

    // Check if we can convert
    const { canConvert, reason } = await repo.canConvertToWorktree();

    if (!canConvert) {
      console.log(theme.error(`\n❌ Cannot convert to worktree setup: ${reason}`));
      console.log(theme.info('\nYou can still use claude-gwt with limitations:'));
      console.log(theme.muted('  • Branch switching will use regular git checkout'));
      console.log(theme.muted('  • No parallel branch sessions'));
      console.log(theme.muted('  • Context switching may be slower'));

      if (this.options.interactive !== false) {
        const proceed = await prompts.confirmAction(
          'Would you like to proceed with limited functionality?',
        );

        if (proceed) {
          await this.handleRegularGitMode();
        }
      }
      return;
    }

    const convert = await prompts.confirmAction(
      'Would you like to convert this to a worktree-based setup for better claude-gwt support?',
    );

    if (convert) {
      const spinner = new Spinner('Converting to worktree setup...');
      spinner.start();

      try {
        const { defaultBranch } = await repo.convertToWorktreeSetup();
        spinner.succeed('Successfully converted to worktree setup!');

        console.log(theme.success('\n✨ Repository converted successfully!'));
        console.log(theme.info(`Current branch: ${theme.branch(defaultBranch)}\n`));

        // Now handle as a worktree
        await this.handleGitWorktree();
      } catch (error) {
        spinner.fail('Failed to convert repository');
        console.log(theme.error('\n' + (error instanceof Error ? error.message : 'Unknown error')));
        console.log(theme.info('\nYour repository is unchanged. You can:'));
        console.log(theme.muted('  • Fix the issue and try again'));
        console.log(theme.muted('  • Use claude-gwt with limited functionality'));
        console.log(theme.muted('  • Manually set up worktrees'));
      }
    } else {
      console.log(theme.info('\nProceeding with limited functionality...'));
      await this.handleRegularGitMode();
    }
  }

  private async handleNonGitDirectory(): Promise<void> {
    console.log(theme.error('\n❌ Directory is not empty and not a Git repository'));

    if (this.options.interactive !== false) {
      const createSubdir = await prompts.confirmAction(
        'Would you like to clone a Git repository into a subdirectory?',
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
    console.log(
      theme.info('  3. Create a subdirectory: mkdir my-project && claude-gwt my-project'),
    );
    console.log(theme.muted('\nExample: claude-gwt --repo https://github.com/user/repo.git'));
    process.exit(1);
  }

  private extractRepoNameFromUrl(url: string): string {
    // Handle various Git URL formats
    // https://github.com/user/repo.git -> repo
    // git@github.com:user/repo.git -> repo
    // https://gitlab.com/group/subgroup/repo -> repo

    if (!url || url.trim() === '') {
      return 'my-project';
    }

    // Remove trailing .git
    const cleanUrl = url.replace(/\.git$/, '');

    // Extract the last path segment
    const parts = cleanUrl.split(/[/:]/);
    const repoName = parts[parts.length - 1] ?? 'my-project';

    // Clean up any special characters
    return repoName.replace(/[^a-zA-Z0-9._-]/g, '-') || 'my-project';
  }

  private getRepoNameFromPath(dirPath: string): string {
    // Extract repository name from directory path
    // /home/user/dev/my-repo -> my-repo
    const basename = path.basename(dirPath);

    // Clean up any special characters
    return basename.replace(/[^a-zA-Z0-9._-]/g, '-') || 'project';
  }

  private async interactiveWorktreeMenu(
    worktreeManager: WorktreeManager,
    worktrees: GitWorktreeInfo[],
  ): Promise<void> {
    let shouldContinue = true;
    while (shouldContinue) {
      // Check if there are any active sessions
      const sessions = await TmuxManager.listSessions();
      const hasSessions = sessions.length > 0;

      const action = await prompts.promptForWorktreeAction(worktrees, hasSessions);

      switch (action) {
        case 'new':
          await this.createNewWorktree(worktreeManager);
          break;
        case 'existing':
          await this.createWorktreeFromExistingBranch(worktreeManager);
          break;
        case 'list':
          this.listBranches(worktrees);
          break;
        case 'remove':
          await this.removeWorktree(worktreeManager, worktrees);
          break;
        case 'supervisor':
          await this.enterSupervisorMode();
          break;
        case 'shutdown':
          this.shutdownAllSessions();
          break;
        case 'exit':
          console.log(theme.muted('\nGoodbye! 👋'));
          shouldContinue = false;
          break;
      }

      // Refresh worktrees
      worktrees = await worktreeManager.listWorktrees();
    }
  }

  private listBranches(worktrees: GitWorktreeInfo[]): void {
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
      const branchName = wt.branch;

      console.log(
        `  ${status} ${theme.branch(branchName)} ${theme.dim(`(${path.basename(wt.path)})`)}${theme.success(marker)}`,
      );
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

      console.log(theme.success(`\n🎉 Branch ${theme.branch(branchName)} created!`));
      console.log(
        theme.info(`\nYou can create more branches or switch to this one to start working.`),
      );
    } catch (error) {
      spinner.fail('Failed to create branch');
      throw error;
    }
  }

  private async createWorktreeFromExistingBranch(worktreeManager: WorktreeManager): Promise<void> {
    // Get branches without worktrees
    const spinner = new Spinner('Fetching existing branches...');
    spinner.start();

    let branchesWithoutWorktrees: string[];
    try {
      branchesWithoutWorktrees = await worktreeManager.getBranchesWithoutWorktrees();
      spinner.stop();
    } catch (error) {
      spinner.fail('Failed to fetch branches');
      throw error;
    }

    // Let user select a branch
    const selectedBranch = await prompts.selectExistingBranch(branchesWithoutWorktrees);

    if (!selectedBranch) {
      return; // User cancelled or no branches available
    }

    // Create worktree for the selected branch
    const createSpinner = new Spinner(
      `Creating worktree for branch ${theme.branch(selectedBranch)}...`,
    );
    createSpinner.start();

    try {
      const worktreePath = await worktreeManager.addWorktree(selectedBranch);
      createSpinner.succeed(`Worktree created at ${theme.info(worktreePath)}`);

      console.log(
        theme.success(`\n🎉 Worktree for branch ${theme.branch(selectedBranch)} created!`),
      );
      console.log(theme.info(`\nYou can now switch to this branch to start working.`));
    } catch (error) {
      createSpinner.fail('Failed to create worktree');
      throw error;
    }
  }

  private async removeWorktree(
    worktreeManager: WorktreeManager,
    worktrees: GitWorktreeInfo[],
  ): Promise<void> {
    const selectedWorktree = await prompts.selectWorktree(
      worktrees.filter((wt) => wt.path !== this.basePath),
      'Select branch to remove:',
    );

    if (!selectedWorktree) {
      return;
    }

    const confirmed = await prompts.confirmAction(
      `Are you sure you want to remove branch '${theme.branch(selectedWorktree.branch)}'?`,
    );

    if (confirmed) {
      const spinner = new Spinner(`Removing branch ${theme.branch(selectedWorktree.branch)}...`);
      spinner.start();

      try {
        await worktreeManager.removeWorktree(selectedWorktree.branch);
        spinner.succeed('Branch removed successfully');
      } catch (error) {
        spinner.fail('Failed to remove branch');
        throw error;
      }
    }
  }

  private async enterSupervisorMode(): Promise<void> {
    Logger.info('Entering supervisor mode', { basePath: this.basePath });
    console.clear();

    // Find the parent directory if we're in a worktree
    let supervisorPath = this.basePath;

    try {
      // Check if we're in a worktree
      const detector = new GitDetector(this.basePath);
      const state = await detector.detectState();

      if (state.type === 'git-worktree') {
        // We're in a worktree, find the parent directory
        // The parent should be one level up from the worktree
        const parentPath = path.dirname(this.basePath);

        // Verify the parent is a claude-gwt parent directory
        const parentDetector = new GitDetector(parentPath);
        const parentState = await parentDetector.detectState();

        if (parentState.type === 'claude-gwt-parent') {
          supervisorPath = parentPath;
        }
      }
    } catch (error) {
      // If detection fails, continue with current path
      console.error(theme.warning('Warning: Could not detect parent directory'));
      Logger.error('Could not detect parent directory', error);
    }

    Logger.info('Launching supervisor session', { supervisorPath });

    // Check if we're already in tmux (entered supervisor from a Claude session)
    const isInTmux = TmuxManager.isInsideTmux();

    if (!isInTmux) {
      // Not in tmux, create all sessions then attach
      Logger.info('Creating supervisor and all branch sessions');

      // Create GitRepository for supervisor
      const gitRepo = new GitRepository(supervisorPath);

      // First create supervisor session in detached mode
      const repoName = this.getRepoNameFromPath(supervisorPath);
      const supervisorSessionName = TmuxManager.getSessionName(repoName, 'supervisor');
      await TmuxManager.createDetachedSession({
        sessionName: supervisorSessionName,
        workingDirectory: supervisorPath,
        branchName: 'supervisor',
        role: 'supervisor',
        gitRepo,
      });

      // Then launch all branch sessions
      await this.launchAllBranchSessions(supervisorPath);

      // Finally attach to supervisor
      void TmuxManager.attachToSession(supervisorSessionName);
    } else {
      // We're already in tmux, just switch to supervisor
      Logger.info('Switching to supervisor session from within tmux');
      await this.launchTmuxSession(supervisorPath, 'supervisor', true);
    }
  }

  private async launchAllBranchSessions(parentPath: string): Promise<void> {
    Logger.info('Launching Claude sessions for all branches');
    Logger.debug('launchAllBranchSessions called', { parentPath });

    try {
      // Get all worktrees
      Logger.debug('Creating WorktreeManager', { parentPath });
      const worktreeManager = new WorktreeManager(parentPath);

      Logger.debug('Calling listWorktrees');
      const worktrees = await worktreeManager.listWorktrees();

      Logger.info('All worktrees found', {
        count: worktrees.length,
        worktrees: worktrees.map((wt) => ({ path: wt.path, branch: wt.branch })),
      });

      // Sort worktrees by branch name for consistent ordering
      // In a proper worktree setup, the parent directory is never a worktree itself,
      // so we don't need to filter it out. All worktrees are subdirectories.
      Logger.debug('Sorting worktrees');
      const sortedWorktrees = worktrees.sort((a, b) =>
        (a.branch || '').localeCompare(b.branch || ''),
      );

      Logger.info('Sorted worktrees for session creation', {
        count: sortedWorktrees.length,
        worktrees: sortedWorktrees.map((wt) => ({ path: wt.path, branch: wt.branch })),
      });

      // Get repository name from parent path
      const repoName = this.getRepoNameFromPath(parentPath);
      Logger.debug('Repository name determined', { repoName, parentPath });

      // Launch Claude in each worktree in parallel
      Logger.debug('Starting parallel session creation', { worktreeCount: sortedWorktrees.length });

      const sessionCreationPromises = sortedWorktrees.map(async (worktree, index) => {
        if (!worktree) return; // Skip if undefined

        Logger.debug(`Processing worktree ${index + 1}/${sortedWorktrees.length}`, {
          branch: worktree.branch,
          path: worktree.path,
          index,
        });

        const sessionName = TmuxManager.getSessionName(repoName, worktree.branch || 'detached');
        Logger.debug('Generated session name', { sessionName, branch: worktree.branch });

        try {
          const sessionInfo = await TmuxManager.getSessionInfo(sessionName);
          Logger.debug('Session info retrieved', { sessionInfo, sessionName });

          if (!sessionInfo || !sessionInfo.hasClaudeRunning) {
            // Session doesn't exist or Claude isn't running
            Logger.info('Creating/restarting session for branch', {
              branch: worktree.branch,
              exists: !!sessionInfo,
              sessionName,
              hasClaudeRunning: sessionInfo?.hasClaudeRunning,
            });

            Logger.debug('Calling createDetachedSession', {
              sessionName,
              workingDirectory: worktree.path,
              branchName: worktree.branch,
            });

            // Create GitRepository for each worktree
            const worktreeGitRepo = new GitRepository(worktree.path);

            await TmuxManager.createDetachedSession({
              sessionName,
              workingDirectory: worktree.path,
              branchName: worktree.branch || 'detached',
              role: 'child',
              gitRepo: worktreeGitRepo,
            });

            Logger.debug('createDetachedSession returned', { sessionName });
          } else {
            Logger.info('Session already exists and has Claude running', {
              branch: worktree.branch,
              sessionName,
            });
          }
        } catch (error) {
          Logger.error(`Failed to create session for branch ${worktree.branch}`, error);
          // Continue with other sessions even if one fails
        }
      });

      // Wait for all sessions to be created
      await Promise.allSettled(sessionCreationPromises);

      Logger.info('Completed launching all branch sessions');
    } catch (error) {
      Logger.error('Failed to launch branch sessions', error);
      console.error(theme.warning('\nWarning: Could not launch all branch sessions'));
    }
  }

  private shutdownAllSessions(): void {
    const spinner = new Spinner('Shutting down all sessions...');
    spinner.start();

    try {
      void TmuxManager.shutdownAll();
      spinner.succeed('All sessions shut down successfully');
    } catch (error) {
      spinner.fail('Failed to shutdown some sessions');
      Logger.error('Error during shutdown', error);
    }
  }

  private async launchTmuxSession(
    worktreePath: string,
    branchName: string,
    isSupervisor: boolean = false,
  ): Promise<void> {
    Logger.info('launchTmuxSession called', { worktreePath, branchName, isSupervisor });
    // Check if tmux is available
    if (!(await TmuxManager.isTmuxAvailable())) {
      Logger.error('tmux not available');
      console.log(theme.error('\n❌ tmux is not installed'));
      console.log(theme.info('Claude GWT requires tmux. Please install it:'));
      console.log(theme.muted('  • macOS: brew install tmux'));
      console.log(theme.muted('  • Ubuntu/Debian: sudo apt-get install tmux'));
      console.log(theme.muted('  • Fedora/RHEL: sudo dnf install tmux'));
      return;
    }

    const repoName = this.getRepoNameFromPath(worktreePath);
    const sessionName = TmuxManager.getSessionName(repoName, branchName);
    Logger.info('Session name generated', { sessionName, repoName });

    try {
      // Create GitRepository for the session
      const gitRepo = new GitRepository(worktreePath);

      // Launch the tmux session with real Claude Code
      await TmuxManager.launchSession({
        sessionName,
        workingDirectory: worktreePath,
        branchName,
        role: isSupervisor ? 'supervisor' : 'child',
        gitRepo,
      });
      Logger.info('Tmux session launched successfully');
    } catch (error) {
      Logger.error('Failed to launch tmux session', error);
      console.error(theme.error('\n❌ Failed to launch session'));
      console.error(theme.muted(`Check logs at: ${Logger.getLogPath()}`));
      throw error;
    }
  }

  /**
   * Handle regular git repositories without worktree conversion
   */
  private async handleRegularGitMode(): Promise<void> {
    const repo = new GitRepository(this.basePath);
    const currentBranch = await repo.getCurrentBranch();

    console.log(theme.primary(`\n📍 Current branch: ${theme.branch(currentBranch)}`));
    console.log(theme.warning('\n⚠️  Running in limited mode (regular Git repository)'));

    // Get all branches
    const git = simpleGit(this.basePath);
    const branchInfo = await git.branch();
    const branches = branchInfo.all.filter((b) => !b.startsWith('remotes/'));

    console.log(theme.info(`\n${theme.icons.branch} Available branches (${branches.length}):`));
    branches.forEach((branch) => {
      const isCurrent = branch === currentBranch;
      const marker = isCurrent ? ' ← current' : '';
      const status = isCurrent ? theme.statusActive : theme.statusIdle;
      console.log(`  ${status} ${theme.branch(branch)}${theme.success(marker)}`);
    });

    if (this.options.interactive !== false) {
      const choices = [
        { title: 'Switch branch', value: 'switch' },
        { title: 'Create new branch', value: 'create' },
        { title: 'Enter supervisor mode', value: 'supervisor' },
        { title: 'Convert to worktree setup', value: 'convert' },
        { title: 'Exit', value: 'exit' },
      ];

      const action = await prompts.selectAction('What would you like to do?', choices);

      switch (action) {
        case 'switch':
          await this.switchBranchRegularMode(branches);
          break;
        case 'create':
          await this.createBranchRegularMode();
          break;
        case 'supervisor':
          await this.launchRegularGitSupervisor(currentBranch);
          break;
        case 'convert':
          // Re-run conversion
          await this.handleGitRepository();
          break;
        case 'exit':
          console.log(theme.muted('\nGoodbye!'));
          break;
      }
    }
  }

  private async switchBranchRegularMode(branches: string[]): Promise<void> {
    const targetBranch = await prompts.selectBranch('Select branch to switch to:', branches);

    if (!targetBranch || targetBranch === 'cancel') {
      return;
    }

    const spinner = new Spinner(`Switching to branch ${targetBranch}...`);
    spinner.start();

    try {
      const git = simpleGit(this.basePath);
      await git.checkout(targetBranch);
      spinner.succeed(`Switched to branch ${theme.branch(targetBranch)}`);

      // Launch supervisor if requested
      if (this.options.interactive !== false) {
        const launch = await prompts.confirmAction('Launch Claude in supervisor mode?');
        if (launch) {
          void this.launchRegularGitSupervisor(targetBranch);
        }
      }
    } catch (error) {
      spinner.fail('Failed to switch branch');
      console.error(theme.error(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async createBranchRegularMode(): Promise<void> {
    const branchName = await prompts.promptForBranchName();

    if (!branchName) {
      return;
    }

    const spinner = new Spinner(`Creating branch ${branchName}...`);
    spinner.start();

    try {
      const git = simpleGit(this.basePath);
      await git.checkoutLocalBranch(branchName);
      spinner.succeed(`Created and switched to branch ${theme.branch(branchName)}`);

      // Launch supervisor if requested
      if (this.options.interactive !== false) {
        const launch = await prompts.confirmAction('Launch Claude in supervisor mode?');
        if (launch) {
          void this.launchRegularGitSupervisor(branchName);
        }
      }
    } catch (error) {
      spinner.fail('Failed to create branch');
      console.error(theme.error(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async launchRegularGitSupervisor(branch: string): Promise<void> {
    const repoName = path.basename(this.basePath);

    console.log(theme.info('\n🚀 Launching Claude in supervisor mode...'));
    console.log(theme.warning('Note: Limited functionality in regular Git mode'));
    console.log(theme.muted('  • No parallel branch sessions'));
    console.log(theme.muted('  • Use git commands to switch branches'));

    // Create a simplified session for regular git repos
    const sessionConfig = {
      sessionName: TmuxManager.getSessionName(repoName, branch),
      workingDirectory: this.basePath,
      branchName: branch,
      role: 'supervisor' as const,
    };

    await TmuxManager.launchSession(sessionConfig);
  }
}
