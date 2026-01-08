import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes, recoverStuckAnalyses } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initStorage } from "./storage";
import { closeDb } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ==================== SECURITY MIDDLEWARE ====================

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || true, // Allow all in dev, configure in production
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Security headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for React dev
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.coingecko.com", "https://pro-api.coingecko.com", "https://*.supabase.co", "wss://*.supabase.co"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for external images
  })
);

// Global rate limiting (100 requests per minute per IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", globalLimiter);

// Stricter rate limiting for analysis endpoint (10 per minute)
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Analysis rate limit exceeded. Please wait before starting another analysis." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/analyze", analysisLimiter);

// Request body size limits
app.use(
  express.json({
    limit: "2mb", // Allow larger payloads for share images
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize storage (PostgreSQL if DATABASE_URL is set, otherwise in-memory)
  await initStorage();

  await registerRoutes(httpServer, app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

    // Log the error for debugging
    console.error(`[ERROR] ${status}: ${err.message}`, err.stack);

    // Don't expose internal errors to clients in production
    res.status(status).json({ message });
    // Removed: throw err - this would crash the server
  });

  // Health check endpoint for load balancers / monitoring
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Handle port in use error gracefully with max retries
  let portRetryCount = 0;
  const MAX_PORT_RETRIES = 5;

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      portRetryCount++;
      if (portRetryCount >= MAX_PORT_RETRIES) {
        console.error(`Port ${port} is still in use after ${MAX_PORT_RETRIES} attempts. Exiting.`);
        console.error(`To fix: Stop all running processes and restart the app.`);
        process.exit(1);
      }
      log(`Port ${port} is in use, retrying in 2 seconds... (attempt ${portRetryCount}/${MAX_PORT_RETRIES})`);
      setTimeout(() => {
        httpServer.close();
        httpServer.listen({ port, host: "0.0.0.0", reusePort: true });
      }, 2000);
    } else {
      throw err;
    }
  });

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);

      // Recover any stuck analyses from previous server runs
      // Run after a short delay to let everything initialize
      setTimeout(async () => {
        try {
          await recoverStuckAnalyses();
        } catch (err) {
          console.error("Error during analysis recovery:", err);
        }
      }, 5000);
    },
  );

  // ==================== GRACEFUL SHUTDOWN ====================
  const gracefulShutdown = async (signal: string) => {
    log(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(async () => {
      log("HTTP server closed");

      // Close database connections
      try {
        await closeDb();
        log("Database connections closed");
      } catch (err) {
        console.error("Error closing database:", err);
      }

      log("Graceful shutdown complete");
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
