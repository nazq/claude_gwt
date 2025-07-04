#!/usr/bin/env node

import { TokenTracker } from '../core/TokenTracker';
import { TokenReporter } from '../core/TokenReporter';
import { TokenStatusBar } from '../core/TokenStatusBar';
import { program } from 'commander';
import chalk from 'chalk';

program.name('cgwt-tokens').description('Claude GWT Token Usage Reporter').version('1.0.0');

program
  .command('current')
  .description('Show current session token usage')
  .action(() => {
    const reporter = new TokenReporter();
    reporter.showCurrentSession();
  });

program
  .command('today')
  .description("Show today's token usage")
  .action(() => {
    const tracker = TokenTracker.getInstance();
    const reporter = new TokenReporter();
    const stats = tracker.getTodayStats();
    reporter.showStats(stats, "Today's Usage");
  });

program
  .command('week')
  .description("Show this week's token usage")
  .action(() => {
    const tracker = TokenTracker.getInstance();
    const reporter = new TokenReporter();
    const stats = tracker.getWeekStats();
    reporter.showStats(stats, "This Week's Usage");
  });

program
  .command('month')
  .description("Show this month's token usage")
  .action(() => {
    const tracker = TokenTracker.getInstance();
    const reporter = new TokenReporter();
    const stats = tracker.getMonthStats();
    reporter.showStats(stats, "This Month's Usage");
  });

program
  .command('branch [name]')
  .description('Show token usage by branch')
  .action((name?: string) => {
    const reporter = new TokenReporter();
    reporter.showBranchStats(name);
  });

program
  .command('compare')
  .description('Compare token usage across time periods')
  .action(() => {
    const reporter = new TokenReporter();
    reporter.showComparison();
  });

program
  .command('export <format> [filename]')
  .description('Export token usage data (csv or json)')
  .action((format: string, filename?: string) => {
    const tracker = TokenTracker.getInstance();
    const outputFile = filename ?? `claude-usage-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      tracker.exportToCSV(`${outputFile}.csv`);
      console.log(chalk.green(`✓ Exported usage data to ${outputFile}.csv`));
    } else if (format === 'json') {
      tracker.exportToJSON(`${outputFile}.json`);
      console.log(chalk.green(`✓ Exported usage data to ${outputFile}.json`));
    } else {
      console.error(chalk.red('Error: Format must be "csv" or "json"'));
      process.exit(1);
    }
  });

program
  .command('cost')
  .description('Show cost analysis and projections')
  .action(() => {
    const tracker = TokenTracker.getInstance();

    const today = tracker.getTodayStats();
    const week = tracker.getWeekStats();
    const month = tracker.getMonthStats();

    console.log(chalk.bold.cyan('\nCost Analysis\n'));

    // Current costs
    console.log(chalk.bold('Current Costs:'));
    console.log(`  Today:      ${chalk.green('$' + today.totalCost.toFixed(2))}`);
    console.log(`  This Week:  ${chalk.green('$' + week.totalCost.toFixed(2))}`);
    console.log(`  This Month: ${chalk.green('$' + month.totalCost.toFixed(2))}`);

    // Projections
    console.log('\n' + chalk.bold('Projections:'));
    const daysInMonth = 30;
    const dayOfMonth = new Date().getDate();
    const projectedMonthly = dayOfMonth > 0 ? (month.totalCost / dayOfMonth) * daysInMonth : 0;
    const projectedYearly = projectedMonthly * 12;

    console.log(`  Monthly:    ${chalk.yellow('$' + projectedMonthly.toFixed(2))}`);
    console.log(`  Yearly:     ${chalk.yellow('$' + projectedYearly.toFixed(2))}`);

    // Cost breakdown
    if (month.sessionCount > 0) {
      console.log('\n' + chalk.bold('Average Costs:'));
      console.log(
        `  Per Session:      ${chalk.cyan('$' + (month.totalCost / month.sessionCount).toFixed(4))}`,
      );
      console.log(
        `  Per Conversation: ${chalk.cyan('$' + (month.totalCost / month.conversationCount).toFixed(4))}`,
      );
      console.log(
        `  Per 1K Tokens:    ${chalk.cyan('$' + (month.totalCost / (month.totalTokens / 1000)).toFixed(4))}`,
      );
    }

    // Warnings
    if (projectedMonthly > 100) {
      console.log(
        '\n' + chalk.red.bold('⚠️  High usage warning! Consider optimizing token usage.'),
      );
    } else if (projectedMonthly > 50) {
      console.log('\n' + chalk.yellow('⚡ Moderate usage - monitor token consumption'));
    } else {
      console.log('\n' + chalk.green('✓ Usage within normal range'));
    }
  });

program
  .command('dashboard')
  .description('Show real-time token usage dashboard')
  .action(() => {
    const tracker = TokenTracker.getInstance();
    const session = tracker.getCurrentSessionUsage();

    if (!session) {
      console.log(chalk.yellow('No active session'));
      return;
    }

    // Clear screen and show dashboard
    console.clear();

    const updateDashboard = (): void => {
      const dashboard = TokenStatusBar.createDashboard();
      console.log('\x1B[H'); // Move cursor to top
      console.log(dashboard);

      // Show warnings if any
      const warning = TokenStatusBar.getWarningMessage();
      if (warning) {
        console.log('\n' + warning);
      }
    };

    // Initial display
    updateDashboard();

    // Update every 5 seconds
    const interval = setInterval(updateDashboard, 5000);

    // Handle exit
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log('\n\nExiting dashboard...');
      process.exit(0);
    });

    console.log('\n\nPress Ctrl+C to exit dashboard');
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
