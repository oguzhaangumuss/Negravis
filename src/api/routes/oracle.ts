import { Router } from 'express';
import { OracleManager } from '../../services/oracle/OracleManager';

const router = Router();
let oracleManager: OracleManager | null = null;

/**
 * Initialize Oracle Manager singleton
 */
const initializeOracleManager = async (): Promise<OracleManager> => {
  if (!oracleManager) {
    oracleManager = new OracleManager();
    await oracleManager.initialize();
  }
  return oracleManager;
};

/**
 * GET /api/oracle/providers
 * Get available oracle providers with categories
 */
router.get('/providers', async (req, res) => {
  try {
    const manager = await initializeOracleManager();
    const categories = manager.getOraclesByCategory();
    
    res.json({
      success: true,
      data: {
        categories,
        total_providers: Object.values(categories).reduce((sum, oracles) => sum + oracles.length, 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oracle/providers/:providerId
 * Get specific provider details
 */
router.get('/providers/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const manager = await initializeOracleManager();
    const categories = manager.getOraclesByCategory();
    
    // Find provider in categories
    let provider = null;
    for (const categoryOracles of Object.values(categories)) {
      provider = categoryOracles.find(p => p.id === providerId);
      if (provider) break;
    }
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Provider '${providerId}' not found`
      });
    }
    
    res.json({
      success: true,
      data: provider
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/oracle/query
 * Process oracle query with selected provider
 */
router.post('/query', async (req, res) => {
  try {
    const { provider, query, userId } = req.body;
    
    // Validation
    if (!provider || !query) {
      return res.status(400).json({
        success: false,
        error: 'Provider and query are required'
      });
    }
    
    const manager = await initializeOracleManager();
    const result = await manager.processUserQuery(provider, query, userId);
    
    // Extract data from raw_data for different query types
    let queryInfo = null;
    console.log('🔍 Debug raw_data:', result.raw_data);
    console.log('🔍 Debug raw_data type:', typeof result.raw_data);
    
    if (result.raw_data) {
      // Handle crypto price queries - could be object or number
      if (typeof result.raw_data === 'object' && result.raw_data.symbol && result.raw_data.price) {
        // Raw data is detailed object with symbol and price
        console.log('🔍 Crypto object format');
        queryInfo = {
          symbol: result.raw_data.symbol,
          answer: `$${result.raw_data.price.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`,
          query_type: 'crypto_price',
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'median',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle simple number price data (like CoinGecko)
      else if (typeof result.raw_data === 'number' && result.data_sources.some(source => 
        ['coingecko', 'chainlink', 'dia'].includes(source))) {
        console.log('🔍 Crypto number format:', result.raw_data);
        const cryptoSymbol = query.toLowerCase().includes('bitcoin') || query.toLowerCase().includes('btc') ? 'BTC' :
                             query.toLowerCase().includes('ethereum') || query.toLowerCase().includes('eth') ? 'ETH' :
                             query.toLowerCase().includes('solana') || query.toLowerCase().includes('sol') ? 'SOL' : 'CRYPTO';
        
        queryInfo = {
          symbol: cryptoSymbol,
          answer: `$${result.raw_data.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`,
          query_type: 'crypto_price',
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api', 
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'median',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle weather queries  
      else if (typeof result.raw_data === 'object' && (result.raw_data.location || result.raw_data.temperature !== undefined)) {
        const temp = result.raw_data.temperature || 'N/A';
        const location = result.raw_data.location || 'Unknown';
        queryInfo = {
          symbol: location,
          answer: `${temp}°C`,
          query_type: 'weather',
          location: location,
          temperature: temp,
          humidity: result.raw_data.humidity,
          weather_description: result.raw_data.weather_description,
          wind_speed: result.raw_data.wind_speed,
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'single_source',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle exchange rate queries
      else if (typeof result.raw_data === 'object' && (result.raw_data.pair || result.raw_data.rate !== undefined)) {
        const pair = result.raw_data.pair || 'Currency';
        const rate = result.raw_data.rate || 'N/A';
        const baseCurrency = result.raw_data.base_currency || '';
        const targetCurrency = result.raw_data.target_currency || '';
        
        queryInfo = {
          symbol: pair,
          answer: `${rate} ${targetCurrency}/${baseCurrency}`,
          query_type: 'exchange_rate',
          pair: pair,
          rate: rate,
          base_currency: baseCurrency,
          target_currency: targetCurrency,
          timestamp: result.raw_data.timestamp,
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'single_source',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle NASA queries  
      else if (typeof result.raw_data === 'object' && (result.raw_data.type && (result.raw_data.type.includes('astronomy') || result.raw_data.type.includes('nasa') || result.raw_data.type.includes('near_earth') || result.raw_data.type.includes('mars') || result.raw_data.type.includes('space')) || result.raw_data.title || result.data_sources.includes('nasa'))) {
        let title, explanation, answer;
        const dataType = result.raw_data.type || 'nasa_data';
        
        // Handle different NASA data types
        if (dataType === 'astronomy_picture') {
          title = result.raw_data.title || 'Astronomy Picture';
          explanation = result.raw_data.explanation || 'No description available';
          answer = explanation.substring(0, 150) + (explanation.length > 150 ? '...' : '');
        } else if (dataType === 'mars_rover_photos') {
          title = 'Mars Rover Photos';
          explanation = `Mars rover images from ${result.raw_data.rover || 'rover'} taken on ${result.raw_data.earth_date || result.raw_data.date || 'Mars'}`;
          answer = `${result.raw_data.photo_count || 'Multiple'} Mars photos available`;
        } else if (dataType === 'space_weather') {
          title = 'Space Weather Data';
          explanation = `Space weather conditions and solar activity data for ${result.raw_data.date || 'current period'}`;
          answer = `Space weather: ${result.raw_data.summary || 'Current conditions available'}`;
        } else if (dataType === 'near_earth_objects') {
          title = 'Near Earth Objects';
          const objectCount = result.raw_data.object_count || 0;
          const hazardousCount = result.raw_data.potentially_hazardous_count || 0;
          explanation = `${objectCount} near Earth objects detected, ${hazardousCount} potentially hazardous`;
          answer = `${objectCount} NEOs detected (${hazardousCount} hazardous)`;
        } else {
          title = result.raw_data.title || 'NASA Space Data';
          explanation = result.raw_data.explanation || result.raw_data.description || 'Space data available';
          answer = explanation.substring(0, 150) + (explanation.length > 150 ? '...' : '');
        }
        
        queryInfo = {
          symbol: title,
          answer: answer,
          query_type: 'nasa',
          title: title,
          explanation: explanation,
          data_type: dataType,
          date: result.raw_data.date,
          url: result.raw_data.url,
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'single_source',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle Wikipedia queries
      else if (typeof result.raw_data === 'object' && (result.raw_data.results_count || result.raw_data.top_result || result.raw_data.type && result.raw_data.type.includes('wikipedia') || result.data_sources.includes('wikipedia'))) {
        const topResult = result.raw_data.top_result || {};
        const title = topResult.title || 'Knowledge';
        const extract = topResult.extract || topResult.summary || 'No summary available';
        const resultsCount = result.raw_data.results_count || 0;
        
        queryInfo = {
          symbol: title,
          answer: extract.substring(0, 200) + (extract.length > 200 ? '...' : ''),
          query_type: 'wikipedia',
          title: title,
          extract: extract,
          results_count: resultsCount,
          url: topResult.url,
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'single_source',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle Sports queries
      else if (typeof result.raw_data === 'object' && (result.raw_data.type && result.raw_data.type.includes('sports') || result.raw_data.team_name || result.raw_data.sport || result.data_sources.includes('sports'))) {
        const teamName = result.raw_data.team_name || 'Sports Data';
        const sport = result.raw_data.sport || '';
        const league = result.raw_data.league || '';
        const description = result.raw_data.description || 'N/A';
        
        queryInfo = {
          symbol: teamName,
          answer: `${sport} team in ${league}`,
          query_type: 'sports',
          team_name: teamName,
          sport: sport,
          league: league,
          country: result.raw_data.country,
          founded: result.raw_data.founded,
          stadium: result.raw_data.stadium,
          description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
          website: result.raw_data.website,
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'single_source',
            provider_count: result.data_sources.length
          }
        };
      }
      // Handle other queries (generic)
      else {
        queryInfo = {
          symbol: 'Query',
          answer: JSON.stringify(result.raw_data).substring(0, 100),
          query_type: 'generic',
          sources: result.data_sources.map(source => ({
            name: source,
            type: 'api',
            confidence: Math.round(result.confidence * 100)
          })),
          consensus: {
            confidence_score: Math.round(result.confidence * 100),
            method: 'median',
            provider_count: result.data_sources.length
          }
        };
      }
    }
    
    res.json({
      success: true,
      data: result,
      query_info: queryInfo,
      blockchain: {
        transaction_id: result.blockchain_hash,
        hash: `0x${Buffer.from(result.blockchain_hash).toString('hex').slice(0, 32).padEnd(32, '0')}`,
        network: 'hedera-testnet',
        verified: true,
        explorer_link: result.blockchain_link
      },
      hashscan_url: result.blockchain_link,
      metadata: {
        confidence: result.confidence,
        sources: result.data_sources,
        method: 'median',
        providersUsed: result.data_sources.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/oracle/recommendations
 * Get oracle recommendations for a query
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    const manager = await initializeOracleManager();
    const recommendations = manager.getRecommendedOracles(query);
    const categories = manager.getOraclesByCategory();
    
    // Get full provider details for recommendations
    const recommendedProviders = recommendations.map(providerId => {
      for (const categoryOracles of Object.values(categories)) {
        const provider = categoryOracles.find(p => p.id === providerId);
        if (provider) return provider;
      }
      return null;
    }).filter(p => p !== null);
    
    res.json({
      success: true,
      data: {
        query,
        recommendations: recommendedProviders,
        total_recommended: recommendedProviders.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oracle/health
 * Get system health status
 */
router.get('/health', async (req, res) => {
  try {
    const manager = await initializeOracleManager();
    const health = await manager.getSystemHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oracle/stats
 * Get detailed system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const manager = await initializeOracleManager();
    const health = await manager.getSystemHealth();
    const categories = manager.getOraclesByCategory();
    
    const stats = {
      system_health: health,
      provider_breakdown: Object.entries(categories).map(([category, providers]) => ({
        category,
        count: providers.length,
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          reliability: p.reliability,
          latency: p.latency
        }))
      })),
      total_categories: Object.keys(categories).length,
      total_providers: Object.values(categories).reduce((sum, oracles) => sum + oracles.length, 0)
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/oracle/bulk-query
 * Process multiple queries in batch
 */
router.post('/bulk-query', async (req, res) => {
  try {
    const { queries, userId } = req.body;
    
    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: 'Queries array is required'
      });
    }
    
    const manager = await initializeOracleManager();
    const results = [];
    
    for (const queryItem of queries) {
      if (!queryItem.provider || !queryItem.query) {
        results.push({
          success: false,
          error: 'Provider and query are required for each item'
        });
        continue;
      }
      
      try {
        const result = await manager.processUserQuery(
          queryItem.provider,
          queryItem.query,
          userId
        );
        results.push({
          success: true,
          data: result
        });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          query: queryItem.query,
          provider: queryItem.provider
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        results,
        total_processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oracle/blockchain/:hash
 * Verify blockchain transaction
 */
router.get('/blockchain/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    // For now, return mock verification data
    // In production, this would verify the hash on Hedera network
    const verification = {
      transaction_id: hash,
      status: hash.startsWith('0x') ? 'verified' : 'invalid',
      timestamp: new Date().toISOString(),
      explorer_url: `https://hashscan.io/testnet/transaction/${hash}`,
      network: 'hedera-testnet'
    };
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;