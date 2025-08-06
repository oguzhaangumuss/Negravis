import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * Chainlink Oracle Adapter
 * Integrates with Chainlink Price Feeds for reliable financial data
 */
export class ChainlinkOracleAdapter extends OracleProviderBase {
  public readonly name = 'chainlink';
  public readonly weight = 0.95;
  public readonly reliability = 0.98;
  public readonly latency = 300;

  private readonly priceFeeds: Map<string, string> = new Map([
    ['ETH/USD', '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'],
    ['BTC/USD', '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c'],
    ['MATIC/USD', '0x7bAC85A8a13A4BcD8aba3F3Ec2a08Cf68a4A3819'],
    ['LINK/USD', '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c'],
    ['ADA/USD', '0xAE48c91dF1fE419994FFDa27da09D5aC69c30f55']
  ]);

  private readonly rpcEndpoint: string;

  constructor(rpcEndpoint: string = 'https://eth-mainnet.alchemyapi.io/v2/demo') {
    super();
    this.rpcEndpoint = rpcEndpoint;
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    const normalizedQuery = this.normalizeQuery(query);
    const contractAddress = this.priceFeeds.get(normalizedQuery);

    if (!contractAddress) {
      throw new OracleError(
        `Price feed not available for ${query}`,
        'UNSUPPORTED_PAIR',
        this.name,
        query
      );
    }

    try {
      // Simulate Chainlink price feed call
      // In real implementation, this would use ethers.js or web3.js
      const priceData = await this.callChainlinkAggregator(contractAddress);
      
      return {
        price: priceData.answer,
        decimals: priceData.decimals,
        updatedAt: priceData.updatedAt,
        round: priceData.round,
        pair: normalizedQuery
      };

    } catch (error: any) {
      throw new OracleError(
        `Chainlink fetch failed for ${query}: ${error.message}`,
        'CHAINLINK_ERROR',
        this.name,
        query
      );
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Test with ETH/USD feed
    await this.callChainlinkAggregator(this.priceFeeds.get('ETH/USD')!);
  }

  private normalizeQuery(query: string): string {
    // Convert various query formats to standardized pair format
    const cleanQuery = query.toUpperCase().replace(/\s+/g, '');
    console.log(`🔗 Chainlink normalizeQuery: "${query}" → "${cleanQuery}"`);
    
    // Symbol mapping for better compatibility
    const symbolMap: Record<string, string> = {
      'BITCOIN': 'BTC',
      'ETHEREUM': 'ETH',
      'BINANCE': 'BNB',
      'BINANCECOIN': 'BNB',
      'CARDANO': 'ADA',
      'SOLANA': 'SOL',
      'POLYGON': 'MATIC',
      'CHAINLINK': 'LINK',
      'AVALANCHE': 'AVAX',
      'POLKADOT': 'DOT'
    };

    // Handle different input formats
    if (cleanQuery.includes('PRICE')) {
      const match = cleanQuery.match(/([\w]+).*PRICE/);
      if (match) {
        const symbol = symbolMap[match[1]] || match[1];
        console.log(`🎯 Chainlink extracted symbol: "${match[1]}" → "${symbol}"`);
        return `${symbol}/USD`;
      }
    }

    // Direct pair format
    if (cleanQuery.includes('/')) {
      return cleanQuery;
    }

    // Single asset - default to USD with symbol mapping
    const mappedSymbol = symbolMap[cleanQuery] || cleanQuery;
    console.log(`🎯 Chainlink mapped symbol: "${cleanQuery}" → "${mappedSymbol}"`);
    return `${mappedSymbol}/USD`;
  }

  private async callChainlinkAggregator(contractAddress: string): Promise<any> {
    // Mock Chainlink aggregator response
    // In real implementation, this would call the actual contract
    const mockPrices: Record<string, number> = {
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419': 2450.50, // ETH/USD
      '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c': 42750.75, // BTC/USD
      '0x7bAC85A8a13A4BcD8aba3F3Ec2a08Cf68a4A3819': 0.85, // MATIC/USD
      '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c': 14.25, // LINK/USD
      '0xAE48c91dF1fE419994FFDa27da09D5AC69c30f55': 0.45 // ADA/USD
    };

    const basePrice = mockPrices[contractAddress] || 100;
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    const price = basePrice * (1 + variation);

    return {
      answer: Math.floor(price * 1e8), // Chainlink uses 8 decimals
      decimals: 8,
      updatedAt: Math.floor(Date.now() / 1000),
      round: Math.floor(Math.random() * 1000000)
    };
  }

  protected calculateConfidence(data: any): number {
    if (!data || !data.price) return 0;

    // Higher confidence for recent updates
    const timeDiff = Date.now() / 1000 - data.updatedAt;
    if (timeDiff < 300) return 0.98; // 5 minutes
    if (timeDiff < 900) return 0.95; // 15 minutes
    if (timeDiff < 1800) return 0.90; // 30 minutes
    
    return 0.85; // Older data
  }

  /**
   * Get available price pairs
   */
  getAvailablePairs(): string[] {
    return Array.from(this.priceFeeds.keys());
  }

  /**
   * Add new price feed
   */
  addPriceFeed(pair: string, contractAddress: string): void {
    this.priceFeeds.set(pair.toUpperCase(), contractAddress);
  }
}