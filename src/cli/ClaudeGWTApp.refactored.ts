import path from 'path';
import type { CLIOptions, DirectoryState, GitWorktreeInfo } from '../types/index.js';
import type {
  IGitDetector,
  IGitRepository,
  IWorktreeManager,
  ITmuxManager,
  ILogger,
  IFileSystem,
  IPrompts,
  ISpinner,
  ITheme,
  IBanner,
  ISimpleGit,
} from './interfaces.js';

/**
 * Refactored ClaudeGWTApp with dependency injection for better testability
 */
export class ClaudeGWTAppRefactored {
  private basePath: string;
  private options: CLIOptions;

  constructor(
    basePath: string,
    options: CLIOptions,
    private deps: {
      gitDetector: IGitDetector;
      createGitRepository: (path: string) => IGitRepository;
      createWorktreeManager: (path: string) => IWorktreeManager;
      tmuxManager: ITmuxManager;
      logger: ILogger;
      theme: ITheme;
      prompts: IPrompts;
      createSpinner: (text: string) => ISpinner;
      showBanner: IBanner;
      fs: IFileSystem;
      createSimpleGit: (path: string) => ISimpleGit;
      processExit: (code: number) => never;
      consoleLog: (...args: unknown[]) => void;
      consoleError: (...args: unknown[]) => void;
    },
  ) {
    this.basePath = path.resolve(basePath);
    this.options = options;
  }

