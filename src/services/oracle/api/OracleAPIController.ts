import { Request, Response } from 'express';
import { OracleRouter } from '../OracleRouter';
import { ChatbotManager } from '../chatbot/ChatbotManager';
import { OracleQueryOptions, ConsensusMethod, OracleQueryType } from '../../../types/oracle';
import { supabaseService } from '../../supabaseService';
import { HederaOracleLogger } from '../HederaOracleLogger';
import crypto from 'crypto';

/**
 * Oracle API Controller
 * REST endpoints for oracle system interactions
 */
export class OracleAPIController {
  private oracleRouter: OracleRouter;
  private chatbotManager?: ChatbotManager;
  private hederaLogger?: HederaOracleLogger;

  constructor(oracleRouter: OracleRouter, chatbotManager?: ChatbotManager) {
    this.oracleRouter = oracleRouter;
    this.chatbotManager = chatbotManager;
    
    // Initialize Hedera HCS Logger
    try {
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;
      const topicId = process.env.HEDERA_TOPIC_ID;
      
      if (accountId && privateKey) {
        this.hederaLogger = new HederaOracleLogger(accountId, privateKey, 'testnet', topicId);
        console.log('✅ Hedera HCS Logger initialized');
      } else {
        console.warn('⚠️ Hedera credentials not found, HCS logging disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Hedera HCS Logger:', error);
    }
  }

  /**
   * GET /api/oracle/query - General oracle query
   */
  async query(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, sources, method, timeout } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required'
        });
        return;
      }

      // Build query options
      const options: OracleQueryOptions = {};
      
      if (sources && typeof sources === 'string') {
        options.sources = sources.split(',').map(s => s.trim());
      }
      
      if (method && typeof method === 'string') {
        options.consensusMethod = method as ConsensusMethod;
      }
      
      if (timeout && typeof timeout === 'string') {
        const timeoutNum = parseInt(timeout);
        if (!isNaN(timeoutNum)) {
          options.timeout = timeoutNum;
        }
      }

      // Handle system queries differently
      const lowerQuery = query.toLowerCase();
      const startTime = Date.now();
      
      // Check for system information requests
      if (lowerQuery.includes('provider') || lowerQuery.includes('service') || 
          lowerQuery.includes('available') || lowerQuery.includes('balance')) {
        const executionTime = Date.now() - startTime;
        
        const providers = this.oracleRouter.getProviders();
        const systemInfo = {
          available_providers: providers.map(p => ({
            name: p.name,
            weight: p.weight,
            reliability: p.reliability,
            latency: p.latency
          })),
          total_providers: providers.length,
          system_health: providers.filter(p => p.reliability > 0.8).length / providers.length,
          query_processed: query
        };

        res.json({
          success: true,
          data: {
            query,
            result: systemInfo,
            confidence: 1.0,
            consensus_method: 'system_info',
            sources: ['oracle_router'],
            timestamp: new Date().toISOString(),
            execution_time_ms: executionTime
          },
          metadata: {
            raw_responses: 1,
            query_options: options,
            query_type: 'system_info'
          }
        });
        return;
      }

      const result = await this.oracleRouter.query(query, options);
      const executionTime = Date.now() - startTime;

      // Generate unique query ID for tracking
      const queryId = `query_${Buffer.from(query).toString('base64').substring(0, 10)}_${Date.now()}`;
      const userSessionId = req.headers['x-session-id'] as string || req.ip || 'anonymous';

      // Log to HCS and get topic ID
      let hcsTopicId: string | null = null;
      let blockchainHash: string | null = null;
      let blockchainLink: string | null = null;

      if (this.hederaLogger) {
        try {
          const oracleQuery = {
            id: queryId,
            query,
            timestamp: new Date(),
            type: OracleQueryType.CUSTOM,
            requester: userSessionId,
            options
          };
          
          const transactionId = await this.hederaLogger.logOracleResult(oracleQuery, result);
          const topicInfo = this.hederaLogger.getTopicInfo();
          
          hcsTopicId = topicInfo.topicId;
          blockchainHash = transactionId;
          blockchainLink = `https://hashscan.io/testnet/transaction/${transactionId}`;
          
          console.log(`🔗 Query logged to HCS topic ${hcsTopicId}: ${transactionId}`);
        } catch (hcsError) {
          console.error('❌ HCS logging failed:', hcsError);
        }
      }

      // Save to database with HCS topic ID
      try {
        await supabaseService.saveQueryHistory({
          query_id: queryId,
          user_session_id: userSessionId,
          query,
          provider: result.sources?.[0] || 'unknown',
          answer: typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value),
          oracle_used: result.sources?.[0] || 'unknown',
          oracle_info: {
            method: result.method,
            confidence: result.confidence,
            execution_time_ms: executionTime,
            sources: result.sources
          },
          data_sources: result.sources,
          confidence: result.confidence,
          raw_data: result.rawResponses || result.raw_responses,
          blockchain_hash: blockchainHash || undefined,
          blockchain_link: blockchainLink || undefined,
          hcs_topic_id: hcsTopicId || undefined, // 🔥 CRITICAL: Save HCS topic ID
          execution_time_ms: executionTime,
          cost_tinybars: Math.floor(Math.random() * 100) // Placeholder cost calculation
        });
        
        console.log(`💾 Query saved to database with topic ID: ${hcsTopicId}`);
      } catch (dbError) {
        console.error('❌ Database save failed:', dbError);
      }

      // Handle conversational AI responses specially
      if (result.metadata?.isConversational) {
        res.json({
          success: true,
          data: {
            query,
            result: {
              response: result.value.response,
              type: 'conversational',
              intent: result.value.intent
            },
            confidence: result.confidence,
            consensus_method: result.method,
            sources: result.sources,
            timestamp: result.timestamp,
            execution_time_ms: executionTime
          },
          metadata: {
            isConversational: true,
            intent: result.value.intent,
            raw_responses: result.rawResponses?.length || 0,
            query_options: options
          }
        });
      } else {
        // Regular oracle response
        res.json({
          success: true,
          data: {
            query,
            result: result.value,
            confidence: result.confidence,
            consensus_method: result.method,
            sources: result.sources,
            timestamp: result.timestamp,
            execution_time_ms: executionTime
          },
          metadata: {
            isConversational: false,
            raw_responses: result.raw_responses?.length || 0,
            query_options: options
          }
        });
      }

    } catch (error: any) {
      console.error('❌ Oracle query API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/oracle/price/:symbol - Get cryptocurrency price
   */
  async getPrice(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { sources, method } = req.query;

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol parameter is required'
        });
        return;
      }

      const options: OracleQueryOptions = {};
      if (sources && typeof sources === 'string') {
        options.sources = sources.split(',').map(s => s.trim());
      }
      if (method && typeof method === 'string') {
        options.consensusMethod = method as ConsensusMethod;
      }

      const result = await this.oracleRouter.query(`${symbol} price`, options);

      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          price: result.value.price || result.value,
          confidence: result.confidence,
          sources: result.sources,
          timestamp: result.timestamp,
          market_data: result.value.market_cap ? {
            market_cap: result.value.market_cap,
            volume_24h: result.value.volume_24h,
            change_24h: result.value.change_24h
          } : undefined
        }
      });

    } catch (error: any) {
      console.error('❌ Price API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/oracle/weather/:location - Get weather data
   */
  async getWeather(req: Request, res: Response): Promise<void> {
    try {
      const { location } = req.params;

      if (!location) {
        res.status(400).json({
          success: false,
          error: 'Location parameter is required'
        });
        return;
      }

      const result = await this.oracleRouter.query(`weather in ${location}`);

      res.json({
        success: true,
        data: {
          location: result.value.location || location,
          temperature: result.value.temperature,
          feels_like: result.value.feels_like,
          humidity: result.value.humidity,
          pressure: result.value.pressure,
          visibility: result.value.visibility,
          wind: {
            speed: result.value.wind_speed,
            direction: result.value.wind_direction
          },
          weather: {
            main: result.value.weather_main,
            description: result.value.weather_description,
            icon: result.value.weather_icon
          },
          confidence: result.confidence,
          sources: result.sources,
          timestamp: result.timestamp
        }
      });

    } catch (error: any) {
      console.error('❌ Weather API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/oracle/providers - List available oracle providers
   */
  async getProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = this.oracleRouter.getProviders();
      const healthStatus = await this.oracleRouter.healthCheckAll();

      const providersData = await Promise.all(
        providers.map(async (provider) => {
          const metrics = await provider.getMetrics();
          const isHealthy = healthStatus.get(provider.name) || false;

          return {
            name: provider.name,
            weight: provider.weight,
            reliability: provider.reliability,
            latency: provider.latency,
            healthy: isHealthy,
            metrics: {
              total_queries: metrics.totalQueries,
              successful_queries: metrics.successfulQueries,
              success_rate: metrics.reliability,
              average_latency: metrics.averageLatency,
              last_health_check: metrics.lastHealthCheck
            }
          };
        })
      );

      res.json({
        success: true,
        data: {
          total_providers: providers.length,
          active_providers: Array.from(healthStatus.values()).filter(h => h).length,
          providers: providersData
        }
      });

    } catch (error: any) {
      console.error('❌ Providers API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/oracle/status - Get system status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.oracleRouter.getSystemStats();
      const healthStatus = await this.oracleRouter.healthCheckAll();

      // Get chatbot status if available
      let chatbotStats = null;
      if (this.chatbotManager) {
        chatbotStats = this.chatbotManager.getStats();
      }

      res.json({
        success: true,
        data: {
          system: {
            total_providers: stats.total_providers,
            active_providers: stats.active_providers,
            system_health: stats.system_health,
            last_check: stats.last_check
          },
          providers: stats.provider_details,
          health_status: Object.fromEntries(healthStatus),
          chatbots: chatbotStats,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Status API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/oracle/health-check - Perform health check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthResults = await this.oracleRouter.healthCheckAll();
      
      // Also check chatbots if available
      let chatbotHealth = null;
      if (this.chatbotManager) {
        chatbotHealth = await this.chatbotManager.healthCheck();
      }

      const totalProviders = Array.from(healthResults.values()).length;
      const healthyProviders = Array.from(healthResults.values()).filter(h => h).length;
      const systemHealth = totalProviders > 0 ? healthyProviders / totalProviders : 0;

      res.json({
        success: true,
        data: {
          system_health: systemHealth,
          providers: Object.fromEntries(healthResults),
          chatbots: chatbotHealth ? Object.fromEntries(chatbotHealth) : null,
          healthy_providers: healthyProviders,
          total_providers: totalProviders,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Health check API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/oracle/chatbot/message - Send message via chatbot
   */
  async sendChatbotMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!this.chatbotManager) {
        res.status(503).json({
          success: false,
          error: 'Chatbot system not available'
        });
        return;
      }

      const { platform, channel_id, message } = req.body;

      if (!platform || !channel_id || !message) {
        res.status(400).json({
          success: false,
          error: 'platform, channel_id, and message are required'
        });
        return;
      }

      await this.chatbotManager.sendMessage(platform, channel_id, message);

      res.json({
        success: true,
        data: {
          platform,
          channel_id,
          message,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Chatbot message API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/oracle/chatbot/broadcast - Broadcast announcement
   */
  async broadcastAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      if (!this.chatbotManager) {
        res.status(503).json({
          success: false,
          error: 'Chatbot system not available'
        });
        return;
      }

      const { message } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          error: 'message is required'
        });
        return;
      }

      await this.chatbotManager.broadcastAnnouncement(message);

      res.json({
        success: true,
        data: {
          message,
          broadcasted_at: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ Broadcast API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/oracle/chatbot/stats - Get chatbot statistics
   */
  async getChatbotStats(req: Request, res: Response): Promise<void> {
    try {
      if (!this.chatbotManager) {
        res.status(503).json({
          success: false,
          error: 'Chatbot system not available'
        });
        return;
      }

      const stats = this.chatbotManager.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('❌ Chatbot stats API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/oracle/batch - Batch oracle queries
   */
  async batchQuery(req: Request, res: Response): Promise<void> {
    try {
      const { queries } = req.body;

      if (!Array.isArray(queries) || queries.length === 0) {
        res.status(400).json({
          success: false,
          error: 'queries array is required and must not be empty'
        });
        return;
      }

      if (queries.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Maximum 10 queries allowed per batch'
        });
        return;
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(
        queries.map(async (queryItem: any) => {
          const { query, sources, method, timeout } = queryItem;
          
          const options: OracleQueryOptions = {};
          if (sources) options.sources = sources;
          if (method) options.consensusMethod = method as ConsensusMethod;
          if (timeout) options.timeout = timeout;

          const result = await this.oracleRouter.query(query, options);
          return {
            query,
            result: result.value,
            confidence: result.confidence,
            sources: result.sources,
            timestamp: result.timestamp
          };
        })
      );

      const executionTime = Date.now() - startTime;

      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const failedResults = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => ({ error: result.reason.message }));

      res.json({
        success: true,
        data: {
          total_queries: queries.length,
          successful_queries: successfulResults.length,
          failed_queries: failedResults.length,
          execution_time_ms: executionTime,
          results: successfulResults,
          errors: failedResults
        }
      });

    } catch (error: any) {
      console.error('❌ Batch query API error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}