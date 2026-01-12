-- Performance Tracking Migration
-- Adds tables and fields for tracking historical token prices and performance metrics

-- ============================================================
-- PRICE SNAPSHOTS TABLE
-- Daily price snapshots for all leaderboard tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS "price_snapshots" (
  "id" serial PRIMARY KEY,
  "token_id" text NOT NULL,
  "price_usd" numeric(20, 10) NOT NULL,
  "market_cap" numeric(20, 2),
  "fdv" numeric(20, 2),
  "volume_24h" numeric(20, 2),
  "snapshot_date" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_price_snapshots_token_date"
  ON "price_snapshots" ("token_id", "snapshot_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_price_snapshots_date"
  ON "price_snapshots" ("snapshot_date" DESC);
-- Prevent duplicate snapshots for same token on same day
CREATE UNIQUE INDEX IF NOT EXISTS "idx_price_snapshots_unique_token_date"
  ON "price_snapshots" ("token_id", "snapshot_date");

-- ============================================================
-- PERFORMANCE METRICS TABLE
-- Cached aggregate metrics calculated daily
-- ============================================================

CREATE TABLE IF NOT EXISTS "performance_metrics" (
  "id" serial PRIMARY KEY,
  "metric_date" text NOT NULL,
  "top10_avg_7d_return" numeric(10, 4),
  "top10_avg_30d_return" numeric(10, 4),
  "hit_rate_7d" numeric(5, 2),
  "hit_rate_30d" numeric(5, 2),
  "tier_metrics" jsonb,
  "total_tokens" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Unique index for metric date (one record per day)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_performance_metrics_date"
  ON "performance_metrics" ("metric_date");

-- ============================================================
-- ADD PRICE AT ANALYSIS TO TOKEN_ANALYSES
-- Records the price when analysis was first created
-- ============================================================

ALTER TABLE "token_analyses"
  ADD COLUMN IF NOT EXISTS "price_at_analysis" numeric(20, 10);

-- ============================================================
-- BACKFILL PRICE AT ANALYSIS FROM CURRENT PRICE
-- For existing completed analyses, copy current_price to price_at_analysis
-- ============================================================

UPDATE "token_analyses"
SET "price_at_analysis" = "current_price"
WHERE "status" = 'completed'
  AND "current_price" IS NOT NULL
  AND "price_at_analysis" IS NULL;
