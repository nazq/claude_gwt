/**
 * Parser for tmux configuration commands
 * Extracted from TmuxEnhancer for better testability
 */
export interface ParsedCommand {
  type: 'set' | 'setw' | 'bind-key' | 'unbind-key' | 'unknown';
  option?: string;
  value?: string;
  isGlobal?: boolean;
  key?: string;
  command?: string;
  table?: string;
  repeat?: boolean;
}

export class TmuxCommandParser {
  /**
   * Parse a tmux configuration command
   */
  static parse(command: string): ParsedCommand {
    const trimmed = command.trim();
    if (!trimmed) {
      return { type: 'unknown' };
    }

    const parts = trimmed.split(/\s+/);
    const cmdType = parts[0];

    switch (cmdType) {
      case 'set':
        return this.parseSetCommand(parts);
      case 'setw':
        return this.parseSetWindowCommand(parts);
      case 'bind-key':
        return this.parseBindKeyCommand(parts);
      case 'unbind-key':
        return this.parseUnbindKeyCommand(parts);
      default:
        return { type: 'unknown' };
    }
  }

  private static parseSetCommand(parts: string[]): ParsedCommand {
    // set [-g] option value
    const isGlobal = parts[1] === '-g';
    const option = isGlobal ? parts[2] : parts[1];
    const value = isGlobal ? parts.slice(3).join(' ') : parts.slice(2).join(' ');

    return {
      type: 'set',
      option,
      value,
      isGlobal,
    };
  }

  private static parseSetWindowCommand(parts: string[]): ParsedCommand {
    // setw option value
    const option = parts[1];
    const value = parts.slice(2).join(' ');

    return {
      type: 'setw',
      option,
      value,
    };
  }

  private static parseBindKeyCommand(parts: string[]): ParsedCommand {
    // bind-key [-n] [-r] [-T table] key command
    let argIndex = 1;
    let table: string | undefined;
    let repeat = false;
    let noPrefix = false;

    // Parse flags
    while (argIndex < parts.length && parts[argIndex]?.startsWith('-')) {
      const flag = parts[argIndex];

      if (flag === '-T' && argIndex + 1 < parts.length) {
        table = parts[argIndex + 1];
        argIndex += 2;
      } else if (flag === '-r') {
        repeat = true;
        argIndex++;
      } else if (flag === '-n') {
        noPrefix = true;
        argIndex++;
      } else {
        argIndex++;
      }
    }

    // Get key and command
    const key = parts[argIndex];
    const command = parts.slice(argIndex + 1).join(' ');

    // -n flag means no prefix key, which we handle by not setting a table
    if (noPrefix) {
      table = undefined;
    }

    return {
      type: 'bind-key',
      key,
      command,
      table,
      repeat,
    };
  }

  private static parseUnbindKeyCommand(parts: string[]): ParsedCommand {
    // unbind-key [-n] [-T table] key
    let argIndex = 1;
    let table: string | undefined;
    let noPrefix = false;

    // Parse flags
    while (argIndex < parts.length && parts[argIndex]?.startsWith('-')) {
      const flag = parts[argIndex];

      if (flag === '-T' && argIndex + 1 < parts.length) {
        table = parts[argIndex + 1];
        argIndex += 2;
      } else if (flag === '-n') {
        noPrefix = true;
        argIndex++;
      } else {
        argIndex++;
      }
    }

    // Get key
    const key = parts[argIndex];

    // -n flag means no prefix key
    if (noPrefix) {
      table = undefined;
    }

    return {
      type: 'unbind-key',
      key,
      table,
    };
  }
}
