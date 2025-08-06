import { OracleProvider, OracleNode, PriceData, WeatherData, OracleResponse, AggregatedData } from '../interfaces/OracleProvider';
import { CoinGeckoProvider } from './oracles/coinGeckoProvider';
import { WeatherProvider } from './oracles/weatherProvider';
import { oracleContractService } from './blockchain/oracleContractService';
import { hcsService } from './hcsService';

/**
 * Oracle Manager Service
 * Manages multiple oracle providers and aggregates data
 */
export class OracleManager {
  private providers: Map<string, OracleNode> = new Map();
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor() {
    this.setupDefaultProviders();
  }

  /**
   * Initialize oracle manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔧 Initializing Oracle Manager...');

      // Health check all providers
      await this.performHealthChecks();

      // Start periodic health checks (every 5 minutes)
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks();
      }, 5 * 60 * 1000);

      this.isInitialized = true;
      console.log('✅ Oracle Manager initialized successfully');
      console.log(`📊 Active providers: ${this.getActiveProviders().length}`);

    } catch (error: any) {
      console.error('❌ Failed to initialize Oracle Manager:', error.message);
      throw error;
    }
  }

  /**
   * Setup default oracle providers
   */
  private setupDefaultProviders(): void {
    // Add CoinGecko provider
    const coinGeckoProvider = new CoinGeckoProvider();
    const coinGeckoNode: OracleNode = {
      id: 'coingecko-1',
      provider: coinGeckoProvider,
      status: 'active',
      lastHealthCheck: new Date(),
      totalRequests: 0,
      successRate: 1.0,
      avgResponseTime: 0,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        lastUpdate: null
      }
    };
    this.providers.set(coinGeckoNode.id, coinGeckoNode);

