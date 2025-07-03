import { promises as fs } from 'fs';
import path from 'path';
import type { DirectoryState } from '../../types';
import { simpleGit, type SimpleGit } from 'simple-git';

export class GitDetector {
  private git: SimpleGit;

  constructor(private readonly basePath: string) {
    this.git = simpleGit(basePath);
  }

  async detectState(): Promise<DirectoryState> {
    try {
      const isEmpty = await this.isDirectoryEmpty();
      if (isEmpty) {
        return { type: 'empty', path: this.basePath };
      }

      // Check for claude-gwt parent structure first
      const isClaudeGWTParent = await this.isClaudeGWTParent();
      if (isClaudeGWTParent) {
        return { type: 'claude-gwt-parent', path: this.basePath };
      }

      const isGit = await this.isGitRepository();
      if (!isGit) {
        return { type: 'non-git', path: this.basePath };
      }

      const gitInfo = await this.getGitInfo();
      
      if (gitInfo.isWorktree) {
        return {
          type: 'git-worktree',
          path: this.basePath,
          gitInfo,
        };
      }

      return {
        type: 'git-repo',
        path: this.basePath,
        gitInfo,
      };
    } catch (error) {
      throw new Error(`Failed to detect directory state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async isClaudeGWTParent(): Promise<boolean> {
    try {
      // Check for .bare directory
      const barePath = path.join(this.basePath, '.bare');
      const bareExists = await fs.stat(barePath).then(stat => stat.isDirectory()).catch(() => false);
      
      if (!bareExists) {
        return false;
      }
      
      // Check if .git file points to .bare
      const gitPath = path.join(this.basePath, '.git');
      try {
        const gitContent = await fs.readFile(gitPath, 'utf-8');
        if (!gitContent.includes('gitdir: ./.bare')) {
          return false;
        }
      } catch {
        return false;
      }
      
      // Check if .bare is a valid git directory
      const bareHEAD = path.join(barePath, 'HEAD');
      const headExists = await fs.access(bareHEAD).then(() => true).catch(() => false);
      
      return headExists;
    } catch {
      return false;
    }
  }

  private async isDirectoryEmpty(): Promise<boolean> {
    try {
      const files = await fs.readdir(this.basePath);
      return files.length === 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.mkdir(this.basePath, { recursive: true });
        return true;
      }
      throw error;
    }
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  private async getGitInfo(): Promise<{
    isWorktree: boolean;
    isBareRepo: boolean;
    branch?: string;
    remote?: string;
  }> {
    try {
      const gitDir = path.join(this.basePath, '.git');
      const gitDirStat = await fs.stat(gitDir).catch(() => null);
      
      let isWorktree = false;
      let isBareRepo = false;

      if (gitDirStat && !gitDirStat.isDirectory()) {
        const content = await fs.readFile(gitDir, 'utf-8');
        isWorktree = content.includes('gitdir:');
      }

      // Check for our bare repo setup
      const bareCheckPath = path.join(this.basePath, '.bare');
      try {
        const bareStat = await fs.stat(bareCheckPath);
        if (bareStat.isDirectory()) {
          // Verify it's actually a git bare repo
          const bareGitCheck = path.join(bareCheckPath, 'HEAD');
          try {
            await fs.access(bareGitCheck);
            isBareRepo = true;
          } catch {
            // .bare exists but not a git repo
          }
        }
      } catch {
        // Not a bare repo setup
      }

      const status = await this.git.status();
      const branch = status.current || undefined;
      
      const remotes = await this.git.getRemotes(true);
      const remote = remotes[0]?.refs?.fetch;

      return { isWorktree, isBareRepo, branch, remote };
    } catch (error) {
      throw new Error(`Failed to get git info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}