import { 
  OracleProvider, 
  OracleResponse, 
  ConsensusResult, 
  ConsensusMethod, 
  ConsensusError,
  OracleQueryOptions,
  OracleError
} from '../../types/oracle';

/**
 * Oracle Consensus Service
 * Aggregates data from multiple oracle providers using various consensus algorithms
 */
export class OracleConsensusService {
  private providers: Map<string, OracleProvider> = new Map();
  private defaultMethod: ConsensusMethod = ConsensusMethod.MEDIAN;
  private minResponses: number = 2;
  private maxResponseTime: number = 10000;
  private outlierThreshold: number = 0.3; // 30% deviation threshold

  constructor(config?: ConsensusConfig) {
    if (config) {
      this.defaultMethod = config.defaultMethod || this.defaultMethod;
      this.minResponses = config.minResponses || this.minResponses;
      this.maxResponseTime = config.maxResponseTime || this.maxResponseTime;
      this.outlierThreshold = config.outlierThreshold || this.outlierThreshold;
    }
  }

  /**
   * Register an oracle provider
   */
  registerProvider(provider: OracleProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Unregister an oracle provider
   */
  unregisterProvider(providerName: string): void {
    this.providers.delete(providerName);
  }

  /**
   * Get consensus data from all or specified providers
   */
  async getConsensus(
    query: string, 
    options?: OracleQueryOptions
  ): Promise<ConsensusResult> {
    const method = options?.consensusMethod || this.defaultMethod;
    const targetProviders = options?.sources 
      ? this.getProvidersByNames(options.sources)
      : Array.from(this.providers.values());

    if (targetProviders.length < this.minResponses) {
      throw new ConsensusError(
        `Insufficient providers: ${targetProviders.length} < ${this.minResponses}`,
        [],
        method
      );
    }

    // Fetch data from all providers in parallel
    const responses = await this.fetchFromProviders(targetProviders, query, options);

    if (responses.length < this.minResponses) {
      throw new ConsensusError(
        `Insufficient valid responses: ${responses.length} < ${this.minResponses}`,
        responses,
        method
      );
    }

    // Apply consensus algorithm
    return this.applyConsensus(responses, method, query);
  }

  /**
   * Fetch data from multiple providers with timeout and error handling
   */
  private async fetchFromProviders(
    providers: OracleProvider[],
    query: string,
    options?: OracleQueryOptions
  ): Promise<OracleResponse[]> {
    const fetchPromises = providers.map(provider =>
      this.fetchWithTimeout(provider, query, options)
    );

    const results = await Promise.allSettled(fetchPromises);
    const validResponses: OracleResponse[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        validResponses.push(result.value);
      } else {
        console.warn(`Provider ${providers[index].name} failed:`, result.reason.message);
      }
    });

