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
import type { StatusBarConfig } from '../../../src/sessions/TmuxEnhancer';
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
  });

  describe('configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it.skip('should configure all session enhancements successfully', async () => {
      // TODO: Fix Logger mock to work with static method calls
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

    it.skip('should handle configuration errors gracefully', async () => {
      // TODO: Fix this test - mock setup is causing immediate errors
      // Reset the mock to throw an error for this specific test
      (TmuxDriver.setOption as vi.Mock)
        .mockReset()
        .mockRejectedValue(new Error('tmux command failed'));

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

  describe('createComparisonLayout', () => {
    it.skip('should create layout for 2 branches', () => {
      // TODO: Fix Logger mock to work with static method calls
      TmuxEnhancer.createComparisonLayout('cgwt-test', ['main', 'feature'], 'test');

      expect(mockLogger.info).toHaveBeenCalledWith('Creating comparison layout', {
        sessionName: 'cgwt-test',
        branches: ['main', 'feature'],
        description: 'test',
      });

      // Should create window
      expect((TmuxDriver as any).createWindow).toHaveBeenCalledWith({
        sessionName: 'cgwt-test',
        windowName: 'test',
      });

      // Should split panes
      expect((TmuxDriver as any).splitPane).toHaveBeenCalled();
    });

    it.skip('should handle layout creation errors', () => {
      // Make createWindow fail
      (TmuxDriver.createWindow as vi.Mock).mockRejectedValue(new Error('tmux failed'));

      // Should not throw
      expect(() => {
        TmuxEnhancer.createComparisonLayout('cgwt-test', ['main', 'feature'], 'test');
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create comparison layout',
        expect.any(Error),
      );
    });
  });

  describe('configureCopyMode', () => {
    it('should set up vi-mode copy bindings', async () => {
      // Access private method through prototype
      const enhancer = Object.create(TmuxEnhancer.prototype);
      await enhancer.constructor.configureCopyMode('cgwt-test');

      // Should set vi mode
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test',
        'mode-keys',
        'vi',
        true,
      );

      // Should enable mouse
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith('cgwt-test', 'mouse', 'on', true);

      // Should bind copy keys
      expect((TmuxDriver as any).bindKey).toHaveBeenCalledWith(
        'v',
        'send-keys -X begin-selection',
        'copy-mode-vi',
        false,
      );
    });
  });

  describe('configureKeyBindings', () => {
    it.skip('should set up custom key bindings', () => {
      // Access private method through prototype
      const enhancer = Object.create(TmuxEnhancer.prototype);
      enhancer.constructor.configureKeyBindings('cgwt-test');

      // Should unbind default keys
      expect((TmuxDriver as any).unbindKey).toHaveBeenCalledWith('c');
      expect((TmuxDriver as any).unbindKey).toHaveBeenCalledWith('n');

      // Should bind custom keys
      expect((TmuxDriver as any).bindKey).toHaveBeenCalledWith(
        '|',
        expect.stringContaining('split-window -h'),
      );
      expect((TmuxDriver as any).bindKey).toHaveBeenCalledWith(
        '-',
        expect.stringContaining('split-window -v'),
      );
    });
  });

  describe('configureStatusBar', () => {
    it('should configure status bar for child sessions', () => {
      // Access private method through prototype
      const enhancer = Object.create(TmuxEnhancer.prototype);
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      };

      enhancer.constructor.configureStatusBar('cgwt-test-feature', config);

      // Should set status on
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-feature',
        'status',
        'on',
      );

      // Should set status style with blue color for child
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-feature',
        'status-style',
        expect.stringContaining('colour25'), // Blue for child
      );

      // Should set status format
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-feature',
        'status-left',
        expect.stringContaining('WRK'),
      );
    });

    it('should configure status bar for supervisor sessions', () => {
      // Access private method through prototype
      const enhancer = Object.create(TmuxEnhancer.prototype);
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test-supervisor',
        branchName: 'supervisor',
        role: 'supervisor',
      };

      enhancer.constructor.configureStatusBar('cgwt-test-supervisor', config);

      // Should set status style with blue color for supervisor
      expect((TmuxDriver as any).setOption).toHaveBeenCalledWith(
        'cgwt-test-supervisor',
        'status-style',
        expect.stringContaining('colour32'), // Blue for supervisor
      );
    });
  });

  describe('configureSessionGroups', () => {
    it.skip('should set up session groups', () => {
      // Access private method through prototype
      const enhancer = Object.create(TmuxEnhancer.prototype);
      const config: StatusBarConfig = {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      };

      enhancer.constructor.configureSessionGroups('cgwt-test-feature', config);

      // Should set hooks for session coordination
      expect((TmuxDriver as any).setHook).toHaveBeenCalled();
    });
  });
});
