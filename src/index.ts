import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import dotenv from 'dotenv';
import { initializeApplication } from './startup';

// Import routes
import accountRoutes from './routes/accountRoutes';
import serviceRoutes from './routes/serviceRoutes';
import contractRoutes from './routes/contractRoutes';
import oracleRoutes from './routes/oracleRoutes';
import oracleManagerRoutes from './routes/oracleManagerRoutes';
import hfsRoutes from './routes/hfsRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import hcsRoutes from './routes/hcsRoutes';
import enhancedOracleRoutes from './api/routes/oracle';
import { createOracleRoutes } from './services/oracle/api/oracleRoutes';
import { OracleRouter } from './services/oracle/OracleRouter';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 4001;

// Apply basic middleware with explicit CORS configuration
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    const productionUrls = [
      'https://negravis-frontend.vercel.app',
      'https://negravis-frontend-git-main-oguzhangumus.vercel.app',
      'https://negravis-frontend-oguzhangumus.vercel.app',
      'https://negravis-app.vercel.app'
    ];
    if (process.env.FRONTEND_URL) {
      productionUrls.push(...process.env.FRONTEND_URL.split(',').map(url => url.trim()));
    }
    return productionUrls;
  }
  return true; // Allow all origins in development
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'x-api-key', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API documentation route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: '0G Compute Network API Documentation',
}));

// API routes
const apiPrefix = '/api';

// Register routes
app.use(`${apiPrefix}/account`, accountRoutes);
app.use(`${apiPrefix}/services`, serviceRoutes);
app.use(`${apiPrefix}/contracts`, contractRoutes);
app.use(`${apiPrefix}/oracles`, oracleRoutes); // Legacy oracle routes
app.use(`${apiPrefix}/hfs`, hfsRoutes);
app.use(`${apiPrefix}/analytics`, analyticsRoutes);
app.use(`${apiPrefix}/hcs`, hcsRoutes); // Hedera Consensus Service routes
app.use(`${apiPrefix}/hashscan`, require('./routes/hashscanRoutes').default); // Oracle Hashscan routes

// Enhanced Oracle Manager API Routes (NEW SYSTEM)
app.use(`${apiPrefix}/oracle-manager`, oracleManagerRoutes); // Oracle Manager routes with HCS logging

// NEW Oracle API Controller Routes (WITH DATABASE RECORDING)
// Initialize Oracle Router for the Oracle API Controller
const initializeOracleAPIRoutes = async () => {
  try {
    const oracleRouter = new OracleRouter();
    await oracleRouter.initialize();
    return createOracleRoutes(oracleRouter);
  } catch (error) {
    console.error('❌ Oracle API Router initialization failed:', error);
    throw error;
  }
};

// Setup Oracle API Controller routes with database recording
initializeOracleAPIRoutes().then(oracleAPIRoutes => {
  app.use(`${apiPrefix}/oracle`, oracleAPIRoutes);
  console.log('✅ Oracle API Controller routes initialized with database recording');
}).catch(error => {
  console.error('❌ Failed to initialize Oracle API Controller routes:', error);
});

// Root route - serve the landing page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Oracle interface route - serve the interactive Oracle page
app.get('/oracle', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/api.html'));
});

// Serve Oracle Hashscan interface
app.get('/hashscan', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/hashscan.html'));
});

// Serve Hedera Analytics Dashboard
app.get('/analytics', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/analytics.html'));
});

// API info route for programmatic access
app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    name: 'Negravis - 0G Compute Network API',
    version: '1.0.0',
    documentation: '/docs',
    endpoints: {
      account: `${apiPrefix}/account`,
      services: `${apiPrefix}/services`,
      contracts: `${apiPrefix}/contracts`,
      oracles: `${apiPrefix}/oracles`,
      hfs: `${apiPrefix}/hfs`,
      analytics: `${apiPrefix}/analytics`,
    }
  });
});

