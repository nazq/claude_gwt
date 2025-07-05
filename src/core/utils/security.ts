import * as path from 'node:path';

/**
 * Security utilities for input validation and sanitization
 */

/**
 * Escapes shell arguments to prevent command injection
 * @param arg The argument to escape
 * @returns The escaped argument safe for shell execution
 */
export function escapeShellArg(arg: string): string {
  // If the argument is empty, return empty quotes
  if (!arg) return "''";

  // Replace single quotes with '\'' and wrap in single quotes
  // This works because even in single quotes, '\'' breaks out, adds a literal ', and re-enters
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validates and sanitizes a file path to prevent path traversal attacks
 * @param inputPath The path to validate
 * @param basePath Optional base path to ensure the path stays within
 * @returns The normalized, safe path
 * @throws Error if the path is invalid or attempts traversal
 */
export function sanitizePath(inputPath: string, basePath?: string): string {
  // Normalize the path to resolve . and .. segments
  const normalizedPath = path.normalize(inputPath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..') || inputPath.includes('..')) {
    throw new Error('Path traversal attempt detected');
  }

  // If a base path is provided, ensure the path stays within it
  if (basePath) {
    const resolvedPath = path.resolve(basePath, normalizedPath);
    const resolvedBase = path.resolve(basePath);

    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Path escapes base directory');
    }

    return resolvedPath;
  }

  return path.resolve(normalizedPath);
}

/**
 * Validates a Git repository URL
 * @param url The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidGitUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Check for common Git URL patterns
  const patterns = [
    // HTTPS URLs
    /^https?:\/\/([\w.-]+)(:\d+)?\/([\w.-]+)\/([\w.-]+)(\.git)?$/,
    // SSH URLs (git@github.com:user/repo.git)
    /^git@([\w.-]+):([\w.-]+)\/([\w.-]+)(\.git)?$/,
    // SSH URLs (ssh://git@github.com/user/repo.git)
    /^ssh:\/\/git@([\w.-]+)(:\d+)?\/([\w.-]+)\/([\w.-]+)(\.git)?$/,
    // Git protocol
    /^git:\/\/([\w.-]+)(:\d+)?\/([\w.-]+)\/([\w.-]+)(\.git)?$/,
    // Local file paths (unix)
    /^(\/[\w.-]+)+\/?$/,
    // Local file paths (windows)
    /^[a-zA-Z]:\\([\w.-]+\\?)*$/,
    // File protocol
    /^file:\/\/(\/[\w.-]+)+\/?$/,
  ];

  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Validates a Git branch name
 * @param name The branch name to validate
 * @returns true if valid, false otherwise
 */
export function isValidBranchName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;

  // Git branch name rules:
  // - Cannot start with a dot
  // - Cannot contain two consecutive dots
  // - Cannot contain space, ~, ^, :, ?, *, [, \, @{
  // - Cannot end with a slash
  // - Cannot end with .lock

  if (name.startsWith('.')) return false;
  if (name.includes('..')) return false;
  if (name.endsWith('/')) return false;
  if (name.endsWith('.lock')) return false;

  const invalidChars = /[\s~^:?*[\\\]@{]/;
  if (invalidChars.test(name)) return false;

  // Must be non-empty after trimming
  return name.trim().length > 0;
}

/**
 * Sanitizes a session name for tmux
 * @param name The session name to sanitize
 * @returns The sanitized session name
 */
export function sanitizeSessionName(name: string): string {
  if (!name) return '';

  // Tmux session names cannot contain colons or dots
  // Replace invalid characters with underscores before removing other chars
  return name
    .replace(/[:./\s]+/g, '_') // Replace colons, dots, slashes, spaces with underscore
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove any other invalid characters
    .substring(0, 50); // Limit length
}

/**
 * Validates a directory name
 * @param name The directory name to validate
 * @returns true if valid, false otherwise
 */
export function isValidDirectoryName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;

  // Check for path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false;
  }

  // Check for invalid characters (including control characters)
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1F\x7F]/;
  if (invalidChars.test(name)) return false;

  // Must be non-empty after trimming
  return name.trim().length > 0;
}

/**
 * Escapes a string for use in a tmux command
 * @param str The string to escape
 * @returns The escaped string
 */
export function escapeTmuxArg(str: string): string {
  if (!str) return "''";

  // Tmux uses similar escaping to shell, but we need to be extra careful
  // First escape for shell, then handle tmux-specific escaping
  const shellEscaped = escapeShellArg(str);

  // Tmux interprets backslashes, so we need to escape them
  return shellEscaped.replace(/\\/g, '\\\\');
}

/**
 * Validates that a string doesn't contain shell metacharacters
 * @param str The string to check
 * @returns true if safe, false if contains metacharacters
 */
export function isSafeForShell(str: string): boolean {
  if (!str) return true;

  // Check for common shell metacharacters
  const dangerous = /[;&|`$<>(){}[\]!*?~\n\r]/;
  return !dangerous.test(str);
}

/**
 * Creates a safe environment variable value
 * @param value The value to make safe
 * @returns The safe value
 */
export function safeEnvValue(value: string): string {
  if (!value) return '';

  // Remove any null bytes and control characters
  // eslint-disable-next-line no-control-regex
  value = value.replace(/[\x00-\x1F\x7F]/g, '');

  // Escape special characters for shell environment
  return escapeShellArg(value);
}
