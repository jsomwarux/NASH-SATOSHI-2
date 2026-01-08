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
