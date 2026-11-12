const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const querySanitizer = require('./src/middlewares/querySanitizer');
const apiRouter = require('./src/routes/index');
const notFoundHandler = require('./src/middlewares/notFoundHandler');
const errorHandler = require('./src/middlewares/errorHandler');
const ERROR_CODES = require('./src/constants/errorCodes');

const app = express();

// 1. Reverse Proxy Trust Settings (for deployment on Render, Railway, Nginx, Heroku)
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv !== undefined) {
  if (trustProxyEnv === 'true') {
    app.set('trust proxy', true);
  } else if (trustProxyEnv === 'false') {
    app.set('trust proxy', false);
  } else if (!isNaN(Number(trustProxyEnv))) {
    app.set('trust proxy', Number(trustProxyEnv));
  } else {
    app.set('trust proxy', trustProxyEnv);
  }
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 2. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 3. Cross-Origin Resource Sharing (whitelisted frontend origins)
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, ...defaultOrigins]
  : defaultOrigins;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// 4. HTTP Request Logging (suppressed during automated tests)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 5. Body Parsers with Payload Size Limits
const bodyLimit =
  process.env.BODY_LIMIT || (process.env.NODE_ENV === 'test' ? '10kb' : '10mb');
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// 6. Global API Rate Limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP address. Please try again later.',
      details: null,
    },
  },
});
app.use('/api', globalLimiter);

// 7. Query Parameter Sanitization (NoSQL injection guard)
app.use(querySanitizer);

// 8. Restricted Static Photo Serving with Path Traversal Defense
const serveUpload = (req, res) => {
  const rawParam = req.params.filename || '';

  // Strict whitelist for filenames: UUID or alphanumeric + dash/underscore + allowed extension
  const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i;
  if (
    !rawParam ||
    !SAFE_FILENAME_REGEX.test(rawParam) ||
    rawParam.includes('..') ||
    rawParam.includes('/') ||
    rawParam.includes('\\')
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid or malformed filename requested.',
        details: null,
      },
    });
  }

  const sanitizedFilename = path.basename(rawParam);
  const uploadsDir = path.resolve(__dirname, 'uploads');
  const filePath = path.resolve(uploadsDir, sanitizedFilename);

  // Path traversal containment check
  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({
      success: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied.',
        details: null,
      },
    });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: {
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Requested image not found.',
        details: null,
      },
    });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  const ext = path.extname(sanitizedFilename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
  }
  return res.sendFile(filePath);
};

// Mount static uploads handlers
app.get('/uploads/:filename', serveUpload);
app.get('/api/v1/uploads/:filename', serveUpload);

// 9. Mount API Routes
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// 10. 404 Route Catch-All
app.use(notFoundHandler);

// 11. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
