import { execSync } from 'child_process';
import { TmuxEnhancer } from '../../../src/sessions/TmuxEnhancer';

// Mock child_process
jest.mock('child_process');
jest.mock('../../../src/core/utils/logger');

describe('Tmux bind-key command validation', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSync.mockReturnValue(Buffer.from(''));
  });

  it('should not generate empty bind-key commands', () => {
    // Capture all execSync calls
    const commands: string[] = [];
    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Buffer.from('');
    });

    // Configure a test session
    TmuxEnhancer.configureSession('test-session', {
      sessionName: 'test-session',
      branchName: 'test-branch',
      role: 'supervisor',
    });

    // Check for empty or malformed bind-key commands
    const bindKeyCommands = commands.filter((cmd) => cmd.includes('bind-key'));

    bindKeyCommands.forEach((cmd) => {
      // Check for empty bind-key commands
      expect(cmd).not.toMatch(/bind-key\s*$/);
      expect(cmd).not.toMatch(/bind-key\s+$/);

      // Check for bind-key with no arguments after options
      expect(cmd).not.toMatch(/bind-key\s+-[a-zA-Z]+\s*$/);

      // Check for proper structure (should have at least a key after bind-key)
      const bindKeyPattern = /bind-key(\s+-[a-zA-Z]+)*\s+\S+/;
      if (cmd.includes('bind-key') && !cmd.includes('unbind-key')) {
        expect(cmd).toMatch(bindKeyPattern);
      }
    });
  });

  it('should validate all bind-key commands have proper arguments', () => {
    const commands: string[] = [];
    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Buffer.from('');
    });

    TmuxEnhancer.configureSession('test-session', {
      sessionName: 'test-session',
      branchName: 'test-branch',
      role: 'child',
    });

    const bindKeyCommands = commands.filter(
      (cmd) => cmd.includes('bind-key') && !cmd.includes('unbind-key'),
    );

    bindKeyCommands.forEach((cmd) => {
      // Extract the bind-key part
      const match = cmd.match(/bind-key[^&;]*/);
      if (match) {
        const bindKeyPart = match[0].trim();
        const parts = bindKeyPart.split(/\s+/);

        // bind-key should have at least 2 parts: 'bind-key' and a key
        expect(parts.length).toBeGreaterThanOrEqual(2);

        // The last part should not be an option (starting with -)
        const lastPart = parts[parts.length - 1];

        // Exception: stdin marker "-" in commands like "tmux load-buffer -"
        const isStdinMarker = lastPart === '-' && cmd.includes('load-buffer');

        if (lastPart && lastPart.match(/^-/) && !isStdinMarker) {
          console.log('\n=== PROBLEMATIC BIND-KEY FOUND ===');
          console.log('Bind-key part:', bindKeyPart);
          console.log('Full command:', cmd);
          console.log('Parts:', parts);
          console.log('Last part:', lastPart);
          console.log('===================================\n');
          expect(lastPart).not.toMatch(/^-/);
        }
      }
    });
  });

  it('should count total bind-key commands', () => {
    const commands: string[] = [];
    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Buffer.from('');
    });

    TmuxEnhancer.configureSession('test-session', {
      sessionName: 'test-session',
      branchName: 'test-branch',
      role: 'supervisor',
    });

    const bindKeyCommands = commands.filter((cmd) => cmd.includes('bind-key'));
    const unbindKeyCommands = commands.filter((cmd) => cmd.includes('unbind-key'));

    console.log('Total bind-key commands:', bindKeyCommands.length);
    console.log('Total unbind-key commands:', unbindKeyCommands.length);
    console.log('\nAll bind-key related commands:');
    [...bindKeyCommands, ...unbindKeyCommands].forEach((cmd, i) => {
      console.log(`${i + 1}: ${cmd}`);
    });

    // Log any potentially problematic commands
    const problematicCommands = bindKeyCommands.filter((cmd) => {
      // Check for various issues
      return (
        cmd.match(/bind-key\s*$/) ||
        cmd.match(/bind-key\s+$/) ||
        cmd.match(/bind-key\s+-[a-zA-Z]+\s*$/) ||
        !cmd.match(/bind-key.*\s+\S+/)
      );
    });

    if (problematicCommands.length > 0) {
      console.log('\nPotentially problematic commands:');
      problematicCommands.forEach((cmd) => console.log(cmd));
    }

    expect(problematicCommands).toHaveLength(0);
  });

  it('should check for exactly 4 bind-key errors pattern', () => {
    // Since the user sees exactly 4 bind-key errors, let's check if any command
    // is being executed 4 times or if there are 4 specific problematic commands
    const commands: string[] = [];
    let callCount = 0;

    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      callCount++;

      // Simulate bind-key error for certain commands
      if (cmd.includes('bind-key') && !cmd.includes('unbind-key')) {
        const parts = cmd.trim().split(/\s+/);
        const lastPart = parts[parts.length - 1];

        // Check if command might cause "too few arguments" error
        if ((lastPart && lastPart.startsWith('-')) || parts.length < 3) {
          throw new Error('command bind-key: too few arguments (need at least 1)');
        }
      }

      return Buffer.from('');
    });

    let errorCount = 0;
    try {
      TmuxEnhancer.configureSession('test-session', {
        sessionName: 'test-session',
        branchName: 'test-branch',
        role: 'supervisor',
      });
    } catch (e) {
      // Count errors
      errorCount++;
    }

    // Check for duplicate commands
    const commandCounts = new Map<string, number>();
    commands.forEach((cmd) => {
      commandCounts.set(cmd, (commandCounts.get(cmd) || 0) + 1);
    });

    console.log('\nCommands executed multiple times:');
    commandCounts.forEach((count, cmd) => {
      if (count > 1) {
        console.log(`${count}x: ${cmd}`);
      }
    });

    // Check if any bind-key command appears exactly 4 times
    const bindKeyDuplicates = Array.from(commandCounts.entries()).filter(
      ([cmd, count]) => cmd.includes('bind-key') && count === 4,
    );

    if (bindKeyDuplicates.length > 0) {
      console.log('\nBind-key commands executed exactly 4 times:');
      bindKeyDuplicates.forEach(([cmd]) => console.log(cmd));
    }
  });

  it('should validate complex bind-key commands with shell pipes', () => {
    const commands: string[] = [];
    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Buffer.from('');
    });

    TmuxEnhancer.configureSession('test-session', {
      sessionName: 'test-session',
      branchName: 'test-branch',
      role: 'supervisor',
    });

    // Find the clipboard paste command which has complex shell syntax
    const complexBindKeys = commands.filter(
      (cmd) => cmd.includes('bind-key') && (cmd.includes('|') || cmd.includes('run')),
    );

    console.log('\nComplex bind-key commands:');
    complexBindKeys.forEach((cmd) => {
      console.log(cmd);

      // Check if quotes are balanced
      const singleQuotes = (cmd.match(/'/g) || []).length;
      const doubleQuotes = (cmd.match(/"/g) || []).length;

      expect(singleQuotes % 2).toBe(0);
      expect(doubleQuotes % 2).toBe(0);
    });
  });

  it('should properly escape special characters in bind-key commands', () => {
    const commands: string[] = [];
    mockExecSync.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Buffer.from('');
    });

    TmuxEnhancer.configureSession('test-session', {
      sessionName: 'test-session',
      branchName: 'test-branch',
      role: 'supervisor',
    });

    // Find bind-key commands with special characters that need escaping
    const specialCharBindKeys = commands.filter(
      (cmd) => cmd.includes('bind-key') && !cmd.includes('unbind-key'),
    );

    specialCharBindKeys.forEach((cmd) => {
      // Check that pipe character is escaped when used as a key
      if (cmd.includes('select-layout even-vertical')) {
        expect(cmd).toMatch(/bind-key\s+\\\|/);
        expect(cmd).not.toMatch(/bind-key\s+\|(?!\|)/); // Not escaped single pipe
      }

      // Ensure no bind-key command ends with just an option flag
      const match = cmd.match(/bind-key[^&;]*/);
      if (match) {
        const bindKeyPart = match[0].trim();
        const parts = bindKeyPart.split(/\s+/);
        const lastPart = parts[parts.length - 1];

        // Last part should not be just a dash or option flag
        // Exception: stdin marker "-" in commands like "tmux load-buffer -"
        const isStdinMarker = lastPart === '-' && cmd.includes('load-buffer');
        if (!isStdinMarker) {
          expect(lastPart).not.toMatch(/^-$/);
          expect(lastPart).not.toMatch(/^-[a-zA-Z]$/);
        }
      }
    });
  });
});
