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
 * Get HCS topic information with production topic discovery
 * GET /api/hcs/topics
 */
router.get('/topics', async (req, res) => {
  try {
    console.log('🔍 Getting HCS topics for production frontend integration');
    
    const topics = hcsService.getTopicIds();
    
    // Ensure topics are created if they don't exist
    if (!topics.oracleQueries || !topics.computeOperations || !topics.accountOperations || !topics.systemMetrics) {
      console.log('📝 Some topics missing, creating them...');
      await hcsService.createTopics();
    }
    
    // Get updated topics after creation
    const updatedTopics = hcsService.getTopicIds();
    
    // Format topics for frontend query-history API consumption
    const formattedTopics = {
      queries: updatedTopics.oracleQueries,
      operations: updatedTopics.computeOperations,
      accounts: updatedTopics.accountOperations,
      metrics: updatedTopics.systemMetrics,
      // Add HashScan links for easy verification
      links: {
        queries: updatedTopics.oracleQueries ? `https://hashscan.io/testnet/topic/${updatedTopics.oracleQueries}` : null,
        operations: updatedTopics.computeOperations ? `https://hashscan.io/testnet/topic/${updatedTopics.computeOperations}` : null,
        accounts: updatedTopics.accountOperations ? `https://hashscan.io/testnet/topic/${updatedTopics.accountOperations}` : null,
        metrics: updatedTopics.systemMetrics ? `https://hashscan.io/testnet/topic/${updatedTopics.systemMetrics}` : null
      }
    };
    
    res.json({
      success: true,
      hcsService: {
        topics: formattedTopics,
        production_ready: true,
        network: 'hedera-testnet',
        note: 'Production HCS topics for Oracle system integration'
      },
      data: {
        topics: updatedTopics, // Legacy format for backward compatibility
        ready: hcsService.isReady(),
        network: 'testnet'
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ HCS topics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HCS topics',
      production_ready: false
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

/**
 * Discover all Oracle-related topics on blockchain
 * GET /api/hcs/topics/discover
 */
router.get('/topics/discover', async (req, res) => {
  try {
    console.log('🔍 Discovering all Oracle topics from blockchain...');
    
    const baseTopics = hcsService.getTopicIds();
    
    // Get all known Oracle topic IDs from the system
    const discoveredTopics = {
      // Core system topics
      core: {
        queries: baseTopics.oracleQueries,
        operations: baseTopics.computeOperations,
        accounts: baseTopics.accountOperations,
        metrics: baseTopics.systemMetrics
      },
      // Oracle-specific topics that may exist
      oracle_specific: {}
    };
    
    // Try to discover Oracle-specific topics by checking known patterns
    const possibleTopicRanges = [
      // Based on previous discoveries, look in these ranges
      { start: 6533614, end: 6533620, description: 'Weather/DIA Oracle topics' },
      { start: 6503587, end: 6503590, description: 'Core Oracle topics' }
    ];
    
    for (const range of possibleTopicRanges) {
      for (let i = range.start; i <= range.end; i++) {
        const topicId = `0.0.${i}`;
        try {
          // Quick check if topic exists and has messages
          const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=1`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
              // Try to determine Oracle type from first message
              try {
                const firstMessage = data.messages[0];
                const decodedMessage = Buffer.from(firstMessage.message, 'base64').toString('utf-8');
                const messageData = JSON.parse(decodedMessage);
                
                // Categorize based on message content
                let oracleType = 'unknown';
                if (messageData.raw_data?.temperature || messageData.answer?.includes('°C')) {
                  oracleType = 'weather';
                } else if (messageData.result?.value && typeof messageData.result.value === 'number') {
                  oracleType = 'price_data';
                } else if (messageData.type === 'ORACLE_QUERY') {
                  oracleType = 'query';
                } else if (messageData.type === 'COMPUTE_OPERATION') {
                  oracleType = 'operation';
                }
                
                discoveredTopics.oracle_specific[topicId] = {
                  id: topicId,
                  type: oracleType,
                  message_count: data.messages.length,
                  last_message: firstMessage.consensus_timestamp,
                  explorer_link: `https://hashscan.io/testnet/topic/${topicId}`
                };
                
                console.log(`✅ Found Oracle topic ${topicId} (type: ${oracleType})`);
              } catch (parseError) {
                // Topic exists but can't parse - still include it
                discoveredTopics.oracle_specific[topicId] = {
                  id: topicId,
                  type: 'unparseable',
                  message_count: data.messages.length,
                  explorer_link: `https://hashscan.io/testnet/topic/${topicId}`
                };
              }
            }
          }
        } catch (error) {
          // Topic doesn't exist or network error - skip silently
        }
      }
    }
    
    const totalDiscovered = Object.keys(discoveredTopics.core).length + Object.keys(discoveredTopics.oracle_specific).length;
    
    res.json({
      success: true,
      discovered_topics: discoveredTopics,
      summary: {
        total_topics: totalDiscovered,
        core_topics: Object.keys(discoveredTopics.core).length,
        oracle_specific_topics: Object.keys(discoveredTopics.oracle_specific).length,
        network: 'hedera-testnet'
      },
      // Format for frontend consumption
      frontend_topics: {
        ...discoveredTopics.core,
        ...Object.fromEntries(
          Object.entries(discoveredTopics.oracle_specific).map(([key, value]: [string, any]) => [
            value.type || key,
            key
          ])
        )
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ HCS topics discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover Oracle topics'
    });
  }
});

export default router;