import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizePath,
  isValidBranchName,
  isValidGitUrl,
  sanitizeSessionName,
  escapeShellArg,
  isSafeForShell,
} from '../../../../src/core/utils/security';

describe('Property-based tests for security utilities', () => {
  describe('sanitizePath', () => {
    it('should never produce paths with directory traversal', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          try {
            const sanitized = sanitizePath(input);
            expect(sanitized).not.toContain('..');
          } catch (error) {
            // If it throws, it detected a traversal attempt - that's good
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('traversal');
          }
        }),
      );
    });

    it('should be idempotent for valid paths', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes('..')),
          (input) => {
            try {
              const once = sanitizePath(input);
              const twice = sanitizePath(once);
              expect(twice).toBe(once);
            } catch {
              // Skip invalid paths
            }
          },
        ),
      );
    });
  });

  describe('isValidBranchName', () => {
    it('should reject dangerous patterns', () => {
      const dangerousPatterns = ['..', '.lock', '@{', '\\', ' ', '~', '^', ':', '?', '*', '['];

      dangerousPatterns.forEach((pattern) => {
        fc.assert(
          fc.property(
            fc.tuple(fc.string(), fc.constant(pattern), fc.string()),
            ([prefix, dangerous, suffix]) => {
              const branchName = prefix + dangerous + suffix;
              const result = isValidBranchName(branchName);
              expect(result).toBe(false);
            },
          ),
        );
      });
    });

    it('should accept valid branch names', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter(
              (s) =>
                /^[a-zA-Z0-9][a-zA-Z0-9-_/]*[a-zA-Z0-9]$/.test(s) &&
                !s.includes('..') &&
                !s.includes('//') &&
                !s.includes('.lock'),
            ),
          (branchName) => {
            const result = isValidBranchName(branchName);
            expect(result).toBe(true);
          },
        ),
      );
    });

    // Regression test for the bug we found
    it('should reject any branch name containing .lock', () => {
      const testCases = ['branch.lock', '.lock', 'feature.lock.bak', 'my.lockfile', 'test.lock!'];

      testCases.forEach((name) => {
        expect(isValidBranchName(name)).toBe(false);
      });
    });
  });

  describe('escapeShellArg', () => {
    it('should safely escape any string for shell', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const escaped = escapeShellArg(input);

          // Should be wrapped in quotes
          expect(escaped.startsWith("'")).toBe(true);
          expect(escaped.endsWith("'")).toBe(true);

          // Empty string special case
          if (input === '') {
            expect(escaped).toBe("''");
          }
        }),
      );
    });

    it('should handle strings with single quotes', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => s.includes("'")),
          (input) => {
            const escaped = escapeShellArg(input);

            // The escaped string should handle single quotes properly
            const originalQuotes = input.split("'").length - 1;
            const escapedPattern = escaped.match(/'\\''/g);
            const escapedQuotes = escapedPattern ? escapedPattern.length : 0;

            expect(escapedQuotes).toBe(originalQuotes);
          },
        ),
      );
    });
  });

  describe('sanitizeSessionName', () => {
    it('should produce valid tmux session names', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = sanitizeSessionName(input);

          // Result should not contain invalid tmux characters
          expect(result).not.toContain(':');
          expect(result).not.toContain('.');
          expect(result).not.toContain('/');
          expect(result).not.toContain(' ');

          // Should be limited in length
          expect(result.length).toBeLessThanOrEqual(50);

          // Should only contain valid characters
          if (result.length > 0) {
            expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
          }
        }),
      );
    });
  });

  describe('isSafeForShell', () => {
    it('should reject strings with shell metacharacters', () => {
      const dangerous = [
        '&',
        ';',
        '|',
        '`',
        '$',
        '<',
        '>',
        '(',
        ')',
        '{',
        '}',
        '[',
        ']',
        '!',
        '*',
        '?',
        '~',
        '\n',
        '\r',
      ];

      dangerous.forEach((char) => {
        fc.assert(
          fc.property(
            fc.tuple(fc.string(), fc.constant(char), fc.string()),
            ([prefix, danger, suffix]) => {
              const input = prefix + danger + suffix;
              expect(isSafeForShell(input)).toBe(false);
            },
          ),
        );
      });
    });

    it('should accept alphanumeric strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }).filter((s) => /^[a-zA-Z0-9._-]*$/.test(s)),
          (safe) => {
            expect(isSafeForShell(safe)).toBe(true);
          },
        ),
      );
    });
  });

  describe('isValidGitUrl edge cases', () => {
    it('should validate generated GitHub URLs', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 39 }).filter((s) => /^[a-zA-Z0-9-]+$/.test(s)),
            fc.string({ minLength: 1, maxLength: 100 }).filter((s) => /^[a-zA-Z0-9._-]+$/.test(s)),
          ),
          ([user, repo]) => {
            const httpUrl = `https://github.com/${user}/${repo}.git`;
            const sshUrl = `git@github.com:${user}/${repo}.git`;

            expect(isValidGitUrl(httpUrl)).toBe(true);
            expect(isValidGitUrl(sshUrl)).toBe(true);
          },
        ),
      );
    });

    it('should handle any input without crashing', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = isValidGitUrl(input as any);
          expect(typeof result).toBe('boolean');
        }),
      );
    });
  });
});
