import * as path from 'path';
import { Logger } from '../core/utils/logger';
import type { GitRepository } from '../core/git/GitRepository';
import { TmuxDriver } from '../core/drivers/TmuxDriver';

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
      // Configure copy mode and mouse settings
      await this.configureCopyMode(sessionName);

      // Configure status bar
      this.configureStatusBar(sessionName, config);

      // Configure key bindings
      this.configureKeyBindings(sessionName);

      // Set up session grouping
      this.configureSessionGroups(sessionName, config);

      Logger.info('Tmux session enhanced successfully', { sessionName });
    } catch (error) {
      Logger.error('Failed to enhance tmux session', error);
      // Don't throw - we want the session to work even if enhancements fail
    }
  }

  /**
   * Configure better copy/paste with vi-mode and clipboard integration
   */
  private static async configureCopyMode(sessionName: string): Promise<void> {
    const copyModeSettings = [
      // Enable vi mode for copy operations
      'set -g mode-keys vi',

      // Better mouse mode - allows scrolling and selection
      'set -g mouse on',

      // Don't exit copy mode when selecting with mouse
      'set -g @yank_action "copy-pipe"',

      // Vi-style copy bindings
      'bind-key -T copy-mode-vi v send-keys -X begin-selection',
      'bind-key -T copy-mode-vi C-v send-keys -X rectangle-toggle',
      'bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel',
      'bind-key -T copy-mode-vi Escape send-keys -X cancel',

      // Copy to system clipboard (works on Linux with xclip)
      'bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -in -selection clipboard"',

      // Simple mouse scrolling
      'bind-key -n WheelUpPane if-shell -F -t = "#{pane_in_mode}" "send-keys -M" "copy-mode -e"',
      'bind-key -n WheelDownPane send-keys -M',

      // Prevent mouse drag from getting stuck
      'unbind-key -n MouseDrag1Pane',
      'unbind-key -T copy-mode MouseDrag1Pane',
      'unbind-key -T copy-mode-vi MouseDrag1Pane',

      // Paste from clipboard
      'bind-key ] run "xclip -o -sel clipboard | tmux load-buffer - ; tmux paste-buffer"',
    ];

    for (const setting of copyModeSettings) {
      try {
        const trimmed = setting.trim();
        if (!trimmed) continue;

        // Parse the command into parts
        const parts = trimmed.split(/\s+/);
        const command = parts[0];

        if (command === 'set') {
          // set -g mode-keys vi
          const isGlobal = parts[1] === '-g';
          const option = isGlobal ? parts[2] : parts[1];
          const value = isGlobal ? parts.slice(3).join(' ') : parts.slice(2).join(' ');
          if (option && value) {
            await TmuxDriver.setOption(sessionName, option, value, isGlobal);
          }
        } else if (command === 'bind-key') {
          // bind-key [-T table] [-r] key command
          let argIndex = 1;
          let table: string | undefined;
          let repeat = false;

          while (argIndex < parts.length && parts[argIndex]?.startsWith('-')) {
            if (parts[argIndex] === '-T' && argIndex + 1 < parts.length) {
              table = parts[argIndex + 1];
              argIndex += 2;
            } else if (parts[argIndex] === '-r') {
              repeat = true;
              argIndex++;
            } else if (parts[argIndex] === '-n') {
              // Skip -n flag
              argIndex++;
            } else {
              argIndex++;
            }
          }

          if (argIndex < parts.length) {
            const key = parts[argIndex];
            const bindCommand = parts.slice(argIndex + 1).join(' ');
            if (key && bindCommand) {
              await TmuxDriver.bindKey(key, bindCommand, table, repeat);
            }
          }
        } else if (command === 'unbind-key') {
          // unbind-key [-T table] key
          let argIndex = 1;
          let table: string | undefined;

          if (parts[argIndex] === '-T' && argIndex + 1 < parts.length) {
            table = parts[argIndex + 1];
            argIndex += 2;
          } else if (parts[argIndex] === '-n') {
            // Skip -n flag
            argIndex++;
          }

          if (argIndex < parts.length) {
            const key = parts[argIndex];
            if (key) {
              await TmuxDriver.unbindKey(key, table);
            }
          }
        }
      } catch (error) {
        // Log failures for debugging
        Logger.debug('Failed to apply copy mode setting', {
          setting,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Configure enhanced status bar with git info
   */
  private static configureStatusBar(sessionName: string, config: StatusBarConfig): void {
    const { branchName, role } = config;

    // Color scheme based on role and state
    const bgColor = role === 'supervisor' ? 'colour32' : 'colour25'; // Blue for supervisor, darker blue for child
    const fgColor = 'colour255'; // White

    // Extract project name from session
    const sessionParts = sessionName.split('-');
    const projectName = sessionParts.length >= 3 ? sessionParts.slice(1, -1).join('-') : 'project';

    const statusBarSettings = [
      // Enable status bar
      'set status on',
      'set status-interval 5', // Update every 5 seconds for token info

      // Status bar position and style
      'set status-position bottom',
      `set status-style bg=${bgColor},fg=${fgColor}`,

      // Left side: SUP/WRK indicator and repo info
      `set status-left '#[bg=colour${role === 'supervisor' ? '196' : '28'},fg=colour255,bold] ${role === 'supervisor' ? 'SUP' : 'WRK'} #[bg=colour236,fg=colour255] ${projectName}${role !== 'supervisor' ? ':' + branchName : ''} #[bg=${bgColor},fg=${fgColor}] '`,
      'set status-left-length 60',

      // Center: Window list with activity monitoring
      'set status-justify centre',
      `set window-status-current-style bg=colour236,fg=${fgColor},bold`,
      'set window-status-current-format " #I:#W#{?window_zoomed_flag,🔍,} "',
      'set window-status-format " #I:#W#{?window_activity_flag,*,} "',
      'set window-status-activity-style bg=colour88,fg=colour255',
      'setw monitor-activity on',

      // Right side: Git info, session count, and time - using simpler syntax
      `set status-right '#[bg=colour28,fg=colour255] #{b:pane_current_path} #[bg=colour236,fg=colour255] #(cd #{pane_current_path} && git status -s 2>/dev/null | wc -l | sed 's/^0$/✓/' | sed 's/^[1-9].*$/±&/') #[bg=colour237,fg=colour255] 📊 #(tmux ls 2>/dev/null | grep -c cgwt-${projectName}) #[bg=colour238,fg=colour255] %H:%M:%S '`,
      'set status-right-length 150',
    ];

    // Process settings synchronously to avoid promise issues
    statusBarSettings.forEach((setting) => {
      try {
        // Handle different command types
        if (setting.startsWith('set ')) {
          const option = setting.substring(4);
          const parts = option.split(' ');
          if (parts.length >= 2 && parts[0]) {
            void TmuxDriver.setOption(sessionName, parts[0], parts.slice(1).join(' '));
          }
        } else if (setting.startsWith('setw ')) {
          const option = setting.substring(5);
          const parts = option.split(' ');
          if (parts.length >= 2 && parts[0]) {
            void TmuxDriver.setWindowOption(sessionName, parts[0], parts.slice(1).join(' '));
          }
        }
      } catch (error) {
        // Log the actual error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.debug('Failed to apply tmux setting', { setting, error: errorMessage });
      }
    });

    // Set up advanced status monitoring
    this.setupAdvancedStatusMonitoring(sessionName, config);
  }

  /**
   * Set up advanced status monitoring with hooks and alerts
   */
  private static setupAdvancedStatusMonitoring(sessionName: string, config: StatusBarConfig): void {
    const { role } = config;

    // Configure token status bar updates
    // TokenStatusBar.configureTmux(sessionName);

    // Start token status updates
    // TokenStatusBar.startUpdates(sessionName);

    // Note: Token status bar disabled as it overwrites custom status configuration

    // Simplified status update - let tmux handle the updates via status-interval

    // Set up hooks for various events
    const hooks = [
      // Alert on session events
      `set-hook -t ${sessionName} -g alert-activity 'display-message "Activity in #S"'`,
    ];

    // Add supervisor-specific hooks
    if (role === 'supervisor') {
      hooks.push(
        `set-hook -t ${sessionName} -g session-created 'display-message "New session created: #{hook_session}"'`,
      );
      hooks.push(
        `set-hook -t ${sessionName} -g session-closed 'display-message "Session closed: #{hook_session}"'`,
      );
    }

    // Process hooks synchronously to avoid promise issues
    hooks.forEach((hook) => {
      try {
        if (hook.trim()) {
          // Parse set-hook command: set-hook -t target -g hook-name 'command'
          const match = hook.match(/set-hook(?:\s+-t\s+(\S+))?\s+-g\s+(\S+)\s+'(.+)'/);
          if (match) {
            const [, , hookName, hookCommand] = match;
            if (hookName && hookCommand) {
              void TmuxDriver.setHook(hookName, hookCommand);
            }
          }
        }
      } catch {
        // Some hooks might not be supported
      }
    });

    // Token status bar updates are handled by TokenStatusBar.startUpdates
  }

  /**
   * Configure useful key bindings
   */
  private static configureKeyBindings(_sessionName: string): void {
    const keyBindings = [
      // Quick session switching
      'bind-key S choose-tree -s', // Show session tree

      // Better pane navigation
      'bind-key h select-pane -L',
      'bind-key j select-pane -D',
      'bind-key k select-pane -U',
      'bind-key l select-pane -R',

      // Pane resizing
      'bind-key -r H resize-pane -L 5',
      'bind-key -r J resize-pane -D 5',
      'bind-key -r K resize-pane -U 5',
      'bind-key -r L resize-pane -R 5',

      // Quick layouts
      'bind-key = select-layout even-horizontal',
      'bind-key \\| select-layout even-vertical',
      'bind-key + select-layout main-horizontal',
      'bind-key _ select-layout main-vertical',

      // Synchronize panes toggle
      'bind-key y setw synchronize-panes',

      // Quick pane creation for branch comparison
      'bind-key b split-window -h -c "#{pane_current_path}"',
      'bind-key B split-window -v -c "#{pane_current_path}"',
    ];

    // Process key bindings synchronously to avoid promise issues
    keyBindings.forEach((binding) => {
      try {
        // Key bindings should be global, not per-session
        if (binding.trim()) {
          const parts = binding.split(' ');
          if (parts[0] === 'bind-key') {
            // Parse bind-key command
            let argIndex = 1;
            let repeat = false;

            if (parts[argIndex] === '-r') {
              repeat = true;
              argIndex++;
            }

            const key = parts[argIndex];
            const command = parts.slice(argIndex + 1).join(' ');
            if (key && command) {
              Logger.debug('Executing key binding', { key, command });
              void TmuxDriver.bindKey(key, command, undefined, repeat);
            }
          }
        }
      } catch (error) {
        // Log failures for debugging
        Logger.debug('Failed to apply key binding', {
          binding,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
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
      // For window selection, we need to send the command as keys
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
      // This would need to be refactored to properly check state asynchronously
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
      // For layout selection, we need to send the command as keys
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
