import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Web Scraping Oracle Adapter with Brave Search API Integration
 * Uses Brave Search API as primary method with Puppeteer scraping as fallback
 */
export class WebScrapingAdapter extends OracleProviderBase {
  public readonly name = 'web-scraping';
  public readonly weight = 0.8;
  public readonly reliability = 0.85;
  public readonly latency = 1500; // Reduced due to API usage

  private readonly scrapingRules: Map<string, ScrapingRule>;
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  private browser: Browser | null = null;
  private isInitialized = false;
  private braveApiKey: string | null = null;
  private braveRequestCount = 0;
  private readonly braveMonthlyLimit = 2000; // Free tier limit

  constructor() {
    super();
    this.scrapingRules = new Map();
    this.setupDefaultRules();
    this.braveApiKey = process.env.BRAVE_SEARCH_API_KEY || null;
    
    if (this.braveApiKey) {
      console.log('✅ Brave Search API key found - API mode enabled');
    } else {
      console.log('⚠️ Brave Search API key not found - fallback to scraping only');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🚀 Initializing Puppeteer browser for web scraping...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      this.isInitialized = true;
      console.log('✅ Puppeteer browser initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize Puppeteer browser:', error.message);
      throw new Error(`Puppeteer initialization failed: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('🧹 Puppeteer browser closed');
    }
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🕷️ WebScraping fetchData called with query: "${query}"`);
    
    const rule = this.findMatchingRule(query);
    
    if (!rule) {
      // Fallback to search-based scraping
      return await this.performIntelligentSearch(query);
    }

    try {
      console.log(`🎯 Using scraping rule for: ${rule.pattern}`);
      
      // Use Puppeteer for dynamic content
      if (rule.needsJS) {
        return await this.scrapWithPuppeteer(rule, query);
      }
      
      // Use Axios for simple static content
      return await this.scrapWithAxios(rule, query);

    } catch (error: any) {
      console.error(`❌ Web scraping failed for "${query}":`, error.message);
      
      // Fallback to intelligent search
      try {
        console.log('🔄 Falling back to intelligent search...');
        return await this.performIntelligentSearch(query);
      } catch (fallbackError: any) {
        throw new OracleError(
          `Web scraping and fallback failed for ${query}: ${error.message}`,
          'SCRAPING_ERROR',
          this.name,
          query
        );
      }
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Test both Axios and Puppeteer
    try {
      // Test simple HTTP request
      await axios.get('https://httpbin.org/status/200', {
        headers: { 'User-Agent': this.userAgent },
        timeout: 3000
      });
      
      // Test Puppeteer browser
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (this.browser) {
        const page = await this.browser.newPage();
        await page.goto('https://httpbin.org/status/200', { 
          waitUntil: 'networkidle0',
          timeout: 3000 
        });
        await page.close();
      }
      
      console.log('✅ WebScrapingAdapter health check passed');
    } catch (error: any) {
      console.error('❌ WebScrapingAdapter health check failed:', error.message);
      throw new Error(`WebScraping health check failed: ${error.message}`);
    }
  }

  private async scrapWithPuppeteer(rule: ScrapingRule, query: string): Promise<any> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log(`🌐 Navigating to ${rule.url}`);
      await page.goto(rule.url, { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      });

      // Wait for selector if specified
      if (rule.waitForSelector) {
        await page.waitForSelector(rule.waitForSelector, { timeout: 5000 });
      }

      // Extract data using page.evaluate
      const extractedData = await page.evaluate((selector: string) => {
        const doc = (globalThis as any).document;
        const elements = doc.querySelectorAll(selector);
        const results: any[] = [];
        
        elements.forEach((el: any) => {
          results.push({
            text: el.textContent?.trim(),
            html: el.innerHTML,
            attributes: Array.from(el.attributes).reduce((acc: any, attr: any) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          });
        });
        
        return results;
      }, rule.selector);

      return {
        data: extractedData,
        url: rule.url,
        selector: rule.selector,
        method: 'puppeteer',
        timestamp: new Date().toISOString(),
        query: query,
        success: true
      };

    } finally {
      await page.close();
    }
  }

  private async scrapWithAxios(rule: ScrapingRule, query: string): Promise<any> {
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
      method: 'axios',
      timestamp: new Date().toISOString(),
      query: query,
      success: true
    };
  }

  private async performIntelligentSearch(query: string): Promise<any> {
    console.log(`🧠 Performing intelligent search for: "${query}"`);
    
    // Try Brave Search API first if available and under quota
    if (this.canUseBraveAPI()) {
      try {
        console.log('🌟 Using Brave Search API...');
        return await this.searchWithBraveAPI(query);
      } catch (error: any) {
        console.warn(`⚠️ Brave Search API failed: ${error.message}, falling back to scraping`);
      }
    }
    
    // Fallback to scraping-based search
    console.log('🕷️ Falling back to scraping-based search...');
    
    // Check for news/market queries
    if (query.match(/news|market|price|crypto/i)) {
      return await this.searchCryptoNews(query);
    }
    
    // Check for weather queries  
    if (query.match(/weather|temperature|climate/i)) {
      return await this.searchWeatherInfo(query);
    }
    
    // Fallback to general web search
    return await this.performGeneralSearch(query);
  }

