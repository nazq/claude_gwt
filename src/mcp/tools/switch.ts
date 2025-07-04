import { WorktreeManager } from '../../core/git/WorktreeManager';
import path from 'path';
import { promises as fs } from 'fs';

export const switchBranchTool = {
  definition: {
    name: 'switch_branch',
    description: 'Switch to a different Git worktree branch',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'The branch name to switch to',
        },
      },
      required: ['branch'],
    },
  },

  handler: async (args: { branch: string }) => {
    try {
      const manager = new WorktreeManager(process.cwd());
      const worktrees = await manager.listWorktrees();

      const targetWorktree = worktrees.find((wt) => wt.branch === args.branch);

      if (!targetWorktree) {
        const availableBranches = worktrees.map((wt) => wt.branch).join(', ');
        return {
          content: [
            {
              type: 'text',
              text: `❌ Branch '${args.branch}' not found.\n\nAvailable branches: ${availableBranches}`,
            },
          ],
        };
      }

      // Save current context
      const currentBranch = path.basename(process.cwd());
      const contextDir = path.join(process.cwd(), '..', '.claude-gwt', 'context');
      await fs.mkdir(contextDir, { recursive: true });

      const contextFile = path.join(contextDir, `${currentBranch}.json`);
      const context = {
        branch: currentBranch,
        timestamp: new Date().toISOString(),
        lastCommand: 'switch_branch',
      };
      await fs.writeFile(contextFile, JSON.stringify(context, null, 2));

      // Return switch information
      return {
        content: [
          {
            type: 'text',
            text:
              `✅ Switched to branch: ${args.branch}\n\n` +
              `📁 Working directory: ${targetWorktree.path}\n\n` +
              `To change your terminal directory, run:\n` +
              `cd ${targetWorktree.path}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error switching branches: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
};
