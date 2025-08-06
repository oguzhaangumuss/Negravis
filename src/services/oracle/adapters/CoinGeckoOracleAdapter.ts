import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * CoinGecko Oracle Adapter (Migrated from old system)
 * Provides cryptocurrency price data from CoinGecko API
 * Enhanced with new oracle system features
 */
export class CoinGeckoOracleAdapter extends OracleProviderBase {
  public readonly name = 'coingecko';
  public readonly weight = 0.9;
  public readonly reliability = 0.95;
  public readonly latency = 800;

  private readonly endpoint = 'https://api.coingecko.com/api/v3';
  private readonly supportedSymbols = new Map([
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['ADA', 'cardano'],
    ['SOL', 'solana'],
    ['MATIC', 'matic-network'],
    ['HBAR', 'hedera-hashgraph'],
    ['DOT', 'polkadot'],
    ['LINK', 'chainlink'],
    ['AVAX', 'avalanche-2'],
    ['ATOM', 'cosmos']
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    const symbol = this.extractSymbol(query);
    const coinId = this.symbolToCoinGeckoId(symbol);

    if (!coinId) {
      throw new OracleError(
        `Unsupported symbol: ${symbol}`,
        'UNSUPPORTED_SYMBOL',
        this.name,
        query
      );
    }

    try {
      const url = `${this.endpoint}/simple/price?ids=${coinId}&vs_currencies=usd&include_last_updated_at=true&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Negravis-Oracle/2.0'
        }
      });

      if (!response.ok) {
        throw new OracleError(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
          'API_ERROR',
          this.name,
          query
        );
      }

      const data: any = await response.json();
      
      if (!data[coinId] || !data[coinId].usd) {
        throw new OracleError(
          `Price data not found for ${symbol}`,
          'NO_DATA',
          this.name,
          query
        );
      }

      const coinData = data[coinId];
      
      return {
        symbol: symbol.toUpperCase(),
        price: coinData.usd,
        market_cap: coinData.usd_market_cap,
        volume_24h: coinData.usd_24h_vol,
        change_24h: coinData.usd_24h_change,
        last_updated: coinData.last_updated_at * 1000,
        coin_id: coinId,
        source: 'coingecko'
      };

    } catch (error: any) {
      if (error instanceof OracleError) {
        throw error;
      }
      throw new OracleError(
        `CoinGecko fetch failed: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  protected async performHealthCheck(): Promise<void> {
    const response = await fetch(`${this.endpoint}/ping`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0'
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko health check failed: ${response.status}`);
    }
  }

  protected calculateConfidence(data: any): number {
    if (!data || !data.price) return 0;

    let confidence = 0.95; // Base confidence for CoinGecko

    // Adjust based on data freshness
    if (data.last_updated) {
      const age = Date.now() - data.last_updated;
      const ageMinutes = age / (1000 * 60);
      
      if (ageMinutes < 5) confidence += 0.03;       // Very fresh
      else if (ageMinutes < 15) confidence += 0.01; // Fresh
      else if (ageMinutes > 60) confidence -= 0.05; // Old data
    }

    // Adjust based on market cap (higher = more reliable)
    if (data.market_cap) {
      if (data.market_cap > 1e9) confidence += 0.02;      // > $1B
      else if (data.market_cap > 1e8) confidence += 0.01;  // > $100M
      else if (data.market_cap < 1e6) confidence -= 0.03;  // < $1M
    }

    // Adjust based on volume (higher volume = more reliable)
    if (data.volume_24h && data.market_cap) {
      const volumeRatio = data.volume_24h / data.market_cap;
      if (volumeRatio > 0.1) confidence += 0.01;      // High trading activity
      else if (volumeRatio < 0.001) confidence -= 0.02; // Low liquidity
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  private extractSymbol(query: string): string {
    // Extract cryptocurrency symbol from various query formats
    const upperQuery = query.toUpperCase();
    
    // Direct symbol match
    for (const [symbol] of this.supportedSymbols) {
      if (upperQuery.includes(symbol)) {
        return symbol;
      }
    }

    // Price query format: "BTC price", "bitcoin price"
    const priceMatch = upperQuery.match(/(\w+)\s+PRICE/);
    if (priceMatch) {
      const token = priceMatch[1];
      // Check if it's a symbol or name
      if (this.supportedSymbols.has(token)) {
        return token;
      }
      // Check if it's a coin name
      for (const [symbol, name] of this.supportedSymbols) {
        if (name.toUpperCase().includes(token)) {
          return symbol;
        }
      }
    }

    // Default to BTC if nothing found
    return 'BTC';
  }

  private symbolToCoinGeckoId(symbol: string): string | null {
    return this.supportedSymbols.get(symbol.toUpperCase()) || null;
  }

  /**
   * Get supported cryptocurrency symbols
   */
  getSupportedSymbols(): string[] {
    return Array.from(this.supportedSymbols.keys());
  }

  /**
   * Get CoinGecko coin ID for symbol
   */
  getCoinId(symbol: string): string | null {
    return this.symbolToCoinGeckoId(symbol);
  }

  /**
   * Add new symbol mapping
   */
  addSymbolMapping(symbol: string, coinId: string): void {
    this.supportedSymbols.set(symbol.toUpperCase(), coinId);
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'CoinGecko API',
      version: 'v3',
      description: 'Cryptocurrency price data with market metrics',
      rateLimit: 50, // requests per minute for free tier
      supportedPairs: this.getSupportedSymbols().length,
      features: [
        'Real-time prices',
        'Market cap data',
        '24h volume',
        '24h price change',
        'High reliability',
        'Global coverage'
      ]
    };
  }
}