// HCS Topics info route - Enhanced with HashScan integration
app.get('/api/hcs/topics', async (req: Request, res: Response) => {
  try {
    const { hcsService } = require('./services/hcsService');
    const { hashscanService } = require('./services/hashscanService');
    
    const topicIds = hcsService.getTopicIds();
    
    // Create enhanced explorer links with metadata
    const enhancedTopics = {
      oracleQueries: topicIds.oracleQueries ? 
        hashscanService.createExplorerResponse('topic', topicIds.oracleQueries, {
          name: 'Oracle Queries',
          description: 'Real-time oracle query logging',
          messageCount: await hashscanService.getTopicDetails(topicIds.oracleQueries).then((d: any) => d.messages).catch(() => 0)
        }) : null,
      computeOperations: topicIds.computeOperations ? 
        hashscanService.createExplorerResponse('topic', topicIds.computeOperations, {
          name: 'Compute Operations',
          description: 'Operation tracking and status',
          messageCount: await hashscanService.getTopicDetails(topicIds.computeOperations).then((d: any) => d.messages).catch(() => 0)
        }) : null,
      accountOperations: topicIds.accountOperations ? 
        hashscanService.createExplorerResponse('topic', topicIds.accountOperations, {
          name: 'Account Operations',
          description: 'Balance changes and transactions',
          messageCount: await hashscanService.getTopicDetails(topicIds.accountOperations).then((d: any) => d.messages).catch(() => 0)
        }) : null,
      systemMetrics: topicIds.systemMetrics ? 
        hashscanService.createExplorerResponse('topic', topicIds.systemMetrics, {
          name: 'System Metrics',
          description: 'Performance and monitoring data',
          messageCount: await hashscanService.getTopicDetails(topicIds.systemMetrics).then((d: any) => d.messages).catch(() => 0)
        }) : null
    };

    res.json({
      success: true,
      hcsService: {
        initialized: hcsService.isReady(),
        topics: enhancedTopics,
        summary: {
          totalTopics: Object.values(topicIds).filter(Boolean).length,
          network: 'testnet',
          explorer: 'HashScan'
        }
      }
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallbackTopics: {
        oracleQueries: 'https://hashscan.io/testnet/topic/0.0.6503587',
        computeOperations: 'https://hashscan.io/testnet/topic/0.0.6503588',
        accountOperations: 'https://hashscan.io/testnet/topic/0.0.6503589',
        systemMetrics: 'https://hashscan.io/testnet/topic/0.0.6503590'
      }
    });
  }
});

// Transaction tracking endpoint
app.get('/api/explorer/transaction/:txId', async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const { hashscanService } = require('./services/hashscanService');
    
    const transactionDetails = await hashscanService.getTransactionDetails(txId);
    const statusBadge = hashscanService.getStatusBadge(transactionDetails.status);
    
    res.json({
      success: true,
      transaction: {
        ...transactionDetails,
        statusBadge,
        explorerData: hashscanService.createExplorerResponse('transaction', txId, {
          fee: transactionDetails.fee,
          status: transactionDetails.status,
          result: transactionDetails.result
        })
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Multiple transaction status endpoint
app.post('/api/explorer/transactions/status', async (req: Request, res: Response) => {
  try {
    const { transactionIds } = req.body;
    
    if (!Array.isArray(transactionIds)) {
      return res.status(400).json({
        success: false,
        error: 'transactionIds must be an array'
      });
    }

    const { hashscanService } = require('./services/hashscanService');
    const transactions = await hashscanService.getMultipleTransactionStatus(transactionIds);
    const formattedHistory = hashscanService.formatTransactionHistory(transactions);
    
    res.json({
      success: true,
      transactions: formattedHistory,
      summary: {
        total: transactions.length,
        successful: transactions.filter((tx: any) => tx.status === 'success').length,
        pending: transactions.filter((tx: any) => tx.status === 'pending').length,
        failed: transactions.filter((tx: any) => tx.status === 'failed').length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// HashScan embed widget endpoint
app.get('/api/explorer/embed/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { hashscanService } = require('./services/hashscanService');
    
    if (!['transaction', 'account', 'topic', 'contract'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be: transaction, account, topic, or contract'
      });
    }

    const embedHtml = hashscanService.generateEmbedWidget(type as any, id);
    const explorerLink = hashscanService.createExplorerLink(type as any, id);
    
    res.json({
      success: true,
      embed: {
        html: embedHtml,
        link: explorerLink,
        type,
        id
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: err.message
  });
});

// Initialize application and start server
const startServer = async () => {
  try {
    // Run initialization tasks
    await initializeApplication();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`
  🚀 0G Compute Network API Server running on http://localhost:${PORT}
  📚 API Documentation: http://localhost:${PORT}/docs
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;