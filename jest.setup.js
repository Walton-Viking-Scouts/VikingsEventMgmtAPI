// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};