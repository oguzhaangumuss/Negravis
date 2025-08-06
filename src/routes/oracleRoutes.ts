import express, { Request, Response } from 'express';
import { oracleManager } from '../services/oracleManager';

const router = express.Router();

/**
 * @swagger
 * /api/oracles/price/{symbol}:
 *   get:
 *     summary: Get aggregated price from multiple oracle providers
 *     tags: [Oracles]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (BTC, ETH, etc.)
 *     responses:
 *       200:
 *         description: Aggregated price data
 *       404:
 *         description: Price not found
 *       500:
 *         description: Oracle error
 */
router.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    console.log(`📊 API: Getting aggregated price for ${symbol}`);

    const aggregatedData = await oracleManager.getAggregatedPrice(symbol);
    
    res.json({
      success: true,
      data: aggregatedData.data,
      metadata: {
        sources: aggregatedData.sources,
        consensus: aggregatedData.consensus,
        method: aggregatedData.method,
        timestamp: aggregatedData.timestamp,
        providersUsed: aggregatedData.sources.length
      }
    });

  } catch (error: any) {
    console.error('❌ Oracle price API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/oracles/weather/{location}:
 *   get:
 *     summary: Get weather data from oracle providers
 *     tags: [Oracles]
 *     parameters:
 *       - in: path
 *         name: location
 *         required: true
 *         schema:
 *           type: string
 *         description: Location name (London, New York, etc.)
 *     responses:
 *       200:
 *         description: Weather data
 *       404:
 *         description: Location not found
 *       500:
 *         description: Oracle error
 */
router.get('/weather/:location', async (req: Request, res: Response) => {
  try {
    const { location } = req.params;
    console.log(`🌤️ API: Getting weather data for ${location}`);

    const aggregatedData = await oracleManager.getWeatherData(location);
    
    res.json({
      success: true,
      data: aggregatedData.data,
      metadata: {
        sources: aggregatedData.sources,
        consensus: aggregatedData.consensus,
        method: aggregatedData.method,
        timestamp: aggregatedData.timestamp
      }
    });

  } catch (error: any) {
    console.error('❌ Oracle weather API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/oracles/providers:
 *   get:
 *     summary: Get all oracle providers and their status
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: List of oracle providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = oracleManager.getAllProviders();
    const activeCount = oracleManager.getActiveProviders().length;
    
    const providersInfo = providers.map(node => ({
      id: node.id,
      name: node.provider.name,
      dataSource: node.provider.dataSource,
      status: node.status,
      reliability: node.provider.reliability,
      updateFrequency: node.provider.updateFrequency,
      stats: {
        totalRequests: node.totalRequests,
        successRate: node.successRate,
        avgResponseTime: node.avgResponseTime,
        lastHealthCheck: node.lastHealthCheck
      },
      supportedSymbols: node.provider.getSupportedSymbols(),
      providerInfo: node.provider.getProviderInfo()
    }));

    res.json({
      success: true,
      data: {
        providers: providersInfo,
        summary: {
          total: providers.length,
          active: activeCount,
          inactive: providers.length - activeCount
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Oracle providers API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/oracles/supported:
 *   get:
 *     summary: Get all supported symbols across all providers
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: Supported symbols by category
 */
router.get('/supported', async (req: Request, res: Response) => {
  try {
    const providers = oracleManager.getActiveProviders();
    
    const priceSymbols = new Set<string>();
    const weatherLocations = new Set<string>();
    
    providers.forEach(node => {
      const symbols = node.provider.getSupportedSymbols();
      
      if (node.provider.dataSource === 'coingecko') {
        symbols.forEach(symbol => priceSymbols.add(symbol));
      } else if (node.provider.dataSource === 'openweathermap') {
        symbols.forEach(location => weatherLocations.add(location));
      }
    });

    res.json({
      success: true,
      data: {
        prices: Array.from(priceSymbols).sort(),
        weather: Array.from(weatherLocations).sort(),
        providers: providers.map(node => ({
          name: node.provider.name,
          dataSource: node.provider.dataSource,
          supported: node.provider.getSupportedSymbols()
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ Oracle supported API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/oracles/health:
 *   get:
 *     summary: Get oracle manager health status
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: Health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const providers = oracleManager.getAllProviders();
    const activeProviders = oracleManager.getActiveProviders();
    
    const healthStatus = {
      isReady: oracleManager.isReady(),
      totalProviders: providers.length,
      activeProviders: activeProviders.length,
      healthyPercentage: providers.length > 0 ? (activeProviders.length / providers.length) * 100 : 0,
      providers: providers.map(node => ({
        id: node.id,
        name: node.provider.name,
        status: node.status,
        lastHealthCheck: node.lastHealthCheck,
        successRate: node.successRate
      })),
      timestamp: Date.now()
    };

    const statusCode = healthStatus.isReady ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthStatus.isReady,
      data: healthStatus
    });

  } catch (error: any) {
    console.error('❌ Oracle health API error:', error.message);
    res.status(503).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/oracles/stats:
 *   get:
 *     summary: Get oracle system statistics
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: Oracle statistics retrieved successfully
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const providers = oracleManager.getAllProviders();
    
    const stats = {
      system: {
        totalProviders: providers.length,
        activeProviders: oracleManager.getActiveProviders().length,
        uptime: Date.now() - oracleManager.getStartTime(),
        totalRequests: providers.reduce((sum, node) => sum + node.stats.totalRequests, 0),
        totalSuccesses: providers.reduce((sum, node) => sum + node.stats.successfulRequests, 0)
      },
      providers: providers.map(node => ({
        id: node.id,
        name: node.provider.name,
        dataSource: node.provider.dataSource,
        status: node.status,
        reliability: node.provider.reliability,
        stats: {
          totalRequests: node.stats.totalRequests,
          successfulRequests: node.stats.successfulRequests,
          successRate: node.successRate,
          avgResponseTime: node.stats.avgResponseTime,
          lastUpdate: node.stats.lastUpdate
        }
      })),
      timestamp: Date.now()
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;