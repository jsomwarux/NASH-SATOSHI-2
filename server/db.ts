import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Only create pool if DATABASE_URL is available
const dbUrl = process.env.DATABASE_URL;

// Parse URL and pass individual params to handle usernames with dots (Supabase pooler)
let pool: pg.Pool | null = null;
if (dbUrl) {
  // Check if SSL should be disabled (local Replit DB)
  const sslDisabled = dbUrl.includes('sslmode=disable');

  try {
    const url = new URL(dbUrl);
    pool = new Pool({
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1).split('?')[0], // Remove query params from database name
      ssl: sslDisabled ? false : { rejectUnauthorized: false },
      options: '-c search_path=public', // Ensure we use public schema
    });
  } catch (e) {
    // Fallback to connection string if URL parsing fails
    pool = new Pool({
      connectionString: dbUrl,
      ssl: sslDisabled ? false : { rejectUnauthorized: false },
    });
  }
}

export const db = pool ? drizzle(pool, { schema }) : null;

export async function testConnection(): Promise<boolean> {
  if (!pool) {
    console.log("No DATABASE_URL configured, using in-memory storage");
    return false;
  }

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");

    // Check if table exists
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'token_analyses'
    `);

    if (tablesResult.rows.length === 0) {
      console.log("Creating token_analyses table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS "token_analyses" (
          "id" serial PRIMARY KEY NOT NULL,
          "token_id" text NOT NULL,
          "token_symbol" text NOT NULL,
          "token_name" text NOT NULL,
          "token_image" text,
          "chain" text,
          "contract_address" text,
          "final_score" numeric(6, 2) NOT NULL,
          "tier" text NOT NULL,
          "phase" integer,
          "phase_name" text,
          "narrative" text,
          "narrative_heat" numeric(4, 1),
          "narrative_acceleration" text,
          "peak_proximity" numeric(5, 2),
          "winning_side" text,
          "consensus_level" text,
          "confidence" text,
          "coordination_score" numeric(5, 2),
          "schelling_rank_score" numeric(5, 2),
          "schelling_position" text,
          "reflexivity_score" numeric(5, 2),
          "virality_score" numeric(5, 2),
          "asymmetry_score" numeric(5, 2),
          "asymmetry_floor" text,
          "asymmetry_ceiling" text,
          "game_theory_bonus" numeric(5, 2),
          "phase_modifier" numeric(5, 2),
          "narrative_modifier" numeric(5, 2),
          "exit_liquidity_modifier" numeric(5, 2),
          "peak_proximity_modifier" numeric(5, 2),
          "data_quality_modifier" numeric(5, 2),
          "equilibrium_type" text,
          "equilibrium_evolution" text,
          "player_map" text,
          "dominant_strategies" text,
          "coordination_risks" jsonb,
          "catalysts" jsonb,
          "recommendation" text,
          "display_summary" text,
          "verdict" text,
          "reasoning" text,
          "model_scores" jsonb,
          "current_price" numeric(20, 10),
          "market_cap" numeric(20, 2),
          "fdv" numeric(20, 2),
          "volume_24h" numeric(20, 2),
          "price_change_24h" numeric(10, 4),
          "price_change_7d" numeric(10, 4),
          "categories" jsonb,
          "status" text DEFAULT 'pending' NOT NULL,
          "gumloop_run_id" text,
          "raw_gumloop_response" text,
          "user_id" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log("Table token_analyses created successfully");
    } else {
      console.log("Table token_analyses exists");
    }

    // Create subscription-related tables
    console.log("Ensuring subscription tables exist...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL UNIQUE,
        "tier" text DEFAULT 'free' NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "stripe_customer_id" text,
        "stripe_subscription_id" text,
        "stripe_price_id" text,
        "current_period_start" timestamp,
        "current_period_end" timestamp,
        "cancel_at_period_end" boolean DEFAULT false,
        "monthly_analyses_used" integer DEFAULT 0,
        "monthly_reset_date" date,
        "credit_balance" integer DEFAULT 0,
        "trial_start_date" date,
        "weekly_analyses_used" integer DEFAULT 0,
        "weekly_reset_date" date,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "daily_usage" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "date" date NOT NULL,
        "analyses_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "credit_purchases" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "pack_id" text NOT NULL,
        "credits" integer NOT NULL,
        "amount_paid" integer NOT NULL,
        "stripe_payment_intent_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log("Subscription tables ready");

    client.release();
    console.log("PostgreSQL connection successful");
    return true;
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    return false;
  }
}
