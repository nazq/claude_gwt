import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TipsCommand } from '../../../../src/cli/commands/TipsCommand.js';

// Mock chalk to return the input string for testing
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    yellow: (str: string) => str,
    dim: (str: string) => str,
  },
}));

describe('TipsCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('execute', () => {
    it('should display all tips sections', () => {
      TipsCommand.execute();

      // Check header
      expect(consoleLogSpy).toHaveBeenCalledWith('\n🎯 Claude GWT Tips & Tricks\n');

      // Check Quick Navigation section
      expect(consoleLogSpy).toHaveBeenCalledWith('Quick Navigation:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  cgwt -l           List all projects');
      expect(consoleLogSpy).toHaveBeenCalledWith('  cgwt -la          List only active sessions');
      expect(consoleLogSpy).toHaveBeenCalledWith('  cgwt -a 1         Attach to session 1');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  cgwt -a 2.1       Attach to project 2, branch 1',
      );

      // Check Pane Splitting section
      expect(consoleLogSpy).toHaveBeenCalledWith('Pane Splitting:');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  cgwt split        Split current pane with bash',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  cgwt split main   Split and launch main branch',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  cgwt split -h     Split horizontally (top/bottom)',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('  cgwt split -p 30  Split with 30% size');

      // Check Tmux Keyboard Shortcuts section
      expect(consoleLogSpy).toHaveBeenCalledWith('Tmux Keyboard Shortcuts:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (After pressing Ctrl+B)');
      expect(consoleLogSpy).toHaveBeenCalledWith('  |                 Split vertically');
      expect(consoleLogSpy).toHaveBeenCalledWith('  -                 Split horizontally');
      expect(consoleLogSpy).toHaveBeenCalledWith('  h/j/k/l           Navigate panes (vim-style)');
      expect(consoleLogSpy).toHaveBeenCalledWith('  S                 Choose session from tree');

      // Check Quick Pane Splits section
      expect(consoleLogSpy).toHaveBeenCalledWith('Quick Pane Splits (no prefix):');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Alt+\\             Split vertically');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Alt+-             Split horizontally');

      // Check Inside Claude section
      expect(consoleLogSpy).toHaveBeenCalledWith('Inside Claude:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  !<command>        Execute shell commands');
      expect(consoleLogSpy).toHaveBeenCalledWith('  !cgwt -l          List sessions from Claude');
      expect(consoleLogSpy).toHaveBeenCalledWith('  !cgwt split       Split pane from Claude');

      // Check pro tip
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pro tip: Run "cgwt split" from within Claude to quickly',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'open another branch for comparison or reference!\n',
      );
    });

    it('should output exactly the same format as original', () => {
      TipsCommand.execute();

      // Verify exact number of console.log calls
      expect(consoleLogSpy).toHaveBeenCalledTimes(35);

      // Verify empty lines are in the right places
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.filter((call) => call === '').length).toBe(5); // 5 empty lines
    });
  });
});
