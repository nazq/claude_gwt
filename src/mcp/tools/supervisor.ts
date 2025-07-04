import { WorktreeManager } from '../../core/git/WorktreeManager';
// import { MessageBus } from '../../sessions/MessageBus.js';
import path from 'path';

export const supervisorModeTool = {
  definition: {
    name: 'supervisor_mode',
    description: 'Enter supervisor mode to coordinate work across all branches',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['enter', 'status', 'exit'],
          description: 'Supervisor mode action',
          default: 'enter',
        },
      },
    },
  },

  handler: async (args: { action?: string }) => {
    const action = args.action || 'enter';

    try {
      const manager = new WorktreeManager(process.cwd());
      const worktrees = await manager.listWorktrees();

      if (worktrees.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ No branches found. Create branches first using `create_branch`.',
            },
          ],
        };
      }

      switch (action) {
        case 'enter': {
          // Initialize Phoenix mode
          // Note: MessageBus would be used for inter-instance communication
          // const messageBus = new MessageBus(process.cwd(), 'supervisor');

          const branchSummary = worktrees.map((wt) => `  • ${wt.branch}`).join('\n');

          return {
            content: [
              {
                type: 'text',
                text:
                  `🚁 Phoenix Supervisor Mode Activated!\n\n` +
                  `I can now coordinate work across ${worktrees.length} branches:\n${branchSummary}\n\n` +
                  `Available commands:\n` +
                  `• Assign tasks to branches\n` +
                  `• Monitor progress across branches\n` +
                  `• Coordinate feature integration\n` +
                  `• Resolve cross-branch dependencies\n\n` +
                  `What would you like me to help coordinate?`,
              },
            ],
          };
        }

        case 'status': {
          // Get status of all branches
          const statusReport = await Promise.all(
            worktrees.map(async (wt) => {
              const taskFile = path.join(wt.path, 'TASK.md');
              let taskStatus = 'No task assigned';

              try {
                const { promises: fs } = await import('fs');
                const content = await fs.readFile(taskFile, 'utf-8');
                const firstLine = content.split('\n')[0];
                if (firstLine) {
                  taskStatus = firstLine.replace(/^#\s*/, '');
                }
              } catch {
                // No task file
              }

              return `• ${wt.branch}: ${taskStatus}`;
            }),
          );

          return {
            content: [
              {
                type: 'text',
                text: `📊 Phoenix Status Report\n\n${statusReport.join('\n')}`,
              },
            ],
          };
        }

        case 'exit': {
          return {
            content: [
              {
                type: 'text',
                text: '👋 Exiting Phoenix supervisor mode.',
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `❌ Unknown action: ${action}. Use 'enter', 'status', or 'exit'.`,
              },
            ],
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Phoenix mode error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
};
