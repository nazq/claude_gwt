#!/usr/bin/env node

/**
 * cgwt - Quick session switcher for Claude GWT
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { logger } from '../core/utils/logger.js';

interface Session {
  path: string;
  branch: string;
  head: string;
}

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
    console.error(chalk.red(`Invalid argument: ${index}`));
    console.log(chalk.gray('Usage: cgwt [index] or cgwt l or cgwt s <branch>'));
    logger.warn('Invalid argument provided', { argument: index });
  }
});

function listSessions(): void {
  try {
    // Check if we're in a git worktree
    let gitDir: string;
    try {
      gitDir = execSync('git rev-parse --git-dir', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch (e) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
      logger.warn('Not in a Claude GWT managed repository', { operation: 'list' });
      return;
    }

    if (!gitDir.includes('.bare')) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
      logger.warn('Not in a Claude GWT managed repository', { operation: 'check' });
      return;
    }

    // Get list of worktrees
    const worktrees = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const sessions: Session[] = [];

    const lines = worktrees.split('\n');
    let currentSession: Partial<Session> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentSession.path = line.substring(9);
      } else if (line.startsWith('HEAD ')) {
        currentSession.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentSession.branch = line.substring(7);
      } else if (line === '') {
        if (currentSession.path) {
          sessions.push({
            path: currentSession.path,
            branch: currentSession.branch ?? '',
            head: currentSession.head ?? '',
          });
          currentSession = {};
        }
      }
    }

    // Get current tmux session if we're inside tmux
    let currentTmuxSession = '';
    if (process.env['TMUX']) {
      try {
        currentTmuxSession = execSync('tmux display-message -p "#S"', { encoding: 'utf8' }).trim();
      } catch (e) {
        // Ignore errors
      }
    }

    // Get repo name from current path
    const cwdParts = process.cwd().split('/');
    const currentRepoName = cwdParts[cwdParts.length - 2] ?? '';

    // Detect main branch
    let mainBranch = 'main';
    try {
      // First try to get from origin HEAD
      const headRef = execSync('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      const match = headRef.match(/refs\/remotes\/origin\/(.+)/);
      if (match?.[1]) {
        mainBranch = match[1].trim();
      }
    } catch {
      // If origin HEAD not set, try to detect from bare repo config
      try {
        const bareConfig = execSync('git -C .bare symbolic-ref HEAD 2>/dev/null', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        const bareMatch = bareConfig.match(/refs\/heads\/(.+)/);
        if (bareMatch?.[1]) {
          mainBranch = bareMatch[1].trim();
        }
      } catch {
        // Final fallback: check which branches exist
        const branches = sessions.map((s) => {
          let branch = s.branch;
          if (branch.startsWith('refs/heads/')) {
            branch = branch.substring(11);
          }
          return branch;
        });

        // Check for common main branch names
        if (branches.includes('main')) {
          mainBranch = 'main';
        } else if (branches.includes('master')) {
          mainBranch = 'master';
        }
      }
    }

    console.log(chalk.hex('#00D9FF')('\n📋 Claude GWT Sessions:'));
    logger.info('Listing sessions', { sessionCount: sessions.length });

    sessions.forEach((session, index) => {
      // Determine if this is the current session
      let isCurrent = false;

      if (index === 0 && session.path.includes('.bare')) {
        // Supervisor session
        const expectedSessionName = `cgwt-${currentRepoName}-supervisor`;
        isCurrent = currentTmuxSession === expectedSessionName;

        const status = isCurrent ? chalk.green('●') : chalk.gray('○');
        const supLabel = chalk.magenta('[SUP]');
        const row = `  ${status} ${chalk.dim('[0]')} ${supLabel}`;

        if (isCurrent) {
          console.log(chalk.bgGreenBright.black(row + ' '.repeat(Math.max(0, 40 - row.length))));
        } else {
          console.log(row);
        }
        return;
      }

      // Regular branch session
      let branchName = session.branch ?? 'detached';
      if (branchName.startsWith('refs/heads/')) {
        branchName = branchName.substring(11);
      }

      const expectedSessionName = `cgwt-${currentRepoName}-${branchName}`.replace(
        /[^a-zA-Z0-9_-]/g,
        '-',
      );
      isCurrent = currentTmuxSession === expectedSessionName;

      const status = isCurrent ? chalk.green('●') : chalk.gray('○');
      const indexNum = chalk.dim(`[${index}]`);

      // Different color for main branch vs feature branches
      const branchColor =
        branchName === mainBranch
          ? chalk.yellow(branchName) // Yellow for main branch
          : chalk.hex('#00D9FF')(branchName); // Cyan for feature branches

      const row = `  ${status} ${indexNum} ${branchColor}`;

      if (isCurrent) {
        // Add padding to make background consistent width
        console.log(chalk.bgGreenBright.black(row + ' '.repeat(Math.max(0, 40 - row.length))));
      } else {
        console.log(row);
      }
    });

    console.log(chalk.gray('\nSwitch with: cgwt <number> or cgwt s <branch>'));
    logger.debug('Session list displayed');
  } catch (error) {
    console.error(chalk.red('Error listing sessions:'), error);
    logger.error('Error listing sessions', error);
  }
}

function switchSession(target: string): void {
  try {
    // Check if we're in a git worktree
    let gitDir: string;
    try {
      gitDir = execSync('git rev-parse --git-dir', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch (e) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
      logger.warn('Not in a Claude GWT managed repository', { operation: 'check' });
      return;
    }

    if (!gitDir.includes('.bare')) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
      logger.warn('Not in a Claude GWT managed repository', { operation: 'check' });
      return;
    }

    // Get list of worktrees
    const worktrees = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const sessions: Session[] = [];

    const lines = worktrees.split('\n');
    let currentSession: Partial<Session> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentSession.path = line.substring(9);
      } else if (line.startsWith('HEAD ')) {
        currentSession.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentSession.branch = line.substring(7);
      } else if (line === '') {
        if (currentSession.path) {
          sessions.push({
            path: currentSession.path,
            branch: currentSession.branch ?? '',
            head: currentSession.head ?? '',
          });
          currentSession = {};
        }
      }
    }

    let targetSession;

    // Check if target is numeric (index)
    if (!isNaN(Number(target))) {
      const index = Number(target);
      if (index >= 0 && index < sessions.length) {
        targetSession = sessions[index];
      } else {
        console.error(chalk.red(`Invalid index: ${target}`));
        console.log(chalk.gray(`Available indices: 0-${sessions.length - 1}`));
        logger.error('Invalid index provided', { target, validRange: `0-${sessions.length - 1}` });
        return;
      }
    } else {
      // Target is branch name - check both with and without refs/heads/ prefix
      targetSession = sessions.find((s) => {
        const branch = s.branch;
        const cleanBranch = branch.startsWith('refs/heads/') ? branch.substring(11) : branch;
        return cleanBranch === target || branch === target;
      });
      if (!targetSession) {
        console.error(chalk.red(`Branch not found: ${target}`));
        console.log(chalk.gray('Available branches:'));
        const availableBranches: string[] = [];
        sessions.forEach((s) => {
          let branchName = s.branch ?? 'detached';
          if (branchName.startsWith('refs/heads/')) {
            branchName = branchName.substring(11);
          }
          availableBranches.push(branchName);
          console.log(chalk.gray(`  - ${branchName}`));
        });
        logger.error('Branch not found', { target, availableBranches });
        return;
      }
    }

    // Switch to the target session
    if (targetSession) {
      let branchDisplay = targetSession.branch ?? 'session';
      if (branchDisplay.startsWith('refs/heads/')) {
        branchDisplay = branchDisplay.substring(11);
      }

      // Handle supervisor session specially
      let sessionName: string;
      if (targetSession.path.includes('.bare')) {
        // This is the supervisor session
        const pathParts = targetSession.path.split('/');
        const repoName = pathParts[pathParts.length - 2] ?? 'claude-gwt';
        sessionName = `cgwt-${repoName}-supervisor`;
        console.log(chalk.green(`Switching to supervisor...`));
        logger.info('Switching to supervisor session');
      } else {
        // Regular branch session
        const pathParts = targetSession.path.split('/');
        const repoName = pathParts[pathParts.length - 2] ?? 'claude-gwt';
        sessionName = `cgwt-${repoName}-${branchDisplay}`.replace(/[^a-zA-Z0-9_-]/g, '-');
        console.log(chalk.green(`Switching to ${branchDisplay}...`));
        logger.info('Switching to branch session', { branch: branchDisplay });
      }

      // Check if we're inside tmux
      const isInsideTmux = process.env['TMUX'] !== undefined;

      try {
        if (isInsideTmux) {
          // If inside tmux, use switch-client
          execSync(`tmux switch-client -t ${sessionName}`, { stdio: 'inherit' });
        } else {
          // If outside tmux, attach to the session
          execSync(`tmux attach-session -t ${sessionName}`, { stdio: 'inherit' });
        }
      } catch (error) {
        // Session might not exist, fall back to cd command
        console.log(chalk.yellow('\nTmux session not found. You can start it with:'));
        console.log(chalk.bold(`  cd ${targetSession.path} && claude-gwt`));
        console.log(chalk.gray('\nOr just change directory:'));
        console.log(chalk.bold(`  cd ${targetSession.path}`));
        logger.warn('Tmux session not found', { sessionName, targetPath: targetSession.path });
      }
    }
  } catch (error) {
    console.error(chalk.red('Error switching session:'), error);
    logger.error('Error switching session', error, { target });
  }
}

program.parse();
