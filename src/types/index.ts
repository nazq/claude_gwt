export interface GitWorktreeInfo {
  path: string;
  branch: string;
  isLocked: boolean;
  prunable: boolean;
  HEAD: string;
}

export interface ClaudeInstanceConfig {
  id: string;
  worktreePath: string;
  branch: string;
  type: 'master' | 'child';
  status: 'idle' | 'active' | 'processing' | 'error';
  parentId?: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'command' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: Date;
}

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface DirectoryState {
  type: 'empty' | 'git-worktree' | 'git-repo' | 'non-git' | 'claude-gwt-parent';
  path: string;
  gitInfo?: {
    isWorktree: boolean;
    isBareRepo: boolean;
    branch?: string;
    remote?: string;
  };
}

export interface CLIOptions {
  repo?: string;
  branch?: string;
  interactive?: boolean;
  quiet?: boolean;
  json?: boolean;
  verbose?: boolean;
  veryVerbose?: boolean;
  debug?: boolean;
}
