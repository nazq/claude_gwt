/**
 * Parser utilities for tmux output formats
 */
import type { TmuxPaneInfo, TmuxSessionInfo, TmuxWindowInfo } from './TmuxDriver.js';

export class TmuxParser {
  /**
   * Parse tmux session list output
   */
  static parseSessions(output: string): TmuxSessionInfo[] {
    if (!output.trim()) {
      return [];
    }

    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [name, windows, created, attached, group] = line.split('|');
        return {
          name: name ?? '',
          windows: TmuxParser.parseNumber(windows ?? '0'),
          created: TmuxParser.parseNumber(created ?? '0'),
          attached: attached === '1',
          group: group?.trim() ? group.trim() : undefined,
        };
      });
  }

  /**
   * Parse tmux window list output
   */
  static parseWindows(output: string): TmuxWindowInfo[] {
    if (!output.trim()) {
      return [];
    }

    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [sessionName, index, name, active, panes] = line.split('|');
        return {
          sessionName: sessionName ?? '',
          index: TmuxParser.parseNumber(index ?? '0'),
          name: name ?? '',
          active: active === '1',
          panes: TmuxParser.parseNumber(panes ?? '0'),
        };
      });
  }

  /**
   * Parse tmux pane list output
   */
  static parsePanes(output: string): TmuxPaneInfo[] {
    if (!output.trim()) {
      return [];
    }

    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [id, sessionName, windowIndex, paneIndex, command, title] = line.split('|');
        return {
          id: id ?? '',
          sessionName: sessionName ?? '',
          windowIndex: TmuxParser.parseNumber(windowIndex ?? '0'),
          paneIndex: TmuxParser.parseNumber(paneIndex ?? '0'),
          command: command ?? '',
          title: title?.trim() ? title.trim() : undefined,
        };
      });
  }

  /**
   * Validate session name format
   */
  static isValidSessionName(name: string): boolean {
    if (!name || name.trim().length === 0) {
      return false;
    }

    // Tmux session names cannot contain certain characters
    const invalidChars = ['\n', '\r', ':', '.', '\0'];
    return !invalidChars.some((char) => name.includes(char));
  }

  /**
   * Sanitize session name by removing invalid characters
   */
  static sanitizeSessionName(name: string): string {
    if (!name) {
      return '';
    }

    return name
      .trim()
      .replace(/[\n\r:.\0]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Parse command output for boolean result
   */
  static parseBoolean(output: string, trueValue = 'on'): boolean {
    return output.trim() === trueValue;
  }

  /**
   * Parse numeric value from output
   */
  static parseNumber(output: string, defaultValue = 0): number {
    const parsed = parseInt(output.trim(), 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}
