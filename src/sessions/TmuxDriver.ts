import type { ExecResult } from '../core/utils/async.js';
import { execCommandSafe } from '../core/utils/async.js';
import { sanitizePath, sanitizeSessionName } from '../core/utils/security.js';
import { Logger } from '../core/utils/logger.js';
import { TmuxParser } from './TmuxParser.js';

/**
 * Tmux layout types
 */
export enum TmuxLayout {
  EvenHorizontal = 'even-horizontal',
  EvenVertical = 'even-vertical',
  MainHorizontal = 'main-horizontal',
  MainVertical = 'main-vertical',
  Tiled = 'tiled',
}

/**
 * Tmux key table names
 */
export enum TmuxKeyTable {
  Root = 'root',
  Prefix = 'prefix',
  CopyMode = 'copy-mode',
  CopyModeVi = 'copy-mode-vi',
}

/**
 * Tmux status bar positions
 */
export enum TmuxStatusPosition {
  Top = 'top',
  Bottom = 'bottom',
  Off = 'off',
}

/**
 * Tmux pane border status positions
 */
export enum TmuxPaneBorderStatus {
  Top = 'top',
  Bottom = 'bottom',
  Off = 'off',
}

/**
 * Common tmux option names
 */
export enum TmuxOption {
  // Session options
  Status = 'status',
  StatusPosition = 'status-position',
  StatusStyle = 'status-style',
  StatusLeft = 'status-left',
  StatusRight = 'status-right',
  StatusLeftLength = 'status-left-length',
  StatusRightLength = 'status-right-length',
  StatusInterval = 'status-interval',
  StatusJustify = 'status-justify',

  // Window options
  WindowStatusStyle = 'window-status-style',
  WindowStatusCurrentStyle = 'window-status-current-style',
  WindowStatusFormat = 'window-status-format',
  WindowStatusCurrentFormat = 'window-status-current-format',
  WindowStatusActivityStyle = 'window-status-activity-style',
  MonitorActivity = 'monitor-activity',
  SynchronizePanes = 'synchronize-panes',
  AggressiveResize = 'aggressive-resize',
  RemainOnExit = 'remain-on-exit',

  // Copy mode options
  ModeKeys = 'mode-keys',
  Mouse = 'mouse',

  // Pane options
  PaneBorderStatus = 'pane-border-status',
  PaneBorderStyle = 'pane-border-style',
  PaneActiveBorderStyle = 'pane-active-border-style',
  PaneBorderFormat = 'pane-border-format',
}

/**
 * Tmux hook names
 */
export enum TmuxHook {
  SessionCreated = 'session-created',
  SessionClosed = 'session-closed',
  WindowCreated = 'window-created',
  WindowClosed = 'window-closed',
  PaneCreated = 'pane-created',
  PaneDestroyed = 'pane-destroyed',
  AlertActivity = 'alert-activity',
}

/**
 * Tmux color names (commonly used ones)
 */
export enum TmuxColor {
  Black = 'black',
  Red = 'red',
  Green = 'green',
  Yellow = 'yellow',
  Blue = 'blue',
  Magenta = 'magenta',
  Cyan = 'cyan',
  White = 'white',
  BrightBlack = 'brightblack',
  BrightRed = 'brightred',
  BrightGreen = 'brightgreen',
  BrightYellow = 'brightyellow',
  BrightBlue = 'brightblue',
  BrightMagenta = 'brightmagenta',
  BrightCyan = 'brightcyan',
  BrightWhite = 'brightwhite',
  // Common color numbers
  Colour0 = 'colour0',
  Colour25 = 'colour25',
  Colour28 = 'colour28',
  Colour32 = 'colour32',
  Colour88 = 'colour88',
  Colour196 = 'colour196',
  Colour236 = 'colour236',
  Colour237 = 'colour237',
  Colour238 = 'colour238',
  Colour240 = 'colour240',
  Colour255 = 'colour255',
}

/**
 * Tmux status bar justification
 */
export enum TmuxStatusJustify {
  Left = 'left',
  Centre = 'centre',
  Right = 'right',
}

/**
 * Configuration for status bar
 */
export interface TmuxStatusBarConfig {
  enabled?: boolean;
  position?: TmuxStatusPosition;
  style?: {
    background?: TmuxColor | string;
    foreground?: TmuxColor | string;
  };
  left?: {
    content?: string;
    length?: number;
  };
  right?: {
    content?: string;
    length?: number;
  };
  interval?: number;
  justify?: TmuxStatusJustify;
  windowStatus?: {
    format?: string;
    currentFormat?: string;
    style?: string;
    currentStyle?: string;
    activityStyle?: string;
  };
}

