import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }

    // Configure connection pool for optimal scaling
    // These settings support 1000+ concurrent users
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Pool sizing - adjust based on database tier
      min: 2, // Minimum connections to keep open
      max: parseInt(process.env.DB_POOL_MAX || "20"), // Maximum connections (Neon free tier: 20, paid: higher)
      // Connection lifecycle
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10 seconds
      // Statement timeout to prevent long-running queries
      statement_timeout: 30000, // 30 second query timeout
      // Keep connections alive through firewalls/proxies
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Log pool errors
    pool.on("error", (err) => {
      console.error("Unexpected database pool error:", err);
    });

    // Log when connections are created/removed (helpful for debugging)
    pool.on("connect", () => {
      console.log("New database connection established");
    });

    db = drizzle(pool, { schema });
    console.log(`Database pool initialized (max: ${process.env.DB_POOL_MAX || "20"} connections)`);
  }
  return db;
}

export async function testConnection(): Promise<boolean> {
  try {
    const database = getDb();
    // Simple query to test connection
    await database.execute("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { db };

// ==================== RETRY UTILITY ====================
// Wraps database operations with exponential backoff retry logic
// for handling transient connection errors

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'connection terminated',
    'Connection terminated',
    'timeout expired',
    'Client has encountered a connection error',
    'sorry, too many clients already',
    'remaining connection slots are reserved',
  ],
};

function isRetryableError(error: unknown, retryablePatterns: string[]): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return retryablePatterns.some(pattern =>
    message.includes(pattern.toLowerCase()) || name.includes(pattern.toLowerCase())
  );
}

/**
 * Executes a database operation with automatic retry on transient failures.
 * Uses exponential backoff between retries.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a retryable error
      if (!isRetryableError(error, opts.retryableErrors)) {
        throw error; // Not retryable, fail immediately
      }

      // If we've exhausted retries, throw
      if (attempt >= opts.maxRetries) {
        console.error(`Database operation failed after ${attempt} attempts:`, lastError.message);
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        opts.initialDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs
      );
      const jitter = Math.random() * baseDelay * 0.3; // 30% jitter
      const delay = Math.round(baseDelay + jitter);

      console.warn(
        `Database operation failed (attempt ${attempt}/${opts.maxRetries}), ` +
        `retrying in ${delay}ms: ${lastError.message}`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}
