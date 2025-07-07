import * as path from 'path';
import { Logger } from '../core/utils/logger.js';
import type { GitRepository } from '../core/git/GitRepository.js';
import { TmuxDriver } from './TmuxDriver.js';
import { TmuxCommandParser } from './TmuxCommandParser.js';
import { TmuxHookParser } from './TmuxHookParser.js';
import type { TmuxOperationResult, TmuxEnhancerResult } from './TmuxOperationResult.js';

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
  layout: 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical' | 'tiled';
}

/**
 * Enhanced Tmux session manager with full testability
 */
export class TmuxEnhancer {
  /**
   * Configure enhanced tmux settings for a session - now returns results
   */
  static async configureSession(
    sessionName: string,
    config: StatusBarConfig,
  ): Promise<TmuxEnhancerResult> {
    Logger.info('Configuring enhanced tmux session', {
      sessionName,
      branchName: config.branchName,
      role: config.role,
    });

    const results: TmuxEnhancerResult = {
      copyModeResult: { success: false, operation: 'configureCopyMode' },
      statusBarResult: { success: false, operation: 'configureStatusBar' },
      keyBindingsResult: { success: false, operation: 'configureKeyBindings' },
      sessionGroupsResult: { success: false, operation: 'configureSessionGroups' },
      overallSuccess: false,
    };

    try {
      // Configure copy mode and mouse settings
      results.copyModeResult = await this.configureCopyMode(sessionName);

      // Configure status bar
      results.statusBarResult = await this.configureStatusBar(sessionName, config);

      // Configure key bindings
      results.keyBindingsResult = await this.configureKeyBindings(sessionName);

      // Set up session grouping
      results.sessionGroupsResult = await this.configureSessionGroups(sessionName, config);

      results.overallSuccess =
        results.copyModeResult.success &&
        results.statusBarResult.success &&
        results.keyBindingsResult.success &&
        results.sessionGroupsResult.success;

      if (results.overallSuccess) {
        Logger.info('Tmux session enhanced successfully', { sessionName });
      } else {
        Logger.warn('Tmux session partially enhanced', { sessionName, results });
      }
    } catch (error) {
      Logger.error('Failed to enhance tmux session', error);
      // Don't throw - we want the session to work even if enhancements fail
    }

    return results;
  }

