-- Production Database Indexes for Nash Satoshi
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- These indexes dramatically improve query performance at scale

-- ============================================================
-- USER_SUBSCRIPTIONS TABLE
-- ============================================================

-- Primary lookup: Find subscription by user ID (used on every authenticated request)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
ON user_subscriptions(user_id);

-- Stripe webhook lookups: Find by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id
ON user_subscriptions(stripe_customer_id);

-- Stripe webhook lookups: Find by Stripe subscription ID
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id
ON user_subscriptions(stripe_subscription_id);

-- ============================================================
-- DAILY_USAGE TABLE
-- ============================================================

-- Composite index: Check daily usage for a user on a specific date
-- This is the most common query for free tier limit checking
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
ON daily_usage(user_id, date);

-- ============================================================
-- CREDIT_PURCHASES TABLE
-- ============================================================

-- Lookup purchases by user (for history display)
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
ON credit_purchases(user_id);

-- ============================================================
-- TOKEN_ANALYSES TABLE (Main table - most important!)
-- ============================================================

-- Lookup by token ID (find all analyses for a token)
CREATE INDEX IF NOT EXISTS idx_token_analyses_token_id
ON token_analyses(token_id);

-- Lookup by Gumloop run ID (webhook completion callback)
CREATE INDEX IF NOT EXISTS idx_token_analyses_gumloop_run_id
ON token_analyses(gumloop_run_id);

-- Lookup by user ID + ordered by date (user's analysis history)
CREATE INDEX IF NOT EXISTS idx_token_analyses_user_id_created
ON token_analyses(user_id, created_at DESC);

-- Status filter (find pending/processing analyses for polling)
CREATE INDEX IF NOT EXISTS idx_token_analyses_status
ON token_analyses(status);

-- Leaderboard queries: status + created_at for time-based filters
CREATE INDEX IF NOT EXISTS idx_token_analyses_status_created
ON token_analyses(status, created_at DESC);

-- Leaderboard filtering: tier + status (common filter combination)
CREATE INDEX IF NOT EXISTS idx_token_analyses_tier_status
ON token_analyses(tier, status);

-- Leaderboard filtering: chain + status
CREATE INDEX IF NOT EXISTS idx_token_analyses_chain_status
ON token_analyses(chain, status);

-- Leaderboard stats: narrative grouping for "hot narrative" calculation
CREATE INDEX IF NOT EXISTS idx_token_analyses_narrative_status
ON token_analyses(narrative, status);

-- Leaderboard: token type filter (UTILITY vs MEMECOIN)
CREATE INDEX IF NOT EXISTS idx_token_analyses_token_type_status
ON token_analyses(token_type, status);

-- Leaderboard: market cap tier filter
CREATE INDEX IF NOT EXISTS idx_token_analyses_market_cap_tier_status
ON token_analyses(market_cap_tier, status);

-- Composite for leaderboard aggregation (most complex query)
-- Groups by token_id, filters by status, orders by score
CREATE INDEX IF NOT EXISTS idx_token_analyses_leaderboard
ON token_analyses(status, token_id, final_score DESC, created_at DESC);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Run this to verify all indexes were created:
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('user_subscriptions', 'daily_usage', 'credit_purchases', 'token_analyses')
ORDER BY tablename, indexname;