  private async searchCryptoNews(query: string): Promise<any> {
    const sources = [
      'https://cointelegraph.com/',
      'https://coindesk.com/',
      'https://www.coinbase.com/news'
    ];

    for (const source of sources) {
      try {
        console.log(`🔍 Searching crypto news at: ${source}`);
        
        if (!this.browser) continue;
        
        const page = await this.browser.newPage();
        await page.setUserAgent(this.userAgent);
        
        try {
          await page.goto(source, { 
            waitUntil: 'networkidle0',
            timeout: 10000 
          });

          const headlines = await page.evaluate(() => {
            const doc = (globalThis as any).document;
            const selectors = [
              'h1, h2, h3',
              '.headline',
              '.title',
              '[class*="headline"]',
              '[class*="title"]'
            ];
            
            const results: string[] = [];
            for (const selector of selectors) {
              const elements = doc.querySelectorAll(selector);
              elements.forEach((el: any) => {
                const text = el.textContent?.trim();
                if (text && text.length > 10 && text.length < 200) {
                  results.push(text);
                }
              });
              if (results.length >= 5) break;
            }
            
            return results.slice(0, 5);
          });

          if (headlines.length > 0) {
            return {
              data: {
                headlines,
                source: source,
                type: 'crypto_news',
                relevance: this.calculateRelevance(query, headlines.join(' '))
              },
              url: source,
              method: 'intelligent_search',
              timestamp: new Date().toISOString(),
              query: query,
              success: true
            };
          }

        } finally {
          await page.close();
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to scrape ${source}:`, error);
        continue;
      }
    }

    throw new Error('No crypto news sources available');
  }

  private async searchWeatherInfo(query: string): Promise<any> {
    // Use a simple weather service as fallback
    try {
      const location = this.extractLocationFromQuery(query);
      const weatherUrl = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
      
      const response = await axios.get(weatherUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000
      });

      const weather = response.data;
      
      return {
        data: {
          location: location,
          temperature: weather.current_condition?.[0]?.temp_C || 'N/A',
          description: weather.current_condition?.[0]?.weatherDesc?.[0]?.value || 'N/A',
          humidity: weather.current_condition?.[0]?.humidity || 'N/A',
          source: 'wttr.in',
          type: 'weather_data'
        },
        url: weatherUrl,
        method: 'weather_api',
        timestamp: new Date().toISOString(),
        query: query,
        success: true
      };
      
    } catch (error: any) {
      throw new Error(`Weather search failed: ${error.message}`);
    }
  }

  private async performGeneralSearch(query: string): Promise<any> {
    // Fallback to a simple search result
    return {
      data: {
        query: query,
        type: 'general_search',
        message: `Web search capabilities for "${query}" - implementation in progress`,
        suggestions: [
          'Try more specific queries',
          'Use cryptocurrency or weather related terms',
          'Check if the service is available'
        ]
      },
      method: 'fallback',
      timestamp: new Date().toISOString(),
      query: query,
      success: true
    };
  }

  private extractLocationFromQuery(query: string): string {
    const locationMatch = query.match(/(?:weather|temperature|climate)\s+(?:in|at|for)\s+([a-zA-Z\s,]+)/i) ||
                          query.match(/(?:in|at)\s+([a-zA-Z\s,]+)$/i);
    
    return locationMatch ? locationMatch[1].trim() : 'London';
  }

  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => 
      contentWords.some(cWord => cWord.includes(word) || word.includes(cWord))
    ).length;
    
    return matches / queryWords.length;
  }

  private setupDefaultRules(): void {
    // Crypto news scraping with Puppeteer
    this.scrapingRules.set('news', {
      pattern: /news|headline|article|crypto.*news/i,
      url: 'https://cointelegraph.com/',
      selector: 'h1, h2, h3, .post-card-inline__title',
      needsJS: true,
      waitForSelector: 'h1',
      extractor: ($, selector) => {
        const headlines: string[] = [];
        $(selector).each((i: any, el: any) => {
          if (i < 5) headlines.push($(el).text().trim());
        });
        return {
          headlines,
          sentiment: this.analyzeSentiment(headlines),
          source: 'cointelegraph'
        };
      }
    });

    // Market data scraping with Puppeteer
    this.scrapingRules.set('market', {
      pattern: /market.*cap|volume|dominance|crypto.*market/i,
      url: 'https://coinmarketcap.com/',
      selector: '[data-role="market-cap-value"], [data-role="volume-value"], .global-market-stats',
      needsJS: true,
      waitForSelector: '[data-role="market-cap-value"]',
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

  /**
   * Check if Brave Search API can be used
   */
  private canUseBraveAPI(): boolean {
    return this.braveApiKey !== null && this.braveRequestCount < this.braveMonthlyLimit;
  }

  /**
   * Search using Brave Search API
   */
  private async searchWithBraveAPI(query: string): Promise<any> {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API key not available');
    }

    if (this.braveRequestCount >= this.braveMonthlyLimit) {
      throw new Error('Brave Search API monthly limit exceeded');
    }

    try {
      console.log(`🔍 Brave Search API query: "${query}"`);
      
      // Determine search type based on query
      const searchType = this.determineBraveSearchType(query);
      let endpoint = 'https://api.search.brave.com/res/v1/web/search';
      
      const params = new URLSearchParams({
        q: query,
        count: '10',
        safesearch: 'moderate',
        freshness: query.match(/news|breaking/i) ? 'pd' : 'pm', // Last day for news, last month for others
        text_decorations: 'false',
        result_filter: this.getBraveResultFilter(query)
      });

      // Add summary for certain queries
      if (query.match(/news|market|what|how|explain/i)) {
        params.set('summary', '1');
      }

      const url = `${endpoint}?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.braveApiKey,
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });

      this.braveRequestCount++;
      console.log(`✅ Brave API request successful. Count: ${this.braveRequestCount}/${this.braveMonthlyLimit}`);

      return this.processBraveSearchResponse(response.data, query);

    } catch (error: any) {
      if (error.response) {
        console.error(`❌ Brave Search API error: ${error.response.status} ${error.response.statusText}`);
        if (error.response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        if (error.response.status === 401) {
          throw new Error('Invalid API key');
        }
      }
      throw new Error(`Brave Search API failed: ${error.message}`);
    }
  }

  /**
   * Determine Brave Search type based on query
   */
  private determineBraveSearchType(query: string): 'web' | 'news' | 'images' | 'videos' {
    if (query.match(/news|breaking|headline|article/i)) return 'news';
    if (query.match(/image|photo|picture/i)) return 'images';
    if (query.match(/video|youtube|watch/i)) return 'videos';
    return 'web';
  }

  /**
   * Get result filter for Brave Search based on query
   */
  private getBraveResultFilter(query: string): string {
    const filters = [];
    
    if (query.match(/news|breaking|headline/i)) filters.push('news');
    if (query.match(/video|youtube/i)) filters.push('videos');
    if (query.match(/faq|question|how|what/i)) filters.push('faq');
    if (query.match(/location|place|restaurant|hotel/i)) filters.push('locations');
    
    // Always include web results
    filters.push('web');
    
    return filters.join(',');
  }

  /**
   * Process Brave Search API response
   */
  private processBraveSearchResponse(data: any, query: string): any {
    const results = {
      data: {
        query: query,
        results: [] as any[],
        summary: null as any,
        news: [] as any[],
        locations: [] as any[],
        query_info: null as any,
        type: 'brave_api_search'
      },
      method: 'brave_search_api',
      timestamp: new Date().toISOString(),
      query: query,
      success: true,
      source: 'brave_search'
    };

    // Process web results
    if (data.web && data.web.results) {
      results.data.results = data.web.results.slice(0, 5).map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        description: result.description || '',
        age: result.age || null,
        language: result.language || 'en'
      }));
    }

    // Process news results
    if (data.news && data.news.results) {
      results.data.news = data.news.results.slice(0, 3).map((news: any) => ({
        title: news.title || '',
        url: news.url || '',
        description: news.description || '',
        age: news.age || null,
        source: news.meta_url?.netloc || 'unknown'
      }));
    }

    // Process locations if available
    if (data.locations && data.locations.results) {
      results.data.locations = data.locations.results.slice(0, 3).map((loc: any) => ({
        title: loc.title || '',
        address: loc.address || '',
        rating: loc.rating || null,
        type: loc.type || 'location'
      }));
    }

    // Process summary if available
    if (data.summarizer && data.summarizer.key) {
      results.data.summary = {
        key: data.summarizer.key,
        available: true
      };
    }

    // Process search information
    if (data.query) {
      results.data.query_info = {
        original: data.query.original || query,
        altered: data.query.altered || null,
        spellcheck: data.query.spellcheck_off === false
      };
    }

    console.log(`📊 Brave API results: ${results.data.results.length} web, ${results.data.news.length} news, ${results.data.locations.length} locations`);
    
    return results;
  }

  /**
   * Get Brave Search API usage statistics
   */
  getBraveAPIStats(): { 
    hasApiKey: boolean; 
    requestCount: number; 
    monthlyLimit: number; 
    remainingRequests: number;
    canUseAPI: boolean;
  } {
    return {
      hasApiKey: this.braveApiKey !== null,
      requestCount: this.braveRequestCount,
      monthlyLimit: this.braveMonthlyLimit,
      remainingRequests: this.braveMonthlyLimit - this.braveRequestCount,
      canUseAPI: this.canUseBraveAPI()
    };
  }
}

export interface ScrapingRule {
  pattern: RegExp;
  url: string;
  selector: string;
  needsJS?: boolean;
  waitForSelector?: string;
  extractor?: (
    $: cheerio.CheerioAPI,
    selector: string,
    query?: string
  ) => any;
}