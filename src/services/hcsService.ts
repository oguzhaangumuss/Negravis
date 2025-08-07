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
interface HCSTransaction {
  transactionId: string;
  topicId: string;
  type: 'ORACLE_QUERY' | 'COMPUTE_OPERATION' | 'ACCOUNT_OPERATION' | 'SYSTEM_METRICS';
  timestamp: string;
  sequenceNumber?: bigint;
  data: any;
}

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

  // Store recent transactions for frontend
  private recentTransactions: HCSTransaction[] = [];

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
        throw new Error('HEDERA_PRIVATE_KEY is required for HCS integration');
      }

      // For testnet, we'll use a default account if HEDERA_ACCOUNT_ID is not set
      if (!operatorId) {
        console.log("⚠️ HEDERA_ACCOUNT_ID not set, using derived account from private key");
      }

      try {
        // Set operator with private key - handle different formats
        let privateKey: PrivateKey;
        
        // Clean the key string first
        let cleanKey = operatorKey.trim();
        
        try {
          // Handle ECDSA hex format (0x prefix)
          if (cleanKey.startsWith('0x')) {
            // Remove 0x prefix for ECDSA parsing
            const hexKey = cleanKey.slice(2);
            console.log(`🔧 Parsing ECDSA key (removed 0x prefix), length: ${hexKey.length}`);
            privateKey = PrivateKey.fromStringECDSA(hexKey);
          } 
          // Handle potential hex format without 0x (64 chars = ECDSA)
          else if (cleanKey.length === 64 && /^[0-9a-fA-F]+$/.test(cleanKey)) {
            console.log(`🔧 Parsing ECDSA key (64 char hex), length: ${cleanKey.length}`);
            privateKey = PrivateKey.fromStringECDSA(cleanKey);
          }
          // Handle DER format (starts with 30 and longer than 64 chars)
          else if (cleanKey.length > 64) {
            console.log(`🔧 Parsing DER format key, length: ${cleanKey.length}`);
            try {
              // Try ED25519 DER format first (most common in Hedera)
              privateKey = PrivateKey.fromStringED25519(cleanKey);
            } catch (ed25519Error) {
              // Fall back to ECDSA DER format
              privateKey = PrivateKey.fromStringECDSA(cleanKey);
            }
          }
          // Default fallback to general parsing
          else {
            console.log(`🔧 Using general private key parsing, length: ${cleanKey.length}`);
            privateKey = PrivateKey.fromString(cleanKey);
          }
        } catch (keyParseError: any) {
          console.log(`⚠️ Key parse error: ${keyParseError.message}`);
          console.log(`🔧 Trying fallback parsing strategies...`);
          
          // Fallback strategy 1: Try without 0x prefix if present
          if (cleanKey.startsWith('0x')) {
            const hexKey = cleanKey.slice(2);
            try {
              privateKey = PrivateKey.fromStringECDSA(hexKey);
              console.log(`✅ Fallback 1 successful: ECDSA without 0x prefix`);
            } catch (fallback1Error) {
              // Fallback strategy 2: Try general parsing
              try {
                privateKey = PrivateKey.fromString(cleanKey);
                console.log(`✅ Fallback 2 successful: General parsing`);
              } catch (fallback2Error) {
                console.error(`❌ All key parsing strategies failed:`);
                console.error(`Original error: ${keyParseError.message}`);
                console.error(`Fallback 1 error: ${fallback1Error instanceof Error ? fallback1Error.message : String(fallback1Error)}`);
                console.error(`Fallback 2 error: ${fallback2Error instanceof Error ? fallback2Error.message : String(fallback2Error)}`);
                throw new Error(`Failed to parse private key: ${keyParseError.message}`);
              }
            }
          } else {
            // Try ECDSA parsing as last resort
            try {
              privateKey = PrivateKey.fromStringECDSA(cleanKey);
              console.log(`✅ Fallback ECDSA parsing successful`);
            } catch (finalError) {
              console.error(`❌ Final key parsing attempt failed: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
              throw new Error(`Failed to parse private key with all strategies: ${keyParseError.message}`);
            }
          }
        }
        
        const accountId = operatorId ? AccountId.fromString(operatorId) : privateKey.publicKey.toAccountId(0, 0);
        
        console.log(`🔑 Using account: ${accountId.toString()}`);
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
      } catch (credentialError) {
        console.error(`❌ Failed to initialize with credentials: ${credentialError instanceof Error ? credentialError.message : String(credentialError)}`);
        throw credentialError;
      }

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
  private async submitMessage(topicId: string, message: string): Promise<string> {
    try {
      // Clean and validate JSON message
      const cleanMessage = message.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters
      
      const submitTx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(cleanMessage)
        .setMaxTransactionFee(new Hbar(1))
        .execute(this.client);

      const receipt = await submitTx.getReceipt(this.client);
      const transactionId = submitTx.transactionId?.toString() || 'unknown';
      
      // Store transaction for frontend access
      const sequenceNumber = receipt.topicSequenceNumber ? BigInt(receipt.topicSequenceNumber.toString()) : undefined;
      this.storeTransaction(transactionId, topicId, message, sequenceNumber);
      
      console.log(`💾 HCS message submitted to topic ${topicId} - Sequence: ${receipt.topicSequenceNumber} - TX: ${transactionId}`);
      return transactionId;
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
   * Store transaction for frontend access
   */
  private storeTransaction(transactionId: string, topicId: string, message: string, sequenceNumber?: bigint): void {
    try {
      const messageData = JSON.parse(message);
      const transaction: HCSTransaction = {
        transactionId,
        topicId,
        type: messageData.type || 'ORACLE_QUERY',
        timestamp: messageData.timestamp || new Date().toISOString(),
        sequenceNumber,
        data: messageData
      };

      // Add to recent transactions (keep last 50)
      this.recentTransactions.unshift(transaction);
      if (this.recentTransactions.length > 50) {
        this.recentTransactions = this.recentTransactions.slice(0, 50);
      }
    } catch (error) {
      console.error('Failed to parse and store transaction:', error);
    }
  }

  /**
   * Get recent HCS transactions for frontend
   */
  getRecentTransactions(limit: number = 10): HCSTransaction[] {
    return this.recentTransactions.slice(0, limit);
  }

  /**
   * Get transactions by type
   */
  getTransactionsByType(type: 'ORACLE_QUERY' | 'COMPUTE_OPERATION' | 'ACCOUNT_OPERATION' | 'SYSTEM_METRICS', limit: number = 10): HCSTransaction[] {
    return this.recentTransactions
      .filter(tx => tx.type === type)
      .slice(0, limit);
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