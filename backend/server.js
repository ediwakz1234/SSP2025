/**
 * Local development server for the backend API
 * Run with: node server.js
 */

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import logger from "./lib/logger.js";
import { apiLimiter, authLimiter, aiLimiter, strictLimiter } from "./lib/rateLimit.js";
import { startLogPruner } from "./lib/logPruner.js";

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env files from the same directory (local overrides default)
config({ path: join(__dirname, ".env") });
config({ path: join(__dirname, ".env.local"), override: true });

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// CORS Configuration - Tightened for security
// =============================================================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// =============================================================================
// Middleware
// =============================================================================
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(logger.requestLogger());

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/auth/forgot-password', strictLimiter);
app.use('/api/auth/reset-password', strictLimiter);

// Helper to convert Vercel-style handler to Express handler
function vercelHandler(handlerModule) {
  return async (req, res) => {
    try {
      const handler = handlerModule.default || handlerModule;
      await handler(req, res);
    } catch (err) {
      console.error("Handler error:", err);
      res.status(500).json({ error: "Internal server error", message: err.message });
    }
  };
}

// Import handlers dynamically
const routes = [
  // AI routes
  { path: "/api/ai/categories", handler: () => import("./api/ai/categories.js") },
  { path: "/api/ai/recommendations", handler: () => import("./api/ai/recommendations.js") },
  { path: "/api/ai/business-recommendations", handler: () => import("./api/ai/business-recommendations.js") },
  // Support both underscore and hyphen variants for the validation route
  { path: "/api/ai/validate_business", handler: () => import("./api/ai/validate_business.js") },
  { path: "/api/ai/validate-business", handler: () => import("./api/ai/validate_business.js") },
  { path: "/api/ai", handler: () => import("./api/ai/index.js") },
  
  // Auth routes
  { path: "/api/auth/login", handler: () => import("./api/auth/login.js") },
  { path: "/api/auth/register", handler: () => import("./api/auth/register.js") },
  { path: "/api/auth/forgot-password", handler: () => import("./api/auth/forgot-password.js") },
  { path: "/api/auth/reset-password", handler: () => import("./api/auth/reset-password.js") },
  
  // Admin routes
  { path: "/api/admin/login", handler: () => import("./api/admin/login.js") },
  { path: "/api/admin/stats", handler: () => import("./api/admin/stats.js") },
  { path: "/api/admin/seed-data", handler: () => import("./api/admin/seed-data.js") },
  { path: "/api/admin/seed-stats", handler: () => import("./api/admin/seed-stats.js") },
  
  // Business routes
  { path: "/api/businesses/:id", handler: () => import("./api/businesses/[id].js") },
  { path: "/api/businesses", handler: () => import("./api/businesses/index.js") },
  
  // User routes
  { path: "/api/users/profile", handler: () => import("./api/users/profile.js") },
  { path: "/api/users/:id", handler: () => import("./api/users/[id].js") },
  { path: "/api/users", handler: () => import("./api/users/index.js") },
  
  // Clustering route
  { path: "/api/clustering", handler: () => import("./api/clustering/index.js") },
];

// Register routes
routes.forEach(({ path, handler }) => {
  app.all(path, async (req, res) => {
    try {
      // For dynamic routes like :id, add to req.query
      if (req.params.id) {
        req.query = { ...req.query, id: req.params.id };
      }
      const module = await handler();
      await vercelHandler(module)(req, res);
    } catch (err) {
      console.error(`Error loading handler for ${path}:`, err);
      res.status(500).json({ error: "Handler not found", path });
    }
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Schedule daily cleanup of old activity logs (keeps last 24 hours)
startLogPruner();

app.listen(PORT, () => {
  logger.info(`Backend server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
  logger.info(`API endpoints available`, { url: `http://localhost:${PORT}/api/*` });
  logger.debug('Environment check', {
    supabaseUrl: process.env.SUPABASE_URL ? '✓' : '✗',
    geminiKey: process.env.GEMINI_API_KEY ? '✓' : '✗',
    jwtSecret: process.env.JWT_SECRET ? '✓' : '✗',
  });
});
