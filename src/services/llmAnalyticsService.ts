/**
 * Issue #8: LLM Analytics Service for Hedera Network Data
 * 
 * This service provides LLM-powered analytics for Hedera network data
 * using the existing 0G network infrastructure for cost-effective AI processing.
 */

import { OracleComputeService, OracleResponse } from '../oracle-compute-service';
import { dataPreparationService, AnalyticsContext, PreparedNetworkData } from './dataPreparationService';
import { hcsService } from './hcsService';

/**
 * LLM Analysis result
 */
export interface LLMAnalysisResult {
  analysisId: string;
  timestamp: number;
  analysisType: 'pattern_recognition' | 'anomaly_detection' | 'trend_analysis' | 'security_assessment' | 'network_summary';
  query: string;
  llmResponse: string;
  insights: string[];
  recommendations: string[];
  confidence: number;
  dataContext: {
    timeframe: string;
    eventCount: number;
    dataTypes: string[];
  };
  modelUsed: string;
  processingTime: number;
}

/**
 * Prompt templates for different analysis types
 */
class PromptTemplateManager {
  
  /**
   * Pattern recognition prompt
   */
  static patternRecognition(context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Analyze the following Hedera blockchain network data for patterns and trends.

${summary}

Please provide:
1. **Key Patterns Identified**: What recurring patterns do you see in the data?
2. **Trend Analysis**: What trends are emerging over this time period?
3. **Correlations**: Are there any correlations between different event types?
4. **Predictions**: Based on these patterns, what might we expect in the near future?

Focus on actionable insights that could help optimize network performance or identify potential issues.`;
  }
  
  /**
   * Anomaly detection prompt
   */
  static anomalyDetection(context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Analyze the following Hedera blockchain network data for anomalies and unusual behavior.

${summary}

Please identify:
1. **Anomalies Detected**: What unusual patterns or outliers do you see?
2. **Severity Assessment**: Rate the severity of each anomaly (Low/Medium/High)
3. **Root Cause Analysis**: What might be causing these anomalies?
4. **Impact Assessment**: How might these anomalies affect network operations?
5. **Recommended Actions**: What immediate actions should be taken?

Focus on security implications and operational stability.`;
  }
  
  /**
   * Network security assessment prompt
   */
  static securityAssessment(context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Perform a security analysis of the following Hedera blockchain network data.

${summary}

Please analyze:
1. **Security Indicators**: Any signs of suspicious or malicious activity?
2. **Fraud Detection**: Evidence of fraudulent transactions or behaviors?
3. **Attack Patterns**: Potential attack vectors or ongoing threats?
4. **Vulnerability Assessment**: Possible weak points in the system?
5. **Security Recommendations**: Immediate and long-term security measures?

Pay special attention to AI fraud detection results and consensus anomalies.`;
  }
  
  /**
   * Network performance analysis prompt
   */
  static performanceAnalysis(context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Analyze the performance and efficiency of the Hedera blockchain network based on this data.

${summary}

Please evaluate:
1. **Performance Metrics**: How is the network performing overall?
2. **Bottlenecks**: Are there any performance bottlenecks or congestion points?
3. **Oracle Efficiency**: How well are the oracle services performing?
4. **AI System Performance**: How effective is the AI fraud detection system?
5. **Optimization Opportunities**: What could be optimized for better performance?

Provide specific, data-driven recommendations for improvement.`;
  }
  
