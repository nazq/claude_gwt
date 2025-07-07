import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { StatusBarConfig } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver } from '../../../src/sessions/TmuxDriver';
import { Logger } from '../../../src/core/utils/logger';

vi.mock('../../../src/sessions/TmuxDriver');
vi.mock('../../../src/core/utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('TmuxEnhancer', () => {
  const mockTmuxDriver = vi.mocked(TmuxDriver);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful responses
    mockTmuxDriver.setOption.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.setWindowOption.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.bindKey.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.unbindKey.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.setHook.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  describe('configureSession', () => {
    it('should return success when all operations succeed', async () => {
      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSession('test-session', config);

      expect(result.overallSuccess).toBe(true);
      expect(result.copyModeResult.success).toBe(true);
      expect(result.statusBarResult.success).toBe(true);
      expect(result.keyBindingsResult.success).toBe(true);
      expect(result.sessionGroupsResult.success).toBe(true);
    });

    it('should return partial success when some operations fail', async () => {
      // Make one operation fail
      mockTmuxDriver.setOption
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('Option failed'))
        .mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSession('test-session', config);

      expect(result.overallSuccess).toBe(false);
      expect(result.copyModeResult.success).toBe(false);
    });

    it('should handle complete failure gracefully', async () => {
      mockTmuxDriver.setOption.mockRejectedValue(new Error('Total failure'));

      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSession('test-session', config);

      expect(result.overallSuccess).toBe(false);
      // Should not throw
    });
  });

  describe('configureCopyMode', () => {
    it('should configure all copy mode settings', async () => {
      const result = await TmuxEnhancer.configureCopyMode('test-session');

      expect(result.success).toBe(true);
      expect(result.operation).toBe('configureCopyMode');

      // Verify key commands were called
      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'test-session',
        'mode-keys',
        'vi',
        true,
      );
      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith('test-session', 'mouse', 'on', true);
      expect(mockTmuxDriver.bindKey).toHaveBeenCalledWith(
        'v',
        'send-keys -X begin-selection',
        'copy-mode-vi',
        false,
      );
      expect(mockTmuxDriver.unbindKey).toHaveBeenCalledWith('MouseDrag1Pane', undefined);
    });

    it('should handle partial failures', async () => {
      mockTmuxDriver.setOption
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      const result = await TmuxEnhancer.configureCopyMode('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.errorCount).toBe(1);
      expect(result.details?.successCount).toBeGreaterThan(0);
    });

    it('should handle non-Error objects', async () => {
      mockTmuxDriver.setOption.mockRejectedValueOnce('string error');

      const result = await TmuxEnhancer.configureCopyMode('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('configureStatusBar', () => {
    it('should configure status bar for child role', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-feature',
        branchName: 'feature-branch',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureStatusBar('cgwt-project-feature', config);

      expect(result.success).toBe(true);

      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-feature',
        'status-style',
        expect.stringContaining('colour25'), // Child color
      );

      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-feature',
        'status-left',
        expect.stringContaining('WRK'),
      );
    });

    it('should configure status bar for supervisor role', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      const result = await TmuxEnhancer.configureStatusBar('cgwt-project-supervisor', config);

      expect(result.success).toBe(true);

      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-supervisor',
        'status-style',
        expect.stringContaining('colour32'), // Supervisor color
      );

      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-supervisor',
        'status-left',
        expect.stringContaining('SUP'),
      );
    });

    it('should handle session names with different formats', async () => {
      const config: StatusBarConfig = {
        sessionName: 'simple-name',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureStatusBar('simple-name', config);

      expect(result.success).toBe(true);

      // Should use 'project' as default
      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'simple-name',
        'status-left',
        expect.stringContaining('project'),
      );
    });

    it('should include monitoring result', async () => {
      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'supervisor',
      };

      const result = await TmuxEnhancer.configureStatusBar('test-session', config);

      expect(result.success).toBe(true);
      expect(result.details?.monitoringResult).toBeDefined();

      // Supervisor should have more hooks
      expect(mockTmuxDriver.setHook).toHaveBeenCalledTimes(3);
    });
  });

  describe('setupAdvancedStatusMonitoring', () => {
    it('should set up basic hooks for child role', async () => {
      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.setupAdvancedStatusMonitoring('test-session', config);

      expect(result.success).toBe(true);
      expect(mockTmuxDriver.setHook).toHaveBeenCalledWith(
        'alert-activity',
        'display-message "Activity in #S"',
      );
      expect(mockTmuxDriver.setHook).toHaveBeenCalledTimes(1);
    });

    it('should set up additional hooks for supervisor role', async () => {
      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      const result = await TmuxEnhancer.setupAdvancedStatusMonitoring('test-session', config);

      expect(result.success).toBe(true);
      expect(mockTmuxDriver.setHook).toHaveBeenCalledTimes(3);

      expect(mockTmuxDriver.setHook).toHaveBeenCalledWith(
        'session-created',
        'display-message "Session #S created"',
      );
    });

    it('should handle hook failures', async () => {
      mockTmuxDriver.setHook.mockRejectedValueOnce(new Error('Hook not supported'));

      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.setupAdvancedStatusMonitoring('test-session', config);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.errorCount).toBe(1);
    });
  });

  describe('configureKeyBindings', () => {
    it('should configure all key bindings', async () => {
      const result = await TmuxEnhancer.configureKeyBindings('test-session');

      expect(result.success).toBe(true);

      // Check various bindings
      expect(mockTmuxDriver.bindKey).toHaveBeenCalledWith('S', 'choose-tree -s', undefined, false);
      expect(mockTmuxDriver.bindKey).toHaveBeenCalledWith('h', 'select-pane -L', undefined, false);
      expect(mockTmuxDriver.bindKey).toHaveBeenCalledWith('H', 'resize-pane -L 5', undefined, true);
    });

    it('should handle binding failures', async () => {
      mockTmuxDriver.bindKey
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('Key conflict'))
        .mockResolvedValue({ code: 0, stdout: '', stderr: '' });

      const result = await TmuxEnhancer.configureKeyBindings('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.successCount).toBeGreaterThan(0);
    });
  });

  describe('configureSessionGroups', () => {
    it('should configure session group for properly named session', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-feature',
        branchName: 'feature',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSessionGroups('cgwt-project-feature', config);

      expect(result.success).toBe(true);
      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-feature',
        '@session-group',
        'cgwt-project',
      );
      expect(result.details?.projectGroup).toBe('cgwt-project');
    });

    it('should skip grouping for simple session names', async () => {
      const config: StatusBarConfig = {
        sessionName: 'simple',
        branchName: 'main',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSessionGroups('simple', config);

      expect(result.success).toBe(true);
      expect(mockTmuxDriver.setOption).not.toHaveBeenCalled();
      expect(result.details?.reason).toBe('Session name does not support grouping');
    });

    it('should handle grouping failures gracefully', async () => {
      mockTmuxDriver.setOption.mockRejectedValue(new Error('Not supported'));

      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-feature',
        branchName: 'feature',
        role: 'child',
      };

      const result = await TmuxEnhancer.configureSessionGroups('cgwt-project-feature', config);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.projectGroup).toBe('cgwt-project');
    });
  });
});
