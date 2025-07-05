export class ClaudeGWTError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ClaudeGWTError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitOperationError extends ClaudeGWTError {
  constructor(
    message: string,
    public readonly operation: string,
  ) {
    super(message, 'GIT_OPERATION_ERROR');
    this.name = 'GitOperationError';
  }
}

export class ClaudeInstanceError extends ClaudeGWTError {
  constructor(
    message: string,
    public readonly instanceId: string,
  ) {
    super(message, 'CLAUDE_INSTANCE_ERROR');
    this.name = 'ClaudeInstanceError';
  }
}

export class DirectoryStateError extends ClaudeGWTError {
  constructor(
    message: string,
    public readonly directoryType: string,
  ) {
    super(message, 'DIRECTORY_STATE_ERROR');
    this.name = 'DirectoryStateError';
  }
}

export class MessageRoutingError extends ClaudeGWTError {
  constructor(
    message: string,
    public readonly messageId: string,
  ) {
    super(message, 'MESSAGE_ROUTING_ERROR');
    this.name = 'MessageRoutingError';
  }
}

export class GitCloneError extends GitOperationError {
  constructor(message: string) {
    super(message, 'clone');
    this.name = 'GitCloneError';
  }
}

export class GitInitError extends GitOperationError {
  constructor(message: string) {
    super(message, 'init');
    this.name = 'GitInitError';
  }
}

export class GitFetchError extends GitOperationError {
  constructor(message: string) {
    super(message, 'fetch');
    this.name = 'GitFetchError';
  }
}

export class WorktreeError extends GitOperationError {
  constructor(message: string, operation: string = 'worktree') {
    super(message, operation);
    this.name = 'WorktreeError';
  }
}
