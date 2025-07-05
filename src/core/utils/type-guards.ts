/**
 * Type guards for runtime type checking
 */

import type { DirectoryState } from '../../types';
import type { SessionInfo } from '../../sessions/TmuxManager';
import type { GitWorktreeInfo } from '../../types';

/**
 * Check if a value is a valid DirectoryState
 */
export function isDirectoryState(value: unknown): value is DirectoryState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Record<string, unknown>;
  const validTypes = ['empty', 'claude-gwt-parent', 'git-worktree', 'git-repo', 'non-git'];

  return (
    typeof state['type'] === 'string' &&
    validTypes.includes(state['type']) &&
    typeof state['path'] === 'string'
  );
}

/**
 * Check if a value is a valid SessionInfo
 */
export function isSessionInfo(value: unknown): value is SessionInfo {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const info = value as Record<string, unknown>;

  return (
    typeof info['name'] === 'string' &&
    typeof info['windows'] === 'number' &&
    typeof info['created'] === 'string' &&
    typeof info['attached'] === 'boolean' &&
    typeof info['hasClaudeRunning'] === 'boolean'
  );
}

/**
 * Check if a value is a valid GitWorktreeInfo
 */
export function isGitWorktreeInfo(value: unknown): value is GitWorktreeInfo {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const info = value as Record<string, unknown>;

  return (
    typeof info['path'] === 'string' &&
    typeof info['branch'] === 'string' &&
    (info['commit'] === undefined || typeof info['commit'] === 'string') &&
    (info['locked'] === undefined || typeof info['locked'] === 'boolean')
  );
}

/**
 * Check if a value is an Error-like object
 */
export function isErrorLike(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (value !== null &&
      typeof value === 'object' &&
      'message' in value &&
      typeof (value as Record<string, unknown>)['message'] === 'string')
  );
}

/**
 * Check if a value is a NodeJS.ErrnoException
 */
export function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return (
    isErrorLike(value) &&
    ('code' in value || 'errno' in value || 'syscall' in value || 'path' in value)
  );
}

/**
 * Type guard for array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Type guard for non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isFinite(value);
}

/**
 * Safely parse JSON with type guard
 */
export function safeJsonParse<T>(
  json: string,
  typeGuard: (value: unknown) => value is T,
): T | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return typeGuard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Assert a condition and narrow the type
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
