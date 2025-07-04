import { GitDetector } from '../../core/git/GitDetector';
import { GitRepository } from '../../core/git/GitRepository';
import { WorktreeManager } from '../../core/git/WorktreeManager';

export const createBranchTool = {
  definition: {
    name: 'create_branch',
    description: 'Create a new Git worktree branch',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'The name of the new branch',
        },
        baseBranch: {
          type: 'string',
          description: 'The base branch to create from (optional)',
        },
        setupWorktree: {
          type: 'boolean',
          description: 'Initialize worktree setup if not present',
          default: true,
        },
      },
      required: ['branch'],
    },
  },

  handler: async (args: { branch: string; baseBranch?: string; setupWorktree?: boolean }) => {
    try {
      const detector = new GitDetector(process.cwd());
      const state = await detector.detectState();

      // Handle non-worktree projects
      if (state.type !== 'claude-gwt-parent' && state.type !== 'git-worktree') {
        if (!args.setupWorktree) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Not a Git worktree project. Set setupWorktree: true to initialize.',
              },
            ],
          };
        }

        // Initialize worktree setup
        const repo = new GitRepository(process.cwd());
        await repo.initializeBareRepository();

        return {
          content: [
            {
              type: 'text',
              text: '✅ Initialized Git worktree setup. Please run the command again to create your branch.',
            },
          ],
        };
      }

      // Create the worktree
      const manager = new WorktreeManager(process.cwd());
      const worktreePath = await manager.addWorktree(args.branch, args.baseBranch);

      return {
        content: [
          {
            type: 'text',
            text:
              `✅ Created branch: ${args.branch}\n\n` +
              `📁 Location: ${worktreePath}\n\n` +
              `To switch to this branch, use:\n` +
              `switch_branch ${args.branch}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error creating branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
};
