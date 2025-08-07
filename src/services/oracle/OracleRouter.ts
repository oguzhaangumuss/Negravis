import { OracleConsensusService } from './OracleConsensusService';
import { ChainlinkOracleAdapter } from './adapters/ChainlinkOracleAdapter';
import { CustomAPIAdapter } from './adapters/CustomAPIAdapter';
import { CoinGeckoOracleAdapter } from './adapters/CoinGeckoOracleAdapter';
import { WeatherOracleAdapter } from './adapters/WeatherOracleAdapter';
import { ExchangeRateAdapter } from './adapters/ExchangeRateAdapter';
import { PythOracleAdapter } from './adapters/PythOracleAdapter';
// SupraOracleAdapter removed - was duplicate of CoinGecko
import { NASAOracleAdapter } from './adapters/NASAOracleAdapter';
import { WikipediaOracleAdapter } from './adapters/WikipediaOracleAdapter';
import { DIAOracleAdapter } from './adapters/DIAOracleAdapter';
import { SportsOracleAdapter } from './adapters/SportsOracleAdapter';
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
      minResponses: config?.consensus?.min_responses || 1, // Allow single provider
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
      // Determine query type and filter appropriate providers
      const queryType = this.determineQueryType(queryText);
      const perspectiveProviders = options?.sources; // Frontend can send perspective-based providers
      const appropriateProviders = this.getProvidersForQueryType(queryType, perspectiveProviders);
      
      // Create filtered options with appropriate providers
      const filteredOptions = {
        ...options,
        sources: appropriateProviders
      };
      
      console.log(`🎯 Query type: ${queryType}, using providers: [${appropriateProviders.join(', ')}]`);
      
      // Get consensus result from filtered oracle providers
      const result = await this.consensusService.getConsensus(queryText, filteredOptions);

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
    // Supra provider removed - was duplicate of CoinGecko

    // Register Pyth provider (Premium tier - currently disabled due to API issues)
    // const pythProvider = new PythOracleAdapter();
    // this.registerProvider(pythProvider);

    // Register Chainlink provider
    const chainlinkProvider = new ChainlinkOracleAdapter();
    this.registerProvider(chainlinkProvider);

    // Register CoinGecko provider
    const coinGeckoProvider = new CoinGeckoOracleAdapter();
    this.registerProvider(coinGeckoProvider);

    // Register DIA provider (Transparent oracle)
    const diaProvider = new DIAOracleAdapter();
    this.registerProvider(diaProvider);

    // Register Weather provider
    const weatherProvider = new WeatherOracleAdapter();
    this.registerProvider(weatherProvider);

    // Register ExchangeRate provider
    const exchangeRateProvider = new ExchangeRateAdapter();
    this.registerProvider(exchangeRateProvider);

    // Register NASA provider (Space & Earth science data)
    const nasaProvider = new NASAOracleAdapter();
    this.registerProvider(nasaProvider);

    // Register Wikipedia provider (Knowledge database)
    const wikipediaProvider = new WikipediaOracleAdapter();
    this.registerProvider(wikipediaProvider);

    // Register Sports provider (NBA + Global sports data)
    const sportsProvider = new SportsOracleAdapter();
    this.registerProvider(sportsProvider);

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

  /**
   * Get appropriate providers for a specific query type
   * Now supports perspective-based filtering
   */
  private getProvidersForQueryType(queryType: OracleQueryType, perspectiveHint?: string[]): string[] {
    // If perspective hint is provided, use it
    if (perspectiveHint && perspectiveHint.length > 0) {
      console.log(`🎭 Using perspective-based providers: [${perspectiveHint.join(', ')}]`);
      return perspectiveHint.filter(provider => this.providers.has(provider));
    }
    
    // Otherwise, use query type-based routing
    switch (queryType) {
      case OracleQueryType.PRICE_FEED:
        return ['supra', 'chainlink', 'coingecko', 'dia']; // Premium + reliable price providers
        
      case OracleQueryType.EXCHANGE_RATE:
        return ['exchangerate']; // Only exchange rate provider
        
      case OracleQueryType.WEATHER_DATA:
        return ['weather']; // Only weather provider
        
      case OracleQueryType.NEWS_VERIFICATION:
        return ['web-scraping']; // Only web scraping for news
        
      case OracleQueryType.WEB_SEARCH:
        return ['web-scraping']; // Only web scraping for search
        
      case OracleQueryType.SPACE_DATA:
        return ['nasa']; // NASA for space and astronomy data
        
      case OracleQueryType.KNOWLEDGE_QUERY:
        return ['wikipedia']; // Wikipedia for knowledge queries
        
      case OracleQueryType.CUSTOM:
      default:
        // For system status or unknown queries, use all available providers
        return Array.from(this.providers.keys());
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
    
    // Price queries - enhanced crypto symbol detection
    if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('value') ||
        lowerQuery.match(/\b(btc|bitcoin|eth|ethereum|bnb|binance|ada|cardano|dot|polkadot|sol|solana|matic|polygon|hbar|hedera|avax|avalanche|atom|cosmos|link|chainlink|xrp|ripple|doge|dogecoin|ltc|litecoin|uni|uniswap)\b/i)) {
      return OracleQueryType.PRICE_FEED;
    }
    
    // Exchange rate queries
    if (lowerQuery.includes('exchange') || lowerQuery.includes('currency') || lowerQuery.includes('forex') ||
        lowerQuery.match(/\b(usd|eur|gbp|jpy|chf|cad|aud|nzd|try|rub|cny|inr|brl|mxn|zar|krw|sgd|hkd|nok|sek|dkk|pln|czk|huf)\b/i) ||
        lowerQuery.match(/[A-Z]{3}\/[A-Z]{3}/) || lowerQuery.match(/[A-Z]{3}\s+to\s+[A-Z]{3}/)) {
      return OracleQueryType.EXCHANGE_RATE;
    }
    
    // Weather queries (with typo tolerance and city detection)
    if (lowerQuery.includes('weather') || lowerQuery.includes('wheather') || lowerQuery.includes('whather') ||
        lowerQuery.includes('temperature') || lowerQuery.includes('forecast') || 
        lowerQuery.includes('climate') ||
        // Common city patterns that indicate weather queries
        lowerQuery.match(/\b(istanbul|ankara|izmir|denizli|antalya|london|paris|berlin|moscow|tokyo|new york|los angeles)\b/i)) {
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
    
    // Space and astronomy queries
    if (lowerQuery.includes('space') || lowerQuery.includes('nasa') || lowerQuery.includes('astronomy') ||
        lowerQuery.includes('mars') || lowerQuery.includes('asteroid') || lowerQuery.includes('satellite') ||
        lowerQuery.includes('solar') || lowerQuery.includes('planet') || lowerQuery.includes('earth observation')) {
      return OracleQueryType.SPACE_DATA;
    }
    
    // Knowledge and information queries
    if (lowerQuery.includes('what is') || lowerQuery.includes('who is') || lowerQuery.includes('tell me about') ||
        lowerQuery.includes('explain') || lowerQuery.includes('definition') || lowerQuery.includes('history') ||
        lowerQuery.includes('wikipedia') || lowerQuery.includes('information')) {
      return OracleQueryType.KNOWLEDGE_QUERY;
    }
    
    return OracleQueryType.CUSTOM;
  }

  /**
   * Query with specific providers (used by OracleManager)
   */
  async queryWithProviders(query: string, providerNames: string[], options?: OracleQueryOptions): Promise<ConsensusResult> {
    if (!this.isInitialized) {
      throw new Error('OracleRouter not initialized. Call initialize() first.');
    }

    console.log(`🎯 Query with specific providers: [${providerNames.join(', ')}]`);
    
    // Filter providers to only use specified ones
    const selectedProviders = providerNames
      .map(name => this.providers.get(name))
      .filter(provider => provider !== undefined) as OracleProvider[];

    if (selectedProviders.length === 0) {
      throw new Error(`No valid providers found from: ${providerNames.join(', ')}`);
    }

    // Use consensus service with selected providers only
    const tempConsensus = new OracleConsensusService({
      minResponses: Math.min(1, selectedProviders.length),
      maxResponseTime: 10000
    });

    // Register selected providers
    selectedProviders.forEach(provider => {
      tempConsensus.registerProvider(provider);
    });

    try {
      const result = await tempConsensus.getConsensus(query, options);
      
      // Log the oracle interaction
      if (this.hederaLogger) {
        const queryId = `query_${Date.now()}`;
        // Mock blockchain logging
        console.log('📝 Would log to blockchain:', { queryId, query, providers: providerNames });
      }

      console.log(`✅ Oracle query completed: ${result.sources.length} sources, confidence: ${(result.confidence * 100).toFixed(1)}%`);
      return result;

    } catch (error: any) {
      console.error(`❌ Oracle query failed:`, error);
      throw new Error(`Oracle query failed: ${error.message}`);
    }
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