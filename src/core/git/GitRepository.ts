import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { GitOperationError } from '../errors/CustomErrors';

export class GitRepository {
  private git: SimpleGit;

  constructor(private readonly basePath: string) {
    this.git = simpleGit(basePath);
  }

  async initializeBareRepository(repoUrl?: string): Promise<{ defaultBranch: string }> {
    try {
      const bareDir = path.join(this.basePath, '.bare');
      await fs.mkdir(bareDir, { recursive: true });

      const bareGit = simpleGit(bareDir);
      let defaultBranch = 'main';

      if (repoUrl) {
        // Clone the bare repository
        await bareGit.clone(repoUrl, '.', ['--bare']);

        // Detect the default branch from remote HEAD
        try {
          const headRef = await bareGit.raw(['symbolic-ref', 'HEAD']);
          const match = headRef.match(/refs\/heads\/(.+)/);
          if (match?.[1]) {
            defaultBranch = match[1].trim();
          }
        } catch {
          // If we can't detect, we'll use 'main' or 'master'
          const branches = await bareGit.branch();
          if (branches.all.includes('master')) {
            defaultBranch = 'master';
          }
        }
      } else {
        await bareGit.init(['--bare']);
      }

      // Create .git file pointing to bare repo
      const gitFile = path.join(this.basePath, '.git');
      await fs.writeFile(gitFile, `gitdir: ./.bare\n`);

      // Update git instance to use the new setup
      this.git = simpleGit(this.basePath);

      // If initialized without a URL, create initial branch
      if (!repoUrl) {
        await this.git.init();
        await fs.writeFile(path.join(this.basePath, 'README.md'), '# Git Worktree Project\n');
        await this.git.add('README.md');
        await this.git.commit('Initial commit');
      }

      return { defaultBranch };
    } catch (error) {
      throw new GitOperationError(
        `Failed to initialize bare repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initializeBareRepository',
      );
    }
  }

  async getDefaultBranch(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length > 0) {
        const result = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
        const match = result.match(/refs\/remotes\/origin\/(.+)/);
        if (match?.[1]) {
          return match[1].trim();
        }
      }

      // Fallback to current branch
      const status = await this.git.status();
      return status.current || 'main';
    } catch {
      return 'main';
    }
  }

  async fetch(): Promise<void> {
    try {
      await this.git.fetch(['--all']);
    } catch (error) {
      throw new GitOperationError(
        `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'fetch',
      );
    }
  }

  async getCurrentBranch(): Promise<string> {
    return this.getDefaultBranch();
  }

  getBareGitPath(): string {
    return path.join(this.basePath, '.bare');
  }

  /**
   * Convert a regular git repository to worktree setup
   */
  async convertToWorktreeSetup(): Promise<{ defaultBranch: string; originalPath: string }> {
    try {
      // Get current branch and check for uncommitted changes
      const status = await this.git.status();
      if (!status.isClean()) {
        throw new GitOperationError(
          'Cannot convert: repository has uncommitted changes. Please commit or stash them first.',
          'convert',
        );
      }

      const currentBranch = status.current || 'main';

      // Get list of all branches (not used but good to verify they exist)
      await this.git.branch();

      // Create temporary directory for the conversion
      const tempDir = path.join(this.basePath, '..', `.claude-gwt-convert-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      // Create bare repository
      const bareDir = path.join(tempDir, '.bare');
      await fs.mkdir(bareDir);

      const bareGit = simpleGit(bareDir);
      await bareGit.init(['--bare']);

      // Add the original repo as a remote to the bare repo
      await bareGit.addRemote('origin', this.basePath);
      await bareGit.fetch('origin', ['+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*']);

      // Move the original .git directory to a backup
      const gitDir = path.join(this.basePath, '.git');
      const backupDir = path.join(this.basePath, '.git.backup');

      // Check if it's a regular .git directory (not a worktree)
      const gitStat = await fs.stat(gitDir);
      if (!gitStat.isDirectory()) {
        throw new GitOperationError('This appears to already be a worktree repository', 'convert');
      }

      // Move .git to backup
      await fs.rename(gitDir, backupDir);

      // Create .git file pointing to bare repo
      const gitFile = path.join(this.basePath, '.git');
      await fs.writeFile(gitFile, `gitdir: ${path.relative(this.basePath, bareDir)}\n`);

      // Add the original directory as a worktree
      const worktreeGit = simpleGit(bareDir);
      await worktreeGit.raw(['worktree', 'add', this.basePath, currentBranch]);

      // Move bare repo to proper location
      const finalBareDir = path.join(this.basePath, '.bare');
      await fs.rename(bareDir, finalBareDir);

      // Update .git file to point to new location
      await fs.writeFile(gitFile, `gitdir: ./.bare\n`);

      // Clean up temp directory
      await fs.rmdir(tempDir, { recursive: true });

      // Remove backup if everything succeeded
      await fs.rmdir(backupDir, { recursive: true });

      return { defaultBranch: currentBranch, originalPath: this.basePath };
    } catch (error) {
      throw new GitOperationError(
        `Failed to convert repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'convert',
      );
    }
  }

  /**
   * Check if current repository can be converted to worktree setup
   */
  async canConvertToWorktree(): Promise<{ canConvert: boolean; reason?: string }> {
    try {
      const gitDir = path.join(this.basePath, '.git');

      // Check if .git exists
      try {
        const stat = await fs.stat(gitDir);
        if (!stat.isDirectory()) {
          // It's a file, likely already a worktree
          const content = await fs.readFile(gitDir, 'utf-8');
          if (content.includes('gitdir:')) {
            return { canConvert: false, reason: 'Already a worktree repository' };
          }
        }
      } catch {
        return { canConvert: false, reason: 'No .git directory found' };
      }

      // Check for uncommitted changes
      const status = await this.git.status();
      if (!status.isClean()) {
        return { canConvert: false, reason: 'Repository has uncommitted changes' };
      }

      // Check for submodules (more complex to convert)
      try {
        const submodules = await this.git.subModule(['status']);
        if (submodules) {
          return { canConvert: false, reason: 'Repository contains submodules' };
        }
      } catch {
        // No submodules, which is good
      }

      return { canConvert: true };
    } catch (error) {
      return {
        canConvert: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
