// Load environment variables (must be first import)
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import captureRouter from './routes/capture.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'chrome-extension://*',
    process.env.FRONTEND_URL || 'http://localhost:3002',
    'http://localhost:3000'
  ],
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
app.use('/api', captureRouter);

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
╚═══════════════════════════════════════════╝
  `);
});

export default app;