    // Add Weather provider
    const weatherProvider = new WeatherProvider();
    const weatherNode: OracleNode = {
      id: 'weather-1',
      provider: weatherProvider,
      status: 'active',
      lastHealthCheck: new Date(),
      totalRequests: 0,
      successRate: 1.0,
      avgResponseTime: 0,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        lastUpdate: null
      }
    };
    this.providers.set(weatherNode.id, weatherNode);

    console.log(`📡 Setup ${this.providers.size} default oracle providers`);
  }

  /**
   * Add new oracle provider
   */
  addProvider(id: string, provider: OracleProvider): void {
    const node: OracleNode = {
      id,
      provider,
      status: 'active',
      lastHealthCheck: new Date(),
      totalRequests: 0,
      successRate: 1.0,
      avgResponseTime: 0,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        lastUpdate: null
      }
    };
    
    this.providers.set(id, node);
    console.log(`➕ Added oracle provider: ${id}`);
  }

  /**
   * Get aggregated price from multiple providers
   */
  async getAggregatedPrice(symbol: string): Promise<AggregatedData<PriceData>> {
    const startTime = Date.now();
    console.log(`💰 Getting aggregated price for ${symbol}`);

    // Get price from all active providers
    const priceRequests = this.getActiveProviders()
      .filter(node => node.provider.getSupportedSymbols().includes(symbol.toUpperCase()))
      .map(async (node) => {
        try {
          const result = await node.provider.fetchPrice(symbol);
          this.updateNodeStats(node.id, result.success, result.executionTime);
          return result;
        } catch (error) {
          this.updateNodeStats(node.id, false, Date.now() - startTime);
          return null;
        }
      });

    const responses = await Promise.all(priceRequests);
    const validResponses = responses.filter(r => r && r.success) as OracleResponse<PriceData>[];

    if (validResponses.length === 0) {
      throw new Error(`No valid price data found for ${symbol}`);
    }

    // Calculate aggregated price (weighted median)
    const prices = validResponses.map(r => r.data!.price);
    const weights = validResponses.map(r => this.getProviderWeight(r.source));
    
    const aggregatedPrice = this.calculateWeightedMedian(prices, weights);
    const consensus = validResponses.length / Math.max(priceRequests.length, 1);

    const aggregatedData: AggregatedData<PriceData> = {
      data: {
        symbol: symbol.toUpperCase(),
        price: aggregatedPrice,
        timestamp: Date.now(),
        source: 'Oracle Manager',
        confidence: consensus
      },
      sources: validResponses.map(r => r.source),
      consensus,
      timestamp: Date.now(),
      method: 'weighted'
    };

    console.log(`✅ Aggregated ${symbol}: $${aggregatedPrice} from ${validResponses.length} sources`);

    // Log to HCS
    await this.logAggregation(aggregatedData);

    // Update smart contract if available
    try {
      await oracleContractService.updateContractPrice({
        symbol: symbol.toUpperCase(),
        price: aggregatedPrice,
        timestamp: Date.now(),
        source: 'Oracle Manager'
      });
    } catch (error) {
      console.log('⚠️ Could not update smart contract:', error);
    }

    return aggregatedData;
  }

  /**
   * Get weather data from weather providers
   */
  async getWeatherData(location: string): Promise<AggregatedData<WeatherData>> {
    console.log(`🌤️ Getting weather data for ${location}`);

    const weatherProviders = this.getActiveProviders()
      .filter(node => node.provider.fetchWeather);

    if (weatherProviders.length === 0) {
      throw new Error('No weather providers available');
    }

    const weatherRequests = weatherProviders.map(async (node) => {
      try {
        const result = await node.provider.fetchWeather!(location);
        this.updateNodeStats(node.id, result.success, result.executionTime);
        return result;
      } catch (error) {
        this.updateNodeStats(node.id, false, 0);
        return null;
      }
    });

    const responses = await Promise.all(weatherRequests);
    const validResponses = responses.filter(r => r && r.success) as OracleResponse<WeatherData>[];

    if (validResponses.length === 0) {
      throw new Error(`No valid weather data found for ${location}`);
    }

    // Use first valid response (can be enhanced with aggregation)
    const weatherData = validResponses[0].data!;
    const consensus = validResponses.length / weatherProviders.length;

    const aggregatedData: AggregatedData<WeatherData> = {
      data: weatherData,
      sources: validResponses.map(r => r.source),
      consensus,
      timestamp: Date.now(),
      method: 'majority'
    };

    console.log(`✅ Weather for ${location}: ${weatherData.temperature}°C`);

    // Log to HCS
    await this.logAggregation(aggregatedData);

    return aggregatedData;
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing health checks...');

    for (const [id, node] of this.providers) {
      try {
        const isHealthy = await node.provider.healthCheck();
        node.status = isHealthy ? 'active' : 'error';
        node.lastHealthCheck = new Date();
        
        if (!isHealthy) {
          console.log(`⚠️ Provider ${id} health check failed`);
        }
      } catch (error) {
        node.status = 'error';
        console.log(`❌ Health check error for ${id}:`, error);
      }
    }
  }

  /**
   * Update node statistics
   */
  private updateNodeStats(nodeId: string, success: boolean, responseTime: number): void {
    const node = this.providers.get(nodeId);
    if (!node) return;

    // Update both legacy and new stats
    node.totalRequests++;
    node.avgResponseTime = (node.avgResponseTime + responseTime) / 2;
    
    node.stats.totalRequests++;
    if (success) {
      node.stats.successfulRequests++;
    }
    node.stats.avgResponseTime = (node.stats.avgResponseTime + responseTime) / 2;
    node.stats.lastUpdate = new Date();
    
    // Recalculate success rate
    const successCount = Math.floor(node.successRate * (node.totalRequests - 1)) + (success ? 1 : 0);
    node.successRate = successCount / node.totalRequests;
  }

  /**
   * Get provider weight based on reliability and success rate
   */
  private getProviderWeight(source: string): number {
    for (const node of this.providers.values()) {
      if (node.provider.name === source) {
        return node.provider.reliability * node.successRate;
      }
    }
    return 50; // Default weight
  }

  /**
   * Calculate weighted median
   */
  private calculateWeightedMedian(values: number[], weights: number[]): number {
    if (values.length === 1) return values[0];
    
    // Simple weighted average for now (can be enhanced to true weighted median)
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedSum = values.reduce((sum, val, i) => sum + (val * weights[i]), 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * Get active providers
   */
  getActiveProviders(): OracleNode[] {
    return Array.from(this.providers.values()).filter(node => node.status === 'active');
  }

  /**
   * Get all providers with stats
   */
  getAllProviders(): OracleNode[] {
    return Array.from(this.providers.values());
  }

  /**
   * Log aggregation to HCS
   */
  private async logAggregation(data: AggregatedData<any>): Promise<void> {
    try {
      await hcsService.logOracleQuery({
        queryId: `aggregation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        inputPrompt: `Aggregate data: ${JSON.stringify(data.data).substring(0, 50)}...`,
        aiResponse: `Aggregated from ${data.sources.length} sources with ${(data.consensus * 100).toFixed(1)}% consensus`,
        model: 'oracle_aggregation',
        provider: 'Oracle Manager',
        cost: 0,
        executionTime: 100,
        success: true
      });
    } catch (error) {
      console.log('⚠️ Failed to log aggregation to HCS:', error);
    }
  }

  /**
   * Check if manager is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.getActiveProviders().length > 0;
  }

  /**
   * Get start time for uptime calculations
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const oracleManager = new OracleManager();