import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  PrivateKey,
  AccountId,
  AccountBalanceQuery,
  Hbar
} from "@hashgraph/sdk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Hedera Consensus Service (HCS) Integration
 * Provides immutable logging and audit trail for oracle operations
 */
export class HCSService {
  private client: Client;
  private isInitialized = false;
  
  // Topic IDs for different log types
  private topicIds: {
    oracleQueries?: string;
    computeOperations?: string;
    accountOperations?: string;
    systemMetrics?: string;
  } = {};

  constructor() {
    // Initialize client for testnet
    this.client = Client.forTestnet();
  }

  /**
   * Initialize HCS service with operator credentials
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("🔧 Initializing Hedera Consensus Service...");

      // Set up operator (use Hedera-specific private key)
      const operatorId = process.env.HEDERA_ACCOUNT_ID;
      const operatorKey = process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY;

      if (!operatorKey) {
        throw new Error('PRIVATE_KEY is required for HCS integration');
      }

      // For testnet, we'll use a default account if HEDERA_ACCOUNT_ID is not set
      if (!operatorId) {
        console.log("⚠️ HEDERA_ACCOUNT_ID not set, using derived account from private key");
      }

      // Set operator with private key
      const privateKey = PrivateKey.fromStringECDSA(operatorKey);
      const accountId = operatorId ? AccountId.fromString(operatorId) : privateKey.publicKey.toAccountId(0, 0);
      
      this.client.setOperator(accountId, privateKey);

      // Test connection
      try {
        const accountInfo = await new AccountBalanceQuery()
          .setAccountId(accountId)
          .execute(this.client);
        console.log(`✅ HCS connected - Account balance: ${accountInfo.hbars.toString()}`);
      } catch (balanceError) {
        console.log("⚠️ Could not check account balance (continuing anyway)");
      }

      this.isInitialized = true;
      console.log("✅ Hedera Consensus Service initialized successfully");

    } catch (error: any) {
      console.error("❌ Failed to initialize HCS:", error.message);
      throw error;
    }
  }

  /**
   * Create topics for different types of logs
   */
  async createTopics(): Promise<void> {
    await this.initialize();

    try {
      console.log("🔄 Creating HCS topics...");

      // Create Oracle Queries topic
      if (!this.topicIds.oracleQueries) {
        const oracleTopicTx = await new TopicCreateTransaction()
          .setTopicMemo("Negravis - Oracle Query Audit Trail")
          .setMaxTransactionFee(new Hbar(2))
          .execute(this.client);

        const oracleReceipt = await oracleTopicTx.getReceipt(this.client);
        this.topicIds.oracleQueries = oracleReceipt.topicId?.toString();
        console.log(`✅ Oracle Queries Topic: ${this.topicIds.oracleQueries}`);
      }

      // Create Compute Operations topic
      if (!this.topicIds.computeOperations) {
        const computeTopicTx = await new TopicCreateTransaction()
          .setTopicMemo("Negravis - Compute Operations Log")
          .setMaxTransactionFee(new Hbar(2))
          .execute(this.client);

        const computeReceipt = await computeTopicTx.getReceipt(this.client);
        this.topicIds.computeOperations = computeReceipt.topicId?.toString();
        console.log(`✅ Compute Operations Topic: ${this.topicIds.computeOperations}`);
      }

      // Create Account Operations topic
      if (!this.topicIds.accountOperations) {
        const accountTopicTx = await new TopicCreateTransaction()
          .setTopicMemo("Negravis - Account Operations Log")
          .setMaxTransactionFee(new Hbar(2))
          .execute(this.client);

        const accountReceipt = await accountTopicTx.getReceipt(this.client);
        this.topicIds.accountOperations = accountReceipt.topicId?.toString();
        console.log(`✅ Account Operations Topic: ${this.topicIds.accountOperations}`);
      }

      // Create System Metrics topic
      if (!this.topicIds.systemMetrics) {
        const metricsTopicTx = await new TopicCreateTransaction()
          .setTopicMemo("Negravis - System Performance Metrics")
          .setMaxTransactionFee(new Hbar(2))
          .execute(this.client);

        const metricsReceipt = await metricsTopicTx.getReceipt(this.client);
        this.topicIds.systemMetrics = metricsReceipt.topicId?.toString();
        console.log(`✅ System Metrics Topic: ${this.topicIds.systemMetrics}`);
      }

      console.log("✅ All HCS topics created successfully");

    } catch (error: any) {
      console.error("❌ Failed to create HCS topics:", error.message);
      throw error;
    }
  }

