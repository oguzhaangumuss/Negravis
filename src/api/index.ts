import OracleAPIServer from './server';

/**
 * Main entry point for Negravis Oracle API
 */
const PORT = parseInt(process.env.PORT || '3001');

const server = new OracleAPIServer(PORT);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚡ SIGTERM received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚡ SIGINT received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start server
server.start().catch((error) => {
  console.error('❌ Failed to start Oracle API server:', error);
  process.exit(1);
});

export { OracleAPIServer };
export default server;