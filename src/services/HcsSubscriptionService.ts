import { Client, TopicId, TopicMessageQuery, TopicMessage } from '@hashgraph/sdk';

/**
 * HCS Topic Subscription Service
 * Provides real-time subscription to HCS topics for immediate transaction display
 */
export interface HcsMessage {
  transactionId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  contents: string;
  topicId: string;
}

export interface HcsSubscriptionConfig {
  topicId: string;
  network: 'testnet' | 'mainnet';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export class HcsSubscriptionService {
  private client: Client;
  private subscriptions: Map<string, any> = new Map();
  private messageHandlers: Map<string, (message: HcsMessage) => void> = new Map();

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    if (network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
  }

  /**
   * Subscribe to HCS topic messages for real-time transaction lookup
   */
  async subscribeToTopic(
    config: HcsSubscriptionConfig,
    onMessage: (message: HcsMessage) => void,
    onError?: (error: Error) => void
  ): Promise<string> {
    try {
      const topicId = TopicId.fromString(config.topicId);
      const subscriptionId = `${config.topicId}-${Date.now()}`;
      
      console.log(`🔔 Subscribing to HCS topic: ${config.topicId}`);
      
      const query = new TopicMessageQuery().setTopicId(topicId);
      
      if (config.startTime) {
        query.setStartTime(config.startTime);
      }
      
      if (config.endTime) {
        query.setEndTime(config.endTime);
      }
      
      if (config.limit) {
        query.setLimit(config.limit);
      }

      const subscription = query.subscribe(
        this.client,
        (message: TopicMessage | null, error: Error) => {
          if (error) {
            console.error(`❌ HCS subscription error for topic ${config.topicId}:`, error);
            if (onError) {
              onError(error);
            }
            return;
          }

          if (!message) {
            console.warn(`⚠️ Received null message on topic ${config.topicId}`);
            return;
          }

          try {
            const hcsMessage: HcsMessage = {
              transactionId: message.initialTransactionId?.toString() || '',
              sequenceNumber: message.sequenceNumber?.toNumber() || 0,
              consensusTimestamp: message.consensusTimestamp?.toString() || '',
              contents: message.contents ? new TextDecoder().decode(message.contents) : '',
              topicId: config.topicId
            };
            
            console.log(`📨 HCS Message received on topic ${config.topicId}:`, {
              transactionId: hcsMessage.transactionId,
              sequenceNumber: hcsMessage.sequenceNumber,
              timestamp: hcsMessage.consensusTimestamp
            });
            
            onMessage(hcsMessage);
          } catch (messageError: any) {
            console.error('Error processing HCS message:', messageError);
            if (onError) {
              onError(new Error(`Failed to process HCS message: ${messageError.message}`));
            }
          }
        },
        (message: TopicMessage) => {
          // This is the actual message listener callback
          try {
            const hcsMessage: HcsMessage = {
              transactionId: message.initialTransactionId?.toString() || '',
              sequenceNumber: message.sequenceNumber?.toNumber() || 0,
              consensusTimestamp: message.consensusTimestamp?.toString() || '',
              contents: message.contents ? new TextDecoder().decode(message.contents) : '',
              topicId: config.topicId
            };
            
            console.log(`📨 HCS Message received on topic ${config.topicId}:`, {
              transactionId: hcsMessage.transactionId,
              sequenceNumber: hcsMessage.sequenceNumber,
              timestamp: hcsMessage.consensusTimestamp
            });
            
            onMessage(hcsMessage);
          } catch (messageError: any) {
            console.error('Error processing HCS message:', messageError);
            if (onError) {
              onError(new Error(`Failed to process HCS message: ${messageError.message}`));
            }
          }
        }
      );

      this.subscriptions.set(subscriptionId, subscription);
      this.messageHandlers.set(subscriptionId, onMessage);
      
      console.log(`✅ Successfully subscribed to HCS topic ${config.topicId} with subscription ID: ${subscriptionId}`);
      return subscriptionId;

    } catch (error: any) {
      const errorMessage = `Failed to subscribe to HCS topic ${config.topicId}: ${error.message}`;
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Unsubscribe from a specific topic subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      try {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
        this.messageHandlers.delete(subscriptionId);
        console.log(`🔕 Unsubscribed from HCS topic subscription: ${subscriptionId}`);
      } catch (error: any) {
        console.error(`Failed to unsubscribe from ${subscriptionId}:`, error);
        throw new Error(`Failed to unsubscribe: ${error.message}`);
      }
    }
  }

  /**
   * Get recent messages from a topic (without subscription)
   */
  async getRecentMessages(
    topicId: string,
    startTime?: Date,
    limit: number = 10
  ): Promise<HcsMessage[]> {
    return new Promise((resolve, reject) => {
      const messages: HcsMessage[] = [];
      const timeoutMs = 10000; // 10 second timeout
      
      const query = new TopicMessageQuery().setTopicId(TopicId.fromString(topicId));
      
      if (startTime) {
        query.setStartTime(startTime);
      }
      
      query.setLimit(limit);

      console.log(`🔍 Fetching recent messages from HCS topic: ${topicId}`);

      const timeout = setTimeout(() => {
        console.log(`⏰ Timeout reached for HCS topic ${topicId}, returning ${messages.length} messages`);
        resolve(messages);
      }, timeoutMs);

      try {
        const subscription = query.subscribe(
          this.client,
          (message: TopicMessage | null, error: Error) => {
            if (error) {
              clearTimeout(timeout);
              console.error(`❌ Error fetching recent messages from ${topicId}:`, error);
              reject(new Error(`Failed to fetch recent messages: ${error.message}`));
              return;
            }
          },
          (message: TopicMessage) => {
            try {
              const hcsMessage: HcsMessage = {
                transactionId: message.initialTransactionId?.toString() || '',
                sequenceNumber: message.sequenceNumber?.toNumber() || 0,
                consensusTimestamp: message.consensusTimestamp?.toString() || '',
                contents: message.contents ? new TextDecoder().decode(message.contents) : '',
                topicId: topicId
              };
              
              messages.push(hcsMessage);
              
              if (messages.length >= limit) {
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(messages);
              }
            } catch (error: any) {
              console.error('Error processing message in getRecentMessages:', error);
            }
          }
        );

      } catch (error: any) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create message query: ${error.message}`));
      }
    });
  }

  /**
   * Find specific transaction message in HCS topic
   */
  async findTransactionMessage(
    topicId: string,
    transactionId: string,
    searchTimeRange: number = 3600000 // 1 hour in milliseconds
  ): Promise<HcsMessage | null> {
    return new Promise((resolve, reject) => {
      const startTime = new Date(Date.now() - searchTimeRange);
      const timeoutMs = 15000; // 15 second timeout
      
      console.log(`🔎 Searching for transaction ${transactionId} in HCS topic ${topicId}`);

      const timeout = setTimeout(() => {
        console.log(`⏰ Transaction search timeout for ${transactionId}`);
        resolve(null);
      }, timeoutMs);

      try {
        const query = new TopicMessageQuery()
          .setTopicId(TopicId.fromString(topicId))
          .setStartTime(startTime);

        const subscription = query.subscribe(
          this.client,
          (message: TopicMessage | null, error: Error) => {
            if (error) {
              clearTimeout(timeout);
              console.error(`❌ Error searching for transaction in ${topicId}:`, error);
              reject(new Error(`Failed to search transaction: ${error.message}`));
              return;
            }
          },
          (message: TopicMessage) => {
            try {
              const hcsMessage: HcsMessage = {
                transactionId: message.initialTransactionId?.toString() || '',
                sequenceNumber: message.sequenceNumber?.toNumber() || 0,
                consensusTimestamp: message.consensusTimestamp?.toString() || '',
                contents: message.contents ? new TextDecoder().decode(message.contents) : '',
                topicId: topicId
              };
              
              // Check if this message contains our transaction
              if (hcsMessage.transactionId === transactionId || 
                  hcsMessage.contents.includes(transactionId)) {
                clearTimeout(timeout);
                subscription.unsubscribe();
                console.log(`✅ Found transaction ${transactionId} in HCS topic ${topicId}`);
                resolve(hcsMessage);
              }
            } catch (error: any) {
              console.error('Error processing message in findTransactionMessage:', error);
            }
          }
        );

      } catch (error: any) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create transaction search query: ${error.message}`));
      }
    });
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Close all subscriptions and client
   */
  async close(): Promise<void> {
    console.log('🔕 Closing all HCS subscriptions...');
    
    // Unsubscribe from all topics
    for (const [subscriptionId, subscription] of this.subscriptions) {
      try {
        subscription.unsubscribe();
        console.log(`Closed subscription: ${subscriptionId}`);
      } catch (error: any) {
        console.error(`Error closing subscription ${subscriptionId}:`, error);
      }
    }
    
    this.subscriptions.clear();
    this.messageHandlers.clear();
    
    // Close client connection
    this.client.close();
    console.log('✅ HCS Subscription Service closed');
  }
}

// Export singleton instance
export const hcsSubscriptionService = new HcsSubscriptionService('testnet');