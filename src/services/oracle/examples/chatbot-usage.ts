/**
 * Oracle Chatbot Usage Examples
 * Demonstrates how to use the multi-source oracle system with chatbots
 */

import { 
  createOracleRouter, 
  ChatbotManager, 
  DiscordOracleBot,
  OracleConfig 
} from '../index';

/**
 * Example 1: Basic Oracle Router Setup
 */
export async function basicOracleExample() {
  console.log('🚀 Basic Oracle Router Example');
  
  // Create oracle router with default configuration
  const router = await createOracleRouter();

  try {
    // Query cryptocurrency price
    const btcPrice = await router.query('Bitcoin price');
    console.log('📈 BTC Price:', btcPrice);

    // Query weather data
    const weather = await router.query('weather in London');
    console.log('🌤️ London Weather:', weather);

    // Get system statistics
    const stats = await router.getSystemStats();
    console.log('📊 System Stats:', stats);

  } finally {
    await router.close();
  }
}

/**
 * Example 2: Discord Bot Setup
 */
export async function discordBotExample() {
  console.log('🤖 Discord Bot Example');

  const config: OracleConfig = {
    consensus: {
      default_method: 'median' as any,
      min_responses: 2,
      max_response_time: 10000,
      outlier_threshold: 0.3
    },
    chatbot: {
      discord: {
        enabled: true,
        token: process.env.DISCORD_BOT_TOKEN!,
        channels: ['123456789'] // Replace with actual channel IDs
      },
      slack: { enabled: false, token: '', channels: [] },
      telegram: { enabled: false, token: '', channels: [] }
    },
    providers: {
      chainlink: { enabled: true, weight: 0.95, config: {} },
      coingecko: { enabled: true, weight: 0.9, config: {} },
      weather: { enabled: true, weight: 0.85, config: {} }
    },
    cache: { enabled: true, ttl: 60000, max_size: 1000 },
    hcs: { enabled: false, topic_id: '', batch_size: 10 }
  };

  const router = await createOracleRouter(config);
  const chatbotManager = new ChatbotManager(router, config);

  try {
    await chatbotManager.initialize();
    console.log('✅ Discord bot initialized');

    // Send test message
    await chatbotManager.sendMessage(
      'discord',
      '123456789',
      'Oracle system is now online! 🚀'
    );

    // Get bot statistics
    const stats = chatbotManager.getStats();
    console.log('📊 Chatbot Stats:', stats);

    // Keep bot running (in real app, this would run indefinitely)
    console.log('🤖 Bot is running... (press Ctrl+C to stop)');
    
  } catch (error) {
    console.error('❌ Discord bot error:', error);
  } finally {
    await chatbotManager.close();
    await router.close();
  }
}

/**
 * Example 3: Custom Oracle Provider with Chatbot
 */
export async function customProviderExample() {
  console.log('🔧 Custom Provider Example');

  const config: OracleConfig = {
    consensus: {
      default_method: 'weighted_average' as any,
      min_responses: 2,
      max_response_time: 8000,
      outlier_threshold: 0.25
    },
    providers: {
      // Custom CoinGecko configuration
      coingecko: {
        enabled: true,
        weight: 0.9,
        config: {}
      },
      // Custom weather API
      weather: {
        enabled: true,
        weight: 0.85,
        config: {
          apiKey: process.env.OPENWEATHER_API_KEY
        }
      },
      // Custom financial data API
      financial_api: {
        enabled: true,
        weight: 0.8,
        config: {
          baseUrl: 'https://api.example.com',
          apiKey: process.env.CUSTOM_API_KEY
        }
      }
    },
    chatbot: {
      discord: {
        enabled: true,
        token: process.env.DISCORD_BOT_TOKEN!,
        channels: []
      },
      slack: { enabled: false, token: '', channels: [] },
      telegram: { enabled: false, token: '', channels: [] }
    },
    cache: { enabled: true, ttl: 30000, max_size: 500 },
    hcs: { 
      enabled: !!process.env.HEDERA_ACCOUNT_ID,
      topic_id: process.env.HEDERA_TOPIC_ID || '',
      batch_size: 5
    }
  };

  const router = await createOracleRouter(config);

  try {
    // Test multi-source consensus
    const ethPrice = await router.query('Ethereum price', {
      consensusMethod: 'confidence_weighted' as any,
      sources: ['coingecko', 'chainlink']
    });
    console.log('💎 ETH Price (Multi-source):', ethPrice);

    // Test weather with high confidence requirement
    const nycWeather = await router.query('weather in New York', {
      consensusMethod: 'median' as any
    });
    console.log('🗽 NYC Weather:', nycWeather);

  } finally {
    await router.close();
  }
}

/**
 * Example 4: Advanced Natural Language Processing
 */
export async function advancedNLPExample() {
  console.log('🧠 Advanced NLP Example');

  const router = await createOracleRouter();

  try {
    // Complex queries that the chatbot can understand
    const queries = [
      'What is the current Bitcoin price in USD?',
      'How much does 1 ETH cost today?',
      'Tell me the weather forecast for Tokyo',
      'Is it raining in London right now?',
      'What are the latest crypto market trends?',
      'Show me BTC and ETH prices',
      'Compare weather in New York vs London'
    ];

    for (const query of queries) {
      console.log(`\n🔍 Query: "${query}"`);
      try {
        const result = await router.query(query, { timeout: 6000 });
        console.log(`✅ Result: ${JSON.stringify(result.value, null, 2)}`);
        console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`📡 Sources: ${result.sources.join(', ')}`);
      } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

  } finally {
    await router.close();
  }
}

/**
 * Example 5: Health Monitoring and Statistics
 */
export async function monitoringExample() {
  console.log('📊 Monitoring Example');

  const router = await createOracleRouter();

  try {
    // System health check
    const healthStatus = await router.healthCheckAll();
    console.log('🏥 Provider Health Status:');
    for (const [provider, isHealthy] of healthStatus) {
      console.log(`  ${isHealthy ? '✅' : '❌'} ${provider}`);
    }

    // Detailed system statistics
    const stats = await router.getSystemStats();
    console.log('\n📈 System Statistics:');
    console.log(`  Total Providers: ${stats.total_providers}`);
    console.log(`  Active Providers: ${stats.active_providers}`);
    console.log(`  System Health: ${(stats.system_health * 100).toFixed(1)}%`);
    
    console.log('\n📋 Provider Details:');
    stats.provider_details.forEach((provider: any) => {
      console.log(`  • ${provider.name}:`);
      console.log(`    - Healthy: ${provider.healthy ? 'Yes' : 'No'}`);
      console.log(`    - Weight: ${provider.weight}`);
      console.log(`    - Reliability: ${(provider.reliability * 100).toFixed(1)}%`);
      console.log(`    - Avg Latency: ${provider.latency}ms`);
    });

  } finally {
    await router.close();
  }
}

// Main execution (for testing)
if (require.main === module) {
  async function runExamples() {
    try {
      await basicOracleExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await advancedNLPExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await monitoringExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      // Uncomment to test Discord bot (requires valid token)
      // await discordBotExample();
      
    } catch (error) {
      console.error('❌ Example execution failed:', error);
    }
  }

  runExamples();
}