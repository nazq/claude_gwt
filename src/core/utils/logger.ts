import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  sessionId?: string;
  branchName?: string;
  operation?: string;
  worktreePath?: string;
  userId?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  private baseLogger: pino.Logger;
  private context: LogContext;

  constructor(options?: {
    name?: string;
    level?: LogLevel;
    isDevelopment?: boolean;
    context?: LogContext;
  }) {
    const isDev = options?.isDevelopment ?? process.env['NODE_ENV'] === 'development';

    // For testing: Use pino-test for proper test logging
    const isTest =
      process.env['NODE_ENV'] === 'test' ||
      process.env['VITEST'] !== undefined ||
      process.env['NODE_ENV'] === 'testing';

    const pinoOptions: pino.LoggerOptions = {
      name: options?.name ?? 'claude-gwt',
      level: options?.level ?? (isDev ? 'debug' : 'info'),
      base: {
        pid: process.pid,
        hostname: undefined, // Remove hostname for cleaner logs
      },
    };

    if (isTest) {
      // Testing mode: Use pino-test for proper testing
      pinoOptions.level = 'silent';
      this.baseLogger = pino(pinoOptions);
    } else if (isDev) {
      // Development: beautiful pretty print to stdout
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
          hideObject: false,
          messageFormat: '{msg}',
          customPrettifiers: {
            time: (timestamp: string): string => `🕐 ${timestamp}`,
            level: (logLevel: string): string => {
              const levelEmojis: Record<string, string> = {
                trace: '🔍',
                debug: '🐛',
                info: '📋',
                warn: '⚠️',
                error: '❌',
                fatal: '💀',
              };
              return `${levelEmojis[logLevel] ?? '📋'} ${logLevel.toUpperCase()}`;
            },
            operation: (operation: string): string => `⚡ ${operation}`,
            branchName: (branch: string): string => `🌿 ${branch}`,
            sessionId: (id: string): string => `🎯 ${id}`,
            worktreePath: (path: string): string => `📁 ${path}`,
            duration: (ms: number): string => `⏱️ ${ms}ms`,
            logType: (type: string): string => {
              const typeEmojis: Record<string, string> = {
                success: '✅',
                failure: '❌',
                progress: '🔄',
                milestone: '🎉',
              };
              return typeEmojis[type] ?? type;
            },
            err: (error: Error): string => `💥 ${error.name}: ${error.message}`,
            error: (error: unknown): string => `💥 ${JSON.stringify(error)}`,
          },
          messageKey: 'msg',
          levelKey: 'level',
          timestampKey: 'time',
        },
      };
      this.baseLogger = pino(pinoOptions);
    } else {
      // Production: JSON to file
      const logFile = path.join(process.cwd(), '.claude-gwt.log');
      const dest = pino.destination({
        dest: logFile,
        sync: false,
      });

      this.baseLogger = pino(pinoOptions, dest);
      this.ensureGitIgnore();
    }

    this.context = options?.context ?? {};
  }

  private ensureGitIgnore(): void {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const logFileName = '.claude-gwt.log';

    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');

        if (!content.includes(logFileName)) {
          const newContent = content.trim() + '\n\n# Claude GWT log file\n' + logFileName + '\n';
          fs.writeFileSync(gitignorePath, newContent);
        }
      }
    } catch (_error) {
      // Silently ignore errors
    }
  }

  // Context binding (like structlog)
  bind(newContext: LogContext): StructuredLogger {
    return new StructuredLogger({
      name: this.baseLogger.bindings()['name'] as string,
      level: this.baseLogger.level as LogLevel,
      context: { ...this.context, ...newContext },
    });
  }

  // Sub-logger creation
  child(bindings: LogContext): StructuredLogger {
    // Create a new StructuredLogger instance but use the child pino logger
    const newLogger = new StructuredLogger({
      name: this.baseLogger.bindings()['name'] as string,
      level: this.baseLogger.level as LogLevel,
      context: { ...this.context, ...bindings },
    });
    // Replace the base logger with the child logger to maintain proper parent-child relationship
    newLogger.baseLogger = this.baseLogger.child(bindings);
    return newLogger;
  }

  // Structured logging methods with beautiful formatting
  info(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.info({ ...this.context, ...fields }, message);
  }

  error(message: string, error?: unknown, fields?: Record<string, unknown>): void {
    const errorData =
      error instanceof Error
        ? { err: error } // Pino has special handling for 'err' field
        : { error };

    this.baseLogger.error({ ...this.context, ...errorData, ...fields }, message);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.debug({ ...this.context, ...fields }, message);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.warn({ ...this.context, ...fields }, message);
  }

  fatal(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.fatal({ ...this.context, ...fields }, message);
  }

  trace(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.trace({ ...this.context, ...fields }, message);
  }

  // Enhanced logging methods with emojis for development
  success(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.info({ ...this.context, ...fields, logType: 'success' }, `✅ ${message}`);
  }

  failure(message: string, error?: unknown, fields?: Record<string, unknown>): void {
    const errorData = error instanceof Error ? { err: error } : { error };

    this.baseLogger.error(
      { ...this.context, ...errorData, ...fields, logType: 'failure' },
      `❌ ${message}`,
    );
  }

  progress(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.info({ ...this.context, ...fields, logType: 'progress' }, `🔄 ${message}`);
  }

  milestone(message: string, fields?: Record<string, unknown>): void {
    this.baseLogger.info({ ...this.context, ...fields, logType: 'milestone' }, `🎉 ${message}`);
  }

  // Timing operations (performance logging)
  time(label: string): () => void {
    const start = Date.now();
    return (): void => {
      const duration = Date.now() - start;
      this.debug('Operation completed', { operation: label, duration });
    };
  }

  // Git operation context
  forGitOperation(operation: string, branch?: string): StructuredLogger {
    return this.bind({ operation, branchName: branch });
  }

  // Worktree context
  forWorktree(path: string, branch: string): StructuredLogger {
    return this.bind({ worktreePath: path, branchName: branch });
  }

  // Session context
  forSession(sessionId: string): StructuredLogger {
    return this.bind({ sessionId });
  }

  // Network operation context
  forNetworkOperation(operation: string, url: string): StructuredLogger {
    return this.bind({ operation, url, type: 'network' });
  }

  // Verbose logging (mapped to trace)
  verbose(message: string, fields?: Record<string, unknown>): void {
    this.trace(message, fields);
  }

  // Level checking
  isLevelEnabled(level: LogLevel): boolean {
    return this.baseLogger.isLevelEnabled(level);
  }

  // Cleanup
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.baseLogger.flush();
      resolve();
    });
  }
}

