import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Web Scraping Oracle Adapter
 * Scrapes web data for information not available via APIs
 */
export class WebScrapingAdapter extends OracleProviderBase {
  public readonly name = 'web-scraping';
  public readonly weight = 0.6;
  public readonly reliability = 0.7;
  public readonly latency = 2000;

  private readonly scrapingRules: Map<string, ScrapingRule>;
  private readonly userAgent = 'Mozilla/5.0 (compatible; Oracle-System/1.0)';

  constructor() {
    super();
    this.scrapingRules = new Map();
    this.setupDefaultRules();
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    const rule = this.findMatchingRule(query);
    
    if (!rule) {
      // Fallback to Google search
      return await this.performGoogleSearch(query);
    }

    try {
      const response = await axios.get(rule.url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const extractedData = this.extractData($, rule, query);

      return {
        data: extractedData,
        url: rule.url,
        selector: rule.selector,
        timestamp: new Date().toISOString(),
        query: query
      };

    } catch (error: any) {
      throw new OracleError(
        `Web scraping failed for ${query}: ${error.message}`,
        'SCRAPING_ERROR',
        this.name,
        query
      );
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Test with a simple, reliable endpoint
    await axios.get('https://httpbin.org/status/200', {
      headers: { 'User-Agent': this.userAgent },
      timeout: 3000
    });
  }

  private setupDefaultRules(): void {
    // News sentiment scraping
    this.scrapingRules.set('news', {
      pattern: /news|headline|article/i,
      url: 'https://coindesk.com/',
      selector: '.headline-list .card-title',
      extractor: ($, selector) => {
        const headlines: string[] = [];
        $(selector).each((i: any, el: any) => {
          if (i < 5) headlines.push($(el).text().trim());
        });
        return {
          headlines,
          sentiment: this.analyzeSentiment(headlines),
          source: 'coindesk'
        };
      }
    });

    // Market data scraping
    this.scrapingRules.set('market', {
      pattern: /market.*cap|volume|dominance/i,
      url: 'https://coinmarketcap.com/',
      selector: '.global-stats .value',
      extractor: ($, selector) => {
        const stats: Record<string, string> = {};
        $(selector).each((i: any, el: any) => {
          const value = $(el).text().trim();
          if (i === 0) stats.market_cap = value;
          if (i === 1) stats.volume_24h = value;
          if (i === 2) stats.btc_dominance = value;
        });
        return stats;
      }
    });

    // Social media sentiment
    this.scrapingRules.set('social', {
      pattern: /twitter|social|sentiment/i,
      url: 'https://alternative.me/crypto/fear-and-greed-index/',
      selector: '.fng-circle .fng-value',
      extractor: ($, selector) => {
        const value = parseInt($(selector).text()) || 50;
        return {
          fear_greed_index: value,
          sentiment: value > 75 ? 'extreme_greed' : 
                   value > 55 ? 'greed' :
                   value > 45 ? 'neutral' :
                   value > 25 ? 'fear' : 'extreme_fear'
        };
      }
    });
  }

  private findMatchingRule(query: string): ScrapingRule | undefined {
    for (const rule of this.scrapingRules.values()) {
      if (rule.pattern.test(query)) {
        return rule;
      }
    }
    return undefined;
  }

  private extractData($: any, rule: ScrapingRule, query: string): any {
    if (rule.extractor) {
      return rule.extractor($, rule.selector, query);
    }

    // Default extraction - get text content
    const elements: string[] = [];
    $(rule.selector).each((i: any, el: any) => {
      elements.push($(el).text().trim());
    });

    return elements.length === 1 ? elements[0] : elements;
  }

  private async performGoogleSearch(query: string): Promise<any> {
    try {
      // Mock Google search results
      // In production, would use Google Custom Search API or SerpAPI
      const searchResults = [
        `Search result 1 for "${query}"`,
        `Search result 2 for "${query}"`,
        `Search result 3 for "${query}"`
      ];

      return {
        results: searchResults,
        query: query,
        source: 'google_search',
        count: searchResults.length
      };

    } catch (error: any) {
      throw new OracleError(
        `Google search failed for ${query}: ${error.message}`,
        'SEARCH_ERROR',
        this.name,
        query
      );
    }
  }

  private analyzeSentiment(headlines: string[]): string {
    if (!headlines || headlines.length === 0) return 'neutral';

    const positiveWords = ['bull', 'rise', 'surge', 'gain', 'up', 'high', 'moon', 'profit'];
    const negativeWords = ['bear', 'fall', 'crash', 'drop', 'down', 'low', 'loss', 'sell'];

    let score = 0;
    const text = headlines.join(' ').toLowerCase();

    positiveWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });

    negativeWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length;
      score -= matches;
    });

    if (score > 2) return 'bullish';
    if (score < -2) return 'bearish';
    return 'neutral';
  }

  protected calculateConfidence(data: any): number {
    if (!data) return 0;

    let confidence = 0.6; // Base confidence for web scraping

    // Adjust based on data quality
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      confidence += 0.1;
    }

    if (data.timestamp) {
      const age = Date.now() - new Date(data.timestamp).getTime();
      if (age < 3600000) confidence += 0.1; // 1 hour
      else if (age > 86400000) confidence -= 0.1; // 1 day
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Add new scraping rule
   */
  addScrapingRule(key: string, rule: ScrapingRule): void {
    this.scrapingRules.set(key, rule);
  }

  /**
   * Get available scraping rules
   */
  getScrapingRules(): Map<string, ScrapingRule> {
    return new Map(this.scrapingRules);
  }
}

export interface ScrapingRule {
  pattern: RegExp;
  url: string;
  selector: string;
  extractor?: (
    $: cheerio.CheerioAPI,
    selector: string,
    query?: string
  ) => any;
}