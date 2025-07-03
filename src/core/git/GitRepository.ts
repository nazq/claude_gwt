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
        'initializeBareRepository'
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
        'fetch'
      );
    }
  }

  getBareGitPath(): string {
    return path.join(this.basePath, '.bare');
  }
}