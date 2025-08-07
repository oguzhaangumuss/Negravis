/**
 * Comprehensive Oracle Agent Test Suite
 * Tests ALL 8 Oracle agents with multiple queries each to ensure proper functionality
 */

const testCases = [
  // 🔗 CHAINLINK ORACLE TESTS
  {
    oracle: 'chainlink',
    query: 'bitcoin price',
    expected: {
      query_type: 'crypto_price',
      symbol: 'BTC',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🔗 Chainlink - Bitcoin Price Feed'
  },
  {
    oracle: 'chainlink',
    query: 'ethereum',
    expected: {
      query_type: 'crypto_price',
      symbol: 'ETH',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🔗 Chainlink - Ethereum Price Feed'
  },
  {
    oracle: 'chainlink',
    query: 'eth price',
    expected: {
      query_type: 'crypto_price',
      symbol: 'ETH',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🔗 Chainlink - ETH Alternative Query'
  },

  // 🦎 COINGECKO ORACLE TESTS
  {
    oracle: 'coingecko',
    query: 'bitcoin',
    expected: {
      query_type: 'crypto_price',
      symbol: 'BTC',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🦎 CoinGecko - Bitcoin Market Data'
  },
  {
    oracle: 'coingecko',
    query: 'btc',
    expected: {
      query_type: 'crypto_price',
      symbol: 'BTC',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🦎 CoinGecko - BTC Short Form'
  },
  {
    oracle: 'coingecko',
    query: 'ethereum price',
    expected: {
      query_type: 'crypto_price',
      symbol: 'ETH',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: '🦎 CoinGecko - Ethereum Market Data'
  },

  // 💎 DIA ORACLE TESTS
  {
    oracle: 'dia',
    query: 'bitcoin',
    expected: {
      query_type: 'crypto_price',
      symbol: 'BTC',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 80
    },
    description: '💎 DIA - Bitcoin Transparent Data'
  },
  {
    oracle: 'dia',
    query: 'solana price',
    expected: {
      query_type: 'crypto_price',
      symbol: 'SOL',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 80
    },
    description: '💎 DIA - Solana Price Feed'
  },
  {
    oracle: 'dia',
    query: 'ethereum',
    expected: {
      query_type: 'crypto_price',
      symbol: 'ETH',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 80
    },
    description: '💎 DIA - Ethereum Transparent Data'
  },

  // 🌤️ WEATHER ORACLE TESTS
  {
    oracle: 'weather',
    query: 'weather in Istanbul',
    expected: {
      query_type: 'weather',
      location: 'Istanbul',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 75
    },
    description: '🌤️ Weather - Istanbul Conditions'
  },
  {
    oracle: 'weather',
    query: 'London weather',
    expected: {
      query_type: 'weather',
      location: 'London',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 75
    },
    description: '🌤️ Weather - London Conditions'
  },
  {
    oracle: 'weather',
    query: 'New York weather',
    expected: {
      query_type: 'weather',
      location: 'New York',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 75
    },
    description: '🌤️ Weather - New York Conditions'
  },
  {
    oracle: 'weather',
    query: 'Tokyo weather forecast',
    expected: {
      query_type: 'weather',
      location: 'Tokyo',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 75
    },
    description: '🌤️ Weather - Tokyo Forecast'
  },

  // 💱 EXCHANGE RATE ORACLE TESTS
  {
    oracle: 'exchangerate',
    query: 'USD to EUR',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '💱 Exchange Rate - USD/EUR Conversion'
  },
  {
    oracle: 'exchangerate',
    query: 'GBP to USD exchange rate',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '💱 Exchange Rate - GBP/USD Rate'
  },
  {
    oracle: 'exchangerate',
    query: 'EUR to JPY',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '💱 Exchange Rate - EUR/JPY Rate'
  },

  // 🏀 SPORTS ORACLE TESTS
  {
    oracle: 'sports',
    query: 'Lakers last game',
    expected: {
      query_type: 'generic',
      min_confidence: 65
    },
    description: '🏀 Sports - Lakers Game Results'
  },
  {
    oracle: 'sports',
    query: 'NBA standings',
    expected: {
      query_type: 'generic',
      min_confidence: 65
    },
    description: '🏀 Sports - NBA Standings'
  },
  {
    oracle: 'sports',
    query: 'Warriors vs Celtics',
    expected: {
      query_type: 'generic',
      min_confidence: 65
    },
    description: '🏀 Sports - Team Matchup'
  },

  // 🚀 NASA ORACLE TESTS
  {
    oracle: 'nasa',
    query: 'Mars weather today',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '🚀 NASA - Mars Weather Data'
  },
  {
    oracle: 'nasa',
    query: 'ISS location',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '🚀 NASA - ISS Tracking'
  },
  {
    oracle: 'nasa',
    query: 'asteroid near earth',
    expected: {
      query_type: 'generic',
      min_confidence: 70
    },
    description: '🚀 NASA - Asteroid Tracking'
  },

  // 📚 WIKIPEDIA ORACLE TESTS
  {
    oracle: 'wikipedia',
    query: 'Artificial Intelligence',
    expected: {
      query_type: 'generic',
      min_confidence: 60
    },
    description: '📚 Wikipedia - AI Knowledge'
  },
  {
    oracle: 'wikipedia',
    query: 'Blockchain technology',
    expected: {
      query_type: 'generic',
      min_confidence: 60
    },
    description: '📚 Wikipedia - Blockchain Info'
  },
  {
    oracle: 'wikipedia',
    query: 'Machine Learning',
    expected: {
      query_type: 'generic',
      min_confidence: 60
    },
    description: '📚 Wikipedia - ML Knowledge'
  }
];

/**
 * Enhanced validation function with detailed error reporting
 */
function validateResponse(response, expected, testName) {
  const errors = [];
  const warnings = [];
  
  console.log(`\n📊 Validating: ${testName}`);
  
  // Check if request was successful
  if (!response.success) {
    errors.push(`❌ Request failed: ${response.error}`);
    return { errors, warnings };
  }
  
  console.log(`✅ Request successful`);
  
  // Check if query_info exists
  if (!response.query_info) {
    if (expected.query_type === 'generic') {
      warnings.push('⚠️  Missing query_info (acceptable for generic queries)');
      console.log('⚠️  query_info missing but acceptable for generic query');
    } else {
      errors.push('❌ Missing query_info in response');
      return { errors, warnings };
    }
  } else {
    const qi = response.query_info;
    console.log(`📝 Query info found: type=${qi.query_type}, symbol=${qi.symbol}, answer=${qi.answer}`);
    
    // Validate query type
    if (expected.query_type && qi.query_type !== expected.query_type) {
      errors.push(`❌ Query type: expected '${expected.query_type}', got '${qi.query_type}'`);
    } else {
      console.log(`✅ Query type: ${qi.query_type}`);
    }
    
    // Validate symbol/location for specific queries
    const symbolField = expected.query_type === 'weather' ? 'location' : 'symbol';
    const expectedSymbol = expected[symbolField];
    if (expectedSymbol && qi.symbol !== expectedSymbol) {
      warnings.push(`⚠️  Symbol: expected '${expectedSymbol}', got '${qi.symbol}' (may be acceptable)`);
    } else if (qi.symbol) {
      console.log(`✅ Symbol/Location: ${qi.symbol}`);
    }
    
    // Validate answer format
    if (expected.price_format && !expected.price_format.test(qi.answer)) {
      errors.push(`❌ Price format: '${qi.answer}' doesn't match expected pattern`);
    } else if (expected.temperature_format && !expected.temperature_format.test(qi.answer)) {
      errors.push(`❌ Temperature format: '${qi.answer}' doesn't match expected pattern`);
    } else if (qi.answer) {
      console.log(`✅ Answer format: ${qi.answer}`);
    }
    
    // Validate confidence
    if (expected.min_confidence && qi.consensus && qi.consensus.confidence_score < expected.min_confidence) {
      warnings.push(`⚠️  Confidence: ${qi.consensus.confidence_score}% < ${expected.min_confidence}% (lower than expected)`);
    } else if (qi.consensus) {
      console.log(`✅ Confidence: ${qi.consensus.confidence_score}%`);
    }
    
    // Validate sources
    if (!qi.sources || !Array.isArray(qi.sources) || qi.sources.length === 0) {
      errors.push('❌ Missing or empty sources array');
    } else {
      console.log(`✅ Sources: ${qi.sources.length} provider(s)`);
    }
  }
  
  // Validate blockchain data
  if (!response.blockchain || !response.blockchain.transaction_id) {
    errors.push('❌ Missing blockchain verification');
  } else {
    console.log(`✅ Blockchain: ${response.blockchain.transaction_id}`);
  }
  
  // Validate response data structure
  if (!response.data) {
    errors.push('❌ Missing response data');
  } else {
    console.log(`✅ Response data present`);
  }
  
  return { errors, warnings };
}

/**
 * Test single Oracle request with retry logic
 */
async function testOracleRequest(testCase, retryCount = 0) {
  const maxRetries = 2;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${testCase.description}`);
  console.log(`🎯 Oracle: ${testCase.oracle} | Query: "${testCase.query}"`);
  
  try {
    const response = await fetch('http://localhost:4001/api/oracle-manager/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: testCase.oracle,
        query: testCase.query,
        userId: 'comprehensive_test_suite'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const validation = validateResponse(data, testCase.expected, testCase.description);
    
    return {
      success: validation.errors.length === 0,
      errors: validation.errors,
      warnings: validation.warnings,
      response: data,
      testCase: testCase
    };
    
  } catch (error) {
    if (retryCount < maxRetries) {
      console.log(`⏳ Retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return testOracleRequest(testCase, retryCount + 1);
    }
    
    return {
      success: false,
      errors: [`Network Error: ${error.message}`],
      warnings: [],
      response: null,
      testCase: testCase
    };
  }
}

/**
 * Run comprehensive test suite
 */
async function runComprehensiveTests() {
  console.log('🚀 COMPREHENSIVE ORACLE AGENT TEST SUITE');
  console.log('Testing ALL 8 Oracle Agents with multiple queries each\n');
  console.log('=' .repeat(80));
  
  const results = [];
  const summary = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    byOracle: {}
  };
  
  // Group by oracle for summary
  testCases.forEach(tc => {
    if (!summary.byOracle[tc.oracle]) {
      summary.byOracle[tc.oracle] = { total: 0, passed: 0, failed: 0 };
    }
    summary.byOracle[tc.oracle].total++;
  });
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const result = await testOracleRequest(testCase);
    
    results.push(result);
    
    // Update summary
    const oracleStats = summary.byOracle[testCase.oracle];
    if (result.success) {
      summary.passed++;
      oracleStats.passed++;
      console.log(`\n✅ PASSED: ${testCase.description}`);
    } else {
      summary.failed++;
      oracleStats.failed++;
      console.log(`\n❌ FAILED: ${testCase.description}`);
      result.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (result.warnings.length > 0) {
      summary.warnings += result.warnings.length;
      result.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    // Wait between tests to avoid overwhelming the server
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\n🎯 OVERALL RESULTS:`);
  console.log(`   Total Tests: ${summary.total}`);
  console.log(`   Passed: ${summary.passed} ✅`);
  console.log(`   Failed: ${summary.failed} ❌`);
  console.log(`   Warnings: ${summary.warnings} ⚠️`);
  console.log(`   Success Rate: ${Math.round((summary.passed / summary.total) * 100)}%`);
  
  console.log(`\n📋 BY ORACLE BREAKDOWN:`);
  Object.keys(summary.byOracle).forEach(oracle => {
    const stats = summary.byOracle[oracle];
    const rate = Math.round((stats.passed / stats.total) * 100);
    const icon = getOracleIcon(oracle);
    console.log(`   ${icon} ${oracle.toUpperCase()}: ${stats.passed}/${stats.total} (${rate}%)`);
  });
  
  console.log(`\n🏆 ORACLE PERFORMANCE RANKING:`);
  const rankings = Object.keys(summary.byOracle)
    .map(oracle => ({
      oracle,
      rate: Math.round((summary.byOracle[oracle].passed / summary.byOracle[oracle].total) * 100),
      passed: summary.byOracle[oracle].passed,
      total: summary.byOracle[oracle].total
    }))
    .sort((a, b) => b.rate - a.rate);
  
  rankings.forEach((rank, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const icon = getOracleIcon(rank.oracle);
    console.log(`   ${medal} ${icon} ${rank.oracle}: ${rank.rate}% (${rank.passed}/${rank.total})`);
  });
  
  if (summary.passed === summary.total) {
    console.log('\n🎉 ALL TESTS PASSED! Oracle system is working perfectly!');
    console.log('✅ UI will display correctly for all Oracle agents');
  } else if (summary.passed / summary.total >= 0.8) {
    console.log('\n🎯 MOSTLY SUCCESSFUL! Minor issues detected');
    console.log('🔧 Some Oracle agents may need attention');
  } else {
    console.log('\n⚠️  SIGNIFICANT ISSUES DETECTED');
    console.log('🚨 Multiple Oracle agents need investigation');
  }
  
  return results;
}

function getOracleIcon(oracle) {
  const icons = {
    'chainlink': '🔗',
    'coingecko': '🦎',
    'dia': '💎',
    'weather': '🌤️',
    'exchangerate': '💱',
    'sports': '🏀',
    'nasa': '🚀',
    'wikipedia': '📚'
  };
  return icons[oracle] || '🔮';
}

// Auto-run if called directly
if (typeof window === 'undefined') {
  // Add fetch polyfill for Node.js
  if (typeof fetch === 'undefined') {
    try {
      const { default: fetch } = require('node-fetch');
      global.fetch = fetch;
    } catch (e) {
      console.log('⚠️  Warning: fetch not available. Please install node-fetch or use Node 18+');
      process.exit(1);
    }
  }
  runComprehensiveTests().catch(console.error);
}

module.exports = { testCases, runComprehensiveTests, validateResponse };