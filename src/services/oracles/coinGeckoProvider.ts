import { OracleProvider, PriceData, OracleResponse } from '../../interfaces/OracleProvider';

/**
 * CoinGecko API Oracle Provider
 * Provides cryptocurrency price data from CoinGecko
 */
export class CoinGeckoProvider implements OracleProvider {
  public readonly name = 'CoinGecko';
  public readonly dataSource = 'coingecko';
  public readonly endpoint = 'https://api.coingecko.com/api/v3';
  public readonly updateFrequency = 1; // 1 minute
  public readonly reliability = 95; // High reliability
  public isActive = true;

  private lastUpdate = new Date();
  private supportedSymbols = ['bitcoin', 'ethereum', 'cardano', 'solana', 'polygon'];
  private requestCount = 0;
  private successCount = 0;

  /**
   * Fetch cryptocurrency price from CoinGecko
   */
  async fetchPrice(symbol: string): Promise<OracleResponse<PriceData>> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      console.log(`🔍 CoinGecko: Fetching price for ${symbol}`);
      
      // Convert common symbols to CoinGecko IDs
      const coinId = this.symbolToCoinGeckoId(symbol);
      const url = `${this.endpoint}/simple/price?ids=${coinId}&vs_currencies=usd&include_last_updated_at=true`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Negravis-Oracle/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      if (!data[coinId] || !data[coinId].usd) {
        throw new Error(`Price data not found for ${symbol}`);
      }

      const priceData: PriceData = {
        symbol: symbol.toUpperCase(),
        price: data[coinId].usd,
        timestamp: data[coinId].last_updated_at * 1000, // Convert to milliseconds
        source: this.name,
        confidence: 0.95 // CoinGecko has high confidence
      };

      this.successCount++;
      this.lastUpdate = new Date();
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ CoinGecko: ${symbol} = $${priceData.price} (${executionTime}ms)`);

      return {
        success: true,
        data: priceData,
        timestamp: Date.now(),
        source: this.name,
        executionTime
      };

    } catch (error: any) {
      console.error(`❌ CoinGecko error for ${symbol}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
        source: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Health check - verify API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/ping`, {
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ CoinGecko health check failed:', error);
      return false;
    }
  }

  /**
   * Get supported cryptocurrency symbols
   */
  getSupportedSymbols(): string[] {
    return ['BTC', 'ETH', 'ADA', 'SOL', 'MATIC', 'HBAR'];
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): Date {
    return this.lastUpdate;
  }

  /**
   * Get provider metadata
   */
  getProviderInfo() {
    return {
      name: 'CoinGecko API',
      version: 'v3',
      description: 'Cryptocurrency price data from CoinGecko',
      rateLimit: 50 // requests per minute for free tier
    };
  }

  /**
   * Get success rate statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      successRate: this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Convert common symbols to CoinGecko coin IDs
   */
  private symbolToCoinGeckoId(symbol: string): string {
    const symbolMap: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum', 
      'ADA': 'cardano',
      'SOL': 'solana',
      'MATIC': 'matic-network',
      'HBAR': 'hedera-hashgraph'
    };

    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  }
}