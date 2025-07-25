import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ConfigManager } from '../core/ConfigManager.js';
import type { GitRepository } from '../core/git/GitRepository.js';
import { Logger } from '../core/utils/logger.js';
import { sanitizePath, sanitizeSessionName } from '../core/utils/security.js';
import { TmuxDriver } from './TmuxDriver.js';
import { TmuxEnhancer } from './TmuxEnhancer.js';

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
   * Check if a Claude conversation exists for this project
   */
  private static async hasExistingClaudeConversation(workingDirectory: string): Promise<boolean> {
    // Handle different working directory formats:
    // 1. Regular: /home/user/dev/project
    // 2. Worktree with slashes: /home/user/dev/project/feat/my-feature

    // For worktrees, we want to use the base project path, not the worktree path
    // Extract the base project path by finding the .git file
    let projectBasePath = workingDirectory;

    try {
      // Check if this is a worktree by looking for .git file
      const gitPath = path.join(workingDirectory, '.git');
      const gitStat = await fsPromises.stat(gitPath).catch(() => null);

      if (gitStat?.isFile()) {
        // This is a worktree, read the .git file to find the base
        const gitContent = await fsPromises.readFile(gitPath, 'utf-8');
        const match = gitContent.match(/gitdir: (.+)$/m);
        if (match?.[1]) {
          // Extract base path from gitdir
          // Example: gitdir: /home/user/dev/project/.bare/worktrees/feat/my-feature
          const gitDir = match[1];
          const bareMatch = gitDir.match(/^(.+)\/.bare\/worktrees/);
          if (bareMatch?.[1]) {
            projectBasePath = bareMatch[1];
          }
        }
      }
    } catch (error) {
      Logger.debug('Error checking worktree status', { error, workingDirectory });
    }

    // Convert path to Claude's format (replace / with -)
    const projectPath = projectBasePath.replace(/\//g, '-');
    const claudeProjectDir = path.join(
      process.env['HOME'] || '',
      '.claude',
      'projects',
      projectPath,
    );

    try {
      const files = await fsPromises.readdir(claudeProjectDir);
      // Check if there are any .jsonl conversation files
      return files.some((file) => file.endsWith('.jsonl'));
    } catch {
      // Directory doesn't exist or can't be read
      return false;
    }
  }

  /**
   * Get the most recent Claude session ID for this project
   */
  private static async getLatestClaudeSessionId(workingDirectory: string): Promise<string | null> {
    // Use same logic as hasExistingClaudeConversation to get base path
    let projectBasePath = workingDirectory;

    try {
      const gitPath = path.join(workingDirectory, '.git');
      const gitStat = await fsPromises.stat(gitPath).catch(() => null);

      if (gitStat?.isFile()) {
        const gitContent = await fsPromises.readFile(gitPath, 'utf-8');
        const match = gitContent.match(/gitdir: (.+)$/m);
        if (match?.[1]) {
          const gitDir = match[1];
          const bareMatch = gitDir.match(/^(.+)\/.bare\/worktrees/);
          if (bareMatch?.[1]) {
            projectBasePath = bareMatch[1];
          }
        }
      }
    } catch (error) {
      Logger.debug('Error checking worktree status', { error, workingDirectory });
    }

    const projectPath = projectBasePath.replace(/\//g, '-');
    const claudeProjectDir = path.join(
      process.env['HOME'] || '',
      '.claude',
      'projects',
      projectPath,
    );

    try {
      const files = await fsPromises.readdir(claudeProjectDir);
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

      if (jsonlFiles.length === 0) return null;

      // Get the most recent file based on modification time
      const stats = await Promise.all(
        jsonlFiles.map(async (file) => ({
          file,
          mtime: (await fsPromises.stat(path.join(claudeProjectDir, file))).mtime,
        })),
      );

      const latest = stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
      const sessionId = latest?.file.replace('.jsonl', '') || null;

      if (sessionId) {
        Logger.info('Found latest Claude session', { sessionId, projectPath });
      }

      return sessionId;
    } catch {
      return null;
    }
  }

  /**
   * Store Claude session ID in tmux
   */
  private static async setClaudeSessionId(sessionName: string, sessionId: string): Promise<void> {
    try {
      // Store as a tmux user option for this session
      await TmuxDriver.setOption(sessionName, '@claude_session_id', sessionId);
      Logger.info('Stored Claude session ID in tmux', { sessionName, sessionId });
    } catch (error) {
      Logger.warn('Failed to store Claude session ID', { error, sessionName, sessionId });
    }
  }

  /**
   * After starting Claude, wait a moment then store the session ID
   */
  private static storeClaudeSessionAfterStart(sessionName: string, workingDirectory: string): void {
    // Wait a bit for Claude to start and create its session file
    setTimeout(async () => {
      const sessionId = await this.getLatestClaudeSessionId(workingDirectory);
      if (sessionId) {
        await this.setClaudeSessionId(sessionName, sessionId);
      }
    }, 3000); // Wait 3 seconds for Claude to initialize
  }

  /**
   * Get Claude command with appropriate flags
   */
  private static async getClaudeCommand(workingDirectory?: string): Promise<string> {
    // If no working directory provided, start fresh
    if (!workingDirectory) {
      return this.CLAUDE_COMMAND;
    }

    // Check if we should continue an existing conversation
    const hasExisting = await this.hasExistingClaudeConversation(workingDirectory);
    if (hasExisting) {
      Logger.info('Found existing Claude conversation, will use --continue');
      return `${this.CLAUDE_COMMAND} --continue`;
    }

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
    return `${this.SESSION_PREFIX}-${sanitizedRepo}--${sanitizedBranch}`;
  }

  /**
   * Parse session name to extract repo and branch
   */
  static parseSessionName(sessionName: string): { repo: string; branch: string } | null {
    // Expected format: cgwt-<repo>--<branch>
    if (!sessionName.startsWith(this.SESSION_PREFIX)) {
      return null;
    }

    // Remove prefix and split by double dash
    const withoutPrefix = sessionName.substring(this.SESSION_PREFIX.length + 1);
    const parts = withoutPrefix.split('--');

    if (parts.length !== 2) {
      // Handle legacy format (single dash) for backward compatibility
      const legacyParts = withoutPrefix.split('-');
      if (legacyParts.length >= 2) {
        const branch = legacyParts[legacyParts.length - 1];
        if (branch) {
          return {
            repo: legacyParts.slice(0, -1).join('-'),
            branch,
          };
        }
      }
      return null;
    }

    if (parts[0] && parts[1]) {
      return {
        repo: parts[0],
        branch: parts[1],
      };
    }

    return null;
  }

  /**
   * Check if tmux is available
   */
  static async isTmuxAvailable(): Promise<boolean> {
    return await TmuxDriver.isAvailable();
  }

  /**
   * Check if we're inside tmux
   */
  static isInsideTmux(): boolean {
    return TmuxDriver.isInsideTmux();
  }

  /**
   * Get detailed session info
   */
  static async getSessionInfo(sessionName: string): Promise<SessionInfo | null> {
    Logger.verbose('getSessionInfo called', { sessionName });
    try {
      const tmuxSession = await TmuxDriver.getSession(sessionName);
      if (!tmuxSession) {
        return null;
      }

      // Check if Claude is running in any window
      const hasClaudeRunning = await TmuxDriver.isPaneRunningCommand(sessionName, 'claude');

      return {
        name: tmuxSession.name,
        windows: tmuxSession.windows,
        created: tmuxSession.created.toString(),
        attached: tmuxSession.attached,
        hasClaudeRunning,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create context file for Claude
   */
  private static async createContextFile(config: SessionConfig): Promise<void> {
    const contextPath = path.join(config.workingDirectory, '.claude-context.md');
    Logger.info('Creating context file', {
      path: contextPath,
      sessionName: config.sessionName,
      branchName: config.branchName,
      role: config.role,
    });

    // Extract project name from session name
    const parsed = this.parseSessionName(config.sessionName);
    const projectName = parsed?.repo ?? 'unknown';

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
      await fs.promises.writeFile(contextPath, content);
      Logger.info('Context file created successfully', { path: contextPath });
    } catch (error) {
      Logger.error('Failed to create context file', error);
      throw error;
    }
  }

  /**
   * Launch or attach to a Claude session (blocking - attaches to session)
   */
  static async launchSession(config: SessionConfig): Promise<void> {
    const { sessionName, workingDirectory, branchName } = config;
    Logger.info('Launching session', {
      sessionName,
      workingDirectory,
      branchName,
      role: config.role,
    });

    if (!(await this.isTmuxAvailable())) {
      throw new Error('tmux is not installed. Please install tmux to use Claude GWT.');
    }

    // Create context file
    await this.createContextFile(config);

    // Get session info
    const sessionInfo = await this.getSessionInfo(sessionName);

    if (sessionInfo) {
      Logger.info('Session exists', { sessionInfo });

      if (sessionInfo.hasClaudeRunning) {
        // Claude is already running, just attach
        void this.attachToSession(sessionName);
      } else {
        // Session exists but Claude isn't running, restart
        Logger.info('Starting Claude in existing session');
        const claudeCmd = await this.getClaudeCommand(workingDirectory);

        // Apply enhancements to existing session
        await TmuxEnhancer.configureSession(sessionName, {
          sessionName,
          branchName: config.branchName,
          role: config.role,
          gitRepo: config.gitRepo,
        });

        if (this.isInsideTmux()) {
          await TmuxDriver.createWindow({
            sessionName,
            windowName: 'claude',
            workingDirectory,
            command: claudeCmd,
          });
          await TmuxDriver.switchClient(sessionName);

          // Store Claude session ID after it starts
          void this.storeClaudeSessionAfterStart(sessionName, workingDirectory);
        } else {
          // Create new window and attach
          await TmuxDriver.createWindow({
            sessionName,
            windowName: 'claude',
            workingDirectory,
            command: claudeCmd,
          });
          await this.attachToSession(sessionName);

          // Store Claude session ID after it starts
          void this.storeClaudeSessionAfterStart(sessionName, workingDirectory);
        }
      }
    } else {
      // Create new session
      await this.createNewSession(config);
    }
  }

  /**
   * Create a detached Claude session (non-blocking)
   */
  static async createDetachedSession(config: SessionConfig): Promise<void> {
    const { sessionName, workingDirectory, branchName } = config;

    // Validate session name
    if (!sessionName?.trim()) {
      throw new Error('Session name cannot be empty');
    }

    Logger.info('Creating detached session', {
      sessionName,
      workingDirectory,
      branchName,
      role: config.role,
    });

    if (!(await this.isTmuxAvailable())) {
      throw new Error('tmux is not installed. Please install tmux to use Claude GWT.');
    }

    // Create context file
    await this.createContextFile(config);

    // Check if session already exists
    const sessionInfo = await this.getSessionInfo(sessionName);
    if (sessionInfo?.hasClaudeRunning) {
      Logger.info('Session already exists with Claude running', { sessionName });
      return;
    }

    // Get Claude command
    const claudeCmd = await this.getClaudeCommand(workingDirectory);

    try {
      if (sessionInfo) {
        // Session exists but Claude isn't running, create new window
        await TmuxDriver.createWindow({
          sessionName,
          windowName: branchName,
          workingDirectory,
          command: claudeCmd,
        });
        Logger.info('Started Claude in existing session', { sessionName });
      } else {
        // Create new detached session with proper settings
        await TmuxDriver.createSession({
          sessionName,
          workingDirectory,
          windowName: 'claude',
          detached: true,
        });
        Logger.info('Created new detached session', { sessionName });

        // Configure basic settings
        await TmuxDriver.setOption(sessionName, 'mouse', 'on');
        await TmuxDriver.setOption(sessionName, 'mode-keys', 'vi');

        // Apply enhancements after session creation
        await TmuxEnhancer.configureSession(sessionName, {
          sessionName,
          branchName: config.branchName,
          role: config.role,
          gitRepo: config.gitRepo,
        });

        // Start Claude after configuration
        await TmuxDriver.sendKeys(sessionName, [claudeCmd]);

        // Store Claude session ID after it starts
        void this.storeClaudeSessionAfterStart(sessionName, workingDirectory);
      }
    } catch (error) {
      Logger.error('Failed to create detached session', error);
      throw error;
    }
  }

  /**
   * Create a new tmux session
   */
  private static async createNewSession(config: SessionConfig): Promise<void> {
    const { sessionName, workingDirectory } = config;
    Logger.info('Creating new session', { sessionName, workingDirectory });

    if (this.isInsideTmux()) {
      // Create detached session and switch to it
      const claudeCmd = await this.getClaudeCommand(workingDirectory);

      // Create the session first
      await TmuxDriver.createSession({
        sessionName,
        workingDirectory,
        windowName: 'claude',
        detached: true,
      });

      // Configure basic settings
      await TmuxDriver.setOption(sessionName, 'mouse', 'on');
      await TmuxDriver.setOption(sessionName, 'mode-keys', 'vi');

      // Apply enhancements
      await TmuxEnhancer.configureSession(sessionName, {
        sessionName,
        branchName: config.branchName,
        role: config.role,
        gitRepo: config.gitRepo,
      });

      // Start Claude and switch to the session
      await TmuxDriver.sendKeys(sessionName, [claudeCmd]);
      await TmuxDriver.switchClient(sessionName);

      // Store Claude session ID after it starts
      void this.storeClaudeSessionAfterStart(sessionName, workingDirectory);
    } else {
      // Create and attach to new session with proper settings
      const claudeCmd = await this.getClaudeCommand(workingDirectory);

      // Use exec to handle the complex tmux command properly
      try {
        // For attached sessions, we need to use spawnSync directly
        // as the process needs to take over the terminal
        const result = spawnSync(
          'tmux',
          [
            'new-session',
            '-s',
            sanitizeSessionName(sessionName),
            '-c',
            sanitizePath(workingDirectory),
            '-n',
            'claude',
            claudeCmd,
          ],
          { stdio: 'inherit' },
        );

        Logger.info('Session ended', {
          code: result.status,
          signal: result.signal,
          sessionName,
        });

        // Exit the parent process when tmux exits
        process.exit(result.status ?? 0);
      } catch (error) {
        Logger.error('Failed to create session', error);
        throw error;
      }
    }
  }

  /**
   * Attach to an existing session
   */
  static async attachToSession(sessionName: string): Promise<void> {
    Logger.info('Attaching to session', { sessionName });

    if (this.isInsideTmux()) {
      // Just switch to the session
      await TmuxDriver.switchClient(sessionName);
    } else {
      // For attach, we need to use spawnSync directly
      // as the process needs to take over the terminal
      const result = spawnSync('tmux', ['attach-session', '-t', sanitizeSessionName(sessionName)], {
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
  static async killSession(sessionName: string): Promise<void> {
    try {
      await TmuxDriver.killSession(sessionName);
      Logger.info('Killed session', { sessionName });
    } catch {
      // Session might not exist
    }
  }

  /**
   * List all Claude GWT sessions
   */
  static async listSessions(): Promise<SessionInfo[]> {
    try {
      const tmuxSessions = await TmuxDriver.listSessions();
      const claudeSessions = tmuxSessions.filter((s) => s.name.startsWith(this.SESSION_PREFIX));

      const sessions = await Promise.all(claudeSessions.map((s) => this.getSessionInfo(s.name)));

      return sessions.filter((info): info is SessionInfo => info !== null);
    } catch {
      return [];
    }
  }

  /**
   * Shutdown all sessions gracefully
   */
  static async shutdownAll(): Promise<void> {
    Logger.info('Shutting down all Claude GWT sessions');
    const sessions = await this.listSessions();

    // Kill child sessions first
    await Promise.all(
      sessions
        .filter((s) => !s.name.includes('supervisor'))
        .map(async (s) => {
          Logger.info('Shutting down child session', { session: s.name });
          await this.killSession(s.name);
        }),
    );

    // Kill supervisor last
    const supervisor = sessions.find((s) => s.name.includes('supervisor'));
    if (supervisor) {
      Logger.info('Shutting down supervisor session', { session: supervisor.name });
      await this.killSession(supervisor.name);
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
    void TmuxEnhancer.createComparisonLayout(sessionName, branches, projectName);
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
    void TmuxEnhancer.createDashboardWindow(sessionName, branches, worktreeBase);
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
  static async enhanceSession(
    sessionName: string,
    config: {
      branchName: string;
      role: 'supervisor' | 'child';
      gitRepo?: GitRepository;
    },
  ): Promise<void> {
    await TmuxEnhancer.configureSession(sessionName, {
      sessionName,
      ...config,
    });
  }

  /**
   * Get session group for a session
   */
  static async getSessionGroup(sessionName: string): Promise<string | null> {
    try {
      return await TmuxDriver.getOption(sessionName, '@session-group');
    } catch {
      return null;
    }
  }

  /**
   * Get all sessions in a group
   */
  static async getSessionsInGroup(groupName: string): Promise<SessionInfo[]> {
    const allSessions = await this.listSessions();
    const sessionsWithGroups = await Promise.all(
      allSessions.map(async (session) => ({
        session,
        group: await this.getSessionGroup(session.name),
      })),
    );

    return sessionsWithGroups
      .filter(({ group }) => group === groupName)
      .map(({ session }) => session);
  }
}
