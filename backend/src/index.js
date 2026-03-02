// Load environment variables (must be first import)
import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import captureRouter from './routes/capture.js';
import { authGate, isAuthEnforced } from './middleware/auth.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { withSupabaseRequestContext } from './services/supabase.js';
import { logEvent, logRequestLifecycle, setErrorCode } from './services/telemetry.js';

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

// Request context + structured request telemetry
app.use((req, res, next) => {
  const requestIdHeader = req.headers['x-request-id'];
  req.requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim()
    ? requestIdHeader.trim()
    : randomUUID();

  res.setHeader('x-request-id', req.requestId);
  const startedAtMs = Date.now();
  res.on('finish', () => logRequestLifecycle(req, res, startedAtMs));

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public auth config for clients (anon key is safe to expose in browser clients)
app.get('/auth/config', (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Supabase auth is not configured on server',
    });
  }

  return res.json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// API routes
app.use(
  '/api',
  authGate,
  apiRateLimit,
  (req, res, next) => withSupabaseRequestContext(req, next),
  captureRouter
);

// Error handling
app.use((err, req, res, next) => {
  let statusCode = err?.statusCode || err?.status || 500;
  const message = err?.message || 'Internal server error';

  // RLS/permission issues should surface as explicit 403s.
  if (
    err?.code === '42501'
    || /row-level security|permission denied/i.test(message)
  ) {
    statusCode = 403;
    setErrorCode(res, 'RLS_DENIED');
  } else if (statusCode >= 500) {
    setErrorCode(res, 'INTERNAL_ERROR');
  }

  logEvent('endpoint_error', {
    request_id: req.requestId || null,
    user_id: req.user?.id || null,
    route: req.originalUrl || req.path,
    status_code: statusCode,
    latency_ms: null,
    error_code: res.locals?.errorCode || 'UNHANDLED_ERROR',
    details: process.env.NODE_ENV === 'development' ? message : undefined,
  });

  console.error('Error:', err);
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? message : 'Internal server error'
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
