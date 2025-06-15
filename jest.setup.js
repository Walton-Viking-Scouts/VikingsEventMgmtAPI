// Jest setup file for common test configurations

// Increase timeout for API tests
jest.setTimeout(15000);

// Mock console.log/warn/error to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep error for debugging
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global cleanup
afterAll(() => {
  // Clear any remaining timers
  jest.clearAllTimers();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  mockReq: (overrides = {}) => ({
    body: {},
    query: {},
    params: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  }),

  // Helper to create mock response objects
  mockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };
    return res;
  },

  // Helper for async test delays
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};