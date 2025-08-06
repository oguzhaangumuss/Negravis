import { 
  OracleProvider, 
  OracleResponse, 
  OracleMetrics,
  ConsensusResult
} from '../types/oracle';
import { OracleRouter } from './oracle/OracleRouter';
import { ChatbotManager } from './oracle/chatbot/ChatbotManager';
import { CoinGeckoOracleAdapter } from './oracle/adapters/CoinGeckoOracleAdapter';
import { WeatherOracleAdapter } from './oracle/adapters/WeatherOracleAdapter';
import { oracleContractService } from './blockchain/oracleContractService';
import { hcsService } from './hcsService';

/**
 * Oracle Manager Service
 * Manages multiple oracle providers and aggregates data
 */
export class OracleManager {
  private oracleRouter: OracleRouter;
  private chatbotManager: ChatbotManager;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  
  private providers: Map<string, any> = new Map();

  constructor() {
    this.oracleRouter = new OracleRouter();
    this.chatbotManager = new ChatbotManager(this.oracleRouter, {
      providers: {},
      consensus: {
        default_method: 'median' as any,
        min_responses: 2,
        max_response_time: 10000,
        outlier_threshold: 0.3
      },
      cache: {
        enabled: true,
        ttl: 300000,
        max_size: 1000
      },
      hcs: {
        enabled: true,
        topic_id: 'oracle-topic',
        batch_size: 10
      },
      chatbot: {
        discord: { enabled: false, token: '', channels: [] },
        slack: { enabled: false, token: '', channels: [] },
        telegram: { enabled: false, token: '', channels: [] }
      }
    });
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

      // Initialize oracle router
      await this.oracleRouter.initialize();
      
      // Initialize chatbot manager (temporarily disabled)
      console.log('⚠️ Chatbot system disabled for now');
      // await this.chatbotManager.initialize();

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
    // Initialize oracle router with adapters
    const coinGeckoAdapter = new CoinGeckoOracleAdapter();
    const weatherAdapter = new WeatherOracleAdapter();
    
    this.oracleRouter.registerProvider(coinGeckoAdapter);
    this.oracleRouter.registerProvider(weatherAdapter);
    
    // Track providers for backward compatibility
    this.providers.set('coingecko-1', { provider: coinGeckoAdapter, status: 'active' });
    this.providers.set('weather-1', { provider: weatherAdapter, status: 'active' });
    
    console.log(`📡 Setup ${this.providers.size} default oracle providers`);
  }

  /**
   * Add new oracle provider
   */
  addProvider(id: string, provider: OracleProvider): void {
    this.oracleRouter.registerProvider(provider);
    this.providers.set(id, { provider, status: 'active' });
    console.log(`➕ Added oracle provider: ${id}`);
  }

  /**
   * Get aggregated price from multiple providers
   */
  async getAggregatedPrice(symbol: string): Promise<ConsensusResult> {
    console.log(`💰 Getting aggregated price for ${symbol}`);
    
    // Use oracle router for price queries
    const result = await this.oracleRouter.query(`${symbol} price`);
    
    // Log to HCS
    await this.logAggregation(result);

    // Update smart contract if available (backward compatible)
    try {
      // Extract price from result.value (handle both object and number cases)
      let price = result.value;
      if (typeof result.value === 'object' && result.value !== null) {
        price = result.value.price || result.value.value || 0;
      }
      
      // Ensure price is a valid number
      const numericPrice = parseFloat(price);
      if (isNaN(numericPrice)) {
        console.log('⚠️ Invalid price value, skipping smart contract update:', price);
        return result;
      }
      
      await oracleContractService.updateContractPrice({
        symbol: symbol.toUpperCase(),
        price: numericPrice,
        timestamp: Date.now(),
        source: 'Oracle Manager'
      });
    } catch (error) {
      console.log('⚠️ Could not update smart contract:', error);
    }

    return result;
  }

  /**
   * Get weather data from weather providers
   */
  async getWeatherData(location: string): Promise<ConsensusResult> {
    console.log(`🌤️ Getting weather data for ${location}`);
    
    // Use oracle router for weather queries
    const result = await this.oracleRouter.query(`weather in ${location}`);
    
    // Log to HCS
    await this.logAggregation(result);

    return result;
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing health checks...');
    
    // Perform basic health checks
    
    for (const [id, node] of this.providers) {
      try {
        const isHealthy = await node.provider.healthCheck();
        node.status = isHealthy ? 'active' : 'error';
        
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
   * Update node statistics (simplified)
   */
  private updateNodeStats(nodeId: string, success: boolean, responseTime: number): void {
    const node = this.providers.get(nodeId);
    if (!node) return;
    
    // Basic stats tracking for backward compatibility
    console.log(`📊 Provider ${nodeId}: ${success ? 'success' : 'failure'}, ${responseTime}ms`);
  }

  /**
   * Get provider weight (simplified)
   */
  private getProviderWeight(source: string): number {
    return 50; // Default weight for backward compatibility
  }

  /**
   * Calculate weighted median (simplified)
   */
  private calculateWeightedMedian(values: number[], weights: number[]): number {
    if (values.length === 1) return values[0];
    
    // Simple average for backward compatibility
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get active providers (simplified)
   */
  getActiveProviders(): any[] {
    return Array.from(this.providers.values()).filter(node => node.status === 'active');
  }

  /**
   * Get all providers with stats (simplified)
   */
  getAllProviders(): any[] {
    return Array.from(this.providers.values());
  }

  /**
   * Log aggregation to HCS (simplified)
   */
  private async logAggregation(data: any): Promise<void> {
    try {
      await hcsService.logOracleQuery({
        queryId: `aggregation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        inputPrompt: `Oracle query processed`,
        aiResponse: `Result: ${JSON.stringify(data).substring(0, 100)}...`,
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
    return this.isInitialized;
  }

  /**
   * Get start time for uptime calculations
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * Simple query method using the new oracle router
   */
  async query(query: string, options: any = {}): Promise<ConsensusResult> {
    return await this.oracleRouter.query(query, options);
  }
  
  /**
   * Get provider metrics (simplified)
   */
  getProviderMetrics(): any[] {
    return this.oracleRouter.getProviders().map(provider => ({
      name: provider.name,
      weight: provider.weight,
      reliability: provider.reliability
    }));
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Cleanup new oracle services (basic cleanup)
    console.log('🧹 Cleaning up oracle services...');
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const oracleManager = new OracleManager();