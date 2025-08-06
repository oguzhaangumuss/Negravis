import { 
  Client, 
  TopicId, 
  TopicCreateTransaction, 
  TopicMessageSubmitTransaction,
  TransactionId,
  Status
} from '@hashgraph/sdk';
import { ConsensusResult, HCSLogEntry, OracleQuery } from '../../types/oracle';

/**
 * Hedera Consensus Service Oracle Logger
 * Provides immutable logging of oracle queries and results to HCS
 */
export class HederaOracleLogger {
  private client: Client;
  private topicId: TopicId | null = null;
  private isInitialized = false;
  private batchSize: number = 10;
  private batch: HCSLogEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(
    private accountId: string,
    private privateKey: string,
    private network: 'testnet' | 'mainnet' = 'testnet',
    topicId?: string
  ) {
    this.initializeClient();
    if (topicId) {
      this.topicId = TopicId.fromString(topicId);
      this.isInitialized = true;
    }
  }

  /**
   * Initialize Hedera client
   */
  private initializeClient(): void {
    if (this.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }

    this.client.setOperator(this.accountId, this.privateKey);
  }

  /**
   * Create HCS topic for oracle logging
   */
  async createTopic(memo?: string): Promise<string> {
    if (this.topicId) {
      throw new Error('Topic already exists or is set');
    }

    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo(memo || 'Oracle System Logging Topic')
        .setAdminKey(this.client.operatorPublicKey!)
        .setSubmitKey(this.client.operatorPublicKey!);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Topic creation failed with status: ${receipt.status}`);
      }

      this.topicId = receipt.topicId!;
      this.isInitialized = true;

      console.log(`HCS Topic created: ${this.topicId.toString()}`);
      return this.topicId.toString();

    } catch (error) {
      throw new Error(`Failed to create HCS topic: ${error.message}`);
    }
  }

  /**
   * Log oracle query and result to HCS
   */
  async logOracleResult(
    query: OracleQuery,
    result: ConsensusResult
  ): Promise<string> {
    if (!this.isInitialized || !this.topicId) {
      throw new Error('HCS Logger not initialized. Call createTopic() or provide topicId in constructor');
    }

    const logEntry: HCSLogEntry = {
      query_id: query.id,
      query: query.query,
      result: {
        ...result,
        raw_responses: result.raw_responses.map(r => ({
          ...r,
          // Remove large metadata to reduce message size
          metadata: r.metadata ? { latency: r.metadata.latency } : undefined
        }))
      },
      hcs_timestamp: new Date().toISOString(),
      transaction_id: ''
    };

    try {
      // For immediate logging
      if (this.batchSize === 1) {
        return await this.submitSingleLog(logEntry);
      }

      // For batch logging
      return this.addToBatch(logEntry);

    } catch (error) {
      throw new Error(`Failed to log oracle result to HCS: ${error.message}`);
    }
  }

  /**
   * Submit single log entry to HCS
   */
  private async submitSingleLog(logEntry: HCSLogEntry): Promise<string> {
    const messageData = JSON.stringify(logEntry);
    
    // HCS message size limit is 1024 bytes
    if (Buffer.byteLength(messageData, 'utf8') > 1024) {
      throw new Error('Log entry too large for HCS message (max 1024 bytes)');
    }

    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(this.topicId!)
      .setMessage(messageData);

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);

    if (receipt.status !== Status.Success) {
      throw new Error(`HCS message submission failed with status: ${receipt.status}`);
    }

    const transactionId = response.transactionId.toString();
    logEntry.transaction_id = transactionId;

    console.log(`Oracle result logged to HCS: ${transactionId}`);
    return transactionId;
  }

  /**
   * Add log entry to batch
   */
  private addToBatch(logEntry: HCSLogEntry): string {
    this.batch.push(logEntry);

    // Schedule batch submission if not already scheduled
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.submitBatch();
      }, 5000); // 5 second batch window
    }

    // Submit batch if it reaches batch size
    if (this.batch.length >= this.batchSize) {
      this.submitBatch();
    }

    return `batch:${this.batch.length}`;
  }

  /**
   * Submit batch of log entries
   */
  private async submitBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const batchToSubmit = [...this.batch];
    this.batch = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      // Create batch message
      const batchMessage = {
        type: 'oracle_batch',
        timestamp: new Date().toISOString(),
        entries: batchToSubmit.map(entry => ({
          ...entry,
          // Further compress for batch
          result: {
            value: entry.result.value,
            confidence: entry.result.confidence,
            method: entry.result.method,
            sources: entry.result.sources,
            timestamp: entry.result.timestamp
          }
        }))
      };

      const messageData = JSON.stringify(batchMessage);

      // Split into multiple messages if too large
      const maxSize = 1000; // Leave some buffer
      if (Buffer.byteLength(messageData, 'utf8') > maxSize) {
        await this.submitLargeBatch(batchToSubmit);
      } else {
        await this.submitSingleBatchMessage(batchMessage);
      }

      console.log(`Batch of ${batchToSubmit.length} oracle results logged to HCS`);

    } catch (error) {
      console.error('Failed to submit oracle log batch:', error.message);
      // Re-add failed entries to batch for retry
      this.batch.unshift(...batchToSubmit);
    }
  }

  /**
   * Submit large batch by splitting into multiple messages
   */
  private async submitLargeBatch(entries: HCSLogEntry[]): Promise<void> {
    const chunkSize = Math.max(1, Math.floor(this.batchSize / 2));
    
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const chunkMessage = {
        type: 'oracle_batch_chunk',
        chunk_index: Math.floor(i / chunkSize),
        total_chunks: Math.ceil(entries.length / chunkSize),
        timestamp: new Date().toISOString(),
        entries: chunk.map(entry => ({
          query_id: entry.query_id,
          value: entry.result.value,
          confidence: entry.result.confidence,
          sources: entry.result.sources
        }))
      };

      await this.submitSingleBatchMessage(chunkMessage);
    }
  }

  /**
   * Submit single batch message
   */
  private async submitSingleBatchMessage(message: any): Promise<void> {
    const messageData = JSON.stringify(message);
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(this.topicId!)
      .setMessage(messageData);

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);

    if (receipt.status !== Status.Success) {
      throw new Error(`HCS batch submission failed with status: ${receipt.status}`);
    }
  }

  /**
   * Log oracle provider health status
   */
  async logHealthStatus(
    providerName: string,
    isHealthy: boolean,
    metrics?: any
  ): Promise<void> {
    if (!this.isInitialized || !this.topicId) return;

    const healthLog = {
      type: 'health_check',
      provider: providerName,
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      metrics: metrics || {}
    };

    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(this.topicId)
        .setMessage(JSON.stringify(healthLog));

      await transaction.execute(this.client);
      console.log(`Health status logged for ${providerName}: ${isHealthy}`);

    } catch (error) {
      console.error(`Failed to log health status for ${providerName}:`, error.message);
    }
  }

  /**
   * Set batch configuration
   */
  setBatchConfig(batchSize: number): void {
    this.batchSize = Math.max(1, Math.min(50, batchSize)); // Limit batch size
  }

  /**
   * Get topic information
   */
  getTopicInfo(): { topicId: string | null; isInitialized: boolean } {
    return {
      topicId: this.topicId?.toString() || null,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Force submit pending batch
   */
  async flushBatch(): Promise<void> {
    if (this.batch.length > 0) {
      await this.submitBatch();
    }
  }

  /**
   * Close client and flush pending logs
   */
  async close(): Promise<void> {
    await this.flushBatch();
    this.client.close();
  }
}