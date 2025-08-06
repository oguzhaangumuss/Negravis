import { 
  OracleProvider, 
  OracleNode, 
  PriceData, 
  WeatherData, 
  OracleResponse, 
  AggregatedData,
  OracleWeights,
  OracleMetrics,
  SelectionCriteria,
  AggregationStrategy
} from '../interfaces/OracleProvider';
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
  
  // Issue #6: Dynamic Oracle Selection
  private defaultSelectionCriteria: SelectionCriteria = {
    minProviders: 1,
    maxProviders: 5,
    outlierThreshold: 0.2,        // 20% deviation threshold
    consensusThreshold: 0.6,      // 60% consensus required
    weightingStrategy: 'dynamic',
    aggregationMethod: 'weightedMedian'
  };

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
      },
      // Issue #6: Initialize dynamic weights and metrics
      weights: {
        reliability: coinGeckoProvider.reliability,
        responseTime: 90,
        accuracy: 95,
        stake: 100,
        reputation: 90,
        combined: 93
      },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        accuracyScore: 95,
        reputationScore: 90,
        stakeAmount: 100,
        lastUpdate: null,
        performanceHistory: []
      },
      selectionScore: 93
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
      },
      // Issue #6: Initialize dynamic weights and metrics
      weights: {
        reliability: weatherProvider.reliability,
        responseTime: 80,
        accuracy: 85,
        stake: 80,
        reputation: 85,
        combined: 82
      },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        accuracyScore: 85,
        reputationScore: 85,
        stakeAmount: 80,
        lastUpdate: null,
        performanceHistory: []
      },
      selectionScore: 82
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

    // Update smart contract if available (backward compatible)
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

  // ===============================
  // Issue #6: Dynamic Oracle Selection Methods
  // ===============================

  /**
   * Dynamic oracle selection based on criteria
   */
  async selectBestOracles(
    dataType: string, 
    criteria: Partial<SelectionCriteria> = {}
  ): Promise<OracleNode[]> {
    const selectionCriteria = { ...this.defaultSelectionCriteria, ...criteria };
    const activeProviders = this.getActiveProviders();
    
    // Filter providers that support the requested data type
    const supportedProviders = activeProviders.filter(node => {
      if (dataType === 'price') {
        return node.provider.fetchPrice !== undefined;
      } else if (dataType === 'weather') {
        return node.provider.fetchWeather !== undefined;
      }
      return true;
    });

    if (supportedProviders.length < selectionCriteria.minProviders) {
      console.log(`⚠️ Only ${supportedProviders.length} providers available, minimum ${selectionCriteria.minProviders} required`);
    }

    // Calculate selection scores for each provider
    const scoredProviders = supportedProviders.map(node => ({
      ...node,
      selectionScore: this.calculateSelectionScore(node, selectionCriteria)
    }));

    // Sort by selection score (highest first)
    scoredProviders.sort((a, b) => (b.selectionScore || 0) - (a.selectionScore || 0));

    // Select top providers within limits
    const selectedCount = Math.min(
      Math.max(selectionCriteria.minProviders, scoredProviders.length),
      selectionCriteria.maxProviders
    );

    const selectedProviders = scoredProviders.slice(0, selectedCount);
    
    console.log(`🎯 Selected ${selectedProviders.length} oracles for ${dataType}:`, 
      selectedProviders.map(p => `${p.id}(${p.selectionScore?.toFixed(1)})`));

    return selectedProviders;
  }

  /**
   * Calculate selection score for a provider
   */
  private calculateSelectionScore(node: OracleNode, criteria: SelectionCriteria): number {
    const weights = node.weights;
    const metrics = node.metrics;
    
    if (!weights || !metrics) {
      return node.provider.reliability; // Fallback to basic reliability
    }

    switch (criteria.weightingStrategy) {
      case 'equal':
        return 50; // All providers equal
        
      case 'reliability':
        return weights.reliability;
        
      case 'performance':
        return (weights.responseTime + metrics.accuracyScore) / 2;
        
      case 'stake':
        return weights.stake;
        
      case 'dynamic':
      default:
        // Dynamic weighting combines all factors
        return this.calculateDynamicWeight(weights, metrics);
    }
  }

  /**
   * Calculate dynamic weight combining all factors
   */
  private calculateDynamicWeight(weights: OracleWeights, metrics: OracleMetrics): number {
    const factors = {
      reliability: weights.reliability * 0.25,
      responseTime: weights.responseTime * 0.20,
      accuracy: weights.accuracy * 0.25,
      reputation: weights.reputation * 0.15,
      stake: weights.stake * 0.15
    };

    const totalWeight = Object.values(factors).reduce((sum, weight) => sum + weight, 0);
    
    // Apply recent performance bonus/penalty
    const recentPerformance = metrics.performanceHistory.slice(-5);
    const performanceBonus = recentPerformance.length > 0 
      ? (recentPerformance.reduce((sum, score) => sum + score, 0) / recentPerformance.length - 50) * 0.1
      : 0;

    return Math.max(0, Math.min(100, totalWeight + performanceBonus));
  }

  /**
   * Enhanced aggregation with outlier detection
   */
  async getAggregatedDataWithSelection<T>(
    dataType: string,
    symbol: string,
    criteria: Partial<SelectionCriteria> = {}
  ): Promise<AggregatedData<T>> {
    const selectedProviders = await this.selectBestOracles(dataType, criteria);
    const selectionCriteria = { ...this.defaultSelectionCriteria, ...criteria };

    if (selectedProviders.length === 0) {
      throw new Error(`No providers available for ${dataType}:${symbol}`);
    }

    // Fetch data from selected providers
    const responses = await Promise.allSettled(
      selectedProviders.map(async (node) => {
        const startTime = Date.now();
        try {
          let result: OracleResponse<T>;
          if (dataType === 'price') {
            result = await node.provider.fetchPrice(symbol) as OracleResponse<T>;
          } else if (dataType === 'weather') {
            result = await node.provider.fetchWeather!(symbol) as OracleResponse<T>;
          } else {
            throw new Error(`Unsupported data type: ${dataType}`);
          }
          
          const executionTime = Date.now() - startTime;
          this.updateProviderMetrics(node.id, result.success, executionTime, result.confidence || 0.5);
          return result;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          this.updateProviderMetrics(node.id, false, executionTime, 0);
          throw error;
        }
      })
    );

    // Filter successful responses
    const validResponses = responses
      .filter((result): result is PromiseFulfilledResult<OracleResponse<T>> => 
        result.status === 'fulfilled' && result.value.success && !!result.value.data
      )
      .map(result => result.value);

    if (validResponses.length === 0) {
      throw new Error(`No valid responses received for ${dataType}:${symbol}`);
    }

    // Detect and remove outliers
    const { cleanResponses, outliers } = this.detectOutliers(validResponses, selectionCriteria.outlierThreshold);
    
    // Calculate aggregated result
    const aggregatedData = this.aggregateResponses(cleanResponses, selectedProviders, selectionCriteria);
    
    // Add Issue #6 enhancements to result
    aggregatedData.outliers = outliers;
    aggregatedData.confidence = this.calculateOverallConfidence(cleanResponses);
    aggregatedData.qualityMetrics = this.calculateQualityMetrics(cleanResponses);

    // Log enhanced aggregation
    await this.logEnhancedAggregation(aggregatedData, selectedProviders);

    // Update smart contract with dynamic oracle data
    try {
      await oracleContractService.updateContractPriceWithDynamicSelection({
        symbol: symbol.toUpperCase(),
        price: (aggregatedData.data as any).price,
        timestamp: Date.now(),
        source: 'Oracle Manager',
        confidence: aggregatedData.confidence || 0.5,
        weights: aggregatedData.weights,
        outliers: aggregatedData.outliers,
        qualityMetrics: aggregatedData.qualityMetrics,
        providers: aggregatedData.sources,
        aggregationMethod: aggregatedData.method || 'weightedMedian'
      });
    } catch (error) {
      console.log('⚠️ Could not update smart contract with dynamic data:', error);
    }

    return aggregatedData;
  }

  /**
   * Detect outliers in oracle responses
   */
  private detectOutliers<T>(responses: OracleResponse<T>[], threshold: number): {
    cleanResponses: OracleResponse<T>[],
    outliers: string[]
  } {
    if (responses.length <= 2) {
      return { cleanResponses: responses, outliers: [] };
    }

    // For price data, detect outliers based on price deviation
    if (responses[0].data && typeof (responses[0].data as any).price === 'number') {
      const prices = responses.map(r => ((r.data as any).price as number));
      const median = this.calculateMedian(prices);
      const outliers: string[] = [];
      const cleanResponses: OracleResponse<T>[] = [];

      responses.forEach((response, index) => {
        const price = (response.data as any).price as number;
        const deviation = Math.abs(price - median) / median;
        
        if (deviation > threshold) {
          outliers.push(response.source);
          console.log(`🚫 Outlier detected: ${response.source} price ${price} deviates ${(deviation * 100).toFixed(1)}% from median ${median}`);
        } else {
          cleanResponses.push(response);
        }
      });

      return { cleanResponses, outliers };
    }

    // For other data types, return all responses (can be enhanced later)
    return { cleanResponses: responses, outliers: [] };
  }

  /**
   * Calculate median of numbers
   */
  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }

  /**
   * True weighted median calculation (Issue #6 enhancement)
   */
  private calculateTrueWeightedMedian(values: number[], weights: number[]): number {
    if (values.length === 1) return values[0];
    
    // Create array of {value, weight} pairs and sort by value
    const pairs = values.map((value, i) => ({ value, weight: weights[i] }))
      .sort((a, b) => a.value - b.value);
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const halfWeight = totalWeight / 2;
    
    let cumulativeWeight = 0;
    for (const pair of pairs) {
      cumulativeWeight += pair.weight;
      if (cumulativeWeight >= halfWeight) {
        return pair.value;
      }
    }
    
    return pairs[pairs.length - 1].value; // Fallback
  }

  /**
   * Aggregate responses using selected method
   */
  private aggregateResponses<T>(
    responses: OracleResponse<T>[],
    providers: OracleNode[],
    criteria: SelectionCriteria
  ): AggregatedData<T> {
    if (responses.length === 0) {
      throw new Error('No responses to aggregate');
    }

    // Extract data and calculate weights
    const data = responses.map(r => r.data!);
    const sources = responses.map(r => r.source);
    const weights = responses.map(r => {
      const provider = providers.find(p => p.provider.name === r.source);
      return provider?.weights?.combined || 50;
    });

    let aggregatedValue: T;
    
    if (typeof (data[0] as any).price === 'number') {
      // Price data aggregation
      const prices = data.map(d => (d as any).price as number);
      let finalPrice: number;

      switch (criteria.aggregationMethod) {
        case 'median':
          finalPrice = this.calculateMedian(prices);
          break;
        case 'weightedMedian':
          finalPrice = this.calculateTrueWeightedMedian(prices, weights);
          break;
        case 'average':
          finalPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          break;
        case 'weightedAverage':
        default:
          finalPrice = this.calculateWeightedMedian(prices, weights);
      }

      aggregatedValue = {
        ...data[0],
        price: finalPrice,
        source: 'Oracle Manager',
        timestamp: Date.now()
      } as T;
    } else {
      // Non-price data - use first response as base
      aggregatedValue = {
        ...data[0],
        source: 'Oracle Manager',
        timestamp: Date.now()
      } as T;
    }

    const consensus = responses.length / Math.max(providers.length, 1);

    return {
      data: aggregatedValue,
      sources,
      consensus,
      timestamp: Date.now(),
      method: criteria.aggregationMethod,
      weights,
      confidence: this.calculateOverallConfidence(responses)
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence<T>(responses: OracleResponse<T>[]): number {
    if (responses.length === 0) return 0;
    
    const confidenceScores = responses.map(r => r.confidence || 0.5);
    return confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics<T>(responses: OracleResponse<T>[]): {
    accuracy: number;
    freshness: number;
    consistency: number;
  } {
    const now = Date.now();
    const avgFreshness = responses.reduce((sum, r) => {
      const age = now - r.timestamp;
      return sum + Math.max(0, 1 - (age / (5 * 60 * 1000))); // 5 minutes = 0 freshness
    }, 0) / responses.length;

    // Calculate consistency (how similar the responses are)
    let consistency = 1;
    if (responses.length > 1 && typeof (responses[0].data as any).price === 'number') {
      const prices = responses.map(r => (r.data as any).price as number);
      const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;
      consistency = Math.max(0, 1 - coefficientOfVariation);
    }

    return {
      accuracy: this.calculateOverallConfidence(responses),
      freshness: avgFreshness,
      consistency
    };
  }

  /**
   * Update provider metrics with performance data
   */
  private updateProviderMetrics(
    providerId: string,
    success: boolean,
    responseTime: number,
    confidence: number
  ): void {
    const node = this.providers.get(providerId);
    if (!node || !node.metrics || !node.weights) return;

    // Update basic stats
    node.metrics.totalRequests++;
    if (success) node.metrics.successfulRequests++;
    node.metrics.avgResponseTime = (node.metrics.avgResponseTime + responseTime) / 2;
    node.metrics.lastUpdate = new Date();

    // Update performance history (keep last 10)
    const performanceScore = success ? (confidence * 100) : 0;
    node.metrics.performanceHistory.push(performanceScore);
    if (node.metrics.performanceHistory.length > 10) {
      node.metrics.performanceHistory.shift();
    }

    // Recalculate dynamic weights based on recent performance
    this.recalculateProviderWeights(node);
  }

  /**
   * Recalculate provider weights based on performance
   */
  private recalculateProviderWeights(node: OracleNode): void {
    if (!node.weights || !node.metrics) return;

    // Update response time weight based on recent performance
    const avgResponseTime = node.metrics.avgResponseTime;
    node.weights.responseTime = Math.max(0, 100 - (avgResponseTime / 100)); // 100ms = 1 point penalty

    // Update accuracy based on recent performance history
    if (node.metrics.performanceHistory.length > 0) {
      const recentAccuracy = node.metrics.performanceHistory
        .reduce((sum, score) => sum + score, 0) / node.metrics.performanceHistory.length;
      node.weights.accuracy = Math.max(0, Math.min(100, recentAccuracy));
    }

    // Recalculate combined weight
    node.weights.combined = this.calculateDynamicWeight(node.weights, node.metrics);
    node.selectionScore = node.weights.combined;

    console.log(`📊 Updated weights for ${node.id}: combined=${node.weights.combined.toFixed(1)}`);
  }

  /**
   * Log enhanced aggregation with Issue #6 details
   */
  private async logEnhancedAggregation<T>(
    data: AggregatedData<T>,
    providers: OracleNode[]
  ): Promise<void> {
    try {
      const logData = {
        queryId: `enhanced_aggregation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        inputPrompt: `Dynamic oracle selection: ${data.sources.length} providers, method: ${data.method}`,
        aiResponse: `Result: ${JSON.stringify(data.data).substring(0, 100)}... (confidence: ${(data.confidence! * 100).toFixed(1)}%)`,
        model: 'dynamic_oracle_selection',
        provider: 'Oracle Manager',
        cost: 0,
        executionTime: 100,
        success: true
      };

      await hcsService.logOracleQuery(logData);
      
      // Also log selection details
      console.log(`📝 Enhanced aggregation logged: ${data.sources.length} sources, ${data.outliers?.length || 0} outliers removed`);
    } catch (error) {
      console.log('⚠️ Failed to log enhanced aggregation to HCS:', error);
    }
  }

  /**
   * Get oracle selection criteria configuration
   */
  getSelectionCriteria(): SelectionCriteria {
    return { ...this.defaultSelectionCriteria };
  }

  /**
   * Update oracle selection criteria
   */
  updateSelectionCriteria(criteria: Partial<SelectionCriteria>): void {
    this.defaultSelectionCriteria = { ...this.defaultSelectionCriteria, ...criteria };
    console.log('📋 Updated selection criteria:', this.defaultSelectionCriteria);
  }

  /**
   * Get detailed provider metrics for monitoring
   */
  getProviderMetrics(): Array<{
    id: string;
    name: string;
    status: string;
    weights: OracleWeights | undefined;
    metrics: OracleMetrics | undefined;
    selectionScore: number | undefined;
  }> {
    return Array.from(this.providers.values()).map(node => ({
      id: node.id,
      name: node.provider.name,
      status: node.status,
      weights: node.weights,
      metrics: node.metrics,
      selectionScore: node.selectionScore
    }));
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