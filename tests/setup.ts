// Global test setup
import { vi } from 'vitest';

// Set NODE_ENV to test to ensure proper logger initialization
process.env['NODE_ENV'] = 'test';

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
