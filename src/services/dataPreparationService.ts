/**
 * Issue #8: Data Preparation Service for LLM Analytics
 * 
 * This service prepares and processes Hedera network data (HCS/HSCS/Mirror Node)
 * for LLM-powered analytics and pattern recognition.
 */

import { hcsService } from './hcsService';

/**
 * Prepared data structure for LLM analysis
 */
export interface PreparedNetworkData {
  timestamp: number;
  dataType: 'hcs_message' | 'oracle_query' | 'transaction' | 'contract_call' | 'ai_inference';
  summary: string;
  details: {
    id: string;
    source: string;
    metadata: Record<string, any>;
    rawData: any;
  };
  metrics: {
    volume: number;
    frequency: number;
    significance: number; // 0-1 score
  };
}

/**
 * Analytics context for LLM processing
 */
export interface AnalyticsContext {
  timeframe: {
    start: number;
    end: number;
    duration: string;
  };
  dataPoints: PreparedNetworkData[];
  aggregatedMetrics: {
    totalEvents: number;
    eventTypes: Record<string, number>;
    averageFrequency: number;
    peakActivity: {
      timestamp: number;
      count: number;
    };
  };
  patterns: {
    trends: string[];
    anomalies: string[];
    insights: string[];
  };
}

/**
 * Data Preparation Service Class
 */
class DataPreparationService {
  private dataBuffer: PreparedNetworkData[] = [];
  private readonly maxBufferSize = 1000;
  private isProcessing = false;
  
  /**
   * Process HCS messages for LLM analysis
   */
  async processHCSMessage(message: any): Promise<PreparedNetworkData> {
    const processedData: PreparedNetworkData = {
      timestamp: message.timestamp || Date.now(),
      dataType: this.classifyMessageType(message),
      summary: this.generateMessageSummary(message),
      details: {
        id: message.queryId || `hcs_${Date.now()}`,
        source: 'hedera_consensus_service',
        metadata: {
          topicId: message.topicId,
          provider: message.provider,
          success: message.success,
          model: message.model
        },
        rawData: message
      },
      metrics: {
        volume: this.calculateDataVolume(message),
        frequency: await this.calculateFrequency(message.queryId),
        significance: this.calculateSignificance(message)
      }
    };
    
    return processedData;
  }
  
  /**
   * Process oracle data for analysis
   */
  async processOracleData(oracleResponse: any): Promise<PreparedNetworkData> {
    const processedData: PreparedNetworkData = {
      timestamp: oracleResponse.timestamp || Date.now(),
      dataType: 'oracle_query',
      summary: this.generateOracleSummary(oracleResponse),
      details: {
        id: oracleResponse.queryId || `oracle_${Date.now()}`,
        source: 'oracle_manager',
        metadata: {
          symbol: oracleResponse.symbol,
          providers: oracleResponse.sources,
          consensus: oracleResponse.consensus,
          method: oracleResponse.method
        },
        rawData: oracleResponse
      },
      metrics: {
        volume: oracleResponse.sources?.length || 1,
        frequency: await this.calculateFrequency(oracleResponse.queryId),
        significance: this.calculateOracleSignificance(oracleResponse)
      }
    };
    
    return processedData;
  }
  
  /**
   * Process AI inference data for analysis
   */
  async processAIInference(aiResult: any): Promise<PreparedNetworkData> {
    const processedData: PreparedNetworkData = {
      timestamp: aiResult.timestamp || Date.now(),
      dataType: 'ai_inference',
      summary: this.generateAISummary(aiResult),
      details: {
        id: aiResult.transactionId || `ai_${Date.now()}`,
        source: 'ai_inference_service',
        metadata: {
          fraudProbability: aiResult.fraudProbability,
          isFraud: aiResult.isFraud,
          confidence: aiResult.confidence,
          modelVersion: aiResult.modelVersion
        },
        rawData: aiResult
      },
      metrics: {
        volume: 1,
        frequency: await this.calculateFrequency(aiResult.transactionId),
        significance: aiResult.isFraud ? 0.9 : aiResult.confidence
      }
    };
    
    return processedData;
  }
  
  /**
   * Add data to processing buffer
   */
  addToBuffer(data: PreparedNetworkData): void {
    this.dataBuffer.push(data);
    
    // Maintain buffer size
    if (this.dataBuffer.length > this.maxBufferSize) {
      this.dataBuffer.shift();
    }
    
    console.log(`📊 Data buffer updated: ${this.dataBuffer.length}/${this.maxBufferSize} entries`);
  }
  
  /**
   * Get recent data for analysis
   */
  getRecentData(minutes: number = 60): PreparedNetworkData[] {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return this.dataBuffer.filter(data => data.timestamp >= cutoffTime);
  }
  
