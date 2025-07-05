import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';
import type { StatusBarConfig, PaneLayout, TmuxExecutor } from '../../../src/sessions/TmuxEnhancer';
import { Logger } from '../../../src/core/utils/logger';

describe('TmuxEnhancer', () => {
  const mockLogger = Logger as jest.Mocked<typeof Logger>;
  const mockExecSync = jest.fn();
  const mockExecutor: TmuxExecutor = {
    execSync: mockExecSync,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful execSync mock
    mockExecSync.mockReturnValue('');
    // Set our mock executor
    TmuxEnhancer.setExecutor(mockExecutor);
  });

  describe('configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should configure all session enhancements successfully', () => {
      TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('Configuring enhanced tmux session', {
        sessionName: 'cgwt-test-feature',
        branchName: 'feature',
        role: 'child',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Tmux session enhanced successfully', {
        sessionName: 'cgwt-test-feature',
      });

      // Should have called execSync multiple times for various configurations
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should handle configuration errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('tmux command failed');
      });

      // Should not throw when configuration fails
      expect(() => {
        TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);
      }).not.toThrow();

      // Should log debug messages for individual failures
      expect(mockLogger.debug).toHaveBeenCalled();

      // Even with errors, the success message is logged because individual methods handle their own errors
      expect(mockLogger.info).toHaveBeenCalledWith('Tmux session enhanced successfully', {
        sessionName: 'cgwt-test-feature',
      });
    });

    it('should configure supervisor sessions differently', () => {
      const supervisorConfig: StatusBarConfig = {
        ...mockConfig,
        role: 'supervisor',
      };

      TmuxEnhancer.configureSession('cgwt-test-supervisor', supervisorConfig);

      expect(mockLogger.info).toHaveBeenCalledWith('Configuring enhanced tmux session', {
        sessionName: 'cgwt-test-supervisor',
        branchName: 'feature',
        role: 'supervisor',
      });
    });
  });

  describe('createComparisonLayout', () => {
    beforeEach(() => {
      // Mock successful tmux commands
      mockExecSync.mockReturnValue('');
    });

    it('should create layout for 2 branches', () => {
      const branches = ['main', 'feature'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      expect(mockLogger.info).toHaveBeenCalledWith('Creating comparison layout', {
        sessionName: 'cgwt-test-supervisor',
        branches,
        projectName: 'test',
      });

      // Should create new window
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux new-window -t cgwt-test-supervisor -n "compare"',
        undefined,
      );

      // Should create side-by-side layout for 2 branches
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare -h -p 50',
        undefined,
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Comparison layout created successfully');
    });

    it('should create layout for 3 branches', () => {
      const branches = ['main', 'feature', 'develop'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      // Should create one on top, two on bottom layout
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare -v -p 50',
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare.2 -h -p 50',
        undefined,
      );
    });

    it('should create layout for 4 branches', () => {
      const branches = ['main', 'feature', 'develop', 'hotfix'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      // Should create 2x2 grid layout
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare -h -p 50',
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare.1 -v -p 50',
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:compare.2 -v -p 50',
        undefined,
      );
    });

    it('should configure pane titles and connections', () => {
      const branches = ['main', 'feature'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      // Should set pane titles
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux select-pane -t cgwt-test-supervisor:compare.1 -T " main "',
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux select-pane -t cgwt-test-supervisor:compare.2 -T " feature "',
        undefined,
      );

      // Should connect panes to Claude sessions
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('tmux send-keys -t cgwt-test-supervisor:compare.1'),
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('cgwt-test-main'),
        undefined,
      );
    });

    it('should warn and return early for insufficient branches', () => {
      const branches = ['main'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      expect(mockLogger.warn).toHaveBeenCalledWith('Need at least 2 branches for comparison');

      // Should not try to create windows
      expect(mockExecSync).not.toHaveBeenCalledWith(expect.stringContaining('new-window'));
    });

    it('should handle tmux command failures', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('tmux command failed');
      });

      const branches = ['main', 'feature'];
      TmuxEnhancer.createComparisonLayout('cgwt-test-supervisor', branches, 'test');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create comparison layout',
        expect.any(Error),
      );
    });
  });

  describe('toggleSynchronizedPanes', () => {
    it('should turn on synchronized panes when currently off', () => {
      mockExecSync
        .mockReturnValueOnce('off') // show-window-options call
        .mockReturnValueOnce(''); // setw call

      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test-feature');

      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux show-window-options -t cgwt-test-feature -v synchronize-panes 2>/dev/null || echo off',
        { encoding: 'utf-8' },
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux setw -t cgwt-test-feature synchronize-panes on',
        undefined,
      );
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Toggled synchronized panes', {
        sessionName: 'cgwt-test-feature',
        newState: 'on',
      });
    });

    it('should turn off synchronized panes when currently on', () => {
      mockExecSync
        .mockReturnValueOnce('on') // show-window-options call
        .mockReturnValueOnce(''); // setw call

      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test-feature');

      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux setw -t cgwt-test-feature synchronize-panes off',
        undefined,
      );
      expect(result).toBe(false);
    });

    it('should handle tmux command failures', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('tmux command failed');
      });

      const result = TmuxEnhancer.toggleSynchronizedPanes('cgwt-test-feature');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to toggle synchronized panes',
        expect.any(Error),
      );
      expect(result).toBe(false);
    });
  });

  describe('createDashboardWindow', () => {
    it('should create dashboard with multiple branches', () => {
      const branches = ['main', 'feature', 'develop'];
      const worktreeBase = '/test/project';

      TmuxEnhancer.createDashboardWindow('cgwt-test-supervisor', branches, worktreeBase);

      expect(mockLogger.info).toHaveBeenCalledWith('Creating dashboard window', {
        sessionName: 'cgwt-test-supervisor',
        branches,
      });

      // Should create new window
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux new-window -t cgwt-test-supervisor -n dashboard',
        undefined,
      );

      // Should split window for additional branches
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux split-window -t cgwt-test-supervisor:dashboard',
        undefined,
      );

      // Should use tiled layout
      expect(mockExecSync).toHaveBeenCalledWith(
        'tmux select-layout -t cgwt-test-supervisor:dashboard tiled',
        undefined,
      );

      // Should send status commands to each pane
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringMatching(/tmux send-keys -t cgwt-test-supervisor:dashboard\.1/),
        undefined,
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Dashboard window created successfully');
    });

    it('should limit branches to 6 for readability', () => {
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

      TmuxEnhancer.createDashboardWindow('cgwt-test-supervisor', branches, '/test');

      // Should only create 5 additional panes (6 total branches - 1 for first pane)
      const splitCalls = mockExecSync.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).includes('split-window -t cgwt-test-supervisor:dashboard'),
      );
      expect(splitCalls).toHaveLength(5);
    });

    it('should handle single branch correctly', () => {
      const branches = ['main'];

      TmuxEnhancer.createDashboardWindow('cgwt-test-supervisor', branches, '/test');

      // Should not split window for single branch
      const splitCalls = mockExecSync.mock.calls.filter((call: unknown[]) =>
        (call[0] as string).includes('split-window -t cgwt-test-supervisor:dashboard'),
      );
      expect(splitCalls).toHaveLength(0);
    });

    it('should handle tmux command failures', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('tmux command failed');
      });

      TmuxEnhancer.createDashboardWindow('cgwt-test-supervisor', ['main'], '/test');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create dashboard window',
        expect.any(Error),
      );
    });
  });

  describe('getPredefinedLayouts', () => {
    it('should return array of predefined layouts', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();

      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);

      // Check structure of first layout
      const firstLayout = layouts[0] as PaneLayout;
      expect(firstLayout).toHaveProperty('name');
      expect(firstLayout).toHaveProperty('description');
      expect(firstLayout).toHaveProperty('branches');
      expect(firstLayout).toHaveProperty('layout');
      expect(Array.isArray(firstLayout.branches)).toBe(true);
    });

    it('should include expected layout types', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();
      const layoutNames = layouts.map((l) => l.name);

      expect(layoutNames).toContain('main-feature');
      expect(layoutNames).toContain('triple-review');
      expect(layoutNames).toContain('quad-split');
      expect(layoutNames).toContain('main-develop');
    });

    it('should have valid layout configurations', () => {
      const layouts = TmuxEnhancer.getPredefinedLayouts();

      layouts.forEach((layout) => {
        expect(typeof layout.name).toBe('string');
        expect(typeof layout.description).toBe('string');
        expect(Array.isArray(layout.branches)).toBe(true);
        expect([
          'even-horizontal',
          'even-vertical',
          'main-horizontal',
          'main-vertical',
          'tiled',
        ]).toContain(layout.layout);
      });
    });
  });

  describe('internal method behaviors via configureSession', () => {
    const mockConfig: StatusBarConfig = {
      sessionName: 'cgwt-test-feature',
      branchName: 'feature',
      role: 'child',
    };

    it('should apply copy mode settings', () => {
      TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      // Should set vi mode and mouse settings
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('set -g mode-keys vi'),
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('set -g mouse on'),
        undefined,
      );
    });

    it('should apply key bindings', () => {
      TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      // Should include pane navigation bindings
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('bind-key h select-pane -L'),
        undefined,
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('bind-key j select-pane -D'),
        undefined,
      );
    });

    it('should configure status bar for child sessions', () => {
      TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);

      // Should set status bar with child role colors
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('colour25'), undefined); // Child color
    });

    it('should configure status bar for supervisor sessions', () => {
      const supervisorConfig = { ...mockConfig, role: 'supervisor' as const };
      TmuxEnhancer.configureSession('cgwt-test-supervisor', supervisorConfig);

      // Should set status bar with supervisor role colors
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('colour32'), undefined); // Supervisor color
    });

    it('should handle execSync failures in individual settings', () => {
      // Mock some calls to succeed, some to fail
      let callCount = 0;
      mockExecSync.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('command failed');
        }
        return '';
      });

      // Should not throw, should continue with other settings
      expect(() => {
        TmuxEnhancer.configureSession('cgwt-test-feature', mockConfig);
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to apply|Failed to apply key binding/),
        expect.any(Object),
      );
    });
  });

  describe('status bar project name extraction', () => {
    it('should extract project name from session name', () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-my-project-feature',
        branchName: 'feature',
        role: 'child',
      };

      TmuxEnhancer.configureSession('cgwt-my-project-feature', config);

      // Should extract 'my-project' as project name
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('my-project'), undefined);
    });

    it('should handle simple session names', () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-proj-main',
        branchName: 'main',
        role: 'child',
      };

      TmuxEnhancer.configureSession('cgwt-proj-main', config);

      // Should extract 'proj' as project name
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('proj'), undefined);
    });

    it('should fall back to "project" for malformed session names', () => {
      const config: StatusBarConfig = {
        sessionName: 'invalid-name',
        branchName: 'main',
        role: 'child',
      };

      TmuxEnhancer.configureSession('invalid-name', config);

      // Should fall back to 'project'
      expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('project'), undefined);
    });
  });

  describe('session group configuration', () => {
    it('should set session groups for valid session names', () => {
      const config: StatusBarConfig = {
        sessionName: 'cgwt-my-project-feature',
        branchName: 'feature',
        role: 'child',
      };

      TmuxEnhancer.configureSession('cgwt-my-project-feature', config);

      // Should set session group
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('set -t cgwt-my-project-feature @session-group "cgwt-my-project"'),
        undefined,
      );
    });

    it('should handle session group failures gracefully', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('@session-group')) {
          throw new Error('session group not supported');
        }
        return '';
      });

      const config: StatusBarConfig = {
        sessionName: 'cgwt-project-main',
        branchName: 'main',
        role: 'child',
      };

      // Should not throw
      expect(() => {
        TmuxEnhancer.configureSession('cgwt-project-main', config);
      }).not.toThrow();
    });
  });
});
