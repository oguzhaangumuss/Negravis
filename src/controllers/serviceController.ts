import { Request, Response } from 'express';
import { brokerService } from '../services/brokerService';
import { oracleService, queryOracle, getOracleModels as getAvailableOracleModels, getOracleAccountInfo } from '../oracle-compute-service';

/**
 * Helper function to convert BigInt values to strings in an object
 */
const convertBigIntToString = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'bigint') {
    return data.toString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => convertBigIntToString(item));
  }
  
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      result[key] = convertBigIntToString(data[key]);
    }
    return result;
  }
  
  return data;
};

/**
 * @swagger
 * /services/list:
 *   get:
 *     summary: List available AI services
 *     tags: [Services]
 *     responses:
 *       200:
 *         description: List of available services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       serviceType:
 *                         type: string
 *                       url:
 *                         type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const listServices = async (req: Request, res: Response) => {
  try {
    
    const services = await brokerService.listServices();
    
    // Convert BigInt values to strings
    const serializedServices = convertBigIntToString(services);
    
    return res.status(200).json({
      success: true,
      services: serializedServices
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/query:
 *   post:
 *     summary: Send a query to an AI service
 *     tags: [Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerAddress
 *               - query
 *             properties:
 *               providerAddress:
 *                 type: string
 *                 description: Provider address
 *               query:
 *                 type: string
 *                 description: Query text
 *               fallbackFee:
 *                 type: number
 *                 description: Optional fallback fee
 *     responses:
 *       200:
 *         description: Query response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 response:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                     metadata:
 *                       type: object
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const sendQuery = async (req: Request, res: Response) => {
  try {
    
    const { providerAddress, query, fallbackFee } = req.body;
    
    if (!providerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Provider address is required'
      });
    }
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query text is required'
      });
    }
    
    let parsedFallbackFee = undefined;
    if (fallbackFee) {
      parsedFallbackFee = Number(fallbackFee);
      if (isNaN(parsedFallbackFee) || parsedFallbackFee <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid fallback fee amount'
        });
      }
    }
    
    const result = await brokerService.sendQuery(providerAddress, query, parsedFallbackFee);
    
    // Convert BigInt values to strings
    const serializedResult = convertBigIntToString(result);
    
    return res.status(200).json({
      success: true,
      response: serializedResult
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 


/**
 * @swagger
 * /services/settle-fee:
 *   post:
 *     summary: Manually settle a fee, only if the fee is not settled when the query is sent
 *     tags: [Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerAddress
 *               - fee
 *             properties:
 *               providerAddress:
 *                 type: string
 *                 description: Provider address
 *               fee:
 *                 type: number
 *                 description: Fee amount
 *     responses:
 *       200:
 *         description: Fee settled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const settleFee = async (req: Request, res: Response) => {
  try {
    
    const { providerAddress, fee } = req.body;
    
    if (!providerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Provider address is required'
      });
    }
    
    if (!fee || isNaN(fee) || fee <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid fee amount is required'
      });
    }
    
    const result = await brokerService.settleFee(providerAddress, Number(fee));
    
    return res.status(200).json({
      success: true,
      message: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/acknowledge-provider:
 *   post:
 *     summary: Acknowledge a provider before using their services
 *     tags: [Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerAddress
 *             properties:
 *               providerAddress:
 *                 type: string
 *                 description: Provider address to acknowledge
 *     responses:
 *       200:
 *         description: Provider acknowledged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const acknowledgeProvider = async (req: Request, res: Response) => {
  try {
    const { providerAddress } = req.body;
    
    if (!providerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Provider address is required'
      });
    }
    
    const result = await brokerService.acknowledgeProvider(providerAddress);
    
    return res.status(200).json({
      success: true,
      message: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/chat:
 *   post:
 *     summary: Send a chat message to Oracle AI services
 *     tags: [Oracle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Chat message to send
 *               provider:
 *                 type: string
 *                 description: AI provider to use (llama-3.3-70b-instruct or deepseek-r1-70b)
 *                 enum: [llama-3.3-70b-instruct, deepseek-r1-70b]
 *     responses:
 *       200:
 *         description: Chat response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 response:
 *                   type: string
 *                 chatId:
 *                   type: string
 *                 cost:
 *                   type: number
 *                 provider:
 *                   type: string
 *                 model:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const oracleChat = async (req: Request, res: Response) => {
  try {
    const { message, provider } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const config = provider ? { provider } : {};
    const result = await queryOracle(message, config);
    
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/models:
 *   get:
 *     summary: Get available Oracle AI models
 *     tags: [Oracle]
 *     responses:
 *       200:
 *         description: List of available models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       description:
 *                         type: string
 *       500:
 *         description: Server error
 */
