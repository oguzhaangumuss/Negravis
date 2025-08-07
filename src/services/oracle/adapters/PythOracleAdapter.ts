import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * Pyth Network Oracle Adapter
 * Provides high-frequency, institutional-grade price feeds from Pyth Network
 * Premium tier oracle with sub-second latency and high reliability
 */
export class PythOracleAdapter extends OracleProviderBase {
  public readonly name = 'pyth';
  public readonly weight = 0.95; // High weight for premium data
  public readonly reliability = 0.98; // Very high reliability
  public readonly latency = 100; // Sub-second latency

  private readonly endpoint = 'https://hermes.pyth.network/api/latest_price_feeds';
  private readonly supportedIds = new Map([
    // Crypto assets
    ['BTC', '0xe62df6c8b4c85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'],
    ['ETH', '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'],
    ['SOL', '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'],
    ['BNB', '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f'],
    ['ADA', '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d'],
    ['AVAX', '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7'],
    ['DOT', '0xca3eed9b267293f91aa38bc2b2f4e3de8de46019b2bfdd7fbf3ccffe60f01cd5'],
    ['MATIC', '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52'],
    ['LINK', '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221'],
    ['UNI', '0x78d185a741d07edb3aeb9d728e227b84dd5c0b0b7ecc4a3e6d86acb63c14b30f'],
    // Forex pairs
    ['USD/EUR', '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b'],
    ['GBP/USD', '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1'],
    ['USD/JPY', '0xef2c98c804ba503c6a707e38be4dfbb940ee91c6b0c5b90f8d89b0ed72b85f0a'],
    // Commodities
    ['XAU/USD', '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2'], // Gold
    ['XAG/USD', '0xf2fb02c32b055c2cb2a435b04b37de321a86a6e1c54e7b4c2fb5a726440a84c1']  // Silver
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`⚡ Pyth fetchData called with query: "${query}"`);
    
    const symbol = this.extractSymbol(query);
    console.log(`🎯 Extracted symbol: "${symbol}"`);
    
    const priceId = this.symbolToPythId(symbol);
    console.log(`🆔 Pyth Price ID: "${priceId}"`);

    if (!priceId) {
      throw new OracleError(
        `Unsupported symbol for Pyth: ${symbol}`,
        'UNSUPPORTED_SYMBOL',
        this.name,
        query
      );
    }

    try {
      const url = `${this.endpoint}?ids[]=${priceId}`;
      console.log(`🌐 Fetching from Pyth: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Negravis-Oracle/2.0'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new OracleError(
          `Pyth API error: ${response.status} ${response.statusText}`,
          'API_ERROR',
          this.name,
          query
        );
      }

      const data: any = await response.json();
      console.log(`📊 Raw Pyth response:`, data);

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new OracleError(
          `No price data found for ${symbol}`,
          'NO_DATA',
          this.name,
          query
        );
      }

      const feedData = data[0];
      if (!feedData || !feedData.price) {
        throw new OracleError(
          `Invalid price data structure for ${symbol}`,
          'INVALID_DATA',
          this.name,
          query
        );
      }

      const priceData = feedData.price;
      const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
      const confidence = parseFloat(priceData.conf) * Math.pow(10, priceData.expo);
      
      // Calculate confidence score based on price/confidence ratio
      const confidenceRatio = confidence / price;
      const confidenceScore = Math.max(0.8, 1 - (confidenceRatio * 10)); // Higher confidence for lower ratios
      
      // Data freshness check
      const publishTime = parseInt(priceData.publish_time);
      const ageSeconds = (Date.now() / 1000) - publishTime;
      const freshnessPenalty = Math.min(0.1, ageSeconds / 300); // Penalty for data older than 5 minutes
      const finalConfidence = Math.max(0.7, confidenceScore - freshnessPenalty);

      const result = {
        symbol: symbol.toUpperCase(),
        price: price,
        confidence_interval: confidence,
        publish_time: publishTime,
        price_id: priceId,
        data_age_seconds: ageSeconds,
        confidence_ratio: confidenceRatio,
        source: 'pyth_network',
        network_status: feedData.status || 'trading',
        last_updated: new Date(publishTime * 1000).toISOString()
      };

      console.log(`✅ Pyth processed result:`, result);
      return result;

    } catch (error: any) {
      console.error(`❌ Pyth fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch from Pyth: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Extract symbol from various query formats
   */
  private extractSymbol(query: string): string {
    const upperQuery = query.toUpperCase();
    console.log(`🔍 Pyth extractSymbol: "${query}" → "${upperQuery}"`);
    
    // Crypto symbol patterns
    const cryptoPatterns = [
      /\b(BTC|BITCOIN)\b/i,
      /\b(ETH|ETHEREUM)\b/i,
      /\b(SOL|SOLANA)\b/i,
      /\b(BNB|BINANCE)\b/i,
      /\b(ADA|CARDANO)\b/i,
      /\b(AVAX|AVALANCHE)\b/i,
      /\b(DOT|POLKADOT)\b/i,
      /\b(MATIC|POLYGON)\b/i,
      /\b(LINK|CHAINLINK)\b/i,
      /\b(UNI|UNISWAP)\b/i
    ];
    
    for (const pattern of cryptoPatterns) {
      const match = query.match(pattern);
      if (match) {
        const token = match[1].toUpperCase();
        // Normalize to standard symbols
        if (['BTC', 'BITCOIN'].includes(token)) return 'BTC';
        if (['ETH', 'ETHEREUM'].includes(token)) return 'ETH';
        if (['SOL', 'SOLANA'].includes(token)) return 'SOL';
        if (['BNB', 'BINANCE'].includes(token)) return 'BNB';
        if (['ADA', 'CARDANO'].includes(token)) return 'ADA';
        if (['AVAX', 'AVALANCHE'].includes(token)) return 'AVAX';
        if (['DOT', 'POLKADOT'].includes(token)) return 'DOT';
        if (['MATIC', 'POLYGON'].includes(token)) return 'MATIC';
        if (['LINK', 'CHAINLINK'].includes(token)) return 'LINK';
        if (['UNI', 'UNISWAP'].includes(token)) return 'UNI';
      }
    }

    // Forex patterns
    if (upperQuery.includes('EUR') && upperQuery.includes('USD')) return 'USD/EUR';
    if (upperQuery.includes('GBP') && upperQuery.includes('USD')) return 'GBP/USD';
    if (upperQuery.includes('JPY') && upperQuery.includes('USD')) return 'USD/JPY';

    // Commodities
    if (upperQuery.includes('GOLD') || upperQuery.includes('XAU')) return 'XAU/USD';
    if (upperQuery.includes('SILVER') || upperQuery.includes('XAG')) return 'XAG/USD';

    // Default to BTC for crypto queries
    if (upperQuery.includes('PRICE') || upperQuery.includes('CRYPTO')) return 'BTC';
    
    console.log(`⚠️ No symbol found in "${query}", defaulting to BTC`);
    return 'BTC';
  }

  /**
   * Get Pyth price ID for symbol
   */
  private symbolToPythId(symbol: string): string | null {
    return this.supportedIds.get(symbol.toUpperCase()) || null;
  }

  /**
   * Health check implementation
   */
  protected async performHealthCheck(): Promise<void> {
    // Test with BTC price feed
    const btcPriceId = this.supportedIds.get('BTC');
    if (!btcPriceId) {
      throw new Error('BTC price ID not found');
    }

    const response = await fetch(`${this.endpoint}?ids[]=${btcPriceId}`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`Pyth health check failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data || !Array.isArray(data) || data.length === 0 || !data[0].price) {
      throw new Error('Pyth API returned invalid data structure');
    }
  }

  /**
   * Enhanced confidence calculation for Pyth data
   */
  protected calculateConfidence(data: any): number {
    if (!data || !data.price) return 0;

    let confidence = 0.95; // Base confidence for Pyth

    // Adjust based on confidence interval
    if (data.confidence_ratio) {
      if (data.confidence_ratio < 0.001) confidence += 0.03;      // Very tight spread
      else if (data.confidence_ratio < 0.01) confidence += 0.01;  // Good spread
      else if (data.confidence_ratio > 0.1) confidence -= 0.05;   // Wide spread
    }

    // Adjust based on data freshness
    if (data.data_age_seconds) {
      if (data.data_age_seconds < 1) confidence += 0.02;          // Very fresh
      else if (data.data_age_seconds < 10) confidence += 0.01;    // Fresh
      else if (data.data_age_seconds > 60) confidence -= 0.03;    // Stale
    }

    // Network status bonus
    if (data.network_status === 'trading') confidence += 0.01;

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Get supported symbols
   */
  getSupportedSymbols(): string[] {
    return Array.from(this.supportedIds.keys());
  }

  /**
   * Get Pyth price ID for symbol
   */
  getPriceId(symbol: string): string | null {
    return this.symbolToPythId(symbol);
  }

  /**
   * Add new symbol mapping
   */
  addSymbolMapping(symbol: string, priceId: string): void {
    this.supportedIds.set(symbol.toUpperCase(), priceId);
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'Pyth Network',
      version: 'v2',
      description: 'High-frequency institutional-grade price feeds',
      latency: `${this.latency}ms`,
      supportedAssets: this.getSupportedSymbols().length,
      features: [
        'Sub-second latency',
        'Institutional data sources',
        'High confidence scores',
        'Real-time updates',
        'Multi-asset coverage',
        'Premium reliability'
      ],
      dataProviders: '90+ premium publishers',
      updateFrequency: 'Real-time (milliseconds)'
    };
  }

  /**
   * Get provider metrics with Pyth-specific data
   */
  async getMetrics(): Promise<any> {
    const baseMetrics = await super.getMetrics();
    const isHealthy = await this.healthCheck();
    
    return {
      ...baseMetrics,
      provider: this.name,
      healthy: isHealthy,
      supported_assets: Array.from(this.supportedIds).length,
      data_tier: 'premium',
      average_latency_ms: this.latency,
      confidence_threshold: 0.95,
      update_frequency: 'real-time',
      last_check: new Date().toISOString()
    };
  }
}