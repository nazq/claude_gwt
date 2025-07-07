import { describe, it, expect } from 'vitest';
import { TmuxCommandParser } from '../../../src/sessions/TmuxCommandParser';

describe('TmuxCommandParser', () => {
  describe('parse set commands', () => {
    it('should parse basic set command', () => {
      const result = TmuxCommandParser.parse('set status on');
      expect(result).toEqual({
        type: 'set',
        option: 'status',
        value: 'on',
        isGlobal: false,
      });
    });

    it('should parse global set command', () => {
      const result = TmuxCommandParser.parse('set -g mode-keys vi');
      expect(result).toEqual({
        type: 'set',
        option: 'mode-keys',
        value: 'vi',
        isGlobal: true,
      });
    });

    it('should parse set command with multi-word value', () => {
      const result = TmuxCommandParser.parse('set status-style bg=colour32,fg=colour255');
      expect(result).toEqual({
        type: 'set',
        option: 'status-style',
        value: 'bg=colour32,fg=colour255',
        isGlobal: false,
      });
    });

    it('should parse set command with complex value', () => {
      const result = TmuxCommandParser.parse(
        'set status-left "#[bg=colour196] TEST #[bg=colour236] "',
      );
      expect(result).toEqual({
        type: 'set',
        option: 'status-left',
        value: '"#[bg=colour196] TEST #[bg=colour236] "',
        isGlobal: false,
      });
    });
  });

  describe('parse setw commands', () => {
    it('should parse basic setw command', () => {
      const result = TmuxCommandParser.parse('setw monitor-activity on');
      expect(result).toEqual({
        type: 'setw',
        option: 'monitor-activity',
        value: 'on',
      });
    });

    it('should parse setw with complex value', () => {
      const result = TmuxCommandParser.parse(
        'setw window-status-current-style bg=colour236,fg=colour255,bold',
      );
      expect(result).toEqual({
        type: 'setw',
        option: 'window-status-current-style',
        value: 'bg=colour236,fg=colour255,bold',
      });
    });
  });

  describe('parse bind-key commands', () => {
    it('should parse basic bind-key', () => {
      const result = TmuxCommandParser.parse('bind-key c new-window');
      expect(result).toEqual({
        type: 'bind-key',
        key: 'c',
        command: 'new-window',
        table: undefined,
        repeat: false,
      });
    });

    it('should parse bind-key with table', () => {
      const result = TmuxCommandParser.parse(
        'bind-key -T copy-mode-vi v send-keys -X begin-selection',
      );
      expect(result).toEqual({
        type: 'bind-key',
        key: 'v',
        command: 'send-keys -X begin-selection',
        table: 'copy-mode-vi',
        repeat: false,
      });
    });

    it('should parse bind-key with -n flag', () => {
      const result = TmuxCommandParser.parse('bind-key -n WheelUpPane send-keys -M');
      expect(result).toEqual({
        type: 'bind-key',
        key: 'WheelUpPane',
        command: 'send-keys -M',
        table: undefined,
        repeat: false,
      });
    });

    it('should parse bind-key with -r flag', () => {
      const result = TmuxCommandParser.parse('bind-key -r H resize-pane -L 5');
      expect(result).toEqual({
        type: 'bind-key',
        key: 'H',
        command: 'resize-pane -L 5',
        table: undefined,
        repeat: true,
      });
    });

    it('should parse bind-key with multiple flags', () => {
      const result = TmuxCommandParser.parse(
        'bind-key -r -T window-copy Up send-keys -X scroll-up',
      );
      expect(result).toEqual({
        type: 'bind-key',
        key: 'Up',
        command: 'send-keys -X scroll-up',
        table: 'window-copy',
        repeat: true,
      });
    });

    it('should parse bind-key with complex command', () => {
      const result = TmuxCommandParser.parse(
        'bind-key ] run "xclip -o -sel clipboard | tmux load-buffer - ; tmux paste-buffer"',
      );
      expect(result).toEqual({
        type: 'bind-key',
        key: ']',
        command: 'run "xclip -o -sel clipboard | tmux load-buffer - ; tmux paste-buffer"',
        table: undefined,
        repeat: false,
      });
    });
  });

  describe('parse unbind-key commands', () => {
    it('should parse basic unbind-key', () => {
      const result = TmuxCommandParser.parse('unbind-key Space');
      expect(result).toEqual({
        type: 'unbind-key',
        key: 'Space',
        table: undefined,
      });
    });

    it('should parse unbind-key with table', () => {
      const result = TmuxCommandParser.parse('unbind-key -T copy-mode MouseDrag1Pane');
      expect(result).toEqual({
        type: 'unbind-key',
        key: 'MouseDrag1Pane',
        table: 'copy-mode',
      });
    });

    it('should parse unbind-key with -n flag', () => {
      const result = TmuxCommandParser.parse('unbind-key -n MouseDrag1Pane');
      expect(result).toEqual({
        type: 'unbind-key',
        key: 'MouseDrag1Pane',
        table: undefined,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = TmuxCommandParser.parse('');
      expect(result).toEqual({ type: 'unknown' });
    });

    it('should handle whitespace only', () => {
      const result = TmuxCommandParser.parse('   ');
      expect(result).toEqual({ type: 'unknown' });
    });

    it('should handle unknown command', () => {
      const result = TmuxCommandParser.parse('foobar test');
      expect(result).toEqual({ type: 'unknown' });
    });

    it('should handle malformed set command', () => {
      const result = TmuxCommandParser.parse('set');
      expect(result).toEqual({
        type: 'set',
        option: undefined,
        value: '',
        isGlobal: false,
      });
    });

    it('should handle malformed bind-key', () => {
      const result = TmuxCommandParser.parse('bind-key');
      expect(result).toEqual({
        type: 'bind-key',
        key: undefined,
        command: '',
        table: undefined,
        repeat: false,
      });
    });
  });

  describe('real-world examples', () => {
    it('should parse vi-mode copy binding', () => {
      const result = TmuxCommandParser.parse(
        'bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -in -selection clipboard"',
      );
      expect(result).toEqual({
        type: 'bind-key',
        key: 'y',
        command: 'send-keys -X copy-pipe-and-cancel "xclip -in -selection clipboard"',
        table: 'copy-mode-vi',
        repeat: false,
      });
    });

    it('should parse mouse wheel binding', () => {
      const result = TmuxCommandParser.parse(
        'bind-key -n WheelUpPane if-shell -F -t = "#{pane_in_mode}" "send-keys -M" "copy-mode -e"',
      );
      expect(result).toEqual({
        type: 'bind-key',
        key: 'WheelUpPane',
        command: 'if-shell -F -t = "#{pane_in_mode}" "send-keys -M" "copy-mode -e"',
        table: undefined,
        repeat: false,
      });
    });

    it('should parse status bar with variables', () => {
      const result = TmuxCommandParser.parse(
        'set status-right "#[bg=colour28] #{b:pane_current_path} #[bg=colour236] %H:%M:%S "',
      );
      expect(result).toEqual({
        type: 'set',
        option: 'status-right',
        value: '"#[bg=colour28] #{b:pane_current_path} #[bg=colour236] %H:%M:%S "',
        isGlobal: false,
      });
    });
  });
});
