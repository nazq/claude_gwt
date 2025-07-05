import {
  escapeShellArg,
  sanitizePath,
  isValidGitUrl,
  isValidBranchName,
  sanitizeSessionName,
  isValidDirectoryName,
  escapeTmuxArg,
  isSafeForShell,
  safeEnvValue,
} from '../../../../src/core/utils/security';
import * as path from 'node:path';

describe('Security Utilities', () => {
  describe('escapeShellArg', () => {
    it('should handle empty strings', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('should wrap simple strings in single quotes', () => {
      expect(escapeShellArg('hello')).toBe("'hello'");
    });

    it('should escape single quotes', () => {
      expect(escapeShellArg("it's")).toBe("'it'\\''s'");
    });

    it('should handle strings with multiple single quotes', () => {
      expect(escapeShellArg("it's 'quoted'")).toBe("'it'\\''s '\\''quoted'\\'''");
    });

    it('should handle special shell characters', () => {
      expect(escapeShellArg('$PATH')).toBe("'$PATH'");
      expect(escapeShellArg('`command`')).toBe("'`command`'");
      expect(escapeShellArg('$(command)')).toBe("'$(command)'");
      expect(escapeShellArg('&&')).toBe("'&&'");
      expect(escapeShellArg('||')).toBe("'||'");
      expect(escapeShellArg(';')).toBe("';'");
      expect(escapeShellArg('|')).toBe("'|'");
      expect(escapeShellArg('>')).toBe("'>'");
      expect(escapeShellArg('<')).toBe("'<'");
    });

    it('should handle newlines and special characters', () => {
      expect(escapeShellArg('line1\nline2')).toBe("'line1\nline2'");
      expect(escapeShellArg('tab\ttab')).toBe("'tab\ttab'");
    });
  });

  describe('sanitizePath', () => {
    it('should normalize simple paths', () => {
      expect(sanitizePath('test/path')).toBe(path.resolve('test/path'));
    });

    it('should reject paths with .. traversal', () => {
      expect(() => sanitizePath('../test')).toThrow('Path traversal attempt detected');
      expect(() => sanitizePath('test/../..')).toThrow('Path traversal attempt detected');
      expect(() => sanitizePath('test/../../etc/passwd')).toThrow(
        'Path traversal attempt detected',
      );
    });

    it('should handle paths with . correctly', () => {
      expect(sanitizePath('./test')).toBe(path.resolve('./test'));
      expect(sanitizePath('test/./path')).toBe(path.resolve('test/path'));
    });

    it('should enforce base path restrictions', () => {
      const basePath = '/home/user/project';
      expect(sanitizePath('subdir', basePath)).toBe(path.resolve(basePath, 'subdir'));
      expect(() => sanitizePath('../../../etc', basePath)).toThrow(
        'Path traversal attempt detected',
      );
    });

    it('should handle absolute paths with base path', () => {
      const basePath = '/home/user/project';
      expect(() => sanitizePath('/etc/passwd', basePath)).toThrow('Path escapes base directory');
    });
  });

  describe('isValidGitUrl', () => {
    it('should validate HTTPS URLs', () => {
      expect(isValidGitUrl('https://github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('https://github.com/user/repo')).toBe(true);
      expect(isValidGitUrl('http://gitlab.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('https://bitbucket.org/user/repo.git')).toBe(true);
    });

    it('should validate SSH URLs', () => {
      expect(isValidGitUrl('git@github.com:user/repo.git')).toBe(true);
      expect(isValidGitUrl('git@github.com:user/repo')).toBe(true);
      expect(isValidGitUrl('ssh://git@github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('ssh://git@github.com:22/user/repo.git')).toBe(true);
    });

    it('should validate git protocol URLs', () => {
      expect(isValidGitUrl('git://github.com/user/repo.git')).toBe(true);
      expect(isValidGitUrl('git://github.com/user/repo')).toBe(true);
    });

    it('should validate local paths', () => {
      expect(isValidGitUrl('/home/user/repos/myrepo')).toBe(true);
      expect(isValidGitUrl('C:\\Users\\repos\\myrepo')).toBe(true);
      expect(isValidGitUrl('file:///home/user/repos/myrepo')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidGitUrl('')).toBe(false);
      expect(isValidGitUrl('not a url')).toBe(false);
      expect(isValidGitUrl('ftp://example.com/repo')).toBe(false);
      expect(isValidGitUrl('javascript:alert(1)')).toBe(false);
      expect(isValidGitUrl(null as any)).toBe(false);
      expect(isValidGitUrl(undefined as any)).toBe(false);
    });
  });

  describe('isValidBranchName', () => {
    it('should accept valid branch names', () => {
      expect(isValidBranchName('main')).toBe(true);
      expect(isValidBranchName('feature/new-feature')).toBe(true);
      expect(isValidBranchName('bugfix-123')).toBe(true);
      expect(isValidBranchName('release-1.0.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(isValidBranchName('')).toBe(false);
      expect(isValidBranchName('.hidden')).toBe(false);
      expect(isValidBranchName('branch..name')).toBe(false);
      expect(isValidBranchName('branch/')).toBe(false);
      expect(isValidBranchName('branch.lock')).toBe(false);
      expect(isValidBranchName('branch name')).toBe(false);
      expect(isValidBranchName('branch~name')).toBe(false);
      expect(isValidBranchName('branch^name')).toBe(false);
      expect(isValidBranchName('branch:name')).toBe(false);
      expect(isValidBranchName('branch?name')).toBe(false);
      expect(isValidBranchName('branch*name')).toBe(false);
      expect(isValidBranchName('branch[name]')).toBe(false);
      expect(isValidBranchName('branch\\name')).toBe(false);
      expect(isValidBranchName('branch@{name}')).toBe(false);
      expect(isValidBranchName(null as any)).toBe(false);
    });
  });

  describe('sanitizeSessionName', () => {
    it('should sanitize tmux session names', () => {
      expect(sanitizeSessionName('project:branch')).toBe('project_branch');
      expect(sanitizeSessionName('my.project')).toBe('my_project');
      expect(sanitizeSessionName('my project')).toBe('my_project');
      expect(sanitizeSessionName('feature/branch')).toBe('feature_branch');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeSessionName('project!@#$%')).toBe('project');
      expect(sanitizeSessionName('🚀rocket')).toBe('rocket');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(60);
      expect(sanitizeSessionName(longName)).toHaveLength(50);
    });

    it('should handle empty strings', () => {
      expect(sanitizeSessionName('')).toBe('');
    });
  });

  describe('isValidDirectoryName', () => {
    it('should accept valid directory names', () => {
      expect(isValidDirectoryName('myproject')).toBe(true);
      expect(isValidDirectoryName('my-project')).toBe(true);
      expect(isValidDirectoryName('my_project')).toBe(true);
      expect(isValidDirectoryName('project123')).toBe(true);
    });

    it('should reject invalid directory names', () => {
      expect(isValidDirectoryName('')).toBe(false);
      expect(isValidDirectoryName('../parent')).toBe(false);
      expect(isValidDirectoryName('sub/dir')).toBe(false);
      expect(isValidDirectoryName('sub\\dir')).toBe(false);
      expect(isValidDirectoryName('project<>name')).toBe(false);
      expect(isValidDirectoryName('project:name')).toBe(false);
      expect(isValidDirectoryName('project"name')).toBe(false);
      expect(isValidDirectoryName('project|name')).toBe(false);
      expect(isValidDirectoryName('project?name')).toBe(false);
      expect(isValidDirectoryName('project*name')).toBe(false);
      expect(isValidDirectoryName('project\x00name')).toBe(false);
      expect(isValidDirectoryName(null as any)).toBe(false);
    });
  });

  describe('escapeTmuxArg', () => {
    it('should escape tmux arguments', () => {
      expect(escapeTmuxArg('')).toBe("''");
      expect(escapeTmuxArg('simple')).toBe("'simple'");
      expect(escapeTmuxArg('with space')).toBe("'with space'");
    });

    it('should handle backslashes', () => {
      expect(escapeTmuxArg('path\\to\\file')).toBe("'path\\\\to\\\\file'");
    });

    it('should handle single quotes', () => {
      expect(escapeTmuxArg("it's")).toBe("'it'\\\\''s'");
    });
  });

  describe('isSafeForShell', () => {
    it('should accept safe strings', () => {
      expect(isSafeForShell('simple')).toBe(true);
      expect(isSafeForShell('with-dash')).toBe(true);
      expect(isSafeForShell('with_underscore')).toBe(true);
      expect(isSafeForShell('123')).toBe(true);
      expect(isSafeForShell('')).toBe(true);
    });

    it('should reject strings with shell metacharacters', () => {
      expect(isSafeForShell('command;ls')).toBe(false);
      expect(isSafeForShell('command&')).toBe(false);
      expect(isSafeForShell('command|grep')).toBe(false);
      expect(isSafeForShell('`command`')).toBe(false);
      expect(isSafeForShell('$(command)')).toBe(false);
      expect(isSafeForShell('file>output')).toBe(false);
      expect(isSafeForShell('file<input')).toBe(false);
      expect(isSafeForShell('command()')).toBe(false);
      expect(isSafeForShell('command{}')).toBe(false);
      expect(isSafeForShell('command[]')).toBe(false);
      expect(isSafeForShell('!command')).toBe(false);
      expect(isSafeForShell('command*')).toBe(false);
      expect(isSafeForShell('command?')).toBe(false);
      expect(isSafeForShell('~user')).toBe(false);
      expect(isSafeForShell('line\nbreak')).toBe(false);
      expect(isSafeForShell('line\rbreak')).toBe(false);
    });
  });

  describe('safeEnvValue', () => {
    it('should handle normal values', () => {
      expect(safeEnvValue('simple')).toBe("'simple'");
      expect(safeEnvValue('with space')).toBe("'with space'");
    });

    it('should remove null bytes', () => {
      expect(safeEnvValue('before\x00after')).toBe("'beforeafter'");
    });

    it('should escape shell special characters', () => {
      expect(safeEnvValue('$PATH')).toBe("'$PATH'");
    });

    it('should handle empty strings', () => {
      expect(safeEnvValue('')).toBe('');
    });
  });
});
