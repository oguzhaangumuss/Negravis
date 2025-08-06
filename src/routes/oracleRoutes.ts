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

/**
 * @swagger
 * /api/oracles/dynamic/{symbol}:
 *   get:
 *     summary: Get aggregated price using dynamic oracle selection
 *     tags: [Oracles]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (BTC, ETH, etc.)
 *       - in: query
 *         name: minProviders
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Minimum number of providers to use
 *       - in: query
 *         name: maxProviders
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Maximum number of providers to use
 *       - in: query
 *         name: outlierThreshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         description: Outlier detection threshold (0-1)
 *       - in: query
 *         name: weightingStrategy
 *         schema:
 *           type: string
 *           enum: [equal, reliability, performance, stake, dynamic]
 *         description: Weighting strategy for oracle selection
 *       - in: query
 *         name: aggregationMethod
 *         schema:
 *           type: string
 *           enum: [median, weightedMedian, average, weightedAverage]
 *         description: Aggregation method for combining results
 *     responses:
 *       200:
 *         description: Dynamic oracle selection result
 *       500:
 *         description: Oracle error
 */
router.get('/dynamic/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const {
      minProviders,
      maxProviders,
      outlierThreshold,
      weightingStrategy,
      aggregationMethod
    } = req.query;

    console.log(`🎯 API: Dynamic oracle selection for ${symbol}`);

    // Build selection criteria
    const criteria: any = {};
    if (minProviders) criteria.minProviders = parseInt(minProviders as string);
    if (maxProviders) criteria.maxProviders = parseInt(maxProviders as string);
    if (outlierThreshold) criteria.outlierThreshold = parseFloat(outlierThreshold as string);
    if (weightingStrategy) criteria.weightingStrategy = weightingStrategy;
    if (aggregationMethod) criteria.aggregationMethod = aggregationMethod;

    const aggregatedData = await oracleManager.getAggregatedDataWithSelection(
      'price',
      symbol,
      criteria
    );
    
    res.json({
      success: true,
      data: aggregatedData.data,
      metadata: {
        sources: aggregatedData.sources,
        consensus: aggregatedData.consensus,
        method: aggregatedData.method,
        timestamp: aggregatedData.timestamp,
        weights: aggregatedData.weights,
        outliers: aggregatedData.outliers,
        confidence: aggregatedData.confidence,
        qualityMetrics: aggregatedData.qualityMetrics,
        providersUsed: aggregatedData.sources.length,
        outliersRemoved: aggregatedData.outliers?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Dynamic oracle API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/oracles/selection-criteria:
 *   get:
 *     summary: Get current oracle selection criteria
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: Current selection criteria
 *   put:
 *     summary: Update oracle selection criteria
 *     tags: [Oracles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minProviders:
 *                 type: integer
 *                 minimum: 1
 *               maxProviders:
 *                 type: integer
 *                 minimum: 1
 *               outlierThreshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               consensusThreshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               weightingStrategy:
 *                 type: string
 *                 enum: [equal, reliability, performance, stake, dynamic]
 *               aggregationMethod:
 *                 type: string
 *                 enum: [median, weightedMedian, average, weightedAverage]
 *     responses:
 *       200:
 *         description: Selection criteria updated
 *       400:
 *         description: Invalid criteria
 */
router.get('/selection-criteria', async (req: Request, res: Response) => {
  try {
    const criteria = oracleManager.getSelectionCriteria();
    
    res.json({
      success: true,
      data: criteria
    });

  } catch (error: any) {
    console.error('❌ Selection criteria API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/selection-criteria', async (req: Request, res: Response) => {
  try {
    const criteria = req.body;
    
    // Validate criteria
    if (criteria.minProviders && criteria.minProviders < 1) {
      return res.status(400).json({
        success: false,
        error: 'minProviders must be at least 1'
      });
    }
    
    if (criteria.maxProviders && criteria.maxProviders < 1) {
      return res.status(400).json({
        success: false,
        error: 'maxProviders must be at least 1'
      });
    }
    
    if (criteria.outlierThreshold && (criteria.outlierThreshold < 0 || criteria.outlierThreshold > 1)) {
      return res.status(400).json({
        success: false,
        error: 'outlierThreshold must be between 0 and 1'
      });
    }

    oracleManager.updateSelectionCriteria(criteria);
    const updatedCriteria = oracleManager.getSelectionCriteria();
    
    res.json({
      success: true,
      data: updatedCriteria,
      message: 'Selection criteria updated successfully'
    });

  } catch (error: any) {
    console.error('❌ Update selection criteria API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/oracles/metrics:
 *   get:
 *     summary: Get detailed provider metrics for monitoring
 *     tags: [Oracles]
 *     responses:
 *       200:
 *         description: Provider metrics retrieved successfully
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = oracleManager.getProviderMetrics();
    
    const aggregatedMetrics = {
      providers: metrics,
      summary: {
        totalProviders: metrics.length,
        averageScore: metrics.reduce((sum, m) => sum + (m.selectionScore || 0), 0) / metrics.length,
        topPerformers: metrics
          .filter(m => m.selectionScore && m.selectionScore > 80)
          .map(m => ({ id: m.id, name: m.name, score: m.selectionScore })),
        underPerformers: metrics
          .filter(m => m.selectionScore && m.selectionScore < 50)
          .map(m => ({ id: m.id, name: m.name, score: m.selectionScore }))
      },
      timestamp: Date.now()
    };
    
    res.json({
      success: true,
      data: aggregatedMetrics
    });

  } catch (error: any) {
    console.error('❌ Provider metrics API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/oracles/select-best:
 *   post:
 *     summary: Get best oracle providers for a specific data type
 *     tags: [Oracles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dataType
 *             properties:
 *               dataType:
 *                 type: string
 *                 enum: [price, weather]
 *               criteria:
 *                 type: object
 *                 properties:
 *                   minProviders:
 *                     type: integer
 *                   maxProviders:
 *                     type: integer
 *                   weightingStrategy:
 *                     type: string
 *                     enum: [equal, reliability, performance, stake, dynamic]
 *     responses:
 *       200:
 *         description: Best providers selected
 *       400:
 *         description: Invalid request
 */
router.post('/select-best', async (req: Request, res: Response) => {
  try {
    const { dataType, criteria = {} } = req.body;
    
    if (!dataType) {
      return res.status(400).json({
        success: false,
        error: 'dataType is required'
      });
    }

    const selectedProviders = await oracleManager.selectBestOracles(dataType, criteria);
    
    const providerInfo = selectedProviders.map(node => ({
      id: node.id,
      name: node.provider.name,
      dataSource: node.provider.dataSource,
      selectionScore: node.selectionScore,
      weights: node.weights,
      metrics: {
        accuracyScore: node.metrics?.accuracyScore,
        reputationScore: node.metrics?.reputationScore,
        avgResponseTime: node.metrics?.avgResponseTime,
        performanceHistory: node.metrics?.performanceHistory?.slice(-5) // Last 5 scores
      }
    }));
    
    res.json({
      success: true,
      data: {
        dataType,
        selectedProviders: providerInfo,
        totalSelected: providerInfo.length,
        selectionCriteria: criteria
      }
    });

  } catch (error: any) {
    console.error('❌ Select best oracles API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;