import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../core/utils/logger';
import { TmuxEnhancer } from './TmuxEnhancer';
import type { GitRepository } from '../core/git/GitRepository';
import { TokenTracker } from '../core/TokenTracker';
import { ConfigManager } from '../core/ConfigManager';

export interface SessionConfig {
  sessionName: string;
  workingDirectory: string;
  branchName: string;
  role: 'supervisor' | 'child';
  gitRepo?: GitRepository;
}

export interface SessionInfo {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
  hasClaudeRunning: boolean;
}

export class TmuxManager {
  private static readonly SESSION_PREFIX = 'cgwt';
  private static readonly CLAUDE_COMMAND = 'claude';

  /**
   * Get Claude command with appropriate flags
   */
  private static getClaudeCommand(): string {
    // Always start fresh - removed --continue functionality
    return this.CLAUDE_COMMAND;
  }

  /**
   * Get sanitized session name
   */
  static getSessionName(repoName: string, branch: string): string {
    const sanitizedRepo = repoName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
    const sanitizedBranch = branch
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
    return `${this.SESSION_PREFIX}-${sanitizedRepo}-${sanitizedBranch}`;
  }

  /**
   * Check if tmux is available
   */
  static isTmuxAvailable(): boolean {
    try {
      execSync('which tmux', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if we're inside tmux
   */
  static isInsideTmux(): boolean {
    return process.env['TMUX'] !== undefined;
  }

  /**
   * Get detailed session info
   */
  static getSessionInfo(sessionName: string): SessionInfo | null {
    Logger.verbose('getSessionInfo called', { sessionName });
    try {
      // Get session info
      const sessionData = execSync(
        `tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}" 2>/dev/null | grep "^${sessionName}:"`,
        { encoding: 'utf-8' },
      ).trim();

      Logger.verbose('Session data from tmux', { sessionData, sessionName });
      if (!sessionData) {
        Logger.verbose('No session found', { sessionName });
        return null;
      }

      const parts = sessionData.split(':');
      const name = parts[0] ?? sessionName;
      const windows = parts[1] ?? '0';
      const created = parts[2] ?? '';
      const attached = parts[3] ?? '0';

      // Check if Claude is running in any window
      let hasClaudeRunning = false;
      try {
        const panes = execSync(
          `tmux list-panes -t ${sessionName} -F "#{pane_current_command}" 2>/dev/null`,
          { encoding: 'utf-8' },
        )
          .trim()
          .split('\n');

        hasClaudeRunning = panes.some((cmd) => cmd.includes('claude') || cmd.includes('node'));
      } catch {
        // Session might not have any panes
      }

      return {
        name,
        windows: parseInt(windows) || 0,
        created,
        attached: attached === '1',
        hasClaudeRunning,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create context file for Claude
   */
  private static createContextFile(config: SessionConfig): void {
    const contextPath = path.join(config.workingDirectory, '.claude-context.md');
    Logger.info('Creating context file', {
      path: contextPath,
      sessionName: config.sessionName,
      branchName: config.branchName,
      role: config.role,
    });

    // Extract project name from session name
    const sessionParts = config.sessionName.split('-');
    const projectName = sessionParts.length >= 3 ? sessionParts.slice(1, -1).join('-') : 'unknown';

    // Get custom context from config
    const configManager = ConfigManager.getInstance();
    const customContext = configManager.getContext(projectName, config.branchName, config.role);

    const baseContext = `# Claude GWT Context

## Role: ${config.role.toUpperCase()}
## Branch: ${config.branchName}
## Session: ${config.sessionName}
## Project: ${projectName}

${
  config.role === 'supervisor'
    ? `### 🎯 You are the SUPERVISOR for ${projectName}

I'm Claude Code, an AI assistant designed to help with software engineering tasks. As the SUPERVISOR, I coordinate work across all branches in this project.

My responsibilities:
- Oversee development across all feature branches
- Coordinate merging and integration strategies
- Maintain project-wide standards and architecture
- Review and guide work from branch sessions
- Make high-level architectural decisions

I can switch between branches using the session commands below to review and coordinate work.
`
    : `### 🔧 You are a BRANCH WORKER on ${config.branchName}

I'm Claude Code, an AI assistant focused on the ${config.branchName} branch of ${projectName}.

My focus:
- Implement features and fixes specific to this branch
- Maintain code quality and consistency
- Follow project standards set by the supervisor
- Report progress and issues back to supervisor when needed
`
}

### Session Management Commands:
- \`!cgwt l\` - List all Claude sessions
- \`!cgwt s <branch>\` - Switch to a branch session
- \`!cgwt 0\` - Return to supervisor
- \`!cgwt ?\` - Check current status
- \`!cgwt tokens\` - View token usage

### Current Context:
Working directory: ${config.workingDirectory}
`;

    // Combine base context with custom context
    const content = customContext
      ? `${baseContext}

---

${customContext}`
      : baseContext;

    try {
      fs.writeFileSync(contextPath, content);
      Logger.info('Context file created successfully', { path: contextPath });
    } catch (error) {
      Logger.error('Failed to create context file', error);
      throw error;
    }
  }

  /**
   * Launch or attach to a Claude session (blocking - attaches to session)
   */
  static launchSession(config: SessionConfig): void {
    const { sessionName, workingDirectory, branchName } = config;
    Logger.info('Launching session', {
      sessionName,
      workingDirectory,
      branchName,
      role: config.role,
    });

    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed. Please install tmux to use Claude GWT.');
    }

    // Create context file
    this.createContextFile(config);

    // Start token tracking for this session
    const projectName = sessionName.split('-')[1] ?? 'unknown';
    const tracker = TokenTracker.getInstance();
    tracker.startSession(projectName, branchName);

    // Get session info
    const sessionInfo = this.getSessionInfo(sessionName);

    if (sessionInfo) {
      Logger.info('Session exists', { sessionInfo });

      if (sessionInfo.hasClaudeRunning) {
        // Claude is already running, just attach
        this.attachToSession(sessionName);
      } else {
        // Session exists but Claude isn't running, restart
        Logger.info('Starting Claude in existing session');
        const claudeCmd = this.getClaudeCommand();

        // Apply enhancements to existing session
        TmuxEnhancer.configureSession(sessionName, {
          sessionName,
          branchName: config.branchName,
          role: config.role,
          gitRepo: config.gitRepo,
        });

        // Ensure token tracking is active
        tracker.startSession(projectName, config.branchName);

        if (this.isInsideTmux()) {
          execSync(
            `tmux new-window -t ${sessionName} -c ${workingDirectory} -n claude ${claudeCmd}`,
          );
          execSync(`tmux switch-client -t ${sessionName}`);
        } else {
          // Create new window and attach
          execSync(
            `tmux new-window -t ${sessionName} -c ${workingDirectory} -n claude ${claudeCmd}`,
          );
          this.attachToSession(sessionName);
        }
      }
    } else {
      // Create new session
      this.createNewSession(config);
    }
  }

  /**
   * Create a detached Claude session (non-blocking)
   */
  static createDetachedSession(config: SessionConfig): void {
    const { sessionName, workingDirectory, branchName } = config;
    Logger.info('Creating detached session', {
      sessionName,
      workingDirectory,
      branchName,
      role: config.role,
    });

    if (!this.isTmuxAvailable()) {
      throw new Error('tmux is not installed. Please install tmux to use Claude GWT.');
    }

    // Create context file
    this.createContextFile(config);

    // Check if session already exists
    const sessionInfo = this.getSessionInfo(sessionName);
    if (sessionInfo && sessionInfo.hasClaudeRunning) {
      Logger.info('Session already exists with Claude running', { sessionName });
      return;
    }

    // Get Claude command
    const claudeCmd = this.getClaudeCommand();

    try {
      if (sessionInfo) {
        // Session exists but Claude isn't running, create new window
        execSync(
          `tmux new-window -t ${sessionName} -c ${workingDirectory} -n ${branchName} ${claudeCmd}`,
        );
        Logger.info('Started Claude in existing session', { sessionName });
      } else {
        // Create new detached session with proper settings
        // Disable automatic copy mode on mouse drag, enable normal mouse behavior
        // Create the session first
        execSync(`tmux new-session -d -s ${sessionName} -c ${workingDirectory} -n claude`);
        Logger.info('Created new detached session', { sessionName });

        // Configure basic settings
        execSync(`tmux set -t ${sessionName} mouse on`);
        execSync(`tmux set -t ${sessionName} mode-keys vi`);

        // Apply enhancements after session creation
        TmuxEnhancer.configureSession(sessionName, {
          sessionName,
          branchName: config.branchName,
          role: config.role,
          gitRepo: config.gitRepo,
        });

        // Start Claude after configuration
        execSync(`tmux send-keys -t ${sessionName} "${claudeCmd}" Enter`);
      }
    } catch (error) {
      Logger.error('Failed to create detached session', error);
      throw error;
    }
  }

  /**
   * Create a new tmux session
   */
  private static createNewSession(config: SessionConfig): void {
    const { sessionName, workingDirectory } = config;
    Logger.info('Creating new session', { sessionName, workingDirectory });

    if (this.isInsideTmux()) {
      // Create detached session and switch to it
      const claudeCmd = this.getClaudeCommand();
      // Create the session first
      execSync(`tmux new-session -d -s ${sessionName} -c ${workingDirectory} -n claude`);

      // Configure basic settings
      execSync(`tmux set -t ${sessionName} mouse on`);
      execSync(`tmux set -t ${sessionName} mode-keys vi`);

      // Apply enhancements
      TmuxEnhancer.configureSession(sessionName, {
        sessionName,
        branchName: config.branchName,
        role: config.role,
        gitRepo: config.gitRepo,
      });

      // Start Claude and switch to the session
      execSync(`tmux send-keys -t ${sessionName} "${claudeCmd}" Enter`);
      execSync(`tmux switch-client -t ${sessionName}`);
    } else {
      // Create and attach to new session with proper settings
      const claudeCmd = this.getClaudeCommand();

      // Use exec to handle the complex tmux command properly
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { execSync: execSyncInherit } = require('child_process') as {
        execSync: typeof execSync;
      };
      try {
        execSyncInherit(
          `tmux new-session -s ${sessionName} -c ${workingDirectory} \\; set -g mouse on \\; set -g mode-keys vi \\; send-keys "${claudeCmd}" Enter`,
          { stdio: 'inherit' },
        );
      } catch (error) {
        const execError = error as { status?: number; signal?: string };
        Logger.info('Session ended', {
          code: execError.status,
          signal: execError.signal,
          sessionName,
        });

        // Exit the parent process when tmux exits
        process.exit(execError.status ?? 0);
      }
    }
  }

  /**
   * Attach to an existing session
   */
  static attachToSession(sessionName: string): void {
    Logger.info('Attaching to session', { sessionName });

    if (this.isInsideTmux()) {
      // Just switch to the session
      execSync(`tmux switch-client -t ${sessionName}`);
    } else {
      // Attach to the session
      const result = spawnSync('tmux', ['attach-session', '-t', sessionName], {
        stdio: 'inherit',
        env: { ...process.env },
      });

      Logger.info('Detached from session', {
        code: result.status,
        signal: result.signal,
        sessionName,
      });

      // Exit the parent process when tmux exits
      process.exit(result.status ?? 0);
    }
  }

  /**
   * Kill a session
   */
  static killSession(sessionName: string): void {
    try {
      execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
      Logger.info('Killed session', { sessionName });
    } catch {
      // Session might not exist
    }
  }

  /**
   * List all Claude GWT sessions
   */
  static listSessions(): SessionInfo[] {
    try {
      const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .filter((name) => name.startsWith(this.SESSION_PREFIX))
        .filter((name) => name.trim() !== '')
        .map((name) => this.getSessionInfo(name))
        .filter((info): info is SessionInfo => info !== null);
    } catch {
      return [];
    }
  }

  /**
   * Shutdown all sessions gracefully
   */
  static shutdownAll(): void {
    Logger.info('Shutting down all Claude GWT sessions');
    const sessions = this.listSessions();

    // Kill child sessions first
    sessions
      .filter((s) => !s.name.includes('supervisor'))
      .forEach((s) => {
        Logger.info('Shutting down child session', { session: s.name });
        this.killSession(s.name);
      });

    // Kill supervisor last
    const supervisor = sessions.find((s) => s.name.includes('supervisor'));
    if (supervisor) {
      Logger.info('Shutting down supervisor session', { session: supervisor.name });
      this.killSession(supervisor.name);
    }
  }

  /**
   * Create a branch comparison layout
   */
  static createComparisonLayout(
    sessionName: string,
    branches: string[],
    projectName: string,
  ): void {
    TmuxEnhancer.createComparisonLayout(sessionName, branches, projectName);
  }

  /**
   * Toggle synchronized panes in a session
   */
  static toggleSynchronizedPanes(sessionName: string): boolean {
    return TmuxEnhancer.toggleSynchronizedPanes(sessionName);
  }

  /**
   * Create a dashboard window showing all branches
   */
  static createDashboard(sessionName: string, branches: string[], worktreeBase: string): void {
    TmuxEnhancer.createDashboardWindow(sessionName, branches, worktreeBase);
  }

  /**
   * Get predefined layouts
   */
  static getPredefinedLayouts(): ReturnType<typeof TmuxEnhancer.getPredefinedLayouts> {
    return TmuxEnhancer.getPredefinedLayouts();
  }

  /**
   * Apply enhancements to existing session
   */
  static enhanceSession(
    sessionName: string,
    config: {
      branchName: string;
      role: 'supervisor' | 'child';
      gitRepo?: GitRepository;
    },
  ): void {
    TmuxEnhancer.configureSession(sessionName, {
      sessionName,
      ...config,
    });
  }

  /**
   * Get session group for a session
   */
  static getSessionGroup(sessionName: string): string | null {
    try {
      const group = execSync(`tmux show -t ${sessionName} -v @session-group 2>/dev/null`, {
        encoding: 'utf-8',
      }).trim();
      return group ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get all sessions in a group
   */
  static getSessionsInGroup(groupName: string): SessionInfo[] {
    const allSessions = this.listSessions();
    return allSessions.filter((session) => {
      const group = this.getSessionGroup(session.name);
      return group === groupName;
    });
  }
}
