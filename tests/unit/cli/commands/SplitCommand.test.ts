import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { SplitCommand } from '../../../../src/cli/commands/SplitCommand.js';
import { TmuxDriver } from '../../../../src/sessions/TmuxDriver.js';
import { execCommandSafe } from '../../../../src/core/utils/async.js';
import type { Session } from '../../../../src/cli/cgwt-program.js';

vi.mock('../../../../src/sessions/TmuxDriver.js');
vi.mock('../../../../src/core/utils/async.js');
vi.mock('../../../../src/core/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('SplitCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let mockGetSessions: MockedFunction<() => Promise<Session[]>>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetSessions = vi.fn().mockResolvedValue([
      { path: '/path/main', branch: 'main', head: 'abc123' },
      { path: '/path/feature', branch: 'feature', head: 'def456' },
    ]);
    vi.mocked(execCommandSafe).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  describe('execute', () => {
    it('should show error when not in tmux', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(false);

      await SplitCommand.execute(undefined, {}, mockGetSessions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Not inside a tmux session'),
      );
      expect(execCommandSafe).not.toHaveBeenCalled();
    });

    it('should split pane with bash when no target specified', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute(undefined, {}, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '#{pane_current_path}',
        '-p',
        '50',
        expect.stringContaining('New pane created!'),
      ]);
    });

    it('should split horizontally when horizontal option is true', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute(undefined, { horizontal: true }, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-v', // -v for horizontal split
        '-c',
        '#{pane_current_path}',
        '-p',
        '50',
        expect.any(String),
      ]);
    });

    it('should use custom percentage when provided', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute(undefined, { percentage: '30' }, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '#{pane_current_path}',
        '-p',
        '30',
        expect.any(String),
      ]);
    });

    it('should launch cgwt with index when numeric target provided', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute('2', {}, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '#{pane_current_path}',
        '-p',
        '50',
        'cgwt -a 2',
      ]);
    });

    it('should launch cgwt with multi-project index', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute('2.1', {}, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '#{pane_current_path}',
        '-p',
        '50',
        'cgwt -a 2.1',
      ]);
    });

    it('should find branch by name and use its index', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute('feature', {}, mockGetSessions);

      expect(execCommandSafe).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '#{pane_current_path}',
        '-p',
        '50',
        'cgwt -a 2', // feature is at index 2
      ]);
    });

    it('should show error when branch not found', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);

      await SplitCommand.execute('nonexistent', {}, mockGetSessions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch "nonexistent" not found'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available branches:'));
      expect(execCommandSafe).not.toHaveBeenCalled();
    });

    it('should handle tmux command failure', async () => {
      vi.mocked(TmuxDriver.isInsideTmux).mockReturnValue(true);
      vi.mocked(execCommandSafe).mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: 'tmux error',
      });

      await SplitCommand.execute('1', {}, mockGetSessions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to split pane:'),
        'tmux error',
      );
    });
  });
});
