import { vi } from 'vitest';
import type { StatusBarConfig } from '../../../src/sessions/TmuxEnhancer';

// Mock Logger before importing TmuxEnhancer
vi.mock('../../../src/core/utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock TmuxDriver
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

// Import after mocks are set up
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import { TmuxDriver } from '../../../src/core/drivers/TmuxDriver';
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
  });

  describe('configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should configure all session enhancements successfully', async () => {
      await TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      // Should have called TmuxDriver methods for configuration
      expect((TmuxDriver as any).setOption).toHaveBeenCalled();
      expect((TmuxDriver as any).bindKey).toHaveBeenCalled();

      // Verify specific options were set
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-feature',
        'mode-keys',
        'vi',
        true,
      );
    });

    it('should handle configuration errors gracefully', async () => {
      // Make setOption throw an error
      (TmuxDriver.setOption as vi.Mock).mockRejectedValue(new Error('tmux command failed'));

      // Should not throw when configuration fails
      await expect(
        TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig),
      ).resolves.not.toThrow();

      // Verify it attempted to configure
      expect((TmuxDriver as any).setOption).toHaveBeenCalled();
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

  describe('toggleSynchronizedPanes', () => {
    it('should toggle synchronized panes on', () => {
      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');

      expect((TmuxDriver as any).setWindowOption).toHaveBeenCalledWith(
        'cgwt-test',
        'synchronize-panes',
        'on',
      );
      expect(result).toBe(true);
    });

    it('should always set to on (current implementation)', () => {
      // First call turns it on
      TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');
      vi.clearAllMocks();

      // Second call also sets to on (current implementation doesn't maintain state)
      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');

      expect((TmuxDriver as any).setWindowOption).toHaveBeenCalledWith(
        'cgwt-test',
        'synchronize-panes',
        'on',
      );
      expect(result).toBe(true);
    });

    it('should handle toggle errors', () => {
      // The current implementation returns false on error
      (TmuxDriver.setWindowOption as vi.Mock).mockImplementation(() => {
        throw new Error('tmux error');
      });

      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test');

      // Should return false on error
      expect(result).toBe(false);
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
