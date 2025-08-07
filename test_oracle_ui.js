/**
 * Oracle UI Test Suite
 * Tests all Oracle agents with realistic queries to ensure proper UI rendering
 */

const testCases = [
  // 1. Chainlink Oracle - Enterprise crypto prices
  {
    oracle: 'chainlink',
    query: 'ethereum price',
    description: 'Test Chainlink enterprise-grade ETH price feed'
  },
  
  // 2. CoinGecko Oracle - Market data 
  {
    oracle: 'coingecko', 
    query: 'bitcoin',
    description: 'Test CoinGecko comprehensive BTC market data'
  },
  
  // 3. DIA Oracle - Transparent crypto data
  {
    oracle: 'dia',
    query: 'solana price',
    description: 'Test DIA transparent SOL price feed with sources'
  },
  
  // 4. Weather Oracle - Real-time weather
  {
    oracle: 'weather',
    query: 'weather in London',
    description: 'Test Weather Oracle for London conditions'
  },
  
  // 5. Exchange Rate Oracle - Forex rates
  {
    oracle: 'exchangerate', 
    query: 'USD to EUR',
    description: 'Test Exchange Rate Oracle for USD/EUR conversion'
  },
  
  // 6. Sports Oracle - NBA data
  {
    oracle: 'sports',
    query: 'Lakers last game',
    description: 'Test Sports Oracle for NBA Lakers game data'
  },
  
  // 7. NASA Oracle - Space data
  {
    oracle: 'nasa',
    query: 'Mars weather today',
    description: 'Test NASA Oracle for Mars atmospheric data'
  },
  
  // 8. Wikipedia Oracle - Knowledge base
  {
    oracle: 'wikipedia',
    query: 'Artificial Intelligence',
    description: 'Test Wikipedia Oracle for AI information'
  }
];

/**
 * Execute test cases automatically
 */
async function runOracleTests() {
  console.log('🧪 Starting Oracle UI Test Suite...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n📋 Test ${i + 1}/8: ${test.description}`);
    console.log(`🎯 Oracle: ${test.oracle}`);
    console.log(`💬 Query: "${test.query}"`);
    
    try {
      const response = await fetch('http://localhost:4001/api/oracle-manager/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: test.oracle,
          query: test.query,
          userId: 'ui_test_user'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success: ${data.success ? 'Response received' : 'Failed'}`);
        if (data.blockchain && data.blockchain.transaction_id) {
          console.log(`🔗 Blockchain: ${data.blockchain.transaction_id}`);
        }
        if (data.query_info && data.query_info.answer) {
          console.log(`💡 Answer: ${data.query_info.answer.substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ HTTP Error: ${response.status}`);
      }
      
      // Wait 2 seconds between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Oracle UI Test Suite completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Check frontend UI for proper rendering of all responses');
  console.log('2. Verify hashscan links work correctly');
  console.log('3. Confirm blockchain verification displays properly');
}

// Auto-run if called directly
if (typeof window === 'undefined') {
  runOracleTests().catch(console.error);
}

module.exports = { testCases, runOracleTests };