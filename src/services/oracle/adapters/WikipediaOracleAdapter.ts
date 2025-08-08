import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * Wikipedia Oracle Adapter
 * Provides knowledge and information data from Wikipedia via MediaWiki REST API
 * Free tier oracle with comprehensive human knowledge database
 */
export class WikipediaOracleAdapter extends OracleProviderBase {
  public readonly name = 'wikipedia';
  public readonly weight = 0.80;
  public readonly reliability = 0.88;
  public readonly latency = 600;

  private readonly baseEndpoint = 'https://en.wikipedia.org/api/rest_v1';
  private readonly searchEndpoint = 'https://en.wikipedia.org/w/api.php';

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`📚 Wikipedia fetchData called with query: "${query}"`);
    
    const queryType = this.determineWikipediaQueryType(query);
    console.log(`🎯 Wikipedia query type: "${queryType}"`);

    try {
      switch (queryType) {
        case 'search':
          return await this.searchWikipedia(query);
        case 'page':
          return await this.fetchPageSummary(query);
        case 'random':
          return await this.fetchRandomPage();
        default:
          return await this.searchWikipedia(query);
      }
    } catch (error: any) {
      console.error(`❌ Wikipedia fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch from Wikipedia: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Search Wikipedia articles
   */
  private async searchWikipedia(query: string): Promise<any> {
    // Clean the query for Wikipedia search
    const searchTerm = this.extractSearchTerm(query);
    const url = `${this.searchEndpoint}?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=5&origin=*`;
    
    console.log(`🔍 Searching Wikipedia: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0 (https://negravis.com/)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `Wikipedia Search API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    console.log(`📊 Wikipedia search response:`, data);

    if (!data.query || !data.query.search || data.query.search.length === 0) {
      throw new OracleError(
        `No Wikipedia articles found for: ${searchTerm}`,
        'NO_DATA',
        this.name,
        query
      );
    }

    const results = data.query.search;
    const topResult = results[0];

    // Get summary for the top result
    const summary = await this.fetchPageSummary(topResult.title);

    return {
      type: 'wikipedia_search',
      query: searchTerm,
      results_count: results.length,
      top_result: {
        title: topResult.title,
        snippet: this.truncateText(topResult.snippet, 150),
        extract: summary.extract ? this.truncateText(summary.extract, 200) : topResult.snippet
      },
      source: 'wikipedia_search',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch page summary using REST API
   */
  private async fetchPageSummary(title: string): Promise<any> {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `${this.baseEndpoint}/page/summary/${encodedTitle}`;
    
    console.log(`📄 Fetching Wikipedia page: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0 (https://negravis.com/)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          title: title,
          extract: 'Page not found',
          missing: true
        };
      }
      throw new OracleError(
        `Wikipedia REST API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        title
      );
    }

    const data: any = await response.json();
    console.log(`📖 Wikipedia page summary:`, data);

    return {
      type: 'wikipedia_page',
      title: data.title,
      extract: data.extract ? this.truncateText(data.extract, 250) : 'No summary available',
      description: data.description,
      source: 'wikipedia_page',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch random Wikipedia page
   */
  private async fetchRandomPage(): Promise<any> {
    const randomUrl = `${this.searchEndpoint}?action=query&format=json&list=random&rnlimit=1&origin=*`;
    
    console.log(`🎲 Fetching random Wikipedia page`);

    const response = await fetch(randomUrl, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0 (https://negravis.com/)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `Wikipedia Random API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        'random'
      );
    }

    const data: any = await response.json();
    const randomPage = data.query.random[0];

    // Get full summary for the random page
    const summary = await this.fetchPageSummary(randomPage.title);

    return {
      type: 'wikipedia_random',
      random_page: summary,
      source: 'wikipedia_random',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Truncate text to specific length for HCS message size optimization
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    
    // Find last complete word within limit
    let truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) { // If we can save at least 20% by cutting at word boundary
      truncated = text.substring(0, lastSpace);
    }
    
    return truncated + '...';
  }

  /**
   * Extract search term from query
   */
  private extractSearchTerm(query: string): string {
    // Remove common words that indicate search intent
    const cleanQuery = query
      .replace(/\b(what|who|when|where|why|how|is|are|was|were|about|tell me|search|find|wikipedia)\b/gi, '')
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim();

    return cleanQuery || query.trim();
  }

  /**
   * Determine Wikipedia query type
   */
  private determineWikipediaQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('random') || lowerQuery.includes('surprise me')) {
      return 'random';
    }
    
    if (lowerQuery.includes('search') || lowerQuery.includes('find') || 
        lowerQuery.includes('what is') || lowerQuery.includes('who is')) {
      return 'search';
    }
    
    // If query looks like a specific page title
    if (!lowerQuery.includes(' ') && query.length > 2) {
      return 'page';
    }

    return 'search'; // Default to search
  }

  /**
   * Health check implementation
   */
  protected async performHealthCheck(): Promise<void> {
    const url = `${this.baseEndpoint}/page/summary/Wikipedia`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Negravis-Oracle/2.0 (https://negravis.com/)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`Wikipedia health check failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data || !data.title) {
      throw new Error('Wikipedia API returned invalid data structure');
    }
  }

  /**
   * Enhanced confidence calculation for Wikipedia data
   */
  protected calculateConfidence(data: any): number {
    if (!data) return 0;

    let confidence = 0.88; // Base confidence for Wikipedia

    // Adjust based on data completeness
    if (data.extract && data.extract.length > 100) confidence += 0.05;
    if (data.thumbnail) confidence += 0.02;
    if (data.coordinates) confidence += 0.01;
    if (data.description) confidence += 0.02;

    // Adjust based on query type
    if (data.type === 'wikipedia_page') confidence += 0.02;
    if (data.type === 'wikipedia_search' && data.results_count > 3) confidence += 0.01;

    // Penalize missing or stub pages
    if (data.missing || (data.extract && data.extract.length < 50)) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'Wikipedia',
      version: 'REST API v1',
      description: 'Free encyclopedia with human knowledge database',
      endpoints: [
        'Page Summary',
        'Search Articles',
        'Random Pages',
        'Media Files'
      ],
      features: [
        'Comprehensive knowledge',
        'Multiple languages',
        'Free access',
        'Real-time updates',
        'Rich metadata',
        'Global coverage'
      ],
      dataTypes: [
        'Article summaries',
        'Search results',
        'Biographical data',
        'Historical information',
        'Scientific knowledge',
        'Cultural content'
      ],
      rateLimit: '200 requests per second',
      languages: '300+ languages supported'
    };
  }

  /**
   * Get provider metrics
   */
  async getMetrics(): Promise<any> {
    const baseMetrics = await super.getMetrics();
    const isHealthy = await this.healthCheck();
    
    return {
      ...baseMetrics,
      provider: this.name,
      healthy: isHealthy,
      data_tier: 'free_community',
      api_endpoints: 4,
      coverage: 'global_knowledge',
      update_frequency: 'real_time',
      rate_limit: '200_requests_per_second',
      languages: '300+',
      articles_count: '6.8M+',
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get supported symbols (Wikipedia doesn't use symbols, return empty)
   */
  getSupportedSymbols(): string[] {
    return [];
  }
}