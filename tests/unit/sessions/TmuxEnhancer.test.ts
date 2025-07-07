import { vi } from 'vitest';

vi.mock('../../../src/sessions/TmuxDriver');

// Mock logger
vi.mock('../../../src/core/utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocking dependencies
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { StatusBarConfig, PaneLayout } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver } from '../../../src/sessions/TmuxDriver';
import { Logger } from '../../../src/core/utils/logger';
describe('TmuxEnhancer', () => {
  const mockLogger = vi.mocked(Logger);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock all TmuxDriver methods to return successful results
    (TmuxDriver.setOption as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.setWindowOption as vi.Mock).mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: '',
    });
    (TmuxDriver.bindKey as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.unbindKey as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.setHook as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.createWindow as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.killPane as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.splitPane as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.setPaneTitle as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    (TmuxDriver.sendKeys as vi.Mock).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    // Mock structured API methods
    (TmuxDriver.configureStatusBar as vi.Mock).mockResolvedValue([
      { code: 0, stdout: '', stderr: '' },
    ]);
    (TmuxDriver.configureKeyBindings as vi.Mock).mockResolvedValue([
      { code: 0, stdout: '', stderr: '' },
    ]);
    (TmuxDriver.enableViCopyMode as vi.Mock).mockResolvedValue([
      { code: 0, stdout: '', stderr: '' },
    ]);
  });

  describe('configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should configure status bar for supervisor role', async () => {
      const supervisorConfig: StatusBarConfig = {
        sessionName: 'cgwt-test-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      // Should complete configuration without errors
      await expect(
        TmuxEnhancer.configureSession('cgwt-test-supervisor', supervisorConfig),
      ).resolves.not.toThrow();

      // Verify some tmux driver methods were called
      expect((TmuxDriver as any).setOption).toHaveBeenCalled();
    });
  });

  describe('structured API integration', () => {
    it('should use TmuxDriver structured methods in session configuration', async () => {
      const mockConfig: StatusBarConfig = {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      };

      await TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      // Should call the structured API methods
      expect((TmuxDriver as any).enableViCopyMode).toHaveBeenCalledWith('cgwt-test-feature');
      expect((TmuxDriver as any).configureStatusBar).toHaveBeenCalledWith(
        'cgwt-test-feature',
        expect.any(Object),
      );
      expect((TmuxDriver as any).configureKeyBindings).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('structured API configuration', () => {
    it('should configure status bar using structured API for child sessions', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-feature',
        branchName: 'feature-branch',
        role: 'child',
      };

<<<<<<< HEAD
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
=======
      await TmuxEnhancer.configureSession('cgwt-test-feature', config);

      // Should call the structured status bar configuration
      expect((TmuxDriver as any).configureStatusBar).toHaveBeenCalledWith(
        'cgwt-test-feature',
        expect.objectContaining({
          enabled: true,
          style: expect.objectContaining({
            background: 'colour25', // Blue for child
          }),
          left: expect.objectContaining({
            content: expect.stringContaining('WRK'),
          }),
        }),
      );
    });

    it('should configure status bar using structured API for supervisor sessions', async () => {
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

<<<<<<< HEAD
      const result = await TmuxEnhancer.configureStatusBar('cgwt-project-supervisor', config);

      expect(result.success).toBe(true);

      expect(mockTmuxDriver.setOption).toHaveBeenCalledWith(
        'cgwt-project-supervisor',
        'status-style',
        expect.stringContaining('colour32'), // Supervisor color
=======
      await TmuxEnhancer.configureSession('cgwt-test-supervisor', config);

      // Should call the structured status bar configuration
      expect((TmuxDriver as any).configureStatusBar).toHaveBeenCalledWith(
        'cgwt-test-supervisor',
        expect.objectContaining({
          enabled: true,
          style: expect.objectContaining({
            background: 'colour32', // Blue for supervisor
          }),
          left: expect.objectContaining({
            content: expect.stringContaining('SUP'),
          }),
        }),
>>>>>>> 9ca57d9 (feat: refactor TmuxDriver to structured SDK with comprehensive test coverage)
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

  describe('key bindings configuration', () => {
    it('should configure key bindings using structured API', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test',
        branchName: 'feature',
        role: 'child',
      };

      await TmuxEnhancer.configureSession('cgwt-test', config);

      // Should call the structured key bindings configuration
      expect((TmuxDriver as any).configureKeyBindings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'S',
            command: 'choose-tree -s',
            note: 'Show session tree',
          }),
          expect.objectContaining({
            key: 'h',
            command: 'select-pane -L',
            note: 'Select left pane',
          }),
          expect.objectContaining({
            key: 'l',
            command: 'select-pane -R',
            note: 'Select right pane',
          }),
        ]),
      );
    });

    it('should complete without errors even if driver calls fail', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test',
        branchName: 'feature',
        role: 'child',
      };

      // Mock key bindings to fail
      (TmuxDriver.configureKeyBindings as vi.Mock).mockRejectedValue(new Error('Mock error'));

      // Should not throw - TmuxEnhancer catches errors
      await expect(TmuxEnhancer.configureSession('cgwt-test', config)).resolves.not.toThrow();
    });
  });

  describe('configureSessionGroups', () => {
    it('should configure session grouping for child sessions', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      };

      const enhancer = Object.create(TmuxEnhancer.prototype);
      await enhancer.constructor.configureSessionGroups('cgwt-test-feature', config);

      // Should set session group
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-feature',
        '@session-group',
        'cgwt-test',
      );
    });

    it('should configure session grouping for supervisor sessions', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      const enhancer = Object.create(TmuxEnhancer.prototype);
      await enhancer.constructor.configureSessionGroups('cgwt-test-supervisor', config);

      // Should set session group
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-supervisor',
        '@session-group',
        'cgwt-test',
      );
    });
  });

  describe('error handling', () => {
    it('should not throw errors during configuration', async () => {
      const mockConfig: StatusBarConfig = {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      };

      // Should complete without throwing
      await expect(
        TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig),
      ).resolves.not.toThrow();
    });
  });

  describe('copy mode configuration', () => {
    it('should enable vi copy mode using structured API', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test',
        branchName: 'feature',
        role: 'child',
      };

      await TmuxEnhancer.configureSession('cgwt-test', config);

      // Should call the structured copy mode configuration
      expect((TmuxDriver as any).enableViCopyMode).toHaveBeenCalledWith('cgwt-test');
    });

    it('should handle copy mode configuration without errors', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test',
        branchName: 'feature',
        role: 'child',
      };

      // Mock copy mode to fail
      (TmuxDriver.enableViCopyMode as vi.Mock).mockRejectedValue(new Error('Mock error'));

      // Should complete successfully even if driver calls fail
      await expect(TmuxEnhancer.configureSession('cgwt-test', config)).resolves.not.toThrow();
    });

    it('should enable vi copy mode with proper key bindings', async () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test',
        branchName: 'feature',
        role: 'child',
      };

      await TmuxEnhancer.configureSession('cgwt-test', config);

      // Should call enableViCopyMode which handles all vi keybindings internally
      expect((TmuxDriver as any).enableViCopyMode).toHaveBeenCalledWith('cgwt-test');
    });
  });

  describe('pane layout management', () => {
    it('should create comparison layouts', () => {
      const branches = ['main', 'feature'];
      const projectName = 'test-project';

      // Test the createComparisonLayout method
      expect(() => {
        TmuxEnhancer.createComparisonLayout('cgwt-test', branches, projectName);
      }).not.toThrow();

      // Should call various TmuxDriver methods for layout creation
      expect((TmuxDriver as any).createWindow).toHaveBeenCalled();
      expect((TmuxDriver as any).splitPane).toHaveBeenCalled();
      expect((TmuxDriver as any).setPaneTitle).toHaveBeenCalled();
    });

    it('should create dashboard windows', () => {
      const branches = ['main', 'feature', 'develop'];
      const worktreeBase = '/test/worktree';

      // Test the createDashboardWindow method
      expect(() => {
        TmuxEnhancer.createDashboardWindow('cgwt-test', branches, worktreeBase);
      }).not.toThrow();

      // Should call various TmuxDriver methods for dashboard creation
      expect((TmuxDriver as any).createWindow).toHaveBeenCalled();
      expect((TmuxDriver as any).splitPane).toHaveBeenCalled();
      expect((TmuxDriver as any).sendKeys).toHaveBeenCalled();
    });
  });
});
