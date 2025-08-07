/**
 * Frontend Response Test Suite
 * Tests Oracle responses directly from frontend perspective to validate query_info formatting
 */

const testCases = [
  {
    oracle: 'coingecko',
    query: 'bitcoin',
    expected: {
      query_type: 'crypto_price',
      symbol: 'BTC',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 90
    },
    description: 'CoinGecko BTC price with proper formatting'
  },
  {
    oracle: 'chainlink', 
    query: 'ethereum',
    expected: {
      query_type: 'crypto_price',
      symbol: 'ETH',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 90
    },
    description: 'Chainlink ETH price validation'
  },
  {
    oracle: 'weather',
    query: 'weather in Istanbul',
    expected: {
      query_type: 'weather',
      location: 'Istanbul',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 80
    },
    description: 'Weather Oracle Istanbul conditions'
  },
  {
    oracle: 'weather',
    query: 'London weather',
    expected: {
      query_type: 'weather',
      location: 'London',
      temperature_format: /^\d+°C$|^N\/A$/,
      min_confidence: 80
    },
    description: 'Weather Oracle London conditions'
  },
  {
    oracle: 'dia',
    query: 'solana price',
    expected: {
      query_type: 'crypto_price',
      symbol: 'SOL',
      price_format: /^\$[\d,]+\.\d{2}$/,
      min_confidence: 85
    },
    description: 'DIA Oracle SOL price feed'
  }
];

/**
 * Validate response structure and content
 */
function validateResponse(response, expected, testName) {
  const errors = [];
  
  console.log(`\n📊 Validating: ${testName}`);
  console.log(`📝 Raw query_info:`, response.query_info);
  
  // Check if query_info exists
  if (!response.query_info) {
    errors.push('❌ Missing query_info in response');
    return errors;
  }
  
  const qi = response.query_info;
  
  // Validate query type
  if (expected.query_type && qi.query_type !== expected.query_type) {
    errors.push(`❌ Query type: expected '${expected.query_type}', got '${qi.query_type}'`);
  } else {
    console.log(`✅ Query type: ${qi.query_type}`);
  }
  
  // Validate symbol/location
  const symbolField = expected.query_type === 'weather' ? 'location' : 'symbol';
  const expectedSymbol = expected[symbolField];
  if (expectedSymbol && qi.symbol !== expectedSymbol) {
    errors.push(`❌ Symbol: expected '${expectedSymbol}', got '${qi.symbol}'`);
  } else {
    console.log(`✅ Symbol/Location: ${qi.symbol}`);
  }
  
  // Validate answer format
  if (expected.price_format && !expected.price_format.test(qi.answer)) {
    errors.push(`❌ Price format: '${qi.answer}' doesn't match pattern ${expected.price_format}`);
  } else if (expected.temperature_format && !expected.temperature_format.test(qi.answer)) {
    errors.push(`❌ Temperature format: '${qi.answer}' doesn't match pattern ${expected.temperature_format}`);
  } else {
    console.log(`✅ Answer format: ${qi.answer}`);
  }
  
  // Validate confidence
  if (expected.min_confidence && qi.consensus && qi.consensus.confidence_score < expected.min_confidence) {
    errors.push(`❌ Confidence too low: ${qi.consensus.confidence_score}% < ${expected.min_confidence}%`);
  } else {
    console.log(`✅ Confidence: ${qi.consensus?.confidence_score || 'N/A'}%`);
  }
  
  // Validate sources
  if (!qi.sources || !Array.isArray(qi.sources) || qi.sources.length === 0) {
    errors.push('❌ Missing or empty sources array');
  } else {
    console.log(`✅ Sources: ${qi.sources.length} provider(s)`);
  }
  
  // Validate blockchain data
  if (!response.blockchain || !response.blockchain.transaction_id) {
    errors.push('❌ Missing blockchain verification');
  } else {
    console.log(`✅ Blockchain: ${response.blockchain.transaction_id}`);
  }
  
  return errors;
}

/**
 * Test single Oracle request
 */
async function testOracleRequest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.description}`);
  console.log(`🎯 Oracle: ${testCase.oracle}, Query: "${testCase.query}"`);
  
  try {
    const response = await fetch('http://localhost:4001/api/oracle-manager/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: testCase.oracle,
        query: testCase.query,
        userId: 'test_suite_user'
      })
    });
    
    if (!response.ok) {
      return {
        success: false,
        errors: [`HTTP ${response.status}: ${response.statusText}`]
      };
    }
    
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        errors: [`API Error: ${data.error}`]
      };
    }
    
    // Validate response structure
    const errors = validateResponse(data, testCase.expected, testCase.description);
    
    return {
      success: errors.length === 0,
      errors: errors,
      response: data
    };
    
  } catch (error) {
    return {
      success: false,
      errors: [`Network Error: ${error.message}`]
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Frontend Response Validation Suite\n');
  console.log('=' .repeat(60));
  
  const results = [];
  let totalTests = testCases.length;
  let passedTests = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const result = await testOracleRequest(testCase);
    
    results.push({
      testCase,
      result
    });
    
    if (result.success) {
      passedTests++;
      console.log(`\n✅ PASSED: ${testCase.description}`);
    } else {
      console.log(`\n❌ FAILED: ${testCase.description}`);
      result.errors.forEach(error => console.log(`   ${error}`));
    }
    
    // Wait 1.5 seconds between tests
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log(`📊 TEST SUMMARY`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${totalTests - passedTests} ❌`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! UI should display correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    console.log('\n🔧 Common issues:');
    console.log('   • query_info format mismatch between backend and frontend');
    console.log('   • Missing or incorrect query_type field');
    console.log('   • Price/temperature formatting issues');
    console.log('   • Confidence score validation problems');
  }
  
  return results;
}

// Auto-run if called directly
if (typeof window === 'undefined') {
  runAllTests().catch(console.error);
}

module.exports = { testCases, runAllTests, validateResponse };