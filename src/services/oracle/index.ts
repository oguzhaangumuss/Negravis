/**
 * Oracle System - Multi-Source Data Aggregation with Consensus
 * Issue #11 Implementation - Comprehensive oracle system with chatbot support
 */

// Core services
export { OracleRouter } from './OracleRouter';
export { OracleConsensusService } from './OracleConsensusService';
export { HederaOracleLogger } from './HederaOracleLogger';
export { OracleProviderBase } from './OracleProviderBase';

// Oracle adapters
export { ChainlinkOracleAdapter } from './adapters/ChainlinkOracleAdapter';
export { CustomAPIAdapter } from './adapters/CustomAPIAdapter';
export { CoinGeckoOracleAdapter } from './adapters/CoinGeckoOracleAdapter';
export { WeatherOracleAdapter } from './adapters/WeatherOracleAdapter';
export { WebScrapingAdapter } from './adapters/WebScrapingAdapter';

// Types and interfaces
export * from '../../types/oracle';

// Backward compatibility exports for migration
export type { CustomAPIConfig, APIEndpointConfig } from './adapters/CustomAPIAdapter';
export type { ConsensusConfig } from './OracleConsensusService';

/**
 * Create and initialize Oracle Router with default configuration
 */
export async function createOracleRouter(config?: any): Promise<OracleRouter> {
  const router = new OracleRouter(config);
  await router.initialize();
  return router;
}

/**
 * Quick access to price data (backward compatibility)
 */
export async function getPrice(symbol: string, config?: any): Promise<any> {
  const router = await createOracleRouter(config);
  try {
    return await router.getPrice(symbol);
  } finally {
    await router.close();
  }
}

/**
 * Quick access to weather data (backward compatibility)
 */
export async function getWeather(location: string, config?: any): Promise<any> {
  const router = await createOracleRouter(config);
  try {
    return await router.getWeather(location);
  } finally {
    await router.close();
  }
}

/**
 * Default oracle configuration
 */
export const DEFAULT_ORACLE_CONFIG = {
  consensus: {
    default_method: 'median',
    min_responses: 2,
    max_response_time: 10000,
    outlier_threshold: 0.3
  },
  cache: {
    enabled: true,
    ttl: 60000,
    max_size: 1000
  },
  providers: {
    chainlink: { enabled: true, weight: 0.95, config: {} },
    coingecko: { enabled: true, weight: 0.9, config: {} },
    weather: { enabled: true, weight: 0.85, config: {} },
    webscraping: { enabled: true, weight: 0.6, config: {} }
  },
  hcs: {
    enabled: false,
    topic_id: '',
    batch_size: 10
  }
};