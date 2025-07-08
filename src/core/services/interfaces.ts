/**
 * Service interfaces for dependency injection
 */

import type { SessionConfig, SessionInfo } from '../../sessions/TmuxManager.js';
import type { DirectoryState, GitWorktreeInfo } from '../../types/index.js';
import type { ExecResult } from '../utils/async.js';

/**
 * Git repository operations interface
 */
export interface IGitRepository {
  getCurrentBranch(): Promise<string>;
  getDefaultBranch(): Promise<string>;
  initializeBareRepository(repoUrl?: string): Promise<{ defaultBranch: string }>;
  convertToWorktreeSetup(): Promise<{ defaultBranch: string }>;
  canConvertToWorktree(): Promise<{ canConvert: boolean; reason?: string }>;
  fetch(): Promise<void>;
}

/**
 * Worktree management interface
 */
export interface IWorktreeManager {
  listWorktrees(): Promise<GitWorktreeInfo[]>;
  addWorktree(branchName: string, baseBranch?: string): Promise<string>;
  removeWorktree(branchName: string): Promise<void>;
}

/**
 * Git state detection interface
 */
export interface IGitDetector {
  detectState(): Promise<DirectoryState>;
}

/**
 * Configuration management interface
 */
export interface IConfigManager {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  getContext(projectName: string, branchName: string, role: 'supervisor' | 'child'): string | null;
}

/**
 * Tmux session management interface
 */
export interface ITmuxManager {
  isTmuxAvailable(): Promise<boolean>;
  isInsideTmux(): boolean;
  getSessionInfo(sessionName: string): Promise<SessionInfo | null>;
  listSessions(): Promise<SessionInfo[]>;
  launchSession(config: SessionConfig): Promise<void>;
  createDetachedSession(config: SessionConfig): Promise<void>;
  attachToSession(sessionName: string): Promise<void>;
  killSession(sessionName: string): Promise<void>;
  shutdownAll(): Promise<void>;
}

/**
 * Tmux driver interface for low-level tmux operations
 */
export interface ITmuxDriver {
  isAvailable(): Promise<boolean>;
  isInsideTmux(): boolean;
  listSessions(): Promise<
    Array<{ name: string; windows: number; created: Date; attached: boolean }>
  >;
  getSession(
    sessionName: string,
  ): Promise<{ name: string; windows: number; created: Date; attached: boolean } | null>;
  createSession(options: {
    sessionName: string;
    workingDirectory?: string;
    windowName?: string;
    detached?: boolean;
    command?: string;
  }): Promise<ExecResult>;
  killSession(sessionName: string): Promise<ExecResult>;
  sendKeys(target: string, keys: string[], sendEnter?: boolean): Promise<ExecResult>;
  setOption(target: string, option: string, value: string, global?: boolean): Promise<ExecResult>;
}

/**
 * Logging interface
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  verbose(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Service factory interface
 */
export interface IServiceFactory<T> {
  create(...args: unknown[]): T;
}

/**
 * Application context interface
 */
export interface IApplicationContext {
  basePath: string;
  options: {
    repo?: string;
    quiet?: boolean;
    interactive?: boolean;
  };
}

/**
 * Error boundary interface
 */
export interface IErrorBoundary {
  handle<T>(operation: () => Promise<T>, context?: string): Promise<T>;
  handleSync<T>(operation: () => T, context?: string): T;
}
