import { OracleRouter } from './OracleRouter';
import { HederaOracleLogger } from './HederaOracleLogger';
import { ConversationalAIService } from './ConversationalAIService';
import { OracleQueryType, ConsensusResult } from '../../types/oracle';

/**
 * Enhanced Oracle Manager with User Selection and Blockchain Logging
 * Manages user-selected oracles and provides blockchain-verified responses
 */
export class OracleManager {
  private oracleRouter: OracleRouter;
  private hederaLogger: HederaOracleLogger;
  private conversationalAI: ConversationalAIService;
  private isInitialized = false;

  // Available oracle options for users
  public readonly availableOracles = {
    'chainlink': {
      name: 'Chainlink',
      icon: '🔗',
      description: 'Decentralized oracle network with proven reliability',
      category: 'Premium',
      specialties: ['Crypto prices', 'Market data', 'Enterprise'],
      latency: '300ms',
      reliability: '95%'
    },
    'coingecko': {
      name: 'CoinGecko',
      icon: '🦎',
      description: 'Comprehensive cryptocurrency data and market info',
      category: 'Free',
      specialties: ['Crypto prices', 'Market cap', 'Trading volume'],
      latency: '500ms',
      reliability: '90%'
    },
    'dia': {
      name: 'DIA Oracle',
      icon: '💎',
      description: 'Transparent, customizable crypto price feeds',
      category: 'Free',
      specialties: ['3000+ tokens', 'Transparent data', 'DeFi'],
      latency: '400ms',
      reliability: '91%'
    },
    'nasa': {
      name: 'NASA',
      icon: '🚀',
      description: 'Space, astronomy, and Earth observation data',
      category: 'Official',
      specialties: ['Astronomy', 'Space weather', 'Earth data'],
      latency: '800ms',
      reliability: '92%'
    },
    'wikipedia': {
      name: 'Wikipedia',
      icon: '📚',
      description: 'Global knowledge base and information encyclopedia',
      category: 'Free',
      specialties: ['Knowledge', 'Information', 'Education'],
      latency: '600ms',
      reliability: '88%'
    },
    'weather': {
      name: 'Weather Oracle',
      icon: '🌤️',
      description: 'Real-time weather data and forecasts',
      category: 'Free',
      specialties: ['Weather forecasts', 'Climate data', 'Location'],
      latency: '400ms',
      reliability: '89%'
    },
    'exchangerate': {
      name: 'Exchange Rate',
      icon: '💱',
      description: 'Foreign exchange rates and currency conversion',
      category: 'Free',
      specialties: ['Forex rates', 'Currency conversion', 'Financial'],
      latency: '600ms',
      reliability: '90%'
    },
    'sports': {
      name: 'Sports Oracle',
      icon: '🏀',
      description: 'Comprehensive NBA and global sports data',
      category: 'Free',
      specialties: ['NBA stats', 'Player data', 'Team info', 'Game scores'],
      latency: '800ms',
      reliability: '92%'
    },
    'web-scraping': {
      name: 'Web Search',
      icon: '🔍',
      description: 'Real-time web data and search capabilities',
      category: 'Dynamic',
      specialties: ['Web search', 'Real-time data', 'News'],
      latency: '2000ms',
      reliability: '85%'
    }
  };

  constructor() {
    this.oracleRouter = new OracleRouter();
    
    // Initialize Hedera with real environment variables
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    const topicId = process.env.HEDERA_TOPIC_ID;
    
    if (accountId && privateKey) {
      this.hederaLogger = new HederaOracleLogger(accountId, privateKey, 'testnet', topicId);
    } else {
      throw new Error('Hedera credentials required! Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY environment variables.');
    }
    
    this.conversationalAI = new ConversationalAIService();
  }

