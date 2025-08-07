import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all routes
import accountRoutes from '../src/routes/accountRoutes';
import serviceRoutes from '../src/routes/serviceRoutes';
import contractRoutes from '../src/routes/contractRoutes';
import oracleRoutes from '../src/routes/oracleRoutes';
import hfsRoutes from '../src/routes/hfsRoutes';
import analyticsRoutes from '../src/routes/analyticsRoutes';
import hcsRoutes from '../src/routes/hcsRoutes';
import hashscanRoutes from '../src/routes/hashscanRoutes';
import enhancedOracleRoutes from '../src/api/routes/oracle';

// Create Express app
const app = express();

// Apply CORS configuration
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return [
      'https://negravis-frontend.vercel.app',
      'https://negravis-frontend-git-main-oguzhangumus.vercel.app',
      'https://negravis-frontend-oguzhangumus.vercel.app',
      'https://negravis-app.vercel.app'
    ];
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

// API routes
const apiPrefix = '/api';

// Register routes
app.use(`${apiPrefix}/account`, accountRoutes);
app.use(`${apiPrefix}/services`, serviceRoutes);
app.use(`${apiPrefix}/contracts`, contractRoutes);
app.use(`${apiPrefix}/oracles`, oracleRoutes);
app.use(`${apiPrefix}/hfs`, hfsRoutes);
app.use(`${apiPrefix}/analytics`, analyticsRoutes);
app.use(`${apiPrefix}/hcs`, hcsRoutes);
app.use(`${apiPrefix}/hashscan`, hashscanRoutes);
app.use(`${apiPrefix}/oracle-manager`, enhancedOracleRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Negravis Oracle API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      'Oracle Manager': '/api/oracle-manager',
      'HashScan Explorer': '/api/hashscan',
      'HCS Consensus': '/api/hcs',
      'Analytics': '/api/analytics',
      'Documentation': '/docs'
    }
  });
});

// API info route
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Negravis Oracle API',
    version: '2.0.0',
    status: 'operational',
    endpoints: {
      'oracle-manager': '/api/oracle-manager',
      'hashscan': '/api/hashscan',
      'hcs': '/api/hcs',
      'analytics': '/api/analytics'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};