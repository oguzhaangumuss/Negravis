/**
 * Oracle API Service
 * Frontend service for interacting with backend Oracle APIs
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface OracleQueryResponse {
  success: boolean;
  data: {
    query: string;
    result: Record<string, unknown>;
    confidence: number;
    consensus_method: string;
    sources: string[];
    timestamp: number;
    execution_time_ms: number;
  };
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface PriceResponse {
  success: boolean;
  data: {
    symbol: string;
    price: number;
    confidence: number;
    sources: string[];
    timestamp: number;
    market_data?: {
      market_cap: number;
      volume_24h: number;
      change_24h: number;
    };
  };
  error?: string;
}

export interface WeatherResponse {
  success: boolean;
  data: {
    location: string;
    temperature: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    visibility: number;
    wind: {
      speed: number;
      direction: number;
    };
    weather: {
      main: string;
      description: string;
      icon: string;
    };
    confidence: number;
    sources: string[];
    timestamp: number;
  };
  error?: string;
}

export interface ProvidersResponse {
  success: boolean;
  data: {
    total_providers: number;
    active_providers: number;
    providers: Array<{
      name: string;
      weight: number;
      reliability: number;
      latency: number;
      healthy: boolean;
      metrics: {
        total_queries: number;
        successful_queries: number;
        success_rate: number;
        average_latency: number;
        last_health_check: number;
      };
    }>;
  };
  error?: string;
}

export interface SystemStatusResponse {
  success: boolean;
  data: {
    system: {
      total_providers: number;
      active_providers: number;
      system_health: number;
      last_check: number;
    };
    providers: Array<Record<string, unknown>>;
    health_status: Record<string, boolean>;
    chatbots: Record<string, unknown> | null;
    uptime: number;
    timestamp: string;
  };
  error?: string;
}

class OracleApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * General oracle query
   */
  async query(
    query: string, 
    options?: {
      sources?: string[];
      method?: string;
      timeout?: number;
    }
  ): Promise<OracleQueryResponse> {
    try {
      const params = new URLSearchParams({ q: query });
      
      if (options?.sources?.length) {
        params.append('sources', options.sources.join(','));
      }
      if (options?.method) {
        params.append('method', options.method);
      }
      if (options?.timeout) {
        params.append('timeout', options.timeout.toString());
      }

      const response = await fetch(`${this.baseUrl}/api/oracle/query?${params}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Oracle query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {} as OracleQueryResponse['data']
      };
    }
  }

  /**
   * Get cryptocurrency price
   */
  async getPrice(symbol: string, options?: { sources?: string[]; method?: string }): Promise<PriceResponse> {
    try {
      const params = new URLSearchParams();
      
      if (options?.sources?.length) {
        params.append('sources', options.sources.join(','));
      }
      if (options?.method) {
        params.append('method', options.method);
      }

      const queryString = params.toString() ? `?${params}` : '';
      const response = await fetch(`${this.baseUrl}/api/oracle/price/${symbol}${queryString}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Price query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {} as PriceResponse['data']
      };
    }
  }

  /**
   * Get weather data
   */
  async getWeather(location: string): Promise<WeatherResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/oracle/weather/${encodeURIComponent(location)}`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Weather query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {} as WeatherResponse['data']
      };
    }
  }

  /**
   * Get oracle providers
   */
  async getProviders(): Promise<ProvidersResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/oracle/providers`);
      return await response.json();
    } catch (error: unknown) {
      console.error('Providers query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {} as ProvidersResponse['data']
      };
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<SystemStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/oracle/status`);
      return await response.json();
    } catch (error: unknown) {
      console.error('System status query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {} as SystemStatusResponse['data']
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/oracle/health-check`, {
        method: 'POST'
      });
      return await response.json();
    } catch (error: unknown) {
      console.error('Health check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch queries
   */
  async batchQuery(queries: Array<{
    query: string;
    sources?: string[];
    method?: string;
    timeout?: number;
  }>): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/oracle/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queries })
      });
      return await response.json();
    } catch (error: unknown) {
      console.error('Batch query error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const oracleApi = new OracleApiService();
export default oracleApi;