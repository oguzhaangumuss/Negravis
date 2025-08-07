import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';
import axios, { AxiosInstance } from 'axios';

/**
 * Custom API Oracle Adapter
 * Generic adapter for REST APIs with configurable endpoints and transformers
 */
export class CustomAPIAdapter extends OracleProviderBase {
  public readonly name: string;
  public readonly weight: number;
  public readonly reliability: number;
  public readonly latency: number;

  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly endpoints: Map<string, APIEndpointConfig>;

  constructor(config: CustomAPIConfig) {
    super();
    this.name = config.name || 'custom-api';
    this.weight = config.weight || 0.7;
    this.reliability = config.reliability || 0.8;
    this.latency = config.latency || 1000;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.endpoints = new Map(Object.entries(config.endpoints || {}));

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'Oracle-System/1.0',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Setup default endpoints
    this.setupDefaultEndpoints();
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    const endpointConfig = this.findMatchingEndpoint(query);
    
    if (!endpointConfig) {
      throw new OracleError(
        `No endpoint configuration found for query: ${query}`,
        'NO_ENDPOINT',
        this.name,
        query
      );
    }

    try {
      const url = this.buildUrl(endpointConfig.path, query);
      const response = await this.client.get(url, {
        params: endpointConfig.params,
        headers: endpointConfig.headers
      });

      const transformedData = this.transformResponse(
        response.data,
        endpointConfig.transformer,
        query
      );

      return transformedData;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OracleError(
          `API request failed: ${error.response?.status} ${error.response?.statusText}`,
          'API_ERROR',
          this.name,
          query
        );
      }
      throw error;
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Test with first available endpoint
    const firstEndpoint = this.endpoints.values().next().value;
    if (firstEndpoint && firstEndpoint.healthCheck) {
      await this.client.get(firstEndpoint.healthCheck);
    } else {
      await this.client.get('/health', { timeout: 3000 });
    }
  }

  private setupDefaultEndpoints(): void {
    // CoinGecko API endpoints
    if (this.baseUrl.includes('coingecko')) {
      this.endpoints.set('price', {
        pattern: /price|cost|value/i,
        path: '/simple/price',
        params: { vs_currencies: 'usd' },
        transformer: (data, query) => {
          const symbol = this.extractSymbol(query || '').toLowerCase();
          return data[symbol] || data[Object.keys(data)[0]];
        },
        healthCheck: '/ping'
      });
    }

    // Weather API endpoints
    if (this.baseUrl.includes('weather')) {
      this.endpoints.set('weather', {
        pattern: /weather|temperature|climate/i,
        path: '/current.json',
        transformer: (data) => ({
          temperature: data.current?.temp_c,
          condition: data.current?.condition?.text,
          humidity: data.current?.humidity,
          wind_speed: data.current?.wind_kph
        })
      });
    }

    // Generic data endpoint
    this.endpoints.set('generic', {
      pattern: /.*/,
      path: '/data',
      transformer: (data) => data
    });
  }

  private findMatchingEndpoint(query: string): APIEndpointConfig | undefined {
    for (const [key, config] of this.endpoints) {
      if (config.pattern.test(query)) {
        return config;
      }
    }
    return this.endpoints.get('generic');
  }

  private buildUrl(path: string, query: string): string {
    // Replace placeholders in path
    let url = path;
    
    // Common placeholder replacements
    const symbol = this.extractSymbol(query);
    const location = this.extractLocation(query);
    
    url = url.replace('{symbol}', symbol);
    url = url.replace('{location}', location);
    url = url.replace('{query}', encodeURIComponent(query));
    
    return url;
  }

  private transformResponse(data: any, transformer?: ResponseTransformer, query?: string): any {
    if (!transformer) return data;
    
    if (typeof transformer === 'function') {
      return transformer(data, query);
    }
    
    // JSONPath-like simple transformer
    if (typeof transformer === 'string') {
      return this.extractByPath(data, transformer);
    }
    
    return data;
  }

  private extractByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private extractSymbol(query: string): string {
    // Extract cryptocurrency symbol from query
    const cryptoMatch = query.match(/\b(BTC|ETH|ADA|DOT|LINK|MATIC|SOL|AVAX|ATOM|XRP)\b/i);
    if (cryptoMatch) return cryptoMatch[1].toLowerCase();
    
    // Extract from price queries
    const priceMatch = query.match(/(\w+)\s+price/i);
    if (priceMatch) return priceMatch[1].toLowerCase();
    
    return 'bitcoin'; // default
  }

  private extractLocation(query: string): string {
    // Simple location extraction
    const locationMatch = query.match(/(?:in|at|for)\s+(\w+)/i);
    return locationMatch ? locationMatch[1] : 'london';
  }

  protected calculateConfidence(data: any): number {
    if (!data) return 0;
    
    // Check data freshness and completeness
    let confidence = 0.8;
    
    if (data.timestamp || data.last_updated) {
      const timestamp = new Date(data.timestamp || data.last_updated);
      const age = Date.now() - timestamp.getTime();
      
      if (age < 300000) confidence += 0.15; // 5 minutes
      else if (age < 900000) confidence += 0.1; // 15 minutes
      else if (age > 3600000) confidence -= 0.2; // 1 hour
    }
    
    // Check data completeness
    const fields = Object.keys(data);
    if (fields.length > 3) confidence += 0.05;
    if (fields.length < 2) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Add new endpoint configuration
   */
  addEndpoint(key: string, config: APIEndpointConfig): void {
    this.endpoints.set(key, config);
  }

  /**
   * Get endpoint configurations
   */
  getEndpoints(): Map<string, APIEndpointConfig> {
    return new Map(this.endpoints);
  }

  /**
   * Get supported symbols (custom API, return empty by default)
   */
  getSupportedSymbols(): string[] {
    return [];
  }
}

export interface CustomAPIConfig {
  name?: string;
  weight?: number;
  reliability?: number;
  latency?: number;
  baseUrl: string;
  apiKey?: string;
  endpoints?: Record<string, APIEndpointConfig>;
}

export interface APIEndpointConfig {
  pattern: RegExp;
  path: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  transformer?: ResponseTransformer;
  healthCheck?: string;
}

export type ResponseTransformer = 
  | ((data: any, query?: string) => any)
  | string; // JSONPath-like selector