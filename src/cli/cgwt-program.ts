/**
 * cgwt - Quick session switcher for Claude GWT
 * This module exports the Commander program for testing
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import { logger } from '../core/utils/logger.js';
import { execCommandSafe } from '../core/utils/async.js';
import { simpleGit } from 'simple-git';
import { SplitCommand, TipsCommand } from './commands/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to find package.json with fallback for different runtime contexts
let packageJson: { version: string };
try {
  // When running from dist/src/cli/cgwt-program.js, package.json is at ../../../package.json
  packageJson = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8')) as {
    version: string;
  };
} catch {
  try {
    // Alternative path for different build structures
    packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
      version: string;
    };
  } catch {
    try {
      // For development mode running from src/
      packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
        version: string;
      };
    } catch {
      // Fallback version - should match current package.json
      packageJson = { version: '0.3.0' };
    }
  }
}

export interface Session {
  path: string;
  branch: string;
  head: string;
  isSupervisor?: boolean;
}

interface CLIOptions {
  verbose?: boolean;
  veryVerbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
  repo?: string;
  create?: boolean;
  supervisor?: boolean;
  interactive?: boolean;
}

interface SplitCommandOptions {
  horizontal?: boolean;
  vertical?: boolean;
  percentage?: string;
}

interface AppCommandOptions {
  verbose?: boolean;
  veryVerbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

interface InitCommandOptions {
  repo?: string;
  quiet?: boolean;
  verbose?: boolean;
}

interface NewCommandOptions {
  create?: boolean;
}

interface LaunchCommandOptions {
  supervisor?: boolean;
}

interface InquirerAction {
  action: string;
}

interface InquirerBranch {
  branch: string;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('cgwt')
    .description('Quick session switcher and Git worktree manager')
    .version(packageJson.version)
    .allowExcessArguments(false)
    .option('-la', 'List only active sessions')
    .option('-l [project]', 'List all projects or branches within a project')
    .option('-a <index>', 'Attach to session by index (x or x.y format)');

  // Subcommand: cgwt app - Guided experience or explicit commands
  const appCommand = program
    .command('app')
    .description('Guided setup experience or explicit app commands')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-vv, --very-verbose', 'Enable very verbose logging')
    .option('-vvv, --debug', 'Enable debug logging')
    .option('-q, --quiet', 'Suppress banner and decorative output')
    .action(async (options: AppCommandOptions) => {
      await runGuidedExperience(options);
    });

  // App subcommand: cgwt app init
  appCommand
    .command('init')
    .description('Initialize a new Git worktree project')
    .argument('[path]', 'Directory path (defaults to current directory)', '.')
    .option('-r, --repo <url>', 'Git repository URL')
    .option('-q, --quiet', 'Suppress banner and decorative output')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (path: string, options: InitCommandOptions) => {
      const { ClaudeGWTApp } = await import('./ClaudeGWTApp.js');
      const app = new ClaudeGWTApp(path, { ...options, interactive: true });
      await app.run();
    });

  // App subcommand: cgwt app new
  appCommand
    .command('new <branch>')
    .description('Create a new worktree for a branch')
    .option('-c, --create', 'Create the branch if it does not exist')
    .action(async (branch: string, options: NewCommandOptions) => {
      await createNewWorktree(branch, options.create ?? false);
    });

  // App subcommand: cgwt app launch
  appCommand
    .command('launch')
    .description('Launch Claude Code in the current worktree')
    .option('-s, --supervisor', 'Launch as supervisor')
    .action(async (options: LaunchCommandOptions) => {
      await launchClaude(options.supervisor ?? false);
    });

  // App subcommand: cgwt app setup
  appCommand
    .command('setup')
    .description('Convert existing Git repository to worktree structure')
    .action(async () => {
      await setupWorktreeStructure();
    });

  // App subcommand: cgwt app logs
  appCommand
    .command('logs')
    .description('Show log file location')
    .action(() => {
      console.log(chalk.cyan('Log file location:'));
      console.log(chalk.dim('.claude-gwt.log'));
    });

  // Legacy compatibility: cgwt l (list)
  program
    .command('l')
    .alias('list')
    .description('List all Claude GWT sessions in current project')
    .action(async () => {
      await listSessions();
    });

  // Legacy compatibility: cgwt s <branch/index> (switch)
  program
    .command('s <target>')
    .alias('switch')
    .description('Switch to a branch by name or index in current project')
    .action(async (target: string) => {
      await switchSession(target);
    });

  // Hidden killall command - not shown in help
  program
    .command('killall', { hidden: true })
    .description('Kill all Claude GWT tmux sessions')
    .action(async () => {
      await killAllSessions();
    });

  // Default action for direct index (cgwt 1, cgwt 2, etc.)
  program
    .argument('[index]', 'Session index to switch to')
    .action(
      async (
        index: string | undefined,
        options: { l?: string | boolean; la?: boolean; La?: boolean; a?: string },
      ) => {
        // Handle new multi-project flags
        if (options.l !== undefined) {
          if (typeof options.l === 'string') {
            // List branches within a specific project
            await listProjectBranches(options.l);
          } else {
            // List all projects
            await listAllProjects();
          }
        } else if (options.la ?? options.La) {
          // List only active sessions
          await listActiveSessions();
        } else if (options.a) {
          // Attach to session by index
          await attachToSession(options.a);
        } else if (index === undefined) {
          // No arguments, show usage
          program.outputHelp();
        } else if (!isNaN(Number(index))) {
          // Numeric index, switch to it (backwards compatible)
          await switchSession(index);
        } else {
          // Invalid argument
          logger.warn('Invalid argument provided', { argument: index });
          console.log(chalk.red(`Invalid argument: ${index}`));
          console.log(chalk.yellow('\nQuick Commands:'));
          console.log('  cgwt              - Show this help');
          console.log('  cgwt <index>      - Quick switch by index');
          console.log('  cgwt -l           - List all projects');
          console.log('  cgwt -l X         - List branches in project X');
          console.log('  cgwt -la          - List active sessions');
          console.log('  cgwt -a x.y       - Attach to project.branch');
          console.log('');
          console.log(chalk.yellow('App Commands:'));
          console.log('  cgwt app init     - Initialize new project');
          console.log('  cgwt app new      - Create new worktree');
          console.log('  cgwt app launch   - Launch Claude');
          console.log('  cgwt app setup    - Convert repo to worktree');
          console.log('  cgwt app logs     - Show log location');
          process.exit(1);
        }
      },
    );

  // Split command: cgwt split
  program
    .command('split')
    .description('Split current tmux pane and launch another cgwt session')
    .option('-h, --horizontal', 'Split horizontally (top/bottom)')
    .option('-v, --vertical', 'Split vertically (left/right)', true)
    .option('-p, --percentage <size>', 'Size percentage for new pane', '50')
    .argument('[target]', 'Branch name or session index to launch')
    .action(async (target: string | undefined, options: SplitCommandOptions) => {
      await splitPane(target, options);
    });

  // Tips command: cgwt tips
  program
    .command('tips')
    .description('Show tmux tips and keyboard shortcuts')
    .action(() => {
      showTips();
    });

  return program;
}

export async function listSessions(): Promise<Session[]> {
  logger.info('Listing sessions');
  try {
    const result = await execCommandSafe('git', ['worktree', 'list', '--porcelain']);

    if (result.code !== 0) {
      throw new Error(result.stderr || 'Failed to list worktrees');
    }

    const sessions = parseWorktreeOutput(result.stdout);
    logger.info('Sessions listed', { sessionCount: sessions.length });

    if (sessions.length === 0) {
      console.log(chalk.yellow('No Git worktree sessions found.'));
      console.log(chalk.dim('Make sure you are in a Git worktree repository.'));
      return sessions;
    }

    console.log(chalk.cyan('\nGit Worktree Sessions:'));
    console.log(chalk.dim('─'.repeat(50)));

    // Get current tmux session if in tmux
    const currentTmuxSession = await getCurrentTmuxSession();
    const repoName = await getRepoName();

    let branchIndex = 0;
    sessions.forEach((session) => {
      const actualIndex = session.isSupervisor ? 0 : ++branchIndex;
      const branchName = session.branch ? session.branch.replace('refs/heads/', '') : '';

      // Determine if this session is active
      const tmuxSessionName = session.isSupervisor
        ? `cgwt-${repoName}--supervisor`
        : `cgwt-${repoName}--${branchName}`;
      const isActive = currentTmuxSession === tmuxSessionName || isSessionActive(session.path);

      // Format index
      const indexStr = `[${actualIndex}]`;

      // Format branch name or [SUP] for supervisor
      let displayName: string;
      if (session.isSupervisor) {
        displayName = chalk.magenta('[SUP]');
      } else if (branchName === 'main' || branchName === 'master') {
        displayName = chalk.yellow(branchName);
      } else {
        displayName = chalk.hex('#00D9FF')(branchName);
      }

      // Active marker
      const marker = isActive ? chalk.green('●') : chalk.gray('○');

      // Build the display line - one row per session
      const displayLine = `${marker} ${indexStr} ${displayName}`;

      // Apply background color if active
      if (isActive) {
        const paddedLine =
          displayLine + ' '.repeat(Math.max(0, 50 - stripAnsi(displayLine).length));
        console.log(chalk.bgGreen.black(paddedLine));
      } else {
        console.log(displayLine);
      }
    });

    return sessions;
  } catch (error) {
    logger.error('Failed to list sessions', error);
    handleGitError(error);
    return [];
  }
}

export async function switchSession(target: string): Promise<void> {
  logger.info('Switching session', { target });
  try {
    const sessions = await getSessionsQuietly();

    if (sessions.length === 0) {
      console.log(chalk.red('No Git worktree sessions found.'));
      process.exit(1);
    }

    let targetSession: Session | undefined;
    let targetIndex: number = -1;

    // Check if target is a number (index)
    const index = parseInt(target, 10);
    if (!isNaN(index)) {
      if (index === 0) {
        // Supervisor session
        targetSession = sessions.find((s) => s.isSupervisor);
        targetIndex = 0;
      } else {
        const branchSessions = sessions.filter((s) => !s.isSupervisor);
        if (index < 1 || index > branchSessions.length) {
          logger.error('Index out of range', { index, sessionCount: branchSessions.length });
          console.log(
            chalk.red(`Index ${index} is out of range. Valid range: 0-${branchSessions.length}`),
          );
          process.exit(1);
        }
        targetSession = branchSessions[index - 1];
        targetIndex = index;
      }
    } else {
      // Target is a branch name
      targetSession = sessions.find((s) => {
        if (s.isSupervisor && (target === 'supervisor' || target === 'sup')) {
          return true;
        }
        const branchName = s.branch?.replace('refs/heads/', '') || '';
        return branchName === target || s.branch === target;
      });

      if (targetSession) {
        targetIndex = targetSession.isSupervisor
          ? 0
          : sessions.filter((s) => !s.isSupervisor).indexOf(targetSession) + 1;
      } else {
        targetIndex = -1;
      }

      if (!targetSession) {
        const availableBranches = sessions
          .map((s) => (s.isSupervisor ? 'supervisor' : s.branch?.replace('refs/heads/', '') || ''))
          .join(', ');
        logger.error('Branch not found', { target, availableBranches });
        console.log(chalk.red(`Branch '${target}' not found.`));
        console.log(chalk.yellow(`Available branches: ${availableBranches}`));
        process.exit(1);
      }
    }

    if (!targetSession) {
      // This should never happen due to checks above, but TypeScript needs it
      console.log(chalk.red('Error: Unable to find session'));
      process.exit(1);
    }

    // Get repo name for tmux session naming
    const repoName = await getRepoName();
    const branchName = targetSession.isSupervisor
      ? 'supervisor'
      : targetSession.branch?.replace('refs/heads/', '') || '';
    const tmuxSessionName = targetSession.isSupervisor
      ? `cgwt-${repoName}--supervisor`
      : `cgwt-${repoName}--${branchName}`;

    // Try to switch/attach to tmux session
    const inTmux = !!process.env['TMUX'];

    if (inTmux) {
      // If we're in tmux, switch to the session
      const switchResult = await execCommandSafe('tmux', ['switch-client', '-t', tmuxSessionName]);
      if (switchResult.code === 0) {
        logger.info('Switched tmux session', { session: tmuxSessionName });
        return;
      }
    } else {
      // If we're not in tmux, try to attach
      const attachResult = await execCommandSafe('tmux', ['attach-session', '-t', tmuxSessionName]);
      if (attachResult.code === 0) {
        return;
      }
    }

    // If tmux switch/attach failed, just change directory
    process.chdir(targetSession.path);

    logger.info('Session switched', {
      branch: branchName,
      path: targetSession.path,
      index: targetIndex,
    });

    console.log(chalk.green(`✓ Switched to ${chalk.bold(branchName)}`));
    console.log(chalk.dim(`  Path: ${targetSession.path}`));
    console.log(chalk.yellow(`  Note: Tmux session not found. Run 'claude-gwt' to create it.`));
  } catch (error) {
    logger.error('Failed to switch session', error);
    handleGitError(error);
  }
}

export function parseWorktreeOutput(output: string): Session[] {
  const lines = output.trim().split('\n');
  const sessions: Session[] = [];
  let current: Partial<Session> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        sessions.push(current as Session);
      }
      current = { path: line.substring(9) };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7);
    } else if (line.startsWith('bare')) {
      current.isSupervisor = true;
    } else if (line.trim() === '' && current.path) {
      sessions.push(current as Session);
      current = {};
    }
  }

  if (current.path && current.head) {
    sessions.push(current as Session);
  }

  // Sort sessions: supervisor first, then by branch name
  return sessions.sort((a, b) => {
    if (a.isSupervisor) return -1;
    if (b.isSupervisor) return 1;
    const aBranch = a.branch?.replace('refs/heads/', '') || '';
    const bBranch = b.branch?.replace('refs/heads/', '') || '';
    return aBranch.localeCompare(bBranch);
  });
}

export async function getSessionsQuietly(): Promise<Session[]> {
  try {
    const result = await execCommandSafe('git', ['worktree', 'list', '--porcelain']);
    if (result.code === 0) {
      return parseWorktreeOutput(result.stdout);
    }
    return [];
  } catch {
    return [];
  }
}

export function isSessionActive(sessionPath: string): boolean {
  try {
    return process.cwd() === sessionPath;
  } catch {
    return false;
  }
}

export async function listTmuxSessions(): Promise<void> {
  try {
    const result = await execCommandSafe('tmux', ['list-sessions']);

    if (result.code === 0) {
      const cgwtSessions = result.stdout
        .split('\n')
        .filter((line) => line.includes('cgwt-'))
        .map((line) => line.split(':')[0]);

      if (cgwtSessions.length > 0) {
        console.log(chalk.cyan('\nTmux Sessions:'));
        cgwtSessions.forEach((session) => {
          console.log(chalk.dim(`  - ${session}`));
        });
      }
    }
  } catch {
    // Tmux not running or no sessions
    logger.debug('No tmux sessions found');
  }
}

export function handleGitError(error: unknown): void {
  if (error instanceof Error) {
    if (error.message.includes('not a git repository')) {
      console.log(chalk.red('Error: Not in a Git repository'));
      console.log(chalk.yellow('Run this command from within a Git worktree repository.'));
    } else if (error.message.includes('worktree')) {
      console.log(chalk.red('Error: Git worktree command failed'));
      console.log(
        chalk.yellow('Make sure you have Git 2.5+ installed and are in a worktree repository.'),
      );
    } else {
      console.log(chalk.red('Git error:'), error.message);
    }
  } else {
    console.log(chalk.red('Unknown error occurred'));
  }
  process.exit(1);
}

async function getCurrentTmuxSession(): Promise<string | null> {
  if (!process.env['TMUX']) {
    return null;
  }

  try {
    const result = await execCommandSafe('tmux', ['display-message', '-p', '#S']);
    return result.code === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function getRepoName(): Promise<string> {
  try {
    // Try to get repo name from git remote
    const result = await execCommandSafe('git', ['remote', 'get-url', 'origin']);
    if (result.code === 0) {
      const url = result.stdout.trim();
      // Extract repo name from URL
      const match = url.match(/([^/]+?)(?:\.git)?$/);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    // Fallback to directory name
  }

  // Fallback to current directory name
  const dirName = path.basename(process.cwd());
  return dirName || 'unknown';
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}

export async function killAllSessions(): Promise<void> {
  logger.info('Killing all Claude GWT sessions');

  try {
    const repoName = await getRepoName();

    // Get list of all tmux sessions
    const result = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);

    if (result.code !== 0) {
      console.log(chalk.yellow('No tmux sessions found'));
      return;
    }

    const sessions = result.stdout
      .split('\n')
      .filter(
        (session) =>
          session.trim() &&
          (session.startsWith(`cgwt-${repoName}--`) || session.startsWith(`cgwt-${repoName}-`)),
      );

    if (sessions.length === 0) {
      console.log(chalk.yellow('No Claude GWT sessions found for this repository'));
      return;
    }

    console.log(chalk.red(`Killing ${sessions.length} Claude GWT session(s)...`));

    // Kill each session
    for (const session of sessions) {
      const killResult = await execCommandSafe('tmux', ['kill-session', '-t', session]);
      if (killResult.code === 0) {
        console.log(chalk.dim(`  ✓ Killed ${session}`));
      } else {
        console.log(chalk.yellow(`  ⚠ Failed to kill ${session}`));
      }
    }

    console.log(chalk.green('\n✓ All Claude GWT sessions terminated'));
  } catch (error) {
    logger.error('Failed to kill sessions', error);
    console.log(
      chalk.red('Error killing sessions:'),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

// Multi-project support functions

interface ProjectInfo {
  repo: string;
  branches: Array<{ branch: string; sessionName: string; isActive: boolean }>;
}

async function getAllTmuxSessions(): Promise<string[]> {
  try {
    const result = await execCommandSafe('tmux', ['list-sessions', '-F', '#{session_name}']);
    if (result.code !== 0) return [];
    return result.stdout.split('\n').filter((s) => s.trim() && s.startsWith('cgwt-'));
  } catch {
    return [];
  }
}

async function getCurrentTmuxSessionName(): Promise<string | null> {
  if (!process.env['TMUX']) return null;
  try {
    const result = await execCommandSafe('tmux', ['display-message', '-p', '#S']);
    return result.code === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function parseSessionsIntoProjects(sessions: string[]): Promise<ProjectInfo[]> {
  const currentSession = await getCurrentTmuxSessionName();
  const projectMap = new Map<string, ProjectInfo>();

  for (const session of sessions) {
    // Parse using TmuxManager helper
    const parsed = parseSessionNameForCgwt(session);
    if (!parsed) continue;

    const { repo, branch } = parsed;

    if (!projectMap.has(repo)) {
      projectMap.set(repo, { repo, branches: [] });
    }

    projectMap.get(repo)!.branches.push({
      branch,
      sessionName: session,
      isActive: session === currentSession,
    });
  }

  // Sort branches within each project: supervisor first, then alphabetically
  for (const project of projectMap.values()) {
    project.branches.sort((a, b) => {
      if (a.branch === 'supervisor') return -1;
      if (b.branch === 'supervisor') return 1;
      return a.branch.localeCompare(b.branch);
    });
  }

  // Sort projects alphabetically
  return Array.from(projectMap.values()).sort((a, b) => a.repo.localeCompare(b.repo));
}

function parseSessionNameForCgwt(sessionName: string): { repo: string; branch: string } | null {
  // Expected format: cgwt-<repo>--<branch>
  if (!sessionName.startsWith('cgwt-')) return null;

  const withoutPrefix = sessionName.substring(5);
  const parts = withoutPrefix.split('--');

  if (parts.length === 2 && parts[0] && parts[1]) {
    return { repo: parts[0], branch: parts[1] };
  }

  // Legacy format: cgwt-<repo>-<branch>
  const lastDash = withoutPrefix.lastIndexOf('-');
  if (lastDash > 0) {
    return {
      repo: withoutPrefix.substring(0, lastDash),
      branch: withoutPrefix.substring(lastDash + 1),
    };
  }

  return null;
}

export async function listAllProjects(): Promise<void> {
  const sessions = await getAllTmuxSessions();
  const projects = await parseSessionsIntoProjects(sessions);

  if (projects.length === 0) {
    console.log(chalk.yellow('No Claude GWT projects found.'));
    return;
  }

  console.log(chalk.cyan('\nClaude GWT Projects:'));
  console.log(chalk.dim('─'.repeat(50)));

  projects.forEach((project, index) => {
    const hasActive = project.branches.some((b) => b.isActive);
    const marker = hasActive ? chalk.green('●') : ' ';
    const branchCount = project.branches.length;
    const indexStr = `[${index}]`;

    console.log(`${marker} ${indexStr} ${project.repo} (${branchCount})`);
  });
}

export async function listProjectBranches(projectIndex: string): Promise<void> {
  const sessions = await getAllTmuxSessions();
  const projects = await parseSessionsIntoProjects(sessions);
  const index = parseInt(projectIndex, 10);

  if (isNaN(index) || index < 0 || index >= projects.length) {
    console.log(chalk.red(`Invalid project index: ${projectIndex}`));
    console.log(chalk.yellow(`Valid range: 0-${projects.length - 1}`));
    return;
  }

  const project = projects[index];
  if (!project) return;

  console.log(chalk.cyan(`\n${project.repo} branches:`));
  console.log(chalk.dim('─'.repeat(50)));

  project.branches.forEach((branch, branchIndex) => {
    const actualIndex = `[${index}.${branchIndex}]`;
    const marker = branch.isActive ? chalk.green('●') : ' ';

    let displayName: string;
    if (branch.branch === 'supervisor') {
      displayName = chalk.magenta('[SUP]');
    } else if (branch.branch === 'main' || branch.branch === 'master') {
      displayName = chalk.yellow(branch.branch);
    } else {
      displayName = chalk.hex('#00D9FF')(branch.branch);
    }

    console.log(`${marker} ${actualIndex} ${project.repo} ${displayName}`);
  });
}

export async function listActiveSessions(): Promise<void> {
  const sessions = await getAllTmuxSessions();
  const projects = await parseSessionsIntoProjects(sessions);
  const activeSessions = projects
    .map((project, projectIndex) => ({
      project,
      projectIndex,
      activeBranch: project.branches.find((b) => b.isActive),
    }))
    .filter((item) => item.activeBranch);

  if (activeSessions.length === 0) {
    console.log(chalk.yellow('No active Claude GWT sessions.'));
    return;
  }

  console.log(chalk.cyan('\nActive Claude GWT Sessions:'));
  console.log(chalk.dim('─'.repeat(50)));

  activeSessions.forEach(({ project, projectIndex, activeBranch }) => {
    const branchIndex = project.branches.indexOf(activeBranch!);
    const indexStr = `[${projectIndex}.${branchIndex}]`;

    let displayName: string;
    if (activeBranch!.branch === 'supervisor') {
      displayName = chalk.magenta('[SUP]');
    } else if (activeBranch!.branch === 'main' || activeBranch!.branch === 'master') {
      displayName = chalk.yellow(activeBranch!.branch);
    } else {
      displayName = chalk.hex('#00D9FF')(activeBranch!.branch);
    }

    console.log(`${chalk.green('●')} ${indexStr} ${project.repo} ${displayName}`);
  });
}

export async function attachToSession(index: string): Promise<void> {
  const sessions = await getAllTmuxSessions();
  const projects = await parseSessionsIntoProjects(sessions);

  // Parse x.y or x format
  const parts = index.split('.');
  const projectIndex = parseInt(parts[0] ?? '0', 10);
  const branchIndex = parts.length > 1 ? parseInt(parts[1] ?? '0', 10) : 0;

  if (isNaN(projectIndex) || projectIndex < 0 || projectIndex >= projects.length) {
    console.log(chalk.red(`Invalid project index: ${projectIndex}`));
    console.log(chalk.yellow(`Valid range: 0-${projects.length - 1}`));
    return;
  }

  const project = projects[projectIndex];
  if (!project) {
    console.log(chalk.red(`Project not found at index: ${projectIndex}`));
    return;
  }

  if (branchIndex < 0 || branchIndex >= project.branches.length) {
    console.log(chalk.red(`Invalid branch index: ${branchIndex}`));
    console.log(chalk.yellow(`Valid range: 0-${project.branches.length - 1}`));
    return;
  }

  const targetBranch = project.branches[branchIndex];
  if (!targetBranch) {
    console.log(chalk.red(`Branch not found at index: ${branchIndex}`));
    return;
  }
  const targetSession = targetBranch.sessionName;
  const inTmux = !!process.env['TMUX'];

  logger.info('Attaching to session', { session: targetSession, inTmux });

  if (inTmux) {
    const result = await execCommandSafe('tmux', ['switch-client', '-t', targetSession]);
    if (result.code !== 0) {
      console.log(chalk.red('Failed to switch to session'));
      logger.error('Failed to switch tmux session', { error: result.stderr });
    }
  } else {
    // Use spawn for interactive attach
    const { spawn } = await import('child_process');
    const tmux = spawn('tmux', ['attach-session', '-t', targetSession], {
      stdio: 'inherit',
    });

    tmux.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  }
}

// New worktree management functions

export async function createNewWorktree(
  branch: string,
  createBranch: boolean = false,
): Promise<void> {
  logger.info('Creating new worktree', { branch, createBranch });

  try {
    // Check if we're in a git worktree setup
    const detector = await import('../core/git/GitDetector.js').then(
      (m) => new m.GitDetector(process.cwd()),
    );
    const state = await detector.detectState();

    if (state.type !== 'git-worktree' && state.type !== 'claude-gwt-parent') {
      console.log(chalk.red('Error: Not in a Git worktree repository'));
      console.log(chalk.yellow('Run "cgwt init" first to set up a worktree repository'));
      process.exit(1);
    }

    // For claude-gwt-parent, the repo path is the current directory (contains .bare)
    // For git-worktree, we need to go up to find the parent
    let repoPath = process.cwd();

    if (state.type === 'git-worktree') {
      // If we're in a worktree, find the parent directory
      const gitFile = await import('fs').then((fs) =>
        fs.promises.readFile('.git', 'utf-8').catch(() => ''),
      );
      if (gitFile.includes('gitdir:')) {
        // Extract the parent path from the gitdir
        const gitDirMatch = gitFile.match(/gitdir:\s*(.+)/);
        if (gitDirMatch?.[1]) {
          const gitDirPath = gitDirMatch[1].trim();
          // The parent is typically one level up from the git directory
          repoPath = path.dirname(path.dirname(path.resolve(gitDirPath)));
        }
      }
    }

    const manager = await import('../core/git/WorktreeManager.js').then(
      (m) => new m.WorktreeManager(repoPath),
    );

    // Create the worktree
    const spinner = await import('./ui/spinner.js').then(
      (m) => new m.Spinner(`Creating worktree for ${branch}...`),
    );
    spinner.start();

    try {
      const worktreePath = await manager.addWorktree(branch, createBranch ? 'HEAD' : undefined);
      spinner.succeed(`Worktree created at ${worktreePath}`);

      // Launch Claude in the new worktree
      const repoName = await getRepoName();
      const sessionName = `cgwt-${repoName}--${branch}`;

      const tmuxManager = await import('../sessions/TmuxManager.js').then((m) => m.TmuxManager);
      await tmuxManager.launchSession({
        sessionName,
        workingDirectory: worktreePath,
        branchName: branch,
        role: 'child',
      });
    } catch (error) {
      spinner.fail('Failed to create worktree');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to create worktree', error);
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function launchClaude(asSupervisor: boolean = false): Promise<void> {
  logger.info('Launching Claude', { asSupervisor });

  try {
    const detector = await import('../core/git/GitDetector.js').then(
      (m) => new m.GitDetector(process.cwd()),
    );
    const state = await detector.detectState();

    if (state.type === 'empty' || state.type === 'non-git') {
      console.log(chalk.red('Error: Not in a Git repository'));
      console.log(chalk.yellow('Run "cgwt init" to initialize a new project'));
      process.exit(1);
    }

    const repoName = await getRepoName();
    let branch = 'main';
    let role: 'supervisor' | 'child' = asSupervisor ? 'supervisor' : 'child';

    if (!asSupervisor && state.type === 'git-worktree') {
      // Get current branch
      const result = await execCommandSafe('git', ['branch', '--show-current']);
      if (result.code === 0) {
        branch = result.stdout.trim();
      }
    } else if (asSupervisor || state.type === 'claude-gwt-parent') {
      branch = 'supervisor';
      role = 'supervisor';
    }

    const sessionName = `cgwt-${repoName}--${branch}`;
    const tmuxManager = await import('../sessions/TmuxManager.js').then((m) => m.TmuxManager);

    await tmuxManager.launchSession({
      sessionName,
      workingDirectory: process.cwd(),
      branchName: branch,
      role,
    });
  } catch (error) {
    logger.error('Failed to launch Claude', error);
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function setupWorktreeStructure(): Promise<void> {
  logger.info('Setting up worktree structure');

  try {
    const detector = await import('../core/git/GitDetector.js').then(
      (m) => new m.GitDetector(process.cwd()),
    );
    const state = await detector.detectState();

    if (state.type !== 'git-repo') {
      console.log(chalk.red('Error: Not in a regular Git repository'));
      console.log(chalk.yellow('This command converts a regular Git repo to worktree structure'));
      process.exit(1);
    }

    console.log(chalk.cyan('Converting to Git worktree structure...'));
    console.log(chalk.yellow('⚠️  This will:'));
    console.log(chalk.yellow('  • Move .git to .bare'));
    console.log(chalk.yellow('  • Create a .git file pointing to .bare'));
    console.log(chalk.yellow('  • Set up current directory as main worktree'));

    // TODO: Add confirmation prompt

    const spinner = await import('./ui/spinner.js').then(
      (m) => new m.Spinner('Converting repository...'),
    );
    spinner.start();

    try {
      // Implement conversion logic
      const git = simpleGit(process.cwd());

      // Move .git to .bare
      await execCommandSafe('mv', ['.git', '.bare']);

      // Create .git file
      await import('fs').then((fs) => fs.promises.writeFile('.git', 'gitdir: .bare\n'));

      // Configure bare repo
      await git.cwd('.bare');
      await git.raw(['config', 'core.bare', 'true']);

      spinner.succeed('Repository converted successfully!');
      console.log(chalk.green('\n✓ Your repository is now using Git worktree structure'));
      console.log(chalk.dim('  You can now use "cgwt new <branch>" to create new worktrees'));
    } catch (error) {
      spinner.fail('Failed to convert repository');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to setup worktree structure', error);
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Guided experience for cgwt app
export async function runGuidedExperience(options: AppCommandOptions): Promise<void> {
  // Set log level based on verbosity
  const { Logger } = await import('../core/utils/logger.js');
  if (options.debug) {
    Logger.setLogLevel('debug');
  } else if (options.veryVerbose) {
    Logger.setLogLevel('trace');
  } else if (options.verbose) {
    Logger.setLogLevel('info');
  } else {
    Logger.setLogLevel('warn');
  }

  Logger.info('Starting guided experience', { options });

  try {
    if (!options.quiet) {
      console.log(chalk.cyan('\n🎯 Claude GWT Guided Setup'));
      console.log(chalk.dim('Let me help you get started based on your current directory...\n'));
    }

    // Detect current directory state
    const detector = await import('../core/git/GitDetector.js').then(
      (m) => new m.GitDetector(process.cwd()),
    );
    const state = await detector.detectState();

    switch (state.type) {
      case 'empty':
        await guideEmptyDirectory(options);
        break;
      case 'claude-gwt-parent':
        await guideClaudeGWTParent(options);
        break;
      case 'git-worktree':
        await guideGitWorktree(options);
        break;
      case 'git-repo':
        await guideGitRepository(options);
        break;
      case 'non-git':
        await guideNonGitDirectory(options);
        break;
    }
  } catch (error) {
    Logger.error('Guided experience failed', error);
    console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function guideEmptyDirectory(options: CLIOptions): Promise<void> {
  console.log(chalk.green('📂 Empty directory detected'));
  console.log(chalk.dim('Perfect! We can set up a new project here.\n'));

  console.log(chalk.yellow('What would you like to do?'));
  console.log('  1. Clone an existing repository');
  console.log('  2. Initialize a new local repository');
  console.log('  3. Exit and set up manually\n');

  const inquirer = await import('inquirer');
  const { action } = await inquirer.default.prompt<InquirerAction>([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'Clone an existing repository', value: 'clone' },
        { name: 'Initialize a new local repository', value: 'init' },
        { name: 'Exit and set up manually', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') {
    console.log(chalk.dim('You can run specific commands like "cgwt app init" when ready.'));
    return;
  }

  // Delegate to existing init functionality
  const { ClaudeGWTApp } = await import('./ClaudeGWTApp.js');
  const app = new ClaudeGWTApp(process.cwd(), { ...options, interactive: true });
  await app.run();
}

async function splitPane(target: string | undefined, options: SplitCommandOptions): Promise<void> {
  // Delegate to the SplitCommand class - preserving exact same behavior
  await SplitCommand.execute(target, options, getSessionsQuietly);
}

function showTips(): void {
  // Delegate to the TipsCommand class - preserving exact same behavior
  TipsCommand.execute();
}

async function guideClaudeGWTParent(_options: AppCommandOptions): Promise<void> {
  console.log(chalk.green('✨ Claude GWT project detected'));
  console.log(chalk.dim("You're in a Claude GWT parent directory.\n"));

  // Show current worktrees
  const manager = await import('../core/git/WorktreeManager.js').then(
    (m) => new m.WorktreeManager(process.cwd()),
  );
  const worktrees = await manager.listWorktrees();

  if (worktrees.length > 0) {
    console.log(chalk.cyan('Current branches:'));
    worktrees.forEach((wt, i) => {
      console.log(chalk.dim(`  ${i + 1}. ${wt.branch} (${wt.path})`));
    });
    console.log();
  }

  console.log(chalk.yellow('What would you like to do?'));
  console.log('  1. Create a new branch/worktree');
  console.log('  2. Launch Claude in supervisor mode');
  console.log('  3. Switch to an existing branch');
  console.log('  4. View all sessions (cgwt -l)');
  console.log('  5. Exit\n');

  const inquirer = await import('inquirer');
  const { action } = await inquirer.default.prompt<InquirerAction>([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'Create a new branch/worktree', value: 'new' },
        { name: 'Launch Claude in supervisor mode', value: 'supervisor' },
        { name: 'Switch to an existing branch', value: 'switch' },
        { name: 'View all sessions', value: 'list' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'new': {
      const { branch } = await inquirer.default.prompt<InquirerBranch>([
        {
          type: 'input',
          name: 'branch',
          message: 'Enter branch name:',
          validate: (input: string) => (input.trim() ? true : 'Branch name cannot be empty'),
        },
      ]);
      await createNewWorktree(branch.trim(), false);
      break;
    }
    case 'supervisor':
      await launchClaude(true);
      break;
    case 'switch':
      await listSessions();
      break;
    case 'list':
      await listAllProjects();
      break;
    case 'exit':
      console.log(chalk.dim('Use quick commands like "cgwt 1" or "cgwt -l" for faster access.'));
      break;
  }
}

async function guideGitWorktree(_options: AppCommandOptions): Promise<void> {
  console.log(chalk.green('🌿 Git worktree detected'));

  // Get current branch
  const result = await execCommandSafe('git', ['branch', '--show-current']);
  const currentBranch = result.code === 0 ? result.stdout.trim() : 'unknown';

  console.log(chalk.dim(`You're in the "${currentBranch}" branch worktree.\n`));

  console.log(chalk.yellow('What would you like to do?'));
  console.log('  1. Launch Claude in this branch');
  console.log('  2. Create a new branch/worktree');
  console.log('  3. Switch to parent directory');
  console.log('  4. View all sessions');
  console.log('  5. Exit\n');

  const inquirer = await import('inquirer');
  const { action } = await inquirer.default.prompt<InquirerAction>([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'Launch Claude in this branch', value: 'launch' },
        { name: 'Create a new branch/worktree', value: 'new' },
        { name: 'Switch to parent directory', value: 'parent' },
        { name: 'View all sessions', value: 'list' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'launch':
      await launchClaude(false);
      break;
    case 'new': {
      const { branch } = await inquirer.default.prompt<InquirerBranch>([
        {
          type: 'input',
          name: 'branch',
          message: 'Enter branch name:',
          validate: (input: string) => (input.trim() ? true : 'Branch name cannot be empty'),
        },
      ]);
      await createNewWorktree(branch.trim(), false);
      break;
    }
    case 'parent':
      console.log(chalk.cyan('cd ..'));
      console.log(chalk.dim('Then run "cgwt app" again for parent directory options.'));
      break;
    case 'list':
      await listAllProjects();
      break;
    case 'exit':
      console.log(chalk.dim('Use "cgwt launch" to start Claude in this branch.'));
      break;
  }
}

async function guideGitRepository(_options: AppCommandOptions): Promise<void> {
  console.log(chalk.yellow('📁 Regular Git repository detected'));
  console.log(
    chalk.dim('This is a standard Git repo. Claude GWT works best with worktree structure.\n'),
  );

  console.log(chalk.yellow('What would you like to do?'));
  console.log('  1. Convert to worktree structure (recommended)');
  console.log('  2. Launch Claude with limited functionality');
  console.log('  3. Exit\n');

  const inquirer = await import('inquirer');
  const { action } = await inquirer.default.prompt<InquirerAction>([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'Convert to worktree structure (recommended)', value: 'convert' },
        { name: 'Launch Claude with limited functionality', value: 'launch' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'convert':
      await setupWorktreeStructure();
      break;
    case 'launch':
      await launchClaude(false);
      break;
    case 'exit':
      console.log(
        chalk.dim('You can run "cgwt app setup" to convert to worktree structure later.'),
      );
      break;
  }
}

async function guideNonGitDirectory(options: CLIOptions): Promise<void> {
  console.log(chalk.yellow('📂 Non-Git directory detected'));
  console.log(chalk.dim('This directory is not a Git repository.\n'));

  console.log(chalk.yellow('What would you like to do?'));
  console.log('  1. Initialize a new Git repository');
  console.log('  2. Clone an existing repository');
  console.log('  3. Exit\n');

  const inquirer = await import('inquirer');
  const { action } = await inquirer.default.prompt<InquirerAction>([
    {
      type: 'list',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'Initialize a new Git repository', value: 'init' },
        { name: 'Clone an existing repository', value: 'clone' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') {
    console.log(chalk.dim('Navigate to a Git repository or run "cgwt app init" to set up.'));
    return;
  }

  // Delegate to existing init functionality
  const { ClaudeGWTApp } = await import('./ClaudeGWTApp.js');
  const app = new ClaudeGWTApp(process.cwd(), { ...options, interactive: true });
  await app.run();
}
