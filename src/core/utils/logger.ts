import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug';

export class Logger {
  private static logFile: string;
  private static stream: fs.WriteStream | null = null;
  private static currentLevel: LogLevel = 'warn';
  private static readonly levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
  };

  static {
    // Initialize the logger with a simple log file in the current directory
    this.logFile = path.join(process.cwd(), '.claude-gwt.log');

    // Initialize write stream - overwrites on each run
    this.stream = fs.createWriteStream(this.logFile, { flags: 'w' });

    // Ensure log file is in .gitignore
    this.ensureGitIgnore();

    // Log startup
    this.info('Claude GWT logger initialized', { logFile: this.logFile, cwd: process.cwd() });
  }

  private static ensureGitIgnore(): void {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const logFileName = '.claude-gwt.log';

    try {
      // Check if .gitignore exists
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');

        // Check if our log file is already ignored
        if (!content.includes(logFileName)) {
          // Add it to .gitignore
          const newContent = content.trim() + '\n\n# Claude GWT log file\n' + logFileName + '\n';
          fs.writeFileSync(gitignorePath, newContent);
        }
      }
    } catch (error) {
      // Silently ignore errors - we don't want logging setup to fail
    }
  }

  static setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.info('Log level changed', { level });
  }

  private static shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  private static formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
  }

  static info(message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('INFO', message, data);
    this.stream?.write(formatted);
    // Never log to console to preserve UX
  }

  static error(message: string, error?: any): void {
    if (!this.shouldLog('error')) return;
    const errorData =
      error instanceof Error
        ? {
            errorMessage: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error;

    const formatted = this.formatMessage('ERROR', message, errorData);
    this.stream?.write(formatted);
    // Never log to console to preserve UX
  }

  static debug(message: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('DEBUG', message, data);
    this.stream?.write(formatted);
    // Never log to console to preserve UX
  }

  static warn(message: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('WARN', message, data);
    this.stream?.write(formatted);
    // Never log to console to preserve UX
  }

  static verbose(message: string, data?: any): void {
    if (!this.shouldLog('verbose')) return;
    const formatted = this.formatMessage('VERBOSE', message, data);
    this.stream?.write(formatted);
    // Never log to console to preserve UX
  }

  static getLogPath(): string {
    return this.logFile;
  }

  static close(): void {
    this.stream?.end();
  }
}
