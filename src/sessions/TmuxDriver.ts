import type { ExecResult } from '../core/utils/async.js';
import { execCommandSafe } from '../core/utils/async.js';
import { sanitizePath, sanitizeSessionName } from '../core/utils/security.js';
import { Logger } from '../core/utils/logger.js';
import { TmuxParser } from './TmuxParser.js';

// ===== ENUMS FOR TMUX CONCEPTS =====

/**
 * Tmux layout presets
 */
export enum TmuxLayout {
  EvenHorizontal = 'even-horizontal',
  EvenVertical = 'even-vertical',
  MainHorizontal = 'main-horizontal',
  MainVertical = 'main-vertical',
  Tiled = 'tiled',
}

/**
 * Tmux colors (standard terminal colors)
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
  Default = 'default',
  // Numbered colors
  Colour0 = 'colour0',
  Colour25 = 'colour25',
  Colour28 = 'colour28',
  Colour32 = 'colour32',
  Colour196 = 'colour196',
  Colour236 = 'colour236',
  Colour240 = 'colour240',
  Colour255 = 'colour255',
}

/**
 * Tmux status bar positions
 */
export enum TmuxStatusPosition {
  Top = 'top',
  Bottom = 'bottom',
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
 * Tmux pane border status positions
 */
export enum TmuxPaneBorderStatus {
  Off = 'off',
  Top = 'top',
  Bottom = 'bottom',
}

/**
 * Common tmux options
 */
export enum TmuxOption {
  // General options
  Status = 'status',
  StatusInterval = 'status-interval',
  StatusPosition = 'status-position',
  StatusStyle = 'status-style',
  StatusLeft = 'status-left',
  StatusRight = 'status-right',
  StatusJustify = 'status-justify',

  // Mouse and keyboard
  Mouse = 'mouse',
  ModeKeys = 'mode-keys',

  // Pane options
  PaneBorderStatus = 'pane-border-status',
  PaneBorderStyle = 'pane-border-style',
  PaneActiveBorderStyle = 'pane-active-border-style',
  PaneBorderFormat = 'pane-border-format',

  // Window options
  MonitorActivity = 'monitor-activity',
  SynchronizePanes = 'synchronize-panes',
  RemainOnExit = 'remain-on-exit',
  AggressiveResize = 'aggressive-resize',

