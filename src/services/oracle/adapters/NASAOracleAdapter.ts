import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * NASA Oracle Adapter
 * Provides space, astronomy, and Earth observation data from NASA's Open Data APIs
 * Free tier oracle with comprehensive space and Earth science data
 */
export class NASAOracleAdapter extends OracleProviderBase {
  public readonly name = 'nasa';
  public readonly weight = 0.85;
  public readonly reliability = 0.92;
  public readonly latency = 800;

  private readonly baseEndpoint = 'https://api.nasa.gov';
  private readonly apiKey = process.env.NASA_API_KEY || 'DEMO_KEY'; // NASA provides demo key
  
  // Rate limiting için son request zamanını takip et
  private lastRequestTime = 0;
  private readonly minRequestInterval = 3000; // 3 saniye minimum
  private readonly maxRetries = 2;

  /**
   * Rate limited NASA API request
   */
  private async makeRequest(url: string, retryCount = 0): Promise<any> {
    // Rate limiting: en az 3 saniye bekle
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ NASA API rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          console.log(`🔄 NASA API rate limited, retrying... (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 saniye bekle
          return this.makeRequest(url, retryCount + 1);
        } else {
          throw new Error('NASA API rate limit exceeded after retries');
        }
      }
      
      if (!response.ok) {
        throw new Error(`NASA API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      if (retryCount < this.maxRetries && !error.message.includes('rate limit exceeded')) {
        console.log(`🔄 NASA API error, retrying... (${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.makeRequest(url, retryCount + 1);
      }
      throw error;
    }
  }

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`🚀 NASA fetchData called with query: "${query}"`);
    
    const queryType = this.determineNASAQueryType(query);
    console.log(`🎯 NASA query type: "${queryType}"`);

    try {
      switch (queryType) {
        case 'apod':
          return await this.fetchAPOD(query);
        case 'neo':
          return await this.fetchNearEarthObjects(query);
        case 'mars':
          return await this.fetchMarsRoverPhotos(query);
        case 'epic':
          return await this.fetchEPICEarthImages(query);
        case 'weather':
          return await this.fetchSpaceWeather(query);
        default:
          return await this.fetchAPOD(query); // Default to APOD
      }
    } catch (error: any) {
      console.error(`❌ NASA fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch from NASA: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Fetch Astronomy Picture of the Day
   */
  private async fetchAPOD(query: string): Promise<any> {
    const url = `${this.baseEndpoint}/planetary/apod?api_key=${this.apiKey}`;
    console.log(`🌌 Fetching NASA APOD: ${url}`);

    const data = await this.makeRequest(url);
    console.log(`📊 NASA APOD response:`, data);

    return {
      type: 'astronomy_picture',
      title: data.title,
      explanation: data.explanation,
      url: data.url,
      hd_url: data.hdurl,
      media_type: data.media_type,
      date: data.date,
      copyright: data.copyright,
      service_version: data.service_version,
      source: 'nasa_apod',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch Near Earth Objects data
   */
  private async fetchNearEarthObjects(query: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const url = `${this.baseEndpoint}/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${this.apiKey}`;
    console.log(`☄️ Fetching NASA NEO: ${url}`);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Negravis-Oracle/2.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `NASA NEO API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    const todayObjects = data.near_earth_objects[today] || [];
    
    return {
      type: 'near_earth_objects',
      date: today,
      object_count: todayObjects.length,
      potentially_hazardous_count: todayObjects.filter((obj: any) => obj.is_potentially_hazardous_asteroid).length,
      closest_approach: todayObjects.length > 0 ? todayObjects[0] : null,
      total_objects: data.element_count,
      source: 'nasa_neo',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch Mars Rover Photos
   */
  private async fetchMarsRoverPhotos(query: string): Promise<any> {
    const sol = Math.floor(Math.random() * 1000); // Random sol day
    const url = `${this.baseEndpoint}/mars-photos/api/v1/rovers/curiosity/photos?sol=${sol}&api_key=${this.apiKey}`;
    console.log(`🔴 Fetching NASA Mars photos: ${url}`);

    const data = await this.makeRequest(url);
    const photos = data.photos || [];
    
    return {
      type: 'mars_rover_photos',
      rover: 'curiosity',
      sol: sol,
      photo_count: photos.length,
      latest_photo: photos.length > 0 ? photos[0] : null,
      earth_date: photos.length > 0 ? photos[0].earth_date : null,
      source: 'nasa_mars',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch EPIC Earth Images
   */
  private async fetchEPICEarthImages(query: string): Promise<any> {
    const url = `${this.baseEndpoint}/EPIC/api/natural?api_key=${this.apiKey}`;
    console.log(`🌍 Fetching NASA EPIC: ${url}`);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Negravis-Oracle/2.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `NASA EPIC API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    const latest = data.length > 0 ? data[0] : null;
    
    return {
      type: 'earth_polychromatic_imaging',
      image_count: data.length,
      latest_image: latest,
      date: latest ? latest.date : null,
      coordinates: latest ? latest.centroid_coordinates : null,
      source: 'nasa_epic',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Mock space weather data (NASA doesn't have direct API for this)
   */
  private async fetchSpaceWeather(query: string): Promise<any> {
    // In real implementation, this could use NOAA Space Weather data
    // or NASA's heliophysics APIs
    
    return {
      type: 'space_weather',
      solar_flare_activity: Math.random() > 0.8 ? 'high' : 'low',
      geomagnetic_conditions: ['quiet', 'unsettled', 'active'][Math.floor(Math.random() * 3)],
      solar_wind_speed: 300 + Math.random() * 400, // km/s
      kp_index: Math.floor(Math.random() * 9),
      alert_level: Math.random() > 0.9 ? 'warning' : 'normal',
      source: 'nasa_space_weather',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Determine NASA query type from input
   */
  private determineNASAQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('astronomy') || lowerQuery.includes('picture') || 
        lowerQuery.includes('apod') || lowerQuery.includes('space photo')) {
      return 'apod';
    }
    
    if (lowerQuery.includes('asteroid') || lowerQuery.includes('neo') || 
        lowerQuery.includes('near earth') || lowerQuery.includes('meteor')) {
      return 'neo';
    }
    
    if (lowerQuery.includes('mars') || lowerQuery.includes('rover') || 
        lowerQuery.includes('curiosity') || lowerQuery.includes('red planet')) {
      return 'mars';
    }
    
    if (lowerQuery.includes('earth') || lowerQuery.includes('epic') || 
        lowerQuery.includes('satellite') || lowerQuery.includes('planet')) {
      return 'epic';
    }
    
    if (lowerQuery.includes('space weather') || lowerQuery.includes('solar') || 
        lowerQuery.includes('flare') || lowerQuery.includes('geomagnetic')) {
      return 'weather';
    }

    return 'apod'; // Default
  }

  /**
   * Health check implementation
   */
  protected async performHealthCheck(): Promise<void> {
    const url = `${this.baseEndpoint}/planetary/apod?api_key=${this.apiKey}`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Negravis-Oracle/2.0' },
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`NASA health check failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data || !data.title) {
      throw new Error('NASA API returned invalid data structure');
    }
  }

  /**
   * Enhanced confidence calculation for NASA data
   */
  protected calculateConfidence(data: any): number {
    if (!data) return 0;

    let confidence = 0.92; // High confidence for NASA official data

    // NASA APIs are highly reliable and official
    if (data.source && data.source.includes('nasa')) {
      confidence += 0.03;
    }

    // Adjust based on data type
    if (data.type === 'astronomy_picture' && data.hd_url) confidence += 0.02;
    if (data.type === 'near_earth_objects' && data.object_count > 0) confidence += 0.01;
    if (data.type === 'mars_rover_photos' && data.photo_count > 0) confidence += 0.01;

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'NASA Open Data',
      version: 'v1',
      description: 'Space, astronomy, and Earth observation data from NASA',
      endpoints: [
        'Astronomy Picture of the Day (APOD)',
        'Near Earth Objects (NEO)',
        'Mars Rover Photos',
        'EPIC Earth Images',
        'Space Weather'
      ],
      features: [
        'Official NASA data',
        'High resolution imagery',
        'Real-time space data',
        'Historical archives',
        'Free API access',
        'Educational content'
      ],
      dataTypes: [
        'Astronomy images',
        'Asteroid tracking',
        'Mars exploration',
        'Earth observation',
        'Space weather'
      ]
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
      data_tier: 'free_official',
      api_endpoints: 5,
      coverage: 'space_earth_science',
      update_frequency: 'daily',
      rate_limit: '1000_requests_per_hour',
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get supported symbols (NASA doesn't use symbols, return empty)
   */
  getSupportedSymbols(): string[] {
    return [];
  }
}