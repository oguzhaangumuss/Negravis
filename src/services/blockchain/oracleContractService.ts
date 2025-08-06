import { contractManager } from './contractManager';
import { hcsService } from '../hcsService';
import path from 'path';

interface PriceUpdateData {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
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
   * Update price in the smart contract
   */
  async updateContractPrice(priceData: PriceUpdateData): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.priceFeedContractId) {
      throw new Error('PriceFeed contract not deployed');
    }

    try {
      console.log(`📊 Updating contract price for ${priceData.symbol}: $${priceData.price}`);

      // Convert price to wei (multiply by 10^18 for precision)
      const priceInWei = Math.floor(priceData.price * 1e18);

      // Execute contract function to update price
      const response = await contractManager.executeContract(
        'PriceFeed',
        'updatePrice',
        [priceData.symbol, priceInWei]
      );

      const receipt = await response.getReceipt(contractManager['client']);
      
      console.log(`✅ Price updated in contract for ${priceData.symbol}`);
      console.log(`🔗 Transaction ID: ${response.transactionId}`);

      // Log to HCS
      await this.logPriceUpdate({
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
   * Log price update to HCS
   */
  private async logPriceUpdate(data: any): Promise<void> {
    try {
      await hcsService.logOracleQuery({
        queryId: `price_update_${data.symbol}_${Date.now()}`,
        inputPrompt: `Update price for ${data.symbol}`,
        aiResponse: `Price updated to $${data.price}`,
        model: 'smart_contract',
        provider: data.source,
        cost: data.gasUsed * 0.000001, // Estimate cost in HBAR
        executionTime: 1000, // Estimate
        success: true
      });
    } catch (error) {
      console.log("⚠️ Failed to log price update to HCS:", error);
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
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && !!this.priceFeedContractId;
  }
}

// Export singleton instance
export const oracleContractService = new OracleContractService();