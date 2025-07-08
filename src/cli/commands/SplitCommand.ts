import chalk from 'chalk';
import { execCommandSafe } from '../../core/utils/async.js';
import { logger } from '../../core/utils/logger.js';
import { TmuxDriver } from '../../sessions/TmuxDriver.js';
import type { Session } from '../cgwt-program.js';

export interface SplitCommandOptions {
  horizontal?: boolean;
  vertical?: boolean;
  percentage?: string;
}

export class SplitCommand {
  /**
   * Execute the split pane command
   */
  static async execute(
    target: string | undefined,
    options: SplitCommandOptions,
    getSessionsFn: () => Promise<Session[]>,
  ): Promise<void> {
    try {
      // Check if we're inside tmux
      if (!TmuxDriver.isInsideTmux()) {
        this.printNotInTmuxError();
        return;
      }

      // Determine split direction
      const splitFlag = options.horizontal ? '-v' : '-h';
      const percentage = parseInt(options.percentage ?? '50', 10);

      // Build the command to run in the new pane
      const command = await this.buildPaneCommand(target, getSessionsFn);
      if (!command) return; // Error already printed

      // Execute the split
      const result = await execCommandSafe('tmux', [
        'split-window',
        splitFlag,
        '-c',
        '#{pane_current_path}',
        '-p',
        percentage.toString(),
        command,
      ]);

      if (result.code !== 0) {
        console.log(chalk.red('Failed to split pane:'), result.stderr);
      }
    } catch (error) {
      logger.error('Failed to split pane', error);
      console.log(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Build the command to run in the new pane
   */
  private static async buildPaneCommand(
    target: string | undefined,
    getSessionsFn: () => Promise<Session[]>,
  ): Promise<string | null> {
    if (!target) {
      // No target - show helper in new pane
      return `echo 'New pane created! Available cgwt sessions:'; cgwt -l; echo ''; echo 'Run: cgwt -a <index> to attach to a session'; echo 'Run: cgwt tips for keyboard shortcuts'; echo ''; bash`;
    }

    // If target specified, determine what type it is
    if (this.isIndexFormat(target)) {
      // Multi-project index format (x.y) or numeric index
      return `cgwt -a ${target}`;
    }

    // Branch name - need to find its index
    const sessions = await getSessionsFn();
    const matchingSession = sessions.find((s) => s.branch === target);

    if (matchingSession) {
      const index = sessions.indexOf(matchingSession) + 1;
      return `cgwt -a ${index}`;
    }

    // Branch not found
    this.printBranchNotFound(target, sessions);
    return null;
  }

  /**
   * Check if target is in index format (x.y or numeric)
   */
  private static isIndexFormat(target: string): boolean {
    return target.includes('.') || !isNaN(Number(target));
  }

  /**
   * Print error when not in tmux
   */
  private static printNotInTmuxError(): void {
    console.log(chalk.red('Error: Not inside a tmux session'));
    console.log(chalk.yellow('Splits only work when already in a cgwt session'));
  }

  /**
   * Print error when branch not found
   */
  private static printBranchNotFound(target: string, sessions: Session[]): void {
    console.log(chalk.red(`Branch "${target}" not found`));
    console.log(chalk.yellow('Available branches:'));
    sessions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.branch}`);
    });
  }
}
