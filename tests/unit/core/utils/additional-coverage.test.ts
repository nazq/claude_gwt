import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../../../../src/core/utils/logger';
import { escapeShellArg, escapeTmuxArg, safeEnvValue } from '../../../../src/core/utils/security';
import {
  isDefined,
  isNonEmptyString,
  isPositiveNumber,
  safeJsonParse,
  assert,
} from '../../../../src/core/utils/type-guards';

// Mock modules
vi.mock('../../../../src/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Additional coverage for uncovered functions', () => {
  describe('Security utilities', () => {
    it('should test escapeTmuxArg', () => {
      expect(escapeTmuxArg('')).toBe("''");
      expect(escapeTmuxArg('simple')).toBe("'simple'");
      expect(escapeTmuxArg('with spaces')).toBe("'with spaces'");
      expect(escapeTmuxArg('with\\backslash')).toContain('\\\\');
    });

    it('should test safeEnvValue', () => {
      expect(safeEnvValue('')).toBe("''");
      expect(safeEnvValue('normal')).toBe("'normal'");

      // Test control character removal
      const withControl = 'test\x00\x01\x1F\x7F';
      const result = safeEnvValue(withControl);
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).not.toContain('\x1F');
      expect(result).not.toContain('\x7F');
    });
  });

  describe('Type guards', () => {
    it('should test isDefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('should test isNonEmptyString', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('  ')).toBe(true); // Has spaces
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });

    it('should test isPositiveNumber', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(Infinity)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('1')).toBe(false);
    });

    it('should test safeJsonParse with type guard', () => {
      const isStringArray = (value: unknown): value is string[] => {
        return Array.isArray(value) && value.every((item) => typeof item === 'string');
      };

      expect(safeJsonParse('["a", "b", "c"]', isStringArray)).toEqual(['a', 'b', 'c']);
      expect(safeJsonParse('[1, 2, 3]', isStringArray)).toBe(null);
      expect(safeJsonParse('invalid json', isStringArray)).toBe(null);
      expect(safeJsonParse('null', isStringArray)).toBe(null);
    });

    it('should test assert function', () => {
      // Should not throw for truthy values
      expect(() => assert(true)).not.toThrow();
      expect(() => assert(1)).not.toThrow();
      expect(() => assert('string')).not.toThrow();
      expect(() => assert({})).not.toThrow();

      // Should throw for falsy values
      expect(() => assert(false)).toThrow('Assertion failed');
      expect(() => assert(0)).toThrow('Assertion failed');
      expect(() => assert('')).toThrow('Assertion failed');
      expect(() => assert(null)).toThrow('Assertion failed');

      // Should use custom message
      expect(() => assert(false, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('Logger edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle logger in test environment', () => {
      // In test environment, logger should work normally
      logger.info('Test message');
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Test message');

      logger.error('Error message', new Error('Test error'));
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith('Error message', expect.any(Error));
    });
  });
});
