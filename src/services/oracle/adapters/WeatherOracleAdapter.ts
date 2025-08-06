import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * Weather Oracle Adapter (Migrated from old system)
 * Provides weather data from OpenWeatherMap API
 * Enhanced with new oracle system features
 */
export class WeatherOracleAdapter extends OracleProviderBase {
  public readonly name = 'weather';
  public readonly weight = 0.85;
  public readonly reliability = 0.9;
  public readonly latency = 1200;

  private readonly endpoint = 'https://api.openweathermap.org/data/2.5';
  private readonly apiKey: string;
  private readonly supportedLocations = [
    'London', 'New York', 'Tokyo', 'Paris', 'Berlin',
    'Sydney', 'Toronto', 'Istanbul', 'Dubai', 'Singapore',
    'Los Angeles', 'Chicago', 'Miami', 'Moscow', 'Beijing'
  ];

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.OPENWEATHER_API_KEY || 'demo_key';
    
    if (this.apiKey === 'demo_key') {
      console.log('⚠️ WeatherOracleAdapter: Using demo data - set OPENWEATHER_API_KEY for real data');
    }
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    const location = this.extractLocation(query);

    try {
      // Use demo data if no API key
      if (this.apiKey === 'demo_key') {
        return this.generateDemoWeatherData(location);
      }

      const url = `${this.endpoint}/weather?q=${encodeURIComponent(location)}&appid=${this.apiKey}&units=metric`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Negravis-Oracle/2.0'
        }
      });

      if (!response.ok) {
        throw new OracleError(
          `OpenWeatherMap API error: ${response.status} ${response.statusText}`,
          'API_ERROR',
          this.name,
          query
        );
      }

      const data: any = await response.json();

      return {
        location: data.name,
        country: data.sys.country,
        temperature: Math.round(data.main.temp * 10) / 10,
        feels_like: Math.round(data.main.feels_like * 10) / 10,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility / 1000, // Convert to km
        wind_speed: data.wind?.speed || 0,
        wind_direction: data.wind?.deg || 0,
        weather_main: data.weather[0].main,
        weather_description: data.weather[0].description,
        weather_icon: data.weather[0].icon,
        clouds: data.clouds.all,
        timestamp: data.dt * 1000,
        sunrise: data.sys.sunrise * 1000,
        sunset: data.sys.sunset * 1000,
        coords: {
          lat: data.coord.lat,
          lon: data.coord.lon
        }
      };

    } catch (error) {
      if (error instanceof OracleError) {
        throw error;
      }
      throw new OracleError(
        `Weather fetch failed: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  protected async performHealthCheck(): Promise<void> {
    if (this.apiKey === 'demo_key') {
      return; // Demo mode always healthy
    }

    const response = await fetch(
      `${this.endpoint}/weather?q=London&appid=${this.apiKey}&units=metric`,
      {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Negravis-Oracle/2.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Weather API health check failed: ${response.status}`);
    }
  }

  protected calculateConfidence(data: any): number {
    if (!data || !data.temperature) return 0;

    let confidence = 0.9; // Base confidence for weather data

    // Adjust based on data age
    if (data.timestamp) {
      const age = Date.now() - data.timestamp;
      const ageMinutes = age / (1000 * 60);
      
      if (ageMinutes < 10) confidence += 0.05;       // Very fresh
      else if (ageMinutes < 30) confidence += 0.02;  // Fresh  
      else if (ageMinutes > 120) confidence -= 0.1;  // Old data
    }

    // Adjust based on data completeness
    const requiredFields = ['temperature', 'humidity', 'weather_description'];
    const presentFields = requiredFields.filter(field => data[field] !== undefined);
    confidence *= (presentFields.length / requiredFields.length);

    // Adjust based on extreme values (might be errors)
    if (data.temperature < -50 || data.temperature > 60) {
      confidence -= 0.2; // Extreme temperatures
    }
    
    if (data.humidity < 0 || data.humidity > 100) {
      confidence -= 0.15; // Invalid humidity
    }

    // Demo data has lower confidence
    if (this.apiKey === 'demo_key') {
      confidence *= 0.6;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  private extractLocation(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Direct location match
    for (const location of this.supportedLocations) {
      if (lowerQuery.includes(location.toLowerCase())) {
        return location;
      }
    }

    // Weather query patterns
    const patterns = [
      /weather\s+(?:in|at|for)\s+(\w+)/i,
      /temperature\s+(?:in|at|for)\s+(\w+)/i,
      /climate\s+(?:in|at|for)\s+(\w+)/i,
      /(\w+)\s+weather/i,
      /(\w+)\s+temperature/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const location = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        // Check if it's a supported location
        const found = this.supportedLocations.find(loc => 
          loc.toLowerCase() === location.toLowerCase()
        );
        if (found) return found;
        return location; // Return as-is if not in supported list
      }
    }

    // Default to London
    return 'London';
  }

  private generateDemoWeatherData(location: string): any {
    const baseTemps: Record<string, number> = {
      'London': 12, 'New York': 8, 'Tokyo': 15, 'Paris': 11,
      'Berlin': 9, 'Sydney': 20, 'Toronto': 5, 'Istanbul': 16,
      'Dubai': 28, 'Singapore': 26, 'Los Angeles': 18,
      'Chicago': 3, 'Miami': 24, 'Moscow': -5, 'Beijing': 6
    };

    const baseTemp = baseTemps[location] || 15;
    const variation = (Math.random() - 0.5) * 10; // ±5°C variation
    const temperature = Math.round((baseTemp + variation) * 10) / 10;

    const weatherConditions = [
      { main: 'Clear', description: 'clear sky', icon: '01d' },
      { main: 'Clouds', description: 'few clouds', icon: '02d' },
      { main: 'Clouds', description: 'scattered clouds', icon: '03d' },
      { main: 'Clouds', description: 'overcast clouds', icon: '04d' },
      { main: 'Rain', description: 'light rain', icon: '10d' },
      { main: 'Rain', description: 'moderate rain', icon: '10d' }
    ];

    const weather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

    return {
      location: location,
      country: 'XX',
      temperature: temperature,
      feels_like: temperature + (Math.random() - 0.5) * 4,
      humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
      pressure: Math.floor(Math.random() * 50) + 1000, // 1000-1050 hPa
      visibility: Math.floor(Math.random() * 10) + 5, // 5-15 km
      wind_speed: Math.random() * 15, // 0-15 m/s
      wind_direction: Math.floor(Math.random() * 360),
      weather_main: weather.main,
      weather_description: weather.description,
      weather_icon: weather.icon,
      clouds: Math.floor(Math.random() * 100),
      timestamp: Date.now(),
      sunrise: Date.now() - (Math.random() * 6 * 3600 * 1000), // Random time in last 6 hours
      sunset: Date.now() + (Math.random() * 12 * 3600 * 1000), // Random time in next 12 hours
      coords: {
        lat: (Math.random() - 0.5) * 180,
        lon: (Math.random() - 0.5) * 360
      }
    };
  }

  /**
   * Get supported locations
   */
  getSupportedLocations(): string[] {
    return [...this.supportedLocations];
  }

  /**
   * Add supported location
   */
  addLocation(location: string): void {
    if (!this.supportedLocations.includes(location)) {
      this.supportedLocations.push(location);
    }
  }

  /**
   * Check if location is supported
   */
  isLocationSupported(location: string): boolean {
    return this.supportedLocations.some(loc => 
      loc.toLowerCase() === location.toLowerCase()
    );
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'OpenWeatherMap API',
      version: '2.5',
      description: 'Real-time weather data for smart contracts',
      rateLimit: 60, // requests per minute for free tier
      supportedLocations: this.supportedLocations.length,
      demoMode: this.apiKey === 'demo_key',
      features: [
        'Current weather conditions',
        'Temperature and humidity',
        'Wind speed and direction',
        'Atmospheric pressure',
        'Visibility data',
        'Weather descriptions',
        'Sunrise/sunset times'
      ]
    };
  }
}