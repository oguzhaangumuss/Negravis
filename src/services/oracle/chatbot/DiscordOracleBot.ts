import { Client, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, REST, Routes } from 'discord.js';
import { ChatbotBase } from './ChatbotBase';
import { OracleRouter } from '../OracleRouter';
import { ChatbotQuery, ChatbotResponse } from '../../../types/oracle';

/**
 * Discord Oracle Bot
 * Provides natural language oracle queries through Discord
 */
export class DiscordOracleBot extends ChatbotBase {
  private client: Client;
  private token: string;
  private applicationId: string;
  private allowedChannels: string[];
  private rest: REST;

  constructor(
    oracleRouter: OracleRouter,
    token: string,
    applicationId: string,
    allowedChannels: string[] = []
  ) {
    super(oracleRouter);
    this.token = token;
    this.applicationId = applicationId;
    this.allowedChannels = allowedChannels;
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.rest = new REST({ version: '10' }).setToken(token);
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🤖 Initializing Discord Oracle Bot...');

      // Register slash commands
      await this.registerSlashCommands();

      // Login to Discord
      await this.client.login(this.token);
      
      this.isActive = true;
      console.log('✅ Discord Oracle Bot initialized successfully');
    } catch (error) {
      console.error('❌ Discord bot initialization failed:', error.message);
      throw error;
    }
  }

  async sendMessage(channelId: string, response: ChatbotResponse): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or not a text channel');
      }

      // Create embed for rich response
      const embed = this.createResponseEmbed(response);
      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error(`❌ Failed to send message to channel ${channelId}:`, error.message);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.isActive = false;
      console.log('🔚 Discord Oracle Bot closed');
    }
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      // Check if channel is allowed
      if (this.allowedChannels.length > 0 && !this.allowedChannels.includes(interaction.channelId)) {
        await interaction.reply({
          content: 'This bot is not enabled in this channel.',
          ephemeral: true
        });
        return;
      }

      await this.handleSlashCommand(interaction);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith('!oracle')) return;

      // Check if channel is allowed
      if (this.allowedChannels.length > 0 && !this.allowedChannels.includes(message.channelId)) {
        return;
      }

      await this.handleTextCommand(message);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });
  }

  private async registerSlashCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get cryptocurrency price')
        .addStringOption(option =>
          option.setName('symbol')
            .setDescription('Cryptocurrency symbol (e.g., BTC, ETH)')
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Get weather information')
        .addStringOption(option =>
          option.setName('location')
            .setDescription('City name (e.g., London, New York)')
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName('oracle')
        .setDescription('Custom oracle query')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Your oracle query')
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName('oracle-status')
        .setDescription('Check oracle system status'),
      
      new SlashCommandBuilder()
        .setName('oracle-providers')
        .setDescription('List available oracle providers'),
      
      new SlashCommandBuilder()
        .setName('oracle-help')
        .setDescription('Show oracle bot help')
    ];

    try {
      console.log('📝 Registering Discord slash commands...');
      await this.rest.put(
        Routes.applicationCommands(this.applicationId),
        { body: commands.map(cmd => cmd.toJSON()) }
      );
      console.log('✅ Discord slash commands registered successfully');
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
      throw error;
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const query: ChatbotQuery = {
        platform: 'discord',
        user_id: interaction.user.id,
        channel_id: interaction.channelId,
        message: this.buildCommandMessage(interaction),
        timestamp: new Date()
      };

      const response = await this.processQuery(query);
      const embed = this.createResponseEmbed(response);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Slash command error:', error.message);
      await interaction.editReply({
        content: `An error occurred: ${error.message}`
      });
    }
  }

  private async handleTextCommand(message: any): Promise<void> {
    try {
      const queryText = message.content.replace('!oracle ', '');
      
      const query: ChatbotQuery = {
        platform: 'discord',
        user_id: message.author.id,
        channel_id: message.channelId,
        message: queryText,
        timestamp: new Date()
      };

      const response = await this.processQuery(query);
      const embed = this.createResponseEmbed(response);

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Text command error:', error.message);
      await message.reply(`An error occurred: ${error.message}`);
    }
  }

  private buildCommandMessage(interaction: ChatInputCommandInteraction): string {
    const commandName = interaction.commandName;

    switch (commandName) {
      case 'price':
        return `/price ${interaction.options.getString('symbol')}`;
      case 'weather':
        return `/weather ${interaction.options.getString('location')}`;
      case 'oracle':
        return `/oracle ${interaction.options.getString('query')}`;
      case 'oracle-status':
        return '/status';
      case 'oracle-providers':
        return '/providers';
      case 'oracle-help':
        return '/help';
      default:
        return `/${commandName}`;
    }
  }

  private createResponseEmbed(response: ChatbotResponse): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTimestamp()
      .setFooter({ text: 'Negravis Oracle System' });

    // Set color based on response type
    const colors = {
      price: 0x00FF00,    // Green
      weather: 0x87CEEB,  // Sky blue
      news: 0xFFA500,     // Orange
      status: 0x0099FF,   // Blue
      help: 0x9932CC,     // Purple
      error: 0xFF0000     // Red
    };

    const responseType = response.metadata?.type || 'general';
    embed.setColor(colors[responseType] || 0x666666);

    // Set title based on type
    const titles = {
      price: '💰 Cryptocurrency Price',
      weather: '🌤️ Weather Information',
      news: '📰 News Update',
      status: '🔧 System Status',
      help: '🤖 Oracle Bot Help',
      providers: '📡 Oracle Providers',
      error: '❌ Error'
    };

    embed.setTitle(titles[responseType] || '🔍 Oracle Query Result');

    // Format description
    if (response.text.length > 4000) {
      embed.setDescription(response.text.substring(0, 4000) + '...');
    } else {
      embed.setDescription(response.text);
    }

    // Add fields for specific response types
    if (responseType === 'price' && response.metadata) {
      embed.addFields([
        { name: 'Symbol', value: response.metadata.symbol || 'N/A', inline: true },
        { name: 'Price', value: `$${response.metadata.price?.toLocaleString() || 'N/A'}`, inline: true },
        { name: 'Confidence', value: `${Math.round((response.metadata.confidence || 0) * 100)}%`, inline: true }
      ]);
    }

    if (responseType === 'weather' && response.metadata) {
      embed.addFields([
        { name: 'Location', value: response.metadata.location || 'N/A', inline: true },
        { name: 'Temperature', value: `${response.metadata.temperature || 'N/A'}°C`, inline: true },
        { name: 'Confidence', value: `${Math.round((response.metadata.confidence || 0) * 100)}%`, inline: true }
      ]);
    }

    return embed;
  }

  /**
   * Send announcement to all allowed channels
   */
  async sendAnnouncement(message: string): Promise<void> {
    if (this.allowedChannels.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('📢 Oracle System Announcement')
      .setDescription(message)
      .setColor(0x0099FF)
      .setTimestamp();

    for (const channelId of this.allowedChannels) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.warn(`Failed to send announcement to channel ${channelId}:`, error.message);
      }
    }
  }

  /**
   * Get bot information
   */
  getBotInfo(): any {
    return {
      platform: 'discord',
      user: this.client.user?.tag,
      guilds: this.client.guilds.cache.size,
      uptime: this.client.uptime,
      allowedChannels: this.allowedChannels.length,
      isActive: this.isActive
    };
  }
}