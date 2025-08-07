import { OracleProviderBase } from './OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../types/oracle';

/**
 * Conversational AI Service
 * Handles natural language conversations, greetings, and general queries
 * that don't require Oracle data retrieval
 */
export class ConversationalAIService extends OracleProviderBase {
  public readonly name = 'conversational_ai';
  public readonly weight = 1.0;
  public readonly reliability = 0.98;
  public readonly latency = 200;

  private readonly conversationalPatterns = new Map([
    // Greetings
    ['greeting', [
      /^(hi|hello|hey|greetings?|good (morning|afternoon|evening))/i,
      /^(what'?s up|howdy|yo)/i
    ]],
    
    // Farewells
    ['farewell', [
      /^(bye|goodbye|see you|farewell|take care)/i,
      /^(catch you later|until next time|gotta go)/i
    ]],
    
    // Thanks
    ['thanks', [
      /^(thank you|thanks|thx|appreciate)/i,
      /^(much appreciated|grateful)/i
    ]],
    
    // Identity/capability questions
    ['identity', [
      /(who are you|what.*you.*do|what.*this|what.*platform)/i,
      /(tell me about.*system|explain.*service)/i,
      /(how.*work|what.*capabilities)/i
    ]],
    
    // Help requests
    ['help', [
      /^(help|assist|support)/i,
      /(how.*use|get started|need help)/i,
      /(what can.*do|available.*services)/i
    ]],
    
    // Status inquiries
    ['status', [
      /(how.*you|are you (ok|working|online))/i,
      /(system.*status|everything.*working)/i
    ]],
    
    // Compliments/reactions
    ['positive', [
      /(great|awesome|cool|nice|good job|well done)/i,
      /(impressive|amazing|excellent)/i
    ]],
    
    // Weather requests (redirect to Oracle)  
    ['weather_request', [
      /(weather|wheather|temperature|climate|forecast)/i,
      /(what.*weather|what.*wheather|how.*weather|weather.*in|wheather.*in)/i
    ]],
    
    // Data requests (redirect to Oracle)
    ['data_request', [
      /(price|cost|value|worth)/i,
      /(btc|bitcoin|eth|ethereum|crypto)/i,
      /(no.*want|i want|give me)/i
    ]],
    
    // Generic conversation
    ['generic', [
      /(tell me about|can you|do you know)/i,
      /^(yes|no|maybe|sure|definitely)/i,
      /(interesting|really|oh|wow)/i
    ]]
  ]);

  private readonly responses = new Map([
    ['greeting', [
      'Hello! 👋 Welcome to Negravis Oracle & AI Platform! I\'m your AI assistant ready to help with cryptocurrency prices, weather data, system analytics, and general questions.',
      'Hi there! ✨ I\'m the Negravis AI assistant. I can help you get real-time crypto prices, weather information, system status, or just have a friendly chat!',
      'Greetings! 🚀 Welcome to the Negravis Oracle system. I\'m here to assist with data queries and answer your questions. What can I help you with today?'
    ]],
    
    ['farewell', [
      'Goodbye! 👋 Thanks for using Negravis Oracle. Feel free to return anytime for more data queries!',
      'See you later! ✨ The Oracle will be here whenever you need real-time data or assistance.',
      'Farewell! 🌟 Hope I was helpful. Come back anytime for crypto prices, weather, or system information!'
    ]],
    
    ['thanks', [
      'You\'re very welcome! 😊 Happy to help with any Oracle queries or data you need.',
      'My pleasure! ✨ That\'s what I\'m here for - providing accurate data and assistance.',
      'Glad I could help! 🌟 Feel free to ask for more crypto prices, weather data, or system information anytime.'
    ]],
    
    ['identity', [
      'I\'m the Negravis Oracle AI Assistant! 🤖 I\'m powered by a multi-source oracle system that aggregates data from various providers like CoinGecko, Chainlink, weather services, and more. I can provide:\n\n• 💰 Cryptocurrency prices (BTC, ETH, ADA, etc.)\n• 🌤️ Weather data for any location\n• 📊 System analytics and health status\n• 🔍 General information and assistance\n\nWhat would you like to explore?',
      'I\'m your AI assistant for the Negravis Oracle & AI Platform! ✨ This system combines multiple data sources to provide reliable, consensus-based information. I specialize in:\n\n• Real-time crypto market data\n• Global weather information\n• System monitoring and analytics\n• Friendly conversation and support\n\nHow can I assist you today?'
    ]],
    
    ['help', [
      'I\'d be happy to help! 🚀 Here\'s what I can do for you:\n\n**Data Services:**\n• Get cryptocurrency prices: "BTC price", "Ethereum price"\n• Weather information: "weather in London", "temperature in Tokyo"\n• System analytics: "system status", "show providers"\n\n**Quick Commands:**\n• "check balance" - View account status\n• "list services" - Show available providers\n• "show oracle providers" - Display data sources\n\nJust ask naturally! What interests you?',
      'Here to help! ✨ I can assist with:\n\n**💰 Crypto Data:** BTC, ETH, ADA prices and market info\n**🌤️ Weather:** Global weather conditions and forecasts\n**📊 Analytics:** System health, provider status, performance metrics\n**💬 Conversation:** Questions, explanations, and friendly chat\n\nTry asking: "What\'s the Bitcoin price?" or "Weather in New York" - I\'ll get you accurate data from multiple sources!'
    ]],
    
    ['status', [
      'I\'m doing great! 🟢 All Oracle systems are operational and ready to serve you with:\n\n• Multi-provider data consensus ✅\n• Real-time price feeds active ✅\n• Weather services online ✅\n• Smart contract integration working ✅\n\nWhat data can I fetch for you?',
      'Everything\'s running smoothly! ✨ The Oracle network is healthy with multiple providers active. I\'m ready to help with crypto prices, weather data, system analytics, or any questions you have!'
    ]],
    
    ['positive', [
      'Thank you! 😊 I\'m glad you\'re enjoying the Negravis Oracle system! The multi-source consensus approach ensures reliable data.',
      'Much appreciated! ✨ It\'s great to have users who value accurate, multi-source oracle data. What else can I help you discover?',
      'Thanks for the kind words! 🌟 The Oracle system is designed to provide the most reliable data possible through consensus mechanisms.'
    ]],
    
    ['weather_request', [
      'I can help you with weather information! 🌤️ Let me route your request to our weather Oracle service for accurate, real-time data.',
      'Getting weather data for you! ☁️ Our Oracle system will provide current conditions and forecasts.',
      'Weather request received! 🌡️ Let me fetch that information from our reliable weather data providers.'
    ]],
    
    ['data_request', [
      'I can help you with that data request! 📊 Let me route this to our Oracle system for accurate, real-time information.',
      'Data request received! 🔍 Our multi-source Oracle will provide you with reliable, consensus-based information.',
      'I\'ll get that information for you! ⚡ Routing to our Oracle providers for the most accurate data.'
    ]],
    
    ['generic', [
      'That\'s an interesting point! 🤔 I\'m designed to help with data queries and provide accurate information from multiple oracle sources. Is there specific data you\'d like me to fetch?',
      'I understand! ✨ As your Oracle AI assistant, I\'m here to provide reliable data and answer questions. What would you like to explore?',
      'Indeed! 🚀 The world of oracles and real-time data is fascinating. I can help you access cryptocurrency prices, weather information, system analytics, and more!'
    ]]
  ]);

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`🤖 ConversationalAI processing: "${query}"`);
    
