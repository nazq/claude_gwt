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
});
