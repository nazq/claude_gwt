import { describe, it, expect, vi } from 'vitest';
import { parseWorktreeOutput, isSessionActive } from '../../../src/cli/cgwt-program';

describe('cgwt utility functions', () => {
  describe('parseWorktreeOutput', () => {
    it('should parse worktree output correctly', () => {
      const output = `worktree /test/repo
HEAD abc123
branch refs/heads/main

worktree /test/repo-feature
HEAD def456
branch refs/heads/feature

`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(2);
      // Sessions are sorted alphabetically by branch name
      expect(sessions[0]).toEqual({
        path: '/test/repo-feature',
        head: 'def456',
        branch: 'refs/heads/feature',
      });
      expect(sessions[1]).toEqual({
        path: '/test/repo',
        head: 'abc123',
        branch: 'refs/heads/main',
      });
    });

    it('should handle worktrees without branches', () => {
      const output = `worktree /test/repo
HEAD abc123

worktree /test/repo-detached
HEAD def456
branch refs/heads/feature

`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(2); // Both sessions are kept
      // First session has no branch
      expect(sessions[0]).toEqual({
        path: '/test/repo',
        head: 'abc123',
      });
      // Second session has branch
      expect(sessions[1]).toEqual({
        path: '/test/repo-detached',
        head: 'def456',
        branch: 'refs/heads/feature',
      });
    });

    it('should handle empty output', () => {
      const sessions = parseWorktreeOutput('');
      expect(sessions).toHaveLength(0);
    });

    it('should handle output with trailing entries', () => {
      const output = `worktree /test/repo
HEAD abc123
branch refs/heads/main
`;

      const sessions = parseWorktreeOutput(output);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toEqual({
        path: '/test/repo',
        head: 'abc123',
        branch: 'refs/heads/main',
      });
    });
  });

  describe('isSessionActive', () => {
    const originalCwd = process.cwd;

    afterEach(() => {
      process.cwd = originalCwd;
    });

    it('should return true for current directory', () => {
      process.cwd = () => '/test/repo';

      expect(isSessionActive('/test/repo')).toBe(true);
    });

    it('should return false for different directory', () => {
      process.cwd = () => '/test/repo';

      expect(isSessionActive('/test/repo-feature')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      process.cwd = () => {
        throw new Error('cwd error');
      };

      expect(isSessionActive('/test/repo')).toBe(false);
    });
  });
});