    return validResponses;
  }

  /**
   * Fetch from single provider with timeout
   */
  private async fetchWithTimeout(
    provider: OracleProvider,
    query: string,
    options?: OracleQueryOptions
  ): Promise<OracleResponse> {
    const timeout = options?.timeout || this.maxResponseTime;
    
    return Promise.race([
      provider.fetch(query, options),
      new Promise<OracleResponse>((_, reject) => {
        setTimeout(() => {
          reject(new OracleError(
            `Provider ${provider.name} timeout`,
            'TIMEOUT',
            provider.name,
            query
          ));
        }, timeout);
      })
    ]);
  }

  /**
   * Apply consensus algorithm to responses
   */
  private applyConsensus(
    responses: OracleResponse[],
    method: ConsensusMethod,
    query: string
  ): ConsensusResult {
    // Remove outliers first
    const cleanedResponses = this.removeOutliers(responses);

    let consensusValue: any;
    let confidence: number;

    switch (method) {
      case ConsensusMethod.MEDIAN:
        ({ value: consensusValue, confidence } = this.calculateMedian(cleanedResponses));
        break;
      
      case ConsensusMethod.WEIGHTED_AVERAGE:
        ({ value: consensusValue, confidence } = this.calculateWeightedAverage(cleanedResponses));
        break;
      
      case ConsensusMethod.MAJORITY_VOTE:
        ({ value: consensusValue, confidence } = this.calculateMajorityVote(cleanedResponses));
        break;
      
      case ConsensusMethod.CONFIDENCE_WEIGHTED:
        ({ value: consensusValue, confidence } = this.calculateConfidenceWeighted(cleanedResponses));
        break;
      
      default:
        throw new ConsensusError(`Unsupported consensus method: ${method}`, responses, method);
    }

    return {
      value: consensusValue,
      confidence,
      method,
      sources: cleanedResponses.map(r => r.source),
      raw_responses: responses,
      timestamp: new Date()
    };
  }

  /**
   * Remove statistical outliers from responses
   */
  private removeOutliers(responses: OracleResponse[]): OracleResponse[] {
    if (responses.length < 3) return responses;

    const numericResponses = responses.filter(r => typeof r.data === 'number');
    const nonNumericResponses = responses.filter(r => typeof r.data !== 'number');

    if (numericResponses.length < 3) return responses;

    // Calculate mean and standard deviation
    const values = numericResponses.map(r => r.data as number);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Filter outliers (values beyond threshold * stdDev from mean)
    const threshold = this.outlierThreshold * stdDev;
    const filteredNumeric = numericResponses.filter(r => {
      const deviation = Math.abs((r.data as number) - mean);
      return deviation <= threshold * 3; // 3-sigma rule
    });

    return [...filteredNumeric, ...nonNumericResponses];
  }

  /**
   * Calculate median consensus
   */
  private calculateMedian(responses: OracleResponse[]): { value: any; confidence: number } {
    const numericResponses = responses.filter(r => typeof r.data === 'number');
    
    if (numericResponses.length === 0) {
      // For non-numeric data, return most common value
      return this.calculateMajorityVote(responses);
    }

    const values = numericResponses.map(r => r.data as number).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 !== 0 
      ? values[mid] 
      : (values[mid - 1] + values[mid]) / 2;

    // Confidence based on response agreement
    const avgDeviation = values.reduce((sum, val) => sum + Math.abs(val - median), 0) / values.length;
    const confidence = Math.max(0.1, 1 - (avgDeviation / median));

    return { value: median, confidence };
  }

  /**
   * Calculate weighted average based on provider weights
   */
  private calculateWeightedAverage(responses: OracleResponse[]): { value: any; confidence: number } {
    const numericResponses = responses.filter(r => typeof r.data === 'number');
    
    if (numericResponses.length === 0) {
      return this.calculateMajorityVote(responses);
    }

    let totalWeight = 0;
    let weightedSum = 0;
    let avgConfidence = 0;

    numericResponses.forEach(response => {
      const provider = this.providers.get(response.source);
      const weight = provider ? provider.weight : 0.5;
      
      totalWeight += weight;
      weightedSum += (response.data as number) * weight;
      avgConfidence += response.confidence * weight;
    });

    const weightedAverage = weightedSum / totalWeight;
    const confidence = avgConfidence / totalWeight;

    return { value: weightedAverage, confidence };
  }

  /**
   * Calculate majority vote for categorical data
   */
  private calculateMajorityVote(responses: OracleResponse[]): { value: any; confidence: number } {
    const valueCount = new Map<string, { count: number; responses: OracleResponse[] }>();

    responses.forEach(response => {
      const key = JSON.stringify(response.data);
      if (!valueCount.has(key)) {
        valueCount.set(key, { count: 0, responses: [] });
      }
      const entry = valueCount.get(key)!;
      entry.count++;
      entry.responses.push(response);
    });

    // Find most common value
    let maxCount = 0;
    let majorityValue: any = null;
    let majorityResponses: OracleResponse[] = [];

    for (const [key, entry] of valueCount) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
        majorityValue = JSON.parse(key);
        majorityResponses = entry.responses;
      }
    }

    const confidence = maxCount / responses.length;

    return { value: majorityValue, confidence };
  }

  /**
   * Calculate consensus weighted by individual response confidence
   */
  private calculateConfidenceWeighted(responses: OracleResponse[]): { value: any; confidence: number } {
    const numericResponses = responses.filter(r => typeof r.data === 'number');
    
    if (numericResponses.length === 0) {
      return this.calculateMajorityVote(responses);
    }

    let totalWeight = 0;
    let weightedSum = 0;
    let avgConfidence = 0;

    numericResponses.forEach(response => {
      const weight = response.confidence;
      totalWeight += weight;
      weightedSum += (response.data as number) * weight;
      avgConfidence += response.confidence * weight;
    });

    const weightedValue = weightedSum / totalWeight;
    const confidence = avgConfidence / totalWeight;

    return { value: weightedValue, confidence };
  }

  /**
   * Get providers by names
   */
  private getProvidersByNames(names: string[]): OracleProvider[] {
    return names
      .map(name => this.providers.get(name))
      .filter((provider): provider is OracleProvider => provider !== undefined);
  }

  /**
   * Get registered providers
   */
  getProviders(): OracleProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): OracleProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Health check all providers
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const healthChecks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const isHealthy = await provider.healthCheck();
          results.set(name, isHealthy);
        } catch (error) {
          results.set(name, false);
        }
      }
    );

    await Promise.allSettled(healthChecks);
    return results;
  }
}

export interface ConsensusConfig {
  defaultMethod?: ConsensusMethod;
  minResponses?: number;
  maxResponseTime?: number;
  outlierThreshold?: number;
}