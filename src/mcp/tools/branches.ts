import { GitDetector } from '../../core/git/GitDetector';
import { WorktreeManager } from '../../core/git/WorktreeManager';
import type { GitWorktreeInfo } from '../../types';

export const listBranchesTool = {
  definition: {
    name: 'list_branches',
    description: 'List all Git worktree branches in the current project',
    inputSchema: {
      type: 'object',
      properties: {
        showDetails: {
          type: 'boolean',
          description: 'Show detailed information about each branch',
          default: false,
        },
      },
    },
  },

  handler: async (args: { showDetails?: boolean }) => {
    try {
      const detector = new GitDetector(process.cwd());
      const state = await detector.detectState();

      if (state.type !== 'claude-gwt-parent' && state.type !== 'git-worktree') {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Not a Git worktree project. Use `create_branch` to set up worktrees.',
            },
          ],
        };
      }

      const manager = new WorktreeManager(process.cwd());
      const worktrees = await manager.listWorktrees();

      if (worktrees.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📭 No worktree branches found. Use `create_branch` to create your first branch.',
            },
          ],
        };
      }

      const formatWorktree = (wt: GitWorktreeInfo) => {
        const current = wt.path === process.cwd() ? ' ← current' : '';
        if (args.showDetails) {
          return `• ${wt.branch}${current}\n  Path: ${wt.path}\n  HEAD: ${wt.HEAD.substring(0, 8)}`;
        }
        return `• ${wt.branch}${current}`;
      };

      const branchList = worktrees.map(formatWorktree).join('\n');
      const header = `🌳 Git Worktree Branches (${worktrees.length}):\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: header + branchList,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error listing branches: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
};
