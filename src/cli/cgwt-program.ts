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

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to find package.json with fallback for different runtime contexts
let packageJson: { version: string };
try {
  packageJson = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8')) as {
    version: string;
  };
} catch {
  try {
    packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
      version: string;
    };
  } catch {
    // Fallback version for testing
    packageJson = { version: '0.1.2' };
  }
}

export interface Session {
  path: string;
  branch: string;
  head: string;
  isSupervisor?: boolean;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('cgwt')
    .description('Quick session switcher for Claude GWT')
    .version(packageJson.version)
    .allowExcessArguments(false);

  // Subcommand: cgwt l (list)
  program
    .command('l')
    .alias('list')
    .description('List all Claude GWT sessions')
    .action(async () => {
      await listSessions();
    });

  // Subcommand: cgwt s <branch/index> (switch)
  program
    .command('s <target>')
    .alias('switch')
    .description('Switch to a branch by name or index')
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
    .action(async (index: string | undefined) => {
      if (index === undefined) {
        // No arguments, show usage
        program.outputHelp();
      } else if (!isNaN(Number(index))) {
        // Numeric index, switch to it
        await switchSession(index);
      } else {
        // Invalid argument
        logger.warn('Invalid argument provided', { argument: index });
        console.log(chalk.red(`Invalid argument: ${index}`));
        console.log(chalk.yellow('\nUsage:'));
        console.log('  cgwt              - Show this help');
        console.log('  cgwt l            - List sessions');
        console.log('  cgwt s <branch>   - Switch to branch');
        console.log('  cgwt <index>      - Switch by index');
        process.exit(1);
      }
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
        ? `cgwt-${repoName}-supervisor`
        : `cgwt-${repoName}-${branchName}`;
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
      ? `cgwt-${repoName}-supervisor`
      : `cgwt-${repoName}-${branchName}`;

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
      .filter((session) => session.trim() && session.startsWith(`cgwt-${repoName}-`));

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
