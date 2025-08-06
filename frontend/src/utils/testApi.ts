/**
 * API Test Utility
 * Quick test function for Oracle APIs
 */

import { oracleApi } from '../services/oracleApi';

export const testOracleAPIs = async () => {
  console.log('🧪 Testing Oracle APIs...');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const health = await oracleApi.healthCheck();
    console.log('Health:', health.success ? '✅ Healthy' : '❌ Unhealthy');
    
    // Test system status
    console.log('2. Testing system status...');
    const status = await oracleApi.getSystemStatus();
    console.log('System Status:', status.success ? '✅ Connected' : '❌ Failed');
    
    // Test BTC price
    console.log('3. Testing BTC price...');
    const btcPrice = await oracleApi.getPrice('BTC');
    console.log('BTC Price:', btcPrice.success ? `✅ $${btcPrice.data?.price}` : '❌ Failed');
    
    // Test weather
    console.log('4. Testing weather for London...');
    const weather = await oracleApi.getWeather('London');
    console.log('London Weather:', weather.success ? `✅ ${weather.data?.temperature}°C` : '❌ Failed');
    
    // Test general query
    console.log('5. Testing general oracle query...');
    const query = await oracleApi.query('ETH price');
    console.log('ETH Query:', query.success ? '✅ Success' : '❌ Failed');
    
    console.log('🎉 API Tests completed!');
    
    return {
      health: health.success,
      status: status.success,
      price: btcPrice.success,
      weather: weather.success,
      query: query.success
    };
    
  } catch (error: unknown) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    return {
      health: false,
      status: false, 
      price: false,
      weather: false,
      query: false
    };
  }
};

// For browser console testing
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).testOracleAPIs = testOracleAPIs;
}