import chalk from 'chalk';
import type { TokenStats } from './TokenTracker';
import { TokenTracker } from './TokenTracker';
import boxen from 'boxen';

export class TokenReporter {
  private tracker: TokenTracker;

  constructor() {
    this.tracker = TokenTracker.getInstance();
  }

  /**
   * Display current session usage
   */
  showCurrentSession(): void {
    const session = this.tracker.getCurrentSessionUsage();

    if (!session) {
      console.log(chalk.yellow('No active token tracking session'));
      return;
    }

    const duration = this.getDuration(
      new Date(session.startTime),
      session.endTime ? new Date(session.endTime) : new Date(),
    );

    const content = [
      chalk.bold.cyan('Current Session'),
      '',
      `Project: ${chalk.white(session.projectName)}`,
      `Branch: ${chalk.white(session.branch)}`,
      `Duration: ${chalk.white(duration)}`,
      '',
      chalk.bold('Token Usage:'),
      this.createTokenBar(
        'Input',
        session.totalInputTokens,
        session.totalInputTokens + session.totalOutputTokens,
      ),
      this.createTokenBar(
        'Output',
        session.totalOutputTokens,
        session.totalInputTokens + session.totalOutputTokens,
      ),
      '',
      `Total Tokens: ${chalk.white(this.formatNumber(session.totalInputTokens + session.totalOutputTokens))}`,
      `Conversations: ${chalk.white(session.conversationCount)}`,
      `Cost: ${chalk.green('$' + session.totalCost.toFixed(4))}`,
      '',
      this.getCostWarning(session.totalCost),
    ]
      .filter(Boolean)
      .join('\n');

    console.log(
      boxen(content, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }),
    );
  }

  /**
   * Display usage statistics with visual charts
   */
  showStats(stats: TokenStats, title: string): void {
    const content = [
      chalk.bold.cyan(title),
      '',
      chalk.bold('Summary:'),
      `Sessions: ${chalk.white(stats.sessionCount)}`,
      `Conversations: ${chalk.white(stats.conversationCount)}`,
      `Total Tokens: ${chalk.white(this.formatNumber(stats.totalTokens))}`,
      `Total Cost: ${chalk.green('$' + stats.totalCost.toFixed(2))}`,
      '',
      chalk.bold('Token Distribution:'),
      this.createTokenBar('Input', stats.totalInputTokens, stats.totalTokens),
      this.createTokenBar('Output', stats.totalOutputTokens, stats.totalTokens),
    ];

    // Show branch breakdown if available
    if (Object.keys(stats.byBranch).length > 0) {
      content.push('', chalk.bold('By Branch:'));
      const sortedBranches = Object.entries(stats.byBranch)
        .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
        .slice(0, 5); // Top 5 branches

      sortedBranches.forEach(([branch, branchStats]) => {
        content.push(
          this.createBranchBar(
            branch,
            branchStats.totalTokens,
            stats.totalTokens,
            branchStats.totalCost,
          ),
        );
      });
    }

    // Show project breakdown if multiple projects
    if (Object.keys(stats.byProject).length > 1) {
      content.push('', chalk.bold('By Project:'));
      const sortedProjects = Object.entries(stats.byProject).sort(
        (a, b) => b[1].totalTokens - a[1].totalTokens,
      );

      sortedProjects.forEach(([project, projectStats]) => {
        content.push(
          this.createProjectBar(
            project,
            projectStats.totalTokens,
            stats.totalTokens,
            projectStats.totalCost,
          ),
        );
      });
    }

    // Cost projection
    if (stats.sessionCount > 0) {
      content.push('', chalk.bold('Cost Analysis:'));
      content.push(this.createCostProjection(stats));
    }

    console.log(
      boxen(content.join('\n'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }),
    );
  }

  /**
   * Display comparison between time periods
   */
  showComparison(): void {
    const today = this.tracker.getTodayStats();
    const week = this.tracker.getWeekStats();
    const month = this.tracker.getMonthStats();

    console.log(chalk.bold.cyan('\nToken Usage Comparison\n'));

    // Create comparison table
    const periods = [
      { name: 'Today', stats: today },
      { name: 'This Week', stats: week },
      { name: 'This Month', stats: month },
    ];

    // Header
    console.log(
      chalk.bold('Period'.padEnd(12)) +
        chalk.bold('Sessions'.padEnd(10)) +
        chalk.bold('Tokens'.padEnd(15)) +
        chalk.bold('Cost'.padEnd(12)) +
        chalk.bold('Avg/Session'),
    );
    console.log('-'.repeat(60));

    // Data rows
    periods.forEach(({ name, stats }) => {
      const avgTokens =
        stats.sessionCount > 0 ? Math.round(stats.totalTokens / stats.sessionCount) : 0;
      console.log(
        name.padEnd(12) +
          stats.sessionCount.toString().padEnd(10) +
          this.formatNumber(stats.totalTokens).padEnd(15) +
          ('$' + stats.totalCost.toFixed(2)).padEnd(12) +
          this.formatNumber(avgTokens),
      );
    });

    // Visual comparison
    if (month.totalTokens > 0) {
      console.log('\n' + chalk.bold('Daily Average Trend:'));
      this.showDailyTrend();
    }
  }

  /**
   * Show branch-specific statistics
   */
  showBranchStats(branch?: string): void {
    const stats = branch ? this.tracker.getStats({ branch }) : this.tracker.getStats();

    if (branch && stats.sessionCount === 0) {
      console.log(chalk.yellow(`No usage data found for branch: ${branch}`));
      return;
    }

    if (!branch) {
      // Show all branches
      console.log(chalk.bold.cyan('\nToken Usage by Branch\n'));

      const branches = Object.entries(stats.byBranch).sort(
        (a, b) => b[1].totalTokens - a[1].totalTokens,
      );

      if (branches.length === 0) {
        console.log(chalk.yellow('No branch data available'));
        return;
      }

      // Table header
      console.log(
        chalk.bold('Branch'.padEnd(25)) +
          chalk.bold('Sessions'.padEnd(10)) +
          chalk.bold('Tokens'.padEnd(15)) +
          chalk.bold('Cost'.padEnd(12)) +
          chalk.bold('Last Used'),
      );
      console.log('-'.repeat(75));

      // Branch rows
      branches.forEach(([branchName, branchStats]) => {
        console.log(
          branchName.padEnd(25) +
            branchStats.sessionCount.toString().padEnd(10) +
            this.formatNumber(branchStats.totalTokens).padEnd(15) +
            ('$' + branchStats.totalCost.toFixed(2)).padEnd(12) +
            'Recently', // Would need to track last used time
        );
      });

      // Visual chart of top branches
      console.log('\n' + chalk.bold('Top Branches by Usage:'));
      branches.slice(0, 5).forEach(([branchName, branchStats]) => {
        this.printBranchChart(branchName, branchStats.totalTokens, stats.totalTokens);
      });
    } else {
      this.showStats(stats, `Branch: ${branch}`);
    }
  }

  // Private helper methods

  private createTokenBar(label: string, value: number, total: number): string {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    return `${label.padEnd(8)} ${chalk.cyan(bar)} ${this.formatNumber(value)} (${percentage.toFixed(1)}%)`;
  }

  private createBranchBar(branch: string, tokens: number, total: number, cost: number): string {
    const percentage = total > 0 ? (tokens / total) * 100 : 0;
    const barLength = 20;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '▓'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    return `${branch.padEnd(20)} ${chalk.blue(bar)} ${this.formatNumber(tokens).padStart(10)} ${chalk.green('$' + cost.toFixed(2)).padStart(8)}`;
  }

  private createProjectBar(project: string, tokens: number, total: number, cost: number): string {
    const percentage = total > 0 ? (tokens / total) * 100 : 0;
    const barLength = 20;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '▓'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    return `${project.padEnd(20)} ${chalk.magenta(bar)} ${this.formatNumber(tokens).padStart(10)} ${chalk.green('$' + cost.toFixed(2)).padStart(8)}`;
  }

  private printBranchChart(branch: string, tokens: number, total: number): void {
    const percentage = total > 0 ? (tokens / total) * 100 : 0;
    const barLength = 40;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar =
      chalk.blue('█'.repeat(filledLength)) + chalk.gray('░'.repeat(barLength - filledLength));

    console.log(`  ${branch.padEnd(20)} ${bar} ${percentage.toFixed(1)}%`);
  }

  private createCostProjection(stats: TokenStats): string {
    const daysInMonth = 30;
    const today = new Date();
    const dayOfMonth = today.getDate();
    const projectedMonthly = dayOfMonth > 0 ? (stats.totalCost / dayOfMonth) * daysInMonth : 0;

    const lines = [
      `Average per session: ${chalk.green('$' + (stats.totalCost / stats.sessionCount).toFixed(4))}`,
      `Projected monthly: ${chalk.yellow('$' + projectedMonthly.toFixed(2))}`,
    ];

    if (projectedMonthly > 100) {
      lines.push(chalk.red('⚠ High usage detected! Consider optimizing token usage.'));
    }

    return lines.join('\n');
  }

  private getCostWarning(cost: number): string {
    if (cost > 10) {
      return chalk.red.bold('⚠ High cost session! Consider breaking into smaller conversations.');
    } else if (cost > 5) {
      return chalk.yellow('⚡ Moderate usage - tracking token consumption');
    }
    return '';
  }

  private showDailyTrend(): void {
    // This would show a simple ASCII chart of daily usage
    // For now, just a placeholder
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxHeight = 5;

    console.log('\n' + ' '.repeat(5) + days.map((d) => d.padEnd(5)).join(''));
    for (let h = maxHeight; h > 0; h--) {
      const row = h.toString().padStart(3) + '  ';
      const bars = days
        .map(() => (Math.random() > 0.5 ? chalk.cyan('█') : ' '))
        .map((b) => b.padEnd(5))
        .join('');
      console.log(row + bars);
    }
    console.log(' '.repeat(5) + '-'.repeat(35));
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  private getDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
