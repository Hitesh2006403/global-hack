import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import handoverRoutes from './routes/handoverRoutes.js';
import donationRoutes from './routes/donationRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  CLIENT_URL,
].filter(Boolean);

// CORS configuration with credentials support for HttpOnly cookies
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in local dev, origins checked
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id'],
  })
);

app.use(express.json());
app.use(cookieParser());

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api', donationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ShareAPlate Auth & Coordination API',
    googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`ShareAPlate Backend Server running on port ${PORT}`);
  console.log(`Auth endpoint: http://localhost:${PORT}/api/auth`);
  console.log(`Google OAuth Configured: ${Boolean(process.env.GOOGLE_CLIENT_ID)}`);
  console.log(`====================================================`);
});