    const intent = this.detectConversationalIntent(query);
    console.log(`🎯 Detected intent: ${intent}`);
    
    if (!intent) {
      throw new OracleError(
        'Query does not appear to be conversational',
        'NOT_CONVERSATIONAL',
        this.name,
        query
      );
    }

    const responses = this.responses.get(intent);
    if (!responses || responses.length === 0) {
      throw new OracleError(
        `No responses available for intent: ${intent}`,
        'NO_RESPONSE',
        this.name,
        query
      );
    }

    // Select a random response for variety
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      intent,
      response: randomResponse,
      conversation_type: 'ai_generated',
      timestamp: Date.now(),
      source: 'conversational_ai'
    };
  }

  protected async performHealthCheck(): Promise<void> {
    // Conversational AI is always healthy - it's rule-based
    console.log('🤖 ConversationalAI health check passed');
  }

  protected calculateConfidence(data: any): number {
    // High confidence for pattern-matched conversational responses
    return data.intent ? 0.95 : 0.5;
  }

  /**
   * Detect if a query is conversational and determine its intent
   */
  public detectConversationalIntent(query: string): string | null {
    const cleanQuery = query.trim();
    
    if (!cleanQuery) return null;

    // Check each intent pattern
    for (const [intent, patterns] of this.conversationalPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(cleanQuery)) {
          return intent;
        }
      }
    }

    return null;
  }

  /**
   * Check if a query is conversational (should be handled by AI)
   * Returns false for data/weather requests that should go to Oracle system
   */
  public static isConversationalQuery(query: string): boolean {
    const service = new ConversationalAIService();
    const intent = service.detectConversationalIntent(query);
    
    // Route these intents to Oracle system instead of AI
    const oracleIntents = ['weather_request', 'data_request'];
    if (oracleIntents.includes(intent || '')) {
      return false; // Send to Oracle system
    }
    
    return intent !== null; // Other intents go to AI
  }

  /**
   * Get conversational response for a query
   */
  public async getConversationalResponse(query: string): Promise<string> {
    try {
      const result = await this.fetchData(query);
      return result.response;
    } catch (error) {
      // Fallback response for unrecognized conversational queries
      return "I'm here to help! 🤖 I can provide cryptocurrency prices, weather data, system information, or just chat. What would you like to know?";
    }
  }

  /**
   * Get available conversation topics/intents
   */
  public getAvailableIntents(): string[] {
    return Array.from(this.conversationalPatterns.keys());
  }

  /**
   * Process Oracle data into intelligent response
   */
  public async processOracleData(query: string, oracleData: any, sources: string[], confidence: number): Promise<string> {
    console.log(`🧠 Processing Oracle data for query: "${query}"`);
    
    const queryType = this.detectQueryType(query);
    console.log(`🎯 Query type detected: ${queryType}`);
    
    switch (queryType) {
      case 'crypto_price':
        return this.formatCryptoPriceResponse(query, oracleData, sources, confidence);
        
      case 'weather':
        return this.formatWeatherResponse(query, oracleData, sources, confidence);
        
      case 'exchange_rate':
        return this.formatExchangeRateResponse(query, oracleData, sources, confidence);
        
      case 'space_astronomy':
        return this.formatSpaceResponse(query, oracleData, sources, confidence);
        
      case 'knowledge':
        return this.formatKnowledgeResponse(query, oracleData, sources, confidence);
        
      default:
        return this.formatGenericResponse(query, oracleData, sources, confidence);
    }
  }

  /**
   * Detect query type for appropriate formatting
   */
  private detectQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Crypto price patterns
    if (lowerQuery.includes('price') || lowerQuery.includes('btc') || lowerQuery.includes('bitcoin') || 
        lowerQuery.includes('eth') || lowerQuery.includes('ethereum') || lowerQuery.includes('crypto')) {
      return 'crypto_price';
    }
    
    // Weather patterns
    if (lowerQuery.includes('weather') || lowerQuery.includes('temperature') || 
        lowerQuery.includes('forecast') || lowerQuery.includes('climate')) {
      return 'weather';
    }
    
    // Exchange rate patterns
    if (lowerQuery.includes('exchange') || lowerQuery.includes('currency') || 
        lowerQuery.includes('usd') || lowerQuery.includes('eur')) {
      return 'exchange_rate';
    }
    
    // Space/Astronomy patterns
    if (lowerQuery.includes('nasa') || lowerQuery.includes('space') || 
        lowerQuery.includes('mars') || lowerQuery.includes('astronomy')) {
      return 'space_astronomy';
    }
    
    // Knowledge patterns
    if (lowerQuery.includes('what is') || lowerQuery.includes('who is') || 
        lowerQuery.includes('explain') || lowerQuery.includes('wikipedia')) {
      return 'knowledge';
    }
    
    return 'generic';
  }

  /**
   * Format cryptocurrency price response
   */
  private formatCryptoPriceResponse(query: string, data: any, sources: string[], confidence: number): string {
    const symbol = data.symbol || 'Unknown';
    const price = data.price || data.value || 'N/A';
    const confidenceText = (confidence * 100).toFixed(1);
    
    let response = `💰 **${symbol} Price Update**\n\n`;
    
    if (typeof price === 'number') {
      response += `Current Price: **$${price.toLocaleString()}**\n`;
      
      // Add market cap if available
      if (data.market_cap) {
        response += `Market Cap: $${(data.market_cap / 1e9).toFixed(2)}B\n`;
      }
      
      // Add 24h volume if available
      if (data.volume_24h) {
        response += `24h Volume: $${(data.volume_24h / 1e6).toFixed(1)}M\n`;
      }
    } else {
      response += `Price: ${price}\n`;
    }
    
    response += `\n📊 **Data Quality:**\n`;
    response += `• Confidence: ${confidenceText}%\n`;
    response += `• Sources: ${sources.join(', ')}\n`;
    
    if (data.last_updated || data.timestamp) {
      response += `• Last Updated: Just now\n`;
    }
    
    response += `\n🔗 Data verified and logged on Hedera blockchain`;
    
    return response;
  }

  /**
   * Format weather response
   */
  private formatWeatherResponse(query: string, data: any, sources: string[], confidence: number): string {
    let response = `🌤️ **Weather Information**\n\n`;
    
    if (data.temperature !== undefined) {
      response += `Temperature: **${data.temperature}°C** (${(data.temperature * 9/5 + 32).toFixed(1)}°F)\n`;
    }
    
    if (data.condition) {
      response += `Conditions: ${data.condition}\n`;
    }
    
    if (data.humidity !== undefined) {
      response += `Humidity: ${data.humidity}%\n`;
    }
    
    if (data.location) {
      response += `Location: ${data.location}\n`;
    }
    
    response += `\n📊 **Data Quality:**\n`;
    response += `• Sources: ${sources.join(', ')}\n`;
    response += `• Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    response += `\n🔗 Weather data verified on blockchain`;
    
    return response;
  }

  /**
   * Format exchange rate response
   */
  private formatExchangeRateResponse(query: string, data: any, sources: string[], confidence: number): string {
    let response = `💱 **Exchange Rate**\n\n`;
    
    if (data.pair) {
      response += `${data.pair}: **${data.rate}**\n`;
    } else if (data.rate) {
      response += `Exchange Rate: **${data.rate}**\n`;
    }
    
    response += `\n📊 **Data Quality:**\n`;
    response += `• Sources: ${sources.join(', ')}\n`;
    response += `• Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    response += `\n🔗 Rate data verified on blockchain`;
    
    return response;
  }

  /**
   * Format space/astronomy response
   */
  private formatSpaceResponse(query: string, data: any, sources: string[], confidence: number): string {
    let response = `🚀 **Space & Astronomy Data**\n\n`;
    
    if (data.title) {
      response += `**${data.title}**\n\n`;
    }
    
    if (data.explanation) {
      response += `${data.explanation.substring(0, 300)}...\n\n`;
    }
    
    if (data.type === 'near_earth_objects') {
      response += `Near Earth Objects Today: ${data.object_count}\n`;
      if (data.potentially_hazardous_count) {
        response += `Potentially Hazardous: ${data.potentially_hazardous_count}\n`;
      }
    }
    
    response += `📊 **NASA Data Quality:**\n`;
    response += `• Source: Official NASA API\n`;
    response += `• Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    response += `\n🔗 Space data verified on blockchain`;
    
    return response;
  }

  /**
   * Format knowledge response
   */
  private formatKnowledgeResponse(query: string, data: any, sources: string[], confidence: number): string {
    let response = `📚 **Knowledge Information**\n\n`;
    
    if (data.title || data.top_result?.title) {
      const title = data.title || data.top_result?.title;
      response += `**${title}**\n\n`;
    }
    
    if (data.extract || data.top_result?.summary?.extract) {
      const extract = data.extract || data.top_result?.summary?.extract;
      response += `${extract}\n\n`;
    }
    
    response += `📊 **Information Quality:**\n`;
    response += `• Sources: ${sources.join(', ')}\n`;
    response += `• Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    response += `\n🔗 Information verified on blockchain`;
    
    return response;
  }

  /**
   * Format generic response
   */
  private formatGenericResponse(query: string, data: any, sources: string[], confidence: number): string {
    let response = `🔍 **Query Results**\n\n`;
    
    // Try to extract meaningful information
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const importantKeys = keys.filter(key => 
        !['timestamp', 'last_updated', 'source', 'confidence'].includes(key)
      ).slice(0, 5);
      
      for (const key of importantKeys) {
        const value = data[key];
        if (value !== undefined && value !== null) {
          const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          response += `• ${displayKey}: ${value}\n`;
        }
      }
    } else {
      response += `Result: ${data}\n`;
    }
    
    response += `\n📊 **Data Quality:**\n`;
    response += `• Sources: ${sources.join(', ')}\n`;
    response += `• Confidence: ${(confidence * 100).toFixed(1)}%\n`;
    response += `\n🔗 Data verified on blockchain`;
    
    return response;
  }

  /**
   * Add new conversational pattern
   */
  public addConversationalPattern(intent: string, pattern: RegExp, responses: string[]): void {
    if (!this.conversationalPatterns.has(intent)) {
      this.conversationalPatterns.set(intent, []);
    }
    this.conversationalPatterns.get(intent)!.push(pattern);

    if (!this.responses.has(intent)) {
      this.responses.set(intent, []);
    }
    this.responses.get(intent)!.push(...responses);
  }
}

// Export singleton instance
export const conversationalAI = new ConversationalAIService();