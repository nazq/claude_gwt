/**
 * Parser for tmux hook commands
 */
export interface ParsedHook {
  target?: string;
  hookName?: string;
  command?: string;
  isValid: boolean;
}

export class TmuxHookParser {
  /**
   * Parse a set-hook command
   * Format: set-hook [-t target] -g hook-name 'command'
   */
  static parse(command: string): ParsedHook {
    const trimmed = command.trim();
    if (!trimmed) {
      return { isValid: false };
    }

    // Match: set-hook [-t target] -g hook-name 'command'
    const match = trimmed.match(/set-hook(?:\s+-t\s+(\S+))?\s+-g\s+(\S+)\s+'(.+)'/);

    if (!match) {
      return { isValid: false };
    }

    const [, target, hookName, hookCommand] = match;

    // Empty command is invalid
    if (!hookCommand) {
      return { isValid: false };
    }

    return {
      target,
      hookName,
      command: hookCommand,
      isValid: true,
    };
  }
}
