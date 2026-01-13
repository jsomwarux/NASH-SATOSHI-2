-- Migration: End Beta Mode - Convert beta_free users to free tier
-- Run this migration BEFORE or AFTER setting BETA_MODE=false
-- This converts all users who signed up during beta to the standard free tier

-- Convert all beta_free users to free tier
UPDATE user_subscriptions
SET tier = 'free',
    updated_at = NOW()
WHERE tier = 'beta_free';

-- Log how many users were converted (for verification)
-- You can run this SELECT before the UPDATE to see the count:
-- SELECT COUNT(*) as beta_users_to_convert FROM user_subscriptions WHERE tier = 'beta_free';