  /**
   * Log oracle query operations
   */
  async logOracleQuery(data: {
    queryId: string;
    inputPrompt: string;
    aiResponse: string;
    model: string;
    provider: string;
    cost: number;
    executionTime: number;
    success: boolean;
  }): Promise<void> {
    await this.ensureTopicsExist();

    if (!this.topicIds.oracleQueries) {
      throw new Error('Oracle queries topic not initialized');
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'ORACLE_QUERY',
      ...data
    };

    try {
      const jsonMessage = JSON.stringify(logEntry);
      await this.submitMessage(this.topicIds.oracleQueries, jsonMessage);
      console.log(`📝 Oracle query logged to HCS: ${data.queryId}`);
    } catch (jsonError: any) {
      console.log(`⚠️ Oracle query JSON serialization failed: ${jsonError.message}`);
      // Try with simplified data
      const simpleLogEntry = {
        timestamp: logEntry.timestamp,
        type: 'ORACLE_QUERY',
        queryId: data.queryId,
        success: data.success,
        model: data.model,
        cost: data.cost
      };
      await this.submitMessage(this.topicIds.oracleQueries, JSON.stringify(simpleLogEntry));
      console.log(`📝 Oracle query logged to HCS (simplified): ${data.queryId}`);
    }
  }

  /**
   * Log compute operations
   */
  async logComputeOperation(data: {
    operationId: string;
    operationType: string;
    provider: string;
    startTime: string;
    endTime: string;
    status: 'started' | 'completed' | 'failed';
    gasUsed?: string;
    result?: string;
    error?: string;
  }): Promise<void> {
    await this.ensureTopicsExist();

    if (!this.topicIds.computeOperations) {
      throw new Error('Compute operations topic not initialized');
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'COMPUTE_OPERATION',
      ...data
    };

    try {
      const jsonMessage = JSON.stringify(logEntry);
      await this.submitMessage(this.topicIds.computeOperations, jsonMessage);
      console.log(`📝 Compute operation logged to HCS: ${data.operationId}`);
    } catch (jsonError: any) {
      console.log(`⚠️ Compute operation JSON serialization failed: ${jsonError.message}`);
      // Try with simplified data
      const simpleLogEntry = {
        timestamp: logEntry.timestamp,
        type: 'COMPUTE_OPERATION',
        operationId: data.operationId,
        status: data.status,
        provider: data.provider
      };
      await this.submitMessage(this.topicIds.computeOperations, JSON.stringify(simpleLogEntry));
      console.log(`📝 Compute operation logged to HCS (simplified): ${data.operationId}`);
    }
  }

  /**
   * Log account operations
   */
  async logAccountOperation(data: {
    operationId: string;
    accountId: string;
    operation: string;
    previousBalance?: string;
    newBalance?: string;
    transactionHash?: string;
    amount?: number;
    success: boolean;
  }): Promise<void> {
    await this.ensureTopicsExist();

    if (!this.topicIds.accountOperations) {
      throw new Error('Account operations topic not initialized');
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'ACCOUNT_OPERATION',
      ...data
    };

    await this.submitMessage(this.topicIds.accountOperations, JSON.stringify(logEntry));
    console.log(`📝 Account operation logged to HCS: ${data.operationId}`);
  }

  /**
   * Log system performance metrics
   */
  async logSystemMetrics(data: {
    endpoint: string;
    method: string;
    responseTime: number;
    statusCode: number;
    userAgent?: string;
    requestId: string;
    memoryUsage?: NodeJS.MemoryUsage;
  }): Promise<void> {
    await this.ensureTopicsExist();

    if (!this.topicIds.systemMetrics) {
      throw new Error('System metrics topic not initialized');
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SYSTEM_METRICS',
      ...data
    };

    await this.submitMessage(this.topicIds.systemMetrics, JSON.stringify(logEntry));
    console.log(`📊 System metrics logged to HCS: ${data.requestId}`);
  }

  /**
   * Submit message to HCS topic
   */
  private async submitMessage(topicId: string, message: string): Promise<void> {
    try {
      // Clean and validate JSON message
      const cleanMessage = message.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters
      
      const submitTx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(cleanMessage)
        .setMaxTransactionFee(new Hbar(1))
        .execute(this.client);

      const receipt = await submitTx.getReceipt(this.client);
      console.log(`💾 HCS message submitted to topic ${topicId} - Sequence: ${receipt.topicSequenceNumber}`);
    } catch (error: any) {
      console.error(`❌ Failed to submit message to HCS topic ${topicId}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure all topics exist, create them if they don't
   */
  private async ensureTopicsExist(): Promise<void> {
    if (!this.topicIds.oracleQueries || !this.topicIds.computeOperations || 
        !this.topicIds.accountOperations || !this.topicIds.systemMetrics) {
      await this.createTopics();
    }
  }

  /**
   * Get topic IDs for external use
   */
  getTopicIds(): typeof this.topicIds {
    return { ...this.topicIds };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const hcsService = new HCSService();

// Export convenience functions
export async function logOracleQuery(data: Parameters<HCSService['logOracleQuery']>[0]) {
  return await hcsService.logOracleQuery(data);
}

export async function logComputeOperation(data: Parameters<HCSService['logComputeOperation']>[0]) {
  return await hcsService.logComputeOperation(data);
}

export async function logAccountOperation(data: Parameters<HCSService['logAccountOperation']>[0]) {
  return await hcsService.logAccountOperation(data);
}

export async function logSystemMetrics(data: Parameters<HCSService['logSystemMetrics']>[0]) {
  return await hcsService.logSystemMetrics(data);
}