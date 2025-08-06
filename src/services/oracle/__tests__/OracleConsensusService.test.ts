/**
 * Oracle Consensus Service Tests
 */

import { OracleConsensusService } from '../OracleConsensusService';
import { ConsensusMethod, ConsensusError } from '../../../types/oracle';
import { MockOracleProvider, createMockProviders, expectApproximately } from './utils/testUtils';

describe('OracleConsensusService', () => {
  let consensusService: OracleConsensusService;
  let mockProviders: MockOracleProvider[];

  beforeEach(() => {
    consensusService = new OracleConsensusService({
      defaultMethod: ConsensusMethod.MEDIAN,
      minResponses: 2,
      maxResponseTime: 5000,
      outlierThreshold: 0.3
    });

    mockProviders = createMockProviders(3);
    mockProviders.forEach(provider => {
      consensusService.registerProvider(provider);
    });
  });

  describe('Provider Management', () => {
    it('should register providers correctly', () => {
      const providers = consensusService.getProviders();
      expect(providers).toHaveLength(3);
      expect(providers.map(p => p.name)).toEqual([
        'mock-provider-0',
        'mock-provider-1', 
        'mock-provider-2'
      ]);
    });

    it('should unregister providers', () => {
      consensusService.unregisterProvider('mock-provider-1');
      const providers = consensusService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.name)).not.toContain('mock-provider-1');
    });

    it('should get provider by name', () => {
      const provider = consensusService.getProvider('mock-provider-0');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('mock-provider-0');
    });
  });

  describe('Consensus Algorithms', () => {
    beforeEach(() => {
      // Set different prices for consensus testing
      mockProviders[0].setResponseData({ price: 42000 });
      mockProviders[1].setResponseData({ price: 42100 });
      mockProviders[2].setResponseData({ price: 42200 });
    });

    describe('Median Consensus', () => {
      it('should calculate median for odd number of providers', async () => {
        const result = await consensusService.getConsensus('BTC price', {
          consensusMethod: ConsensusMethod.MEDIAN
        });

        expect(result.method).toBe(ConsensusMethod.MEDIAN);
        expect(result.value).toBe(42100); // Middle value
        expect(result.sources).toHaveLength(3);
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should calculate median for even number of providers', async () => {
        consensusService.unregisterProvider('mock-provider-2');
        
        const result = await consensusService.getConsensus('BTC price', {
          consensusMethod: ConsensusMethod.MEDIAN
        });

        expect(result.value).toBe(42050); // Average of 42000 and 42100
      });
    });

    describe('Weighted Average Consensus', () => {
      it('should calculate weighted average based on provider weights', async () => {
        const result = await consensusService.getConsensus('BTC price', {
          consensusMethod: ConsensusMethod.WEIGHTED_AVERAGE
        });

        expect(result.method).toBe(ConsensusMethod.WEIGHTED_AVERAGE);
        
        // Calculate expected weighted average
        const expectedValue = (
          (42000 * 0.7) + (42100 * 0.8) + (42200 * 0.9)
        ) / (0.7 + 0.8 + 0.9);
        
        expectApproximately(result.value, expectedValue, 0.01);
      });
    });

    describe('Majority Vote Consensus', () => {
      it('should find majority for identical values', async () => {
        mockProviders[0].setResponseData({ value: 'sunny' });
        mockProviders[1].setResponseData({ value: 'sunny' });
        mockProviders[2].setResponseData({ value: 'cloudy' });

        const result = await consensusService.getConsensus('weather', {
          consensusMethod: ConsensusMethod.MAJORITY_VOTE
        });

        expect(result.method).toBe(ConsensusMethod.MAJORITY_VOTE);
        expect(result.value).toBe('sunny');
        expect(result.confidence).toBe(2/3); // 2 out of 3 agreed
      });
    });

    describe('Confidence Weighted Consensus', () => {
      it('should weight by individual response confidence', async () => {
        // Set different reliabilities (confidence)
        mockProviders[0].setResponseData({ price: 42000 });
        mockProviders[1].setResponseData({ price: 42100 });
        mockProviders[2].setResponseData({ price: 42200 });

        const result = await consensusService.getConsensus('BTC price', {
          consensusMethod: ConsensusMethod.CONFIDENCE_WEIGHTED
        });

        expect(result.method).toBe(ConsensusMethod.CONFIDENCE_WEIGHTED);
        expect(result.value).toBeGreaterThan(42000);
        expect(result.value).toBeLessThan(42200);
      });
    });
  });

  describe('Outlier Detection', () => {
    it('should remove statistical outliers', async () => {
      // Set one extreme outlier
      mockProviders[0].setResponseData({ price: 42000 });
      mockProviders[1].setResponseData({ price: 42100 });
      mockProviders[2].setResponseData({ price: 100000 }); // Extreme outlier

      const result = await consensusService.getConsensus('BTC price', {
        consensusMethod: ConsensusMethod.MEDIAN
      });

      // Should exclude the outlier
      expect(result.value).toBeLessThan(50000);
      expect(result.sources).toHaveLength(2); // Outlier removed
    });

    it('should keep all values when no outliers', async () => {
      mockProviders[0].setResponseData({ price: 42000 });
      mockProviders[1].setResponseData({ price: 42100 });
      mockProviders[2].setResponseData({ price: 42200 });

      const result = await consensusService.getConsensus('BTC price');

      expect(result.sources).toHaveLength(3); // All providers included
    });
  });

  describe('Error Handling', () => {
    it('should throw ConsensusError when insufficient providers', async () => {
      // Remove all providers
      consensusService.unregisterProvider('mock-provider-0');
      consensusService.unregisterProvider('mock-provider-1');
      consensusService.unregisterProvider('mock-provider-2');

      await expect(
        consensusService.getConsensus('BTC price')
      ).rejects.toThrow(ConsensusError);
    });

    it('should throw ConsensusError when insufficient valid responses', async () => {
      // Make all providers fail
      mockProviders.forEach(provider => provider.setFailure(true));

      await expect(
        consensusService.getConsensus('BTC price')
      ).rejects.toThrow(ConsensusError);
    });

    it('should handle provider timeouts', async () => {
      // Make one provider very slow
      mockProviders[0].setDelay(10000);

      const result = await consensusService.getConsensus('BTC price', {
        timeout: 1000
      });

      // Should still get consensus from other providers
      expect(result.sources).toHaveLength(2);
    });

    it('should throw error for unsupported consensus method', async () => {
      await expect(
        consensusService.getConsensus('BTC price', {
          consensusMethod: 'invalid_method' as any
        })
      ).rejects.toThrow(ConsensusError);
    });
  });

  describe('Source Filtering', () => {
    it('should use only specified sources', async () => {
      const result = await consensusService.getConsensus('BTC price', {
        sources: ['mock-provider-0', 'mock-provider-1']
      });

      expect(result.sources).toHaveLength(2);
      expect(result.sources).toContain('mock-provider-0');
      expect(result.sources).toContain('mock-provider-1');
      expect(result.sources).not.toContain('mock-provider-2');
    });

    it('should handle invalid source names', async () => {
      const result = await consensusService.getConsensus('BTC price', {
        sources: ['mock-provider-0', 'invalid-provider']
      });

      // Should use only valid providers
      expect(result.sources).toHaveLength(1);
      expect(result.sources).toContain('mock-provider-0');
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on all providers', async () => {
      const healthStatus = await consensusService.healthCheckAll();
      
      expect(healthStatus.size).toBe(3);
      for (const [name, isHealthy] of healthStatus) {
        expect(['mock-provider-0', 'mock-provider-1', 'mock-provider-2']).toContain(name);
        expect(isHealthy).toBe(true);
      }
    });

    it('should detect unhealthy providers', async () => {
      mockProviders[1].setFailure(true);
      
      const healthStatus = await consensusService.healthCheckAll();
      
      expect(healthStatus.get('mock-provider-1')).toBe(false);
      expect(healthStatus.get('mock-provider-0')).toBe(true);
      expect(healthStatus.get('mock-provider-2')).toBe(true);
    });
  });

  describe('Response Metadata', () => {
    it('should include raw responses in result', async () => {
      const result = await consensusService.getConsensus('BTC price');

      expect(result.raw_responses).toHaveLength(3);
      expect(result.raw_responses[0]).toHaveProperty('data');
      expect(result.raw_responses[0]).toHaveProperty('confidence');
      expect(result.raw_responses[0]).toHaveProperty('source');
    });

    it('should include consensus timestamp', async () => {
      const beforeTime = new Date();
      const result = await consensusService.getConsensus('BTC price');
      const afterTime = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Non-numeric Data Handling', () => {
    it('should handle string data with majority vote', async () => {
      mockProviders[0].setResponseData('sunny');
      mockProviders[1].setResponseData('sunny');
      mockProviders[2].setResponseData('cloudy');

      const result = await consensusService.getConsensus('weather', {
        consensusMethod: ConsensusMethod.MEDIAN
      });

      expect(result.value).toBe('sunny');
    });

    it('should handle complex object data', async () => {
      const weatherData1 = { temperature: 20, condition: 'sunny' };
      const weatherData2 = { temperature: 20, condition: 'sunny' };
      const weatherData3 = { temperature: 15, condition: 'cloudy' };

      mockProviders[0].setResponseData(weatherData1);
      mockProviders[1].setResponseData(weatherData2);
      mockProviders[2].setResponseData(weatherData3);

      const result = await consensusService.getConsensus('weather');

      expect(result.value).toEqual(weatherData1);
    });
  });

  describe('Configuration', () => {
    it('should respect minimum responses configuration', async () => {
      const strictConsensus = new OracleConsensusService({
        minResponses: 3
      });
      
      mockProviders.forEach(provider => {
        strictConsensus.registerProvider(provider);
      });

      // Should work with 3 providers
      const result = await strictConsensus.getConsensus('BTC price');
      expect(result.sources).toHaveLength(3);

      // Should fail with only 2 providers
      strictConsensus.unregisterProvider('mock-provider-2');
      await expect(
        strictConsensus.getConsensus('BTC price')
      ).rejects.toThrow(ConsensusError);
    });

    it('should respect outlier threshold configuration', async () => {
      const permissiveConsensus = new OracleConsensusService({
        outlierThreshold: 1.0 // Very permissive
      });

      mockProviders.forEach(provider => {
        permissiveConsensus.registerProvider(provider);
      });

      // Set extreme outlier
      mockProviders[2].setResponseData({ price: 100000 });

      const result = await permissiveConsensus.getConsensus('BTC price');
      
      // Should include all providers (even outlier)
      expect(result.sources).toHaveLength(3);
    });
  });
});