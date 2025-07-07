import * as path from 'path';
import { Logger } from '../core/utils/logger.js';
import type { GitRepository } from '../core/git/GitRepository.js';
import {
  TmuxDriver,
  TmuxLayout,
  TmuxColor,
  TmuxStatusPosition,
  TmuxStatusJustify,
  TmuxPaneBorderStatus,
} from './TmuxDriver.js';
import type { TmuxKeyBindingConfig, TmuxStatusBarConfig } from './TmuxDriver.js';

export interface StatusBarConfig {
  sessionName: string;
  branchName: string;
  role: 'supervisor' | 'child';
  gitRepo?: GitRepository;
}

export interface PaneLayout {
  name: string;
  description: string;
  branches: string[];
  layout: TmuxLayout;
}

export class TmuxEnhancer {
  /**
   * Configure enhanced tmux settings for a session
   */
  static async configureSession(sessionName: string, config: StatusBarConfig): Promise<void> {
    Logger.info('Configuring enhanced tmux session', {
      sessionName,
      branchName: config.branchName,
      role: config.role,
    });

    try {
      // Configure copy mode with vi bindings
      await TmuxDriver.enableViCopyMode(sessionName);

      // Configure status bar using structured configuration
      await this.configureStatusBarStructured(sessionName, config);

      // Configure key bindings using structured configuration
      await this.configureKeyBindingsStructured(sessionName);

      // Set up session grouping (keeping original implementation for now)
      this.configureSessionGroups(sessionName, config);

      Logger.info('Tmux session enhanced successfully', { sessionName });
    } catch (error) {
      Logger.error('Failed to enhance tmux session', error);
      // Don't throw - we want the session to work even if enhancements fail
    }
  }

  /**
   * Configure status bar using the new structured TmuxDriver API
   */
  private static async configureStatusBarStructured(
    sessionName: string,
    config: StatusBarConfig,
  ): Promise<void> {
    const { branchName, role } = config;

    // Color scheme based on role
    const bgColor = role === 'supervisor' ? TmuxColor.Colour32 : TmuxColor.Colour25;
    const fgColor = TmuxColor.Colour255;

    // Extract project name
    const sessionParts = sessionName.split('-');
    const projectName = sessionParts.length >= 3 ? sessionParts.slice(1, -1).join('-') : 'project';

    const statusBarConfig: TmuxStatusBarConfig = {
      enabled: true,
      position: TmuxStatusPosition.Bottom,
      interval: 5,
      justify: TmuxStatusJustify.Centre,
      style: {
        background: bgColor,
        foreground: fgColor,
      },
      left: {
        content: `#[bg=${role === 'supervisor' ? TmuxColor.Colour196 : TmuxColor.Colour28},fg=${TmuxColor.Colour255},bold] ${role === 'supervisor' ? 'SUP' : 'WRK'} #[bg=${TmuxColor.Colour236},fg=${TmuxColor.Colour255}] ${projectName}${role !== 'supervisor' ? ':' + branchName : ''} #[bg=${bgColor},fg=${fgColor}] `,
        length: 60,
      },
      right: {
        content: `#[bg=${TmuxColor.Colour28},fg=${TmuxColor.Colour255}] #{b:pane_current_path} #[bg=${TmuxColor.Colour236},fg=${TmuxColor.Colour255}] #(cd #{pane_current_path} && git status -s 2>/dev/null | wc -l | sed 's/^0$/✓/' | sed 's/^[1-9].*$/±&/') #[bg=${TmuxColor.Colour237},fg=${TmuxColor.Colour255}] 📊 #(tmux ls 2>/dev/null | grep -c cgwt-${projectName}) #[bg=${TmuxColor.Colour238},fg=${TmuxColor.Colour255}] %H:%M:%S `,
        length: 150,
      },
      windowStatus: {
        currentFormat: ` #I:#W#{?window_zoomed_flag,🔍,} `,
        format: ` #I:#W#{?window_activity_flag,*,} `,
        currentStyle: `bg=${TmuxColor.Colour236},fg=${fgColor},bold`,
        activityStyle: `bg=${TmuxColor.Colour88},fg=${TmuxColor.Colour255}`,
      },
    };

    await TmuxDriver.configureStatusBar(sessionName, statusBarConfig);
  }

