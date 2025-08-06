/**
 * CoinGecko Oracle Adapter Tests
 */

import { CoinGeckoOracleAdapter } from '../../adapters/CoinGeckoOracleAdapter';
import { OracleError } from '../../../../types/oracle';

// Mock fetch globally
global.fetch = jest.fn();

describe('CoinGeckoOracleAdapter', () => {
  let adapter: CoinGeckoOracleAdapter;
  
  beforeEach(() => {
    adapter = new CoinGeckoOracleAdapter();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(adapter.name).toBe('coingecko');
      expect(adapter.weight).toBe(0.9);
      expect(adapter.reliability).toBe(0.95);
      expect(adapter.latency).toBe(800);
    });

    it('should have supported symbols', () => {
      const symbols = adapter.getSupportedSymbols();
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('HBAR');
      expect(symbols.length).toBeGreaterThan(5);
    });
  });

  describe('fetchData', () => {
    it('should fetch BTC price successfully', async () => {
      const mockResponse = {
        bitcoin: {
          usd: 42000,
          usd_market_cap: 800000000000,
          usd_24h_vol: 25000000000,
          usd_24h_change: 2.5,
          last_updated_at: 1700000000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await adapter.fetch('BTC price');

      expect(result.data.symbol).toBe('BTC');
      expect(result.data.price).toBe(42000);
      expect(result.data.market_cap).toBe(800000000000);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.source).toBe('coingecko');
    });

    it('should handle different query formats', async () => {
      const mockResponse = {
        ethereum: {
          usd: 2500,
          last_updated_at: 1700000000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Test different query formats
      const queries = [
        'ETH price',
        'ethereum price',
        'What is ETH worth?',
        'ETH'
      ];

      for (const query of queries) {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

        const result = await adapter.fetch(query);
        expect(result.data.symbol).toBe('ETH');
        expect(result.data.price).toBe(2500);
      }
    });

    it('should throw OracleError for unsupported symbol', async () => {
      await expect(adapter.fetch('INVALID price')).rejects.toThrow(OracleError);
      await expect(adapter.fetch('INVALID price')).rejects.toThrow('Unsupported symbol: INVALID');
    });

    it('should throw OracleError on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(adapter.fetch('BTC price')).rejects.toThrow(OracleError);
      await expect(adapter.fetch('BTC price')).rejects.toThrow('CoinGecko API error');
    });

    it('should throw OracleError when no data found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // Empty response
      });

      await expect(adapter.fetch('BTC price')).rejects.toThrow(OracleError);
      await expect(adapter.fetch('BTC price')).rejects.toThrow('Price data not found');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.fetch('BTC price')).rejects.toThrow(OracleError);
      await expect(adapter.fetch('BTC price')).rejects.toThrow('CoinGecko fetch failed');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate higher confidence for fresh data', () => {
      const freshData = {
        price: 42000,
        last_updated: Date.now(),
        market_cap: 1e9,
        volume_24h: 1e8
      };

      const confidence = adapter['calculateConfidence'](freshData);
      expect(confidence).toBeGreaterThan(0.95);
    });

    it('should reduce confidence for old data', () => {
      const oldData = {
        price: 42000,
        last_updated: Date.now() - (2 * 60 * 60 * 1000), // 2 hours old
        market_cap: 1e9
      };

      const confidence = adapter['calculateConfidence'](oldData);
      expect(confidence).toBeLessThan(0.95);
    });

    it('should reduce confidence for low market cap', () => {
      const lowCapData = {
        price: 0.001,
        last_updated: Date.now(),
        market_cap: 500000 // < $1M
      };

      const confidence = adapter['calculateConfidence'](lowCapData);
      expect(confidence).toBeLessThan(0.95);
    });

    it('should return 0 for invalid data', () => {
      const confidence1 = adapter['calculateConfidence'](null);
      const confidence2 = adapter['calculateConfidence']({});
      const confidence3 = adapter['calculateConfidence']({ price: null });

      expect(confidence1).toBe(0);
      expect(confidence2).toBe(0);
      expect(confidence3).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful ping', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false for failed ping', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Symbol Management', () => {
    it('should get correct coin ID for symbol', () => {
      expect(adapter.getCoinId('BTC')).toBe('bitcoin');
      expect(adapter.getCoinId('ETH')).toBe('ethereum');
      expect(adapter.getCoinId('HBAR')).toBe('hedera-hashgraph');
      expect(adapter.getCoinId('INVALID')).toBeNull();
    });

    it('should add new symbol mapping', () => {
      adapter.addSymbolMapping('TEST', 'test-coin');
      expect(adapter.getCoinId('TEST')).toBe('test-coin');
      expect(adapter.getSupportedSymbols()).toContain('TEST');
    });
  });

  describe('Provider Info', () => {
    it('should return provider information', () => {
      const info = adapter.getProviderInfo();
      
      expect(info.name).toBe('CoinGecko API');
      expect(info.version).toBe('v3');
      expect(info.rateLimit).toBe(50);
      expect(info.features).toContain('Real-time prices');
    });
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      const mockResponse = {
        bitcoin: {
          usd: 42000,
          last_updated_at: 1700000000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // First call
      await adapter.fetch('BTC price');
      
      // Second call should use cache (no new fetch)
      await adapter.fetch('BTC price', { cacheTime: 60000 });
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const mockResponse = {
        bitcoin: {
          usd: 42000,
          last_updated_at: 1700000000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      // First call
      await adapter.fetch('BTC price');
      
      // Second call with very short cache time should fetch again
      await adapter.fetch('BTC price', { cacheTime: 0 });
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(
        adapter.fetch('BTC price', { timeout: 100 })
      ).rejects.toThrow('Timeout');
    }, 1000);

    it('should update metrics on success', async () => {
      const mockResponse = {
        bitcoin: {
          usd: 42000,
          last_updated_at: 1700000000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await adapter.fetch('BTC price');
      
      const metrics = await adapter.getMetrics();
      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.successfulQueries).toBeGreaterThan(0);
      expect(metrics.reliability).toBeGreaterThan(0);
    });

    it('should update metrics on failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      try {
        await adapter.fetch('BTC price');
      } catch (error) {
        // Expected to fail
      }
      
      const metrics = await adapter.getMetrics();
      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.failedQueries).toBeGreaterThan(0);
    });
  });
});