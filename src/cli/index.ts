#!/usr/bin/env node

import { Command } from 'commander';
import { ClaudeGWTApp } from './ClaudeGWTApp.js';
import { theme } from './ui/theme.js';
import { Logger } from '../core/utils/logger.js';
import type { CLIOptions } from '../types/index.js';

const program = new Command();

program
  .name('claude-gwt')
  .description('Git Worktree Manager with Claude Code Orchestration')
  .version('0.2.3-beta.0');

// Main command
program
  .argument('[path]', 'Directory path (defaults to current directory)', '.')
  .option('-r, --repo <url>', 'Git repository URL')
  .option('-b, --branch <name>', 'Branch name')
  .option('-i, --interactive', 'Run in interactive mode', true)
  .option('-n, --no-interactive', 'Run in non-interactive mode')
  .option('-q, --quiet', 'Suppress banner and decorative output')
  .option('-j, --json', 'Output results as JSON')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('-vv, --very-verbose', 'Enable very verbose logging', false)
  .option('-vvv, --debug', 'Enable debug logging', false)
  .action(async (path: string, options: CLIOptions) => {
    // Set log level based on verbosity
    if (options.debug) {
      Logger.setLogLevel('debug');
    } else if (options.veryVerbose) {
      Logger.setLogLevel('trace');
    } else if (options.verbose) {
      Logger.setLogLevel('info');
    } else {
      Logger.setLogLevel('warn');
    }

    Logger.info('CLI started', { path, options });
    try {
      const app = new ClaudeGWTApp(path, options);
      await app.run();
    } catch (error) {
      Logger.error('CLI fatal error', error);
      if (!options.quiet) {
        console.error(theme.error('\n✖ Fatal error:'), error);
        console.error(theme.muted(`\nCheck logs at: .claude-gwt.log`));
      }
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('Show log file location')
  .action(() => {
    console.log(theme.info('Log file location:'));
    console.log(theme.muted('.claude-gwt.log'));
  });

// Main entry point
async function main(): Promise<void> {
  try {
    await program.parseAsync();
  } catch (error) {
    console.error('Unexpected error:', error);
    Logger.error('Unexpected CLI error', error);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  Logger.error('Fatal CLI error in main', error);
  process.exit(1);
});
