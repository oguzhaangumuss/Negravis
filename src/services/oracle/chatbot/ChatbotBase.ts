import { OracleRouter } from '../OracleRouter';
import { ChatbotQuery, ChatbotResponse, OracleQueryOptions } from '../../../types/oracle';

/**
 * Base class for chatbot integrations
 * Provides common functionality for natural language oracle queries
 */
export abstract class ChatbotBase {
  protected oracleRouter: OracleRouter;
  protected isActive: boolean = false;
  protected supportedCommands: Map<string, CommandHandler> = new Map();

  constructor(oracleRouter: OracleRouter) {
    this.oracleRouter = oracleRouter;
    this.setupDefaultCommands();
  }

  /**
   * Abstract methods to be implemented by platform-specific bots
   */
  abstract initialize(): Promise<void>;
  abstract sendMessage(channelId: string, response: ChatbotResponse): Promise<void>;
  abstract close(): Promise<void>;

  /**
   * Process natural language query and return oracle response
   */
  async processQuery(query: ChatbotQuery): Promise<ChatbotResponse> {
    console.log(`🤖 Processing chatbot query: "${query.message}" from ${query.platform}:${query.user_id}`);

    try {
      // Parse command if it starts with /
      if (query.message.startsWith('/')) {
        return await this.handleCommand(query);
      }

      // Process as natural language query
      return await this.handleNaturalLanguageQuery(query);

    } catch (error: any) {
      console.error('❌ Chatbot query processing failed:', error.message);
      return {
        text: `Sorry, I encountered an error while processing your query: ${error.message}`,
        metadata: { error: true, query_id: this.generateQueryId() }
      };
    }
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(query: ChatbotQuery): Promise<ChatbotResponse> {
    const parts = query.message.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler = this.supportedCommands.get(command);
    if (!handler) {
      return {
        text: `Unknown command: ${command}. Try \`/help\` to see available commands.`,
        metadata: { error: true }
      };
    }

    return await handler(query, args);
  }

  /**
   * Handle natural language queries
   */
  private async handleNaturalLanguageQuery(query: ChatbotQuery): Promise<ChatbotResponse> {
    const intent = this.detectIntent(query.message);
    const entities = this.extractEntities(query.message);

    // Create oracle query options
    const options: OracleQueryOptions = {
      timeout: 8000,
      sources: this.determineSources(intent, entities)
    };

    try {
      const result = await this.oracleRouter.query(query.message, options);

      // Format response based on query type
      return this.formatOracleResponse(result, intent, entities);

    } catch (error: any) {
      return {
        text: `I couldn't find reliable data for your query. Please try rephrasing or use a specific command like \`/price BTC\` or \`/weather London\`.`,
        metadata: { 
          error: true, 
          original_query: query.message,
          error_message: error.message
        }
      };
    }
  }

  /**
   * Detect intent from natural language
   */
  private detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    const intents = [
      { name: 'price', keywords: ['price', 'cost', 'value', '$', 'usd', 'dollar'] },
      { name: 'weather', keywords: ['weather', 'temperature', 'rain', 'sunny', 'cloudy', 'climate'] },
      { name: 'news', keywords: ['news', 'headline', 'article', 'latest', 'breaking'] },
      { name: 'search', keywords: ['search', 'find', 'google', 'lookup'] },
      { name: 'help', keywords: ['help', 'commands', 'what', 'how'] }
    ];

    for (const intent of intents) {
      if (intent.keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent.name;
      }
    }

    return 'general';
  }

