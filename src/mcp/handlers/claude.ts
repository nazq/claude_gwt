/**
 * MCP Claude Control Tools
 */

import { launchClaude } from '../../cli/cgwt-program.js';
import { SplitCommand } from '../../cli/commands/SplitCommand.js';
import { TipsCommand } from '../../cli/commands/TipsCommand.js';
import { execCommandSafe } from '../../core/utils/async.js';
import { logger } from '../../core/utils/logger.js';
import type {
  LaunchClaudeArgs,
  MCPToolDefinition,
  MCPToolResponse,
  SplitPaneArgs,
} from '../types/index.js';

export function claudeTools(): MCPToolDefinition[] {
  return [
    {
      tool: {
        name: 'launch_claude',
        description:
          'Launch Claude Code in the current or specified worktree. Use this instead of "cgwt app launch" or "claude-gwt"',
        inputSchema: {
          type: 'object',
          properties: {
            supervisor: {
              type: 'boolean',
              description: 'Launch in supervisor mode',
              default: false,
            },
            branch: {
              type: 'string',
              description: 'Branch to launch Claude in (optional)',
            },
          },
        },
      },
      handler: async (args: LaunchClaudeArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Launching Claude', args);

          // If branch specified, switch to it first
          if (args.branch) {
            const { switchSession } = await import('../../cli/cgwt-program.js');
            await switchSession(args.branch);
          }

          // Launch Claude
          await launchClaude(args.supervisor || false);

          return {
            success: true,
            data: {
              launched: true,
              supervisor: args.supervisor || false,
              branch: args.branch || 'current',
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to launch Claude', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to launch Claude',
          };
        }
      },
    },
    {
      tool: {
        name: 'split_pane',
        description:
          'Split current tmux pane and launch another Claude GWT session. Use this instead of "tmux split-window" or "cgwt split"',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'Branch name or session index to launch in new pane',
            },
            horizontal: {
              type: 'boolean',
              description: 'Split horizontally (top/bottom) instead of vertically',
              default: false,
            },
            percentage: {
              type: 'number',
              description: 'Size percentage for new pane (1-99)',
              default: 50,
              minimum: 1,
              maximum: 99,
            },
          },
        },
      },
      handler: async (args: SplitPaneArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Splitting pane', args);

          // Validate we're in tmux
          if (!process.env['TMUX']) {
            return {
              success: false,
              error: 'Not in a tmux session. Split pane requires tmux.',
            };
          }

          const options = {
            horizontal: args.horizontal,
            vertical: !args.horizontal,
            percentage: args.percentage?.toString() || '50',
          };

          // Use the SplitCommand
          const { getSessionsQuietly } = await import('../../cli/cgwt-program.js');
          await SplitCommand.execute(args.target, options, getSessionsQuietly);

          return {
            success: true,
            data: {
              split: true,
              target: args.target || 'bash',
              direction: args.horizontal ? 'horizontal' : 'vertical',
              percentage: args.percentage || 50,
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to split pane', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to split pane',
          };
        }
      },
    },
    {
      tool: {
        name: 'sync_panes',
        description: 'Toggle synchronization of commands across all panes in current window',
        inputSchema: {
          type: 'object',
          properties: {
            enable: {
              type: 'boolean',
              description: 'Enable or disable pane synchronization',
            },
          },
        },
      },
      handler: async (args: { enable?: boolean }): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Toggling pane sync', args);

          if (!process.env['TMUX']) {
            return {
              success: false,
              error: 'Not in a tmux session',
            };
          }

          // Toggle or set synchronize-panes
          const value = args.enable === undefined ? '' : args.enable ? 'on' : 'off';
          const result = await execCommandSafe('tmux', [
            'set-window-option',
            'synchronize-panes',
            value,
          ]);

          if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to toggle pane sync');
          }

          return {
            success: true,
            data: {
              synchronized: args.enable !== false,
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to sync panes', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync panes',
          };
        }
      },
    },
    {
      tool: {
        name: 'get_current_session',
        description: 'Get information about the current Claude GWT session',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Getting current session info');

          const currentDir = process.cwd();
          const inTmux = !!process.env['TMUX'];
          let sessionName = null;
          let branch = 'unknown';

          // Get current branch
          const branchResult = await execCommandSafe('git', ['branch', '--show-current']);
          if (branchResult.code === 0) {
            branch = branchResult.stdout.trim();
          }

          // Get tmux session if in tmux
          if (inTmux) {
            const sessionResult = await execCommandSafe('tmux', ['display-message', '-p', '#S']);
            if (sessionResult.code === 0) {
              sessionName = sessionResult.stdout.trim();
            }
          }

          return {
            success: true,
            data: {
              directory: currentDir,
              branch,
              inTmux,
              sessionName,
            },
          };
        } catch (error) {
          logger.error('MCP: Failed to get current session', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get current session info',
          };
        }
      },
    },
    {
      tool: {
        name: 'show_tips',
        description: 'Display tmux keyboard shortcuts and tips',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: (): MCPToolResponse => {
        try {
          logger.info('MCP: Showing tips');

          // Capture the tips output
          const originalLog = console.log;
          let tipsOutput = '';
          console.log = (message: unknown) => {
            tipsOutput += message + '\n';
          };

          try {
            TipsCommand.execute();
          } finally {
            console.log = originalLog;
          }

          return {
            success: true,
            data: { tips: tipsOutput },
          };
        } catch (error) {
          logger.error('MCP: Failed to show tips', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to show tips',
          };
        }
      },
    },
  ];
}
