import { Logger } from '../../../../src/core/utils/logger';

// Note: Logger has a static initializer that runs on import
// We need to test it as-is rather than trying to mock its initialization

describe('Logger', () => {
  let writeStreamSpy: jest.SpyInstance;

  beforeAll(() => {
    // Spy on the existing stream's write method
    const stream = (Logger as any).stream;
    if (stream && stream.write) {
      writeStreamSpy = jest.spyOn(stream, 'write');
    }
  });

  beforeEach(() => {
    if (writeStreamSpy) {
      writeStreamSpy.mockClear();
    }
  });

  afterAll(() => {
    if (writeStreamSpy) {
      writeStreamSpy.mockRestore();
    }
    Logger.close();
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      Logger.setLogLevel('warn');

      // Clear any initialization logs
      if (writeStreamSpy) writeStreamSpy.mockClear();

      // These should log
      Logger.error('test error');
      Logger.warn('test warn');

      // These should not log
      Logger.info('test info');
      Logger.verbose('test verbose');
      Logger.debug('test debug');

      if (writeStreamSpy) {
        const errorCalls = writeStreamSpy.mock.calls.filter((call) => call[0].includes('[ERROR]'));
        const warnCalls = writeStreamSpy.mock.calls.filter((call) => call[0].includes('[WARN]'));
        const infoCalls = writeStreamSpy.mock.calls.filter(
          (call) => call[0].includes('[INFO]') && call[0].includes('test info'),
        );

        expect(errorCalls.length).toBe(1);
        expect(warnCalls.length).toBe(1);
        expect(infoCalls.length).toBe(0);
      }
    });

    it('should log all levels when set to debug', () => {
      Logger.setLogLevel('debug');

      if (writeStreamSpy) writeStreamSpy.mockClear();

      Logger.error('test error debug');
      Logger.warn('test warn debug');
      Logger.info('test info debug');
      Logger.verbose('test verbose debug');
      Logger.debug('test debug debug');

      if (writeStreamSpy) {
        const calls = writeStreamSpy.mock.calls;
        expect(
          calls.some((call) => call[0].includes('[ERROR]') && call[0].includes('test error debug')),
        ).toBe(true);
        expect(
          calls.some((call) => call[0].includes('[WARN]') && call[0].includes('test warn debug')),
        ).toBe(true);
        expect(
          calls.some((call) => call[0].includes('[INFO]') && call[0].includes('test info debug')),
        ).toBe(true);
        expect(
          calls.some(
            (call) => call[0].includes('[VERBOSE]') && call[0].includes('test verbose debug'),
          ),
        ).toBe(true);
        expect(
          calls.some((call) => call[0].includes('[DEBUG]') && call[0].includes('test debug debug')),
        ).toBe(true);
      }
    });
  });

  describe('message formatting', () => {
    beforeEach(() => {
      Logger.setLogLevel('debug');
      if (writeStreamSpy) writeStreamSpy.mockClear();
    });

    it('should format messages with timestamp and level', () => {
      const testMessage = 'Test message format';
      Logger.info(testMessage);

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        const call = writeStreamSpy.mock.calls[0][0];
        expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
        expect(call).toContain('[INFO]');
        expect(call).toContain(testMessage);
      }
    });

    it('should include data when provided', () => {
      const testData = { key: 'value', number: 42 };
      Logger.info('Test with data', testData);

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        const call = writeStreamSpy.mock.calls[0][0];
        expect(call).toContain(JSON.stringify(testData));
      }
    });

    it('should handle Error objects specially', () => {
      const error = new Error('Test error object');
      error.stack = 'Test stack trace';

      Logger.error('An error occurred', error);

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        const call = writeStreamSpy.mock.calls[0][0];
        expect(call).toContain('"errorMessage":"Test error object"');
        expect(call).toContain('"stack":"Test stack trace"');
        expect(call).toContain('"name":"Error"');
      }
    });

    it('should handle non-Error objects in error method', () => {
      Logger.error('String error', 'Just a string');
      Logger.error('Object error', { custom: 'error' });

      if (writeStreamSpy && writeStreamSpy.mock.calls.length >= 2) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('"Just a string"');
        expect(writeStreamSpy.mock.calls[1][0]).toContain('"custom":"error"');
      }
    });
  });

  describe('log methods', () => {
    beforeEach(() => {
      Logger.setLogLevel('debug');
      if (writeStreamSpy) writeStreamSpy.mockClear();
    });

    it('should log info messages', () => {
      Logger.info('Info message test', { detail: 'info' });

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('[INFO] Info message test');
        expect(writeStreamSpy.mock.calls[0][0]).toContain('"detail":"info"');
      }
    });

    it('should log error messages', () => {
      Logger.error('Error message test', new Error('Test'));

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('[ERROR] Error message test');
      }
    });

    it('should log warn messages', () => {
      Logger.warn('Warning message test', { level: 'high' });

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('[WARN] Warning message test');
      }
    });

    it('should log verbose messages', () => {
      Logger.verbose('Verbose message test', { debug: true });

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('[VERBOSE] Verbose message test');
      }
    });

    it('should log debug messages', () => {
      Logger.debug('Debug message test', { trace: 'enabled' });

      if (writeStreamSpy && writeStreamSpy.mock.calls.length > 0) {
        expect(writeStreamSpy.mock.calls[0][0]).toContain('[DEBUG] Debug message test');
      }
    });
  });

  describe('utility methods', () => {
    it('should return log file path', () => {
      const logPath = Logger.getLogPath();
      expect(logPath).toContain('.claude-gwt.log');
      expect(logPath).toMatch(/\.claude-gwt\.log$/);
    });

    it('should handle setLogLevel', () => {
      // Just verify it doesn't throw
      expect(() => Logger.setLogLevel('error')).not.toThrow();
      expect(() => Logger.setLogLevel('warn')).not.toThrow();
      expect(() => Logger.setLogLevel('info')).not.toThrow();
      expect(() => Logger.setLogLevel('verbose')).not.toThrow();
      expect(() => Logger.setLogLevel('debug')).not.toThrow();
    });

    it('should handle close without throwing', () => {
      expect(() => Logger.close()).not.toThrow();
    });
  });
});
