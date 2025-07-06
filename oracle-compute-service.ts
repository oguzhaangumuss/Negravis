import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Official 0G providers
const OFFICIAL_PROVIDERS = {
  "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3"
};

// Configuration
const FALLBACK_FEE = 0.01;
const INITIAL_FUND_AMOUNT = 0.1; // 0.1 OG tokens

// Multiple RPC endpoints for failover
const RPC_ENDPOINTS = [
  "https://evmrpc-testnet.0g.ai",
  "https://rpc-testnet.0g.ai",
  "https://solitary-dark-replica.0g-galileo.quiknode.pro/fa3c1846187697dfa72f19acdfffd0d0adb34064/"
];

// Types
export interface OracleResponse {
  success: boolean;
  response?: string;
  chatId?: string;
  cost?: number;
  error?: string;
  provider?: string;
  model?: string;
}

export interface OracleConfig {
  provider?: keyof typeof OFFICIAL_PROVIDERS;
  maxRetries?: number;
}

// Oracle Compute Service Class
export class OracleComputeService {
  private wallet: ethers.Wallet | null = null;
  private broker: any = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private connectedEndpoint: string | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize on first use
  }

  /**
   * Initialize the Oracle service with wallet and broker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("🔧 Initializing Oracle Compute Service...");
      
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('PRIVATE_KEY is required in .env file');
      }

      // Test RPC endpoints for connectivity
      console.log("⏳ Testing RPC endpoints for connectivity...");
      
      for (const endpoint of RPC_ENDPOINTS) {
        try {
          console.log(`🔍 Testing: ${endpoint}`);
          const testProvider = new ethers.JsonRpcProvider(endpoint);
          
          // Test connection with a simple call
          await testProvider.getNetwork();
          
          this.provider = testProvider;
          this.connectedEndpoint = endpoint;
          console.log(`✅ Connected to: ${endpoint}`);
          break;
        } catch (error: any) {
          console.log(`❌ Failed to connect to ${endpoint}: ${error.message}`);
          continue;
        }
      }
      
      if (!this.provider) {
        throw new Error('All RPC endpoints failed. Please check your internet connection or try again later.');
      }

      this.wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`✅ Wallet Address: ${this.wallet.address}`);
      console.log(`✅ Active RPC URL: ${this.connectedEndpoint}`);

      // Create broker instance
      console.log("⏳ Creating ZG Compute Network Broker...");
      this.broker = await createZGComputeNetworkBroker(this.wallet);
      console.log("✅ Broker created successfully");

      // Setup ledger account if needed
      await this.setupLedgerAccount();

      this.isInitialized = true;
      console.log("✅ Oracle Compute Service initialized successfully");

    } catch (error: any) {
      console.error("❌ Failed to initialize Oracle Compute Service:", error.message);
      throw error;
    }
  }

  /**
   * Setup or check ledger account
   */
  private async setupLedgerAccount(): Promise<void> {
    try {
      const ledgerInfo = await this.broker.ledger.getLedger();
      console.log("✅ Ledger account exists");
    } catch (error) {
      console.log("⚠️  Ledger account does not exist, creating...");
      await this.broker.ledger.addLedger(INITIAL_FUND_AMOUNT);
      console.log(`✅ Ledger created with ${INITIAL_FUND_AMOUNT} OG tokens`);
    }
  }

  /**
   * Get available AI models/providers
   */
  async getAvailableModels(): Promise<Array<{name: string, provider: string, description: string}>> {
    await this.initialize();
    
    try {
      const services = await this.broker.inference.listService();
      
      return Object.entries(OFFICIAL_PROVIDERS).map(([modelName, providerAddress]) => {
        const service = services.find((s: any) => s.provider === providerAddress);
        return {
          name: modelName,
          provider: providerAddress,
          description: service ? `Input: ${ethers.formatEther(service.inputPrice || 0)} OG, Output: ${ethers.formatEther(service.outputPrice || 0)} OG` : 'Pricing unavailable'
        };
      });
    } catch (error: any) {
      console.error("❌ Failed to get available models:", error.message);
      return [];
    }
  }

  /**
   * Process a query through the 0G Compute Network
   */
  async processQuery(
    query: string, 
    config: OracleConfig = {}
  ): Promise<OracleResponse> {
    try {
      await this.initialize();

      const selectedProviderName = config.provider || "llama-3.3-70b-instruct";
      const selectedProvider = OFFICIAL_PROVIDERS[selectedProviderName];
      
      if (!selectedProvider) {
        throw new Error(`Unknown provider: ${selectedProviderName}`);
      }

      console.log(`🎯 Processing query with ${selectedProviderName}`);
      console.log(`💬 Query: "${query}"`);

      // Get initial balance for cost calculation
      const initialLedger = await this.broker.ledger.getLedger();
      const initialBalance = parseFloat(ethers.formatEther(initialLedger.ledgerInfo[0]));

      // Acknowledge provider (only needed first time)
      try {
        await this.broker.inference.acknowledgeProviderSigner(selectedProvider);
        console.log("✅ Provider acknowledged");
      } catch (error: any) {
        if (error.message.includes('already acknowledged')) {
          console.log("✅ Provider already acknowledged");
        } else {
          throw error;
        }
      }

      // Get service metadata
      const { endpoint, model } = await this.broker.inference.getServiceMetadata(selectedProvider);
      console.log(`✅ Service Endpoint: ${endpoint}`);
      console.log(`✅ Model Name: ${model}`);

      // Generate authentication headers
      const headers = await this.broker.inference.getRequestHeaders(selectedProvider, query);
      console.log("✅ Authentication headers generated");

      // Create OpenAI client and send request
      const openai = new OpenAI({
        baseURL: endpoint,
        apiKey: "", // Empty string as per 0G docs
      });
      
      // Prepare headers for OpenAI client
      const requestHeaders: Record<string, string> = {};
      Object.entries(headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      });
      
      // Send the query
      const completion = await openai.chat.completions.create(
        {
          messages: [{ role: "user", content: query }],
          model: model,
        },
        {
          headers: requestHeaders,
        }
      );
      
      const aiResponse = completion.choices[0].message.content;
      const chatId = completion.id;
      
      console.log("✅ AI query completed successfully");
      console.log(`🤖 AI Response: ${aiResponse}`);

      // Process response and handle payment
      try {
        const isValid = await this.broker.inference.processResponse(
          selectedProvider,
          aiResponse || "",
          chatId
        );
        
        console.log(`🔍 Verification Status: ${isValid ? 'Valid' : 'Invalid'}`);
        
        if (isValid) {
          console.log("✅ Payment processed automatically");
        }
        
      } catch (paymentError: any) {
        console.log("⚠️  Payment processing failed:", paymentError.message);
      }

      // Calculate cost
      const finalLedger = await this.broker.ledger.getLedger();
      const finalBalance = parseFloat(ethers.formatEther(finalLedger.ledgerInfo[0]));
      const cost = initialBalance - finalBalance;

      return {
        success: true,
        response: aiResponse || "No response received",
        chatId: chatId,
        cost: cost > 0 ? cost : 0,
        provider: selectedProviderName,
        model: model
      };

    } catch (error: any) {
      console.error("❌ Query processing failed:", error.message);
      return {
        success: false,
        error: error.message,
        provider: config.provider
      };
    }
  }

  /**
   * Get current wallet balance and ledger info
   */
  async getAccountInfo(): Promise<{
    walletAddress?: string;
    ethBalance?: string;
    ledgerBalance?: string;
    connectedRPC?: string;
  }> {
    try {
      await this.initialize();
      
      if (!this.wallet || !this.provider) {
        throw new Error('Service not properly initialized');
      }

      const ethBalance = await this.provider.getBalance(this.wallet.address);
      const ledgerInfo = await this.broker.ledger.getLedger();
      const ledgerBalance = ethers.formatEther(ledgerInfo.ledgerInfo[0]);

      return {
        walletAddress: this.wallet.address,
        ethBalance: ethers.formatEther(ethBalance),
        ledgerBalance: ledgerBalance,
        connectedRPC: this.connectedEndpoint || 'Unknown'
      };
    } catch (error: any) {
      console.error("❌ Failed to get account info:", error.message);
      return {};
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.wallet !== null && this.broker !== null;
  }
}

// Export singleton instance
export const oracleService = new OracleComputeService();

// Export convenience functions
export async function queryOracle(
  query: string, 
  config?: OracleConfig
): Promise<OracleResponse> {
  return await oracleService.processQuery(query, config);
}

export async function getOracleModels() {
  return await oracleService.getAvailableModels();
}

export async function getOracleAccountInfo() {
  return await oracleService.getAccountInfo();
}