  /**
   * Configure copy mode - now returns results
   */
  static async configureCopyMode(sessionName: string): Promise<TmuxOperationResult> {
    const copyModeSettings = [
      'set -g mode-keys vi',
      'set -g mouse on',
      'set -g @yank_action "copy-pipe"',
      'bind-key -T copy-mode-vi v send-keys -X begin-selection',
      'bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel',
      'unbind-key -n MouseDrag1Pane',
    ];

    let successCount = 0;
    const errors: Error[] = [];

    for (const setting of copyModeSettings) {
      try {
        const parsed = TmuxCommandParser.parse(setting);

        switch (parsed.type) {
          case 'set':
            if (parsed.option && parsed.value) {
              await TmuxDriver.setOption(sessionName, parsed.option, parsed.value, parsed.isGlobal);
              successCount++;
            }
            break;

          case 'bind-key':
            if (parsed.key && parsed.command) {
              await TmuxDriver.bindKey(parsed.key, parsed.command, parsed.table, parsed.repeat);
              successCount++;
            }
            break;

          case 'unbind-key':
            if (parsed.key) {
              await TmuxDriver.unbindKey(parsed.key, parsed.table);
              successCount++;
            }
            break;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        Logger.debug('Failed to apply copy mode setting', {
          setting,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: successCount > 0 && errors.length === 0,
      operation: 'configureCopyMode',
      details: {
        successCount,
        totalSettings: copyModeSettings.length,
        errorCount: errors.length,
      },
      error: errors.length > 0 ? errors[0] : undefined,
    };
  }

  /**
   * Configure status bar - now returns results
   */
  static async configureStatusBar(
    sessionName: string,
    config: StatusBarConfig,
  ): Promise<TmuxOperationResult> {
    const { branchName, role } = config;

    // Color scheme based on role
    const bgColor = role === 'supervisor' ? 'colour32' : 'colour25';
    const fgColor = 'colour255';

    // Extract project name
    const sessionParts = sessionName.split('-');
    const projectName = sessionParts.length >= 3 ? sessionParts.slice(1, -1).join('-') : 'project';

    const statusBarSettings = [
      'set status on',
      'set status-interval 5',
      'set status-position bottom',
      `set status-style bg=${bgColor},fg=${fgColor}`,
      `set status-left '#[bg=colour${role === 'supervisor' ? '196' : '28'},fg=colour255,bold] ${role === 'supervisor' ? 'SUP' : 'WRK'} #[bg=colour236,fg=colour255] ${projectName}${role !== 'supervisor' ? ':' + branchName : ''} #[bg=${bgColor},fg=${fgColor}] '`,
      'setw monitor-activity on',
    ];

    let successCount = 0;
    const errors: Error[] = [];

    for (const setting of statusBarSettings) {
      try {
        const parsed = TmuxCommandParser.parse(setting);

        switch (parsed.type) {
          case 'set':
            if (parsed.option && parsed.value) {
              await TmuxDriver.setOption(sessionName, parsed.option, parsed.value);
              successCount++;
            }
            break;

          case 'setw':
            if (parsed.option && parsed.value) {
              await TmuxDriver.setWindowOption(sessionName, parsed.option, parsed.value);
              successCount++;
            }
            break;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        Logger.debug('Failed to apply tmux setting', {
          setting,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Set up advanced monitoring
    const monitoringResult = await this.setupAdvancedStatusMonitoring(sessionName, config);

    return {
      success: successCount > 0 && errors.length === 0 && monitoringResult.success,
      operation: 'configureStatusBar',
      details: {
        successCount,
        totalSettings: statusBarSettings.length,
        errorCount: errors.length,
        monitoringResult,
      },
      error: errors.length > 0 ? errors[0] : monitoringResult.error,
    };
  }

  /**
   * Set up hooks - now returns results
   */
  static async setupAdvancedStatusMonitoring(
    sessionName: string,
    config: StatusBarConfig,
  ): Promise<TmuxOperationResult> {
    const { role } = config;

    const hooks = [
      `set-hook -t ${sessionName} -g alert-activity 'display-message "Activity in #S"'`,
    ];

    if (role === 'supervisor') {
      hooks.push(
        `set-hook -t ${sessionName} -g session-created 'display-message "Session #S created"'`,
        `set-hook -t ${sessionName} -g window-linked 'display-message "Window linked"'`,
      );
    }

    let successCount = 0;
    const errors: Error[] = [];

    for (const hook of hooks) {
      const parsed = TmuxHookParser.parse(hook);

      if (parsed.isValid && parsed.hookName && parsed.command) {
        try {
          await TmuxDriver.setHook(parsed.hookName, parsed.command);
          successCount++;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return {
      success: errors.length === 0,
      operation: 'setupAdvancedStatusMonitoring',
      details: {
        successCount,
        totalHooks: hooks.length,
        errorCount: errors.length,
      },
      error: errors.length > 0 ? errors[0] : undefined,
    };
  }

  /**
   * Configure key bindings - now returns results
   */
  static async configureKeyBindings(_sessionName: string): Promise<TmuxOperationResult> {
    const keyBindings = [
      'bind-key S choose-tree -s',
      'bind-key h select-pane -L',
      'bind-key j select-pane -D',
      'bind-key k select-pane -U',
      'bind-key l select-pane -R',
      'bind-key -r H resize-pane -L 5',
      'bind-key -r J resize-pane -D 5',
      'bind-key -r K resize-pane -U 5',
      'bind-key -r L resize-pane -R 5',
    ];

    let successCount = 0;
    const errors: Error[] = [];

    for (const binding of keyBindings) {
      try {
        const parsed = TmuxCommandParser.parse(binding);

        if (parsed.type === 'bind-key' && parsed.key && parsed.command) {
          await TmuxDriver.bindKey(parsed.key, parsed.command, parsed.table, parsed.repeat);
          successCount++;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        Logger.debug('Failed to apply key binding', {
          binding,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: successCount > 0 && errors.length === 0,
      operation: 'configureKeyBindings',
      details: {
        successCount,
        totalBindings: keyBindings.length,
        errorCount: errors.length,
      },
      error: errors.length > 0 ? errors[0] : undefined,
    };
  }

  /**
   * Configure session groups - now returns results
   */
  static async configureSessionGroups(
    sessionName: string,
    _config: StatusBarConfig,
  ): Promise<TmuxOperationResult> {
    const parts = sessionName.split('-');

    if (parts.length < 3) {
      return {
        success: true, // Not an error, just no grouping needed
        operation: 'configureSessionGroups',
        details: { reason: 'Session name does not support grouping' },
      };
    }

    const projectGroup = parts.slice(0, -1).join('-');

    try {
      await TmuxDriver.setOption(sessionName, '@session-group', projectGroup);

      return {
        success: true,
        operation: 'configureSessionGroups',
        details: { projectGroup },
      };
    } catch (error) {
      // Session grouping might not be supported
      return {
        success: false,
        operation: 'configureSessionGroups',
        error: error instanceof Error ? error : new Error(String(error)),
        details: { projectGroup },
      };
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
        layout: 'even-horizontal',
      },
      {
        name: 'triple-review',
        description: 'Three branches for code review',
        branches: ['main', 'develop', 'feature/*'],
        layout: 'even-horizontal',
      },
      {
        name: 'quad-split',
        description: 'Four branches in grid layout',
        branches: ['*', '*', '*', '*'],
        layout: 'tiled',
      },
      {
        name: 'main-develop',
        description: 'Main branch with develop branch below',
        branches: ['main', 'develop'],
        layout: 'main-horizontal',
      },
    ];
  }
}
