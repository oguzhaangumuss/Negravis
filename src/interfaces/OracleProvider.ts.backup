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
  confidence?: number;  // 0-1 response confidence
  metadata?: any;       // Additional response metadata
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
  // Issue #6 enhancements
  weights?: OracleWeights;      // Dynamic weighting system
  metrics?: OracleMetrics;      // Enhanced metrics tracking
  selectionScore?: number;      // Overall selection score (0-100)
}

export interface AggregatedData<T> {
  data: T;
  sources: string[];
  consensus: number; // 0-1, how many sources agreed
  timestamp: number;
  method: 'median' | 'average' | 'weighted' | 'majority' | 'weightedMedian' | 'weightedAverage';
  weights?: number[];           // Weights used in aggregation
  outliers?: string[];          // Sources identified as outliers
  confidence?: number;          // Overall confidence score
  qualityMetrics?: {
    accuracy: number;
    freshness: number;
    consistency: number;
  };
}

/**
 * Dynamic Oracle Selection Interfaces for Issue #6
 */

export interface OracleWeights {
  reliability: number;          // Base provider reliability (0-100)
  responseTime: number;         // Response time weighting (0-100)
  accuracy: number;             // Historical accuracy (0-100)
  stake: number;                // Economic stake weighting (0-100)
  reputation: number;           // Reputation score (0-100)
  combined: number;             // Final calculated weight (0-100)
}

export interface OracleMetrics {
  totalRequests: number;
  successfulRequests: number;
  avgResponseTime: number;
  accuracyScore: number;        // Historical accuracy
  reputationScore: number;      // Community reputation
  stakeAmount: number;          // Economic stake
  lastUpdate: Date | null;
  performanceHistory: number[]; // Recent performance scores
}

export interface SelectionCriteria {
  minProviders: number;         // Minimum providers required
  maxProviders: number;         // Maximum providers to use
  outlierThreshold: number;     // Outlier detection threshold
  consensusThreshold: number;   // Minimum consensus required
  weightingStrategy: 'equal' | 'reliability' | 'performance' | 'stake' | 'dynamic';
  aggregationMethod: 'median' | 'weightedMedian' | 'average' | 'weightedAverage';
}

export interface AggregationStrategy {
  method: string;
  parameters: Record<string, any>;
  outlierDetection: boolean;
  qualityThreshold: number;
}