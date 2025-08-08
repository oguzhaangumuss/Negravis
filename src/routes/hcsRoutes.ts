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
 * Get active HCS topic IDs from database
 * GET /api/hcs/topics/active
 */
router.get('/topics/active', async (req, res) => {
  try {
    console.log('📊 Getting active HCS topics from database');
    
    // Import supabaseService dynamically to avoid circular dependencies
    const { supabaseService } = await import('../services/supabaseService');
    
    const hoursBack = parseInt(req.query.hours as string) || 24;
    const activeTopics = await supabaseService.getActiveTopicIds(hoursBack);
    
    res.json({
      success: true,
      hcsService: {
        topics: Object.fromEntries(
          activeTopics.map((topicId, index) => [`topic_${index + 1}`, topicId])
        ),
        production_ready: true,
        network: 'hedera-testnet',
        source: 'database_active_topics',
        hours_back: hoursBack
      },
      data: {
        active_topics: activeTopics,
        total_active: activeTopics.length,
        discovery_method: 'database_query'
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Active topics database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active topics from database'
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
 * Discover active Oracle topics with recent messages
 * GET /api/hcs/topics/discover
 */
router.get('/topics/discover', async (req, res) => {
  try {
    console.log('🔍 Discovering active Oracle topics with recent messages...');
    
    const baseTopics = hcsService.getTopicIds();
    const activeTopics: { [key: string]: any } = {};
    const allDiscoveredTopics: { [key: string]: any } = {};
    
    // Extended topic ranges for comprehensive discovery
    const possibleTopicRanges = [
      { start: 6533614, end: 6533620, description: 'Active Oracle topics' },
      { start: 6503587, end: 6503590, description: 'Core Oracle topics' },
      { start: 6534090, end: 6534100, description: 'Recent backend topics' },
      { start: 6496305, end: 6496315, description: 'Historical Oracle topics' }
    ];
    
    // Check each topic for recent activity
    for (const range of possibleTopicRanges) {
      for (let i = range.start; i <= range.end; i++) {
        const topicId = `0.0.${i}`;
        try {
          // Check for recent messages (last 10)
          const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=10&order=desc`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
          });
          
          if (response.ok) {
            const data: any = await response.json();
            if (data.messages && data.messages.length > 0) {
              const firstMessage = data.messages[0];
              const lastTimestamp = new Date(firstMessage.consensus_timestamp.split('.')[0] * 1000);
              const hoursAgo = (Date.now() - lastTimestamp.getTime()) / (1000 * 60 * 60);
              
              // Analyze message content for Oracle type detection
              let oracleType = 'unknown';
              let hasValidOracleData = false;
              
              try {
                const decodedMessage = Buffer.from(firstMessage.message, 'base64').toString('utf-8');
                const messageData = JSON.parse(decodedMessage);
                
                // Advanced Oracle type detection
                if (messageData.result?.value?.temperature || messageData.answer?.includes('°C')) {
                  oracleType = 'weather';
                  hasValidOracleData = true;
                } else if (messageData.result?.value && typeof messageData.result.value === 'number' && messageData.query?.includes('price')) {
                  oracleType = messageData.result.sources?.includes('dia') ? 'dia' : 'coingecko';
                  hasValidOracleData = true;
                } else if (messageData.type === 'ORACLE_QUERY') {
                  oracleType = 'queries';
                  hasValidOracleData = true;
                } else if (messageData.type === 'COMPUTE_OPERATION') {
                  oracleType = 'operations';
                  hasValidOracleData = true;
                } else if (messageData.oracle_used) {
                  oracleType = messageData.oracle_used;
                  hasValidOracleData = true;
                }
              } catch (parseError: any) {
                console.log(`Parse error for topic ${topicId}:`, parseError.message);
              }
              
              const topicInfo = {
                id: topicId,
                type: oracleType,
                message_count: data.messages.length,
                last_message_timestamp: firstMessage.consensus_timestamp,
                hours_since_last_message: Math.round(hoursAgo * 100) / 100,
                has_valid_oracle_data: hasValidOracleData,
                explorer_link: `https://hashscan.io/testnet/topic/${topicId}`,
                is_active: hoursAgo < 24 // Active if messaged within 24 hours
              };
              
              allDiscoveredTopics[topicId] = topicInfo;
              
              // Only include topics with valid Oracle data as "active"
              if (hasValidOracleData) {
                activeTopics[oracleType] = topicId;
                console.log(`✅ Active Oracle topic: ${topicId} (${oracleType}) - ${Math.round(hoursAgo * 10) / 10}h ago`);
              } else {
                console.log(`⚠️ Topic ${topicId} has messages but no valid Oracle data - ${Math.round(hoursAgo * 10) / 10}h ago`);
              }
            }
          }
        } catch (error) {
          // Topic doesn't exist or network error - skip silently
        }
      }
    }
    
    // Add base topics if they have messages
    const coreTopicsToCheck = {
      queries: baseTopics.oracleQueries,
      operations: baseTopics.computeOperations,
      accounts: baseTopics.accountOperations,
      metrics: baseTopics.systemMetrics
    };
    
    for (const [key, topicId] of Object.entries(coreTopicsToCheck)) {
      if (topicId && !activeTopics[key]) {
        activeTopics[key] = topicId;
        console.log(`📝 Added core topic: ${key} -> ${topicId}`);
      }
    }
    
    const totalActive = Object.keys(activeTopics).length;
    const totalDiscovered = Object.keys(allDiscoveredTopics).length;
    
    res.json({
      success: true,
      hcsService: {
        topics: activeTopics, // Primary format for frontend
        production_ready: true,
        network: 'hedera-testnet',
        discovery_method: 'active_message_scanning'
      },
      discovery_details: {
        active_topics: activeTopics,
        all_discovered: allDiscoveredTopics,
        summary: {
          total_active_topics: totalActive,
          total_discovered_topics: totalDiscovered,
          scan_ranges: possibleTopicRanges.length,
          network: 'hedera-testnet'
        }
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ HCS active topics discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover active Oracle topics'
    });
  }
});

export default router;