/**
 * Test Utilities for Oracle System
 * Common utilities, mocks, and helpers for testing
 */

import { OracleProvider, OracleResponse, OracleMetrics } from '../../../../types/oracle';

/**
 * Mock Oracle Provider for testing
 */
export class MockOracleProvider implements OracleProvider {
  public readonly name: string;
  public readonly weight: number;
  public readonly reliability: number;
  public readonly latency: number;

  private shouldFail: boolean = false;
  private responseDelay: number = 100;
  private responseData: any = { price: 42000 };

  constructor(
    name: string = 'mock-provider',
    weight: number = 0.8,
    reliability: number = 0.9,
    latency: number = 500
  ) {
    this.name = name;
    this.weight = weight;
    this.reliability = reliability;
    this.latency = latency;
  }

  async fetch(query: string): Promise<OracleResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    if (this.shouldFail) {
      throw new Error(`Mock provider ${this.name} simulated failure`);
    }

    return {
      data: this.responseData,
      confidence: this.reliability,
      timestamp: new Date(),
      source: this.name,
      metadata: {
        query,
        mock: true
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    return !this.shouldFail;
  }

  async getMetrics(): Promise<OracleMetrics> {
    return {
      totalQueries: 100,
      successfulQueries: 95,
      failedQueries: 5,
      averageLatency: this.latency,
      lastHealthCheck: new Date(),
      reliability: this.reliability
    };
  }

  // Test control methods
  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setDelay(delay: number): void {
    this.responseDelay = delay;
  }

  setResponseData(data: any): void {
    this.responseData = data;
  }
}

/**
 * Create multiple mock providers for testing
 */
export function createMockProviders(count: number = 3): MockOracleProvider[] {
  const providers: MockOracleProvider[] = [];
  
  for (let i = 0; i < count; i++) {
    const provider = new MockOracleProvider(
      `mock-provider-${i}`,
      0.7 + (i * 0.1), // Weight: 0.7, 0.8, 0.9
      0.8 + (i * 0.05), // Reliability: 0.8, 0.85, 0.9
      300 + (i * 100)   // Latency: 300, 400, 500
    );
    
    // Set different response data for each provider
    provider.setResponseData({
      price: 42000 + (i * 100), // 42000, 42100, 42200
      symbol: 'BTC',
      source: `mock-${i}`
    });
    
    providers.push(provider);
  }
  
  return providers;
}

/**
 * Mock price data generator
 */
export function generateMockPriceData(symbol: string = 'BTC', basePrice: number = 42000): any {
  const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
  const price = basePrice * (1 + variation);
  
  return {
    symbol: symbol.toUpperCase(),
    price: Math.round(price * 100) / 100,
    market_cap: price * 19000000, // Approximate BTC supply
    volume_24h: Math.random() * 50000000000,
    change_24h: (Math.random() - 0.5) * 10,
    last_updated: Date.now(),
    source: 'mock'
  };
}

/**
 * Mock weather data generator
 */
export function generateMockWeatherData(location: string = 'London'): any {
  const baseTemps: Record<string, number> = {
    'London': 12, 'New York': 8, 'Tokyo': 15,
    'Paris': 11, 'Berlin': 9, 'Sydney': 20
  };

  const baseTemp = baseTemps[location] || 15;
  const variation = (Math.random() - 0.5) * 10;
  const temperature = Math.round((baseTemp + variation) * 10) / 10;

  return {
    location,
    temperature,
    feels_like: temperature + (Math.random() - 0.5) * 3,
    humidity: Math.floor(Math.random() * 40) + 40,
    pressure: Math.floor(Math.random() * 50) + 1000,
    weather_description: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
    timestamp: Date.now()
  };
}

/**
 * Wait for async operations with timeout
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test timeout wrapper
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

/**
 * Assert helper for approximate number equality
 */
export function expectApproximately(actual: number, expected: number, tolerance: number = 0.01): void {
  const diff = Math.abs(actual - expected);
  const maxDiff = Math.abs(expected * tolerance);
  
  if (diff > maxDiff) {
    throw new Error(
      `Expected ${actual} to be approximately ${expected} (±${tolerance * 100}%), ` +
      `but difference was ${diff} (max allowed: ${maxDiff})`
    );
  }
}

/**
 * Mock Hedera client for testing
 */
export class MockHederaClient {
  private messages: Array<{ topicId: string; message: string; timestamp: Date }> = [];

  async submitMessage(topicId: string, message: string): Promise<string> {
    this.messages.push({
      topicId,
      message,
      timestamp: new Date()
    });
    
    return `mock-transaction-${Date.now()}`;
  }

  getMessages(): Array<{ topicId: string; message: string; timestamp: Date }> {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }
}

/**
 * Mock Discord client for testing
 */
export class MockDiscordClient {
  private sentMessages: Array<{ channelId: string; content: any; timestamp: Date }> = [];
  public isReady: boolean = false;

  async sendMessage(channelId: string, content: any): Promise<void> {
    this.sentMessages.push({
      channelId,
      content,
      timestamp: new Date()
    });
  }

  getSentMessages(): Array<{ channelId: string; content: any; timestamp: Date }> {
    return [...this.sentMessages];
  }

  clearMessages(): void {
    this.sentMessages = [];
  }

  simulateReady(): void {
    this.isReady = true;
  }
}

/**
 * Test data constants
 */
export const TEST_CONSTANTS = {
  MOCK_SYMBOLS: ['BTC', 'ETH', 'ADA', 'SOL'],
  MOCK_LOCATIONS: ['London', 'New York', 'Tokyo', 'Paris'],
  MOCK_PRICES: {
    BTC: 42000,
    ETH: 2500,
    ADA: 0.5,
    SOL: 100
  },
  CONSENSUS_METHODS: ['median', 'weighted_average', 'majority_vote', 'confidence_weighted'],
  API_ENDPOINTS: [
    '/api/oracle/query',
    '/api/oracle/price/BTC',
    '/api/oracle/weather/London',
    '/api/oracle/status',
    '/api/oracle/providers'
  ]
};

/**
 * Create test environment setup
 */
export async function setupTestEnvironment(): Promise<{
  providers: MockOracleProvider[];
  hederaClient: MockHederaClient;
  discordClient: MockDiscordClient;
}> {
  const providers = createMockProviders(3);
  const hederaClient = new MockHederaClient();
  const discordClient = new MockDiscordClient();

  return {
    providers,
    hederaClient,
    discordClient
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(): Promise<void> {
  // Reset any global state
  if (global.rateLimitMap) {
    global.rateLimitMap.clear();
  }
  
  // Clear any timers
  jest.clearAllTimers();
}