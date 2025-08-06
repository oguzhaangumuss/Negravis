import {
  Client,
  ContractCreateTransaction,
  ContractExecuteTransaction,
  ContractCallQuery,
  FileCreateTransaction,
  ContractFunctionParameters,
  PrivateKey,
  AccountId,
  Hbar,
  ContractId,
  TransactionResponse,
  TransactionReceipt
} from "@hashgraph/sdk";
const solc = require("solc");
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

interface ContractInfo {
  contractId: string;
  contractAddress: string;
  transactionId: string;
  gasUsed: number;
}

interface DeploymentResult {
  success: boolean;
  contractInfo?: ContractInfo;
  error?: string;
}

/**
 * Hedera Smart Contract Management Service
 * Handles contract compilation, deployment, and interaction
 */
export class ContractManager {
  private client: Client;
  private isInitialized = false;
  private deployedContracts: Map<string, ContractInfo> = new Map();

  constructor() {
    // Initialize client for testnet
    this.client = Client.forTestnet();
  }

  /**
   * Initialize the contract manager with operator credentials
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("🔧 Initializing Hedera Contract Manager...");

      const operatorId = process.env.HEDERA_ACCOUNT_ID;
      const operatorKey = process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY;

      if (!operatorKey) {
        throw new Error('HEDERA_PRIVATE_KEY or PRIVATE_KEY is required');
      }

      const privateKey = PrivateKey.fromStringECDSA(operatorKey);
      const accountId = operatorId ? 
        AccountId.fromString(operatorId) : 
        privateKey.publicKey.toAccountId(0, 0);

      this.client.setOperator(accountId, privateKey);

      this.isInitialized = true;
      console.log("✅ Hedera Contract Manager initialized successfully");

    } catch (error: any) {
      console.error("❌ Failed to initialize Contract Manager:", error.message);
      throw error;
    }
  }

  /**
   * Compile a Solidity contract
   */
  private compileContract(contractPath: string): { bytecode: string; abi: any } {
    try {
      console.log(`🔨 Compiling contract: ${contractPath}`);

      const contractSource = fs.readFileSync(contractPath, 'utf8');
      const contractName = path.basename(contractPath, '.sol');

      const input = {
        language: 'Solidity',
        sources: {
          [contractName]: {
            content: contractSource,
          },
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*'],
            },
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      };

      const compilationResult = JSON.parse(solc.compile(JSON.stringify(input)));

      if (compilationResult.errors) {
        const errors = compilationResult.errors.filter((error: any) => error.severity === 'error');
        if (errors.length > 0) {
          throw new Error(`Compilation errors: ${errors.map((e: any) => e.message).join(', ')}`);
        }
      }

      const contract = compilationResult.contracts[contractName][contractName];
      const bytecode = '0x' + contract.evm.bytecode.object;
      const abi = contract.abi;

      console.log(`✅ Contract compiled successfully: ${contractName}`);
      return { bytecode, abi };

    } catch (error: any) {
      console.error(`❌ Failed to compile contract ${contractPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Deploy a smart contract to Hedera
   */
  async deployContract(
    contractPath: string,
    constructorParams: any[] = [],
    initialBalance: number = 0
  ): Promise<DeploymentResult> {
    await this.initialize();

    try {
      console.log(`🚀 Deploying contract: ${contractPath}`);

      // Compile the contract
      const { bytecode, abi } = this.compileContract(contractPath);

      // Create file on Hedera containing the bytecode
      const fileCreateTx = new FileCreateTransaction()
        .setContents(bytecode)
        .setKeys([this.client.operatorPublicKey!])
        .setMaxTransactionFee(new Hbar(2));

      const fileCreateResponse = await fileCreateTx.execute(this.client);
      const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
      const fileId = fileCreateReceipt.fileId!;

      console.log(`📁 Contract bytecode file created: ${fileId}`);

      // Prepare constructor parameters
      let contractParams = new ContractFunctionParameters();
      if (constructorParams.length > 0) {
        // Add parameters based on their types
        constructorParams.forEach((param, index) => {
          if (typeof param === 'string') {
            contractParams.addString(param);
          } else if (typeof param === 'number') {
            contractParams.addUint256(param);
          } else if (typeof param === 'boolean') {
            contractParams.addBool(param);
          }
          // Add more type handling as needed
        });
      }

      // Deploy the contract
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileId)
        .setGas(2000000) // Increased gas limit
        .setConstructorParameters(contractParams)
        .setInitialBalance(new Hbar(initialBalance))
        .setMaxTransactionFee(new Hbar(20));

      const contractCreateResponse = await contractCreateTx.execute(this.client);
      const contractCreateReceipt = await contractCreateResponse.getReceipt(this.client);
      const contractId = contractCreateReceipt.contractId!;

      console.log(`✅ Contract deployed successfully: ${contractId}`);

      // Store contract info
      const contractInfo: ContractInfo = {
        contractId: contractId.toString(),
        contractAddress: contractId.toSolidityAddress(),
        transactionId: contractCreateResponse.transactionId.toString(),
        gasUsed: 0 // Will be updated after transaction record
      };

      const contractName = path.basename(contractPath, '.sol');
      this.deployedContracts.set(contractName, contractInfo);

      // Save ABI for future interactions
      const abiPath = path.join(path.dirname(contractPath), `${contractName}.abi.json`);
      fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));

      return {
        success: true,
        contractInfo
      };

    } catch (error: any) {
      console.error(`❌ Failed to deploy contract ${contractPath}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a contract function
   */
  async executeContract(
    contractIdOrName: string,
    functionName: string,
    parameters: any[] = [],
    gasLimit: number = 1000000
  ): Promise<TransactionResponse> {
    await this.initialize();

    try {
      let contractId: ContractId;
      
      // Check if it's a contract name we have stored
      if (this.deployedContracts.has(contractIdOrName)) {
        const contractInfo = this.deployedContracts.get(contractIdOrName)!;
        contractId = ContractId.fromString(contractInfo.contractId);
      } else {
        contractId = ContractId.fromString(contractIdOrName);
      }

      // Prepare function parameters
      let functionParams = new ContractFunctionParameters();
      parameters.forEach((param) => {
        if (typeof param === 'string') {
          functionParams.addString(param);
        } else if (typeof param === 'number') {
          functionParams.addUint256(param);
        } else if (typeof param === 'boolean') {
          functionParams.addBool(param);
        }
        // Add more type handling as needed
      });

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(gasLimit)
        .setFunction(functionName, functionParams)
        .setMaxTransactionFee(new Hbar(5));

      const response = await contractExecuteTx.execute(this.client);
      console.log(`✅ Contract function ${functionName} executed: ${response.transactionId}`);

      return response;

    } catch (error: any) {
      console.error(`❌ Failed to execute contract function ${functionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Query a contract function (read-only)
   */
  async queryContract(
    contractIdOrName: string,
    functionName: string,
    parameters: any[] = []
  ): Promise<any> {
    await this.initialize();

    try {
      let contractId: ContractId;
      
      if (this.deployedContracts.has(contractIdOrName)) {
        const contractInfo = this.deployedContracts.get(contractIdOrName)!;
        contractId = ContractId.fromString(contractInfo.contractId);
      } else {
        contractId = ContractId.fromString(contractIdOrName);
      }

      // Prepare function parameters
      let functionParams = new ContractFunctionParameters();
      parameters.forEach((param) => {
        if (typeof param === 'string') {
          functionParams.addString(param);
        } else if (typeof param === 'number') {
          functionParams.addUint256(param);
        } else if (typeof param === 'boolean') {
          functionParams.addBool(param);
        }
      });

      const contractCallQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction(functionName, functionParams)
        .setMaxQueryPayment(new Hbar(1));

      const result = await contractCallQuery.execute(this.client);
      
      return result;

    } catch (error: any) {
      console.error(`❌ Failed to query contract function ${functionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get deployed contract info
   */
  getContractInfo(contractName: string): ContractInfo | undefined {
    return this.deployedContracts.get(contractName);
  }

  /**
   * Get all deployed contracts
   */
  getAllContracts(): Map<string, ContractInfo> {
    return new Map(this.deployedContracts);
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const contractManager = new ContractManager();