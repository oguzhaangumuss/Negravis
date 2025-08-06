import { OracleRouter } from '../OracleRouter';
import { ChatbotBase } from './ChatbotBase';
// import { DiscordOracleBot } from './DiscordOracleBot';
import { OracleConfig } from '../../../types/oracle';

/**
 * Chatbot Manager
 * Orchestrates multiple chatbot platforms for oracle queries
 */
export class ChatbotManager {
  private oracleRouter: OracleRouter;
  private bots: Map<string, ChatbotBase> = new Map();
  private config: OracleConfig;
  private isInitialized = false;

  constructor(oracleRouter: OracleRouter, config: OracleConfig) {
    this.oracleRouter = oracleRouter;
    this.config = config;
  }

  /**
   * Initialize all enabled chatbots
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🤖 Initializing Chatbot Manager...');

    try {
      // Initialize Discord bot if enabled
      if (this.config.chatbot?.discord?.enabled) {
        await this.initializeDiscordBot();
      }

      // Initialize Slack bot if enabled (placeholder)
      if (this.config.chatbot?.slack?.enabled) {
        console.log('⚠️ Slack bot not yet implemented');
      }

      // Initialize Telegram bot if enabled (placeholder)
      if (this.config.chatbot?.telegram?.enabled) {
        console.log('⚠️ Telegram bot not yet implemented');
      }

      this.isInitialized = true;
      console.log(`✅ Chatbot Manager initialized with ${this.bots.size} active bots`);

    } catch (error: any) {
      console.error('❌ Chatbot Manager initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Discord bot
   */
  private async initializeDiscordBot(): Promise<void> {
    const discordConfig = this.config.chatbot!.discord!;
    
    if (!discordConfig.token) {
      throw new Error('Discord token not provided');
    }

    console.log('🔵 Initializing Discord Oracle Bot...');

    const applicationId = process.env.DISCORD_APPLICATION_ID;
    if (!applicationId) {
      throw new Error('DISCORD_APPLICATION_ID environment variable not set');
    }

    // Temporarily disabled until Discord.js types are fixed
    console.log('⚠️ Discord bot disabled - will be enabled in future update');
    // const discordBot = new DiscordOracleBot(
    //   this.oracleRouter,
    //   discordConfig.token,
    //   applicationId,
    //   discordConfig.channels || []
    // );

    // await discordBot.initialize();
    // this.bots.set('discord', discordBot);
    // console.log('✅ Discord Oracle Bot initialized');
  }

  /**
   * Send message to specific platform
   */
  async sendMessage(platform: string, channelId: string, message: string): Promise<void> {
    const bot = this.bots.get(platform.toLowerCase());
    if (!bot) {
      throw new Error(`Bot for platform ${platform} not found`);
    }

    await bot.sendMessage(channelId, {
      text: message,
      metadata: { timestamp: new Date(), platform }
    });
  }

  /**
   * Broadcast announcement to all platforms
   */
  async broadcastAnnouncement(message: string): Promise<void> {
    console.log(`📢 Broadcasting announcement to ${this.bots.size} platforms`);

    const promises = Array.from(this.bots.entries()).map(async ([platform, bot]) => {
      try {
        // Temporarily disabled Discord-specific logic
        // if (platform === 'discord' && bot instanceof DiscordOracleBot) {
        //   await bot.sendAnnouncement(message);
        // }
        console.log(`⚠️ Announcement to ${platform} skipped - bot system disabled`);
        // Add other platform-specific announcement methods here
      } catch (error: any) {
        console.warn(`⚠️ Failed to send announcement to ${platform}:`, error.message);
      }
    });

    await Promise.allSettled(promises);
    console.log('📢 Announcement broadcast completed');
  }

  /**
   * Get bot for specific platform
   */
  getBot(platform: string): ChatbotBase | undefined {
    return this.bots.get(platform.toLowerCase());
  }

  /**
   * Get all active bots
   */
  getActiveBots(): Array<{ platform: string; bot: ChatbotBase }> {
    return Array.from(this.bots.entries()).map(([platform, bot]) => ({
      platform,
      bot
    }));
  }

  /**
   * Get chatbot statistics
   */
  getStats(): any {
    const stats = {
      total_platforms: this.bots.size,
      active_bots: 0,
      platforms: [] as any[],
      system_health: 0
    };

    for (const [platform, bot] of this.bots) {
      const isActive = bot.isActiveBot();
      if (isActive) stats.active_bots++;

      const platformInfo: any = {
        platform,
        active: isActive
      };

      // Get platform-specific info
      // if (platform === 'discord' && bot instanceof DiscordOracleBot) {
      //   platformInfo.info = bot.getBotInfo();
      // }

      stats.platforms.push(platformInfo);
    }

    stats.system_health = stats.total_platforms > 0 
      ? stats.active_bots / stats.total_platforms 
      : 0;

    return stats;
  }

  /**
   * Restart specific bot
   */
  async restartBot(platform: string): Promise<void> {
    const bot = this.bots.get(platform.toLowerCase());
    if (!bot) {
      throw new Error(`Bot for platform ${platform} not found`);
    }

    console.log(`🔄 Restarting ${platform} bot...`);

    try {
      await bot.close();
      
      // Reinitialize based on platform
      if (platform === 'discord') {
        await this.initializeDiscordBot();
      }
      // Add other platforms as needed

      console.log(`✅ ${platform} bot restarted successfully`);
    } catch (error: any) {
      console.error(`❌ Failed to restart ${platform} bot:`, error.message);
      throw error;
    }
  }

  /**
   * Stop specific bot
   */
  async stopBot(platform: string): Promise<void> {
    const bot = this.bots.get(platform.toLowerCase());
    if (!bot) {
      throw new Error(`Bot for platform ${platform} not found`);
    }

    console.log(`🛑 Stopping ${platform} bot...`);
    await bot.close();
    this.bots.delete(platform.toLowerCase());
    console.log(`✅ ${platform} bot stopped`);
  }

  /**
   * Health check for all bots
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [platform, bot] of this.bots) {
      try {
        const isHealthy = bot.isActiveBot();
        results.set(platform, isHealthy);
      } catch (error: any) {
        console.warn(`Health check failed for ${platform}:`, error.message);
        results.set(platform, false);
      }
    }

    return results;
  }

  /**
   * Close all bots
   */
  async close(): Promise<void> {
    console.log('🔚 Closing all chatbots...');

    const promises = Array.from(this.bots.values()).map(bot => bot.close());
    await Promise.allSettled(promises);

    this.bots.clear();
    this.isInitialized = false;
    console.log('✅ All chatbots closed');
  }

  /**
   * Check if manager is initialized
   */
  isManagerInitialized(): boolean {
    return this.isInitialized;
  }
}