  // Custom options
  SessionGroup = '@session-group',
  YankAction = '@yank_action',
}

/**
 * Tmux key tables
 */
export enum TmuxKeyTable {
  Root = 'root',
  Prefix = 'prefix',
  CopyModeVi = 'copy-mode-vi',
  CopyMode = 'copy-mode',
}

/**
 * Tmux hooks
 */
export enum TmuxHook {
  AlertActivity = 'alert-activity',
  SessionCreated = 'session-created',
  SessionClosed = 'session-closed',
  WindowLinked = 'window-linked',
  WindowUnlinked = 'window-unlinked',
  PaneExited = 'pane-exited',
}

// ===== INTERFACES FOR STRUCTURED DATA =====

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
 * Configuration for tmux status bar
 */
export interface TmuxStatusBarConfig {
  enabled?: boolean;
  position?: TmuxStatusPosition;
  interval?: number;
  justify?: TmuxStatusJustify;
  style?: {
    background?: TmuxColor | string;
    foreground?: TmuxColor | string;
  };
  left?: string;
  right?: string;
}

/**
 * Configuration for tmux key bindings
 */
export interface TmuxKeyBindingConfig {
  key: string;
  command: string;
  table?: TmuxKeyTable;
  repeat?: boolean;
}

/**
 * Configuration for tmux pane borders
 */
export interface TmuxPaneBorderConfig {
  status?: TmuxPaneBorderStatus;
  style?: {
    inactive?: string;
    active?: string;
  };
  format?: string;
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
    position: 'top' | 'bottom' | 'off',
  ): Promise<ExecResult> {
    return this.setOption(target, 'pane-border-status', position);
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

  // ===== HIGH-LEVEL SDK METHODS =====

  /**
   * Configure the status bar with structured options
   */
  static async configureStatusBar(sessionName: string, config: TmuxStatusBarConfig): Promise<void> {
    // Enable/disable status bar
    if (config.enabled !== undefined) {
      await this.setOption(sessionName, TmuxOption.Status, config.enabled ? 'on' : 'off');
    }

    // Set position
    if (config.position) {
      await this.setOption(sessionName, TmuxOption.StatusPosition, config.position);
    }

    // Set interval
    if (config.interval !== undefined) {
      await this.setOption(sessionName, TmuxOption.StatusInterval, config.interval.toString());
    }

    // Set justification
    if (config.justify) {
      await this.setOption(sessionName, TmuxOption.StatusJustify, config.justify);
    }

    // Set style
    if (config.style) {
      const styleString = `bg=${config.style.background ?? 'default'},fg=${config.style.foreground ?? 'default'}`;
      await this.setOption(sessionName, TmuxOption.StatusStyle, styleString);
    }

    // Set left and right content
    if (config.left !== undefined) {
      await this.setOption(sessionName, TmuxOption.StatusLeft, config.left);
    }
    if (config.right !== undefined) {
      await this.setOption(sessionName, TmuxOption.StatusRight, config.right);
    }
  }

  /**
   * Configure multiple key bindings at once
   */
  static async configureKeyBindings(bindings: TmuxKeyBindingConfig[]): Promise<void> {
    for (const binding of bindings) {
      await this.bindKey(binding.key, binding.command, binding.table, binding.repeat);
    }
  }

  /**
   * Configure pane borders with structured options
   */
  static async configurePaneBorders(
    sessionName: string,
    config: TmuxPaneBorderConfig,
  ): Promise<void> {
    if (config.status) {
      await this.setOption(sessionName, TmuxOption.PaneBorderStatus, config.status);
    }

    if (config.style?.inactive) {
      await this.setOption(sessionName, TmuxOption.PaneBorderStyle, config.style.inactive);
    }

    if (config.style?.active) {
      await this.setOption(sessionName, TmuxOption.PaneActiveBorderStyle, config.style.active);
    }

    if (config.format) {
      await this.setOption(sessionName, TmuxOption.PaneBorderFormat, config.format);
    }
  }

  /**
   * Enable vi copy mode with standard bindings
   */
  static async enableViCopyMode(sessionName: string): Promise<void> {
    // Set vi mode
    await this.setOption(sessionName, TmuxOption.ModeKeys, 'vi', true);

    // Enable mouse
    await this.setOption(sessionName, TmuxOption.Mouse, 'on', true);

    // Configure copy mode bindings
    const copyBindings: TmuxKeyBindingConfig[] = [
      {
        key: 'v',
        command: 'send-keys -X begin-selection',
        table: TmuxKeyTable.CopyModeVi,
      },
      {
        key: 'y',
        command: 'send-keys -X copy-selection-and-cancel',
        table: TmuxKeyTable.CopyModeVi,
      },
    ];

    await this.configureKeyBindings(copyBindings);

    // Unbind mouse drag
    await this.unbindKey('MouseDrag1Pane');
  }

  /**
   * Create a layout builder for fluent API
   */
  static createLayoutBuilder(sessionName: string): TmuxLayoutBuilder {
    return new TmuxLayoutBuilder(sessionName);
  }

  /**
   * Set up monitoring hooks
   */
  static async configureMonitoring(
    _sessionName: string,
    hooks: { [key in TmuxHook]?: string },
  ): Promise<void> {
    for (const [hook, command] of Object.entries(hooks)) {
      if (command) {
        await this.setHook(hook, command);
      }
    }
  }

  /**
   * Apply a layout preset to a window
   */
  static async applyLayout(target: string, layout: TmuxLayout): Promise<ExecResult> {
    return this.sendKeys(target, [`select-layout ${layout}`], false);
  }

  /**
   * Create a multi-pane window with a specific layout
   */
  static async createMultiPaneWindow(
    sessionName: string,
    windowName: string,
    paneCount: number,
    layout: TmuxLayout,
  ): Promise<void> {
    // Create window
    await this.createWindow({ sessionName, windowName });

    // Create additional panes
    for (let i = 1; i < paneCount; i++) {
      await this.splitPane({
        target: `${sessionName}:${windowName}`,
        horizontal: i % 2 === 0,
      });
    }

    // Apply layout
    await this.applyLayout(`${sessionName}:${windowName}`, layout);
  }

  /**
   * Generate a tmux colour string for any numbered color (0-255)
   * @param colorNumber The color number (0-255)
   * @returns The tmux color string (e.g., 'colour42')
   * @example
   * // Use any of the 256 terminal colors
   * const purple = TmuxDriver.colorFrom(135);
   * const orange = TmuxDriver.colorFrom(208);
   * const gray = TmuxDriver.colorFrom(244);
   * 
   * // Use in status bar configuration
   * await TmuxDriver.configureStatusBar(sessionName, {
   *   style: {
   *     background: TmuxDriver.colorFrom(22), // dark green
   *     foreground: TmuxDriver.colorFrom(231), // bright white
   *   }
   * });
   */
  static colorFrom(colorNumber: number): string {
    const intColor = Math.floor(colorNumber);
    if (intColor < 0 || intColor > 255) {
      throw new Error('Color number must be between 0 and 255');
    }
    return `colour${intColor}`;
  }
}

/**
 * Fluent builder for creating tmux layouts
 */
export class TmuxLayoutBuilder {
  private sessionName: string;
  private panes: Array<{
    command?: string;
    workingDirectory?: string;
    title?: string;
  }> = [];

  constructor(sessionName: string) {
    this.sessionName = sessionName;
  }

  addPane(options: {
    command?: string;
    workingDirectory?: string;
    title?: string;
  }): TmuxLayoutBuilder {
    this.panes.push(options);
    return this;
  }

  async build(windowName: string, layout: TmuxLayout): Promise<void> {
    if (this.panes.length === 0) return;

    // Create window with first pane
    const firstPane = this.panes[0];
    if (!firstPane) return; // Safety check

    await TmuxDriver.createWindow({
      sessionName: this.sessionName,
      windowName,
      workingDirectory: firstPane.workingDirectory,
      command: firstPane.command,
    });

    // Add remaining panes
    for (let i = 1; i < this.panes.length; i++) {
      const pane = this.panes[i];
      if (!pane) continue; // Safety check

      await TmuxDriver.splitPane({
        target: `${this.sessionName}:${windowName}`,
        horizontal: i % 2 === 0,
        workingDirectory: pane.workingDirectory,
        command: pane.command,
      });

      // Set title if provided
      if (pane.title) {
        await TmuxDriver.setPaneTitle(`${this.sessionName}:${windowName}.${i}`, pane.title);
      }
    }

    // Apply layout
    await TmuxDriver.applyLayout(`${this.sessionName}:${windowName}`, layout);
  }
}
