// Mock logger for tests
import { vi } from 'vitest';

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  verbose: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  progress: vi.fn(),
  milestone: vi.fn(),
  time: vi.fn(() => vi.fn()),
  forGitOperation: vi.fn(() => mockLogger),
  forWorktree: vi.fn(() => mockLogger),
  forSession: vi.fn(() => mockLogger),
  isLevelEnabled: vi.fn(() => true),
  flush: vi.fn(),
  bind: vi.fn(() => mockLogger),
  child: vi.fn(() => mockLogger),
  setLogLevel: vi.fn(),
  getLogPath: vi.fn(() => '/tmp/test.log'),
  close: vi.fn(),
};

export const Logger = mockLogger;
export const logger = mockLogger;
export const createLogger = vi.fn(() => mockLogger);
export const StructuredLogger = vi.fn(() => mockLogger);
