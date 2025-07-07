import { describe, it, expect } from 'vitest';
import { TmuxHookParser } from '../../../src/sessions/TmuxHookParser';

describe('TmuxHookParser', () => {
  describe('parse valid hooks', () => {
    it('should parse hook with target', () => {
      const result = TmuxHookParser.parse(
        'set-hook -t my-session -g alert-activity \'display-message "Activity in #S"\'',
      );

      expect(result).toEqual({
        target: 'my-session',
        hookName: 'alert-activity',
        command: 'display-message "Activity in #S"',
        isValid: true,
      });
    });

    it('should parse hook without target', () => {
      const result = TmuxHookParser.parse(
        'set-hook -g session-created \'display-message "New session created"\'',
      );

      expect(result).toEqual({
        target: undefined,
        hookName: 'session-created',
        command: 'display-message "New session created"',
        isValid: true,
      });
    });

    it('should parse hook with complex command', () => {
      const result = TmuxHookParser.parse(
        'set-hook -g window-linked \'run-shell "echo Window #{window_id} linked to #{session_name}"\'',
      );

      expect(result).toEqual({
        target: undefined,
        hookName: 'window-linked',
        command: 'run-shell "echo Window #{window_id} linked to #{session_name}"',
        isValid: true,
      });
    });

    it('should parse hook with special characters in command', () => {
      const result = TmuxHookParser.parse(
        'set-hook -t test -g pane-exited \'display-message "Pane exited with status #{pane_dead_status}"\'',
      );

      expect(result).toEqual({
        target: 'test',
        hookName: 'pane-exited',
        command: 'display-message "Pane exited with status #{pane_dead_status}"',
        isValid: true,
      });
    });
  });

  describe('parse invalid hooks', () => {
    it('should handle empty string', () => {
      const result = TmuxHookParser.parse('');

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle whitespace only', () => {
      const result = TmuxHookParser.parse('   \t\n  ');

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle malformed hook without quotes', () => {
      const result = TmuxHookParser.parse('set-hook -g test-hook display-message "test"');

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle hook missing -g flag', () => {
      const result = TmuxHookParser.parse("set-hook -t session hook-name 'command'");

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle hook without command', () => {
      const result = TmuxHookParser.parse('set-hook -g hook-name');

      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle non-hook commands', () => {
      const result = TmuxHookParser.parse('bind-key c new-window');

      expect(result).toEqual({
        isValid: false,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle hook with empty command', () => {
      const result = TmuxHookParser.parse("set-hook -g test-hook ''");

      // Empty command is invalid, so parser returns early
      expect(result).toEqual({
        isValid: false,
      });
    });

    it('should handle hook with spaces in target', () => {
      const result = TmuxHookParser.parse('set-hook -t "my session" -g test-hook \'command\'');

      // Won't match because regex expects non-space target
      expect(result).toEqual({
        isValid: false,
      });
    });
  });
});
