#!/usr/bin/env node

import { Command } from 'commander';
import { ClaudeGWTApp } from './ClaudeGWTApp';
import { theme } from './ui/theme';
import type { CLIOptions } from '../types';

const program = new Command();

program
  .name('claude-gwt')
  .description('Git Worktree Manager with Claude Code Orchestration')
  .version('1.0.0')
  .argument('[path]', 'Directory path (defaults to current directory)', '.')
  .option('-r, --repo <url>', 'Git repository URL')
  .option('-b, --branch <name>', 'Branch name')
  .option('-i, --interactive', 'Run in interactive mode (default)', true)
  .option('-q, --quiet', 'Suppress banner and decorative output')
  .option('-j, --json', 'Output results as JSON')
  .action(async (path: string, options: CLIOptions) => {
    try {
      const app = new ClaudeGWTApp(path, options);
      await app.run();
    } catch (error) {
      if (!options.quiet) {
        console.error(theme.error('\n✖ Fatal error:'), error);
      }
      process.exit(1);
    }
  });

program.parse();