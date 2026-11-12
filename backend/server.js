<<<<<<< HEAD
const http = require('node:http');
const { handleApiRequest } = require('./apiHandler');

const PORT = process.env.PORT || 5000;

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    await handleApiRequest(req, res);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Share A Plate API Server is active.', version: '2.0.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Share A Plate Backend] API Server listening on http://localhost:${PORT}`);
});

module.exports = server;
=======
require('dotenv').config();
const app = require('./app');
const { connectDB, closeDB } = require('./src/config/db');
const { startExpirySweeper } = require('./src/services/expirySweeper');

const PORT = process.env.PORT || 5000;

let server;
let sweeperInterval;

/**
 * Validates that Cloudinary credentials are fully specified if STORAGE_PROVIDER is set to cloudinary.
 * Enforces fail-fast behavior across all environments.
 *
 * @param {Object} [env=process.env]
 * @throws {Error} If STORAGE_PROVIDER=cloudinary and credentials are missing or placeholders
 */
const validateStorageConfig = (env = process.env) => {
  const provider = (env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 'cloudinary') {
    const requiredVars = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    const missing = [];
    for (const varName of requiredVars) {
      const val = env[varName];
      if (!val || typeof val !== 'string' || val.trim() === '') {
        missing.push(`${varName} is missing`);
      } else if (val.toLowerCase().includes('change-me')) {
        missing.push(`${varName} still contains placeholder "change-me"`);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `[Fatal Startup Guard] STORAGE_PROVIDER is set to "cloudinary" but required credentials are missing or invalid:\n - ${missing.join(
          '\n - '
        )}`
      );
    }
  }
};

/**
 * Validates that all critical secrets and configuration parameters are configured
 * securely when running in production mode.
 *
 * @param {Object} [env=process.env]
 * @throws {Error} If any mandatory variable is missing or retains default placeholder
 */
const validateProductionEnv = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const requiredVariables = [
    'MONGODB_URI',
    'JWT_SECRET',
    'CLIENT_URL',
    'QR_SIGNING_SECRET',
  ];

  const violations = [];

  for (const varName of requiredVariables) {
    const val = env[varName];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      violations.push(`${varName} is missing`);
    } else if (val.toLowerCase().includes('change-me')) {
      violations.push(`${varName} still contains placeholder "change-me"`);
    }
  }

  if (violations.length > 0) {
    const errorMsg = `[Fatal Startup Guard] Production environment validation failed:\n - ${violations.join(
      '\n - '
    )}`;
    throw new Error(errorMsg);
  }
};

const startServer = async () => {
  try {
    validateProductionEnv();
    validateStorageConfig();
    await connectDB();
    sweeperInterval = startExpirySweeper(300000); // 5 minutes
    server = app.listen(PORT, () => {
      console.log(
        `[Server] Share A Plate API listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
    });
    return server;
  } catch (error) {
    console.error(`[Server Fatal] Initialization failed: ${error.message}`);
    process.exit(1);
  }
};

// Start the HTTP listener in non-test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown listeners
const handleShutdown = async (signal) => {
  console.log(`[Server] ${signal} signal received. Commencing graceful shutdown...`);
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
  }
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP connection pool drained and server closed.');
      await closeDB();
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Process Error] Unhandled Rejection detected:', reason);
  handleShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception detected:', err.message);
  process.exit(1);
});

module.exports = {
  server,
  startServer,
  validateProductionEnv,
  validateStorageConfig,
};
>>>>>>> 08f3fc48368d60c39c69a0cdcbf63ea6d970b094
