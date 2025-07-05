/**
 * Service adapters for improving separation of concerns
 */

import type {
  IGitRepository,
  IWorktreeManager,
  ITmuxManager,
  ILogger,
  IErrorBoundary,
} from './interfaces';
import type { SessionConfig, SessionInfo } from '../../sessions/TmuxManager';
import type { GitWorktreeInfo } from '../../types';
import { errorBoundary as defaultErrorBoundary } from './ErrorBoundary';
import { Logger } from '../utils/logger';

/**
 * Git service adapter that adds error handling and logging
 */
export class GitServiceAdapter implements IGitRepository, IWorktreeManager {
  constructor(
    private readonly gitRepo: IGitRepository,
    private readonly worktreeManager: IWorktreeManager,
    private readonly errorBoundary: IErrorBoundary = defaultErrorBoundary,
    private readonly logger: ILogger = Logger,
  ) {}

  // IGitRepository methods
  async getCurrentBranch(): Promise<string> {
    return this.errorBoundary.handle(
      () => this.gitRepo.getCurrentBranch(),
      'GitService.getCurrentBranch',
    );
  }

  async getDefaultBranch(): Promise<string> {
    return this.errorBoundary.handle(
      () => this.gitRepo.getDefaultBranch(),
      'GitService.getDefaultBranch',
    );
  }

  async initializeBareRepository(repoUrl?: string): Promise<{ defaultBranch: string }> {
    this.logger.info('Initializing bare repository', { repoUrl: repoUrl ?? 'local' });
    return this.errorBoundary.handle(
      () => this.gitRepo.initializeBareRepository(repoUrl),
      'GitService.initializeBareRepository',
    );
  }

  async convertToWorktreeSetup(): Promise<{ defaultBranch: string }> {
    this.logger.info('Converting repository to worktree setup');
    return this.errorBoundary.handle(
      () => this.gitRepo.convertToWorktreeSetup(),
      'GitService.convertToWorktreeSetup',
    );
  }

  async canConvertToWorktree(): Promise<{ canConvert: boolean; reason?: string }> {
    return this.errorBoundary.handle(
      () => this.gitRepo.canConvertToWorktree(),
      'GitService.canConvertToWorktree',
    );
  }

  async fetch(): Promise<void> {
    this.logger.info('Fetching repository updates');
    return this.errorBoundary.handle(() => this.gitRepo.fetch(), 'GitService.fetch');
  }

  // IWorktreeManager methods
  async listWorktrees(): Promise<GitWorktreeInfo[]> {
    return this.errorBoundary.handle(
      () => this.worktreeManager.listWorktrees(),
      'GitService.listWorktrees',
    );
  }

  async addWorktree(branchName: string, baseBranch?: string): Promise<string> {
    this.logger.info('Adding worktree', { branchName, baseBranch });
    return this.errorBoundary.handle(
      () => this.worktreeManager.addWorktree(branchName, baseBranch),
      'GitService.addWorktree',
    );
  }

  async removeWorktree(branchName: string): Promise<void> {
    this.logger.info('Removing worktree', { branchName });
    return this.errorBoundary.handle(
      () => this.worktreeManager.removeWorktree(branchName),
      'GitService.removeWorktree',
    );
  }
}

/**
 * Tmux service adapter that adds error handling and logging
 */
export class TmuxServiceAdapter implements ITmuxManager {
  constructor(
    private readonly tmuxManager: ITmuxManager,
    private readonly errorBoundary: IErrorBoundary = defaultErrorBoundary,
    private readonly logger: ILogger = Logger,
  ) {}

  async isTmuxAvailable(): Promise<boolean> {
    return this.errorBoundary.handle(
      () => this.tmuxManager.isTmuxAvailable(),
      'TmuxService.isTmuxAvailable',
    );
  }

  isInsideTmux(): boolean {
    return this.errorBoundary.handleSync(
      () => this.tmuxManager.isInsideTmux(),
      'TmuxService.isInsideTmux',
    );
  }

  async getSessionInfo(sessionName: string): Promise<SessionInfo | null> {
    return this.errorBoundary.handle(
      () => this.tmuxManager.getSessionInfo(sessionName),
      'TmuxService.getSessionInfo',
    );
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.errorBoundary.handle(
      () => this.tmuxManager.listSessions(),
      'TmuxService.listSessions',
    );
  }

  async launchSession(config: SessionConfig): Promise<void> {
    this.logger.info('Launching tmux session', {
      sessionName: config.sessionName,
      role: config.role,
      branchName: config.branchName,
    });
    return this.errorBoundary.handle(
      () => this.tmuxManager.launchSession(config),
      'TmuxService.launchSession',
    );
  }

  async createDetachedSession(config: SessionConfig): Promise<void> {
    this.logger.info('Creating detached tmux session', {
      sessionName: config.sessionName,
      role: config.role,
      branchName: config.branchName,
    });
    return this.errorBoundary.handle(
      () => this.tmuxManager.createDetachedSession(config),
      'TmuxService.createDetachedSession',
    );
  }

  async attachToSession(sessionName: string): Promise<void> {
    this.logger.info('Attaching to tmux session', { sessionName });
    return this.errorBoundary.handle(
      () => this.tmuxManager.attachToSession(sessionName),
      'TmuxService.attachToSession',
    );
  }

  async killSession(sessionName: string): Promise<void> {
    this.logger.info('Killing tmux session', { sessionName });
    return this.errorBoundary.handle(
      () => this.tmuxManager.killSession(sessionName),
      'TmuxService.killSession',
    );
  }

  async shutdownAll(): Promise<void> {
    this.logger.info('Shutting down all tmux sessions');
    return this.errorBoundary.handle(
      () => this.tmuxManager.shutdownAll(),
      'TmuxService.shutdownAll',
    );
  }
}

/**
 * Caching adapter that adds caching capabilities to any service
 */
export class CachingAdapter<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();

  constructor(
    private readonly service: T,
    private readonly ttlMs: number = 5000, // 5 seconds default TTL
  ) {}

  /**
   * Create a cached version of a method
   */
  cached<TArgs extends readonly unknown[], TReturn>(
    method: (...args: TArgs) => Promise<TReturn>,
    cacheKeyFn?: (...args: TArgs) => string,
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const cacheKey = cacheKeyFn ? cacheKeyFn(...args) : JSON.stringify(args);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.ttlMs) {
        return cached.value as unknown as TReturn;
      }

      const result = await method(...args);
      this.cache.set(cacheKey, { value: result as unknown as T, timestamp: Date.now() });
      return result;
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the underlying service
   */
  getService(): T {
    return this.service;
  }
}

/**
 * Retry adapter that adds retry logic to any service
 */
export class RetryAdapter<T> {
  constructor(
    private readonly service: T,
    private readonly maxRetries: number = 3,
    private readonly delayMs: number = 1000,
  ) {}

  /**
   * Create a retryable version of a method
   */
  retryable<TArgs extends readonly unknown[], TReturn>(
    method: (...args: TArgs) => Promise<TReturn>,
    shouldRetry?: (error: unknown) => boolean,
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      let lastError: unknown;
      let delay = this.delayMs;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          return await method(...args);
        } catch (error) {
          lastError = error;

          // Check if we should retry this error
          if (shouldRetry && !shouldRetry(error)) {
            throw error;
          }

          // Don't retry on the last attempt
          if (attempt === this.maxRetries) {
            break;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }

      throw lastError;
    };
  }

  /**
   * Get the underlying service
   */
  getService(): T {
    return this.service;
  }
}
