#!/usr/bin/env node

/**
 * cgwt - Quick session switcher for Claude GWT
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as path from 'path';

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
  }
});

function listSessions(): void {
  try {
    // Check if we're in a git worktree
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim();

    if (!gitDir.includes('.bare')) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
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

    // Get current directory
    const cwd = process.cwd();

    console.log(chalk.bold('Claude GWT Sessions:'));
    console.log();

    sessions.forEach((session, index) => {
      const isCurrent = path.resolve(session.path) === path.resolve(cwd);
      const marker = isCurrent ? chalk.green('→') : ' ';
      const branchName = session.branch ?? 'detached';
      const shortPath = path.basename(session.path);

      console.log(
        `${marker} ${chalk.bold(index + 1)} ${chalk.cyan(branchName)} ${chalk.gray(`(${shortPath})`)}`,
      );
    });
  } catch (error) {
    console.error(chalk.red('Error listing sessions:'), error);
  }
}

function switchSession(target: string): void {
  try {
    // Check if we're in a git worktree
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim();

    if (!gitDir.includes('.bare')) {
      console.log(chalk.yellow('Not in a Claude GWT managed repository'));
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
      const index = Number(target) - 1;
      if (index >= 0 && index < sessions.length) {
        targetSession = sessions[index];
      } else {
        console.error(chalk.red(`Invalid index: ${target}`));
        console.log(chalk.gray(`Available indices: 1-${sessions.length}`));
        return;
      }
    } else {
      // Target is branch name
      targetSession = sessions.find((s) => s.branch === target);
      if (!targetSession) {
        console.error(chalk.red(`Branch not found: ${target}`));
        console.log(chalk.gray('Available branches:'));
        sessions.forEach((s) => console.log(chalk.gray(`  - ${s.branch ?? 'detached'}`)));
        return;
      }
    }

    // Change to the target directory
    if (targetSession) {
      console.log(
        chalk.green(`Switching to ${targetSession.branch ?? 'session'} at ${targetSession.path}`),
      );
      console.log();
      console.log(chalk.gray('Run this command to change directory:'));
      console.log(chalk.bold(`  cd ${targetSession.path}`));
    }
  } catch (error) {
    console.error(chalk.red('Error switching session:'), error);
  }
}

program.parse();
