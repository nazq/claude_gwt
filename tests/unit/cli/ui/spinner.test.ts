import { vi } from 'vitest';
import { Spinner } from '../../../../src/cli/ui/spinner';
import { theme } from '../../../../src/cli/ui/theme';

// Mock ora
const mockOra = {
  start: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  stop: vi.fn(),
  text: '',
};

vi.mock('ora', () => ({
  default: vi.fn(() => mockOra),
}));

// Mock theme module properly for ES6
vi.mock('../../../../src/cli/ui/theme', () => ({
  __esModule: true,
  theme: {
    success: vi.fn((text) => `success:${text}`),
    error: vi.fn((text) => `error:${text}`),
    warning: vi.fn((text) => `warning:${text}`),
    info: vi.fn((text) => `info:${text}`),
    icons: {
      spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    },
  },
}));

describe('Spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOra.text = '';
  });

  describe('constructor', () => {
    it('should create spinner with initial text', async () => {
      new Spinner('Loading...');

      // Check that ora default export was called
      const oraModule = await import('ora');
      expect(oraModule.default).toHaveBeenCalledWith({
        text: 'Loading...',
        spinner: {
          interval: 80,
          frames: theme.icons.spinner,
        },
        color: 'cyan',
      });
    });
  });

  describe('start', () => {
    it('should start the spinner', () => {
      const spinner = new Spinner('Initial text');

      spinner.start();

      expect(mockOra.start).toHaveBeenCalled();
    });

    it('should start the spinner with new text', () => {
      const spinner = new Spinner('Initial text');

      spinner.start('New text');

      expect(mockOra.text).toBe('New text');
      expect(mockOra.start).toHaveBeenCalled();
    });

    it('should start without changing text when no text provided', () => {
      const spinner = new Spinner('Initial text');

      spinner.start();

      expect(mockOra.text).toBe('');
      expect(mockOra.start).toHaveBeenCalled();
    });
  });

  describe('succeed', () => {
    it('should call succeed without text', () => {
      const spinner = new Spinner('Loading...');

      spinner.succeed();

      expect(mockOra.succeed).toHaveBeenCalledWith(undefined);
    });

    it('should call succeed with themed text', () => {
      const spinner = new Spinner('Loading...');

      spinner.succeed('Completed!');

      // Check that ora.succeed was called with a themed string
      expect(mockOra.succeed).toHaveBeenCalledWith(expect.stringContaining('Completed!'));
    });
  });

  describe('fail', () => {
    it('should call fail without text', () => {
      const spinner = new Spinner('Loading...');

      spinner.fail();

      expect(mockOra.fail).toHaveBeenCalledWith(undefined);
    });

    it('should call fail with themed text', () => {
      const spinner = new Spinner('Loading...');

      spinner.fail('Failed!');

      expect(mockOra.fail).toHaveBeenCalledWith(expect.stringContaining('Failed!'));
    });
  });

  describe('warn', () => {
    it('should call warn without text', () => {
      const spinner = new Spinner('Loading...');

      spinner.warn();

      expect(mockOra.warn).toHaveBeenCalledWith(undefined);
    });

    it('should call warn with themed text', () => {
      const spinner = new Spinner('Loading...');

      spinner.warn('Warning!');

      expect(mockOra.warn).toHaveBeenCalledWith(expect.stringContaining('Warning!'));
    });
  });

  describe('info', () => {
    it('should call info without text', () => {
      const spinner = new Spinner('Loading...');

      spinner.info();

      expect(mockOra.info).toHaveBeenCalledWith(undefined);
    });

    it('should call info with themed text', () => {
      const spinner = new Spinner('Loading...');

      spinner.info('Information!');

      expect(mockOra.info).toHaveBeenCalledWith(expect.stringContaining('Information!'));
    });
  });

  describe('stop', () => {
    it('should stop the spinner', () => {
      const spinner = new Spinner('Loading...');

      spinner.stop();

      expect(mockOra.stop).toHaveBeenCalled();
    });
  });

  describe('setText', () => {
    it('should set the spinner text', () => {
      const spinner = new Spinner('Loading...');

      spinner.setText('New text');

      expect(mockOra.text).toBe('New text');
    });
  });

  describe('integration', () => {
    it('should handle complete lifecycle', () => {
      const spinner = new Spinner('Processing...');

      spinner.start();
      spinner.setText('Still processing...');
      spinner.succeed('Done!');

      expect(mockOra.start).toHaveBeenCalled();
      expect(mockOra.text).toBe('Still processing...');
      expect(mockOra.succeed).toHaveBeenCalledWith(expect.stringContaining('Done!'));
    });

    it('should handle failure lifecycle', () => {
      const spinner = new Spinner('Attempting...');

      spinner.start('Trying...');
      spinner.fail('Error occurred');

      expect(mockOra.text).toBe('Trying...');
      expect(mockOra.start).toHaveBeenCalled();
      expect(mockOra.fail).toHaveBeenCalledWith(expect.stringContaining('Error occurred'));
    });
  });
});