/**
 * Configuration for key binding
 */
export interface TmuxKeyBindingConfig {
  key: string;
  command: string;
  table?: TmuxKeyTable | string;
  repeat?: boolean;
  note?: string; // Documentation for the binding
}

/**
 * Configuration for pane layout
 */
export interface TmuxPaneLayoutConfig {
  layout: TmuxLayout;
  mainPaneSize?: number; // For main-* layouts
  borderStatus?: TmuxPaneBorderStatus;
  borderStyle?: string;
  activeBorderStyle?: string;
  borderFormat?: string;
}

/**
 * Tmux session information
 */
export interface TmuxSessionInfo {
  name: string;
  windows: number;
  created: number;
  attached: boolean;
  group?: string;
}

/**
 * Tmux pane information
 */
export interface TmuxPaneInfo {
  id: string;
  sessionName: string;
  windowIndex: number;
  paneIndex: number;
  command: string;
  title?: string;
}

/**
 * Tmux window information
 */
export interface TmuxWindowInfo {
  sessionName: string;
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

/**
 * Options for creating a new tmux session
 */
export interface CreateSessionOptions {
  sessionName: string;
  workingDirectory?: string;
  windowName?: string;
  detached?: boolean;
  command?: string;
}

/**
 * Options for creating a new window
 */
export interface CreateWindowOptions {
  sessionName: string;
  windowName?: string;
  workingDirectory?: string;
  command?: string;
}

/**
 * Options for splitting a pane
 */
export interface SplitPaneOptions {
  target: string; // session:window.pane format
  horizontal?: boolean;
  percentage?: number;
  workingDirectory?: string;
  command?: string;
}

/**
 * Tmux driver abstraction for safe tmux operations
 */
export class TmuxDriver {
  /**
   * Check if tmux is installed and available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const result = await execCommandSafe('which', ['tmux']);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if we're running inside a tmux session
   */
  static isInsideTmux(): boolean {
    return process.env['TMUX'] !== undefined;
  }

