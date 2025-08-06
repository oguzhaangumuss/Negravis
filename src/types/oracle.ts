/**
 * Oracle System Type Definitions
 * Comprehensive interfaces for multi-source oracle system
 */

export interface OracleResponse {
  data: any;
  confidence: number; // 0-1 scale
  timestamp: Date;
  source: string;
  signature?: string;
  metadata?: Record<string, any>;
}

export interface OracleProvider {
  name: string;
  weight: number; // Consensus weighting (0-1)
  reliability: number; // Historical accuracy (0-1)
  latency: number; // Average response time in ms
  
  fetch(query: string, options?: OracleQueryOptions): Promise<OracleResponse>;
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<OracleMetrics>;
}

export interface OracleQueryOptions {
  timeout?: number;
  retries?: number;
  cacheTime?: number;
  sources?: string[];
  consensusMethod?: ConsensusMethod;
}

export interface OracleMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageLatency: number;
  lastHealthCheck: Date;
  reliability: number;
}

export enum ConsensusMethod {
  MEDIAN = 'median',
  WEIGHTED_AVERAGE = 'weighted_average',
  MAJORITY_VOTE = 'majority_vote',
  CONFIDENCE_WEIGHTED = 'confidence_weighted',
  AI_RESPONSE = 'ai_response'
}

export interface ConsensusResult {
  query?: string;
  value: any;
  confidence: number;
  method: ConsensusMethod;
  sources: string[];
  raw_responses?: OracleResponse[];
  rawResponses?: Array<{
    provider: string;
    value: any;
    confidence: number;
    responseTime: number;
  }>;
  timestamp: Date;
  executionTimeMs?: number;
  metadata?: {
    isConversational?: boolean;
    totalProviders?: number;
    [key: string]: any;
  };
}

export enum OracleQueryType {
  PRICE_FEED = 'price_feed',
  WEATHER_DATA = 'weather_data',
  SPORTS_RESULT = 'sports_result',
  NEWS_VERIFICATION = 'news_verification',
  WEB_SEARCH = 'web_search',
  DATABASE_QUERY = 'database_query',
  CUSTOM = 'custom'
}

export interface OracleQuery {
  id: string;
  type: OracleQueryType;
  query: string;
  requester: string;
  timestamp: Date;
  options: OracleQueryOptions;
}

export interface HCSLogEntry {
  query_id: string;
  query: string;
  result: ConsensusResult;
  hcs_timestamp: string;
  transaction_id: string;
}

export interface ChatbotQuery {
  platform: 'discord' | 'slack' | 'telegram';
  user_id: string;
  channel_id: string;
  message: string;
  intent?: string;
  entities?: Record<string, any>;
  timestamp: Date;
}

export interface ChatbotResponse {
  text: string;
  embeds?: any[];
  buttons?: any[];
  metadata?: Record<string, any>;
}

export interface OracleConfig {
  providers: {
    [key: string]: {
      enabled: boolean;
      weight: number;
      config: Record<string, any>;
    };
  };
  consensus: {
    default_method: ConsensusMethod;
    min_responses: number;
    max_response_time: number;
    outlier_threshold: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    max_size: number;
  };
  hcs: {
    enabled: boolean;
    topic_id: string;
    batch_size: number;
  };
  chatbot: {
    discord: {
      enabled: boolean;
      token: string;
      channels: string[];
    };
    slack: {
      enabled: boolean;
      token: string;
      channels: string[];
    };
    telegram: {
      enabled: boolean;
      token: string;
      channels: string[];
    };
  };
}

export class OracleError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public query?: string
  ) {
    super(message);
    this.name = 'OracleError';
  }
}

export class ConsensusError extends Error {
  constructor(
    message: string,
    public responses: OracleResponse[],
    public method: ConsensusMethod
  ) {
    super(message);
    this.name = 'ConsensusError';
  }
}