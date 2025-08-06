/**
 * Oracle Provider Interface
 * Standard interface for all external data providers
 */

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
  confidence: number; // 0-1 reliability score
}

export interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  description: string;
  timestamp: number;
  source: string;
}

export interface OracleResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  source: string;
  executionTime: number;
}

export interface OracleProvider {
  name: string;
  dataSource: string;
  endpoint: string;
  updateFrequency: number; // minutes
  reliability: number;     // 1-100 weight
  isActive: boolean;
  
  // Core methods
  fetchPrice(symbol: string): Promise<OracleResponse<PriceData>>;
  fetchWeather?(location: string): Promise<OracleResponse<WeatherData>>;
  healthCheck(): Promise<boolean>;
  
  // Metadata
  getSupportedSymbols(): string[];
  getLastUpdate(): Date;
  getProviderInfo(): {
    name: string;
    version: string;
    description: string;
    rateLimit: number;
  };
}

export interface OracleNode {
  id: string;
  provider: OracleProvider;
  status: 'active' | 'inactive' | 'error';
  lastHealthCheck: Date;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  stats: {
    totalRequests: number;
    successfulRequests: number;
    avgResponseTime: number;
    lastUpdate: Date | null;
  };
}

export interface AggregatedData<T> {
  data: T;
  sources: string[];
  consensus: number; // 0-1, how many sources agreed
  timestamp: number;
  method: 'median' | 'average' | 'weighted' | 'majority';
}