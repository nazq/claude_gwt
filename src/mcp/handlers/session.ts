/**
 * MCP Session Management Tools
 */

import { attachToSession, killAllSessions } from '../../cli/cgwt-program.js';
import { execCommandSafe } from '../../core/utils/async.js';
import { logger } from '../../core/utils/logger.js';
import { TmuxManager } from '../../sessions/TmuxManager.js';
import type {
  AttachSessionArgs,
  CreateSessionArgs,
  KillSessionArgs,
  ListSessionsArgs,
  MCPToolDefinition,
  MCPToolResponse,
  ProjectInfo,
  SessionInfo,
} from '../types/index.js';

export function sessionTools(): MCPToolDefinition[] {
  return [
    {
      tool: {
        name: 'list_sessions',
        description: 'List all Claude GWT tmux sessions',
        inputSchema: {
          type: 'object',
          properties: {
            projectFilter: {
              type: 'string',
              description: 'Filter sessions by project name',
            },
            activeOnly: {
              type: 'boolean',
              description: 'Show only active sessions',
              default: false,
            },
          },
        },
      },
      handler: async (args: ListSessionsArgs): Promise<MCPToolResponse<SessionInfo[]>> => {
        try {
          logger.info('MCP: Listing sessions', args);

          // Get all tmux sessions
          const result = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);
          if (result.code !== 0) {
            return { success: true, data: [] }; // No sessions
          }

          const sessions = result.stdout
            .split('\n')
            .filter((s) => s.trim() && s.startsWith('cgwt-'));

          // Parse sessions into structured data
          const sessionInfos: SessionInfo[] = [];
          const currentSession = process.env['TMUX'] ? await getCurrentTmuxSession() : null;

          for (const sessionName of sessions) {
            const parsed = parseSessionName(sessionName);
            if (!parsed) continue;

            if (args.projectFilter && parsed.project !== args.projectFilter) {
              continue;
            }

            const isActive = sessionName === currentSession;
            if (args.activeOnly && !isActive) {
              continue;
            }

            sessionInfos.push({
              sessionName,
              projectName: parsed.project,
              branchName: parsed.branch,
              isActive,
              isSupervisor: parsed.branch === 'supervisor',
            });
          }

          return { success: true, data: sessionInfos };
        } catch (error) {
          logger.error('MCP: Failed to list sessions', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list sessions',
          };
        }
      },
    },
    {
      tool: {
        name: 'list_projects',
        description: 'List all projects with Claude GWT sessions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (): Promise<MCPToolResponse<ProjectInfo[]>> => {
        try {
          logger.info('MCP: Listing projects');

          // Get all sessions and group by project
          const result = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);
          if (result.code !== 0) {
            return { success: true, data: [] };
          }

          const sessions = result.stdout
            .split('\n')
            .filter((s) => s.trim() && s.startsWith('cgwt-'));

          const projectMap = new Map<string, ProjectInfo>();

          for (const sessionName of sessions) {
            const parsed = parseSessionName(sessionName);
            if (!parsed) continue;

            if (!projectMap.has(parsed.project)) {
              projectMap.set(parsed.project, {
                name: parsed.project,
                path: '', // Would need to determine this from worktree info
                branches: [],
                sessionCount: 0,
              });
            }

            const project = projectMap.get(parsed.project)!;
            project.sessionCount++;

            const branchInfo = project.branches.find((b) => b.name === parsed.branch);
            if (!branchInfo) {
              project.branches.push({
                name: parsed.branch,
                hasSession: true,
                isActive: false, // Will update if needed
              });
            }
          }

          return { success: true, data: Array.from(projectMap.values()) };
        } catch (error) {
          logger.error('MCP: Failed to list projects', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list projects',
          };
        }
      },
    },
    {
      tool: {
        name: 'attach_session',
        description: 'Attach to a specific Claude GWT session',
        inputSchema: {
          type: 'object',
          properties: {
            index: {
              type: 'string',
              description: 'Session index (x.y format) or session name',
            },
          },
          required: ['index'],
        },
      },
      handler: async (args: AttachSessionArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Attaching to session', args);

          // Use the existing attachToSession function
          await attachToSession(args.index);

          return {
            success: true,
            data: { attached_to: args.index },
          };
        } catch (error) {
          logger.error('MCP: Failed to attach session', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to attach to session',
          };
        }
      },
    },
    {
      tool: {
        name: 'create_session',
        description: 'Create a new Claude GWT session',
        inputSchema: {
          type: 'object',
          properties: {
            branch: {
              type: 'string',
              description: 'Branch name for the session',
            },
            supervisor: {
              type: 'boolean',
              description: 'Create as supervisor session',
              default: false,
            },
          },
        },
      },
      handler: async (args: CreateSessionArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Creating session', args);

          const repoName = await getRepoName();
          const branch = args.branch || (args.supervisor ? 'supervisor' : 'main');
          const sessionName = `cgwt-${repoName}--${branch}`;

          await TmuxManager.launchSession({
            sessionName,
            workingDirectory: process.cwd(),
            branchName: branch,
            role: args.supervisor ? 'supervisor' : 'child',
          });

          return {
            success: true,
            data: { session: sessionName },
          };
        } catch (error) {
          logger.error('MCP: Failed to create session', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create session',
          };
        }
      },
    },
    {
      tool: {
        name: 'kill_session',
        description: 'Kill a specific Claude GWT session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionName: {
              type: 'string',
              description: 'Name of the session to kill',
            },
            index: {
              type: 'string',
              description: 'Session index as alternative to name',
            },
          },
        },
      },
      handler: async (args: KillSessionArgs): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Killing session', args);

          const sessionToKill = args.sessionName;

          // If index provided, resolve to session name
          if (!sessionToKill && args.index) {
            // TODO: Implement index resolution
            return {
              success: false,
              error: 'Index-based session killing not yet implemented',
            };
          }

          if (!sessionToKill) {
            return {
              success: false,
              error: 'Either sessionName or index must be provided',
            };
          }

          const result = await execCommandSafe('tmux', ['kill-session', '-t', sessionToKill]);

          if (result.code !== 0) {
            throw new Error(result.stderr || 'Failed to kill session');
          }

          return {
            success: true,
            data: { killed: sessionToKill },
          };
        } catch (error) {
          logger.error('MCP: Failed to kill session', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to kill session',
          };
        }
      },
    },
    {
      tool: {
        name: 'kill_all_sessions',
        description: 'Kill all Claude GWT sessions for the current project',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async (): Promise<MCPToolResponse> => {
        try {
          logger.info('MCP: Killing all sessions');

          await killAllSessions();

          return {
            success: true,
            data: { message: 'All sessions terminated' },
          };
        } catch (error) {
          logger.error('MCP: Failed to kill all sessions', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to kill all sessions',
          };
        }
      },
    },
  ];
}

// Helper functions
function parseSessionName(sessionName: string): { project: string; branch: string } | null {
  if (!sessionName.startsWith('cgwt-')) return null;

  const withoutPrefix = sessionName.substring(5);
  const parts = withoutPrefix.split('--');

  if (parts.length === 2 && parts[0] && parts[1]) {
    return { project: parts[0], branch: parts[1] };
  }

  // Legacy format
  const lastDash = withoutPrefix.lastIndexOf('-');
  if (lastDash > 0) {
    return {
      project: withoutPrefix.substring(0, lastDash),
      branch: withoutPrefix.substring(lastDash + 1),
    };
  }

  return null;
}

async function getCurrentTmuxSession(): Promise<string | null> {
  try {
    const result = await execCommandSafe('tmux', ['display-message', '-p', '#S']);
    return result.code === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function getRepoName(): Promise<string> {
  try {
    const result = await execCommandSafe('git', ['remote', 'get-url', 'origin']);
    if (result.code === 0) {
      const url = result.stdout.trim();
      const match = url.match(/([^/]+?)(?:\.git)?$/);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    // Fallback
  }

  const dirName = process.cwd().split('/').pop();
  return dirName || 'unknown';
}
