import express from 'express';
import { HCSService } from '../services/hcsService';

const router = express.Router();

// Initialize HCS service instance
const hcsService = new HCSService();

// Initialize the service
hcsService.initialize().catch(error => {
  console.error('Failed to initialize HCS service:', error.message);
});

/**
 * Get recent HCS transactions
 * GET /api/hcs/transactions
 */
router.get('/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string;

    let transactions;
    if (type && ['ORACLE_QUERY', 'COMPUTE_OPERATION', 'ACCOUNT_OPERATION', 'SYSTEM_METRICS'].includes(type)) {
      transactions = hcsService.getTransactionsByType(type as any, limit);
    } else {
      transactions = hcsService.getRecentTransactions(limit);
    }

    res.json({
      success: true,
      data: {
        transactions,
        total: transactions.length,
        topics: hcsService.getTopicIds()
      }
    });
  } catch (error) {
    console.error('HCS transactions API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HCS transactions'
    });
  }
});

/**
 * Get HCS topic information
 * GET /api/hcs/topics
 */
router.get('/topics', async (req, res) => {
  try {
    const topics = hcsService.getTopicIds();
    
    res.json({
      success: true,
      data: {
        topics,
        ready: hcsService.isReady(),
        network: 'testnet'
      }
    });
  } catch (error) {
    console.error('HCS topics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HCS topics'
    });
  }
});

/**
 * Trigger a test HCS message (for demo purposes)
 * POST /api/hcs/test-message
 */
router.post('/test-message', async (req, res) => {
  try {
    const { message = 'Test message from API' } = req.body;

    // Log a test system metric
    await hcsService.logSystemMetrics({
      requestId: `api-test-${Date.now()}`,
      endpoint: '/api/hcs/test-message',
      method: 'POST',
      responseTime: Date.now(), // Real timestamp - no random data!
      statusCode: 200,
      memoryUsage: process.memoryUsage(),
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    const recentTransactions = hcsService.getRecentTransactions(1);
    
    res.json({
      success: true,
      message: 'Test message submitted to HCS',
      data: {
        latestTransaction: recentTransactions[0] || null,
        totalTransactions: hcsService.getRecentTransactions(100).length
      }
    });
  } catch (error) {
    console.error('HCS test message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit test message to HCS'
    });
  }
});

/**
 * Get HCS service status
 * GET /api/hcs/status
 */
router.get('/status', async (req, res) => {
  try {
    const topics = hcsService.getTopicIds();
    const recentTransactions = hcsService.getRecentTransactions(5);
    
    res.json({
      success: true,
      data: {
        ready: hcsService.isReady(),
        topics,
        totalTopics: Object.keys(topics).length,
        recentTransactionCount: recentTransactions.length,
        lastTransaction: recentTransactions[0] || null,
        network: 'testnet'
      }
    });
  } catch (error) {
    console.error('HCS status API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get HCS service status'
    });
  }
});

export default router;