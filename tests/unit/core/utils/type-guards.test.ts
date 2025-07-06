import { describe, it, expect, vi } from 'vitest';
import {
  isDirectoryState,
  isSessionInfo,
  isGitWorktreeInfo,
  isErrorLike,
  isErrnoException,
  isStringArray,
  isNonEmptyString,
  isPositiveNumber,
  safeJsonParse,
  assert,
  isDefined,
} from '../../../../src/core/utils/type-guards.js';
import type { DirectoryState, GitWorktreeInfo } from '../../../../src/types/index.js';
import type { SessionInfo } from '../../../../src/sessions/TmuxManager.js';

describe('Type Guards', () => {
  describe('isDirectoryState', () => {
    it('should return true for valid DirectoryState objects', () => {
      const validStates: DirectoryState[] = [
        { type: 'empty', path: '/test' },
        { type: 'claude-gwt-parent', path: '/test' },
        { type: 'git-worktree', path: '/test' },
        { type: 'git-repo', path: '/test' },
        { type: 'non-git', path: '/test' },
      ];

      validStates.forEach((state) => {
        expect(isDirectoryState(state)).toBe(true);
      });
    });

    it('should return false for invalid objects', () => {
      expect(isDirectoryState(null)).toBe(false);
      expect(isDirectoryState(undefined)).toBe(false);
      expect(isDirectoryState('string')).toBe(false);
      expect(isDirectoryState(123)).toBe(false);
      expect(isDirectoryState({})).toBe(false);
      expect(isDirectoryState({ type: 'invalid' })).toBe(false);
      expect(isDirectoryState({ type: 'empty' })).toBe(false); // missing path
      expect(isDirectoryState({ path: '/test' })).toBe(false); // missing type
      expect(isDirectoryState({ type: 123, path: '/test' })).toBe(false); // wrong type
    });
  });

  describe('isSessionInfo', () => {
    it('should return true for valid SessionInfo objects', () => {
      const validSession: SessionInfo = {
        name: 'test-session',
        windows: 3,
        created: '2024-01-01',
        attached: true,
        hasClaudeRunning: false,
      };

      expect(isSessionInfo(validSession)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isSessionInfo(null)).toBe(false);
      expect(isSessionInfo(undefined)).toBe(false);
      expect(isSessionInfo('string')).toBe(false);
      expect(isSessionInfo(123)).toBe(false);
      expect(isSessionInfo({})).toBe(false);
      expect(isSessionInfo({ name: 'test' })).toBe(false); // missing fields
      expect(
        isSessionInfo({
          name: 'test',
          windows: 'not-a-number',
          created: '2024-01-01',
          attached: true,
          hasClaudeRunning: false,
        }),
      ).toBe(false); // wrong type for windows
    });
  });

  describe('isGitWorktreeInfo', () => {
    it('should return true for valid GitWorktreeInfo objects', () => {
      const validWorktrees: GitWorktreeInfo[] = [
        { path: '/test/repo', branch: 'main' },
        { path: '/test/repo', branch: 'feature', commit: 'abc123' },
        { path: '/test/repo', branch: 'feature', locked: true },
        { path: '/test/repo', branch: 'feature', commit: 'abc123', locked: false },
      ];

      validWorktrees.forEach((worktree) => {
        expect(isGitWorktreeInfo(worktree)).toBe(true);
      });
    });

    it('should return false for invalid objects', () => {
      expect(isGitWorktreeInfo(null)).toBe(false);
      expect(isGitWorktreeInfo(undefined)).toBe(false);
      expect(isGitWorktreeInfo('string')).toBe(false);
      expect(isGitWorktreeInfo(123)).toBe(false);
      expect(isGitWorktreeInfo({})).toBe(false);
      expect(isGitWorktreeInfo({ path: '/test' })).toBe(false); // missing branch
      expect(isGitWorktreeInfo({ branch: 'main' })).toBe(false); // missing path
      expect(isGitWorktreeInfo({ path: 123, branch: 'main' })).toBe(false); // wrong type
    });
  });

  describe('isErrorLike', () => {
    it('should return true for Error instances', () => {
      expect(isErrorLike(new Error('test'))).toBe(true);
      expect(isErrorLike(new TypeError('test'))).toBe(true);
      expect(isErrorLike(new RangeError('test'))).toBe(true);
    });

    it('should return true for Error-like objects', () => {
      expect(isErrorLike({ message: 'test error' })).toBe(true);
      expect(isErrorLike({ message: 'test', stack: 'stack trace' })).toBe(true);
    });

    it('should return false for non-error objects', () => {
      expect(isErrorLike(null)).toBe(false);
      expect(isErrorLike(undefined)).toBe(false);
      expect(isErrorLike('error string')).toBe(false);
      expect(isErrorLike(123)).toBe(false);
      expect(isErrorLike({})).toBe(false);
      expect(isErrorLike({ message: 123 })).toBe(false); // message not string
    });
  });

  describe('isErrnoException', () => {
    it('should return true for NodeJS.ErrnoException', () => {
      const errnoError = new Error('ENOENT') as NodeJS.ErrnoException;
      errnoError.code = 'ENOENT';
      expect(isErrnoException(errnoError)).toBe(true);

      const errnoError2 = new Error('Permission denied') as NodeJS.ErrnoException;
      errnoError2.errno = -13;
      expect(isErrnoException(errnoError2)).toBe(true);

      const errnoError3 = new Error('System call failed') as NodeJS.ErrnoException;
      errnoError3.syscall = 'open';
      expect(isErrnoException(errnoError3)).toBe(true);

      const errnoError4 = new Error('File not found') as NodeJS.ErrnoException;
      errnoError4.path = '/nonexistent';
      expect(isErrnoException(errnoError4)).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isErrnoException(new Error('Regular error'))).toBe(false);
      expect(isErrnoException({ message: 'test', code: 'ENOENT' })).toBe(true); // Error-like with code
    });
  });

  describe('isStringArray', () => {
    it('should return true for arrays of strings', () => {
      expect(isStringArray([])).toBe(true);
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray([''])).toBe(true);
    });

    it('should return false for non-string arrays', () => {
      expect(isStringArray(null)).toBe(false);
      expect(isStringArray(undefined)).toBe(false);
      expect(isStringArray('string')).toBe(false);
      expect(isStringArray([1, 2, 3])).toBe(false);
      expect(isStringArray(['a', 1, 'b'])).toBe(false);
      expect(isStringArray([null, 'a'])).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' ')).toBe(true);
      expect(isNonEmptyString('123')).toBe(true);
    });

    it('should return false for empty strings and non-strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString([])).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(999999)).toBe(true);
    });

    it('should return false for non-positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber(Infinity)).toBe(false);
      expect(isPositiveNumber(-Infinity)).toBe(false);
      expect(isPositiveNumber(null)).toBe(false);
      expect(isPositiveNumber(undefined)).toBe(false);
      expect(isPositiveNumber('1')).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON with type guard', () => {
      const typeGuard = (v: unknown): v is { name: string } => {
        return (
          typeof v === 'object' && v !== null && 'name' in v && typeof (v as any).name === 'string'
        );
      };

      expect(safeJsonParse('{"name":"test"}', typeGuard)).toEqual({ name: 'test' });
      expect(safeJsonParse('{"name":"test","extra":123}', typeGuard)).toEqual({
        name: 'test',
        extra: 123,
      });
    });

    it('should return null for invalid JSON', () => {
      const typeGuard = (v: unknown): v is { name: string } => {
        return (
          typeof v === 'object' && v !== null && 'name' in v && typeof (v as any).name === 'string'
        );
      };

      expect(safeJsonParse('invalid json', typeGuard)).toBeNull();
      expect(safeJsonParse('{"name":123}', typeGuard)).toBeNull(); // fails type guard
      expect(safeJsonParse('{}', typeGuard)).toBeNull(); // fails type guard
    });
  });

  describe('assert', () => {
    it('should not throw for truthy conditions', () => {
      expect(() => assert(true)).not.toThrow();
      expect(() => assert(1)).not.toThrow();
      expect(() => assert('string')).not.toThrow();
      expect(() => assert({})).not.toThrow();
    });

    it('should throw for falsy conditions', () => {
      expect(() => assert(false)).toThrow('Assertion failed');
      expect(() => assert(0)).toThrow('Assertion failed');
      expect(() => assert('')).toThrow('Assertion failed');
      expect(() => assert(null)).toThrow('Assertion failed');
      expect(() => assert(undefined)).toThrow('Assertion failed');
    });

    it('should use custom message', () => {
      expect(() => assert(false, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });

    it('should narrow types correctly', () => {
      const value: string | null | undefined = 'test';
      if (isDefined(value)) {
        // TypeScript should know value is string here
        expect(value.length).toBe(4);
      }
    });
  });
});
