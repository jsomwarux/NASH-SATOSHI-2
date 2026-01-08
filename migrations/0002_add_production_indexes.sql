-- Production Performance Indexes
-- These indexes are critical for query performance at scale

-- Token analyses table indexes
CREATE INDEX IF NOT EXISTS idx_token_analyses_user_id ON token_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_token_analyses_token_id ON token_analyses(token_id);
CREATE INDEX IF NOT EXISTS idx_token_analyses_created_at ON token_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_analyses_final_score ON token_analyses(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_token_analyses_status ON token_analyses(status);
CREATE INDEX IF NOT EXISTS idx_token_analyses_tier ON token_analyses(tier);
CREATE INDEX IF NOT EXISTS idx_token_analyses_gumloop_run_id ON token_analyses(gumloop_run_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_analyses_user_created ON token_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_analyses_status_created ON token_analyses(status, created_at DESC);

-- User subscriptions table indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);

-- Daily usage table indexes
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- Credit purchases table indexes
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_stripe_payment_intent ON credit_purchases(stripe_payment_intent_id);
