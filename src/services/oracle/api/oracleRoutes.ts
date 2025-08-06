import { Router } from 'express';
import { OracleAPIController } from './OracleAPIController';
import { OracleRouter } from '../OracleRouter';
import { ChatbotManager } from '../chatbot/ChatbotManager';

/**
 * Oracle API Routes
 * REST endpoints for oracle system
 */
export function createOracleRoutes(
  oracleRouter: OracleRouter,
  chatbotManager?: ChatbotManager
): Router {
  const router = Router();
  const controller = new OracleAPIController(oracleRouter, chatbotManager);

  // Middleware for API key validation (optional)
  const validateApiKey = (req: any, res: any, next: any) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    // Skip validation in development or if no API key is configured
    const requiredApiKey = process.env.ORACLE_API_KEY;
    if (!requiredApiKey) {
      return next();
    }

    if (!apiKey || apiKey !== requiredApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing API key'
      });
    }

    next();
  };

  // Middleware for rate limiting (basic implementation)
  const rateLimit = (req: any, res: any, next: any) => {
    // Simple in-memory rate limiting
    if (!(global as any).rateLimitMap) {
      (global as any).rateLimitMap = new Map();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 60; // 60 requests per minute

    const clientData = (global as any).rateLimitMap.get(clientIP) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        reset_time: clientData.resetTime
      });
    }

    clientData.count++;
    (global as any).rateLimitMap.set(clientIP, clientData);
    next();
  };

  // Apply middleware
  router.use(rateLimit);
  router.use(validateApiKey);

  // Core oracle endpoints
  router.get('/query', controller.query.bind(controller));
  router.get('/price/:symbol', controller.getPrice.bind(controller));
  router.get('/weather/:location', controller.getWeather.bind(controller));
  
  // System information endpoints
  router.get('/providers', controller.getProviders.bind(controller));
  router.get('/status', controller.getStatus.bind(controller));
  router.post('/health-check', controller.healthCheck.bind(controller));

  // Batch processing
  router.post('/batch', controller.batchQuery.bind(controller));

  // Chatbot endpoints (if chatbot manager is available)
  if (chatbotManager) {
    router.post('/chatbot/message', controller.sendChatbotMessage.bind(controller));
    router.post('/chatbot/broadcast', controller.broadcastAnnouncement.bind(controller));
    router.get('/chatbot/stats', controller.getChatbotStats.bind(controller));
  }

  // API documentation endpoint
  router.get('/docs', (req, res) => {
    res.json({
      success: true,
      data: {
        title: 'Oracle API Documentation',
        version: '1.0.0',
        endpoints: [
          {
            method: 'GET',
            path: '/api/oracle/query',
            description: 'General oracle query with natural language processing',
            parameters: [
              { name: 'q', type: 'string', required: true, description: 'Query text' },
              { name: 'sources', type: 'string', required: false, description: 'Comma-separated provider names' },
              { name: 'method', type: 'string', required: false, description: 'Consensus method (median, weighted_average, etc.)' },
              { name: 'timeout', type: 'number', required: false, description: 'Timeout in milliseconds' }
            ],
            example: '/api/oracle/query?q=Bitcoin%20price&sources=coingecko,chainlink&method=median'
          },
          {
            method: 'GET',
            path: '/api/oracle/price/:symbol',
            description: 'Get cryptocurrency price',
            parameters: [
              { name: 'symbol', type: 'string', required: true, description: 'Cryptocurrency symbol (BTC, ETH, etc.)' },
              { name: 'sources', type: 'string', required: false, description: 'Comma-separated provider names' }
            ],
            example: '/api/oracle/price/BTC?sources=coingecko'
          },
          {
            method: 'GET',
            path: '/api/oracle/weather/:location',
            description: 'Get weather data for location',
            parameters: [
              { name: 'location', type: 'string', required: true, description: 'City name or location' }
            ],
            example: '/api/oracle/weather/London'
          },
          {
            method: 'GET',
            path: '/api/oracle/providers',
            description: 'List all available oracle providers with health status'
          },
          {
            method: 'GET',
            path: '/api/oracle/status',
            description: 'Get system status and health information'
          },
          {
            method: 'POST',
            path: '/api/oracle/health-check',
            description: 'Perform health check on all providers'
          },
          {
            method: 'POST',
            path: '/api/oracle/batch',
            description: 'Execute multiple oracle queries in batch',
            body: {
              queries: [
                { query: 'BTC price', sources: ['coingecko'], method: 'median' },
                { query: 'weather in Tokyo', timeout: 5000 }
              ]
            }
          },
          {
            method: 'POST',
            path: '/api/oracle/chatbot/message',
            description: 'Send message via chatbot (requires chatbot system)',
            body: {
              platform: 'discord',
              channel_id: '123456789',
              message: 'Oracle system update'
            }
          },
          {
            method: 'POST',
            path: '/api/oracle/chatbot/broadcast',
            description: 'Broadcast announcement to all platforms',
            body: {
              message: 'System maintenance scheduled'
            }
          },
          {
            method: 'GET',
            path: '/api/oracle/chatbot/stats',
            description: 'Get chatbot statistics'
          }
        ],
        authentication: {
          method: 'API Key',
          header: 'x-api-key',
          query_param: 'api_key',
          description: 'Set ORACLE_API_KEY environment variable to enable authentication'
        },
        rate_limiting: {
          window: '1 minute',
          max_requests: 60,
          per: 'IP address'
        },
        consensus_methods: [
          'median',
          'weighted_average',
          'majority_vote',
          'confidence_weighted'
        ],
        supported_providers: [
          'chainlink',
          'coingecko',
          'weather',
          'web-scraping'
        ]
      }
    });
  });

  // Health check endpoint for load balancers
  router.get('/ping', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  });

  return router;
}

/**
 * Create Oracle API middleware for Express app
 */
export function createOracleAPIMiddleware(
  oracleRouter: OracleRouter,
  chatbotManager?: ChatbotManager
) {
  return {
    // CORS middleware
    cors: (req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    },

    // JSON parsing with error handling
    jsonParser: (req: any, res: any, next: any) => {
      if (req.is('json')) {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            req.body = JSON.parse(body);
            next();
          } catch (error) {
            res.status(400).json({
              success: false,
              error: 'Invalid JSON in request body'
            });
          }
        });
      } else {
        next();
      }
    },

    // Error handling middleware
    errorHandler: (error: any, req: any, res: any, next: any) => {
      console.error('Oracle API error:', error);
      
      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  };
}