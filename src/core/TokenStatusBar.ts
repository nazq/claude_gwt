import { execSync } from 'child_process';
import { TokenTracker } from './TokenTracker';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class TokenStatusBar {
  private static UPDATE_INTERVAL = 5000; // Update every 5 seconds
  private static statusFile = path.join(os.homedir(), '.claude-gwt', 'usage', 'status.txt');

  /**
   * Generate status bar content for current session
   */
  static generateStatus(): string {
    const tracker = TokenTracker.getInstance();
    const session = tracker.getCurrentSessionUsage();

    if (!session) {
      return '🟢 Ready';
    }

    const totalTokens = session.totalInputTokens + session.totalOutputTokens;
    const cost = session.totalCost;

    // Format tokens with K/M suffix
    const formatTokens = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    // Warning indicators
    let indicator = '🟢';
    if (cost > 5) indicator = '🟡';
    if (cost > 10) indicator = '🔴';

    // Build more concise status string
    const status = [indicator, `${formatTokens(totalTokens)} tokens`, `$${cost.toFixed(2)}`].join(
      ' ',
    );

    return status;
  }

  /**
   * Update tmux status bar with token info
   */
  static updateTmuxStatus(sessionName: string): void {
    try {
      const status = this.generateStatus();

      // Update tmux status line
      execSync(`tmux set-option -t ${sessionName} status-right "${status} | %H:%M"`, {
        stdio: 'ignore',
      });
    } catch (error) {
      // Ignore errors - tmux session might not exist
    }
  }

  /**
   * Start continuous status bar updates
   */
  static startUpdates(sessionName: string): NodeJS.Timeout {
    // Initial update
    this.updateTmuxStatus(sessionName);

    // Set up interval
    return setInterval(() => {
      this.updateTmuxStatus(sessionName);
      this.writeStatusFile();
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Write status to file for external monitoring
   */
  private static writeStatusFile(): void {
    const status = this.generateStatus();
    const dir = path.dirname(this.statusFile);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.statusFile, status);
  }

  /**
   * Configure tmux for token display
   */
  static configureTmux(sessionName: string): void {
    try {
      // Enable status bar
      execSync(`tmux set-option -t ${sessionName} status on`, { stdio: 'ignore' });

      // Configure status bar appearance
      execSync(`tmux set-option -t ${sessionName} status-bg colour235`, { stdio: 'ignore' });
      execSync(`tmux set-option -t ${sessionName} status-fg colour136`, { stdio: 'ignore' });
      execSync(`tmux set-option -t ${sessionName} status-left-length 30`, { stdio: 'ignore' });
      execSync(`tmux set-option -t ${sessionName} status-right-length 60`, { stdio: 'ignore' });

      // Set initial status
      this.updateTmuxStatus(sessionName);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Get warning message if approaching limits
   */
  static getWarningMessage(): string | null {
    const tracker = TokenTracker.getInstance();
    const session = tracker.getCurrentSessionUsage();

    if (!session) return null;

    const totalTokens = session.totalInputTokens + session.totalOutputTokens;
    const cost = session.totalCost;

    // Token warnings
    if (totalTokens > 100000) {
      return chalk.red('⚠️  High token usage! Consider starting a new session.');
    }

    // Cost warnings
    if (cost > 10) {
      return chalk.red(
        `⚠️  High cost session: $${cost.toFixed(2)}. Consider breaking into smaller tasks.`,
      );
    }

    if (cost > 5) {
      return chalk.yellow(`💡 Moderate usage: $${cost.toFixed(2)}`);
    }

    return null;
  }

  /**
   * Display inline token count (for real-time display)
   */
  static displayInline(): void {
    const status = this.generateStatus();

    // Clear line and display status
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    process.stdout.write(status);
  }

  /**
   * Create a dashboard view for token usage
   */
  static createDashboard(): string {
    const tracker = TokenTracker.getInstance();
    const session = tracker.getCurrentSessionUsage();
    const todayStats = tracker.getTodayStats();

    if (!session) {
      return 'No active session';
    }

    const lines = [
      '╔══════════════════════════════════════╗',
      '║      Claude Token Usage Dashboard     ║',
      '╠══════════════════════════════════════╣',
      `║ Session: ${session.projectName}/${session.branch}`.padEnd(39) + '║',
      `║ Duration: ${this.getDuration(session.startTime)}`.padEnd(39) + '║',
      '╟──────────────────────────────────────╢',
      `║ Input Tokens:  ${this.padNumber(session.totalInputTokens)}`.padEnd(39) + '║',
      `║ Output Tokens: ${this.padNumber(session.totalOutputTokens)}`.padEnd(39) + '║',
      `║ Total Tokens:  ${this.padNumber(session.totalInputTokens + session.totalOutputTokens)}`.padEnd(
        39,
      ) + '║',
      '╟──────────────────────────────────────╢',
      `║ Current Cost:  $${session.totalCost.toFixed(4)}`.padEnd(39) + '║',
      `║ Today Total:   $${todayStats.totalCost.toFixed(2)}`.padEnd(39) + '║',
      '╟──────────────────────────────────────╢',
      `║ Conversations: ${session.conversationCount}`.padEnd(39) + '║',
      `║ Avg per Conv:  ${this.padNumber(Math.round((session.totalInputTokens + session.totalOutputTokens) / (session.conversationCount || 1)))}`.padEnd(
        39,
      ) + '║',
      '╚══════════════════════════════════════╝',
    ];

    return lines.join('\n');
  }

  private static getDuration(startTime: Date | string): string {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const now = new Date();
    const diff = now.getTime() - start.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private static padNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`.padStart(7);
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`.padStart(7);
    return num.toString().padStart(7);
  }
}
