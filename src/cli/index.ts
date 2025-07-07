#!/usr/bin/env node

import chalk from 'chalk';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Show deprecation warning
console.log(chalk.yellow('\n⚠️  WARNING: claude-gwt is deprecated!'));
console.log(chalk.yellow('   Please use "cgwt" instead.'));
console.log(chalk.yellow('   All functionality has been moved to the unified cgwt command.\n'));

// Map claude-gwt commands to cgwt equivalents
const args = process.argv.slice(2);
let cgwtArgs: string[] = [];

// Check specific commands first
if (args[0] === 'logs') {
  // Map "claude-gwt logs" to "cgwt app logs"
  cgwtArgs = ['app', 'logs'];
} else if (args.length > 0 && args[0] && !args[0].startsWith('-')) {
  // This is likely "claude-gwt [path]" - map to "cgwt app" (guided) in that directory
  console.log(chalk.dim(`Note: Switching to directory '${args[0]}' first...`));
  process.chdir(args[0]);
  cgwtArgs = ['app'];
} else if (args.length === 0 || args.every((arg) => arg.startsWith('-'))) {
  // No path argument, likely interactive mode - map to "cgwt app" (guided)
  cgwtArgs = ['app', ...args.filter((arg) => arg.startsWith('-'))]; // Keep flags
} else {
  // Pass through other arguments with app prefix
  cgwtArgs = ['app', ...args];
}

console.log(chalk.dim(`Redirecting to: cgwt ${cgwtArgs.join(' ')}\n`));

// Execute cgwt with mapped arguments
const cgwtPath = join(__dirname, 'cgwt.js');
const cgwt = spawn('node', [cgwtPath, ...cgwtArgs], {
  stdio: 'inherit',
  env: process.env,
});

cgwt.on('exit', (code) => {
  process.exit(code ?? 0);
});