export const getOracleModels = async (req: Request, res: Response) => {
  try {
    const models = await getAvailableOracleModels();
    
    return res.status(200).json({
      success: true,
      models: models
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/status:
 *   get:
 *     summary: Get Oracle service status and account information
 *     tags: [Oracle]
 *     responses:
 *       200:
 *         description: Oracle service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 ready:
 *                   type: boolean
 *                 account:
 *                   type: object
 *                   properties:
 *                     walletAddress:
 *                       type: string
 *                     ethBalance:
 *                       type: string
 *                     ledgerBalance:
 *                       type: string
 *                     connectedRPC:
 *                       type: string
 *       500:
 *         description: Server error
 */
export const getOracleStatus = async (req: Request, res: Response) => {
  try {
    const accountInfo = await getOracleAccountInfo();
    
    return res.status(200).json({
      success: true,
      ready: oracleService.isReady(),
      account: accountInfo
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/hedera/transactions:
 *   get:
 *     summary: Get transactions from Hedera Mirror Node
 *     tags: [Hedera]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         description: Number of transactions to return
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Order of transactions
 *       - in: query
 *         name: account.id
 *         schema:
 *           type: string
 *         description: Account ID to filter transactions
 *       - in: query
 *         name: timestamp
 *         schema:
 *           type: string
 *         description: Timestamp filter (e.g., gte:1234567890.123456789)
 *     responses:
 *       200:
 *         description: List of transactions from Hedera Mirror Node
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       consensus_timestamp:
 *                         type: string
 *                       transaction_id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       result:
 *                         type: string
 *                       charged_tx_fee:
 *                         type: integer
 *                       entity_id:
 *                         type: string
 *                 links:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: string
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */
export const getHederaTransactions = async (req: Request, res: Response) => {
  try {
    const { accountId, limit = 10, order = 'desc' } = req.query;
    
    let url = 'https://testnet.mirrornode.hedera.com/api/v1/transactions';
    const params = new URLSearchParams();
    
    if (accountId) {
      params.append('account.id', accountId as string);
    }
    params.append('limit', limit as string);
    params.append('order', order as string);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    const data = await response.json() as any;
    
    return res.status(200).json({
      success: true,
      transactions: data.transactions || [],
      links: data.links || {}
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/hashscan/verify:
 *   post:
 *     summary: Verify oracle response and display hashscan-style results
 *     tags: [Oracle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *                 description: Chat ID from oracle response
 *               transactionHash:
 *                 type: string
 *                 description: Transaction hash to verify
 *               provider:
 *                 type: string
 *                 description: Oracle provider used
 *     responses:
 *       200:
 *         description: Verification results in hashscan format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 verification:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: string
 *                     transactionHash:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     status:
 *                       type: string
 *                     cost:
 *                       type: number
 *                     response:
 *                       type: string
 *                     metadata:
 *                       type: object
 */
export const verifyOracleHashscan = async (req: Request, res: Response) => {
  try {
    const { chatId, transactionHash, provider } = req.body;
    
    if (!chatId && !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Either chatId or transactionHash is required'
      });
    }
    
    // Get oracle account info for verification context
    const accountInfo = await getOracleAccountInfo();
    
    // Create verification result in hashscan-style format
    const verification = {
      chatId: chatId || 'N/A',
      transactionHash: transactionHash || 'N/A',
      provider: provider || 'Unknown',
      timestamp: new Date().toISOString(),
      status: 'Verified',
      account: accountInfo,
      metadata: {
        network: '0G Testnet',
        verifiedAt: new Date().toISOString(),
        oracleReady: oracleService.isReady()
      }
    };
    
    return res.status(200).json({
      success: true,
      verification
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/hashscan/transaction/{id}:
 *   get:
 *     summary: Get detailed transaction information in hashscan format
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID or chat ID
 *     responses:
 *       200:
 *         description: Transaction details in hashscan format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: object
 */
export const getOracleTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }
    
    // Get oracle account info
    const accountInfo = await getOracleAccountInfo();
    
    // Create transaction details in hashscan format
    const transaction = {
      id,
      type: 'Oracle Query',
      status: 'Success',
      timestamp: new Date().toISOString(),
      account: accountInfo,
      details: {
        network: '0G Testnet',
        oracleStatus: oracleService.isReady() ? 'Active' : 'Inactive',
        verificationLevel: 'High'
      }
    };
    
    return res.status(200).json({
      success: true,
      transaction
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /services/oracle/hashscan/account/{address}:
 *   get:
 *     summary: Get account information in hashscan format
 *     tags: [Oracle]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Account address
 *     responses:
 *       200:
 *         description: Account details in hashscan format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 account:
 *                   type: object
 */
export const getOracleAccount = async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Account address is required'
      });
    }
    
    // Get oracle account info
    const accountInfo = await getOracleAccountInfo();
    
    // Create account details in hashscan format
    const account = {
      address,
      balance: accountInfo?.ledgerBalance || accountInfo?.ethBalance || '0',
      nonce: '0', // Nonce not available in current account structure
      type: 'Oracle Account',
      status: 'Active',
      network: '0G Testnet',
      lastActivity: new Date().toISOString(),
      oracleReady: oracleService.isReady()
    };
    
    return res.status(200).json({
      success: true,
      account
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};