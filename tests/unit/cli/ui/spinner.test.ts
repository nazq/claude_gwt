import { Spinner } from '../../../../src/cli/ui/spinner';
import ora from 'ora';
import { theme } from '../../../../src/cli/ui/theme';

jest.mock('ora');

describe('Spinner', () => {
  let mockOraInstance: any;

  beforeEach(() => {
    mockOraInstance = {
      start: jest.fn(),
      succeed: jest.fn(),
      fail: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      stop: jest.fn(),
      text: '',
    };
    (ora as unknown as jest.Mock).mockReturnValue(mockOraInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create spinner with correct options', () => {
      const text = 'Loading...';
      new Spinner(text);

      expect(ora).toHaveBeenCalledWith({
        text,
        spinner: {
          interval: 80,
          frames: theme.icons.spinner,
        },
        color: 'cyan',
      });
    });
  });

  describe('start', () => {
    it('should start spinner', () => {
      const spinner = new Spinner('Initial');
      spinner.start();

      expect(mockOraInstance.start).toHaveBeenCalled();
    });

    it('should update text when provided', () => {
      const spinner = new Spinner('Initial');
      spinner.start('New text');

      expect(mockOraInstance.text).toBe('New text');
      expect(mockOraInstance.start).toHaveBeenCalled();
    });
  });

  describe('succeed', () => {
    it('should call succeed with themed text', () => {
      const spinner = new Spinner('Test');
      const successText = 'Success!';
      spinner.succeed(successText);

      expect(mockOraInstance.succeed).toHaveBeenCalledWith(theme.success(successText));
    });

    it('should call succeed with undefined when no text', () => {
      const spinner = new Spinner('Test');
      spinner.succeed();

      expect(mockOraInstance.succeed).toHaveBeenCalledWith(undefined);
    });
  });

  describe('fail', () => {
    it('should call fail with themed text', () => {
      const spinner = new Spinner('Test');
      const errorText = 'Error!';
      spinner.fail(errorText);

      expect(mockOraInstance.fail).toHaveBeenCalledWith(theme.error(errorText));
    });

    it('should call fail with undefined when no text', () => {
      const spinner = new Spinner('Test');
      spinner.fail();

      expect(mockOraInstance.fail).toHaveBeenCalledWith(undefined);
    });
  });

  describe('warn', () => {
    it('should call warn with themed text', () => {
      const spinner = new Spinner('Test');
      const warnText = 'Warning!';
      spinner.warn(warnText);

      expect(mockOraInstance.warn).toHaveBeenCalledWith(theme.warning(warnText));
    });

    it('should call warn with undefined when no text', () => {
      const spinner = new Spinner('Test');
      spinner.warn();

      expect(mockOraInstance.warn).toHaveBeenCalledWith(undefined);
    });
  });

  describe('info', () => {
    it('should call info with themed text', () => {
      const spinner = new Spinner('Test');
      const infoText = 'Info!';
      spinner.info(infoText);

      expect(mockOraInstance.info).toHaveBeenCalledWith(theme.info(infoText));
    });

    it('should call info with undefined when no text', () => {
      const spinner = new Spinner('Test');
      spinner.info();

      expect(mockOraInstance.info).toHaveBeenCalledWith(undefined);
    });
  });

  describe('stop', () => {
    it('should stop spinner', () => {
      const spinner = new Spinner('Test');
      spinner.stop();

      expect(mockOraInstance.stop).toHaveBeenCalled();
    });
  });

  describe('setText', () => {
    it('should update spinner text', () => {
      const spinner = new Spinner('Initial');
      spinner.setText('Updated text');

      expect(mockOraInstance.text).toBe('Updated text');
    });
  });
});
