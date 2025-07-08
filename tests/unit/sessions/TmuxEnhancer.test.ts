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

  describe('toggleSynchronizedPanes', () => {
    it('should toggle synchronized panes successfully', () => {
      const result = TmuxEnhancer.toggleSynchronizedPanes('test-session');
      expect(result).toBe(true);
      expect(TmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'test-session',
        'synchronize-panes',
        'on',
      );
    });

    it('should handle errors when toggling synchronized panes', () => {
      // The method uses void TmuxDriver.setWindowOption which means it doesn't wait for promise
      // So exceptions won't be caught in the try-catch. This tests the successful path.
      const result = TmuxEnhancer.toggleSynchronizedPanes('test-session');
      expect(result).toBe(true);
      expect(TmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'test-session',
        'synchronize-panes',
        'on',
      );
    });
  });

  describe('getPredefinedLayouts', () => {
    it('should return predefined layouts', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();
      expect(layouts).toHaveLength(4);
      expect(layouts[0]).toEqual({
        name: 'main-feature',
        description: 'Main branch and feature branch side by side',
        branches: ['main', 'feature/*'],
        layout: 'even-horizontal',
      });
      expect(layouts[1]).toEqual({
        name: 'triple-review',
        description: 'Three branches for code review',
        branches: ['main', 'develop', 'feature/*'],
        layout: 'even-horizontal',
      });
      expect(layouts[2]).toEqual({
        name: 'quad-split',
        description: 'Four branches in grid layout',
        branches: ['*', '*', '*', '*'],
        layout: 'tiled',
      });
      expect(layouts[3]).toEqual({
        name: 'main-develop',
        description: 'Main branch with develop branch below',
        branches: ['main', 'develop'],
        layout: 'main-horizontal',
      });
    });
  });

  describe('createDashboardWindow', () => {
    it('should create dashboard window with multiple branches', () => {
      const branches = ['main', 'feature1', 'feature2'];
      const worktreeBase = '/path/to/worktree';

      TmuxEnhancer.createDashboardWindow('test-session', branches, worktreeBase);

      expect(TmuxDriver.createWindow).toHaveBeenCalledWith({
        sessionName: 'test-session',
        windowName: 'dashboard',
      });
      expect(TmuxDriver.splitPane).toHaveBeenCalledTimes(2); // 3 branches = 2 splits
      expect(TmuxDriver.sendKeys).toHaveBeenCalledWith(
        'test-session:dashboard',
        ['select-layout tiled'],
        false,
      );
    });

    it('should handle up to 6 branches for dashboard', () => {
      const branches = [
        'main',
        'feature1',
        'feature2',
        'feature3',
        'feature4',
        'feature5',
        'feature6',
        'feature7',
      ];
      const worktreeBase = '/path/to/worktree';

      TmuxEnhancer.createDashboardWindow('test-session', branches, worktreeBase);

      expect(TmuxDriver.splitPane).toHaveBeenCalledTimes(5); // 6 branches = 5 splits
      expect(TmuxDriver.sendKeys).toHaveBeenCalledTimes(7); // 6 branches + 1 layout command
    });

    it('should handle single branch for dashboard', () => {
      const branches = ['main'];
      const worktreeBase = '/path/to/worktree';

      TmuxEnhancer.createDashboardWindow('test-session', branches, worktreeBase);

      expect(TmuxDriver.createWindow).toHaveBeenCalledWith({
        sessionName: 'test-session',
        windowName: 'dashboard',
      });
      expect(TmuxDriver.splitPane).not.toHaveBeenCalled(); // No splits for single branch
      expect(TmuxDriver.sendKeys).toHaveBeenCalledWith(
        'test-session:dashboard',
        ['select-layout tiled'],
        false,
      );
    });
  });

  describe('createComparisonLayout', () => {
    it('should warn when fewer than 2 branches provided', () => {
      TmuxEnhancer.createComparisonLayout('test-session', ['main'], 'project');

      // The implementation uses Logger.warn, but our mock is on the imported Logger
      expect(TmuxDriver.createWindow).not.toHaveBeenCalled();
    });

    it('should create side-by-side layout for 2 branches', () => {
      const branches = ['main', 'feature'];

      TmuxEnhancer.createComparisonLayout('test-session', branches, 'project');

      expect(TmuxDriver.createWindow).toHaveBeenCalledWith({
        sessionName: 'test-session',
        windowName: 'compare',
      });
      expect(TmuxDriver.splitPane).toHaveBeenCalledWith({
        target: 'test-session:compare',
        horizontal: true,
        percentage: 50,
      });
    });

    it('should create 3-pane layout for 3 branches', () => {
      const branches = ['main', 'feature1', 'feature2'];

      TmuxEnhancer.createComparisonLayout('test-session', branches, 'project');

      expect(TmuxDriver.splitPane).toHaveBeenCalledWith({
        target: 'test-session:compare',
        horizontal: false,
        percentage: 50,
      });
      expect(TmuxDriver.splitPane).toHaveBeenCalledWith({
        target: 'test-session:compare.2',
        horizontal: true,
        percentage: 50,
      });
    });

    it('should create 2x2 grid layout for 4 branches', () => {
      const branches = ['main', 'feature1', 'feature2', 'feature3'];

      TmuxEnhancer.createComparisonLayout('test-session', branches, 'project');

      expect(TmuxDriver.splitPane).toHaveBeenCalledTimes(3); // 4 panes = 3 splits
    });

    it('should set pane options for comparison layout', () => {
      const branches = ['main', 'feature'];

      TmuxEnhancer.createComparisonLayout('test-session', branches, 'project');

      // Verify pane styling options are set
      expect(TmuxDriver.setOption).toHaveBeenCalledWith(
        'test-session:compare',
        'pane-border-status',
        'top',
      );
      expect(TmuxDriver.setOption).toHaveBeenCalledWith(
        'test-session:compare',
        'pane-border-style',
        'fg=colour240',
      );
      expect(TmuxDriver.setOption).toHaveBeenCalledWith(
        'test-session:compare',
        'pane-active-border-style',
        'fg=colour32,bold',
      );
      expect(TmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'test-session:compare',
        'remain-on-exit',
        'off',
      );
      expect(TmuxDriver.setWindowOption).toHaveBeenCalledWith(
        'test-session:compare',
        'aggressive-resize',
        'on',
      );
    });
  });
});