  /**
   * Initialize the Oracle Manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🎯 Initializing Oracle Manager...');
    
    try {
      await this.oracleRouter.initialize();
      
      // Initialize Hedera if available
      if (this.hederaLogger) {
        try {
          // Create HCS topic if not provided
          if (!process.env.HEDERA_TOPIC_ID) {
            console.log('🔗 Creating Hedera HCS topic...');
            const topicId = await this.hederaLogger.createTopic('Negravis Oracle System Logging');
            console.log(`✅ Created HCS Topic: ${topicId}`);
          }
          console.log('✅ Hedera blockchain logging initialized');
        } catch (error) {
          console.error('❌ Hedera initialization failed:', error);
          throw new Error(`Hedera initialization failed: ${error}`);
        }
      }
      
      this.isInitialized = true;
      console.log('✅ Oracle Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Oracle Manager:', error);
      throw error;
    }
  }

  /**
   * Process user query with selected oracle
   */
  async processUserQuery(
    selectedOracle: string,
    userQuery: string,
    userId?: string
  ): Promise<EnhancedOracleResponse> {
    if (!this.isInitialized) {
      throw new Error('Oracle Manager not initialized');
    }

    console.log(`🎯 Processing query with ${selectedOracle}: "${userQuery}"`);

    try {
      // Step 1: Get oracle data
      const oracleResponse = await this.querySpecificOracle(selectedOracle, userQuery);
      
      // Step 2: Generate AI response
      const aiResponse = await this.generateAIResponse(userQuery, oracleResponse);
      
      // Step 3: Log to blockchain
      const blockchainRecord = await this.logToBlockchain(
        selectedOracle,
        userQuery,
        oracleResponse,
        aiResponse,
        userId
      );

      // Step 4: Format enhanced response
      const enhancedResponse: EnhancedOracleResponse = {
        answer: aiResponse,
        oracle_used: selectedOracle,
        oracle_info: this.availableOracles[selectedOracle as keyof typeof this.availableOracles],
        data_sources: oracleResponse.sources,
        confidence: oracleResponse.confidence,
        raw_data: oracleResponse.value,
        blockchain_hash: blockchainRecord.transactionId,
        blockchain_link: blockchainRecord.explorerUrl,
        timestamp: new Date().toISOString(),
        query_id: blockchainRecord.queryId
      };

      console.log('✅ Enhanced oracle response generated:', {
        oracle: selectedOracle,
        confidence: (oracleResponse.confidence * 100).toFixed(1) + '%',
        sources: oracleResponse.sources.length,
        blockchain_hash: blockchainRecord.transactionId
      });

      return enhancedResponse;

    } catch (error: any) {
      console.error('❌ Error processing user query:', error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  /**
   * Query specific oracle provider
   */
  private async querySpecificOracle(
    selectedOracle: string,
    query: string
  ): Promise<ConsensusResult> {
    // Override the router to use only selected oracle
    const originalQuery = this.oracleRouter.query.bind(this.oracleRouter);
    
    // Temporarily modify router to use specific oracle
    const result = await this.oracleRouter.queryWithProviders(query, [selectedOracle]);
    
    return result;
  }

  /**
   * Generate AI response based on oracle data
   */
  private async generateAIResponse(
    userQuery: string,
    oracleResponse: ConsensusResult
  ): Promise<string> {
    const context = {
      query: userQuery,
      data: oracleResponse.value,
      sources: oracleResponse.sources,
      confidence: oracleResponse.confidence,
      method: oracleResponse.method
    };

    const prompt = `
Based on the following oracle data, provide a comprehensive and helpful response to the user's query.

User Query: ${userQuery}
Oracle Data: ${JSON.stringify(oracleResponse.value)}
Data Sources: ${oracleResponse.sources.join(', ')}
Confidence: ${(oracleResponse.confidence * 100).toFixed(1)}%

Please provide a clear, informative response that:
1. Directly answers the user's question
2. Mentions the data reliability and sources
3. Includes relevant context or insights
4. Keeps the response concise but comprehensive

Response:`;

    // Use enhanced ConversationalAI for intelligent response formatting
    return await this.conversationalAI.processOracleData(
      userQuery,
      context.data,
      context.sources,
      context.confidence
    );
  }

  /**
   * Log query and response to blockchain
   */
  private async logToBlockchain(
    oracle: string,
    query: string,
    oracleResponse: ConsensusResult,
    aiResponse: string,
    userId?: string
  ): Promise<BlockchainRecord> {
    const logData = {
      oracle_used: oracle,
      user_query: query,
      oracle_response: oracleResponse,
      ai_response: aiResponse,
      user_id: userId || 'anonymous',
      timestamp: new Date().toISOString(),
      confidence_score: oracleResponse.confidence,
      data_sources: oracleResponse.sources
    };

    const queryId = this.generateQueryId(query, oracle);
    
    try {
      if (this.hederaLogger) {
        // Real Hedera blockchain logging
        console.log('📝 Logging to Hedera blockchain...');
        
        const oracleQuery: any = {
          id: queryId,
          query: query,
          type: 'CUSTOM' as any,
          requester: userId || 'anonymous',
          timestamp: new Date(),
          options: {}
        };
        
        const transactionId = await this.hederaLogger.logOracleResult(oracleQuery, oracleResponse);
        
        return {
          queryId,
          transactionId,
          explorerUrl: `https://hashscan.io/testnet/transaction/${transactionId}`,
          timestamp: new Date().toISOString()
        };
      } else {
        // No Hedera logger available - fail with error
        throw new Error('Hedera blockchain logging not initialized. Cannot process oracle query without blockchain verification.');
      }
    } catch (error: any) {
      console.error('❌ Blockchain logging failed:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      // No fallback - throw the error so system fails properly
      throw new Error(`Failed to log oracle result to blockchain: ${error.message}`);
    }
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(query: string, oracle: string): string {
    const timestamp = Date.now();
    const hash = Buffer.from(`${query}-${oracle}-${timestamp}`).toString('base64');
    return `query_${hash.slice(0, 12)}_${timestamp}`;
  }

  /**
   * Get available oracles by category
   */
  getOraclesByCategory(): { [category: string]: any[] } {
    const categories: { [key: string]: any[] } = {};
    
    Object.entries(this.availableOracles).forEach(([key, oracle]) => {
      const category = oracle.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({
        id: key,
        ...oracle
      });
    });
    
    return categories;
  }

  /**
   * Get oracle recommendations based on query type
   */
  getRecommendedOracles(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    
    // Crypto/Finance queries
    if (lowerQuery.includes('price') || lowerQuery.includes('crypto') || 
        lowerQuery.includes('bitcoin') || lowerQuery.includes('ethereum')) {
      return ['chainlink', 'coingecko', 'dia'];
    }
    
    // Space/Astronomy queries
    if (lowerQuery.includes('space') || lowerQuery.includes('nasa') || 
        lowerQuery.includes('astronomy') || lowerQuery.includes('mars')) {
      return ['nasa'];
    }
    
    // Knowledge queries
    if (lowerQuery.includes('what is') || lowerQuery.includes('who is') || 
        lowerQuery.includes('explain') || lowerQuery.includes('history')) {
      return ['wikipedia'];
    }
    
    // Weather queries
    if (lowerQuery.includes('weather') || lowerQuery.includes('temperature') || 
        lowerQuery.includes('forecast')) {
      return ['weather'];
    }
    
    // Currency/Forex queries
    if (lowerQuery.includes('exchange') || lowerQuery.includes('currency') || 
        lowerQuery.includes('usd') || lowerQuery.includes('eur')) {
      return ['exchangerate'];
    }
    
    // Default recommendations
    return ['chainlink', 'coingecko', 'dia'];
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const stats = await this.oracleRouter.getSystemStats();
    
    return {
      total_oracles: stats.total_providers,
      healthy_oracles: stats.active_providers,
      system_health: stats.system_health,
      blockchain_status: this.hederaLogger ? 'hedera_connected' : 'disconnected',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Close Oracle Manager and cleanup
   */
  async close(): Promise<void> {
    console.log('🔚 Closing Oracle Manager...');
    
    await this.oracleRouter.close();
    
    this.isInitialized = false;
    console.log('✅ Oracle Manager closed');
  }
}

// Types for enhanced responses
export interface EnhancedOracleResponse {
  answer: string;
  oracle_used: string;
  oracle_info: any;
  data_sources: string[];
  confidence: number;
  raw_data: any;
  blockchain_hash: string;
  blockchain_link: string;
  timestamp: string;
  query_id: string;
}

export interface BlockchainRecord {
  queryId: string;
  transactionId: string;
  explorerUrl: string;
  timestamp: string;
}

export interface SystemHealthStatus {
  total_oracles: number;
  healthy_oracles: number;
  system_health: number;
  blockchain_status: string;
  last_updated: string;
}