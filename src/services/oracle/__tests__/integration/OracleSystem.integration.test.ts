/**
 * Oracle System Integration Tests
 * End-to-end testing of the complete oracle system
 */

import { OracleRouter } from '../../OracleRouter';
import { ChatbotManager } from '../../chatbot/ChatbotManager';
import { OracleConsensusService } from '../../OracleConsensusService';
import { HederaOracleLogger } from '../../HederaOracleLogger';
import { ConsensusMethod } from '../../../../types/oracle';
import { 
  MockOracleProvider, 
  MockHederaClient,
  setupTestEnvironment,
  cleanupTestEnvironment,
  waitFor,
  withTimeout
} from '../utils/testUtils';

describe('Oracle System Integration Tests', () => {
  let oracleRouter: OracleRouter;
  let chatbotManager: ChatbotManager;
  let mockProviders: MockOracleProvider[];
  let testEnv: any;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();
    mockProviders = testEnv.providers;

    const config = {
      consensus: {
        default_method: ConsensusMethod.MEDIAN,
        min_responses: 2,
        max_response_time: 5000,
        outlier_threshold: 0.3
      },
      providers: {
        'mock-provider-0': { enabled: true, weight: 0.7, config: {} },
        'mock-provider-1': { enabled: true, weight: 0.8, config: {} },
        'mock-provider-2': { enabled: true, weight: 0.9, config: {} }
      },
      chatbot: {
        discord: { enabled: false, token: '', channels: [] },
        slack: { enabled: false, token: '', channels: [] },
        telegram: { enabled: false, token: '', channels: [] }
      },
      cache: { enabled: true, ttl: 30000, max_size: 100 },
      hcs: { enabled: false, topic_id: '', batch_size: 5 }
    };

    oracleRouter = new OracleRouter(config);
    
    // Register mock providers
    mockProviders.forEach(provider => {
      oracleRouter.registerProvider(provider);
    });

    chatbotManager = new ChatbotManager(oracleRouter, config);
  });

  afterEach(async () => {
    await oracleRouter.close();
    await chatbotManager.close();
    await cleanupTestEnvironment();
  });

  describe('End-to-End Oracle Queries', () => {
    it('should process complete price query workflow', async () => {
      // Set different prices for consensus testing
      mockProviders[0].setResponseData({ price: 42000, symbol: 'BTC' });
      mockProviders[1].setResponseData({ price: 42100, symbol: 'BTC' });
      mockProviders[2].setResponseData({ price: 42200, symbol: 'BTC' });

      const result = await withTimeout(
        oracleRouter.query('Bitcoin price', {
          consensusMethod: ConsensusMethod.MEDIAN,
          timeout: 3000
        })
      );

      expect(result).toMatchObject({
        value: expect.objectContaining({
          price: 42100 // Median of 42000, 42100, 42200
        }),
        confidence: expect.any(Number),
        method: ConsensusMethod.MEDIAN,
        sources: ['mock-provider-0', 'mock-provider-1', 'mock-provider-2']
      });

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.raw_responses).toHaveLength(3);
    });

    it('should handle provider failures gracefully', async () => {
      // Make one provider fail
      mockProviders[0].setFailure(true);
      mockProviders[1].setResponseData({ price: 42100 });
      mockProviders[2].setResponseData({ price: 42200 });

      const result = await withTimeout(
        oracleRouter.query('BTC price')
      );

      expect(result.sources).toHaveLength(2);
      expect(result.sources).not.toContain('mock-provider-0');
      expect(result.value.price).toBeCloseTo(42150, 0); // Median of 42100, 42200
    });

    it('should apply different consensus methods correctly', async () => {
      mockProviders[0].setResponseData({ price: 40000 });
      mockProviders[1].setResponseData({ price: 42000 });
      mockProviders[2].setResponseData({ price: 44000 });

      // Test median
      const medianResult = await oracleRouter.query('BTC price', {
        consensusMethod: ConsensusMethod.MEDIAN
      });
      expect(medianResult.value.price).toBe(42000);

      // Test weighted average
      const weightedResult = await oracleRouter.query('BTC price', {
        consensusMethod: ConsensusMethod.WEIGHTED_AVERAGE
      });
      
      // Expected: (40000*0.7 + 42000*0.8 + 44000*0.9) / (0.7+0.8+0.9)
      const expectedWeighted = (40000*0.7 + 42000*0.8 + 44000*0.9) / 2.4;
      expect(weightedResult.value.price).toBeCloseTo(expectedWeighted, 0);
    });

    it('should handle timeout scenarios', async () => {
      // Make one provider very slow
      mockProviders[0].setDelay(5000);
      mockProviders[1].setResponseData({ price: 42100 });
      mockProviders[2].setResponseData({ price: 42200 });

      const result = await oracleRouter.query('BTC price', {
        timeout: 1000 // 1 second timeout
      });

      // Should complete with 2 providers (excluding the slow one)
      expect(result.sources).toHaveLength(2);
      expect(result.sources).not.toContain('mock-provider-0');
    });
  });

  describe('Natural Language Processing', () => {
    it('should understand various price query formats', async () => {
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
      });

      const queries = [
        'Bitcoin price',
        'What is BTC worth?',
        'How much does Bitcoin cost?',
        'BTC price please',
        'Give me Bitcoin value'
      ];

      for (const query of queries) {
        const result = await oracleRouter.query(query);
        expect(result.value).toMatchObject({
          price: expect.any(Number)
        });
      }
    });

    it('should handle weather queries', async () => {
      mockProviders.forEach(provider => {
        provider.setResponseData({
          location: 'London',
          temperature: 15,
          humidity: 65,
          weather_description: 'cloudy'
        });
      });

      const queries = [
        'weather in London',
        'London weather',
        'What is the temperature in London?',
        'How is the weather in London?'
      ];

      for (const query of queries) {
        const result = await oracleRouter.query(query);
        expect(result.value).toMatchObject({
          location: 'London',
          temperature: expect.any(Number)
        });
      }
    });
  });

  describe('Caching System', () => {
    it('should cache repeated queries', async () => {
      mockProviders[0].setResponseData({ price: 42000 });

      // First query
      const result1 = await oracleRouter.query('BTC price');
      
      // Reset providers to return different data
      mockProviders[0].setResponseData({ price: 50000 });
      
      // Second query should return cached result
      const result2 = await oracleRouter.query('BTC price', {
        cacheTime: 30000
      });

      expect(result1.value.price).toBe(result2.value.price);
    });

    it('should respect cache TTL', async () => {
      mockProviders[0].setResponseData({ price: 42000 });

      // First query
      await oracleRouter.query('BTC price');
      
      // Change provider data
      mockProviders[0].setResponseData({ price: 50000 });
      
      // Query with very short cache time should get fresh data
      const result = await oracleRouter.query('BTC price', {
        cacheTime: 1
      });

      await waitFor(5); // Wait for cache to expire
      
      const freshResult = await oracleRouter.query('BTC price', {
        cacheTime: 1
      });
      
      expect(freshResult.value.price).toBe(50000);
    });
  });

  describe('Health Monitoring', () => {
    it('should track provider health over time', async () => {
      // Initial health check
      const healthStatus1 = await oracleRouter.healthCheckAll();
      expect(Array.from(healthStatus1.values())).toEqual([true, true, true]);

      // Make one provider unhealthy
      mockProviders[1].setFailure(true);

      const healthStatus2 = await oracleRouter.healthCheckAll();
      expect(healthStatus2.get('mock-provider-0')).toBe(true);
      expect(healthStatus2.get('mock-provider-1')).toBe(false);
      expect(healthStatus2.get('mock-provider-2')).toBe(true);

      // Restore provider
      mockProviders[1].setFailure(false);

      const healthStatus3 = await oracleRouter.healthCheckAll();
      expect(Array.from(healthStatus3.values())).toEqual([true, true, true]);
    });

    it('should generate comprehensive system statistics', async () => {
      // Perform some queries to generate metrics
      await oracleRouter.query('BTC price');
      await oracleRouter.query('ETH price');
      
      const stats = await oracleRouter.getSystemStats();

      expect(stats).toMatchObject({
        total_providers: 3,
        active_providers: 3,
        provider_details: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            healthy: expect.any(Boolean),
            weight: expect.any(Number),
            reliability: expect.any(Number),
            metrics: expect.objectContaining({
              totalQueries: expect.any(Number),
              successfulQueries: expect.any(Number),
              averageLatency: expect.any(Number)
            })
          })
        ]),
        system_health: expect.any(Number)
      });

      expect(stats.system_health).toBeGreaterThan(0.9);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy price API', async () => {
      mockProviders[0].setResponseData({ price: 42000 });

      const result = await oracleRouter.getPrice('BTC');

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          symbol: 'BTC',
          price: expect.any(Number),
          confidence: expect.any(Number)
        })
      });
    });

    it('should support legacy weather API', async () => {
      mockProviders[0].setResponseData({
        location: 'London',
        temperature: 15,
        humidity: 65,
        description: 'cloudy'
      });

      const result = await oracleRouter.getWeather('London');

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          location: 'London',
          temperature: 15,
          humidity: 65
        })
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary provider failures', async () => {
      // All providers working
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
      });

      const result1 = await oracleRouter.query('BTC price');
      expect(result1.sources).toHaveLength(3);

      // Simulate network issues
      mockProviders.forEach(provider => provider.setFailure(true));

      try {
        await oracleRouter.query('BTC price');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Recovery
      mockProviders.forEach(provider => provider.setFailure(false));

      const result2 = await oracleRouter.query('BTC price');
      expect(result2.sources).toHaveLength(3);
    });

    it('should handle partial provider recovery', async () => {
      // Make all providers fail
      mockProviders.forEach(provider => provider.setFailure(true));

      // Gradually restore providers
      mockProviders[0].setFailure(false);
      mockProviders[0].setResponseData({ price: 42000 });

      try {
        await oracleRouter.query('BTC price');
        fail('Should need minimum responses');
      } catch (error) {
        expect((error as any).message).toContain('Insufficient valid responses');
      }

      // Restore second provider
      mockProviders[1].setFailure(false);
      mockProviders[1].setResponseData({ price: 42100 });

      const result = await oracleRouter.query('BTC price');
      expect(result.sources).toHaveLength(2);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent queries efficiently', async () => {
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
        provider.setDelay(100); // Add some latency
      });

      const startTime = Date.now();
      
      // Execute 10 concurrent queries
      const promises = Array(10).fill(0).map((_, i) => 
        oracleRouter.query(`Query ${i} BTC price`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(r => r.sources.length === 3)).toBe(true);
      
      // Should complete in reasonable time (parallel execution)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle burst requests without degradation', async () => {
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
      });

      const batchSizes = [5, 10, 15];
      const results = [];

      for (const batchSize of batchSizes) {
        const startTime = Date.now();
        
        const promises = Array(batchSize).fill(0).map((_, i) => 
          oracleRouter.query(`Batch ${batchSize} Query ${i}`)
        );

        await Promise.all(promises);
        const endTime = Date.now();
        
        results.push({
          batchSize,
          duration: endTime - startTime,
          avgPerQuery: (endTime - startTime) / batchSize
        });
      }

      // Performance should not degrade significantly with batch size
      expect(results[2].avgPerQuery).toBeLessThan(results[0].avgPerQuery * 2);
    });
  });

  describe('Source Selection and Filtering', () => {
    it('should properly filter sources based on request', async () => {
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
      });

      const result = await oracleRouter.query('BTC price', {
        sources: ['mock-provider-0', 'mock-provider-2']
      });

      expect(result.sources).toHaveLength(2);
      expect(result.sources).toContain('mock-provider-0');
      expect(result.sources).toContain('mock-provider-2');
      expect(result.sources).not.toContain('mock-provider-1');
    });

    it('should handle invalid source names gracefully', async () => {
      mockProviders[0].setResponseData({ price: 42000 });

      const result = await oracleRouter.query('BTC price', {
        sources: ['mock-provider-0', 'invalid-provider', 'another-invalid']
      });

      expect(result.sources).toHaveLength(1);
      expect(result.sources).toContain('mock-provider-0');
    });
  });
});