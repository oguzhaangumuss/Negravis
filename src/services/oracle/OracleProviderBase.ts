import { OracleProvider, OracleResponse, OracleQueryOptions, OracleMetrics, OracleError } from '../../types/oracle';

/**
 * Base class for all Oracle Providers
 * Provides common functionality and enforces provider contract
 */
export abstract class OracleProviderBase implements OracleProvider {
  public abstract readonly name: string;
  public abstract readonly weight: number;
  public abstract readonly reliability: number;
  public abstract readonly latency: number;

  protected metrics: OracleMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageLatency: 0,
    lastHealthCheck: new Date(),
    reliability: 0
  };

  protected cache: Map<string, { data: OracleResponse; timestamp: number }> = new Map();
  protected readonly defaultCacheTime = 60000; // 1 minute

  /**
   * Abstract method to be implemented by each provider
   */
  protected abstract fetchData(query: string, options?: OracleQueryOptions): Promise<any>;

  /**
   * Main fetch method with error handling and caching
   */
  async fetch(query: string, options?: OracleQueryOptions): Promise<OracleResponse> {
    const startTime = Date.now();
    const cacheKey = `${query}_${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.shouldUseCache(cacheKey, options?.cacheTime)) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached.data;
        }
      }

      // Fetch fresh data
      const rawData = await this.executeWithTimeout(
        () => this.fetchData(query, options),
        options?.timeout || 5000
      );

      const response: OracleResponse = {
        data: rawData,
        confidence: this.calculateConfidence(rawData),
        timestamp: new Date(),
        source: this.name,
        metadata: {
          query,
          options,
          latency: Date.now() - startTime
        }
      };

      // Update cache
      this.updateCache(cacheKey, response, options?.cacheTime);

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);

      return response;

    } catch (error: any) {
      this.updateMetrics(false, Date.now() - startTime);
      throw new OracleError(
        `Oracle ${this.name} fetch failed: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithTimeout(
        () => this.performHealthCheck(),
        3000
      );
      this.metrics.lastHealthCheck = new Date();
      return true;
    } catch (error: any) {
      console.warn(`Health check failed for ${this.name}:`, error.message);
      return false;
    }
  }

  /**
   * Get provider metrics
   */
  async getMetrics(): Promise<OracleMetrics> {
    return { ...this.metrics };
  }

  /**
   * Abstract health check to be implemented by providers
   */
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Calculate confidence score based on data quality
   */
  protected calculateConfidence(data: any): number {
    if (!data) return 0;
    
    // Basic confidence calculation - can be overridden by providers
    if (typeof data === 'number' && !isNaN(data)) return 0.9;
    if (typeof data === 'string' && data.length > 0) return 0.8;
    if (typeof data === 'object' && Object.keys(data).length > 0) return 0.85;
    
    return 0.5;
  }

  /**
   * Execute function with timeout
   */
  protected async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeout);
      })
    ]);
  }

  /**
   * Check if cached data should be used
   */
  private shouldUseCache(cacheKey: string, cacheTime?: number): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;

    const maxAge = cacheTime || this.defaultCacheTime;
    return (Date.now() - cached.timestamp) < maxAge;
  }

  /**
   * Update cache with new data
   */
  private updateCache(cacheKey: string, response: OracleResponse, cacheTime?: number): void {
    this.cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    // Cleanup old cache entries (simple LRU)
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Update provider metrics
   */
  private updateMetrics(success: boolean, latency: number): void {
    this.metrics.totalQueries++;
    
    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }

    // Update average latency using exponential moving average
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency;
    } else {
      this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (latency * 0.1);
    }

    // Update reliability score
    this.metrics.reliability = this.metrics.successfulQueries / this.metrics.totalQueries;
  }
}