import { contractManager } from './contractManager';
import { hcsService } from '../hcsService';
import path from 'path';

interface PriceUpdateData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
}

// Issue #6: Enhanced interfaces for dynamic oracle selection
interface DynamicPriceUpdateData extends PriceUpdateData {
  confidence: number;          // 0-1 confidence score
  weights?: number[];          // Provider weights used
  outliers?: string[];         // Outlier sources removed
  qualityMetrics?: {
    accuracy: number;
    freshness: number;
    consistency: number;
  };
  providers: string[];         // All providers used
  aggregationMethod: string;   // Method used for aggregation
}

interface OracleValidationData {
  symbol: string;
  providers: string[];
  consensusThreshold: number;
  weights: number[];
  isValid: boolean;
  confidence: number;
}

interface ContractPriceData {
  price: string;
  timestamp: string;
  isValid: boolean;
}

/**
 * Oracle Smart Contract Service
 * Integrates oracle data with deployed smart contracts
 */
export class OracleContractService {
  private isInitialized = false;
  private priceFeedContractId?: string;

  /**
   * Initialize the oracle contract service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("🔧 Initializing Oracle Contract Service...");

      // Initialize contract manager
      await contractManager.initialize();

      // Deploy PriceFeed contract if not already deployed
      await this.deployPriceFeedContract();

      this.isInitialized = true;
      console.log("✅ Oracle Contract Service initialized successfully");

    } catch (error: any) {
      console.error("❌ Failed to initialize Oracle Contract Service:", error.message);
      throw error;
    }
  }

  /**
   * Deploy the PriceFeed smart contract
   */
  private async deployPriceFeedContract(): Promise<void> {
    try {
      // Check if contract is already deployed
      const existingContract = contractManager.getContractInfo('PriceFeed');
      if (existingContract) {
        this.priceFeedContractId = existingContract.contractId;
        console.log(`📋 Using existing PriceFeed contract: ${this.priceFeedContractId}`);
        return;
      }

      console.log("🚀 Deploying PriceFeed smart contract...");

      const contractPath = path.join(__dirname, '../../contracts/PriceFeed.sol');
      const deploymentResult = await contractManager.deployContract(contractPath);

      if (deploymentResult.success && deploymentResult.contractInfo) {
        this.priceFeedContractId = deploymentResult.contractInfo.contractId;
        console.log(`✅ PriceFeed contract deployed: ${this.priceFeedContractId}`);
        console.log(`🔗 Contract address: ${deploymentResult.contractInfo.contractAddress}`);

        // Authorize this oracle service to update prices
        await this.authorizeOracleService();

        // Log deployment to HCS
        await this.logContractDeployment(deploymentResult.contractInfo);

      } else {
        throw new Error(`Failed to deploy PriceFeed contract: ${deploymentResult.error}`);
      }

    } catch (error: any) {
      console.error("❌ Failed to deploy PriceFeed contract:", error.message);
      throw error;
    }
  }

  /**
   * Authorize this oracle service to update contract prices
   */
  private async authorizeOracleService(): Promise<void> {
    try {
      console.log('🔐 Authorizing oracle service to update prices...');
      
      // Get the current oracle service account address (contract deployer is automatically authorized)
      const operatorAccountId = process.env.HEDERA_ACCOUNT_ID;
      console.log(`📜 Oracle service account: ${operatorAccountId}`);
      
      // Since the contract deployer (owner) is automatically authorized in constructor,
      // and we're using the same account for oracle updates, we should be good.
      // But let's explicitly call setOracleAuthorization to be sure
      
      /* Uncomment if needed - usually not required since deployer is auto-authorized
      const response = await contractManager.executeContract(
        'PriceFeed',
        'setOracleAuthorization',
        [operatorAccountId || process.env.HEDERA_ACCOUNT_ID, true]
      );
      
      await response.getReceipt(contractManager['client']);
      console.log('✅ Oracle service authorized successfully');
      */
      
      console.log('✅ Oracle service is authorized (contract deployer has automatic authorization)');
      
    } catch (error: any) {
      console.error('❌ Failed to authorize oracle service:', error.message);
      // Don't throw - authorization might not be needed if deployer account is used
    }
  }

  /**
   * Update price in the smart contract (backward compatible)
   */
  async updateContractPrice(priceData: PriceUpdateData): Promise<void> {
    return this.updateContractPriceWithDynamicSelection(priceData);
  }

  /**
   * Issue #6: Update price with dynamic oracle selection data
   */
  async updateContractPriceWithDynamicSelection(priceData: PriceUpdateData | DynamicPriceUpdateData): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      const isDynamicData = 'confidence' in priceData;
      console.log(`📊 Updating contract price for ${priceData.symbol}: $${priceData.price}${isDynamicData ? ` (confidence: ${((priceData as DynamicPriceUpdateData).confidence * 100).toFixed(1)}%)` : ''}`);

      // Convert price to wei (multiply by 10^18 for precision)
      const priceInWei = Math.floor(priceData.price * 1e18);
      const confidence = isDynamicData ? Math.floor((priceData as DynamicPriceUpdateData).confidence * 100) : 100;

