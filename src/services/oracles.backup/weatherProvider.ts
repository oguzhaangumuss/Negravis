import { OracleProvider, PriceData, WeatherData, OracleResponse } from '../../interfaces/OracleProvider';

/**
 * OpenWeatherMap API Oracle Provider
 * Provides weather data for oracle contracts
 */
export class WeatherProvider implements OracleProvider {
  public readonly name = 'OpenWeatherMap';
  public readonly dataSource = 'openweathermap';
  public readonly endpoint = 'https://api.openweathermap.org/data/2.5';
  public readonly updateFrequency = 10; // 10 minutes
  public readonly reliability = 85; // Good reliability
  public isActive = true;

  private apiKey: string;
  private lastUpdate = new Date();
  private requestCount = 0;
  private successCount = 0;

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || 'demo_key';
    if (this.apiKey === 'demo_key') {
      console.log('⚠️ Using demo weather data - set OPENWEATHER_API_KEY for real data');
    }
  }

  /**
   * Fetch weather data for a location
   */
  async fetchWeather(location: string): Promise<OracleResponse<WeatherData>> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      console.log(`🌤️ Weather: Fetching data for ${location}`);

      // Demo data if no API key
      if (this.apiKey === 'demo_key') {
        return this.getDemoWeatherData(location, startTime);
      }

      const url = `${this.endpoint}/weather?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Negravis-Oracle/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      const weatherData: WeatherData = {
        location: data.name,
        temperature: Math.round(data.main.temp),
        humidity: data.main.humidity,
        description: data.weather[0].description,
        timestamp: Date.now(),
        source: this.name
      };

      this.successCount++;
      this.lastUpdate = new Date();
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Weather: ${location} = ${weatherData.temperature}°C (${executionTime}ms)`);

      return {
        success: true,
        data: weatherData,
        timestamp: Date.now(),
        source: this.name,
        executionTime
      };

    } catch (error: any) {
      console.error(`❌ Weather error for ${location}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
        source: this.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Price fetch not supported for weather provider
   */
  async fetchPrice(symbol: string): Promise<OracleResponse<PriceData>> {
    return {
      success: false,
      error: 'Weather provider does not support price data',
      timestamp: Date.now(),
      source: this.name,
      executionTime: 0
    };
  }

  /**
   * Health check - verify API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.apiKey === 'demo_key') {
        return true; // Demo mode always healthy
      }

      const response = await fetch(`${this.endpoint}/weather?q=London&appid=${this.apiKey}`, {
        method: 'HEAD'
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ Weather health check failed:', error);
      return false;
    }
  }

  /**
   * Get supported locations (major cities)
   */
  getSupportedSymbols(): string[] {
    return [
      'London', 'New York', 'Tokyo', 'Paris', 'Berlin', 
      'Sydney', 'Toronto', 'Istanbul', 'Dubai', 'Singapore'
    ];
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): Date {
    return this.lastUpdate;
  }

  /**
   * Get provider metadata
   */
  getProviderInfo() {
    return {
      name: 'OpenWeatherMap API',
      version: '2.5',
      description: 'Weather data for smart contracts',
      rateLimit: 60 // requests per minute for free tier
    };
  }

  /**
   * Get success rate statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      successRate: this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Demo weather data when no API key is available
   */
  private getDemoWeatherData(location: string, startTime: number): OracleResponse<WeatherData> {
    const demoData: WeatherData = {
      location: location,
      temperature: Math.floor(Math.random() * 30) + 5, // 5-35°C
      humidity: Math.floor(Math.random() * 40) + 40,    // 40-80%
      description: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
      timestamp: Date.now(),
      source: this.name + ' (Demo)'
    };

    this.successCount++;
    this.lastUpdate = new Date();

    return {
      success: true,
      data: demoData,
      timestamp: Date.now(),
      source: this.name,
      executionTime: Date.now() - startTime
    };
  }
}