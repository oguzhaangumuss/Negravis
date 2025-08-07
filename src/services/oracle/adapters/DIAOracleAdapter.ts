import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * DIA Oracle Adapter
 * Provides transparent, customizable crypto price feeds from DIA oracle network
 * Free tier oracle with 3,000+ tokens coverage
 */
export class DIAOracleAdapter extends OracleProviderBase {
  public readonly name = 'dia';
  public readonly weight = 0.88;
  public readonly reliability = 0.91;
  public readonly latency = 400;

  private readonly baseEndpoint = 'https://api.diadata.org/v1';
  private readonly supportedTokens = new Set([
    'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'MATIC', 'DOT', 'LINK', 'AVAX',
    'UNI', 'ATOM', 'XRP', 'DOGE', 'LTC', 'ALGO', 'NEAR', 'FTM', 'AAVE'
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`💎 DIA fetchData called with query: "${query}"`);
    
    const symbol = this.extractSymbol(query);
    console.log(`🎯 Extracted symbol: "${symbol}"`);

    if (!this.supportedTokens.has(symbol)) {
      throw new OracleError(
        `Unsupported token for DIA: ${symbol}`,
        'UNSUPPORTED_SYMBOL',
        this.name,
        query
      );
    }

    try {
      return await this.fetchTokenPrice(symbol);
    } catch (error: any) {
      console.error(`❌ DIA fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch from DIA: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Fetch token price from DIA API
   */
  private async fetchTokenPrice(symbol: string): Promise<any> {
    // DIA uses blockchain/address format, we'll use common mappings
    const tokenMapping = this.getTokenMapping(symbol);
    const url = `${this.baseEndpoint}/assetQuotation/${tokenMapping.blockchain}/${tokenMapping.address}`;
    
    console.log(`💰 Fetching DIA price: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      // If specific token fails, try quotation endpoint
      return await this.fetchQuotation(symbol);
    }

    const data: any = await response.json();
    console.log(`📊 DIA response:`, data);

    if (!data || !data.Price) {
      throw new OracleError(
        `No price data found for ${symbol}`,
        'NO_DATA',
        this.name,
        symbol
      );
    }

    return {
      symbol: symbol,
      price: parseFloat(data.Price),
      timestamp: data.Time,
      source: data.Source || 'dia_oracle',
      blockchain: tokenMapping.blockchain,
      address: tokenMapping.address,
      confidence_score: this.calculateDIAConfidence(data),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Alternative quotation endpoint for common tokens
   */
  private async fetchQuotation(symbol: string): Promise<any> {
    const url = `${this.baseEndpoint}/quotation/${symbol}`;
    console.log(`💱 Fetching DIA quotation: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `DIA API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        symbol
      );
    }

    const data: any = await response.json();

    if (!data || !data.Price) {
      throw new OracleError(
        `No quotation data found for ${symbol}`,
        'NO_DATA',
        this.name,
        symbol
      );
    }

    return {
      symbol: symbol,
      price: parseFloat(data.Price),
      timestamp: data.Time,
      source: 'dia_quotation',
      name: data.Name,
      confidence_score: this.calculateDIAConfidence(data),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Get token mapping for DIA API
   */
  private getTokenMapping(symbol: string): { blockchain: string; address: string } {
    const mappings: { [key: string]: { blockchain: string; address: string } } = {
      'BTC': { blockchain: 'Bitcoin', address: '0x0000000000000000000000000000000000000000' },
      'ETH': { blockchain: 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
      'BNB': { blockchain: 'BinanceSmartChain', address: '0x0000000000000000000000000000000000000000' },
      'ADA': { blockchain: 'Cardano', address: '0x0000000000000000000000000000000000000000' },
      'SOL': { blockchain: 'Solana', address: '0x0000000000000000000000000000000000000000' },
      'MATIC': { blockchain: 'Polygon', address: '0x0000000000000000000000000000000000000000' },
      'DOT': { blockchain: 'Polkadot', address: '0x0000000000000000000000000000000000000000' },
      'LINK': { blockchain: 'Ethereum', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
      'AVAX': { blockchain: 'Avalanche', address: '0x0000000000000000000000000000000000000000' },
      'UNI': { blockchain: 'Ethereum', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
      'ATOM': { blockchain: 'Cosmos', address: '0x0000000000000000000000000000000000000000' },
      'XRP': { blockchain: 'Ripple', address: '0x0000000000000000000000000000000000000000' },
      'DOGE': { blockchain: 'Dogecoin', address: '0x0000000000000000000000000000000000000000' },
      'LTC': { blockchain: 'Litecoin', address: '0x0000000000000000000000000000000000000000' }
    };

    return mappings[symbol] || { blockchain: 'Ethereum', address: '0x0000000000000000000000000000000000000000' };
  }

  /**
   * Extract symbol from query
   */
  private extractSymbol(query: string): string {
    const upperQuery = query.toUpperCase();
    console.log(`🔍 DIA extractSymbol: "${query}" → "${upperQuery}"`);
    
    // Common crypto patterns
    const patterns = [
      /\b(BTC|BITCOIN)\b/i,
      /\b(ETH|ETHEREUM)\b/i,
      /\b(BNB|BINANCE)\b/i,
      /\b(ADA|CARDANO)\b/i,
      /\b(SOL|SOLANA)\b/i,
      /\b(MATIC|POLYGON)\b/i,
      /\b(DOT|POLKADOT)\b/i,
      /\b(LINK|CHAINLINK)\b/i,
      /\b(AVAX|AVALANCHE)\b/i,
      /\b(UNI|UNISWAP)\b/i,
      /\b(ATOM|COSMOS)\b/i,
      /\b(XRP|RIPPLE)\b/i,
      /\b(DOGE|DOGECOIN)\b/i,
      /\b(LTC|LITECOIN)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const token = match[1].toUpperCase();
        // Normalize to standard symbols
        if (['BTC', 'BITCOIN'].includes(token)) return 'BTC';
        if (['ETH', 'ETHEREUM'].includes(token)) return 'ETH';
        if (['BNB', 'BINANCE'].includes(token)) return 'BNB';
        if (['ADA', 'CARDANO'].includes(token)) return 'ADA';
        if (['SOL', 'SOLANA'].includes(token)) return 'SOL';
        if (['MATIC', 'POLYGON'].includes(token)) return 'MATIC';
        if (['DOT', 'POLKADOT'].includes(token)) return 'DOT';
        if (['LINK', 'CHAINLINK'].includes(token)) return 'LINK';
        if (['AVAX', 'AVALANCHE'].includes(token)) return 'AVAX';
        if (['UNI', 'UNISWAP'].includes(token)) return 'UNI';
        if (['ATOM', 'COSMOS'].includes(token)) return 'ATOM';
        if (['XRP', 'RIPPLE'].includes(token)) return 'XRP';
        if (['DOGE', 'DOGECOIN'].includes(token)) return 'DOGE';
        if (['LTC', 'LITECOIN'].includes(token)) return 'LTC';
      }
    }

    // Check supported tokens directly
    for (const token of this.supportedTokens) {
      if (upperQuery.includes(token)) {
        return token;
      }
    }

    console.log(`⚠️ No symbol found in "${query}", defaulting to BTC`);
    return 'BTC';
  }

  /**
   * Calculate confidence score based on DIA data quality
   */
  private calculateDIAConfidence(data: any): number {
    let confidence = 0.91; // Base confidence for DIA

    // Check for data completeness
    if (data.Source && data.Source.length > 0) confidence += 0.02;
    if (data.Name && data.Name.length > 0) confidence += 0.01;
    
    // Check timestamp freshness
    if (data.Time) {
      const dataTime = new Date(data.Time).getTime();
      const ageMinutes = (Date.now() - dataTime) / (1000 * 60);
      
      if (ageMinutes < 5) confidence += 0.03;       // Very fresh
      else if (ageMinutes < 30) confidence += 0.01; // Fresh
      else if (ageMinutes > 120) confidence -= 0.02; // Old data
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Health check implementation
   */
  protected async performHealthCheck(): Promise<void> {
    // Test with BTC quotation
    const url = `${this.baseEndpoint}/quotation/BTC`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`DIA health check failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data || !data.Price) {
      throw new Error('DIA API returned invalid data structure');
    }
  }

  /**
   * Enhanced confidence calculation for DIA data
   */
  protected calculateConfidence(data: any): number {
    if (!data || !data.price) return 0;

    return this.calculateDIAConfidence(data);
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens(): string[] {
    return Array.from(this.supportedTokens);
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'DIA Oracle',
      version: 'v1',
      description: 'Transparent, customizable crypto price feeds',
      coverage: '3000+ tokens',
      features: [
        'Free API access',
        'Multiple blockchain support',
        'Transparent methodology',
        'Custom data feeds',
        'High accuracy',
        'Community driven'
      ],
      dataTypes: [
        'Cryptocurrency prices',
        'DeFi token data',
        'Cross-chain assets',
        'Real-time quotes'
      ],
      blockchains: [
        'Ethereum', 'Bitcoin', 'Binance Smart Chain', 
        'Polygon', 'Avalanche', 'Solana', 'Cardano'
      ]
    };
  }

  /**
   * Get provider metrics
   */
  async getMetrics(): Promise<any> {
    const baseMetrics = await super.getMetrics();
    const isHealthy = await this.healthCheck();
    
    return {
      ...baseMetrics,
      provider: this.name,
      healthy: isHealthy,
      data_tier: 'free_transparent',
      supported_tokens: Array.from(this.supportedTokens).length,
      coverage: '3000+_tokens',
      update_frequency: '120_seconds_default',
      transparency: 'full_source_transparency',
      methodology: 'MAIR_default',
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get supported symbols
   */
  getSupportedSymbols(): string[] {
    const mappings: { [key: string]: { blockchain: string; address: string } } = {
      'BTC': { blockchain: 'Bitcoin', address: '0x0000000000000000000000000000000000000000' },
      'ETH': { blockchain: 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
      'BNB': { blockchain: 'BinanceSmartChain', address: '0x0000000000000000000000000000000000000000' },
      'ADA': { blockchain: 'Cardano', address: '0x0000000000000000000000000000000000000000' },
      'SOL': { blockchain: 'Solana', address: '0x0000000000000000000000000000000000000000' },
      'MATIC': { blockchain: 'Polygon', address: '0x0000000000000000000000000000000000000000' },
      'DOT': { blockchain: 'Polkadot', address: '0x0000000000000000000000000000000000000000' },
      'LINK': { blockchain: 'Ethereum', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
      'AVAX': { blockchain: 'Avalanche', address: '0x0000000000000000000000000000000000000000' },
      'UNI': { blockchain: 'Ethereum', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
      'ATOM': { blockchain: 'Cosmos', address: '0x0000000000000000000000000000000000000000' },
      'XRP': { blockchain: 'Ripple', address: '0x0000000000000000000000000000000000000000' },
      'DOGE': { blockchain: 'Dogecoin', address: '0x0000000000000000000000000000000000000000' },
      'LTC': { blockchain: 'Litecoin', address: '0x0000000000000000000000000000000000000000' }
    };
    
    return Object.keys(mappings);
  }
}