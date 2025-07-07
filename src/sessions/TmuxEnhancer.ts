import * as path from 'path';
import { Logger } from '../core/utils/logger.js';
import { execCommandSafe } from '../core/utils/async.js';
import type { GitRepository } from '../core/git/GitRepository.js';
import {
  TmuxDriver,
  TmuxColor,
  TmuxStatusPosition,
  TmuxStatusJustify,
  TmuxOption,
  TmuxHook,
  TmuxLayout,
  TmuxPaneBorderStatus,
  type TmuxStatusBarConfig,
  type TmuxKeyBindingConfig,
  type TmuxPaneBorderConfig,
} from './TmuxDriver.js';
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
    const errors: Error[] = [];
    let successCount = 0;

    try {
      // Use the new SDK method
      await TmuxDriver.enableViCopyMode(sessionName);
      successCount++;

      // Set additional option
      await TmuxDriver.setOption(sessionName, TmuxOption.YankAction, 'copy-pipe', true);
      successCount++;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      Logger.debug('Failed to configure copy mode', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: errors.length === 0,
      operation: 'configureCopyMode',
      details: {
        successCount,
        totalSettings: 2,
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
    const errors: Error[] = [];
    let successCount = 0;

    try {
      // Color scheme based on role
      const bgColor = role === 'supervisor' ? TmuxColor.from(32) : TmuxColor.from(25);
      const fgColor = TmuxColor.from(255);

      // Extract project name
      const sessionParts = sessionName.split('-');
      const projectName =
        sessionParts.length >= 3 ? sessionParts.slice(1, -1).join('-') : 'project';

      // Build status bar configuration
      const statusBarConfig: TmuxStatusBarConfig = {
        enabled: true,
        position: TmuxStatusPosition.Bottom,
        interval: 5,
        justify: TmuxStatusJustify.Centre,
        style: {
          background: bgColor,
          foreground: fgColor,
        },
        left: `#[bg=${role === 'supervisor' ? TmuxColor.from(196).toString() : TmuxColor.from(28).toString()},fg=${TmuxColor.from(255).toString()},bold] ${role === 'supervisor' ? 'SUP' : 'WRK'} #[bg=${TmuxColor.from(236).toString()},fg=${TmuxColor.from(255).toString()}] ${projectName}${role !== 'supervisor' ? ':' + branchName : ''} #[bg=${bgColor.toString()},fg=${fgColor.toString()}] `,
      };

      // Apply configuration using SDK method
      await TmuxDriver.configureStatusBar(sessionName, statusBarConfig);
      successCount++;

      // Set window option for activity monitoring
      await TmuxDriver.setWindowOption(sessionName, TmuxOption.MonitorActivity, 'on');
      successCount++;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      Logger.debug('Failed to configure status bar', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Set up advanced monitoring
    const monitoringResult = await this.setupAdvancedStatusMonitoring(sessionName, config);

    return {
      success: errors.length === 0 && monitoringResult.success,
      operation: 'configureStatusBar',
      details: {
        successCount,
        totalSettings: 2,
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
    const errors: Error[] = [];
    let successCount = 0;

    try {
      // Build hooks configuration
      const hooks: { [key in TmuxHook]?: string } = {
        [TmuxHook.AlertActivity]: 'display-message "Activity in #S"',
      };

      if (role === 'supervisor') {
        hooks[TmuxHook.SessionCreated] = 'display-message "Session #S created"';
        hooks[TmuxHook.WindowLinked] = 'display-message "Window linked"';
      }

      // Apply hooks using SDK method
      await TmuxDriver.configureMonitoring(sessionName, hooks);
      successCount = Object.keys(hooks).length;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      Logger.debug('Failed to set up monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: errors.length === 0,
      operation: 'setupAdvancedStatusMonitoring',
      details: {
        successCount,
        totalHooks: role === 'supervisor' ? 3 : 1,
        errorCount: errors.length,
      },
      error: errors.length > 0 ? errors[0] : undefined,
    };
  }

  /**
   * Configure key bindings - now returns results
   */
  static async configureKeyBindings(_sessionName: string): Promise<TmuxOperationResult> {
    const errors: Error[] = [];
    let successCount = 0;

    try {
      // Build key bindings configuration
      const keyBindings: TmuxKeyBindingConfig[] = [
        { key: 'S', command: 'choose-tree -s' },
        { key: 'h', command: 'select-pane -L' },
        { key: 'j', command: 'select-pane -D' },
        { key: 'k', command: 'select-pane -U' },
        { key: 'l', command: 'select-pane -R' },
        { key: 'H', command: 'resize-pane -L 5', repeat: true },
        { key: 'J', command: 'resize-pane -D 5', repeat: true },
        { key: 'K', command: 'resize-pane -U 5', repeat: true },
        { key: 'L', command: 'resize-pane -R 5', repeat: true },
        // Quick pane splitting
        { key: '|', command: 'split-window -h -c "#{pane_current_path}" bash' },
        { key: '-', command: 'split-window -v -c "#{pane_current_path}" bash' },
      ];

      // Apply regular bindings using SDK method
      await TmuxDriver.configureKeyBindings(keyBindings);
      successCount = keyBindings.length;

      // Also add no-prefix bindings for quick access (Alt+key)
      // These need to be applied manually with -n flag
      const noPrefixBindings = [
        { key: 'M-\\', command: 'split-window -h -c "#{pane_current_path}" bash' },
        { key: 'M--', command: 'split-window -v -c "#{pane_current_path}" bash' },
      ];

      // Apply no-prefix bindings manually
      for (const binding of noPrefixBindings) {
        await execCommandSafe('tmux', ['bind-key', '-n', binding.key, binding.command]);
        successCount++;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      Logger.debug('Failed to configure key bindings', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: errors.length === 0,
      operation: 'configureKeyBindings',
      details: {
        successCount,
        totalBindings: 13, // 11 regular + 2 no-prefix bindings
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
      await TmuxDriver.setOption(sessionName, TmuxOption.SessionGroup, projectGroup);

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
  static async createComparisonLayout(
    sessionName: string,
    branches: string[],
    projectName: string,
  ): Promise<void> {
    Logger.info('Creating comparison layout', { sessionName, branches, projectName });

    if (branches.length < 2) {
      Logger.warn('Need at least 2 branches for comparison');
      return;
    }

    try {
      // Determine layout based on number of branches
      const layout = branches.length <= 2 ? TmuxLayout.EvenHorizontal : TmuxLayout.Tiled;

      // Use SDK method to create multi-pane window
      await TmuxDriver.createMultiPaneWindow(sessionName, 'compare', branches.length, layout);

      // Configure pane borders using SDK
      const borderConfig: TmuxPaneBorderConfig = {
        status: TmuxPaneBorderStatus.Top,
        style: {
          inactive: `fg=${TmuxColor.from(240).toString()}`,
          active: `fg=${TmuxColor.from(32).toString()},bold`,
        },
        format: `#[fg=${TmuxColor.from(255).toString()},bg=${TmuxColor.from(32).toString()}] #{pane_title} #[fg=${TmuxColor.from(240).toString()},bg=default]`,
      };
      await TmuxDriver.configurePaneBorders(`${sessionName}:compare`, borderConfig);

      // Set titles and connect to Claude sessions
      for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        const paneIndex = i + 1;
        const targetSession = `cgwt-${projectName}-${branch}`;

        await TmuxDriver.setPaneTitle(`${sessionName}:compare.${paneIndex}`, ` ${branch} `);

        const command = `clear && echo 'Connecting to ${branch} Claude session...' && sleep 1 && tmux attach-session -t ${targetSession}`;
        await TmuxDriver.sendKeys(`${sessionName}:compare.${paneIndex}`, [command]);
      }

      // Set window options
      await TmuxDriver.setWindowOption(`${sessionName}:compare`, TmuxOption.RemainOnExit, 'off');
      await TmuxDriver.setWindowOption(`${sessionName}:compare`, TmuxOption.AggressiveResize, 'on');

      Logger.info('Comparison layout created successfully');

      // Switch to the comparison window
      await TmuxDriver.sendKeys(sessionName, ['select-window -t :compare'], false);
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
  static async createDashboardWindow(
    sessionName: string,
    branches: string[],
    worktreeBase: string,
  ): Promise<void> {
    Logger.info('Creating dashboard window', { sessionName, branches });

    try {
      // Create a pane for each branch (up to 6 for readability)
      const branchesToShow = branches.slice(0, 6);

      // Use layout builder for cleaner API
      const builder = TmuxDriver.createLayoutBuilder(sessionName);

      // Add panes for each branch
      branchesToShow.forEach((branch) => {
        const worktreePath = path.join(worktreeBase, branch);
        const statusCmd = `
          cd ${worktreePath} && 
          echo "🌿 ${branch}" && 
          echo "─────────────────" && 
          git log --oneline -5 && 
          echo "" && 
          git status -sb
        `;

        builder.addPane({
          command: statusCmd,
          workingDirectory: worktreePath,
          title: branch,
        });
      });

      // Build the dashboard with tiled layout
      await builder.build('dashboard', TmuxLayout.Tiled);

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
