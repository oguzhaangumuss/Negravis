import express, { Request, Response } from 'express';
import { hashscanService } from '../services/hashscanService';
import { hcsSubscriptionService } from '../services/HcsSubscriptionService';

const router = express.Router();

/**
 * @swagger
 * /api/hashscan/transaction/{id}:
 *   get:
 *     summary: Get transaction details for hashscan
 *     tags: [Hashscan]
 */
router.get('/transaction/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Hashscan: Getting transaction ${id}`);
    
    // First try real-time HCS subscription for immediate transaction lookup
    try {
      console.log(`🔍 Attempting real-time HCS lookup for transaction: ${id}`);
      
      // Try to find transaction in HCS topic (using environment variable for topic ID)
      const topicId = process.env.HEDERA_TOPIC_ID;
      if (topicId) {
        const hcsMessage = await hcsSubscriptionService.findTransactionMessage(
          topicId,
          id,
          3600000 // Search last 1 hour
        );
        
        if (hcsMessage) {
          console.log(`✅ Found transaction ${id} in HCS topic`);
          
          // Parse HCS message content
          let hcsData;
          try {
            hcsData = JSON.parse(hcsMessage.contents);
          } catch {
            hcsData = { transaction_id: id };
          }
          
          res.json({
            success: true,
            transaction: {
              id: hcsMessage.transactionId || id,
              type: 'HCS_MESSAGE',
              status: 'SUCCESS',
              timestamp: new Date(hcsMessage.consensusTimestamp).getTime(),
              network: 'hedera-testnet',
              details: {
                sequence_number: hcsMessage.sequenceNumber,
                consensus_timestamp: hcsMessage.consensusTimestamp,
                hcs_data: hcsData
              },
              blockchain_hash: hcsMessage.transactionId || id,
              explorer_url: `https://hashscan.io/testnet/transaction/${id}`,
              source: 'HCS_REAL_TIME'
            },
            hashscan_url: `https://hashscan.io/testnet/transaction/${encodeURIComponent(id)}`
          });
          return;
        }
      }
    } catch (hcsError: any) {
      console.warn(`⚠️ HCS real-time lookup failed for ${id}:`, hcsError.message);
    }
    
    // Fallback to Mirror Node API
    try {
      console.log(`🔍 Fallback to Mirror Node API for transaction: ${id}`);
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${id}`);
      if (!response.ok) {
        throw new Error(`Transaction not found: ${id}`);
      }
      
      const transactionData: any = await response.json();
      
      res.json({
        success: true,
        transaction: {
          id: transactionData.transaction_id || id,
          type: transactionData.name || 'Unknown',
          status: transactionData.result || 'UNKNOWN',
          timestamp: transactionData.valid_start_timestamp ? parseFloat(transactionData.valid_start_timestamp) * 1000 : Date.now(),
          network: 'hedera-testnet',
          details: {
            charged_tx_fee: transactionData.charged_tx_fee,
            max_fee: transactionData.max_fee,
            transaction_hash: transactionData.transaction_hash,
            consensus_timestamp: transactionData.consensus_timestamp
          },
          blockchain_hash: transactionData.transaction_hash || id,
          explorer_url: `https://hashscan.io/testnet/transaction/${id}`,
          source: 'MIRROR_NODE'
        },
        hashscan_url: `https://hashscan.io/testnet/transaction/${encodeURIComponent(id)}`
      });
    } catch (mirrorError: any) {
      throw new Error(`Transaction not found: ${id}. Checked both HCS real-time and Mirror Node API.`);
    }
    
  } catch (error: any) {
    console.error('❌ Hashscan transaction error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/query/{queryId}:
 *   get:
 *     summary: Get oracle query details
 *     tags: [Hashscan]
 */
router.get('/query/:queryId', async (req: Request, res: Response) => {
  try {
    const { queryId } = req.params;
    console.log(`🔍 Hashscan: Getting query ${queryId}`);
    
    // Query Oracle Manager for real oracle query result
    try {
      const oracleResponse = await fetch(`http://localhost:4001/api/oracle-manager/query-history/${queryId}`);
      if (!oracleResponse.ok) {
        throw new Error(`Oracle query not found: ${queryId}`);
      }
      
      const oracleData: any = await oracleResponse.json();
      
      if (oracleData.success && oracleData.data) {
        res.json({
          success: true,
          query: oracleData.data,
          hashscan_url: `https://hashscan.io/testnet/transaction/${encodeURIComponent(oracleData.data.blockchain?.transaction_id || '')}`
        });
      } else {
        throw new Error(`Oracle query data not found: ${queryId}`);
      }
    } catch (error) {
      throw new Error(`Oracle query not found: ${queryId}. No real query data available.`);
    }
    
  } catch (error: any) {
    console.error('❌ Hashscan query error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/verify/{hash}:
 *   get:
 *     summary: Verify blockchain hash
 *     tags: [Hashscan]
 */
router.get('/verify/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    console.log(`🔍 Hashscan: Verifying hash ${hash}`);
    
    // Verify hash using real Hedera Mirror Node API
    try {
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${hash}`);
      if (!response.ok) {
        throw new Error(`Hash verification failed: ${hash}`);
      }
      
      const transactionData: any = await response.json();
      
      const verificationData = {
        hash: hash,
        verified: true,
        network: 'hedera-testnet',
        timestamp: transactionData.consensus_timestamp ? parseFloat(transactionData.consensus_timestamp) * 1000 : Date.now(),
        type: transactionData.name || 'Unknown',
        status: transactionData.result || 'UNKNOWN',
        confirmations: transactionData.result === 'SUCCESS' ? 1 : 0,
        transaction_id: transactionData.transaction_id,
        gas_used: '0',
        fee: transactionData.charged_tx_fee || 0,
        details: {
          transaction_hash: transactionData.transaction_hash,
          node: transactionData.node,
          max_fee: transactionData.max_fee,
          valid_start_timestamp: transactionData.valid_start_timestamp
        }
      };
      
      res.json({
        success: true,
        verification: verificationData,
        explorer_links: {
          hedera: `https://hashscan.io/testnet/transaction/${hash}`,
          internal: `http://localhost:4001/hashscan.html?type=verify&hash=${encodeURIComponent(hash)}`
        }
      });
    } catch (error) {
      throw new Error(`Hash verification failed: ${hash}. Transaction not found on Hedera network.`);
    }
    
  } catch (error: any) {
    console.error('❌ Hashscan verify error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/search/{query}:
 *   get:
 *     summary: Search transactions and Oracle queries
 *     tags: [Hashscan]
 */
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    console.log(`🔍 Hashscan: Searching for "${query}"`);
    
    const results = {
      success: true,
      query,
      results: {
        transactions: [] as any[],
        oracle_queries: [] as any[],
        accounts: [] as any[],
        topics: [] as any[]
      },
      metadata: {
        total: 0,
        limit: Number(limit),
        offset: Number(offset),
        search_types: ['transactions', 'oracle_queries', 'accounts', 'topics']
      }
    };

    // Search transaction IDs (format: account@timestamp)
    if (query.includes('@')) {
      try {
        const transactionUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${query}`;
        const response = await fetch(transactionUrl);
        if (response.ok) {
          const txData: any = await response.json();
          results.results.transactions.push({
            transaction_id: query,
            type: txData.name || 'HCS_MESSAGE',
            status: txData.result || 'SUCCESS',
            timestamp: txData.consensus_timestamp || Date.now(),
            explorer_url: `https://hashscan.io/testnet/transaction/${query}`
          });
          results.metadata.total++;
        }
      } catch (error) {
        console.log(`ℹ️ Transaction ${query} not found in Mirror Node`);
      }
    }

    // Search account IDs (format: 0.0.xxxxx)
    if (query.match(/^0\.0\.\d+$/)) {
      try {
        const accountUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${query}`;
        const response = await fetch(accountUrl);
        if (response.ok) {
          const accountData: any = await response.json();
          results.results.accounts.push({
            account_id: query,
            balance: accountData.balance?.balance || 0,
            created_timestamp: accountData.created_timestamp,
            explorer_url: `https://hashscan.io/testnet/account/${query}`
          });
          results.metadata.total++;
        }
      } catch (error) {
        console.log(`ℹ️ Account ${query} not found`);
      }
    }

    // Search topic IDs (format: 0.0.xxxxx)
    if (query.match(/^0\.0\.\d+$/) || query.toLowerCase().includes('topic')) {
      const topicId = query.replace(/topic/i, '').trim() || process.env.HEDERA_TOPIC_ID;
      if (topicId) {
        try {
          const topicUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=5`;
          const response = await fetch(topicUrl);
          if (response.ok) {
            const topicData: any = await response.json();
            results.results.topics.push({
              topic_id: topicId,
              message_count: topicData.messages?.length || 0,
              recent_messages: topicData.messages?.slice(0, 3) || [],
              explorer_url: `https://hashscan.io/testnet/topic/${topicId}`
            });
            results.metadata.total++;
          }
        } catch (error) {
          console.log(`ℹ️ Topic ${topicId} not found`);
        }
      }
    }

    // Search Oracle queries by content
    try {
      // Check if query matches recent Oracle queries
      const oracleProviders = ['coingecko', 'nasa', 'weather', 'dia', 'chainlink'];
      const matchingProvider = oracleProviders.find(provider => 
        query.toLowerCase().includes(provider) || 
        provider.includes(query.toLowerCase())
      );
      
      if (matchingProvider || query.toLowerCase().includes('bitcoin') || 
          query.toLowerCase().includes('weather') || query.toLowerCase().includes('nasa')) {
        results.results.oracle_queries.push({
          query_type: matchingProvider || 'search_match',
          query_text: query,
          provider: matchingProvider,
          note: `Oracle queries matching "${query}"`,
          search_url: `http://localhost:4001/api/oracle-manager/query`
        });
        results.metadata.total++;
      }
    } catch (error) {
      console.log('ℹ️ Oracle query search failed');
    }

    res.json(results);
    
  } catch (error: any) {
    console.error('❌ Hashscan search error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/recent:
 *   get:
 *     summary: Get recent transactions and Oracle activities
 *     tags: [Hashscan]
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    console.log(`🔍 Hashscan: Getting recent activities (limit: ${limit})`);
    
    const recentActivities = {
      success: true,
      activities: [] as any[],
      metadata: {
        limit: Number(limit),
        timestamp: Date.now(),
        types: ['hcs_messages', 'transactions', 'oracle_queries']
      }
    };

    // Get recent HCS messages from our topic
    try {
      const topicId = process.env.HEDERA_TOPIC_ID;
      if (topicId) {
        const topicUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=${limit}`;
        const response = await fetch(topicUrl);
        if (response.ok) {
          const topicData: any = await response.json();
          
          topicData.messages?.forEach((message: any) => {
            try {
              const messageContent = Buffer.from(message.message, 'base64').toString();
              let parsedContent;
              try {
                parsedContent = JSON.parse(messageContent);
              } catch {
                parsedContent = { raw: messageContent };
              }
              
              recentActivities.activities.push({
                type: 'HCS_MESSAGE',
                timestamp: message.consensus_timestamp,
                sequence_number: message.sequence_number,
                transaction_id: message.initial_transaction_id,
                content: parsedContent,
                explorer_url: `https://hashscan.io/testnet/transaction/${message.initial_transaction_id}`,
                topic_id: topicId
              });
            } catch (error) {
              console.log('Error parsing HCS message:', error);
            }
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to fetch recent HCS messages:', error);
    }

    // Sort by timestamp (most recent first)
    recentActivities.activities.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit results
    recentActivities.activities = recentActivities.activities.slice(0, Number(limit));

    res.json(recentActivities);
    
  } catch (error: any) {
    console.error('❌ Hashscan recent error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/browse:
 *   get:
 *     summary: Browse Oracle transactions by category
 *     tags: [Hashscan]
 */
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const { category = 'all', provider, limit = 10 } = req.query;
    console.log(`🔍 Hashscan: Browsing ${category} transactions`);
    
    const browseResults = {
      success: true,
      category,
      provider,
      transactions: [] as any[],
      metadata: {
        available_categories: ['all', 'crypto', 'weather', 'nasa', 'sports', 'wikipedia'],
        available_providers: ['coingecko', 'dia', 'nasa', 'weather', 'chainlink', 'exchangerate', 'sports', 'wikipedia'],
        limit: Number(limit),
        timestamp: Date.now()
      }
    };

    // Get recent transactions from HCS topic
    try {
      const topicId = process.env.HEDERA_TOPIC_ID;
      if (topicId) {
        const topicUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=50`;
        const response = await fetch(topicUrl);
        if (response.ok) {
          const topicData: any = await response.json();
          
          const filteredTransactions = [];
          
          for (const message of topicData.messages || []) {
            try {
              const messageContent = Buffer.from(message.message, 'base64').toString();
              const parsedContent = JSON.parse(messageContent);
              
              // Filter by category and provider
              const matchesCategory = category === 'all' || 
                (category === 'crypto' && ['coingecko', 'dia', 'chainlink'].some(p => parsedContent.result?.sources?.includes(p))) ||
                (category === 'weather' && parsedContent.result?.sources?.includes('weather')) ||
                (category === 'nasa' && parsedContent.result?.sources?.includes('nasa')) ||
                (category === 'sports' && parsedContent.result?.sources?.includes('sports')) ||
                (category === 'wikipedia' && parsedContent.result?.sources?.includes('wikipedia'));
                
              const matchesProvider = !provider || parsedContent.result?.sources?.includes(provider);
              
              if (matchesCategory && matchesProvider) {
                filteredTransactions.push({
                  transaction_id: message.initial_transaction_id,
                  timestamp: message.consensus_timestamp,
                  sequence_number: message.sequence_number,
                  query: parsedContent.query || 'Unknown',
                  provider: parsedContent.result?.sources?.[0] || 'unknown',
                  value: parsedContent.result?.value || null,
                  confidence: parsedContent.result?.confidence || 0,
                  explorer_url: `https://hashscan.io/testnet/transaction/${message.initial_transaction_id}`,
                  content: parsedContent
                });
              }
              
              if (filteredTransactions.length >= Number(limit)) break;
            } catch (error) {
              console.log('Error parsing message for browse:', error);
            }
          }
          
          browseResults.transactions = filteredTransactions;
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to browse transactions:', error);
    }

    res.json(browseResults);
    
  } catch (error: any) {
    console.error('❌ Hashscan browse error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/hashscan/stats:
 *   get:
 *     summary: Get HashScan statistics and system overview
 *     tags: [Hashscan]
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Hashscan: Getting system stats');
    
    const stats = {
      success: true,
      network: {
        name: 'Hedera Testnet',
        status: 'active',
        explorer_url: 'https://hashscan.io/testnet'
      },
      hcs_topic: {
        id: process.env.HEDERA_TOPIC_ID || '0.0.6519732',
        message_count: 0,
        recent_activity: null
      },
      oracle_system: {
        active_providers: 0,
        total_queries_logged: 0,
        system_health: 0
      },
      api_endpoints: {
        transaction_lookup: '/api/hashscan/transaction/:id',
        search: '/api/hashscan/search/:query', 
        recent_activity: '/api/hashscan/recent',
        browse: '/api/hashscan/browse',
        verification: '/api/hashscan/verify/:hash'
      },
      timestamp: Date.now()
    };

    // Get HCS topic stats
    try {
      const topicId = process.env.HEDERA_TOPIC_ID;
      if (topicId) {
        const topicUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=1`;
        const response = await fetch(topicUrl);
        if (response.ok) {
          const topicData: any = await response.json();
          if (topicData.messages && topicData.messages.length > 0) {
            stats.hcs_topic.message_count = topicData.messages[0].sequence_number || 0;
            stats.hcs_topic.recent_activity = topicData.messages[0].consensus_timestamp;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to get topic stats:', error);
    }

    // Get Oracle system stats
    try {
      const oracleHealthResponse = await fetch('http://localhost:4001/api/oracle-manager/health');
      if (oracleHealthResponse.ok) {
        const oracleHealth: any = await oracleHealthResponse.json();
        stats.oracle_system = {
          active_providers: oracleHealth.data?.healthy_oracles || 0,
          total_queries_logged: stats.hcs_topic.message_count,
          system_health: oracleHealth.data?.system_health || 0
        };
      }
    } catch (error) {
      console.log('⚠️ Failed to get Oracle stats:', error);
    }

    res.json(stats);
    
  } catch (error: any) {
    console.error('❌ Hashscan stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

export default router;