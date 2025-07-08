import type { DirectoryState, GitWorktreeInfo, SessionConfig } from '../types/index.js';

export interface IGitDetector {
  detectState(basePath: string): Promise<DirectoryState>;
}

export interface IGitRepository {
  initializeBareRepository(repoUrl?: string): Promise<{ defaultBranch: string }>;
  getDefaultBranch(): Promise<string>;
  fetch(): Promise<void>;
  canConvertToWorktree(): Promise<{ canConvert: boolean; reason?: string }>;
  convertToWorktreeSetup(): Promise<{ defaultBranch: string; originalPath: string }>;
}

export interface IWorktreeManager {
  listWorktrees(): Promise<GitWorktreeInfo[]>;
  addWorktree(branchName: string, baseBranch?: string): Promise<string>;
  removeWorktree(branchName: string): Promise<void>;
}

export interface ITmuxManager {
  getSessionName(repoName: string, branch: string): string;
  launchSession(config: SessionConfig): Promise<void>;
}

export interface ILogger {
  info(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  warn(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
}

export interface IFileSystem {
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  access(path: string): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

export interface IPrompts {
  promptForRepoUrl(): Promise<string | undefined>;
  promptForBranchName(defaultBranch: string): Promise<string>;
  promptForWorktreeAction(
    worktrees: GitWorktreeInfo[],
    currentBranch: string,
  ): Promise<WorktreeAction>;
  promptForParentAction(worktrees: GitWorktreeInfo[]): Promise<WorktreeAction>;
  promptForGitRepoAction(): Promise<'convert' | 'continue' | 'exit'>;
  promptToInitialize(): Promise<boolean>;
  promptForNewBranchName(existingWorktrees: GitWorktreeInfo[]): Promise<string>;
  promptForBaseBranch(worktrees: GitWorktreeInfo[], defaultBranch: string): Promise<string>;
  confirmAction(message: string): Promise<boolean>;
}

export interface ISpinner {
  start(): void;
  setText(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export interface ITheme {
  info(text: string): string;
  error(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  primary(text: string): string;
  muted(text: string): string;
  branch(name: string): string;
}

export interface IBanner {
  (): void;
}

export interface ISimpleGit {
  status(): Promise<{ current: string | null }>;
}

export type WorktreeAction =
  | { type: 'launch' }
  | { type: 'switch'; branch?: string }
  | { type: 'create' }
  | { type: 'remove'; branch?: string }
  | { type: 'quit' };