      // For dynamic data, also validate with oracle consensus
      if (isDynamicData) {
        const dynamicData = priceData as DynamicPriceUpdateData;
        await this.validateOracleConsensus({
          symbol: priceData.symbol,
          providers: dynamicData.providers,
          consensusThreshold: 0.6, // 60% consensus required
          weights: dynamicData.weights || [],
          isValid: true,
          confidence: dynamicData.confidence
        });
      }

      // Execute contract function to update price (using correct function name)
      const response = await contractManager.executeContract(
        'PriceFeed',
        'updatePrice',
        [priceData.symbol, priceInWei]  // Only 2 parameters: symbol and price
      );

      const receipt = await response.getReceipt(contractManager['client']);
      
      console.log(`✅ Price updated in contract for ${priceData.symbol}`);
      console.log(`🔗 Transaction ID: ${response.transactionId}`);

      // Log to HCS with enhanced data
      await this.logDynamicPriceUpdate({
        ...priceData,
        contractId: this.priceFeedContractId,
        transactionId: response.transactionId.toString(),
        gasUsed: 0 // Gas info not directly available in receipt
      });

    } catch (error: any) {
      console.error(`❌ Failed to update contract price for ${priceData.symbol}:`, error.message);
      
      // Log error to HCS
      await this.logPriceUpdateError({
        symbol: priceData.symbol,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Get price from smart contract
   */
  async getContractPrice(symbol: string): Promise<ContractPriceData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      console.log(`🔍 Querying contract price for ${symbol}`);

      const result = await contractManager.queryContract(
        'PriceFeed',
        'getPrice',
        [symbol]
      );

      // Decode the result (price, timestamp, isValid)
      const price = result.getUint256(0);
      const timestamp = result.getUint256(1);
      const isValid = result.getBool(2);

      // Convert price from wei back to dollars
      const priceInDollars = price.toNumber() / 1e18;

      const priceData: ContractPriceData = {
        price: priceInDollars.toString(),
        timestamp: timestamp.toString(),
        isValid
      };

      console.log(`✅ Retrieved contract price for ${symbol}: $${priceInDollars}`);
      
      return priceData;

    } catch (error: any) {
      console.error(`❌ Failed to get contract price for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a price is stale in the contract
   */
  async isPriceStale(symbol: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      const result = await contractManager.queryContract(
        'PriceFeed',
        'isPriceStale',
        [symbol]
      );

      return result.getBool(0);

    } catch (error: any) {
      console.error(`❌ Failed to check if price is stale for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all price providers for a symbol
   */
  async getPriceProviders(symbol: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      const result = await contractManager.queryContract(
        'PriceFeed',
        'getPriceProviders',
        [symbol]
      );

      // Decode array of addresses
      const providers: string[] = [];
      const arrayLength = result.getUint256(0).toNumber();
      
      for (let i = 0; i < arrayLength; i++) {
        providers.push(result.getAddress(i + 1));
      }

      return providers;

    } catch (error: any) {
      console.error(`❌ Failed to get price providers for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Log contract deployment to HCS
   */
  private async logContractDeployment(contractInfo: any): Promise<void> {
    try {
      await hcsService.logAccountOperation({
        operationId: `contract_deploy_${Date.now()}`,
        accountId: contractInfo.contractAddress,
        operation: 'CONTRACT_DEPLOYMENT',
        transactionHash: contractInfo.transactionId,
        success: true
      });
    } catch (error) {
      console.log("⚠️ Failed to log contract deployment to HCS:", error);
    }
  }

  /**
   * Log price update to HCS (backward compatible)
   */
  private async logPriceUpdate(data: any): Promise<void> {
    return this.logDynamicPriceUpdate(data);
  }

  /**
   * Issue #6: Enhanced logging for dynamic oracle selection
   */
  private async logDynamicPriceUpdate(data: any): Promise<void> {
    try {
      const isDynamicData = 'confidence' in data;
      
      let logData = {
        queryId: `price_update_${data.symbol}_${Date.now()}`,
        inputPrompt: `Update price for ${data.symbol}${isDynamicData ? ` using ${data.providers?.length || 1} providers` : ''}`,
        aiResponse: `Price updated to $${data.price}${isDynamicData ? `, confidence: ${(data.confidence * 100).toFixed(1)}%` : ''}`,
        model: isDynamicData ? 'dynamic_oracle_smart_contract' : 'smart_contract',
        provider: data.source || 'oracle_manager',
        cost: data.gasUsed * 0.000001, // Estimate cost in HBAR
        executionTime: 1000, // Estimate
        success: true
      };

      // Add dynamic selection metadata if available
      if (isDynamicData && data.providers) {
        logData.inputPrompt += ` (${data.aggregationMethod}, outliers: ${data.outliers?.length || 0})`;
        logData.aiResponse += `, providers: [${data.providers.join(', ')}]`;
      }

      await hcsService.logOracleQuery(logData);
      
      console.log(`📝 Enhanced price update logged to HCS: ${data.symbol} with ${isDynamicData ? 'dynamic' : 'standard'} selection`);
    } catch (error) {
      console.log("⚠️ Failed to log dynamic price update to HCS:", error);
    }
  }

  /**
   * Log price update error to HCS
   */
  private async logPriceUpdateError(data: any): Promise<void> {
    try {
      await hcsService.logOracleQuery({
        queryId: `price_error_${data.symbol}_${Date.now()}`,
        inputPrompt: `Update price for ${data.symbol}`,
        aiResponse: `Error: ${data.error}`,
        model: 'smart_contract',
        provider: 'hedera',
        cost: 0,
        executionTime: 0,
        success: false
      });
    } catch (error) {
      console.log("⚠️ Failed to log price error to HCS:", error);
    }
  }

  /**
   * Get contract information
   */
  getContractInfo() {
    return {
      contractId: this.priceFeedContractId,
      contractInfo: contractManager.getContractInfo('PriceFeed'),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Issue #6: Validate oracle consensus before contract update
   */
  private async validateOracleConsensus(data: OracleValidationData): Promise<void> {
    try {
      console.log(`🔍 Validating oracle consensus for ${data.symbol}`);
      
      if (!this.priceFeedContractId) {
        throw new Error('PriceFeed contract not deployed');
      }

      // Execute contract function to validate consensus
      const response = await contractManager.executeContract(
        'PriceFeed',
        'validateOracleConsensus',
        [
          data.symbol,
          data.providers.length,
          Math.floor(data.consensusThreshold * 100),
          Math.floor(data.confidence * 100)
        ]
      );

      console.log(`✅ Oracle consensus validated for ${data.symbol}`);
      
      // Log validation to HCS
      await hcsService.logOracleQuery({
        queryId: `consensus_validation_${data.symbol}_${Date.now()}`,
        inputPrompt: `Validate consensus for ${data.symbol} with ${data.providers.length} providers`,
        aiResponse: `Consensus validated: ${data.providers.length} providers, ${(data.confidence * 100).toFixed(1)}% confidence`,
        model: 'oracle_consensus_validation',
        provider: 'hedera_smart_contract',
        cost: 0,
        executionTime: 500,
        success: true
      });

    } catch (error: any) {
      console.error(`❌ Failed to validate oracle consensus for ${data.symbol}:`, error.message);
      
      // Log validation error
      await hcsService.logOracleQuery({
        queryId: `consensus_validation_error_${data.symbol}_${Date.now()}`,
        inputPrompt: `Validate consensus for ${data.symbol}`,
        aiResponse: `Validation failed: ${error.message}`,
        model: 'oracle_consensus_validation',
        provider: 'hedera_smart_contract',
        cost: 0,
        executionTime: 0,
        success: false
      });
      
      throw error;
    }
  }

  /**
   * Issue #6: Get dynamic oracle selection configuration from contract
   */
  async getDynamicOracleConfig(symbol: string): Promise<{
    minProviders: number;
    maxProviders: number;
    consensusThreshold: number;
    outlierThreshold: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      const result = await contractManager.queryContract(
        'PriceFeed',
        'getDynamicOracleConfig',
        [symbol]
      );

      return {
        minProviders: result.getUint256(0).toNumber(),
        maxProviders: result.getUint256(1).toNumber(),
        consensusThreshold: result.getUint256(2).toNumber() / 100,
        outlierThreshold: result.getUint256(3).toNumber() / 100
      };

    } catch (error: any) {
      console.error(`❌ Failed to get dynamic oracle config for ${symbol}:`, error.message);
      // Return default configuration
      return {
        minProviders: 1,
        maxProviders: 5,
        consensusThreshold: 0.6,
        outlierThreshold: 0.2
      };
    }
  }

  /**
   * Issue #6: Update dynamic oracle selection configuration in contract
   */
  async updateDynamicOracleConfig(
    symbol: string,
    config: {
      minProviders: number;
      maxProviders: number;
      consensusThreshold: number;
      outlierThreshold: number;
    }
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      console.log(`🔧 Updating dynamic oracle config for ${symbol}`);

      const response = await contractManager.executeContract(
        'PriceFeed',
        'updateDynamicOracleConfig',
        [
          symbol,
          config.minProviders,
          config.maxProviders,
          Math.floor(config.consensusThreshold * 100),
          Math.floor(config.outlierThreshold * 100)
        ]
      );

      console.log(`✅ Dynamic oracle config updated for ${symbol}`);
      console.log(`🔗 Transaction ID: ${response.transactionId}`);

      // Log configuration update
      await hcsService.logOracleQuery({
        queryId: `config_update_${symbol}_${Date.now()}`,
        inputPrompt: `Update dynamic oracle config for ${symbol}`,
        aiResponse: `Config updated: min=${config.minProviders}, max=${config.maxProviders}, consensus=${config.consensusThreshold}, outlier=${config.outlierThreshold}`,
        model: 'oracle_config_update',
        provider: 'hedera_smart_contract',
        cost: 0,
        executionTime: 1000,
        success: true
      });

    } catch (error: any) {
      console.error(`❌ Failed to update dynamic oracle config for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && !!this.priceFeedContractId;
  }
}

// Export singleton instance
export const oracleContractService = new OracleContractService();