  /**
   * Business intelligence prompt
   */
  static businessIntelligence(context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Provide business intelligence insights from this Hedera blockchain network data.

${summary}

Please provide:
1. **Usage Analytics**: How is the network being utilized?
2. **User Behavior**: What can we infer about user behavior and preferences?
3. **Market Insights**: Any market trends or business opportunities?
4. **ROI Analysis**: How effective are the current services and features?
5. **Strategic Recommendations**: What strategic decisions should be considered?

Focus on actionable business insights that could drive product development and growth.`;
  }
  
  /**
   * Custom analysis prompt
   */
  static customAnalysis(question: string, context: AnalyticsContext): string {
    const summary = dataPreparationService.getDataSummaryForLLM();
    
    return `Answer the following question about Hedera blockchain network data:

**Question:** ${question}

**Network Data Context:**
${summary}

Please provide a comprehensive analysis that addresses the question with specific references to the data provided. Include:
1. Direct answer to the question
2. Supporting evidence from the data
3. Additional insights or implications
4. Recommendations or next steps if applicable`;
  }
}

/**
 * LLM Analytics Service Class
 */
class LLMAnalyticsService {
  private oracleService: OracleComputeService;
  private isInitialized = false;
  private analysisHistory: LLMAnalysisResult[] = [];
  private readonly maxHistorySize = 100;
  
  constructor() {
    this.oracleService = new OracleComputeService();
  }
  
  /**
   * Initialize the LLM analytics service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🤖 Initializing LLM Analytics Service...');
      
      if (!this.oracleService) {
        this.oracleService = new OracleComputeService();
      }
      
      // Initialize oracle service if not already done
      await this.oracleService.initialize();
      
      this.isInitialized = true;
      console.log('✅ LLM Analytics Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize LLM Analytics Service:', error);
      throw error;
    }
  }
  
  /**
   * Run pattern recognition analysis
   */
  async runPatternRecognition(timeframeMinutes: number = 60): Promise<LLMAnalysisResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    const context = dataPreparationService.createAnalyticsContext(timeframeMinutes);
    const prompt = PromptTemplateManager.patternRecognition(context);
    
    console.log('🔍 Running pattern recognition analysis...');
    
    try {
      const llmResponse = await this.queryLLM(prompt);
      
      const result: LLMAnalysisResult = {
        analysisId: `pattern_${Date.now()}`,
        timestamp: Date.now(),
        analysisType: 'pattern_recognition',
        query: prompt,
        llmResponse: llmResponse.response || '',
        insights: this.extractInsights(llmResponse.response || ''),
        recommendations: this.extractRecommendations(llmResponse.response || ''),
        confidence: this.calculateConfidence(context, llmResponse),
        dataContext: {
          timeframe: `${timeframeMinutes} minutes`,
          eventCount: context.dataPoints.length,
          dataTypes: Object.keys(context.aggregatedMetrics.eventTypes)
        },
        modelUsed: llmResponse.model || 'llama-3.3-70b-instruct',
        processingTime: performance.now() - startTime
      };
      
      await this.logAnalysisToHCS(result);
      this.addToHistory(result);
      
      console.log(`✅ Pattern recognition completed in ${result.processingTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Pattern recognition analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Run anomaly detection analysis
   */
  async runAnomalyDetection(timeframeMinutes: number = 60): Promise<LLMAnalysisResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    const context = dataPreparationService.createAnalyticsContext(timeframeMinutes);
    const prompt = PromptTemplateManager.anomalyDetection(context);
    
    console.log('🚨 Running anomaly detection analysis...');
    
    try {
      const llmResponse = await this.queryLLM(prompt);
      
      const result: LLMAnalysisResult = {
        analysisId: `anomaly_${Date.now()}`,
        timestamp: Date.now(),
        analysisType: 'anomaly_detection',
        query: prompt,
        llmResponse: llmResponse.response || '',
        insights: this.extractInsights(llmResponse.response || ''),
        recommendations: this.extractRecommendations(llmResponse.response || ''),
        confidence: this.calculateConfidence(context, llmResponse),
        dataContext: {
          timeframe: `${timeframeMinutes} minutes`,
          eventCount: context.dataPoints.length,
          dataTypes: Object.keys(context.aggregatedMetrics.eventTypes)
        },
        modelUsed: llmResponse.model || 'llama-3.3-70b-instruct',
        processingTime: performance.now() - startTime
      };
      
      await this.logAnalysisToHCS(result);
      this.addToHistory(result);
      
      console.log(`✅ Anomaly detection completed in ${result.processingTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Anomaly detection analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Run security assessment
   */
  async runSecurityAssessment(timeframeMinutes: number = 60): Promise<LLMAnalysisResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    const context = dataPreparationService.createAnalyticsContext(timeframeMinutes);
    const prompt = PromptTemplateManager.securityAssessment(context);
    
    console.log('🛡️ Running security assessment...');
    
    try {
      const llmResponse = await this.queryLLM(prompt);
      
      const result: LLMAnalysisResult = {
        analysisId: `security_${Date.now()}`,
        timestamp: Date.now(),
        analysisType: 'security_assessment',
        query: prompt,
        llmResponse: llmResponse.response || '',
        insights: this.extractInsights(llmResponse.response || ''),
        recommendations: this.extractRecommendations(llmResponse.response || ''),
        confidence: this.calculateConfidence(context, llmResponse),
        dataContext: {
          timeframe: `${timeframeMinutes} minutes`,
          eventCount: context.dataPoints.length,
          dataTypes: Object.keys(context.aggregatedMetrics.eventTypes)
        },
        modelUsed: llmResponse.model || 'llama-3.3-70b-instruct',
        processingTime: performance.now() - startTime
      };
      
      await this.logAnalysisToHCS(result);
      this.addToHistory(result);
      
      console.log(`✅ Security assessment completed in ${result.processingTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Security assessment failed:', error);
      throw error;
    }
  }
  
  /**
   * Run custom analysis with user question
   */
  async runCustomAnalysis(
    question: string, 
    timeframeMinutes: number = 60
  ): Promise<LLMAnalysisResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    const context = dataPreparationService.createAnalyticsContext(timeframeMinutes);
    const prompt = PromptTemplateManager.customAnalysis(question, context);
    
    console.log(`💭 Running custom analysis: "${question.substring(0, 50)}..."`);
    
    try {
      const llmResponse = await this.queryLLM(prompt);
      
      const result: LLMAnalysisResult = {
        analysisId: `custom_${Date.now()}`,
        timestamp: Date.now(),
        analysisType: 'network_summary', // Generic type for custom
        query: prompt,
        llmResponse: llmResponse.response || '',
        insights: this.extractInsights(llmResponse.response || ''),
        recommendations: this.extractRecommendations(llmResponse.response || ''),
        confidence: this.calculateConfidence(context, llmResponse),
        dataContext: {
          timeframe: `${timeframeMinutes} minutes`,
          eventCount: context.dataPoints.length,
          dataTypes: Object.keys(context.aggregatedMetrics.eventTypes)
        },
        modelUsed: llmResponse.model || 'llama-3.3-70b-instruct',
        processingTime: performance.now() - startTime
      };
      
      await this.logAnalysisToHCS(result);
      this.addToHistory(result);
      
      console.log(`✅ Custom analysis completed in ${result.processingTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Custom analysis failed:', error);
      throw error;
    }
  }
  
  /**
   * Get analysis history
   */
  getAnalysisHistory(limit: number = 20): LLMAnalysisResult[] {
    return this.analysisHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get recent insights summary
   */
  getRecentInsightsSummary(): {
    totalAnalyses: number;
    latestAnalysis: LLMAnalysisResult | null;
    topInsights: string[];
    commonRecommendations: string[];
    averageConfidence: number;
  } {
    const recentAnalyses = this.getAnalysisHistory(10);
    
    if (recentAnalyses.length === 0) {
      return {
        totalAnalyses: 0,
        latestAnalysis: null,
        topInsights: [],
        commonRecommendations: [],
        averageConfidence: 0
      };
    }
    
    // Collect all insights and recommendations
    const allInsights: string[] = [];
    const allRecommendations: string[] = [];
    let totalConfidence = 0;
    
    recentAnalyses.forEach(analysis => {
      allInsights.push(...analysis.insights);
      allRecommendations.push(...analysis.recommendations);
      totalConfidence += analysis.confidence;
    });
    
    // Find most common items (simple frequency count)
    const insightFreq: Record<string, number> = {};
    const recommendationFreq: Record<string, number> = {};
    
    allInsights.forEach(insight => {
      const key = insight.substring(0, 50); // Use first 50 chars as key
      insightFreq[key] = (insightFreq[key] || 0) + 1;
    });
    
    allRecommendations.forEach(rec => {
      const key = rec.substring(0, 50);
      recommendationFreq[key] = (recommendationFreq[key] || 0) + 1;
    });
    
    const topInsights = Object.entries(insightFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([insight]) => insight);
    
    const commonRecommendations = Object.entries(recommendationFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([rec]) => rec);
    
    return {
      totalAnalyses: recentAnalyses.length,
      latestAnalysis: recentAnalyses[0],
      topInsights,
      commonRecommendations,
      averageConfidence: totalConfidence / recentAnalyses.length
    };
  }
  
  /**
   * Get service status
   */
  getServiceStatus(): {
    isInitialized: boolean;
    analysesRun: number;
    lastAnalysisTime: number;
    averageProcessingTime: number;
  } {
    const avgProcessingTime = this.analysisHistory.length > 0
      ? this.analysisHistory.reduce((sum, a) => sum + a.processingTime, 0) / this.analysisHistory.length
      : 0;
    
    return {
      isInitialized: this.isInitialized,
      analysesRun: this.analysisHistory.length,
      lastAnalysisTime: this.analysisHistory.length > 0 
        ? Math.max(...this.analysisHistory.map(a => a.timestamp))
        : 0,
      averageProcessingTime: avgProcessingTime
    };
  }
  
  // Private helper methods
  
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  private async queryLLM(prompt: string): Promise<OracleResponse> {
    try {
      const response = await this.oracleService.processQuery(prompt, {
        provider: 'llama-3.3-70b-instruct'
      });
      
      if (!response.success) {
        throw new Error(response.error || 'LLM query failed');
      }
      
      return response;
    } catch (error) {
      console.error('❌ LLM query failed:', error);
      throw error;
    }
  }
  
  private extractInsights(llmResponse: string): string[] {
    const insights: string[] = [];
    
    // Look for bullet points or numbered lists
    const lines = llmResponse.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.match(/^[\d\-\*•]\s/) || trimmed.toLowerCase().includes('insight')) {
        const cleaned = trimmed.replace(/^[\d\-\*•]\s*/, '').trim();
        if (cleaned.length > 10) {
          insights.push(cleaned);
        }
      }
    });
    
    return insights.slice(0, 10); // Limit to 10 insights
  }
  
  private extractRecommendations(llmResponse: string): string[] {
    const recommendations: string[] = [];
    
    const lines = llmResponse.split('\n');
    let inRecommendationSection = false;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('recommend') || 
          trimmed.toLowerCase().includes('action') ||
          trimmed.toLowerCase().includes('should')) {
        inRecommendationSection = true;
      }
      
      if (inRecommendationSection && (trimmed.match(/^[\d\-\*•]\s/) || trimmed.includes('should'))) {
        const cleaned = trimmed.replace(/^[\d\-\*•]\s*/, '').trim();
        if (cleaned.length > 10) {
          recommendations.push(cleaned);
        }
      }
    });
    
    return recommendations.slice(0, 10); // Limit to 10 recommendations
  }
  
  private calculateConfidence(context: AnalyticsContext, llmResponse: OracleResponse): number {
    // Base confidence on data quality and LLM response quality
    let confidence = 0.5; // Base confidence
    
    // More data points = higher confidence
    if (context.dataPoints.length > 50) confidence += 0.2;
    else if (context.dataPoints.length > 20) confidence += 0.1;
    
    // Successful LLM response = higher confidence
    if (llmResponse.success) confidence += 0.2;
    
    // Longer, more detailed response = higher confidence
    if (llmResponse.response && llmResponse.response.length > 500) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  private async logAnalysisToHCS(result: LLMAnalysisResult): Promise<void> {
    try {
      await hcsService.logOracleQuery({
        queryId: result.analysisId,
        inputPrompt: `LLM Analytics: ${result.analysisType}`,
        aiResponse: result.llmResponse.substring(0, 200) + '...',
        model: result.modelUsed,
        provider: 'llm_analytics_service',
        cost: 0,
        executionTime: result.processingTime,
        success: true
      });
    } catch (error) {
      console.error('⚠️ Failed to log analysis to HCS:', error);
    }
  }
  
  private addToHistory(result: LLMAnalysisResult): void {
    this.analysisHistory.push(result);
    
    // Maintain history size
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.shift();
    }
  }
}

// Singleton instance
export const llmAnalyticsService = new LLMAnalyticsService();

export default llmAnalyticsService;