  /**
   * Configure key bindings using the new structured TmuxDriver API
   */
  private static async configureKeyBindingsStructured(_sessionName: string): Promise<void> {
    const keyBindings: TmuxKeyBindingConfig[] = [
      // Session navigation
      {
        key: 'S',
        command: 'choose-tree -s',
        note: 'Show session tree',
      },

      // Pane navigation (vim-style)
      {
        key: 'h',
        command: 'select-pane -L',
        note: 'Select left pane',
      },
      {
        key: 'j',
        command: 'select-pane -D',
        note: 'Select pane below',
      },
      {
        key: 'k',
        command: 'select-pane -U',
        note: 'Select pane above',
      },
      {
        key: 'l',
        command: 'select-pane -R',
        note: 'Select right pane',
      },

      // Pane resizing (repeatable)
      {
        key: 'H',
        command: 'resize-pane -L 5',
        repeat: true,
        note: 'Resize pane left',
      },
      {
        key: 'J',
        command: 'resize-pane -D 5',
        repeat: true,
        note: 'Resize pane down',
      },
      {
        key: 'K',
        command: 'resize-pane -U 5',
        repeat: true,
        note: 'Resize pane up',
      },
      {
        key: 'L',
        command: 'resize-pane -R 5',
        repeat: true,
        note: 'Resize pane right',
      },

      // Quick layouts
      {
        key: '=',
        command: 'select-layout even-horizontal',
        note: 'Even horizontal layout',
      },
      {
        key: '|',
        command: 'select-layout even-vertical',
        note: 'Even vertical layout',
      },
      {
        key: '+',
        command: 'select-layout main-horizontal',
        note: 'Main horizontal layout',
      },
      {
        key: '_',
        command: 'select-layout main-vertical',
        note: 'Main vertical layout',
      },

      // Pane synchronization
      {
        key: 'y',
        command: 'setw synchronize-panes',
        note: 'Toggle pane synchronization',
      },

      // Quick pane creation
      {
        key: 'b',
        command: 'split-window -h -c "#{pane_current_path}"',
        note: 'Split horizontally',
      },
      {
        key: 'B',
        command: 'split-window -v -c "#{pane_current_path}"',
        note: 'Split vertically',
      },
    ];

    await TmuxDriver.configureKeyBindings(keyBindings);
  }

  /**
   * Configure session groups for related branches
   */
  private static configureSessionGroups(sessionName: string, _config: StatusBarConfig): void {
    // Extract project name from session name
    const parts = sessionName.split('-');
    if (parts.length >= 3) {
      const projectGroup = parts.slice(0, -1).join('-'); // Everything except the branch name

      try {
        // Set session group (tmux 3.2+)
        void TmuxDriver.setOption(sessionName, '@session-group', projectGroup);

        // Session grouping handled - status-left is already configured
      } catch {
        // Session grouping might not be supported
      }
    }
  }

