// Global test setup
import { jest } from '@jest/globals';

// Set NODE_ENV to test to ensure proper logger initialization
process.env['NODE_ENV'] = 'test';

// Set test timeout
jest.setTimeout(20000);

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