  async run(): Promise<void> {
    this.deps.logger.info('Starting ClaudeGWTApp', {
      basePath: this.basePath,
      options: this.options,
    });

    try {
      if (!this.options.quiet) {
        this.deps.showBanner();
      }

      const state = await this.deps.gitDetector.detectState(this.basePath);
      await this.handleDirectoryState(state);
    } catch (error) {
      this.deps.logger.error('Fatal error in ClaudeGWTApp', error);
      this.deps.consoleError(
        this.deps.theme.error('\n✖ Error:'),
        error instanceof Error ? error.message : 'Unknown error',
      );
      this.deps.consoleError(this.deps.theme.muted(`\nCheck logs at: .claude-gwt.log`));
      this.deps.processExit(1);
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
    this.deps.consoleLog(this.deps.theme.info('\n📂 Empty directory detected'));
    this.deps.consoleLog(this.deps.theme.muted(`Path: ${this.basePath}`));

    let repoUrl = this.options.repo;
    if (!repoUrl && this.options.interactive !== false) {
      this.deps.consoleLog(
        this.deps.theme.primary("\n🚀 Let's set up your Git branch environment!"),
      );
      repoUrl = await this.deps.prompts.promptForRepoUrl();
    }

    if (!repoUrl && this.options.interactive !== false) {
      // User pressed enter without URL - create local repo
      this.deps.consoleLog(this.deps.theme.info('\nCreating new local repository...'));
    }

    const spinner = this.deps.createSpinner('Initializing Git repository...');
    spinner.start();

    try {
      const repo = this.deps.createGitRepository(this.basePath);

      if (repoUrl) {
        spinner.setText('Cloning repository...');
      }

      const { defaultBranch } = await repo.initializeBareRepository(repoUrl);

      if (repoUrl) {
        spinner.setText('Fetching repository...');
        await repo.fetch();
        spinner.succeed('Repository cloned successfully!');

        // Automatically create the main branch
        this.deps.consoleLog(
          this.deps.theme.info(
            `\nCreating default branch: ${this.deps.theme.branch(defaultBranch)}`,
          ),
        );

        const worktreeManager = this.deps.createWorktreeManager(this.basePath);
        const worktreeSpinner = this.deps.createSpinner(`Creating ${defaultBranch} branch...`);
        worktreeSpinner.start();

        try {
          const worktreePath = await worktreeManager.addWorktree(defaultBranch);
          worktreeSpinner.succeed(`Branch created at ${this.deps.theme.info(worktreePath)}`);

          this.deps.consoleLog(this.deps.theme.success('\n🎉 Repository ready!'));
          this.deps.consoleLog(
            this.deps.theme.primary(`\n${this.deps.theme.branch(defaultBranch)} branch created.`),
          );
          this.deps.consoleLog(this.deps.theme.info(`\nYou can now:`));
          this.deps.consoleLog(this.deps.theme.muted(`  • Create additional branches`));
          this.deps.consoleLog(
            this.deps.theme.muted(`  • Switch to a branch to start working with Claude`),
          );
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
    this.deps.consoleLog(this.deps.theme.success('\n✨ Git branch environment ready'));

    const worktreeManager = this.deps.createWorktreeManager(this.basePath);
    let worktrees = await worktreeManager.listWorktrees();

    // If no worktrees exist (just initialized), create the first one
    if (worktrees.length === 0 && this.options.interactive !== false) {
      this.deps.consoleLog(
        this.deps.theme.warning("\nNo branches found. Let's create your first branch."),
      );

      const repo = this.deps.createGitRepository(this.basePath);
      const defaultBranch = await repo.getDefaultBranch();

      const branchName = await this.deps.prompts.promptForBranchName(defaultBranch);
      const spinner = this.deps.createSpinner(
        `Creating branch ${this.deps.theme.branch(branchName)}...`,
      );
      spinner.start();

      try {
        const worktreePath = await worktreeManager.addWorktree(branchName, defaultBranch);
        spinner.succeed(`Branch created at ${this.deps.theme.info(worktreePath)}`);

        // Re-fetch worktrees
        worktrees = await worktreeManager.listWorktrees();
      } catch (error) {
        spinner.fail('Failed to create branch');
        throw error;
      }
    }

    await this.promptForAction(worktrees);
  }

  private async handleGitRepository(): Promise<void> {
    this.deps.consoleLog(this.deps.theme.warning('\n⚠️  Regular Git repository detected'));
    this.deps.consoleLog(
      this.deps.theme.muted(
        'This appears to be a standard Git repository, not using Git worktrees.',
      ),
    );

    if (this.options.interactive === false) {
      this.deps.consoleError(
        this.deps.theme.error(
          '\nError: Cannot proceed in non-interactive mode with a regular Git repository.',
        ),
      );
      this.deps.processExit(1);
    }

    const action = await this.deps.prompts.promptForGitRepoAction();

    switch (action) {
      case 'convert':
        await this.convertToWorktreeSetup();
        break;
      case 'continue':
        await this.handleGitWorktreeAnyway();
        break;
      case 'exit':
        this.deps.consoleLog(this.deps.theme.muted('\nExiting...'));
        this.deps.processExit(0);
    }
  }

  private async handleNonGitDirectory(): Promise<void> {
    this.deps.consoleLog(this.deps.theme.warning('\n⚠️  Non-Git directory detected'));
    this.deps.consoleLog(this.deps.theme.muted(`Path: ${this.basePath}`));

    if (this.options.interactive === false) {
      this.deps.consoleError(
        this.deps.theme.error(
          '\nError: This is not a Git repository. Initialize with --repo <url> or run in an existing repository.',
        ),
      );
      this.deps.processExit(1);
    }

    const shouldInit = await this.deps.prompts.promptToInitialize();

    if (shouldInit) {
      await this.handleEmptyDirectory();
    } else {
      this.deps.consoleLog(this.deps.theme.muted('\nExiting...'));
      this.deps.processExit(0);
    }
  }

  private async promptForAction(worktrees: GitWorktreeInfo[]): Promise<void> {
    const exitOnQuit = (): void => {
      this.deps.consoleLog(this.deps.theme.muted('\nExiting...'));
      this.deps.processExit(0);
    };

    // Check if we're running from inside a worktree
    const currentWorktree = worktrees.find(
      (w) => path.normalize(w.path) === path.normalize(this.basePath),
    );

    // Prepare repository name for display
    const repoName = path.basename(path.dirname(this.basePath));

    if (currentWorktree) {
      // We're inside a worktree
      this.deps.consoleLog(
        this.deps.theme.info(`\nCurrent branch: ${this.deps.theme.branch(currentWorktree.branch)}`),
      );

      const action = await this.deps.prompts.promptForWorktreeAction(
        worktrees,
        currentWorktree.branch,
      );

      switch (action.type) {
        case 'launch':
          await this.launchSession(currentWorktree.branch, repoName);
          break;
        case 'switch':
          if (action.branch) {
            await this.launchSession(action.branch, repoName);
          }
          break;
        case 'create':
          await this.createNewBranch(worktrees);
          break;
        case 'remove':
          if (action.branch) {
            await this.removeBranch(action.branch);
          }
          break;
        case 'quit':
          exitOnQuit();
      }
    } else {
      // We're in the parent directory
      const action = await this.deps.prompts.promptForParentAction(worktrees);

      switch (action.type) {
        case 'switch':
          if (action.branch) {
            await this.launchSession(action.branch, repoName);
          }
          break;
        case 'create':
          await this.createNewBranch(worktrees);
          break;
        case 'remove':
          if (action.branch) {
            await this.removeBranch(action.branch);
          }
          break;
        case 'quit':
          exitOnQuit();
      }
    }
  }

  private async launchSession(branchName: string, repoName: string): Promise<void> {
    const spinner = this.deps.createSpinner(
      `Launching Claude for ${this.deps.theme.branch(branchName)}...`,
    );
    spinner.start();

    try {
      const sessionName = this.deps.tmuxManager.getSessionName(repoName, branchName);
      const repo = this.deps.createGitRepository(this.basePath);
      const worktreeManager = this.deps.createWorktreeManager(this.basePath);
      const worktrees = await worktreeManager.listWorktrees();
      const worktree = worktrees.find((w) => w.branch === branchName);

      if (!worktree) {
        throw new Error(`Branch ${branchName} not found`);
      }

      await this.deps.tmuxManager.launchSession({
        sessionName,
        workingDirectory: worktree.path,
        branchName,
        role: 'child',
        gitRepo: repo,
      });

      spinner.succeed(`Claude launched for ${this.deps.theme.branch(branchName)}`);
    } catch (error) {
      spinner.fail('Failed to launch Claude');
      throw error;
    }
  }

  private async createNewBranch(existingWorktrees: GitWorktreeInfo[]): Promise<void> {
    const repo = this.deps.createGitRepository(this.basePath);
    const defaultBranch = await repo.getDefaultBranch();

    const branchName = await this.deps.prompts.promptForNewBranchName(existingWorktrees);
    const baseBranch = await this.deps.prompts.promptForBaseBranch(
      existingWorktrees,
      defaultBranch,
    );

    const spinner = this.deps.createSpinner(
      `Creating branch ${this.deps.theme.branch(branchName)}...`,
    );
    spinner.start();

    try {
      const worktreeManager = this.deps.createWorktreeManager(this.basePath);
      const worktreePath = await worktreeManager.addWorktree(branchName, baseBranch);
      spinner.succeed(`Branch created at ${this.deps.theme.info(worktreePath)}`);

      // Re-fetch worktrees and prompt again
      const worktrees = await worktreeManager.listWorktrees();
      await this.promptForAction(worktrees);
    } catch (error) {
      spinner.fail('Failed to create branch');
      throw error;
    }
  }

  private async removeBranch(branchName: string): Promise<void> {
    const spinner = this.deps.createSpinner(
      `Removing branch ${this.deps.theme.branch(branchName)}...`,
    );
    spinner.start();

    try {
      const worktreeManager = this.deps.createWorktreeManager(this.basePath);
      await worktreeManager.removeWorktree(branchName);
      spinner.succeed(`Branch ${this.deps.theme.branch(branchName)} removed`);

      // Re-fetch worktrees and prompt again
      const worktrees = await worktreeManager.listWorktrees();
      await this.promptForAction(worktrees);
    } catch (error) {
      spinner.fail('Failed to remove branch');
      throw error;
    }
  }

  private async convertToWorktreeSetup(): Promise<void> {
    const repo = this.deps.createGitRepository(this.basePath);

    // Check if we can convert
    const { canConvert, reason } = await repo.canConvertToWorktree();
    if (!canConvert) {
      this.deps.consoleError(this.deps.theme.error(`\nCannot convert: ${reason}`));
      this.deps.processExit(1);
    }

    // Warn user
    this.deps.consoleLog(
      this.deps.theme.warning('\n⚠️  This will restructure your repository to use Git worktrees.'),
    );
    this.deps.consoleLog(
      this.deps.theme.muted('Your current branch will be preserved as a worktree.'),
    );

    const confirmed = await this.deps.prompts.confirmAction('Do you want to continue?');
    if (!confirmed) {
      this.deps.consoleLog(this.deps.theme.muted('\nConversion cancelled.'));
      this.deps.processExit(0);
    }

    const spinner = this.deps.createSpinner('Converting repository to worktree setup...');
    spinner.start();

    try {
      const { defaultBranch, originalPath } = await repo.convertToWorktreeSetup();
      spinner.succeed('Repository converted successfully!');

      this.deps.consoleLog(this.deps.theme.success('\n✅ Conversion complete!'));
      this.deps.consoleLog(
        this.deps.theme.info(`Your ${this.deps.theme.branch(defaultBranch)} branch is now at:`),
      );
      this.deps.consoleLog(this.deps.theme.muted(`  ${originalPath}`));

      // Now handle as a git worktree
      await this.handleGitWorktree();
    } catch (error) {
      spinner.fail('Failed to convert repository');
      throw error;
    }
  }

  private async handleGitWorktreeAnyway(): Promise<void> {
    const git = this.deps.createSimpleGit(this.basePath);
    const status = await git.status();
    const currentBranch = status.current ?? 'main';
    const repoName = path.basename(this.basePath);

    this.deps.consoleLog(this.deps.theme.warning('\n⚠️  Proceeding with limited functionality'));
    this.deps.consoleLog(
      this.deps.theme.muted('Branch switching will affect the entire repository.'),
    );

    // For regular git repos, launch directly without worktree lookup
    const spinner = this.deps.createSpinner(
      `Launching Claude for ${this.deps.theme.branch(currentBranch)}...`,
    );
    spinner.start();

    try {
      const sessionName = this.deps.tmuxManager.getSessionName(repoName, currentBranch);
      const repo = this.deps.createGitRepository(this.basePath);

      await this.deps.tmuxManager.launchSession({
        sessionName,
        workingDirectory: this.basePath,
        branchName: currentBranch,
        role: 'supervisor',
        gitRepo: repo,
      });

      spinner.succeed(`Claude launched for ${this.deps.theme.branch(currentBranch)}`);
    } catch (error) {
      spinner.fail('Failed to launch Claude');
      throw error;
    }
  }
}
