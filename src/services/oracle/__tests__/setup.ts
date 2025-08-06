/**
 * Jest Test Setup
 * Global test configuration and mocks
 */

// Global test timeout
jest.setTimeout(10000);

// Mock global fetch
global.fetch = jest.fn();

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Only show errors in test output
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = originalConsoleError;
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock environment variables
  mockEnv: (env: Record<string, string>) => {
    const originalEnv = { ...process.env };
    Object.assign(process.env, env);
    return () => {
      process.env = originalEnv;
    };
  },

  // Generate random test data
  randomString: (length: number = 10) => {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  randomNumber: (min: number = 0, max: number = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

// Mock external dependencies
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    })),
    forMainnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    }))
  },
  TopicId: {
    fromString: jest.fn((id: string) => ({ toString: () => id }))
  },
  TopicCreateTransaction: jest.fn(() => ({
    setTopicMemo: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSubmitKey: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      getReceipt: jest.fn().mockResolvedValue({
        status: { toString: () => 'SUCCESS' },
        topicId: { toString: () => 'mock-topic-id' }
      })
    })
  })),
  TopicMessageSubmitTransaction: jest.fn(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    setMessage: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      transactionId: { toString: () => 'mock-transaction-id' },
      getReceipt: jest.fn().mockResolvedValue({
        status: { toString: () => 'SUCCESS' }
      })
    })
  })),
  Status: {
    Success: { toString: () => 'SUCCESS' }
  }
}));

// Mock Discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    login: jest.fn().mockResolvedValue('mock-token'),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    channels: {
      fetch: jest.fn().mockResolvedValue({
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({ id: 'mock-message-id' })
      })
    },
    guilds: {
      cache: { size: 1 }
    },
    user: { tag: 'MockBot#1234' },
    uptime: 12345
  })),
  GatewayIntentBits: {
    Guilds: 1 << 0,
    GuildMessages: 1 << 9,
    MessageContent: 1 << 15
  },
  SlashCommandBuilder: jest.fn(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({})
  })),
  EmbedBuilder: jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis()
  })),
  REST: jest.fn(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue([])
  })),
  Routes: {
    applicationCommands: jest.fn((id: string) => `/applications/${id}/commands`)
  }
}));

// Mock axios for HTTP requests
jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ data: {} }),
      post: jest.fn().mockResolvedValue({ data: {} })
    })),
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    isAxiosError: jest.fn(() => false)
  }
}));

// Mock cheerio for web scraping
jest.mock('cheerio', () => ({
  load: jest.fn(() => ({
    'selector': {
      each: jest.fn(),
      text: jest.fn(() => 'mock text'),
      length: 1
    }
  }))
}));

// Global cleanup after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset timers
  jest.useRealTimers();
  
  // Clear any global state
  if (global.rateLimitMap) {
    global.rateLimitMap.clear();
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeApproximately(received: number, expected: number, tolerance: number = 0.01) {
    const diff = Math.abs(received - expected);
    const maxDiff = Math.abs(expected * tolerance);
    const pass = diff <= maxDiff;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be approximately ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be approximately ${expected} (±${tolerance * 100}%), but difference was ${diff}`,
        pass: false,
      };
    }
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeApproximately(expected: number, tolerance?: number): R;
    }
  }
}