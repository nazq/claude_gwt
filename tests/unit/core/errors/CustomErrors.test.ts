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
      const error = new ClaudeGWTError('Test error message', 'TEST_CODE');

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ClaudeGWTError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClaudeGWTError);
    });

    it('should capture stack trace', () => {
      const error = new ClaudeGWTError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new ClaudeGWTError('Throwable error', 'THROW_TEST');
      }).toThrow('Throwable error');

      try {
        throw new ClaudeGWTError('Catchable error', 'CATCH_TEST');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeGWTError);
        expect((error as ClaudeGWTError).code).toBe('CATCH_TEST');
      }
    });
  });

  describe('GitOperationError', () => {
    it('should create git operation error with operation details', () => {
      const error = new GitOperationError('Git command failed', 'checkout');

      expect(error.message).toBe('Git command failed');
      expect(error.operation).toBe('checkout');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('GitOperationError');
      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(GitOperationError);
    });

    it('should inherit from ClaudeGWTError', () => {
      const error = new GitOperationError('Test git error', 'commit');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(GitOperationError);
    });
  });

  describe('ClaudeInstanceError', () => {
    it('should create Claude instance error with instance ID', () => {
      const error = new ClaudeInstanceError('Claude instance crashed', 'instance-123');

      expect(error.message).toBe('Claude instance crashed');
      expect(error.instanceId).toBe('instance-123');
      expect(error.code).toBe('CLAUDE_INSTANCE_ERROR');
      expect(error.name).toBe('ClaudeInstanceError');
      expect(error).toBeInstanceOf(ClaudeGWTError);
    });

    it('should handle empty instance ID', () => {
      const error = new ClaudeInstanceError('Instance error', '');

      expect(error.instanceId).toBe('');
      expect(error.code).toBe('CLAUDE_INSTANCE_ERROR');
    });
  });

  describe('DirectoryStateError', () => {
    it('should create directory state error with directory type', () => {
      const error = new DirectoryStateError('Invalid directory state', 'git-worktree');

      expect(error.message).toBe('Invalid directory state');
      expect(error.directoryType).toBe('git-worktree');
      expect(error.code).toBe('DIRECTORY_STATE_ERROR');
      expect(error.name).toBe('DirectoryStateError');
      expect(error).toBeInstanceOf(ClaudeGWTError);
    });

    it('should handle various directory types', () => {
      const types = ['empty', 'non-git', 'git-repo', 'claude-gwt-parent'];

      types.forEach((type) => {
        const error = new DirectoryStateError(`Error in ${type}`, type);
        expect(error.directoryType).toBe(type);
        expect(error.code).toBe('DIRECTORY_STATE_ERROR');
      });
    });
  });

  describe('MessageRoutingError', () => {
    it('should create message routing error with message ID', () => {
      const error = new MessageRoutingError('Failed to route message', 'msg-456');

      expect(error.message).toBe('Failed to route message');
      expect(error.messageId).toBe('msg-456');
      expect(error.code).toBe('MESSAGE_ROUTING_ERROR');
      expect(error.name).toBe('MessageRoutingError');
      expect(error).toBeInstanceOf(ClaudeGWTError);
    });

    it('should handle UUID-style message IDs', () => {
      const messageId = '550e8400-e29b-41d4-a716-446655440000';
      const error = new MessageRoutingError('Routing failed', messageId);

      expect(error.messageId).toBe(messageId);
    });
  });

  describe('GitCloneError', () => {
    it('should create git clone error', () => {
      const error = new GitCloneError('Failed to clone repository');

      expect(error.message).toBe('Failed to clone repository');
      expect(error.operation).toBe('clone');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('GitCloneError');
      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(ClaudeGWTError);
    });

    it('should inherit git operation error properties', () => {
      const error = new GitCloneError('Clone timeout');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClaudeGWTError);
      expect(error).toBeInstanceOf(GitOperationError);
      expect(error).toBeInstanceOf(GitCloneError);
    });
  });

  describe('GitInitError', () => {
    it('should create git init error', () => {
      const error = new GitInitError('Failed to initialize repository');

      expect(error.message).toBe('Failed to initialize repository');
      expect(error.operation).toBe('init');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('GitInitError');
      expect(error).toBeInstanceOf(GitOperationError);
    });
  });

  describe('GitFetchError', () => {
    it('should create git fetch error', () => {
      const error = new GitFetchError('Failed to fetch from remote');

      expect(error.message).toBe('Failed to fetch from remote');
      expect(error.operation).toBe('fetch');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('GitFetchError');
      expect(error).toBeInstanceOf(GitOperationError);
    });

    it('should handle network-related fetch errors', () => {
      const error = new GitFetchError('Network timeout during fetch');

      expect(error.message).toBe('Network timeout during fetch');
      expect(error.operation).toBe('fetch');
    });
  });

  describe('WorktreeError', () => {
    it('should create worktree error with default operation', () => {
      const error = new WorktreeError('Worktree operation failed');

      expect(error.message).toBe('Worktree operation failed');
      expect(error.operation).toBe('worktree');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('WorktreeError');
      expect(error).toBeInstanceOf(GitOperationError);
    });

    it('should create worktree error with custom operation', () => {
      const error = new WorktreeError('Failed to add worktree', 'add');

      expect(error.message).toBe('Failed to add worktree');
      expect(error.operation).toBe('add');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
      expect(error.name).toBe('WorktreeError');
    });

    it('should handle different worktree operations', () => {
      const operations = ['add', 'remove', 'list', 'prune', 'lock', 'unlock'];

      operations.forEach((operation) => {
        const error = new WorktreeError(`${operation} failed`, operation);
        expect(error.operation).toBe(operation);
        expect(error.name).toBe('WorktreeError');
      });
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper inheritance for all error types', () => {
      const errors = [
        new ClaudeGWTError('test', 'TEST'),
        new GitOperationError('test', 'test'),
        new ClaudeInstanceError('test', 'test'),
        new DirectoryStateError('test', 'test'),
        new MessageRoutingError('test', 'test'),
        new GitCloneError('test'),
        new GitInitError('test'),
        new GitFetchError('test'),
        new WorktreeError('test'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ClaudeGWTError);
        expect(error.stack).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(typeof error.name).toBe('string');
        expect(typeof error.code).toBe('string');
      });
    });

    it('should allow catching specific error types', () => {
      const testError = (): void => {
        throw new GitCloneError('Clone failed');
      };

      expect(() => testError()).toThrow(GitCloneError);
      expect(() => testError()).toThrow(GitOperationError);
      expect(() => testError()).toThrow(ClaudeGWTError);
      expect(() => testError()).toThrow(Error);
    });

    it('should allow type checking in catch blocks', () => {
      try {
        throw new DirectoryStateError('Invalid state', 'unknown');
      } catch (error) {
        if (error instanceof DirectoryStateError) {
          expect(error.directoryType).toBe('unknown');
          expect(error.code).toBe('DIRECTORY_STATE_ERROR');
        } else {
          fail('Should have caught DirectoryStateError');
        }
      }
    });
  });

  describe('Error serialization', () => {
    it('should serialize custom error properties correctly', () => {
      const error = new GitOperationError('Test error', 'push');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const serialized = JSON.parse(JSON.stringify(error));
      // Note: Error.message is not enumerable by default, so it won't appear in JSON.stringify
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(serialized.operation).toBe('push');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(serialized.code).toBe('GIT_OPERATION_ERROR');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(serialized.name).toBe('GitOperationError');
    });

    it('should handle complex error properties', () => {
      const error = new ClaudeInstanceError('Complex error', 'instance-with-uuid-123-456');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const serialized = JSON.parse(JSON.stringify(error));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(serialized.instanceId).toBe('instance-with-uuid-123-456');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(serialized.code).toBe('CLAUDE_INSTANCE_ERROR');
    });

    it('should preserve error message in the error object', () => {
      const error = new GitOperationError('Test error', 'push');

      // Message is accessible but not enumerable for JSON.stringify
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('push');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
    });
  });
});
