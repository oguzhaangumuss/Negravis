import { Router } from 'express';
import { HederaAnalyticsService } from '../services/hederaAnalyticsService';

const hederaAnalyticsService = new HederaAnalyticsService();

const router = Router();

// Network health endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await hederaAnalyticsService.getNetworkHealth();
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// TPS metrics endpoint
router.get('/tps', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 300;
    const tpsMetrics = await hederaAnalyticsService.calculateTPS(timeframe);
    res.json({
      success: true,
      data: tpsMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Node metrics endpoint
router.get('/nodes', async (req, res) => {
  try {
    const nodeMetrics = await hederaAnalyticsService.getNodeMetrics();
    res.json({
      success: true,
      data: nodeMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Transaction volume endpoint
router.get('/volume', async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const volumeData = await hederaAnalyticsService.getTransactionVolume(period);
    res.json({
      success: true,
      data: volumeData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Transaction types distribution endpoint
router.get('/transactions/types', async (req, res) => {
  try {
    const typeDistribution = await hederaAnalyticsService.getTransactionTypes();
    res.json({
      success: true,
      data: typeDistribution,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Success rates endpoint
router.get('/transactions/success', async (req, res) => {
  try {
    const successMetrics = await hederaAnalyticsService.getSuccessRates();
    res.json({
      success: true,
      data: successMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Account growth endpoint
router.get('/accounts/growth', async (req, res) => {
  try {
    const growthData = await hederaAnalyticsService.getAccountGrowth();
    res.json({
      success: true,
      data: growthData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Balance distribution endpoint
router.get('/accounts/balances', async (req, res) => {
  try {
    const balanceData = await hederaAnalyticsService.getBalanceDistribution();
    res.json({
      success: true,
      data: balanceData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Active accounts endpoint
router.get('/accounts/activity', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 86400; // 24 hours default
    const activityData = await hederaAnalyticsService.getActiveAccounts(timeframe);
    res.json({
      success: true,
      data: activityData,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Service health check endpoint
router.get('/service/health', async (req, res) => {
  try {
    const healthCheck = await hederaAnalyticsService.healthCheck();
    res.json({
      success: true,
      data: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Analytics dashboard summary endpoint
router.get('/dashboard', async (req, res) => {
  try {
    const [health, tps, nodes, volume, types, success, growth, activity] = await Promise.all([
      hederaAnalyticsService.getNetworkHealth(),
      hederaAnalyticsService.calculateTPS(300),
      hederaAnalyticsService.getNodeMetrics(),
      hederaAnalyticsService.getTransactionVolume('24h'),
      hederaAnalyticsService.getTransactionTypes(),
      hederaAnalyticsService.getSuccessRates(),
      hederaAnalyticsService.getAccountGrowth(),
      hederaAnalyticsService.getActiveAccounts(86400)
    ]);

    res.json({
      success: true,
      data: {
        networkHealth: health,
        tpsMetrics: tps,
        topNodes: nodes.slice(0, 5),
        transactionVolume: volume,
        transactionTypes: types,
        successMetrics: success,
        accountGrowth: growth,
        accountActivity: activity
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;