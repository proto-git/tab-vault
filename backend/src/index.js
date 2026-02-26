// Load environment variables (must be first import)
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import captureRouter from './routes/capture.js';
import { authGate, isAuthEnforced } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3002',
  'http://localhost:3000'
]);

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server and same-origin requests with no Origin header.
    if (!origin) {
      return callback(null, true);
    }

    // Allow installed extension origins.
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', authGate, captureRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║           Tab Vault Backend               ║
║                                           ║
║   Server running on port ${PORT}            ║
║   http://localhost:${PORT}                  ║
║                                           ║
  ║   Endpoints:                              ║
  ║   POST /api/capture - Capture a URL       ║
  ║   GET  /api/search  - Search captures     ║
  ║   GET  /api/recent  - Recent captures     ║
  ║   Auth enforced: ${isAuthEnforced() ? 'yes' : 'no'}                    ║
╚═══════════════════════════════════════════╝
  `);
});

export default app;
