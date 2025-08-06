/**
 * Oracle API Controller Tests
 */

import { Request, Response } from 'express';
import { OracleAPIController } from '../../api/OracleAPIController';
import { OracleRouter } from '../../OracleRouter';
import { ChatbotManager } from '../../chatbot/ChatbotManager';
import { MockOracleProvider, MockDiscordClient, setupTestEnvironment } from '../utils/testUtils';

// Mock Express request and response objects
const createMockRequest = (query: any = {}, params: any = {}, body: any = {}): Partial<Request> => ({
  query,
  params,
  body,
  ip: '127.0.0.1'
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res;
};

describe('OracleAPIController', () => {
  let controller: OracleAPIController;
  let oracleRouter: OracleRouter;
  let chatbotManager: ChatbotManager;
  let mockProviders: MockOracleProvider[];

  beforeEach(async () => {
    const testEnv = await setupTestEnvironment();
    mockProviders = testEnv.providers;

    // Create oracle router with mock providers
    oracleRouter = new OracleRouter();
    mockProviders.forEach(provider => {
      oracleRouter.registerProvider(provider);
    });

    // Create chatbot manager
    chatbotManager = new ChatbotManager(oracleRouter, {
      chatbot: {
        discord: { enabled: false, token: '', channels: [] },
        slack: { enabled: false, token: '', channels: [] },
        telegram: { enabled: false, token: '', channels: [] }
      }
    } as any);

    controller = new OracleAPIController(oracleRouter, chatbotManager);
  });

  describe('query endpoint', () => {
    it('should handle valid query requests', async () => {
      const req = createMockRequest({ q: 'BTC price', method: 'median' });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            query: 'BTC price',
            result: expect.any(Object),
            confidence: expect.any(Number),
            sources: expect.any(Array)
          })
        })
      );
    });

    it('should return 400 for missing query parameter', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Query parameter "q" is required'
        })
      );
    });

    it('should handle source filtering', async () => {
      const req = createMockRequest({ 
        q: 'BTC price', 
        sources: 'mock-provider-0,mock-provider-1' 
      });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            sources: expect.arrayContaining(['mock-provider-0', 'mock-provider-1'])
          })
        })
      );
    });

    it('should handle consensus method selection', async () => {
      const req = createMockRequest({ 
        q: 'BTC price', 
        method: 'weighted_average'
      });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            consensus_method: 'weighted_average'
          })
        })
      );
    });

    it('should handle timeout parameter', async () => {
      const req = createMockRequest({ 
        q: 'BTC price', 
        timeout: '3000'
      });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should handle query failures', async () => {
      // Make all providers fail
      mockProviders.forEach(provider => provider.setFailure(true));

      const req = createMockRequest({ q: 'BTC price' });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });

  describe('getPrice endpoint', () => {
    it('should handle valid price requests', async () => {
      const req = createMockRequest({}, { symbol: 'BTC' });
      const res = createMockResponse();

      // Set price data
      mockProviders.forEach((provider, i) => {
        provider.setResponseData({ price: 42000 + (i * 100) });
      });

      await controller.getPrice(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            symbol: 'BTC',
            price: expect.any(Number),
            confidence: expect.any(Number),
            sources: expect.any(Array)
          })
        })
      );
    });

    it('should return 400 for missing symbol', async () => {
      const req = createMockRequest({}, {});
      const res = createMockResponse();

      await controller.getPrice(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Symbol parameter is required'
        })
      );
    });

    it('should include market data when available', async () => {
      const req = createMockRequest({}, { symbol: 'BTC' });
      const res = createMockResponse();

      // Set detailed price data
      mockProviders[0].setResponseData({
        price: 42000,
        market_cap: 800000000000,
        volume_24h: 25000000000,
        change_24h: 2.5
      });

      await controller.getPrice(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            market_data: expect.objectContaining({
              market_cap: expect.any(Number),
              volume_24h: expect.any(Number),
              change_24h: expect.any(Number)
            })
          })
        })
      );
    });
  });

  describe('getWeather endpoint', () => {
    it('should handle valid weather requests', async () => {
      const req = createMockRequest({}, { location: 'London' });
      const res = createMockResponse();

      // Set weather data
      mockProviders.forEach(provider => {
        provider.setResponseData({
          location: 'London',
          temperature: 15,
          humidity: 65,
          weather_description: 'cloudy'
        });
      });

      await controller.getWeather(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            location: 'London',
            temperature: expect.any(Number),
            humidity: expect.any(Number),
            weather: expect.objectContaining({
              description: expect.any(String)
            })
          })
        })
      );
    });

    it('should return 400 for missing location', async () => {
      const req = createMockRequest({}, {});
      const res = createMockResponse();

      await controller.getWeather(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Location parameter is required'
        })
      );
    });
  });

  describe('getProviders endpoint', () => {
    it('should return provider information', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getProviders(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total_providers: 3,
            active_providers: expect.any(Number),
            providers: expect.arrayContaining([
              expect.objectContaining({
                name: expect.any(String),
                weight: expect.any(Number),
                reliability: expect.any(Number),
                healthy: expect.any(Boolean),
                metrics: expect.any(Object)
              })
            ])
          })
        })
      );
    });
  });

  describe('getStatus endpoint', () => {
    it('should return system status', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getStatus(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            system: expect.objectContaining({
              total_providers: expect.any(Number),
              active_providers: expect.any(Number),
              system_health: expect.any(Number)
            }),
            providers: expect.any(Array),
            health_status: expect.any(Object),
            uptime: expect.any(Number)
          })
        })
      );
    });
  });

  describe('healthCheck endpoint', () => {
    it('should perform health check', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.healthCheck(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            system_health: expect.any(Number),
            providers: expect.any(Object),
            healthy_providers: expect.any(Number),
            total_providers: expect.any(Number)
          })
        })
      );
    });
  });

  describe('batchQuery endpoint', () => {
    it('should handle batch queries', async () => {
      const req = createMockRequest({}, {}, {
        queries: [
          { query: 'BTC price', method: 'median' },
          { query: 'ETH price', sources: ['mock-provider-0'] },
          { query: 'weather in London' }
        ]
      });
      const res = createMockResponse();

      await controller.batchQuery(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total_queries: 3,
            successful_queries: expect.any(Number),
            results: expect.any(Array),
            execution_time_ms: expect.any(Number)
          })
        })
      );
    });

    it('should return 400 for invalid batch request', async () => {
      const req = createMockRequest({}, {}, { queries: [] });
      const res = createMockResponse();

      await controller.batchQuery(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'queries array is required and must not be empty'
        })
      );
    });

    it('should limit batch size', async () => {
      const largeQueries = Array(15).fill(0).map((_, i) => ({ query: `query ${i}` }));
      const req = createMockRequest({}, {}, { queries: largeQueries });
      const res = createMockResponse();

      await controller.batchQuery(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Maximum 10 queries allowed per batch'
        })
      );
    });

    it('should handle partial failures in batch', async () => {
      // Make some providers fail
      mockProviders[0].setFailure(true);

      const req = createMockRequest({}, {}, {
        queries: [
          { query: 'BTC price', sources: ['mock-provider-0'] }, // Will fail
          { query: 'ETH price', sources: ['mock-provider-1'] }  // Will succeed
        ]
      });
      const res = createMockResponse();

      await controller.batchQuery(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total_queries: 2,
            successful_queries: expect.any(Number),
            failed_queries: expect.any(Number),
            results: expect.any(Array),
            errors: expect.any(Array)
          })
        })
      );
    });
  });

  describe('Chatbot endpoints', () => {
    describe('sendChatbotMessage', () => {
      it('should send chatbot message', async () => {
        const req = createMockRequest({}, {}, {
          platform: 'discord',
          channel_id: '123456789',
          message: 'Test message'
        });
        const res = createMockResponse();

        // Mock the chatbot manager method
        jest.spyOn(chatbotManager, 'sendMessage').mockResolvedValue();

        await controller.sendChatbotMessage(req as Request, res as Response);

        expect(chatbotManager.sendMessage).toHaveBeenCalledWith(
          'discord',
          '123456789',
          'Test message'
        );

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              platform: 'discord',
              channel_id: '123456789',
              message: 'Test message'
            })
          })
        );
      });

      it('should return 400 for missing parameters', async () => {
        const req = createMockRequest({}, {}, { platform: 'discord' });
        const res = createMockResponse();

        await controller.sendChatbotMessage(req as Request, res as Response);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'platform, channel_id, and message are required'
          })
        );
      });
    });

    describe('broadcastAnnouncement', () => {
      it('should broadcast announcement', async () => {
        const req = createMockRequest({}, {}, {
          message: 'System maintenance notice'
        });
        const res = createMockResponse();

        jest.spyOn(chatbotManager, 'broadcastAnnouncement').mockResolvedValue();

        await controller.broadcastAnnouncement(req as Request, res as Response);

        expect(chatbotManager.broadcastAnnouncement).toHaveBeenCalledWith(
          'System maintenance notice'
        );

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              message: 'System maintenance notice'
            })
          })
        );
      });
    });

    describe('getChatbotStats', () => {
      it('should return chatbot statistics', async () => {
        const req = createMockRequest();
        const res = createMockResponse();

        const mockStats = {
          total_platforms: 1,
          active_bots: 1,
          platforms: []
        };

        jest.spyOn(chatbotManager, 'getStats').mockReturnValue(mockStats);

        await controller.getChatbotStats(req as Request, res as Response);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: mockStats
          })
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should handle oracle router errors', async () => {
      jest.spyOn(oracleRouter, 'query').mockRejectedValue(new Error('Oracle system error'));

      const req = createMockRequest({ q: 'BTC price' });
      const res = createMockResponse();

      await controller.query(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Oracle system error'
        })
      );
    });

    it('should handle chatbot manager errors', async () => {
      jest.spyOn(chatbotManager, 'sendMessage').mockRejectedValue(new Error('Bot error'));

      const req = createMockRequest({}, {}, {
        platform: 'discord',
        channel_id: '123456789',
        message: 'Test'
      });
      const res = createMockResponse();

      await controller.sendChatbotMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Bot error'
        })
      );
    });
  });

  describe('Controller without chatbot manager', () => {
    let controllerWithoutChatbot: OracleAPIController;

    beforeEach(() => {
      controllerWithoutChatbot = new OracleAPIController(oracleRouter);
    });

    it('should return 503 for chatbot endpoints when no manager', async () => {
      const req = createMockRequest({}, {}, {
        platform: 'discord',
        channel_id: '123',
        message: 'test'
      });
      const res = createMockResponse();

      await controllerWithoutChatbot.sendChatbotMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Chatbot system not available'
        })
      );
    });
  });
});