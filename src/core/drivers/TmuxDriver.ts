import type { ExecResult } from '../utils/async';
import { execCommandSafe } from '../utils/async';
import { sanitizePath, sanitizeSessionName } from '../utils/security';
import { Logger } from '../utils/logger';

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

      return result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [name, windows, created, attached, group] = line.split('|');
          return {
            name: name ?? '',
            windows: parseInt(windows ?? '0', 10),
            created: parseInt(created ?? '0', 10),
            attached: attached === '1',
            group: group?.trim() ? group.trim() : undefined,
          };
        });
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

      return result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [session, index, name, active, panes] = line.split('|');
          return {
            sessionName: session ?? sessionName,
            index: parseInt(index ?? '0', 10),
            name: name ?? '',
            active: active === '1',
            panes: parseInt(panes ?? '0', 10),
          };
        });
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

      return result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [id, session, windowIdx, paneIdx, command, title] = line.split('|');
          return {
            id: id ?? '',
            sessionName: session ?? sessionName,
            windowIndex: parseInt(windowIdx ?? '0', 10),
            paneIndex: parseInt(paneIdx ?? '0', 10),
            command: command ?? '',
            title: title ?? undefined,
          };
        });
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
}
