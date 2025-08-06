import { brokerService } from './services/brokerService';
import { oracleContractService } from './services/blockchain/oracleContractService';

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
    
    // Initialize Smart Contract Services
    try {
      console.log('🔧 Initializing Smart Contract Services...');
      await oracleContractService.initialize();
      console.log('✅ Smart Contract Services initialized successfully');
    } catch (contractError: any) {
      console.log('⚠️ Smart Contract initialization failed (non-critical):', contractError.message);
      console.log('📍 Contract Error stack:', contractError.stack);
    }
    
    console.log('✅ Application initialization complete');
  } catch (error: any) {
    console.error('❌ Application initialization failed:', error.message);
    throw new Error(`Application initialization failed: ${error.message}`);
  }
}; 