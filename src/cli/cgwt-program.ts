/**
 * cgwt - Quick session switcher for Claude GWT
 * This module exports the Commander program for testing
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { logger } from '../core/utils/logger.js';

export interface Session {
  path: string;
  branch: string;
  head: string;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('cgwt')
    .description('Quick session switcher for Claude GWT')
    .version('0.1.2')
    .allowExcessArguments(false);

  // Subcommand: cgwt l (list)
  program
    .command('l')
    .alias('list')
    .description('List all Claude GWT sessions')
    .action(() => {
      listSessions();
    });

  // Subcommand: cgwt s <branch/index> (switch)
  program
    .command('s <target>')
    .alias('switch')
    .description('Switch to a branch by name or index')
    .action((target: string) => {
      switchSession(target);
    });

  // Default action for direct index (cgwt 1, cgwt 2, etc.)
  program.argument('[index]', 'Session index to switch to').action((index: string | undefined) => {
    if (index === undefined) {
      // No arguments, show usage
      program.outputHelp();
    } else if (!isNaN(Number(index))) {
      // Numeric index, switch to it
      switchSession(index);
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

export function listSessions(): Session[] {
  logger.info('Listing sessions');
  try {
    const output = execSync('git worktree list --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const sessions = parseWorktreeOutput(output);
    logger.info('Sessions listed', { sessionCount: sessions.length });

    if (sessions.length === 0) {
      console.log(chalk.yellow('No Git worktree sessions found.'));
      console.log(chalk.dim('Make sure you are in a Git worktree repository.'));
      return sessions;
    }

    console.log(chalk.cyan('\nGit Worktree Sessions:'));
    console.log(chalk.dim('─'.repeat(50)));

    sessions.forEach((session, index) => {
      const branchName = session.branch.replace('refs/heads/', '');
      const shortCommit = session.head.substring(0, 7);
      const isActive = isSessionActive(session.path);

      const indexStr = chalk.yellow(`[${index + 1}]`);
      const branchStr = isActive ? chalk.green.bold(branchName) : chalk.white(branchName);
      const activeIndicator = isActive ? chalk.green(' ⬤ (active)') : '';

      console.log(`${indexStr} ${branchStr}${activeIndicator}`);
      console.log(chalk.dim(`    Path: ${session.path}`));
      console.log(chalk.dim(`    HEAD: ${shortCommit}`));
      console.log();
    });

    return sessions;
  } catch (error) {
    logger.error('Failed to list sessions', error);
    handleGitError(error);
    return [];
  }
}

export function switchSession(target: string): void {
  logger.info('Switching session', { target });
  try {
    const sessions = getSessionsQuietly();

    if (sessions.length === 0) {
      console.log(chalk.red('No Git worktree sessions found.'));
      process.exit(1);
    }

    let targetSession: Session | undefined;

    // Check if target is a number (index)
    const index = parseInt(target, 10);
    if (!isNaN(index)) {
      if (index < 1 || index > sessions.length) {
        logger.error('Index out of range', { index, sessionCount: sessions.length });
        console.log(chalk.red(`Index ${index} is out of range. Valid range: 1-${sessions.length}`));
        process.exit(1);
      }
      targetSession = sessions[index - 1];
    } else {
      // Target is a branch name
      targetSession = sessions.find((s) => {
        const branchName = s.branch.replace('refs/heads/', '');
        return branchName === target || s.branch === target;
      });

      if (!targetSession) {
        const availableBranches = sessions
          .map((s) => s.branch.replace('refs/heads/', ''))
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

    // Change directory to the worktree
    process.chdir(targetSession.path);
    const branchName = targetSession.branch.replace('refs/heads/', '');

    logger.info('Session switched', {
      branch: branchName,
      path: targetSession.path,
    });

    console.log(chalk.green(`✓ Switched to ${chalk.bold(branchName)}`));
    console.log(chalk.dim(`  Path: ${targetSession.path}`));

    // List tmux sessions in the new directory
    listTmuxSessions();
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
    } else if (line.trim() === '' && current.path) {
      sessions.push(current as Session);
      current = {};
    }
  }

  if (current.path && current.head) {
    sessions.push(current as Session);
  }

  return sessions.filter((s) => s.branch); // Only return sessions with branches
}

export function getSessionsQuietly(): Session[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    return parseWorktreeOutput(output);
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

export function listTmuxSessions(): void {
  try {
    const output = execSync('tmux list-sessions', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const cgwtSessions = output
      .split('\n')
      .filter((line) => line.includes('cgwt-'))
      .map((line) => line.split(':')[0]);

    if (cgwtSessions.length > 0) {
      console.log(chalk.cyan('\nTmux Sessions:'));
      cgwtSessions.forEach((session) => {
        console.log(chalk.dim(`  - ${session}`));
      });
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
