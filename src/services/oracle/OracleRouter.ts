import { OracleConsensusService } from './OracleConsensusService';
import { ChainlinkOracleAdapter } from './adapters/ChainlinkOracleAdapter';
import { CustomAPIAdapter } from './adapters/CustomAPIAdapter';
import { CoinGeckoOracleAdapter } from './adapters/CoinGeckoOracleAdapter';
import { WeatherOracleAdapter } from './adapters/WeatherOracleAdapter';
import { WebScrapingAdapter } from './adapters/WebScrapingAdapter';
import { ConversationalAIService } from './ConversationalAIService';
import { HederaOracleLogger } from './HederaOracleLogger';
import { 
  OracleProvider, 
  ConsensusResult, 
  OracleQueryOptions, 
  OracleQueryType,
  OracleQuery,
  ConsensusMethod,
  OracleConfig
} from '../../types/oracle';
import { v4 as uuidv4 } from 'uuid';

/**
 * Oracle Router - Main orchestrator for oracle system
 * Provides unified interface for all oracle operations
 * Handles provider registration, query routing, and result aggregation
 */
export class OracleRouter {
  private consensusService: OracleConsensusService;
  private conversationalAI: ConversationalAIService;
  private hederaLogger?: HederaOracleLogger;
  private providers: Map<string, OracleProvider> = new Map();
  private isInitialized = false;

  constructor(private config?: OracleConfig) {
    this.consensusService = new OracleConsensusService({
      defaultMethod: config?.consensus?.default_method || ConsensusMethod.MEDIAN,
      minResponses: config?.consensus?.min_responses || 2,
      maxResponseTime: config?.consensus?.max_response_time || 10000,
      outlierThreshold: config?.consensus?.outlier_threshold || 0.3
    });
    
    // Initialize conversational AI service
    this.conversationalAI = new ConversationalAIService();
  }

