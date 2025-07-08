/**
 * MCP Branch Operation Tools
 */

import { createNewWorktree, switchSession } from '../../cli/cgwt-program.js';
import { execCommandSafe } from '../../core/utils/async.js';
import { logger } from '../../core/utils/logger.js';
import type { BranchInfo, MCPToolDefinition, MCPToolResponse } from '../types/index.js';

export function branchTools(): MCPToolDefinition[] {
  return [
    {
      tool: {
        name: 'list_branches',
        description: 'List all branches in the current git repository',
        inputSchema: {
          type: 'object',
          properties: {
            remote: {
              type: 'boolean',
              description: 'Include remote branches',
              default: false,
            },
            all: {
              type: 'boolean',
              description: 'Include both local and remote branches',
              default: false,
            },
          },
        },
      },
      handler: async (args: {
        remote?: boolean;
        all?: boolean;
      }): Promise<MCPToolResponse<BranchInfo[]>> => {
        try {
          logger.info('MCP: Listing branches', args);

          const gitArgs = ['branch'];
          if (args.all) {
            gitArgs.push('-a');
          } else if (args.remote) {
            gitArgs.push('-r');
          }

          const result = await execCommandSafe('git', gitArgs);
          if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to list branches');
          }

          // Parse branch output
          const branches = result.stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const isActive = line.startsWith('*');
              const branchName = line.replace(/^\*?\s+/, '').trim();

              // Skip HEAD references
              if (branchName.includes('HEAD')) {
                return null;
              }

              return {
                name: branchName.replace('remotes/', ''),
                hasSession: false, // Would need to check tmux sessions
                isActive,
                worktreePath: undefined, // Would need to check worktrees
              } as BranchInfo;
            })
            .filter((branch) => branch !== null) as BranchInfo[];

          logger.info('MCP: Branches listed', { count: branches.length });
          return { success: true, data: branches };
        } catch (error) {
          logger.error('MCP: Failed to list branches', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list branches',
          };
        }
      },
    },
    {
      tool: {
        name: 'create_branch',
        description: 'Create a new branch with optional worktree',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the branch to create',
            },
            baseBranch: {
              type: 'string',
              description: 'Base branch to create from',
              default: 'HEAD',
            },
            withWorktree: {
              type: 'boolean',
              description: 'Also create a worktree for this branch',
              default: true,
            },
          },
          required: ['name'],
        },
      },
      handler: async (args: {
        name: string;
        baseBranch?: string;
        withWorktree?: boolean;
      }): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Creating branch', args);

          if (args.withWorktree !== false) {
            // Use createNewWorktree which handles both branch and worktree creation
            await createNewWorktree(args.name, true);
          } else {
            // Just create the branch without worktree
            const gitArgs = ['checkout', '-b', args.name];
            if (args.baseBranch && args.baseBranch !== 'HEAD') {
              gitArgs.push(args.baseBranch);
            }

            const result = await execCommandSafe('git', gitArgs);
            if (result.code !== 0) {
              throw new Error(result.stderr || 'Failed to create branch');
            }
          }

          return {
            success: true,
            data: {
              branch: args.name,
              worktree: args.withWorktree !== false,
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to create branch', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create branch',
          };
        }
      },
    },
    {
      tool: {
        name: 'switch_branch',
        description: 'Switch to a different branch/worktree',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Branch name or index to switch to',
            },
          },
          required: ['branch'],
        },
      },
      handler: async (args: { branch: string }): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Switching branch', args);

          // Use switchSession which handles both worktree and tmux session switching
          await switchSession(args.branch);

          return {
            success: true,
            data: { switched_to: args.branch },
          };
        } catch (error) {
          logger.error('MCP: Failed to switch branch', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to switch branch',
          };
        }
      },
    },
    {
      tool: {
        name: 'delete_branch',
        description: 'Delete a git branch',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Name of the branch to delete',
            },
            force: {
              type: 'boolean',
              description: 'Force delete even if not fully merged',
              default: false,
            },
            remote: {
              type: 'boolean',
              description: 'Also delete the remote branch',
              default: false,
            },
          },
          required: ['branch'],
        },
      },
      handler: async (args: {
        branch: string;
        force?: boolean;
        remote?: boolean;
      }): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Deleting branch', args);

          // Delete local branch
          const deleteFlag = args.force ? '-D' : '-d';
          const result = await execCommandSafe('git', ['branch', deleteFlag, args.branch]);

          if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to delete branch');
          }

          // Delete remote branch if requested
          if (args.remote) {
            const remoteResult = await execCommandSafe('git', [
              'push',
              'origin',
              '--delete',
              args.branch,
            ]);
            if (remoteResult.code !== 0) {
              logger.warn('Failed to delete remote branch', { error: remoteResult.stderr });
              // Don't fail the whole operation if remote delete fails
            }
          }

          return {
            success: true,
            data: {
              deleted: args.branch,
              remote: args.remote,
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to delete branch', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete branch',
          };
        }
      },
    },
  ];
}
