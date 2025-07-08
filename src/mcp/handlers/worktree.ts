/**
 * MCP Worktree Management Tools
 */

import path from 'path';
import { createNewWorktree, parseWorktreeOutput, switchSession } from '../../cli/cgwt-program.js';
import { GitDetector } from '../../core/git/GitDetector.js';
import { execCommandSafe } from '../../core/utils/async.js';
import { logger } from '../../core/utils/logger.js';
import type {
  CreateWorktreeArgs,
  ListWorktreesArgs,
  MCPToolDefinition,
  MCPToolResponse,
  SwitchWorktreeArgs,
  WorktreeInfo,
} from '../types/index.js';

export function worktreeTools(): MCPToolDefinition[] {
  return [
    {
      tool: {
        name: 'list_worktrees',
        description:
          'List all git worktrees in the current project. Use this instead of "git worktree list"',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['simple', 'detailed', 'json'],
              description: 'Output format for the worktree list',
              default: 'simple',
            },
          },
        },
      },
      handler: async (args: ListWorktreesArgs): Promise<MCPToolResponse<WorktreeInfo[]>> => {
        try {
          logger.info('MCP: Listing worktrees', { format: args.format });

          const result = await execCommandSafe('git', ['worktree', 'list', '--porcelain']);
          if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to list worktrees');
          }

          const sessions = parseWorktreeOutput(result.stdout);
          const worktrees: WorktreeInfo[] = sessions.map((session) => ({
            path: session.path,
            branch: session.branch?.replace('refs/heads/', '') || '',
            head: session.head || '',
            isSupervisor: session.isSupervisor,
            isActive: process.cwd() === session.path,
          }));

          logger.info('MCP: Worktrees listed', { count: worktrees.length });
          return { success: true, data: worktrees };
        } catch (error) {
          logger.error('MCP: Failed to list worktrees', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list worktrees',
          };
        }
      },
    },
    {
      tool: {
        name: 'create_worktree',
        description:
          'Create a new git worktree for a branch. Use this instead of "git worktree add"',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Name of the branch to create worktree for',
            },
            createBranch: {
              type: 'boolean',
              description: 'Create the branch if it does not exist',
              default: false,
            },
            baseBranch: {
              type: 'string',
              description: 'Base branch to create new branch from (if createBranch is true)',
              default: 'HEAD',
            },
          },
          required: ['branch'],
        },
      },
      handler: async (args: CreateWorktreeArgs): Promise<MCPToolResponse<{ path: string }>> => {
        try {
          logger.info('MCP: Creating worktree', args);

          // Validate we're in a git worktree setup
          const detector = new GitDetector(process.cwd());
          const state = await detector.detectState();

          if (state.type !== 'git-worktree' && state.type !== 'claude-gwt-parent') {
            return {
              success: false,
              error: 'Not in a Git worktree repository. Run "claude-gwt init" first.',
            };
          }

          // Use the existing createNewWorktree function
          await createNewWorktree(args.branch, args.createBranch || false);

          // Get the path of the newly created worktree
          const worktreePath = path.join(path.dirname(process.cwd()), args.branch);

          return {
            success: true,
            data: { path: worktreePath },
          };
        } catch (error) {
          logger.error('MCP: Failed to create worktree', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create worktree',
          };
        }
      },
    },
    {
      tool: {
        name: 'delete_worktree',
        description: 'Remove a git worktree. Use this instead of "git worktree remove"',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Name of the branch/worktree to remove',
            },
            force: {
              type: 'boolean',
              description: 'Force removal even if there are uncommitted changes',
              default: false,
            },
          },
          required: ['branch'],
        },
      },
      handler: async (args: { branch: string; force?: boolean }): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Deleting worktree', args);

          const detector = new GitDetector(process.cwd());
          const state = await detector.detectState();

          if (state.type !== 'git-worktree' && state.type !== 'claude-gwt-parent') {
            return {
              success: false,
              error: 'Not in a Git worktree repository',
            };
          }

          if (state.type === 'git-worktree') {
            // Find the parent directory
            const gitFile = await import('fs').then((fs) =>
              fs.promises.readFile('.git', 'utf-8').catch(() => ''),
            );
            if (gitFile.includes('gitdir:')) {
              const gitDirMatch = gitFile.match(/gitdir:\s*(.+)/);
              if (gitDirMatch?.[1]) {
                const gitDirPath = gitDirMatch[1].trim();
                // Just to validate we can find the parent
                path.dirname(path.dirname(path.resolve(gitDirPath)));
              }
            }
          }

          const forceFlag = args.force ? ['--force'] : [];

          await execCommandSafe('git', ['worktree', 'remove', ...forceFlag, args.branch]);

          return { success: true, data: { removed: args.branch } };
        } catch (error) {
          logger.error('MCP: Failed to delete worktree', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete worktree',
          };
        }
      },
    },
    {
      tool: {
        name: 'switch_worktree',
        description:
          'Switch to a different git worktree. Use this instead of "git checkout" or "git worktree"',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Branch name or index to switch to',
            },
          },
          required: ['target'],
        },
      },
      handler: async (args: SwitchWorktreeArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Switching worktree', args);

          // Use the existing switchSession function
          await switchSession(args.target);

          return {
            success: true,
            data: { switched_to: args.target },
          };
        } catch (error) {
          logger.error('MCP: Failed to switch worktree', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to switch worktree',
          };
        }
      },
    },
  ];
}
