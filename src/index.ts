import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import dotenv from 'dotenv';
import { initializeApplication } from './startup';

// Import routes
import accountRoutes from './routes/accountRoutes';
import serviceRoutes from './routes/serviceRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 4001;

// Apply basic middleware
app.use(cors());
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

// Root route - serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Oracle interface route - serve the interactive Oracle page
app.get('/oracle', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/api.html'));
});

// Serve Oracle Hashscan interface
app.get('/hashscan', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/hashscan.html'));
});

// API info route for programmatic access
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Negravis - 0G Compute Network API',
    version: '1.0.0',
    documentation: '/docs',
    endpoints: {
      account: `${apiPrefix}/account`,
      services: `${apiPrefix}/services`,
    }
  });
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