  /**
   * Initialize oracle system with default providers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Initializing Oracle Router...');

      // Register default providers
      await this.registerDefaultProviders();

      // Initialize Hedera logging if enabled
      if (this.config?.hcs?.enabled) {
        await this.initializeHederaLogging();
      }

      // Health check all providers
      await this.performInitialHealthChecks();

      this.isInitialized = true;
      console.log('✅ Oracle Router initialized successfully');
      console.log(`📊 Registered ${this.providers.size} oracle providers`);

    } catch (error: any) {
      console.error('❌ Oracle Router initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Query oracle system with AI routing and consensus aggregation
   */
  async query(
    queryText: string, 
    options?: OracleQueryOptions
  ): Promise<ConsensusResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🔍 Processing query: "${queryText}"`);

    // First, check if this is a conversational query
    if (ConversationalAIService.isConversationalQuery(queryText)) {
      console.log(`🤖 Routing to Conversational AI: "${queryText}"`);
      
      try {
        const aiResponse = await this.conversationalAI.getConversationalResponse(queryText);
        
        // Return AI response in ConsensusResult format
        const result: ConsensusResult = {
          query: queryText,
          value: {
            response: aiResponse,
            type: 'conversational',
            intent: this.conversationalAI.detectConversationalIntent(queryText)
          },
          confidence: 0.95,
          sources: ['conversational_ai'],
          method: ConsensusMethod.AI_RESPONSE,
          timestamp: new Date(),
          executionTimeMs: Date.now() - Date.now(), // Minimal time for AI responses
          rawResponses: [{
            provider: 'conversational_ai',
            value: aiResponse,
            confidence: 0.95,
            responseTime: 50
          }],
          metadata: {
            isConversational: true,
            totalProviders: 1
          }
        };

        console.log(`✅ Conversational AI response generated`);
        return result;

      } catch (aiError: any) {
        console.warn(`⚠️ Conversational AI failed, falling back to Oracle: ${aiError.message}`);
        // Fall through to oracle processing
      }
    }

    // Route to Oracle system for data queries
    console.log(`🔮 Routing to Oracle system: "${queryText}"`);
    
    const query: OracleQuery = {
      id: uuidv4(),
      type: this.determineQueryType(queryText),
      query: queryText,
      requester: options?.sources?.join(',') || 'system',
      timestamp: new Date(),
      options: options || {}
    };

    try {
      // Get consensus result from oracle providers
      const result = await this.consensusService.getConsensus(queryText, options);

      // Add metadata to indicate this is not conversational
      result.metadata = {
        ...result.metadata,
        isConversational: false
      };

      // Log to Hedera if enabled
      if (this.hederaLogger) {
        try {
          await this.hederaLogger.logOracleResult(query, result);
        } catch (logError: any) {
          console.warn('⚠️ Failed to log to Hedera:', logError.message);
        }
      }

      console.log(`✅ Oracle query completed: ${result.sources.length} sources, confidence: ${(result.confidence * 100).toFixed(1)}%`);
      return result;

    } catch (error: any) {
      console.error(`❌ Oracle query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backward compatibility: Get price data (legacy method)
   */
  async getPrice(symbol: string): Promise<any> {
    const result = await this.query(`${symbol} price`);
    
    // Return in legacy format
    return {
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        price: result.value.price || result.value,
        timestamp: result.timestamp.getTime(),
        source: result.sources.join('+'),
        confidence: result.confidence
      }
    };
  }

  /**
   * Backward compatibility: Get weather data (legacy method)
   */
  async getWeather(location: string): Promise<any> {
    const result = await this.query(`weather in ${location}`);
    
    // Return in legacy format
    return {
      success: true,
      data: {
        location: result.value.location || location,
        temperature: result.value.temperature,
        humidity: result.value.humidity,
        description: result.value.weather_description || result.value.description,
        timestamp: result.timestamp.getTime(),
        source: result.sources.join('+')
      }
    };
  }

  /**
   * Register a custom oracle provider
   */
  registerProvider(provider: OracleProvider): void {
    this.providers.set(provider.name, provider);
    this.consensusService.registerProvider(provider);
    console.log(`📝 Registered oracle provider: ${provider.name}`);
  }

  /**
   * Unregister an oracle provider
   */
  unregisterProvider(providerName: string): void {
    this.providers.delete(providerName);
    this.consensusService.unregisterProvider(providerName);
    console.log(`🗑️ Unregistered oracle provider: ${providerName}`);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): OracleProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getProviders(): OracleProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Health check all providers
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    console.log('🏥 Running health checks for all providers...');
    const results = await this.consensusService.healthCheckAll();
    
    // Log to Hedera if enabled
    if (this.hederaLogger) {
      for (const [providerName, isHealthy] of results) {
        const provider = this.providers.get(providerName);
        try {
          await this.hederaLogger.logHealthStatus(
            providerName, 
            isHealthy,
            provider ? await provider.getMetrics() : undefined
          );
        } catch (error: any) {
          console.warn(`⚠️ Failed to log health status for ${providerName}:`, error.message);
        }
      }
    }

    return results;
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<any> {
    const providers = this.getProviders();
    const healthStatus = await this.healthCheckAll();
    
    const stats = {
      total_providers: providers.length,
      active_providers: Array.from(healthStatus.values()).filter(h => h).length,
      provider_details: [] as any[],
      system_health: 0,
      last_check: new Date()
    };

    for (const provider of providers) {
      const isHealthy = healthStatus.get(provider.name) || false;
      const metrics = await provider.getMetrics();
      
      stats.provider_details.push({
        name: provider.name,
        healthy: isHealthy,
        weight: provider.weight,
        reliability: provider.reliability,
        latency: provider.latency,
        metrics: metrics
      });
    }

    stats.system_health = stats.active_providers / stats.total_providers;
    return stats;
  }

  private async registerDefaultProviders(): Promise<void> {
    // Register Chainlink provider
    const chainlinkProvider = new ChainlinkOracleAdapter();
    this.registerProvider(chainlinkProvider);

    // Register CoinGecko provider
    const coinGeckoProvider = new CoinGeckoOracleAdapter();
    this.registerProvider(coinGeckoProvider);

    // Register Weather provider
    const weatherProvider = new WeatherOracleAdapter();
    this.registerProvider(weatherProvider);

    // Register Web Scraping provider
    const webScrapingProvider = new WebScrapingAdapter();
    this.registerProvider(webScrapingProvider);

    // Register Custom API providers from config
    if (this.config?.providers) {
      for (const [name, providerConfig] of Object.entries(this.config.providers)) {
        if (providerConfig.enabled && providerConfig.config.baseUrl) {
          const customProvider = new CustomAPIAdapter({
            name,
            baseUrl: providerConfig.config.baseUrl,
            apiKey: providerConfig.config.apiKey,
            weight: providerConfig.weight
          });
          this.registerProvider(customProvider);
        }
      }
    }
  }

  private async initializeHederaLogging(): Promise<void> {
    if (!this.config?.hcs) return;

    try {
      this.hederaLogger = new HederaOracleLogger(
        process.env.HEDERA_ACCOUNT_ID!,
        process.env.HEDERA_PRIVATE_KEY!,
        process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' || 'testnet',
        this.config.hcs.topic_id
      );

      if (this.config.hcs.batch_size) {
        this.hederaLogger.setBatchConfig(this.config.hcs.batch_size);
      }

      console.log('🔗 Hedera Oracle Logger initialized');
    } catch (error: any) {
      console.warn('⚠️ Failed to initialize Hedera logging:', error.message);
    }
  }

  private async performInitialHealthChecks(): Promise<void> {
    console.log('🏥 Performing initial health checks...');
    const results = await this.healthCheckAll();
    
    const healthyCount = Array.from(results.values()).filter(h => h).length;
    const totalCount = results.size;
    
    console.log(`📊 Health check results: ${healthyCount}/${totalCount} providers healthy`);
    
    if (healthyCount === 0) {
      console.warn('⚠️ No healthy providers found! Oracle system may not function properly.');
    }
  }

  private determineQueryType(query: string): OracleQueryType {
    const lowerQuery = query.toLowerCase();
    
    // System status queries
    if (lowerQuery.includes('provider') || lowerQuery.includes('service') || 
        lowerQuery.includes('status') || lowerQuery.includes('health') ||
        lowerQuery.includes('balance') || lowerQuery.includes('available')) {
      return OracleQueryType.CUSTOM;
    }
    
    // Price queries
    if (lowerQuery.includes('price') || lowerQuery.includes('cost') ||
        lowerQuery.match(/\b(btc|bitcoin|eth|ethereum|ada|dot|sol|matic|avax|atom|link|uni)\b/i)) {
      return OracleQueryType.PRICE_FEED;
    }
    
    // Weather queries (with typo tolerance)
    if (lowerQuery.includes('weather') || lowerQuery.includes('wheather') ||
        lowerQuery.includes('temperature') || lowerQuery.includes('forecast') || 
        lowerQuery.includes('climate')) {
      return OracleQueryType.WEATHER_DATA;
    }
    
    // News queries
    if (lowerQuery.includes('news') || lowerQuery.includes('headline')) {
      return OracleQueryType.NEWS_VERIFICATION;
    }
    
    // Web search queries
    if (lowerQuery.includes('search') || lowerQuery.includes('google')) {
      return OracleQueryType.WEB_SEARCH;
    }
    
    return OracleQueryType.CUSTOM;
  }

  /**
   * Close oracle router and cleanup resources
   */
  async close(): Promise<void> {
    if (this.hederaLogger) {
      await this.hederaLogger.close();
    }
    console.log('🔚 Oracle Router closed');
  }
}