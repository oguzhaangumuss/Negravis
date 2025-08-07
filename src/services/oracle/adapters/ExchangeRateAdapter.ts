import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * ExchangeRate.host Oracle Adapter
 * Provides foreign exchange rates from ExchangeRate.host API
 * Free service with no API key required
 */
export class ExchangeRateAdapter extends OracleProviderBase {
  public readonly name = 'exchangerate';
  public readonly weight = 0.85;
  public readonly reliability = 0.90;
  public readonly latency = 600;

  private readonly endpoint = 'https://api.exchangerate-api.com/v4';
  private readonly supportedCurrencies = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
    'TRY', 'RUB', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'KRW',
    'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF'
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`💱 ExchangeRate fetchData called with query: "${query}"`);
    
    const { baseCurrency, targetCurrency } = this.parseExchangeQuery(query);
    console.log(`🎯 Parsed: ${baseCurrency} → ${targetCurrency}`);

    if (!this.supportedCurrencies.has(baseCurrency) || !this.supportedCurrencies.has(targetCurrency)) {
      throw new OracleError(
        `Unsupported currency pair: ${baseCurrency}/${targetCurrency}`,
        'UNSUPPORTED_CURRENCY',
        this.name,
        query
      );
    }

    try {
      const url = `${this.endpoint}/latest/${baseCurrency}`;
      console.log(`🌐 Fetching from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Negravis-Oracle/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new OracleError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          this.name,
          query
        );
      }

      const data: any = await response.json();
      console.log(`📊 Raw ExchangeRate response:`, data);

      if (!data || !data.rates) {
        throw new OracleError(
          'ExchangeRate API returned invalid response',
          'API_ERROR',
          this.name,
          query
        );
      }

      const exchangeRate = data.rates[targetCurrency];
      if (!exchangeRate) {
        throw new OracleError(
          `No exchange rate found for ${baseCurrency}/${targetCurrency}`,
          'NO_DATA',
          this.name,
          query
        );
      }

      // Use current date if API timestamp is invalid
      const lastUpdate = data.time_last_updated ? new Date(data.time_last_updated * 1000) : new Date();
      const hoursOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      const confidence = Math.max(0.7, 1 - (hoursOld / 24)); // Base confidence 0.7

      const result = {
        pair: `${baseCurrency}/${targetCurrency}`,
        rate: exchangeRate,
        base_currency: baseCurrency,
        target_currency: targetCurrency,
        timestamp: data.date || new Date().toISOString().split('T')[0],
        last_update: lastUpdate.toISOString(),
        confidence: confidence,
        source: 'exchangerate-api.com',
        data_age_hours: hoursOld
      };

      console.log(`✅ ExchangeRate processed result:`, result);
      return result;

    } catch (error: any) {
      console.error(`❌ ExchangeRate fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch exchange rate: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Parse exchange rate query to extract base and target currencies
   */
  private parseExchangeQuery(query: string): { baseCurrency: string; targetCurrency: string } {
    const normalizedQuery = query.toUpperCase().trim();
    
    // Pattern 1: "USD/EUR", "USD to EUR", "USD-EUR"
    const pairMatch = normalizedQuery.match(/([A-Z]{3})[\/\-\s]+(TO\s+)?([A-Z]{3})/);
    if (pairMatch) {
      return {
        baseCurrency: pairMatch[1],
        targetCurrency: pairMatch[3]
      };
    }
    
    // Pattern 2: "EUR rate", "JPY exchange rate"
    const rateMatch = normalizedQuery.match(/([A-Z]{3})\s*(RATE|EXCHANGE|PRICE)/);
    if (rateMatch) {
      return {
        baseCurrency: 'USD', // Default base currency
        targetCurrency: rateMatch[1]
      };
    }
    
    // Pattern 3: "exchange rate USD EUR"
    const exchangeMatch = normalizedQuery.match(/EXCHANGE.+?([A-Z]{3}).+?([A-Z]{3})/);
    if (exchangeMatch) {
      return {
        baseCurrency: exchangeMatch[1],
        targetCurrency: exchangeMatch[2]
      };
    }
    
    // Default: assume USD base if only one currency mentioned
    const currencyMatch = normalizedQuery.match(/([A-Z]{3})/);
    if (currencyMatch && this.supportedCurrencies.has(currencyMatch[1])) {
      return {
        baseCurrency: 'USD',
        targetCurrency: currencyMatch[1]
      };
    }
    
    // Fallback
    return {
      baseCurrency: 'USD',
      targetCurrency: 'EUR'
    };
  }

  /**
   * Health check by testing a simple exchange rate query
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/latest/USD`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) return false;
      
      const data: any = await response.json();
      return data && data.rates && typeof data.rates.EUR === 'number';
      
    } catch (error) {
      console.warn(`⚠️ ExchangeRate health check failed:`, error);
      return false;
    }
  }

  /**
   * Abstract health check implementation required by base class
   */
  protected async performHealthCheck(): Promise<void> {
    const response = await fetch(`${this.endpoint}/latest/USD`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`ExchangeRate health check failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data || !data.rates || typeof data.rates.EUR !== 'number') {
      throw new Error('ExchangeRate API returned invalid data');
    }
  }

  /**
   * Get provider metrics for monitoring
   */
  async getMetrics(): Promise<any> {
    const isHealthy = await this.healthCheck();
    
    return {
      provider: this.name,
      healthy: isHealthy,
      supported_currencies: Array.from(this.supportedCurrencies).length,
      api_cost: 'free',
      rate_limit: 'reasonable_use',
      latency_ms: this.latency,
      weight: this.weight,
      reliability: this.reliability,
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get supported symbols
   */
  getSupportedSymbols(): string[] {
    return ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'];
  }
}