  /**
   * Create analytics context from recent data
   */
  createAnalyticsContext(timeframeMinutes: number = 60): AnalyticsContext {
    const recentData = this.getRecentData(timeframeMinutes);
    const startTime = Date.now() - (timeframeMinutes * 60 * 1000);
    const endTime = Date.now();
    
    // Calculate aggregated metrics
    const eventTypes: Record<string, number> = {};
    let totalVolume = 0;
    let peakActivity = { timestamp: 0, count: 0 };
    
    // Group by hour to find peak activity
    const hourlyActivity: Record<number, number> = {};
    
    recentData.forEach(data => {
      // Count event types
      eventTypes[data.dataType] = (eventTypes[data.dataType] || 0) + 1;
      
      // Sum volume
      totalVolume += data.metrics.volume;
      
      // Track hourly activity
      const hour = Math.floor(data.timestamp / (60 * 60 * 1000));
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });
    
    // Find peak activity hour
    Object.entries(hourlyActivity).forEach(([hour, count]) => {
      if (count > peakActivity.count) {
        peakActivity = { timestamp: parseInt(hour) * 60 * 60 * 1000, count };
      }
    });
    
    const context: AnalyticsContext = {
      timeframe: {
        start: startTime,
        end: endTime,
        duration: `${timeframeMinutes} minutes`
      },
      dataPoints: recentData,
      aggregatedMetrics: {
        totalEvents: recentData.length,
        eventTypes,
        averageFrequency: recentData.length / Math.max(timeframeMinutes / 60, 1), // per hour
        peakActivity
      },
      patterns: {
        trends: this.identifyTrends(recentData),
        anomalies: this.identifyAnomalies(recentData),
        insights: this.generateInsights(recentData)
      }
    };
    
    return context;
  }
  
  /**
   * Get data summary for LLM context
   */
  getDataSummaryForLLM(timeframeMinutes: number = 60): string {
    const context = this.createAnalyticsContext(timeframeMinutes);
    const { aggregatedMetrics, patterns } = context;
    
    let summary = `Hedera Network Activity Summary (Last ${timeframeMinutes} minutes):\n\n`;
    
    // Event overview
    summary += `📊 Total Events: ${aggregatedMetrics.totalEvents}\n`;
    summary += `📈 Average Frequency: ${aggregatedMetrics.averageFrequency.toFixed(2)} events/hour\n\n`;
    
    // Event types breakdown
    summary += `📋 Event Types:\n`;
    Object.entries(aggregatedMetrics.eventTypes).forEach(([type, count]) => {
      const percentage = ((count / aggregatedMetrics.totalEvents) * 100).toFixed(1);
      summary += `  • ${type}: ${count} (${percentage}%)\n`;
    });
    
    // Peak activity
    if (aggregatedMetrics.peakActivity.count > 0) {
      const peakTime = new Date(aggregatedMetrics.peakActivity.timestamp).toLocaleTimeString();
      summary += `\n⚡ Peak Activity: ${aggregatedMetrics.peakActivity.count} events around ${peakTime}\n`;
    }
    
    // Patterns and insights
    if (patterns.trends.length > 0) {
      summary += `\n📈 Trends:\n${patterns.trends.map(trend => `  • ${trend}`).join('\n')}\n`;
    }
    
    if (patterns.anomalies.length > 0) {
      summary += `\n🚨 Anomalies:\n${patterns.anomalies.map(anomaly => `  • ${anomaly}`).join('\n')}\n`;
    }
    
    if (patterns.insights.length > 0) {
      summary += `\n💡 Insights:\n${patterns.insights.map(insight => `  • ${insight}`).join('\n')}\n`;
    }
    
    return summary;
  }
  
