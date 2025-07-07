import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProgram } from '../../../src/cli/cgwt-program.js';
import { Command } from 'commander';

// Mock modules
vi.mock('../../../src/sessions/TmuxDriver.js');
vi.mock('../../../src/core/utils/async.js');
vi.mock('../../../src/core/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('cgwt split and tips commands', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = createProgram();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  describe('split command', () => {
    it('should have split command with correct options', () => {
      const splitCommand = program.commands.find((cmd) => cmd.name() === 'split');
      expect(splitCommand).toBeDefined();
      expect(splitCommand?.description()).toContain('Split current tmux pane');

      // Check options
      const options = splitCommand?.options;
      expect(options).toBeDefined();
      const hasHorizontal = options?.some((opt) => opt.flags === '-h, --horizontal');
      const hasVertical = options?.some((opt) => opt.flags === '-v, --vertical');
      const hasPercentage = options?.some((opt) => opt.flags.includes('--percentage'));

      expect(hasHorizontal).toBe(true);
      expect(hasVertical).toBe(true);
      expect(hasPercentage).toBe(true);
    });

    it('should be properly configured as a command', () => {
      const splitCommand = program.commands.find((cmd) => cmd.name() === 'split');
      expect(splitCommand).toBeDefined();

      // Check it's a command object
      expect(splitCommand).toBeInstanceOf(Command);

      // Check it has an action handler
      expect(splitCommand?._actionHandler).toBeDefined();
    });
  });

  describe('tips command', () => {
    it('should have tips command', () => {
      const tipsCommand = program.commands.find((cmd) => cmd.name() === 'tips');
      expect(tipsCommand).toBeDefined();
      expect(tipsCommand?.description()).toContain('Show tmux tips');
    });

    it('should have no required arguments or options', () => {
      const tipsCommand = program.commands.find((cmd) => cmd.name() === 'tips');
      expect(tipsCommand).toBeDefined();

      // Check no arguments
      const args = tipsCommand?.args;
      expect(args?.length ?? 0).toBe(0);

      // Check no required options
      const options = tipsCommand?.options;
      const requiredOptions = options?.filter((opt) => opt.required);
      expect(requiredOptions?.length ?? 0).toBe(0);
    });
  });
});
