// API Response Types for Negravis Oracle System

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Oracle Types
export interface OracleProvider {
  name: string
  status: 'online' | 'offline'
  reliability: number
  latency: number
  weight: number
  lastUpdate: string
}

export interface OracleQuery {
  id: string
  query: string
  result: any
  consensus: ConsensusResult
  timestamp: string
  providers: string[]
}

export interface ConsensusResult {
  method: 'median' | 'weighted_average' | 'majority_vote' | 'confidence_weighted'
  value: any
  confidence: number
  agreementRatio: number
  participatingProviders: string[]
  outliers: string[]
}

// Price Data
export interface PriceData {
  symbol: string
  price: number
  change24h: number
  changePercent24h: number
  volume24h: number
  marketCap: number
  lastUpdate: string
  source: string
}

// Weather Data
export interface WeatherData {
  location: string
  temperature: number
  humidity: number
  weather_description: string
  wind_speed: number
  wind_direction: number
  timestamp: string
  source: string
}

// System Health
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  activeProviders: number
  totalProviders: number
  avgResponseTime: number
  successRate: number
  lastCheck: string
}

// Analytics Data
export interface NetworkMetrics {
  tps: number
  totalTransactions: number
  activeNodes: number
  networkHealth: number
  avgBlockTime: number
}

export interface ApiUsageStats {
  totalRequests: number
  requestsPerHour: number
  successRate: number
  avgResponseTime: number
  mostUsedEndpoints: Array<{
    endpoint: string
    count: number
    avgTime: number
  }>
}

// Account Info
export interface AccountInfo {
  accountId: string
  balance: number
  transactions: number
  lastActivity: string
  status: string
}

// AI Service Info
export interface AIService {
  id: string
  name: string
  description: string
  model: string
  provider: string
  status: 'available' | 'busy' | 'offline'
  cost: number
  responseTime: number
}

// HCS Topic Info
export interface HCSTopicInfo {
  topicId: string
  name: string
  description: string
  messageCount: number
  lastMessage: string
  explorerUrl: string
}

// Smart Contract Info
export interface ContractInfo {
  address: string
  name: string
  deployTime: string
  transactions: number
  balance: number
  status: 'deployed' | 'paused' | 'destroyed'
}

// Transaction Data
export interface TransactionData {
  id: string
  type: string
  from: string
  to: string
  amount: number
  fee: number
  status: 'success' | 'pending' | 'failed'
  timestamp: string
  explorerUrl: string
}

// Chatbot Stats
export interface ChatbotStats {
  totalMessages: number
  activeChats: number
  avgResponseTime: number
  successfulQueries: number
  platforms: Array<{
    platform: string
    active: boolean
    messageCount: number
  }>
}

// Dashboard Data
export interface DashboardData {
  systemHealth: SystemHealth
  networkMetrics: NetworkMetrics
  apiUsage: ApiUsageStats
  oracleProviders: OracleProvider[]
  recentQueries: OracleQuery[]
  accountInfo: AccountInfo
  aiServices: AIService[]
  hcsTopics: HCSTopicInfo[]
  recentTransactions: TransactionData[]
  chatbotStats: ChatbotStats
}