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
    ['BNB', 'binancecoin'],
    ['ADA', 'cardano'],
    ['SOL', 'solana'],
    ['MATIC', 'matic-network'],
    ['HBAR', 'hedera-hashgraph'],
    ['DOT', 'polkadot'],
    ['LINK', 'chainlink'],
    ['AVAX', 'avalanche-2'],
    ['ATOM', 'cosmos'],
    ['XRP', 'ripple'],
    ['DOGE', 'dogecoin'],
    ['LTC', 'litecoin']
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`🚀 CoinGecko fetchData called with query: "${query}"`);
    const symbol = this.extractSymbol(query);
    console.log(`🎯 Extracted symbol: "${symbol}"`);
    const coinId = this.symbolToCoinGeckoId(symbol);
    console.log(`🆔 CoinGecko ID: "${coinId}"`);

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
    console.log(`🔍 CoinGecko extractSymbol: "${query}" → "${upperQuery}"`);
    
    // Multiple regex patterns for better symbol extraction
    const patterns = [
      /\b(BTC|BITCOIN)\b/i,
      /\b(ETH|ETHEREUM)\b/i,
      /\b(BNB|BINANCE|BINANCECOIN)\b/i,
      /\b(ADA|CARDANO)\b/i,
      /\b(DOT|POLKADOT)\b/i,
      /\b(SOL|SOLANA)\b/i,
      /\b(MATIC|POLYGON)\b/i,
      /\b(AVAX|AVALANCHE)\b/i,
      /\b(ATOM|COSMOS)\b/i,
      /\b(LINK|CHAINLINK)\b/i,
      /\b(XRP|RIPPLE)\b/i,
      /\b(DOGE|DOGECOIN)\b/i,
      /\b(LTC|LITECOIN)\b/i,
      /\b(UNI|UNISWAP)\b/i,
      /\b(HBAR|HEDERA)\b/i,
    ];
    
    // Check each pattern
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const token = match[1].toUpperCase();
        console.log(`✅ Pattern matched: "${token}"`);
        // Return the symbol (first 3-4 chars typically)
        if (['BTC', 'BITCOIN'].includes(token)) return 'BTC';
        if (['ETH', 'ETHEREUM'].includes(token)) return 'ETH';
        if (['BNB', 'BINANCE', 'BINANCECOIN'].includes(token)) return 'BNB';
        if (['ADA', 'CARDANO'].includes(token)) return 'ADA';
        if (['DOT', 'POLKADOT'].includes(token)) return 'DOT';
        if (['SOL', 'SOLANA'].includes(token)) return 'SOL';
        if (['MATIC', 'POLYGON'].includes(token)) return 'MATIC';
        if (['AVAX', 'AVALANCHE'].includes(token)) return 'AVAX';
        if (['ATOM', 'COSMOS'].includes(token)) return 'ATOM';
        if (['LINK', 'CHAINLINK'].includes(token)) return 'LINK';
        if (['XRP', 'RIPPLE'].includes(token)) return 'XRP';
        if (['DOGE', 'DOGECOIN'].includes(token)) return 'DOGE';
        if (['LTC', 'LITECOIN'].includes(token)) return 'LTC';
        if (['UNI', 'UNISWAP'].includes(token)) return 'UNI';
        if (['HBAR', 'HEDERA'].includes(token)) return 'HBAR';
      }
    }

    // Fallback: Check direct symbol match at word boundaries
    for (const [symbol] of this.supportedSymbols) {
      const symbolRegex = new RegExp(`\\b${symbol}\\b`);
      if (symbolRegex.test(upperQuery)) {
        return symbol;
      }
    }

    // Price query format: "SYMBOL price"
    const priceMatch = upperQuery.match(/\b(BTC|ETH|BNB|ADA|DOT|SOL|MATIC|AVAX|ATOM|LINK|XRP|DOGE|LTC|UNI)\s+(PRICE|VALUE|COST)\b/);
    if (priceMatch) {
      return priceMatch[1];
    }

    // Default to BTC if nothing found
    console.log(`⚠️ No symbol found in "${query}", defaulting to BTC`);
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