  /**
   * Clear old data from buffer
   */
  clearOldData(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const initialLength = this.dataBuffer.length;
    
    this.dataBuffer = this.dataBuffer.filter(data => data.timestamp >= cutoffTime);
    
    const removed = initialLength - this.dataBuffer.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} old data entries from buffer`);
    }
  }
  
  /**
   * Get buffer statistics
   */
  getBufferStats(): {
    totalEntries: number;
    oldestEntry: number;
    newestEntry: number;
    dataTypes: Record<string, number>;
  } {
    if (this.dataBuffer.length === 0) {
      return {
        totalEntries: 0,
        oldestEntry: 0,
        newestEntry: 0,
        dataTypes: {}
      };
    }
    
    const timestamps = this.dataBuffer.map(d => d.timestamp);
    const dataTypes: Record<string, number> = {};
    
    this.dataBuffer.forEach(data => {
      dataTypes[data.dataType] = (dataTypes[data.dataType] || 0) + 1;
    });
    
    return {
      totalEntries: this.dataBuffer.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      dataTypes
    };
  }
  
  // Private helper methods
  
  private classifyMessageType(message: any): PreparedNetworkData['dataType'] {
    if (message.model && message.aiResponse) return 'oracle_query';
    if (message.fraudProbability !== undefined) return 'ai_inference';
    if (message.transactionId) return 'transaction';
    if (message.contractId) return 'contract_call';
    return 'hcs_message';
  }
  
  private generateMessageSummary(message: any): string {
    if (message.model) {
      return `AI query using ${message.model} model: ${message.inputPrompt?.substring(0, 100)}...`;
    }
    
    if (message.symbol) {
      return `Oracle data request for ${message.symbol}`;
    }
    
    return `HCS message: ${JSON.stringify(message).substring(0, 100)}...`;
  }
  
  private generateOracleSummary(oracleData: any): string {
    const { symbol, sources, consensus, method } = oracleData;
    return `Oracle ${method} aggregation for ${symbol} using ${sources?.length || 1} sources (${(consensus * 100).toFixed(1)}% consensus)`;
  }
  
  private generateAISummary(aiResult: any): string {
    const decision = aiResult.isFraud ? 'FRAUD DETECTED' : 'LEGITIMATE';
    const confidence = (aiResult.confidence * 100).toFixed(1);
    return `AI fraud detection: ${decision} with ${confidence}% confidence for transaction ${aiResult.transactionId}`;
  }
  
  private calculateDataVolume(data: any): number {
    // Simple volume calculation based on data complexity
    return JSON.stringify(data).length / 1000; // KB
  }
  
  private async calculateFrequency(id: string): Promise<number> {
    // Calculate how often similar IDs appear in recent data
    const recentData = this.getRecentData(60);
    const similarEntries = recentData.filter(d => 
      d.details.id.includes(id.substring(0, 10)) || 
      id.includes(d.details.id.substring(0, 10))
    );
    
    return similarEntries.length / 60; // per minute
  }
  
  private calculateSignificance(data: any): number {
    // Calculate significance based on success, error conditions, etc.
    if (data.success === false) return 0.8; // Errors are significant
    if (data.fraudProbability && data.fraudProbability > 0.7) return 0.9; // High fraud risk
    if (data.consensus && data.consensus < 0.5) return 0.7; // Low consensus
    return 0.5; // Default significance
  }
  
  private calculateOracleSignificance(oracleData: any): number {
    const { consensus, sources } = oracleData;
    
    // Higher significance for low consensus or few sources
    if (consensus < 0.5) return 0.8;
    if (sources && sources.length < 2) return 0.7;
    if (consensus > 0.9) return 0.6; // High consensus is normal
    
    return 0.5;
  }
  
  private identifyTrends(data: PreparedNetworkData[]): string[] {
    const trends: string[] = [];
    
    if (data.length < 10) return trends;
    
    // Analyze data types distribution
    const typeCount: Record<string, number> = {};
    data.forEach(d => {
      typeCount[d.dataType] = (typeCount[d.dataType] || 0) + 1;
    });
    
    const mostCommonType = Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommonType && mostCommonType[1] > data.length * 0.6) {
      trends.push(`High ${mostCommonType[0]} activity (${mostCommonType[1]} events)`);
    }
    
    // Analyze time-based patterns
    const hourlyCount = data.reduce((acc, d) => {
      const hour = new Date(d.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const peakHour = Object.entries(hourlyCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (peakHour && parseInt(peakHour[1] as any) > data.length * 0.3) {
      trends.push(`Peak activity during hour ${peakHour[0]}`);
    }
    
    return trends;
  }
  
  private identifyAnomalies(data: PreparedNetworkData[]): string[] {
    const anomalies: string[] = [];
    
    // High significance events
    const highSigEvents = data.filter(d => d.metrics.significance > 0.8);
    if (highSigEvents.length > 0) {
      anomalies.push(`${highSigEvents.length} high-significance events detected`);
    }
    
    // Unusual frequency patterns
    const frequencies = data.map(d => d.metrics.frequency);
    const avgFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const highFreqEvents = data.filter(d => d.metrics.frequency > avgFreq * 3);
    
    if (highFreqEvents.length > 0) {
      anomalies.push(`${highFreqEvents.length} events with unusually high frequency`);
    }
    
    return anomalies;
  }
  
  private generateInsights(data: PreparedNetworkData[]): string[] {
    const insights: string[] = [];
    
    if (data.length === 0) return insights;
    
    // General activity level
    if (data.length > 50) {
      insights.push('High network activity detected');
    } else if (data.length < 5) {
      insights.push('Low network activity period');
    }
    
    // Error rate analysis
    const errorCount = data.filter(d => 
      d.details.metadata.success === false || 
      d.summary.toLowerCase().includes('error') ||
      d.summary.toLowerCase().includes('failed')
    ).length;
    
    const errorRate = errorCount / data.length;
    if (errorRate > 0.1) {
      insights.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`);
    } else if (errorRate < 0.02) {
      insights.push('System operating smoothly with minimal errors');
    }
    
    // AI fraud detection insights
    const fraudEvents = data.filter(d => 
      d.dataType === 'ai_inference' && 
      d.details.metadata.isFraud
    ).length;
    
    if (fraudEvents > 0) {
      insights.push(`${fraudEvents} potential fraud cases identified by AI`);
    }
    
    return insights;
  }
}

// Singleton instance
export const dataPreparationService = new DataPreparationService();

export default dataPreparationService;