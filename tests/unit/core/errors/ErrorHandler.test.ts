import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProductionErrorHandler,
  TestErrorHandler,
} from '../../../../src/core/errors/ErrorHandler.js';

describe('ErrorHandler', () => {
  describe('ProductionErrorHandler', () => {
    let handler: ProductionErrorHandler;
    let consoleErrorSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
      handler = new ProductionErrorHandler();
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    describe('formatError', () => {
      it('should format Error objects', () => {
        const error = new Error('Test error message');
        expect(handler.formatError(error)).toBe('Test error message');
      });

      it('should format string errors', () => {
        expect(handler.formatError('String error')).toBe('String error');
      });

      it('should format null as Unknown error', () => {
        expect(handler.formatError(null)).toBe('Unknown error');
      });

      it('should format undefined as Unknown error', () => {
        expect(handler.formatError(undefined)).toBe('Unknown error');
      });

      it('should format objects using String()', () => {
        expect(handler.formatError({ code: 'ERR_001' })).toBe('[object Object]');
        expect(handler.formatError(123)).toBe('123');
        expect(handler.formatError(true)).toBe('true');
      });
    });

    describe('handleError', () => {
      it('should log error without context', () => {
        handler.handleError(new Error('Test error'));

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Test error');
      });

      it('should log error with context', () => {
        handler.handleError(new Error('Test error'), 'TestContext');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in TestContext:', 'Test error');
      });

      it('should handle non-Error objects', () => {
        handler.handleError('String error', 'TestContext');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in TestContext:', 'String error');
      });
    });

    describe('handleFatalError', () => {
      it('should log and exit without context', () => {
        expect(() => handler.handleFatalError(new Error('Fatal error'))).toThrow(
          'process.exit called',
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('\n✖ Error:', 'Fatal error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('\nCheck logs at: .claude-gwt.log');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should log and exit with context', () => {
        expect(() => handler.handleFatalError(new Error('Fatal error'), 'TestContext')).toThrow(
          'process.exit called',
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('\n✖ Error in TestContext:', 'Fatal error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('\nCheck logs at: .claude-gwt.log');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle non-Error objects', () => {
        expect(() => handler.handleFatalError('String fatal error')).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('\n✖ Error:', 'String fatal error');
      });

      it('should handle null/undefined', () => {
        expect(() => handler.handleFatalError(null)).toThrow('process.exit called');

        expect(consoleErrorSpy).toHaveBeenCalledWith('\n✖ Error:', 'Unknown error');
      });
    });
  });

  describe('TestErrorHandler', () => {
    let handler: TestErrorHandler;

    beforeEach(() => {
      handler = new TestErrorHandler();
    });

    describe('formatError', () => {
      it('should format errors the same as production', () => {
        expect(handler.formatError(new Error('Test'))).toBe('Test');
        expect(handler.formatError('String')).toBe('String');
        expect(handler.formatError(null)).toBe('Unknown error');
        expect(handler.formatError(undefined)).toBe('Unknown error');
        expect(handler.formatError(123)).toBe('123');
      });
    });

    describe('handleError', () => {
      it('should record errors without throwing', () => {
        const error = new Error('Test error');
        handler.handleError(error, 'TestContext');

        expect(handler.errors).toHaveLength(1);
        expect(handler.errors[0]).toEqual({ error, context: 'TestContext' });
      });

      it('should record multiple errors', () => {
        handler.handleError('Error 1');
        handler.handleError('Error 2', 'Context2');

        expect(handler.errors).toHaveLength(2);
        expect(handler.errors[0]).toEqual({ error: 'Error 1', context: undefined });
        expect(handler.errors[1]).toEqual({ error: 'Error 2', context: 'Context2' });
      });
    });

    describe('handleFatalError', () => {
      it('should record error and throw', () => {
        const error = new Error('Fatal test error');

        expect(() => handler.handleFatalError(error, 'TestContext')).toThrow(
          'Fatal error: Fatal test error',
        );

        expect(handler.errors).toHaveLength(1);
        expect(handler.errors[0]).toEqual({ error, context: 'TestContext' });
      });

      it('should format non-Error objects in thrown error', () => {
        expect(() => handler.handleFatalError('String error')).toThrow('Fatal error: String error');
        expect(() => handler.handleFatalError(null)).toThrow('Fatal error: Unknown error');
        expect(() => handler.handleFatalError({ code: 123 })).toThrow(
          'Fatal error: [object Object]',
        );
      });
    });
  });
});
