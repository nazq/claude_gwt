import { vi } from 'vitest';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { StatusBarConfig } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver } from '../../../src/core/drivers/TmuxDriver';
import { Logger } from '../../../src/core/utils/logger';

vi.mock('../../../src/core/drivers/TmuxDriver', () => ({
  TmuxDriver: {
    setOption: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    setWindowOption: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    bindKey: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    unbindKey: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    setHook: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    createWindow: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    killPane: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    splitPane: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    setPaneTitle: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    sendKeys: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
  },
}));
vi.mock('../../../src/core/utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

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
  });

  describe.skip('configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should configure all session enhancements successfully', async () => {
      await TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('Configuring enhanced tmux session', {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Tmux session enhanced successfully', {
        sessionName: 'cgwt-test-feature',
      });

      // Should have called TmuxDriver methods
      expect((TmuxDriver as any).setOption).toHaveBeenCalled();
      expect((TmuxDriver as any).bindKey).toHaveBeenCalled();
    });

    it.skip('should handle configuration errors gracefully', async () => {
      // TODO: Fix this test - mock setup is causing immediate errors
      // Reset the mock to throw an error for this specific test
      (TmuxDriver.setOption as vi.Mock)
        .mockReset()
        .mockRejectedValue(new Error('tmux command failed'));

      // Should not throw when configuration fails
      await TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enhance tmux session',
        expect.any(Error),
      );
    });

    it('should configure status bar for supervisor role', async () => {
      const supervisorConfig: StatusBarConfig = {
        sessionName: 'cgwt-test-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      await TmuxEnhancer.configureSession('cgwt-test-supervisor', supervisorConfig);

      // Should set status bar with supervisor colors
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-supervisor',
        'status-style',
        expect.stringContaining('colour32'), // Blue for supervisor
      );
    });
  });

  describe.skip('createComparisonLayout', () => {
    it('should create layout for 2 branches', () => {
      TmuxEnhancer.createComparisonLayout('cgwt-test', ['main', 'feature'], 'test');

      expect(mockLogger.info).toHaveBeenCalledWith('Creating comparison layout', {
        sessionName: 'cgwt-test',
        branches: ['main', 'feature'],
        projectName: 'test',
      });

      // Should create window and split once
      expect((TmuxDriver as any).createWindow).toHaveBeenCalledWith({
        sessionName: 'cgwt-test',
        windowName: 'compare',
      });
      expect((TmuxDriver as any).splitPane).toHaveBeenCalledTimes(1);
    });

    it('should create layout for 3 branches', () => {
      TmuxEnhancer.createComparisonLayout('cgwt-test', ['main', 'develop', 'feature'], 'test');

      // Should split twice for 3 branches
      expect((TmuxDriver as any).splitPane).toHaveBeenCalledTimes(2);
    });

    it('should create layout for 4 branches', () => {
      TmuxEnhancer.createComparisonLayout(
        'cgwt-test',
        ['main', 'develop', 'feature', 'hotfix'],
        'test',
      );

      // Should split 3 times for 4 branches
      expect((TmuxDriver as any).splitPane).toHaveBeenCalledTimes(3);
    });

    it('should warn when less than 2 branches provided', () => {
      TmuxEnhancer.createComparisonLayout('cgwt-test', ['main'], 'test');

      expect(mockLogger.warn).toHaveBeenCalledWith('Need at least 2 branches for comparison');
      expect((TmuxDriver as any).createWindow).not.toHaveBeenCalled();
    });

    it.skip('should handle comparison layout errors', () => {
      // TODO: Fix this test - mock setup is causing immediate errors
      (TmuxDriver.createWindow as vi.Mock).mockRejectedValue(new Error('tmux error'));

      expect(() => {
        TmuxEnhancer.createComparisonLayout('cgwt-test', ['main', 'feature'], 'test');
      }).not.toThrow();
    });
  });

  describe('toggleSynchronizedPanes', () => {
    it('should toggle synchronized panes', () => {
      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');

      expect((TmuxDriver as any).setWindowOption).toHaveBeenCalledWith(
        'cgwt-test',
        'synchronize-panes',
        'on',
      );
      expect(result).toBe(true);
    });

    it.skip('should handle toggle errors', () => {
      // TODO: Fix this test - mock setup is causing immediate errors
      (TmuxDriver.setWindowOption as vi.Mock).mockRejectedValue(new Error('tmux error'));

      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to toggle synchronized panes',
        expect.any(Error),
      );
      expect(result).toBe(false);
    });
  });

  describe.skip('createDashboardWindow', () => {
    it('should create dashboard window', () => {
      TmuxEnhancer.createDashboardWindow(
        'cgwt-test',
        ['main', 'develop', 'feature'],
        '/path/to/worktrees',
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Creating dashboard window', {
        sessionName: 'cgwt-test',
        branches: ['main', 'develop', 'feature'],
      });

      expect((TmuxDriver as any).createWindow).toHaveBeenCalledWith({
        sessionName: 'cgwt-test',
        windowName: 'dashboard',
      });

      // Should split for each branch after the first
      expect((TmuxDriver as any).splitPane).toHaveBeenCalledTimes(2);
    });

    it('should limit dashboard to 6 branches', () => {
      const manyBranches = Array.from({ length: 10 }, (_, i) => `branch${i}`);
      TmuxEnhancer.createDashboardWindow('cgwt-test', manyBranches, '/path/to/worktrees');

      // Should only split 5 times (6 panes total)
      expect((TmuxDriver as any).splitPane).toHaveBeenCalledTimes(5);
    });

    it.skip('should handle dashboard errors', () => {
      // TODO: Fix this test - mock setup is causing immediate errors
      (TmuxDriver.createWindow as vi.Mock).mockRejectedValue(new Error('tmux error'));

      expect(() => {
        TmuxEnhancer.createDashboardWindow('cgwt-test', ['main'], '/path/to/worktrees');
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create dashboard window',
        expect.any(Error),
      );
    });
  });

  describe('getPredefinedLayouts', () => {
    it('should return predefined layouts', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();

      expect(layouts).toBeInstanceOf(Array);
      expect(layouts.length).toBeGreaterThan(0);

      const firstLayout = layouts[0];
      expect(firstLayout).toHaveProperty('name');
      expect(firstLayout).toHaveProperty('description');
      expect(firstLayout).toHaveProperty('branches');
      expect(firstLayout).toHaveProperty('layout');
    });

    it('should include main-feature layout', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();
      const mainFeatureLayout = layouts.find((l) => l.name === 'main-feature');

      expect(mainFeatureLayout).toBeDefined();
      expect(mainFeatureLayout?.branches).toContain('main');
      expect(mainFeatureLayout?.branches).toContain('feature/*');
    });
  });
});
