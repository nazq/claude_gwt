import { describe, it, expect } from 'vitest';
import { TmuxParser } from '../../../src/sessions/TmuxParser';

describe('TmuxParser', () => {
  describe('parseSessions', () => {
    it('should parse valid session output', () => {
      const output = 'main|3|1642500000|1|group1\nfeature|2|1642500100|0|';

      const result = TmuxParser.parseSessions(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'main',
        windows: 3,
        created: 1642500000,
        attached: true,
        group: 'group1',
      });
      expect(result[1]).toEqual({
        name: 'feature',
        windows: 2,
        created: 1642500100,
        attached: false,
        group: undefined,
      });
    });

    it('should handle empty output', () => {
      expect(TmuxParser.parseSessions('')).toEqual([]);
      expect(TmuxParser.parseSessions('   ')).toEqual([]);
    });

    it('should handle malformed lines', () => {
      const output = 'incomplete|data\n||\nvalid|2|123|1|group';

      const result = TmuxParser.parseSessions(output);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('incomplete');
      expect(result[0].windows).toBe(0); // Default when parsing fails
      expect(result[1].name).toBe(''); // Empty first field
      expect(result[2].name).toBe('valid');
    });

    it('should handle missing fields gracefully', () => {
      const output = 'name-only';

      const result = TmuxParser.parseSessions(output);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'name-only',
        windows: 0,
        created: 0,
        attached: false,
        group: undefined,
      });
    });

    it('should trim group names', () => {
      const output = 'session|1|123|0|  trimmed  ';

      const result = TmuxParser.parseSessions(output);

      expect(result[0].group).toBe('trimmed');
    });
  });

  describe('parseWindows', () => {
    it('should parse valid window output', () => {
      const output = 'main|0|editor|1|2\nmain|1|terminal|0|1';

      const result = TmuxParser.parseWindows(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sessionName: 'main',
        index: 0,
        name: 'editor',
        active: true,
        panes: 2,
      });
      expect(result[1]).toEqual({
        sessionName: 'main',
        index: 1,
        name: 'terminal',
        active: false,
        panes: 1,
      });
    });

    it('should handle empty window output', () => {
      expect(TmuxParser.parseWindows('')).toEqual([]);
    });

    it('should handle malformed window data', () => {
      const output = 'session|invalid|window|active|panes';

      const result = TmuxParser.parseWindows(output);

      expect(result[0].index).toBe(0); // Invalid number becomes 0
      expect(result[0].panes).toBe(0);
    });
  });

  describe('parsePanes', () => {
    it('should parse valid pane output', () => {
      const output = '%0|main|0|0|zsh|Terminal\n%1|main|0|1|vim|Editor';

      const result = TmuxParser.parsePanes(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '%0',
        sessionName: 'main',
        windowIndex: 0,
        paneIndex: 0,
        command: 'zsh',
        title: 'Terminal',
      });
      expect(result[1]).toEqual({
        id: '%1',
        sessionName: 'main',
        windowIndex: 0,
        paneIndex: 1,
        command: 'vim',
        title: 'Editor',
      });
    });

    it('should handle panes without titles', () => {
      const output = '%0|main|0|0|bash|';

      const result = TmuxParser.parsePanes(output);

      expect(result[0].title).toBeUndefined();
    });

    it('should trim pane titles', () => {
      const output = '%0|main|0|0|bash|  Title  ';

      const result = TmuxParser.parsePanes(output);

      expect(result[0].title).toBe('Title');
    });

    it('should handle empty pane output', () => {
      expect(TmuxParser.parsePanes('')).toEqual([]);
    });
  });

  describe('isValidSessionName', () => {
    it('should accept valid session names', () => {
      expect(TmuxParser.isValidSessionName('main')).toBe(true);
      expect(TmuxParser.isValidSessionName('project-feature')).toBe(true);
      expect(TmuxParser.isValidSessionName('123-test')).toBe(true);
    });

    it('should reject invalid session names', () => {
      expect(TmuxParser.isValidSessionName('')).toBe(false);
      expect(TmuxParser.isValidSessionName('   ')).toBe(false);
      expect(TmuxParser.isValidSessionName('name:with:colons')).toBe(false);
      expect(TmuxParser.isValidSessionName('name.with.dots')).toBe(false);
      expect(TmuxParser.isValidSessionName('name\nwith\nnewlines')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(TmuxParser.isValidSessionName(null as any)).toBe(false);
      expect(TmuxParser.isValidSessionName(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeSessionName', () => {
    it('should clean invalid characters', () => {
      expect(TmuxParser.sanitizeSessionName('Name:With.Invalid')).toBe('name-with-invalid');
      expect(TmuxParser.sanitizeSessionName('Spaces In Name')).toBe('spaces-in-name');
      expect(TmuxParser.sanitizeSessionName('  Trimmed  ')).toBe('trimmed');
    });

    it('should handle empty input', () => {
      expect(TmuxParser.sanitizeSessionName('')).toBe('');
      expect(TmuxParser.sanitizeSessionName(null as any)).toBe('');
      expect(TmuxParser.sanitizeSessionName(undefined as any)).toBe('');
    });

    it('should convert to lowercase', () => {
      expect(TmuxParser.sanitizeSessionName('UPPERCASE')).toBe('uppercase');
    });

    it('should collapse multiple spaces', () => {
      expect(TmuxParser.sanitizeSessionName('multiple    spaces')).toBe('multiple-spaces');
    });
  });

  describe('parseBoolean', () => {
    it('should parse boolean values correctly', () => {
      expect(TmuxParser.parseBoolean('on')).toBe(true);
      expect(TmuxParser.parseBoolean('off')).toBe(false);
      expect(TmuxParser.parseBoolean('  on  ')).toBe(true);
    });

    it('should use custom true value', () => {
      expect(TmuxParser.parseBoolean('1', '1')).toBe(true);
      expect(TmuxParser.parseBoolean('0', '1')).toBe(false);
      expect(TmuxParser.parseBoolean('yes', 'yes')).toBe(true);
    });

    it('should handle empty and invalid input', () => {
      expect(TmuxParser.parseBoolean('')).toBe(false);
      expect(TmuxParser.parseBoolean('invalid')).toBe(false);
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numbers', () => {
      expect(TmuxParser.parseNumber('123')).toBe(123);
      expect(TmuxParser.parseNumber('  456  ')).toBe(456);
      expect(TmuxParser.parseNumber('0')).toBe(0);
      expect(TmuxParser.parseNumber('-10')).toBe(-10);
    });

    it('should use default value for invalid input', () => {
      expect(TmuxParser.parseNumber('invalid')).toBe(0);
      expect(TmuxParser.parseNumber('invalid', 42)).toBe(42);
      expect(TmuxParser.parseNumber('')).toBe(0);
      expect(TmuxParser.parseNumber('abc', -1)).toBe(-1);
    });

    it('should handle floating point input', () => {
      expect(TmuxParser.parseNumber('123.45')).toBe(123);
      expect(TmuxParser.parseNumber('0.9')).toBe(0);
    });
  });
});
