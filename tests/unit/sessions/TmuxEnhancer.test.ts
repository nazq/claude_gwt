import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { StatusBarConfig } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver, TmuxColor } from '../../../src/sessions/TmuxDriver';
import { Logger } from '../../../src/core/utils/logger';

vi.mock('../../../src/sessions/TmuxDriver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/sessions/TmuxDriver')>();
  return {
    ...actual,
    TmuxDriver: {
      setOption: vi.fn(),
      setWindowOption: vi.fn(),
      bindKey: vi.fn(),
      unbindKey: vi.fn(),
      setHook: vi.fn(),
      enableViCopyMode: vi.fn(),
      configureStatusBar: vi.fn(),
      configureKeyBindings: vi.fn(),
      configureMonitoring: vi.fn(),
      configurePaneBorders: vi.fn(),
      createMultiPaneWindow: vi.fn(),
      createWindow: vi.fn(),
      splitPane: vi.fn(),
      setPaneTitle: vi.fn(),
      sendKeys: vi.fn(),
    },
    // Keep TmuxColor as is
    TmuxColor: actual.TmuxColor,
  };
});
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
    // Default successful responses for low-level methods
    mockTmuxDriver.setOption.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.setWindowOption.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.bindKey.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.unbindKey.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    mockTmuxDriver.setHook.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

    // Mock new SDK methods
    mockTmuxDriver.enableViCopyMode.mockResolvedValue(undefined);
    mockTmuxDriver.configureStatusBar.mockResolvedValue(undefined);
    mockTmuxDriver.configureKeyBindings.mockResolvedValue(undefined);
    mockTmuxDriver.configureMonitoring.mockResolvedValue(undefined);
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
      mockTmuxDriver.enableViCopyMode.mockRejectedValueOnce(new Error('Option failed'));

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
      mockTmuxDriver.enableViCopyMode.mockRejectedValue(new Error('Total failure'));
      mockTmuxDriver.configureStatusBar.mockRejectedValue(new Error('Total failure'));
      mockTmuxDriver.configureKeyBindings.mockRejectedValue(new Error('Total failure'));
      mockTmuxDriver.configureMonitoring.mockRejectedValue(new Error('Total failure'));
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

      // Verify SDK method was called
      expect(mockTmuxDriver.enableViCopyMode).toHaveBeenCalledWith('test-session');
      // Verify additional option was set
      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'test-session',
        '@yank_action',
        'copy-pipe',
        true,
      );
    });

    it('should handle partial failures', async () => {
      // First call succeeds, second call fails
      mockTmuxDriver.enableViCopyMode.mockResolvedValueOnce(undefined);
      mockTmuxDriver.setOption.mockRejectedValueOnce(new Error('Failed'));

      const result = await TmuxEnhancer.configureCopyMode('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.errorCount).toBe(1);
      expect(result.details?.successCount).toBe(1);
    });

    it('should handle non-Error objects', async () => {
      // First call succeeds, second call fails with string
      mockTmuxDriver.enableViCopyMode.mockResolvedValueOnce(undefined);
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

      // Verify SDK method was called
      expect(mockTmuxDriver.configureStatusBar).toHaveBeenCalledWith(
        'cgwt-project-feature',
        expect.objectContaining({
          enabled: true,
          position: 'bottom',
          style: expect.objectContaining({
            background: expect.any(TmuxColor), // Child color (colour25)
          }),
          left: expect.stringContaining('WRK'),
        }),
      );
      // Verify window option was set
      expect(mockTmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'cgwt-project-feature',
        'monitor-activity',
        'on',
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

      // Verify SDK method was called
      expect(mockTmuxDriver.configureStatusBar).toHaveBeenCalledWith(
        'cgwt-project-supervisor',
        expect.objectContaining({
          enabled: true,
          position: 'bottom',
          style: expect.objectContaining({
            background: expect.any(TmuxColor), // Supervisor color (colour32)
          }),
          left: expect.stringContaining('SUP'),
        }),
      );
      // Verify window option was set
      expect(mockTmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'cgwt-project-supervisor',
        'monitor-activity',
        'on',
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
      expect(mockTmuxDriver.configureStatusBar).toHaveBeenCalledWith(
        'simple-name',
        expect.objectContaining({
          left: expect.stringContaining('project'),
        }),
      );
      // Verify window option was set
      expect(mockTmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'simple-name',
        'monitor-activity',
        'on',
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
      expect(mockTmuxDriver.configureMonitoring).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          'alert-activity': expect.any(String),
          'session-created': expect.any(String),
          'window-linked': expect.any(String),
        }),
      );
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
      expect(mockTmuxDriver.configureMonitoring).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          'alert-activity': 'display-message "Activity in #S"',
        }),
      );
    });

    it('should set up additional hooks for supervisor role', async () => {
      const config: StatusBarConfig = {
        sessionName: 'test-session',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      const result = await TmuxEnhancer.setupAdvancedStatusMonitoring('test-session', config);

      expect(result.success).toBe(true);
      expect(mockTmuxDriver.configureMonitoring).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          'alert-activity': expect.any(String),
          'session-created': 'display-message "Session #S created"',
          'window-linked': expect.any(String),
        }),
      );
    });

    it('should handle hook failures', async () => {
      mockTmuxDriver.configureMonitoring.mockRejectedValueOnce(new Error('Hook not supported'));

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

      // Check SDK method was called with correct bindings
      expect(mockTmuxDriver.configureKeyBindings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: 'S', command: 'choose-tree -s' }),
          expect.objectContaining({ key: 'h', command: 'select-pane -L' }),
          expect.objectContaining({ key: 'H', command: 'resize-pane -L 5', repeat: true }),
        ]),
      );
    });

    it('should handle binding failures', async () => {
      mockTmuxDriver.configureKeyBindings.mockRejectedValueOnce(new Error('Key conflict'));

      const result = await TmuxEnhancer.configureKeyBindings('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.details?.successCount).toBe(0);
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