  /**
   * Get tmux version
   */
  static async getVersion(): Promise<string | null> {
    try {
      const result = await execCommandSafe('tmux', ['-V']);
      if (result.code === 0) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * List all tmux sessions
   */
  static async listSessions(): Promise<TmuxSessionInfo[]> {
    try {
      const result = await execCommandSafe('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}|#{?session_grouped,#{session_group},}',
      ]);

      if (result.code !== 0) {
        return [];
      }

      return TmuxParser.parseSessions(result.stdout);
    } catch (error) {
      Logger.error('Failed to list tmux sessions', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific session
   */
  static async getSession(sessionName: string): Promise<TmuxSessionInfo | null> {
    const safeName = sanitizeSessionName(sessionName);
    const sessions = await this.listSessions();
    return sessions.find((s) => s.name === safeName) ?? null;
  }

  /**
   * Check if a session exists
   */
  static async sessionExists(sessionName: string): Promise<boolean> {
    const session = await this.getSession(sessionName);
    return session !== null;
  }

  /**
   * Create a new tmux session
   */
  static async createSession(options: CreateSessionOptions): Promise<ExecResult> {
    const args = ['new-session'];

    if (options.detached !== false) {
      args.push('-d');
    }

    args.push('-s', sanitizeSessionName(options.sessionName));

    if (options.workingDirectory) {
      args.push('-c', sanitizePath(options.workingDirectory));
    }

    if (options.windowName) {
      args.push('-n', options.windowName);
    }

    if (options.command) {
      args.push(options.command);
    }

    return execCommandSafe('tmux', args);
  }

  /**
   * Kill a tmux session
   */
  static async killSession(sessionName: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['kill-session', '-t', sanitizeSessionName(sessionName)]);
  }

  /**
   * Attach to a tmux session
   */
  static async attachSession(sessionName: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['attach-session', '-t', sanitizeSessionName(sessionName)]);
  }

  /**
   * Switch to a different session (from within tmux)
   */
  static async switchClient(sessionName: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['switch-client', '-t', sanitizeSessionName(sessionName)]);
  }

  /**
   * Create a new window in a session
   */
  static async createWindow(options: CreateWindowOptions): Promise<ExecResult> {
    const args = ['new-window', '-t', sanitizeSessionName(options.sessionName)];

    if (options.windowName) {
      args.push('-n', options.windowName);
    }

    if (options.workingDirectory) {
      args.push('-c', sanitizePath(options.workingDirectory));
    }

    if (options.command) {
      args.push(options.command);
    }

    return execCommandSafe('tmux', args);
  }

  /**
   * List windows in a session
   */
  static async listWindows(sessionName: string): Promise<TmuxWindowInfo[]> {
    try {
      const result = await execCommandSafe('tmux', [
        'list-windows',
        '-t',
        sanitizeSessionName(sessionName),
        '-F',
        '#{session_name}|#{window_index}|#{window_name}|#{window_active}|#{window_panes}',
      ]);

      if (result.code !== 0) {
        return [];
      }

      return TmuxParser.parseWindows(result.stdout);
    } catch (error) {
      Logger.error('Failed to list windows', error);
      return [];
    }
  }

  /**
   * List panes in a session
   */
  static async listPanes(sessionName: string): Promise<TmuxPaneInfo[]> {
    try {
      const result = await execCommandSafe('tmux', [
        'list-panes',
        '-s', // List all panes in session
        '-t',
        sanitizeSessionName(sessionName),
        '-F',
        '#{pane_id}|#{session_name}|#{window_index}|#{pane_index}|#{pane_current_command}|#{pane_title}',
      ]);

      if (result.code !== 0) {
        return [];
      }

      return TmuxParser.parsePanes(result.stdout);
    } catch (error) {
      Logger.error('Failed to list panes', error);
      return [];
    }
  }

  /**
   * Send keys to a pane
   */
  static async sendKeys(
    target: string,
    keys: string[],
    enter: boolean = true,
  ): Promise<ExecResult> {
    const args = ['send-keys', '-t', target, ...keys];
    if (enter) {
      args.push('Enter');
    }
    return execCommandSafe('tmux', args);
  }

  /**
   * Set a tmux option
   */
  static async setOption(
    target: string | null,
    option: string,
    value: string,
    global: boolean = false,
  ): Promise<ExecResult> {
    const args = ['set'];

    if (global) {
      args.push('-g');
    }

    if (target) {
      args.push('-t', target);
    }

    args.push(option, value);

    return execCommandSafe('tmux', args);
  }

  /**
   * Set a window option
   */
  static async setWindowOption(
    target: string,
    option: string,
    value: string,
    global: boolean = false,
  ): Promise<ExecResult> {
    const args = ['setw'];

    if (global) {
      args.push('-g');
    }

    args.push('-t', target, option, value);

    return execCommandSafe('tmux', args);
  }

  /**
   * Get a tmux option value
   */
  static async getOption(target: string, option: string): Promise<string | null> {
    try {
      const result = await execCommandSafe('tmux', ['show', '-t', target, '-v', option]);

      if (result.code === 0) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Split a pane
   */
  static async splitPane(options: SplitPaneOptions): Promise<ExecResult> {
    const args = ['split-window', '-t', options.target];

    if (options.horizontal) {
      args.push('-h');
    } else {
      args.push('-v');
    }

    if (options.percentage) {
      args.push('-p', options.percentage.toString());
    }

    if (options.workingDirectory) {
      args.push('-c', sanitizePath(options.workingDirectory));
    }

    if (options.command) {
      args.push(options.command);
    }

    return execCommandSafe('tmux', args);
  }

  /**
   * Kill a pane
   */
  static async killPane(target: string, all: boolean = false): Promise<ExecResult> {
    const args = ['kill-pane'];

    if (all) {
      args.push('-a');
    }

    args.push('-t', target);

    return execCommandSafe('tmux', args);
  }

  /**
   * Select a pane
   */
  static async selectPane(target: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['select-pane', '-t', target]);
  }

  /**
   * Set pane title
   */
  static async setPaneTitle(target: string, title: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['select-pane', '-t', target, '-T', title]);
  }

  /**
   * Bind a key
   */
  static async bindKey(
    key: string,
    command: string,
    table?: string,
    repeat?: boolean,
  ): Promise<ExecResult> {
    const args = ['bind-key'];

    if (table) {
      args.push('-T', table);
    }

    if (repeat) {
      args.push('-r');
    }

    args.push(key, command);

    return execCommandSafe('tmux', args);
  }

  /**
   * Unbind a key
   */
  static async unbindKey(key: string, table?: string): Promise<ExecResult> {
    const args = ['unbind-key'];

    if (table) {
      args.push('-T', table);
    }

    args.push(key);

    return execCommandSafe('tmux', args);
  }

  /**
   * Set hook
   */
  static async setHook(hook: string, command: string): Promise<ExecResult> {
    return execCommandSafe('tmux', ['set-hook', '-g', hook, command]);
  }

  /**
   * Display a message
   */
  static async displayMessage(message: string, target?: string): Promise<ExecResult> {
    const args = ['display-message'];

    if (target) {
      args.push('-t', target);
    }

    args.push(message);

    return execCommandSafe('tmux', args);
  }

  /**
   * Check if a pane has a specific command running
   */
  static async isPaneRunningCommand(sessionName: string, command: string): Promise<boolean> {
    const panes = await this.listPanes(sessionName);
    return panes.some((pane) => pane.command.includes(command) || pane.command === command);
  }

  /**
   * Synchronize panes in a window
   */
  static async synchronizePanes(target: string, enabled: boolean): Promise<ExecResult> {
    return this.setWindowOption(target, 'synchronize-panes', enabled ? 'on' : 'off');
  }

  /**
   * Set pane border status
   */
  static async setPaneBorderStatus(
    target: string,
    position: TmuxPaneBorderStatus,
  ): Promise<ExecResult> {
    return this.setOption(target, TmuxOption.PaneBorderStatus, position);
  }

  /**
   * Configure status bar with structured configuration
   */
  static async configureStatusBar(
    sessionName: string,
    config: TmuxStatusBarConfig,
  ): Promise<ExecResult[]> {
    const results: ExecResult[] = [];
    const target = sanitizeSessionName(sessionName);

    try {
      // Enable/disable status bar
      if (config.enabled !== undefined) {
        results.push(
          await this.setOption(target, TmuxOption.Status, config.enabled ? 'on' : 'off'),
        );
      }

      // Set position
      if (config.position) {
        results.push(await this.setOption(target, TmuxOption.StatusPosition, config.position));
      }

      // Set style
      if (config.style) {
        const styleStr = [
          config.style.background ? `bg=${config.style.background}` : '',
          config.style.foreground ? `fg=${config.style.foreground}` : '',
        ]
          .filter(Boolean)
          .join(',');

        if (styleStr) {
          results.push(await this.setOption(target, TmuxOption.StatusStyle, styleStr));
        }
      }

      // Set left status
      if (config.left) {
        if (config.left.content) {
          results.push(await this.setOption(target, TmuxOption.StatusLeft, config.left.content));
        }
        if (config.left.length) {
          results.push(
            await this.setOption(
              target,
              TmuxOption.StatusLeftLength,
              config.left.length.toString(),
            ),
          );
        }
      }

      // Set right status
      if (config.right) {
        if (config.right.content) {
          results.push(await this.setOption(target, TmuxOption.StatusRight, config.right.content));
        }
        if (config.right.length) {
          results.push(
            await this.setOption(
              target,
              TmuxOption.StatusRightLength,
              config.right.length.toString(),
            ),
          );
        }
      }

      // Set interval
      if (config.interval) {
        results.push(
          await this.setOption(target, TmuxOption.StatusInterval, config.interval.toString()),
        );
      }

      // Set justification
      if (config.justify) {
        results.push(await this.setOption(target, TmuxOption.StatusJustify, config.justify));
      }

      // Set window status formatting
      if (config.windowStatus) {
        const ws = config.windowStatus;
        if (ws.format) {
          results.push(
            await this.setWindowOption(target, TmuxOption.WindowStatusFormat, ws.format),
          );
        }
        if (ws.currentFormat) {
          results.push(
            await this.setWindowOption(
              target,
              TmuxOption.WindowStatusCurrentFormat,
              ws.currentFormat,
            ),
          );
        }
        if (ws.style) {
          results.push(await this.setWindowOption(target, TmuxOption.WindowStatusStyle, ws.style));
        }
        if (ws.currentStyle) {
          results.push(
            await this.setWindowOption(
              target,
              TmuxOption.WindowStatusCurrentStyle,
              ws.currentStyle,
            ),
          );
        }
        if (ws.activityStyle) {
          results.push(
            await this.setWindowOption(
              target,
              TmuxOption.WindowStatusActivityStyle,
              ws.activityStyle,
            ),
          );
        }
      }

      return results;
    } catch (error) {
      Logger.error('Failed to configure status bar', error);
      throw error;
    }
  }

  /**
   * Apply multiple key bindings at once
   */
  static async configureKeyBindings(bindings: TmuxKeyBindingConfig[]): Promise<ExecResult[]> {
    const results: ExecResult[] = [];

    for (const binding of bindings) {
      try {
        const result = await this.bindKey(
          binding.key,
          binding.command,
          binding.table,
          binding.repeat,
        );
        results.push(result);
      } catch (error) {
        Logger.error(`Failed to bind key ${binding.key}`, error);
        results.push({
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          code: 1,
        });
      }
    }

    return results;
  }

  /**
   * Configure pane layout with structured configuration
   */
  static async configurePaneLayout(
    sessionName: string,
    config: TmuxPaneLayoutConfig,
  ): Promise<ExecResult[]> {
    const results: ExecResult[] = [];
    const target = sanitizeSessionName(sessionName);

    try {
      // Set layout
      results.push(await execCommandSafe('tmux', ['select-layout', '-t', target, config.layout]));

      // Configure border status
      if (config.borderStatus) {
        results.push(
          await this.setOption(target, TmuxOption.PaneBorderStatus, config.borderStatus),
        );
      }

      // Configure border styling
      if (config.borderStyle) {
        results.push(await this.setOption(target, TmuxOption.PaneBorderStyle, config.borderStyle));
      }

      if (config.activeBorderStyle) {
        results.push(
          await this.setOption(target, TmuxOption.PaneActiveBorderStyle, config.activeBorderStyle),
        );
      }

      if (config.borderFormat) {
        results.push(
          await this.setOption(target, TmuxOption.PaneBorderFormat, config.borderFormat),
        );
      }

      return results;
    } catch (error) {
      Logger.error('Failed to configure pane layout', error);
      throw error;
    }
  }

  /**
   * Enable copy mode with vi key bindings
   */
  static async enableViCopyMode(sessionName: string): Promise<ExecResult[]> {
    const target = sanitizeSessionName(sessionName);

    const keyBindings: TmuxKeyBindingConfig[] = [
      {
        key: 'v',
        command: 'send-keys -X begin-selection',
        table: TmuxKeyTable.CopyModeVi,
        note: 'Begin selection in copy mode',
      },
      {
        key: 'C-v',
        command: 'send-keys -X rectangle-toggle',
        table: TmuxKeyTable.CopyModeVi,
        note: 'Toggle rectangle selection',
      },
      {
        key: 'y',
        command: 'send-keys -X copy-selection-and-cancel',
        table: TmuxKeyTable.CopyModeVi,
        note: 'Copy selection and exit copy mode',
      },
      {
        key: 'Escape',
        command: 'send-keys -X cancel',
        table: TmuxKeyTable.CopyModeVi,
        note: 'Exit copy mode',
      },
    ];

    const results: ExecResult[] = [];

    // Set vi mode
    results.push(await this.setOption(target, TmuxOption.ModeKeys, 'vi', true));

    // Enable mouse
    results.push(await this.setOption(target, TmuxOption.Mouse, 'on', true));

    // Apply key bindings
    const bindingResults = await this.configureKeyBindings(keyBindings);
    results.push(...bindingResults);

    return results;
  }

  /**
   * Create a predefined layout (builder pattern helper)
   */
  static createLayoutBuilder(sessionName: string): {
    withLayout: (layout: TmuxLayout) => {
      withBorderStatus: (status: TmuxPaneBorderStatus) => {
        withBorderStyle: (style: string) => {
          withActiveBorderStyle: (activeStyle: string) => {
            apply: () => Promise<ExecResult[]>;
          };
          apply: () => Promise<ExecResult[]>;
        };
        apply: () => Promise<ExecResult[]>;
      };
      apply: () => Promise<ExecResult[]>;
    };
  } {
    const target = sanitizeSessionName(sessionName);

    return {
      withLayout: (layout: TmuxLayout) => ({
        withBorderStatus: (status: TmuxPaneBorderStatus) => ({
          withBorderStyle: (style: string) => ({
            withActiveBorderStyle: (activeStyle: string) => ({
              apply: (): Promise<ExecResult[]> =>
                this.configurePaneLayout(target, {
                  layout,
                  borderStatus: status,
                  borderStyle: style,
                  activeBorderStyle: activeStyle,
                }),
            }),
            apply: (): Promise<ExecResult[]> =>
              this.configurePaneLayout(target, {
                layout,
                borderStatus: status,
                borderStyle: style,
              }),
          }),
          apply: (): Promise<ExecResult[]> =>
            this.configurePaneLayout(target, {
              layout,
              borderStatus: status,
            }),
        }),
        apply: (): Promise<ExecResult[]> => this.configurePaneLayout(target, { layout }),
      }),
    };
  }

  /**
   * Refresh client
   */
  static async refreshClient(target?: string): Promise<ExecResult> {
    const args = ['refresh-client'];

    if (target) {
      args.push('-t', target);
    }

    return execCommandSafe('tmux', args);
  }
}