  /**
   * Extract entities from message
   */
  private extractEntities(message: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract cryptocurrency symbols
    const cryptoMatch = message.match(/\b(BTC|ETH|ADA|SOL|MATIC|HBAR|DOT|LINK|AVAX|ATOM)\b/i);
    if (cryptoMatch) {
      entities.symbol = cryptoMatch[1].toUpperCase();
    }

    // Extract location names
    const locationMatch = message.match(/(?:in|at|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (locationMatch) {
      entities.location = locationMatch[1];
    }

    // Extract numbers/amounts
    const numberMatch = message.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      entities.amount = parseFloat(numberMatch[1]);
    }

    return entities;
  }

  /**
   * Determine which oracle sources to use
   */
  private determineSources(intent: string, entities: Record<string, any>): string[] {
    const sources: string[] = [];

    switch (intent) {
      case 'price':
        sources.push('coingecko', 'chainlink');
        break;
      case 'weather':
        sources.push('weather');
        break;
      case 'news':
        sources.push('web-scraping');
        break;
      default:
        // Use all available sources for general queries
        break;
    }

    return sources;
  }

  /**
   * Format oracle response for chatbot
   */
  private formatOracleResponse(result: any, intent: string, entities: Record<string, any>): ChatbotResponse {
    const confidence = Math.round(result.confidence * 100);
    
    switch (intent) {
      case 'price':
        return this.formatPriceResponse(result, confidence);
      case 'weather':
        return this.formatWeatherResponse(result, confidence);
      case 'news':
        return this.formatNewsResponse(result, confidence);
      default:
        return this.formatGeneralResponse(result, confidence);
    }
  }

  private formatPriceResponse(result: any, confidence: number): ChatbotResponse {
    const value = result.value;
    const symbol = value.symbol || 'Unknown';
    const price = typeof value === 'number' ? value : value.price;

    return {
      text: `💰 **${symbol} Price**: $${price.toLocaleString()}\n` +
            `📊 Confidence: ${confidence}%\n` +
            `📡 Sources: ${result.sources.join(', ')}\n` +
            `⏰ Updated: ${new Date().toLocaleTimeString()}`,
      metadata: { 
        type: 'price',
        symbol,
        price,
        confidence: result.confidence
      }
    };
  }

  private formatWeatherResponse(result: any, confidence: number): ChatbotResponse {
    const value = result.value;
    
    return {
      text: `🌤️ **Weather in ${value.location}**:\n` +
            `🌡️ Temperature: ${value.temperature}°C\n` +
            `💧 Humidity: ${value.humidity}%\n` +
            `☁️ Conditions: ${value.weather_description || value.description}\n` +
            `📊 Confidence: ${confidence}%\n` +
            `⏰ Updated: ${new Date().toLocaleTimeString()}`,
      metadata: {
        type: 'weather',
        location: value.location,
        temperature: value.temperature,
        confidence: result.confidence
      }
    };
  }

  private formatNewsResponse(result: any, confidence: number): ChatbotResponse {
    const value = result.value;
    
    return {
      text: `📰 **Latest News**:\n` +
            `${JSON.stringify(value, null, 2)}\n` +
            `📊 Confidence: ${confidence}%\n` +
            `⏰ Updated: ${new Date().toLocaleTimeString()}`,
      metadata: {
        type: 'news',
        confidence: result.confidence
      }
    };
  }

  private formatGeneralResponse(result: any, confidence: number): ChatbotResponse {
    return {
      text: `🔍 **Query Result**:\n` +
            `${JSON.stringify(result.value, null, 2)}\n` +
            `📊 Confidence: ${confidence}%\n` +
            `📡 Sources: ${result.sources.join(', ')}\n` +
            `⏰ Updated: ${new Date().toLocaleTimeString()}`,
      metadata: {
        type: 'general',
        confidence: result.confidence
      }
    };
  }

  /**
   * Setup default slash commands
   */
  private setupDefaultCommands(): void {
    this.supportedCommands.set('/help', this.helpCommand.bind(this));
    this.supportedCommands.set('/price', this.priceCommand.bind(this));
    this.supportedCommands.set('/weather', this.weatherCommand.bind(this));
    this.supportedCommands.set('/oracle', this.oracleCommand.bind(this));
    this.supportedCommands.set('/status', this.statusCommand.bind(this));
    this.supportedCommands.set('/providers', this.providersCommand.bind(this));
  }

  private async helpCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    return {
      text: `🤖 **Oracle Bot Commands:**\n\n` +
            `📈 \`/price <symbol>\` - Get cryptocurrency price (e.g. /price BTC)\n` +
            `🌤️ \`/weather <location>\` - Get weather data (e.g. /weather London)\n` +
            `🔍 \`/oracle <query>\` - Custom oracle query\n` +
            `📊 \`/status\` - Check oracle system status\n` +
            `📡 \`/providers\` - List available oracle providers\n` +
            `❓ \`/help\` - Show this help message\n\n` +
            `You can also ask natural language questions like:\n` +
            `• "What's the price of Bitcoin?"\n` +
            `• "Weather in New York"\n` +
            `• "How much is ETH worth?"`,
      metadata: { type: 'help' }
    };
  }

  private async priceCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    if (args.length === 0) {
      return { text: 'Please specify a cryptocurrency symbol. Example: `/price BTC`' };
    }

    const symbol = args[0].toUpperCase();
    const result = await this.oracleRouter.query(`${symbol} price`);
    return this.formatPriceResponse(result, Math.round(result.confidence * 100));
  }

  private async weatherCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    if (args.length === 0) {
      return { text: 'Please specify a location. Example: `/weather London`' };
    }

    const location = args.join(' ');
    const result = await this.oracleRouter.query(`weather in ${location}`);
    return this.formatWeatherResponse(result, Math.round(result.confidence * 100));
  }

  private async oracleCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    if (args.length === 0) {
      return { text: 'Please provide a query. Example: `/oracle BTC price and weather in Tokyo`' };
    }

    const queryText = args.join(' ');
    const result = await this.oracleRouter.query(queryText);
    return this.formatGeneralResponse(result, Math.round(result.confidence * 100));
  }

  private async statusCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    const stats = await this.oracleRouter.getSystemStats();
    
    return {
      text: `🔧 **Oracle System Status**\n\n` +
            `📊 Providers: ${stats.active_providers}/${stats.total_providers} active\n` +
            `💚 Health: ${Math.round(stats.system_health * 100)}%\n` +
            `⏰ Last Check: ${stats.last_check.toLocaleTimeString()}\n\n` +
            `**Provider Details:**\n` +
            stats.provider_details.map((p: any) => 
              `${p.healthy ? '✅' : '❌'} ${p.name} (${Math.round(p.reliability * 100)}%)`
            ).join('\n'),
      metadata: { type: 'status', stats }
    };
  }

  private async providersCommand(query: ChatbotQuery, args: string[]): Promise<ChatbotResponse> {
    const providers = this.oracleRouter.getProviders();
    
    return {
      text: `📡 **Available Oracle Providers:**\n\n` +
            providers.map(p => 
              `• **${p.name}** (Weight: ${p.weight}, Reliability: ${Math.round(p.reliability * 100)}%)`
            ).join('\n'),
      metadata: { type: 'providers', count: providers.length }
    };
  }

  private generateQueryId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get active status
   */
  isActiveBot(): boolean {
    return this.isActive;
  }
}

type CommandHandler = (query: ChatbotQuery, args: string[]) => Promise<ChatbotResponse>;