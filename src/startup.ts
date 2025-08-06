import { brokerService } from './services/brokerService';
import { oracleContractService } from './services/blockchain/oracleContractService';
import { oracleManager } from './services/oracleManager';
import { hfsLicenseManager } from './services/hfs/hfsLicenseManager';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';

/**
 * Initialize the application and ensure prerequisite resources exist
 */
export const initializeApplication = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing application...');
    
    // Check if ledger exists, create with default values if not
    try {
      const balanceInfo = await brokerService.getBalance();
      console.log('✅ Ledger account exists:', balanceInfo);
    } catch (error) {
      console.log('⚠️ Ledger account does not exist, creating...');
      // Default initial amount, can be adjusted as needed
      const initialAmount = 0.01; 
      await brokerService.addFundsToLedger(initialAmount);
      console.log(`✅ Ledger account created with ${initialAmount} initial funds`);
    }

    // Initialize HFS License Manager with Hedera client
    try {
      console.log('🔧 Initializing HFS License Manager...');
      
      // Create Hedera client for testnet
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;
      
      if (accountId && privateKey) {
        const client = Client.forTestnet();
        // Handle both DER and HEX private key formats
        const hederaPrivateKey = privateKey.startsWith('0x') 
          ? PrivateKey.fromStringECDSA(privateKey) 
          : PrivateKey.fromString(privateKey);
          
        client.setOperator(AccountId.fromString(accountId), hederaPrivateKey);
        
        await hfsLicenseManager.initialize(client);
        console.log('✅ HFS License Manager initialized successfully');
      } else {
        console.log('⚠️ Hedera credentials not found, HFS will run in mock mode');
        // Initialize without client for demo mode
        const mockClient = null as any; // Mock client
        await hfsLicenseManager.initialize(mockClient);
        console.log('✅ HFS License Manager initialized in demo mode');
      }
    } catch (hfsError: any) {
      console.log('⚠️ HFS License Manager initialization failed (non-critical):', hfsError.message);
      console.log('📍 HFS Error stack:', hfsError.stack);
    }
    
    // Initialize Smart Contract Services
    try {
      console.log('🔧 Initializing Smart Contract Services...');
      await oracleContractService.initialize();
      console.log('✅ Smart Contract Services initialized successfully');
    } catch (contractError: any) {
      console.log('⚠️ Smart Contract initialization failed (non-critical):', contractError.message);
      console.log('📍 Contract Error stack:', contractError.stack);
    }

    // Initialize Oracle Manager
    try {
      console.log('🔧 Initializing Oracle Manager...');
      await oracleManager.initialize();
      console.log('✅ Oracle Manager initialized successfully');
    } catch (oracleError: any) {
      console.log('⚠️ Oracle Manager initialization failed (non-critical):', oracleError.message);
      console.log('📍 Oracle Error stack:', oracleError.stack);
    }
    
    console.log('✅ Application initialization complete');
  } catch (error: any) {
    console.error('❌ Application initialization failed:', error.message);
    throw new Error(`Application initialization failed: ${error.message}`);
  }
}; 