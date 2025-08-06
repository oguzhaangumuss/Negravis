import express, { Request, Response } from 'express';
import { oracleContractService } from '../services/blockchain/oracleContractService';
import { contractManager } from '../services/blockchain/contractManager';
import { hashscanService } from '../services/hashscanService';

const router = express.Router();

/**
 * @swagger
 * /api/contracts/deploy:
 *   post:
 *     summary: Deploy a smart contract
 *     tags: [Smart Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractName:
 *                 type: string
 *                 description: Name of the contract to deploy
 *               constructorParams:
 *                 type: array
 *                 description: Constructor parameters
 *               initialBalance:
 *                 type: number
 *                 description: Initial HBAR balance for the contract
 *     responses:
 *       200:
 *         description: Contract deployed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Deployment failed
 */
router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { contractName, constructorParams = [], initialBalance = 0 } = req.body;

    if (!contractName) {
      return res.status(400).json({
        success: false,
        error: 'Contract name is required'
      });
    }

    console.log(`🚀 API: Deploying contract ${contractName}`);

    const contractPath = `src/contracts/${contractName}.sol`;
    const result = await contractManager.deployContract(
      contractPath,
      constructorParams,
      initialBalance
    );

    if (result.success) {
      const explorerData = hashscanService.createExplorerResponse(
        'contract', 
        result.contractInfo!.contractId,
        {
          name: contractName,
          deployedAt: new Date().toISOString(),
          transactionId: result.contractInfo!.transactionId
        }
      );

      res.json({
        success: true,
        message: `Contract ${contractName} deployed successfully`,
        contract: result.contractInfo,
        explorer: explorerData
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('❌ Contract deployment API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/execute:
 *   post:
 *     summary: Execute a smart contract function
 *     tags: [Smart Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *                 description: Contract ID or name
 *               functionName:
 *                 type: string
 *                 description: Function name to execute
 *               parameters:
 *                 type: array
 *                 description: Function parameters
 *               gasLimit:
 *                 type: number
 *                 description: Gas limit for execution
 *     responses:
 *       200:
 *         description: Function executed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Execution failed
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { contractId, functionName, parameters = [], gasLimit = 1000000 } = req.body;

    if (!contractId || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'Contract ID and function name are required'
      });
    }

    console.log(`⚡ API: Executing ${functionName} on contract ${contractId}`);

    const response = await contractManager.executeContract(
      contractId,
      functionName,
      parameters,
      gasLimit
    );

    const receipt = await response.getReceipt(contractManager['client']);
    const explorerData = hashscanService.createExplorerResponse(
      'transaction',
      response.transactionId.toString(),
      {
        function: functionName,
        contractId,
        parameters,
        gasUsed: 0
      }
    );

    res.json({
      success: true,
      message: `Function ${functionName} executed successfully`,
      transaction: {
        id: response.transactionId.toString(),
        gasUsed: 0,
        function: functionName,
        parameters
      },
      explorer: explorerData
    });

  } catch (error: any) {
    console.error('❌ Contract execution API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/query:
 *   post:
 *     summary: Query a smart contract function (read-only)
 *     tags: [Smart Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *                 description: Contract ID or name
 *               functionName:
 *                 type: string
 *                 description: Function name to query
 *               parameters:
 *                 type: array
 *                 description: Function parameters
 *     responses:
 *       200:
 *         description: Query executed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Query failed
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { contractId, functionName, parameters = [] } = req.body;

    if (!contractId || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'Contract ID and function name are required'
      });
    }

    console.log(`🔍 API: Querying ${functionName} on contract ${contractId}`);

    const result = await contractManager.queryContract(
      contractId,
      functionName,
      parameters
    );

    res.json({
      success: true,
      message: `Function ${functionName} queried successfully`,
      result: result.toString() // Convert result to string for JSON response
    });

  } catch (error: any) {
    console.error('❌ Contract query API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/price/update:
 *   post:
 *     summary: Update price in oracle contract
 *     tags: [Oracle Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symbol:
 *                 type: string
 *                 description: Price symbol (e.g., ETH, BTC)
 *               price:
 *                 type: number
 *                 description: Price in USD
 *               source:
 *                 type: string
 *                 description: Data source
 *     responses:
 *       200:
 *         description: Price updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Update failed
 */
router.post('/price/update', async (req: Request, res: Response) => {
  try {
    const { symbol, price, source = 'api' } = req.body;

    if (!symbol || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and price are required'
      });
    }

    console.log(`💰 API: Updating price for ${symbol}: $${price}`);

    await oracleContractService.updateContractPrice({
      symbol,
      price,
      timestamp: Date.now(),
      source
    });

    res.json({
      success: true,
      message: `Price updated for ${symbol}`,
      data: {
        symbol,
        price,
        timestamp: new Date().toISOString(),
        source
      }
    });

  } catch (error: any) {
    console.error('❌ Price update API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/price/{symbol}:
 *   get:
 *     summary: Get price from oracle contract
 *     tags: [Oracle Contracts]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Price symbol (e.g., ETH, BTC)
 *     responses:
 *       200:
 *         description: Price retrieved successfully
 *       404:
 *         description: Price not found
 *       500:
 *         description: Query failed
 */
router.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    console.log(`🔍 API: Getting price for ${symbol}`);

    const priceData = await oracleContractService.getContractPrice(symbol);
    const isStale = await oracleContractService.isPriceStale(symbol);

    res.json({
      success: true,
      data: {
        symbol,
        price: parseFloat(priceData.price),
        timestamp: parseInt(priceData.timestamp),
        isValid: priceData.isValid,
        isStale,
        lastUpdate: new Date(parseInt(priceData.timestamp) * 1000).toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Price query API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/info:
 *   get:
 *     summary: Get deployed contracts information
 *     tags: [Smart Contracts]
 *     responses:
 *       200:
 *         description: Contract information retrieved successfully
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const allContracts = contractManager.getAllContracts();
    const oracleInfo = oracleContractService.getContractInfo();

    const contracts: any = {};
    allContracts.forEach((contractInfo, name) => {
      contracts[name] = {
        ...contractInfo,
        explorerLink: `https://hashscan.io/testnet/contract/${contractInfo.contractId}`
      };
    });

    res.json({
      success: true,
      data: {
        deployedContracts: contracts,
        oracleService: {
          isReady: oracleContractService.isReady(),
          ...oracleInfo
        },
        contractManager: {
          isReady: contractManager.isReady()
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Contract info API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;