  /**
   * Create a multi-pane layout showing multiple Claude sessions
   */
  static createComparisonLayout(
    sessionName: string,
    branches: string[],
    projectName: string,
  ): void {
    Logger.info('Creating comparison layout', { sessionName, branches, projectName });

    if (branches.length < 2) {
      Logger.warn('Need at least 2 branches for comparison');
      return;
    }

    try {
      // Create a new window for comparison
      void TmuxDriver.createWindow({ sessionName, windowName: 'compare' });

      // Kill any existing panes in the new window
      void TmuxDriver.killPane(`${sessionName}:compare`, true);

      // Create the layout first based on number of branches
      if (branches.length === 2) {
        // Side by side
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare`,
          horizontal: true,
          percentage: 50,
        });
      } else if (branches.length === 3) {
        // One on top, two on bottom
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare`,
          horizontal: false,
          percentage: 50,
        });
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare.2`,
          horizontal: true,
          percentage: 50,
        });
      } else if (branches.length === 4) {
        // 2x2 grid
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare`,
          horizontal: true,
          percentage: 50,
        });
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare.1`,
          horizontal: false,
          percentage: 50,
        });
        void TmuxDriver.splitPane({
          target: `${sessionName}:compare.2`,
          horizontal: false,
          percentage: 50,
        });
      }

      // Now pipe each Claude session to its pane
      branches.forEach((branch, index) => {
        const targetSession = `cgwt-${projectName}-${branch}`;
        const paneIndex = index + 1;

        // First set the pane title
        void TmuxDriver.setPaneTitle(`${sessionName}:compare.${paneIndex}`, ` ${branch} `);

        // Connect the pane to show the Claude session
        const command = `clear && echo 'Connecting to ${branch} Claude session...' && sleep 1 && tmux attach-session -t ${targetSession}`;
        void TmuxDriver.sendKeys(`${sessionName}:compare.${paneIndex}`, [command]);
      });

      // Configure pane borders and styling
      void TmuxDriver.setOption(`${sessionName}:compare`, 'pane-border-status', 'top');
      void TmuxDriver.setOption(`${sessionName}:compare`, 'pane-border-style', 'fg=colour240');
      void TmuxDriver.setOption(
        `${sessionName}:compare`,
        'pane-active-border-style',
        'fg=colour32,bold',
      );
      void TmuxDriver.setOption(
        `${sessionName}:compare`,
        'pane-border-format',
        '#[fg=colour255,bg=colour32] #{pane_title} #[fg=colour240,bg=default]',
      );

      // Set window options for better display
      void TmuxDriver.setWindowOption(`${sessionName}:compare`, 'remain-on-exit', 'off');
      void TmuxDriver.setWindowOption(`${sessionName}:compare`, 'aggressive-resize', 'on');

      Logger.info('Comparison layout created successfully');

      // Switch to the comparison window
      void TmuxDriver.sendKeys(sessionName, ['select-window -t :compare'], false);
    } catch (error) {
      Logger.error('Failed to create comparison layout', error);
    }
  }

  /**
   * Enable synchronized input across panes
   */
  static toggleSynchronizedPanes(sessionName: string): boolean {
    try {
      // For now, just toggle without checking current state
      const newState = 'on';
      void TmuxDriver.setWindowOption(sessionName, 'synchronize-panes', newState);

      Logger.info('Toggled synchronized panes', { sessionName, newState });
      return newState === 'on';
    } catch (error) {
      Logger.error('Failed to toggle synchronized panes', error);
      return false;
    }
  }

  /**
   * Create a dashboard window showing all branches
   */
  static createDashboardWindow(
    sessionName: string,
    branches: string[],
    worktreeBase: string,
  ): void {
    Logger.info('Creating dashboard window', { sessionName, branches });

    try {
      // Create new window for dashboard
      void TmuxDriver.createWindow({ sessionName, windowName: 'dashboard' });

      // Create a pane for each branch (up to 6 for readability)
      const branchesToShow = branches.slice(0, 6);

      branchesToShow.slice(1).forEach(() => {
        void TmuxDriver.splitPane({ target: `${sessionName}:dashboard` });
      });

      // Use tiled layout for dashboard
      void TmuxDriver.sendKeys(`${sessionName}:dashboard`, ['select-layout tiled'], false);

      // Show git status in each pane
      branchesToShow.forEach((branch, index) => {
        const worktreePath = path.join(worktreeBase, branch);
        const paneIndex = index + 1;

        const statusCmd = `
          cd ${worktreePath} && 
          echo "🌿 ${branch}" && 
          echo "─────────────────" && 
          git log --oneline -5 && 
          echo "" && 
          git status -sb
        `;

        void TmuxDriver.sendKeys(`${sessionName}:dashboard.${paneIndex}`, [statusCmd]);
      });

      Logger.info('Dashboard window created successfully');
    } catch (error) {
      Logger.error('Failed to create dashboard window', error);
    }
  }

  /**
   * Get predefined layouts for common workflows
   */
  static getPredefinedLayouts(): PaneLayout[] {
    return [
      {
        name: 'main-feature',
        description: 'Main branch and feature branch side by side',
        branches: ['main', 'feature/*'],
        layout: TmuxLayout.EvenHorizontal,
      },
      {
        name: 'triple-review',
        description: 'Three branches for code review',
        branches: ['main', 'develop', 'feature/*'],
        layout: TmuxLayout.EvenHorizontal,
      },
      {
        name: 'quad-split',
        description: 'Four branches in grid layout',
        branches: ['*', '*', '*', '*'],
        layout: TmuxLayout.Tiled,
      },
      {
        name: 'main-develop',
        description: 'Main branch with develop branch below',
        branches: ['main', 'develop'],
        layout: TmuxLayout.MainHorizontal,
      },
    ];
  }

  /**
   * Configure a session with a predefined layout using the builder pattern
   */
  static async configureSessionWithLayout(sessionName: string, layoutName: string): Promise<void> {
    const layouts = this.getPredefinedLayouts();
    const layout = layouts.find((l) => l.name === layoutName);

    if (!layout) {
      throw new Error(`Layout '${layoutName}' not found`);
    }

    // Use the builder pattern for cleaner configuration
    await TmuxDriver.createLayoutBuilder(sessionName)
      .withLayout(layout.layout)
      .withBorderStatus(TmuxPaneBorderStatus.Top)
      .withBorderStyle(`fg=${TmuxColor.Colour240}`)
      .withActiveBorderStyle(`fg=${TmuxColor.Colour32},bold`)
      .apply();

    Logger.info('Session configured with predefined layout', {
      sessionName,
      layoutName,
      layout: layout.layout,
    });
  }
}