// Factory function
export function createLogger(options?: {
  name?: string;
  level?: LogLevel;
  isDevelopment?: boolean;
  context?: LogContext;
}): StructuredLogger {
  return new StructuredLogger(options);
}

// Default logger instance (lazy initialization)
let _defaultLogger: StructuredLogger | null = null;
export const logger = {
  get instance(): StructuredLogger {
    if (!_defaultLogger) {
      _defaultLogger = createLogger({ name: 'claude-gwt' });
    }
    return _defaultLogger;
  },
  // Proxy methods to the instance
  info: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.info(message, fields),
  error: (message: string, error?: unknown, fields?: Record<string, unknown>): void =>
    logger.instance.error(message, error, fields),
  debug: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.debug(message, fields),
  warn: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.warn(message, fields),
  fatal: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.fatal(message, fields),
  trace: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.trace(message, fields),
  success: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.success(message, fields),
  failure: (message: string, error?: unknown, fields?: Record<string, unknown>): void =>
    logger.instance.failure(message, error, fields),
  progress: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.progress(message, fields),
  milestone: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.milestone(message, fields),
  time: (label: string): (() => void) => logger.instance.time(label),
  forGitOperation: (operation: string, branch?: string): StructuredLogger =>
    logger.instance.forGitOperation(operation, branch),
  forWorktree: (path: string, branch: string): StructuredLogger =>
    logger.instance.forWorktree(path, branch),
  forSession: (sessionId: string): StructuredLogger => logger.instance.forSession(sessionId),
  forNetworkOperation: (operation: string, url: string): StructuredLogger =>
    logger.instance.forNetworkOperation(operation, url),
  verbose: (message: string, fields?: Record<string, unknown>): void =>
    logger.instance.verbose(message, fields),
  isLevelEnabled: (level: LogLevel): boolean => logger.instance.isLevelEnabled(level),
  flush: (): Promise<void> => logger.instance.flush(),
  bind: (context: LogContext): StructuredLogger => logger.instance.bind(context),
  child: (bindings: LogContext): StructuredLogger => logger.instance.child(bindings),
};

// Backward compatibility exports
export const Logger = {
  info: (message: string, data?: unknown): void =>
    logger.info(message, data as Record<string, unknown>),
  error: (message: string, error?: unknown): void => logger.error(message, error),
  debug: (message: string, data?: unknown): void =>
    logger.debug(message, data as Record<string, unknown>),
  warn: (message: string, data?: unknown): void =>
    logger.warn(message, data as Record<string, unknown>),
  verbose: (message: string, data?: unknown): void =>
    logger.trace(message, data as Record<string, unknown>), // Map verbose to trace
  // Enhanced methods for beautiful logging
  success: (message: string, data?: unknown): void =>
    logger.success(message, data as Record<string, unknown>),
  failure: (message: string, error?: unknown, data?: unknown): void =>
    logger.failure(message, error, data as Record<string, unknown>),
  progress: (message: string, data?: unknown): void =>
    logger.progress(message, data as Record<string, unknown>),
  milestone: (message: string, data?: unknown): void =>
    logger.milestone(message, data as Record<string, unknown>),
  setLogLevel: (_level: LogLevel): void => {
    // Note: Pino doesn't support runtime level changes on the same instance
    // This is a limitation we'll document
    logger.warn('setLogLevel not supported in Pino - create new logger instance');
  },
  getLogPath: (): string => path.join(process.cwd(), '.claude-gwt.log'),
  close: async (): Promise<void> => logger.flush(),
};
