import path from 'path';
import { existsSync } from 'fs';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { GitWorktreeInfo } from '../../types';
import { GitOperationError } from '../errors/CustomErrors';

export class WorktreeManager {
  private git: SimpleGit;
  private bareGitPath: string;

  constructor(private readonly basePath: string) {
    // Check if .bare directory exists, use it for git operations
    this.bareGitPath = path.join(basePath, '.bare');
    const gitPath = this.isBareSetup() ? this.bareGitPath : basePath;
    this.git = simpleGit(gitPath);
  }

  private isBareSetup(): boolean {
    return existsSync(this.bareGitPath);
  }

  async listWorktrees(): Promise<GitWorktreeInfo[]> {
    try {
      const result = await this.git.raw(['worktree', 'list', '--porcelain']);
      const worktrees = this.parseWorktreeList(result);

      // Filter out the .bare directory - it's an implementation detail
      return worktrees.filter((wt) => !wt.path.endsWith('/.bare'));
    } catch (error) {
      throw new GitOperationError(
        `Failed to list worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'listWorktrees',
      );
    }
  }

  async addWorktree(branch: string, baseBranch?: string): Promise<string> {
    try {
      // Create worktrees inside the project directory
      const worktreePath = path.join(this.basePath, branch);
      const args = ['worktree', 'add'];

      if (baseBranch) {
        args.push('-b', branch, worktreePath, baseBranch);
      } else {
        // Check if branch exists locally or remotely
        const branches = await this.git.branch(['-a']);
        const localBranchExists = branches.all.includes(branch);
        const remoteBranchExists = branches.all.includes(`remotes/origin/${branch}`);

        if (localBranchExists) {
          // Branch exists locally, just create worktree
          args.push(worktreePath, branch);
        } else if (remoteBranchExists) {
          // Track the remote branch
          args.push('-b', branch, worktreePath, `origin/${branch}`);
        } else {
          // Create new branch
          args.push('-b', branch, worktreePath);
        }
      }

      await this.git.raw(args);
      return worktreePath;
    } catch (error) {
      throw new GitOperationError(
        `Failed to add worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'addWorktree',
      );
    }
  }

  async removeWorktree(branch: string, force = false): Promise<void> {
    try {
      // If branch is just a name, convert to full path
      const worktreePath = branch.startsWith('/') ? branch : path.join(this.basePath, branch);

      const args = ['worktree', 'remove', worktreePath];
      if (force) args.push('--force');

      await this.git.raw(args);
    } catch (error) {
      throw new GitOperationError(
        `Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'removeWorktree',
      );
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      await this.git.raw(['worktree', 'prune']);
    } catch (error) {
      throw new GitOperationError(
        `Failed to prune worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'pruneWorktrees',
      );
    }
  }

  private parseWorktreeList(output: string): GitWorktreeInfo[] {
    const worktrees: GitWorktreeInfo[] = [];
    const lines = output.split('\n').filter(Boolean);

    let currentWorktree: Partial<GitWorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as GitWorktreeInfo);
        }
        currentWorktree = {
          path: line.substring(9),
          isLocked: false,
          prunable: false,
        };
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.HEAD = line.substring(5);
      } else if (line.startsWith('branch ')) {
        let branch = line.substring(7);
        // Remove refs/heads/ prefix if present
        if (branch.startsWith('refs/heads/')) {
          branch = branch.substring(11);
        }
        currentWorktree.branch = branch;
      } else if (line === 'locked') {
        currentWorktree.isLocked = true;
      } else if (line === 'prunable') {
        currentWorktree.prunable = true;
      }
    }

    if (currentWorktree.path) {
      worktrees.push(currentWorktree as GitWorktreeInfo);
    }

    return worktrees;
  }
}
