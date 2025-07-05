// Mock logger for tests
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  success: jest.fn(),
  failure: jest.fn(),
  progress: jest.fn(),
  milestone: jest.fn(),
  time: jest.fn(() => jest.fn()),
  forGitOperation: jest.fn(() => mockLogger),
  forWorktree: jest.fn(() => mockLogger),
  forSession: jest.fn(() => mockLogger),
  isLevelEnabled: jest.fn(() => true),
  flush: jest.fn(),
  bind: jest.fn(() => mockLogger),
  child: jest.fn(() => mockLogger),
  setLogLevel: jest.fn(),
  getLogPath: jest.fn(() => '/tmp/test.log'),
  close: jest.fn(),
};

module.exports = {
  Logger: mockLogger,
  logger: mockLogger,
  createLogger: jest.fn(() => mockLogger),
  StructuredLogger: jest.fn(() => mockLogger),
};