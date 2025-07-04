import {
  ClaudeGWTError,
  GitOperationError,
  ClaudeInstanceError,
  DirectoryStateError,
  MessageRoutingError,
  GitCloneError,
  GitInitError,
  GitFetchError,
  WorktreeError,
} from '../../../../src/core/errors/CustomErrors';

describe('CustomErrors', () => {
  describe('ClaudeGWTError', () => {
    it('should create error with message and code', () => {
      const error = new ClaudeGWTError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ClaudeGWTError');
      expect(error.stack).toBeDefined();
    });
  });

  describe('GitOperationError', () => {
    it('should create error with operation', () => {
      const error = new GitOperationError('Git failed', 'commit');

      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(GitOperationError);
      expect(error.message).toBe('Git failed');
      expect(error.operation).toBe('commit');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('GitOperationError');
    });
  });

  describe('ClaudeInstanceError', () => {
    it('should create error with instance ID', () => {
      const error = new ClaudeInstanceError('Instance failed', 'instance-123');

      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(ClaudeInstanceError);
      expect(error.message).toBe('Instance failed');
      expect(error.instanceId).toBe('instance-123');
      expect(error.code).toBe('CLAUDE_INSTANCE_ERROR');
      expect(error.name).toBe('ClaudeInstanceError');
    });
  });

  describe('DirectoryStateError', () => {
    it('should create error with directory type', () => {
      const error = new DirectoryStateError('Invalid directory', 'worktree');

      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(DirectoryStateError);
      expect(error.message).toBe('Invalid directory');
      expect(error.directoryType).toBe('worktree');
      expect(error.code).toBe('DIRECTORY_STATE_ERROR');
      expect(error.name).toBe('DirectoryStateError');
    });
  });

  describe('MessageRoutingError', () => {
    it('should create error with message ID', () => {
      const error = new MessageRoutingError('Routing failed', 'msg-456');

      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(MessageRoutingError);
      expect(error.message).toBe('Routing failed');
      expect(error.messageId).toBe('msg-456');
      expect(error.code).toBe('MESSAGE_ROUTING_ERROR');
      expect(error.name).toBe('MessageRoutingError');
    });
  });

  describe('GitCloneError', () => {
    it('should create clone error', () => {
      const error = new GitCloneError('Clone failed');

      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(GitCloneError);
      expect(error.message).toBe('Clone failed');
      expect(error.operation).toBe('clone');
      expect(error.name).toBe('GitCloneError');
    });
  });

  describe('GitInitError', () => {
    it('should create init error', () => {
      const error = new GitInitError('Init failed');

      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(GitInitError);
      expect(error.message).toBe('Init failed');
      expect(error.operation).toBe('init');
      expect(error.name).toBe('GitInitError');
    });
  });

  describe('GitFetchError', () => {
    it('should create fetch error', () => {
      const error = new GitFetchError('Fetch failed');

      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(GitFetchError);
      expect(error.message).toBe('Fetch failed');
      expect(error.operation).toBe('fetch');
      expect(error.name).toBe('GitFetchError');
    });
  });

  describe('WorktreeError', () => {
    it('should create worktree error with default operation', () => {
      const error = new WorktreeError('Worktree failed');

      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(WorktreeError);
      expect(error.message).toBe('Worktree failed');
      expect(error.operation).toBe('worktree');
      expect(error.name).toBe('WorktreeError');
    });

    it('should create worktree error with custom operation', () => {
      const error = new WorktreeError('Worktree add failed', 'worktree-add');

      expect(error.operation).toBe('worktree-add');
    });
  });

  describe('Error inheritance', () => {
    it('should maintain instanceof chain', () => {
      const cloneError = new GitCloneError('Test');

      expect(cloneError instanceof Error).toBe(true);
      expect(cloneError instanceof ClaudeGWTError).toBe(true);
      expect(cloneError instanceof GitOperationError).toBe(true);
      expect(cloneError instanceof GitCloneError).toBe(true);
    });

    it('should have proper stack traces', () => {
      const error = new ClaudeGWTError('Stack test', 'STACK_TEST');

      expect(error.stack).toContain('ClaudeGWTError');
      expect(error.stack).toContain('Stack test');
    });
  });
});
