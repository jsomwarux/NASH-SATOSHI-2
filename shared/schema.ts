import { pgTable, text, serial, timestamp, numeric, jsonb, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription Tiers Configuration
// Access-based model: users pay for leaderboard/scorecard access and voting
export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    leaderboardAccess: 10, // Top 10 only
    votesPerDay: 1,
    priorityVotes: false,
    tagline: 'Explore the top-ranked tokens.',
    features: [
      'Top 10 leaderboard',
      'Top 10 scorecards',
      '1 vote per day',
    ],
    popular: false,
  },
  beta_free: {
    id: 'beta_free',
    name: 'Beta Access',
    price: 0,
    priceId: null,
    leaderboardAccess: null, // FULL ACCESS (unlimited) during beta
    votesPerDay: 1, // 1 vote per day during beta
    priorityVotes: false, // No 2x weight during beta
    tagline: 'Full access during beta period.',
    features: [
      'Full rankings access',
      'All scorecards',
      '1 vote per day',
    ],
    popular: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19,
    leaderboardAccess: null, // Unlimited
    votesPerDay: 5,
    priorityVotes: false,
    tagline: 'Full access to all rankings and analysis.',
    features: [
      'Full leaderboard access',
      'All scorecards',
      '5 votes per day',
      'Watchlist (10 tokens)',
    ],
    popular: true,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 49,
    leaderboardAccess: null, // Unlimited
    votesPerDay: 15,
    priorityVotes: true, // Votes count 2x
    tagline: 'Power user features with priority voting.',
    features: [
      'Everything in Pro',
      '15 votes per day',
      'Priority votes (2x weight)',
      'Unlimited watchlist',
      'Data export',
    ],
    popular: false,
  },
} as const;

// Credit Packs for top-ups (never "unlimited")
export const CREDIT_PACKS = {
  pack10: {
    id: 'pack10',
    name: '10 Credits',
    credits: 10,
    price: 59, // $5.90 per analysis
    popular: false,
  },
  pack25: {
    id: 'pack25',
    name: '25 Credits',
    credits: 25,
    price: 129, // $5.16 per analysis
    popular: true,
  },
  pack60: {
    id: 'pack60',
    name: '60 Credits',
    credits: 60,
    price: 249, // $4.15 per analysis
    popular: false,
  },
} as const;

export type SubscriptionTierId = keyof typeof SUBSCRIPTION_TIERS;
export type CreditPackId = keyof typeof CREDIT_PACKS;

// User Subscriptions Table
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Supabase auth user ID

  // Subscription details
  tier: text("tier").notNull().default("free"), // free, starter, trader, pro, desk
  status: text("status").notNull().default("active"), // active, canceled, past_due, trialing

  // Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),

  // Billing period
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),

  // Usage tracking for monthly limits (paid tiers)
  monthlyAnalysesUsed: integer("monthly_analyses_used").default(0),
  monthlyResetDate: date("monthly_reset_date"),

  // Credit balance for top-ups
  creditBalance: integer("credit_balance").default(0),

  // Trial tracking for free tier
  trialStartDate: date("trial_start_date"), // When user first signed up
  weeklyAnalysesUsed: integer("weekly_analyses_used").default(0),
  weeklyResetDate: date("weekly_reset_date"),

  // Referral tracking
  referredBy: text("referred_by"), // Affiliate/referral code that brought this user

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Daily Usage Tracking Table (for free tier trial daily limits)
export const dailyUsage = pgTable("daily_usage", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  analysesCount: integer("analyses_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Credit Purchase History
export const creditPurchases = pgTable("credit_purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  packId: text("pack_id").notNull(), // pack10, pack25, pack60
  credits: integer("credits").notNull(),
  amountPaid: integer("amount_paid").notNull(), // in cents
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for subscriptions
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserSubscriptionSchema = createSelectSchema(userSubscriptions);

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

export const insertDailyUsageSchema = createInsertSchema(dailyUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyUsage = z.infer<typeof insertDailyUsageSchema>;
export type DailyUsage = typeof dailyUsage.$inferSelect;

export const insertCreditPurchaseSchema = createInsertSchema(creditPurchases).omit({
  id: true,
  createdAt: true,
});

export type InsertCreditPurchase = z.infer<typeof insertCreditPurchaseSchema>;
export type CreditPurchase = typeof creditPurchases.$inferSelect;

// User usage/limits response type
export interface UserUsageInfo {
  tier: SubscriptionTierId;
  tierName: string;
  isSubscribed: boolean;
  // For free tier trial
  isInTrial: boolean;
  trialDaysRemaining: number | null;
  // Daily limit (free tier during trial)
  dailyLimit: number | null;
  dailyUsed: number;
  dailyRemaining: number | null;
  // Weekly limit (free tier after trial)
  weeklyLimit: number | null;
  weeklyUsed: number;
  weeklyRemaining: number | null;
  // Monthly limit (paid tiers)
  monthlyLimit: number | null;
  monthlyUsed: number;
  monthlyRemaining: number | null;
  // Credit balance
  creditBalance: number;
  // Can analyze (considering all limits + credits)
  canAnalyze: boolean;
  leaderboardLimit: number | null; // null = unlimited (all tiers)
}

// Token Analysis Table - matches Gumloop output structure
export const tokenAnalyses = pgTable("token_analyses", {
  id: serial("id").primaryKey(),

  // Token identifiers
  tokenId: text("token_id").notNull(), // CoinGecko ID
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  tokenImage: text("token_image"),
  chain: text("chain"),
  contractAddress: text("contract_address"),

  // Primary scores
  finalScore: numeric("final_score", { precision: 6, scale: 2 }).notNull(),
  tier: text("tier").notNull(), // S+, S, A, B, C
  tokenType: text("token_type"), // UTILITY or MEMECOIN

  // Phase data
  phase: integer("phase"), // 1-5
  phaseName: text("phase_name"), // Stealth, Expansion, Mania, Distribution, Dead

  // Narrative data
  narrative: text("narrative"),
  narrativeHeat: numeric("narrative_heat", { precision: 4, scale: 1 }), // 1-10
  narrativeRank: text("narrative_rank"), // 1st/2nd/3rd/lower
  narrativeAcceleration: text("narrative_acceleration"),

  // Sub-narrative classification (hierarchical narrative support)
  primaryNarrative: text("primary_narrative"),           // Broad category (e.g., "AI Agents")
  subNarrative: text("sub_narrative"),                   // Specific classification (e.g., "Agent Payments / x402")
  subNarrativeCeiling: text("sub_narrative_ceiling"),    // Peak FDV for sub-narrative leader (e.g., "$500M")
  subNarrativeConsensus: text("sub_narrative_consensus"), // Notes on model agreement

  // Project context (thesis)
  thesis: text("thesis"), // 2-3 sentence project description

  // Catalysts (individual fields from Gumloop)
  catalyst1: text("catalyst_1"),
  catalyst2: text("catalyst_2"),
  catalyst3: text("catalyst_3"),

  // Risks (individual fields from Gumloop)
  risk1: text("risk_1"),
  risk2: text("risk_2"),
  risk3: text("risk_3"),

  // Social signals
  xMentionsTrend: text("x_mentions_trend"), // ↑/↓/→ (deprecated, often N/A)
  xSentiment: text("x_sentiment"), // positive/mixed/negative (deprecated, often N/A)
  xTopKols: text("x_top_kols"), // influencer mentions
  communityStatus: text("community_status"), // Very Active/Active/Moderate/Low/Dead
  accountQuality: text("account_quality"), // Builders/Researchers, Traders/Degens, Mixed Quality, etc.

  // X Research qualitative fields (NEW - replacing numeric versions)
  engagementQuality: text("engagement_quality"), // "High", "Moderate", "Low", "Bot-Heavy"
  overallSentiment: text("overall_sentiment"), // "Strongly Bullish", "Bullish", "Mixed", "Bearish", "Strongly Bearish"
  cultVsMercenary: text("cult_vs_mercenary"), // "Cult-Heavy", "Mercenary-Heavy", "Balanced Mix", "Unable to Assess"

  // X Research flexible format fields (can be numeric OR qualitative)
  sentimentBullishRatio: text("sentiment_bullish_ratio"), // "72%" or "High (~70%+)"
  sentimentBearishRatio: text("sentiment_bearish_ratio"), // "8%" or "Low (<10%)"
  sentimentNeutralRatio: text("sentiment_neutral_ratio"), // "20%" or "Moderate (~40-70%)"
  likesPerPostAvg: text("likes_per_post_avg"), // "150" or "High (hundreds+)"
  retweetsPerPostAvg: text("retweets_per_post_avg"), // "45" or "Moderate (tens)"
  repliesPerPostAvg: text("replies_per_post_avg"), // "12" or "Low (minimal)"
  cultMercenaryRatio: text("cult_mercenary_ratio"), // "80% cult / 20% mercenary" or "Cult-Heavy"
  sentimentSampleSize: text("sentiment_sample_size"), // "25" or "~20 posts observed"

  // Team/Project info
  unlockWarning: text("unlock_warning"),
  teamStatus: text("team_status"),
  notableBackers: text("notable_backers"),

  // Key metrics
  peakProximity: numeric("peak_proximity", { precision: 5, scale: 2 }), // percentage
  winningSide: text("winning_side"), // USER, AT_RISK, EXIT_LIQ
  consensusLevel: text("consensus_level"), // HIGH, MIXED, LOW, CONFLICTED
  confidence: text("confidence"), // H, M, L

  // Component scores (out of their max)
  coordinationScore: numeric("coordination_score", { precision: 5, scale: 2 }), // 0-20
  schellingRankScore: numeric("schelling_rank_score", { precision: 5, scale: 2 }), // 0-10
  schellingPosition: text("schelling_position"),
  reflexivityScore: numeric("reflexivity_score", { precision: 5, scale: 2 }), // 0-15
  viralityScore: numeric("virality_score", { precision: 5, scale: 2 }), // 0-15
  asymmetryScore: numeric("asymmetry_score", { precision: 5, scale: 2 }), // 0-25
  asymmetryFloor: text("asymmetry_floor"),
  asymmetryCeiling: text("asymmetry_ceiling"),
  gameTheoryBonus: numeric("game_theory_bonus", { precision: 5, scale: 2 }), // 0-15

  // Modifiers
  phaseModifier: numeric("phase_modifier", { precision: 5, scale: 2 }),
  narrativeModifier: numeric("narrative_modifier", { precision: 5, scale: 2 }),
  exitLiquidityModifier: numeric("exit_liquidity_modifier", { precision: 5, scale: 2 }),
  peakProximityModifier: numeric("peak_proximity_modifier", { precision: 5, scale: 2 }),
  dataQualityModifier: numeric("data_quality_modifier", { precision: 5, scale: 2 }),
  marketCapModifier: numeric("market_cap_modifier", { precision: 5, scale: 2 }), // deprecated, use fdvModifier
  fdvModifier: numeric("fdv_modifier", { precision: 5, scale: 2 }), // -15 to +5, large FDV penalized

  // FDV scaling (replaces market cap scaling)
  fdvTier: text("fdv_tier"), // nano, micro, small, mid, large, mega
  marketCapTier: text("market_cap_tier"), // deprecated, kept for backward compatibility
  scoreCapped: boolean("score_capped"), // true if score was capped due to market cap
  uncappedScore: numeric("uncapped_score", { precision: 5, scale: 2 }), // original score before cap

  // Upside Assessment (from Stage 4)
  currentFdv: text("current_fdv"), // e.g., "$5M", "$44.33M"
  realisticPeakFdv: text("realistic_peak_fdv"), // e.g., "$500M"
  upsideMultiple: text("upside_multiple"), // e.g., "10x", "50x", "100x"
  upsideTier: text("upside_tier"), // "<5x", "5-10x", "10-25x", "25-50x", "50-100x", "100x+"

  // New Stage 4 fields
  narrativeDurability: text("narrative_durability"), // "High", "Medium", "Low"
  kolMentionRecency: text("kol_mention_recency"), // "Last 7 days", "Last 30 days", etc.
  distributionWarning: text("distribution_warning"), // "DISTRIBUTION SIGNAL DETECTED" or null
  scoreCalculation: text("score_calculation"), // LLM arithmetic work for final score verification

  // Game theory analysis
  equilibriumType: text("equilibrium_type"),
  equilibriumEvolution: text("equilibrium_evolution"),
  playerMap: text("player_map"),
  dominantStrategies: text("dominant_strategies"),
  coordinationRisks: jsonb("coordination_risks").$type<string[]>(),
  catalysts: jsonb("catalysts").$type<string[]>(),

  // Recommendations
  recommendation: text("recommendation"), // BUY, CAUTIOUS BUY, HOLD, AVOID
  displaySummary: text("display_summary"),
  verdict: text("verdict"),
  reasoning: text("reasoning"),

  // Model consensus
  modelScores: jsonb("model_scores").$type<ModelScores>(),
  modelAnalyses: jsonb("model_analyses").$type<ModelAnalyses>(),

  // Model divergence metrics (NEW)
  scoreSpread: numeric("score_spread", { precision: 6, scale: 2 }), // Difference between highest and lowest model scores
  divergenceFlag: text("divergence_flag"), // "HIGH" (>15 pts), "MODERATE" (10-15 pts), "LOW" (<10 pts)
  divergenceNote: text("divergence_note"), // Explanation when divergence is HIGH

  // Market data snapshot
  currentPrice: numeric("current_price", { precision: 20, scale: 10 }),
  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  fdv: numeric("fdv", { precision: 20, scale: 2 }),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }),
  priceChange24h: numeric("price_change_24h", { precision: 10, scale: 4 }),
  priceChange7d: numeric("price_change_7d", { precision: 10, scale: 4 }),
  priceAtAnalysis: numeric("price_at_analysis", { precision: 20, scale: 10 }), // Price when analysis was created
  categories: jsonb("categories").$type<string[]>(),

  // Analysis status
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  gumloopRunId: text("gumloop_run_id"),
  rawGumloopResponse: text("raw_gumloop_response"),

  // Error tracking for failed analyses
  errorMessage: text("error_message"), // Detailed error reason
  errorCode: text("error_code"), // TIMEOUT, API_ERROR, GUMLOOP_ERROR, RATE_LIMIT, EMPTY_OUTPUT, TERMINATED
  retryCount: integer("retry_count").default(0), // Number of retry attempts
  chargeType: text("charge_type"), // 'daily', 'weekly', 'monthly', 'credit' - what to charge on success

  // User association (Supabase user ID)
  userId: text("user_id"), // Supabase auth user ID

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Model Scores Interface
export interface ModelScores {
  gpt?: number;
  claude?: number;
  gemini?: number;
  grok?: number;
}

// Model Analysis Interface - detailed analysis from each model
export interface ModelAnalysis {
  score: number;
  verdict?: string;
  reasoning?: string;
  risks?: string[];
}

// Full Model Analyses - one entry per model
export interface ModelAnalyses {
  gpt?: ModelAnalysis;
  claude?: ModelAnalysis;
  gemini?: ModelAnalysis;
  grok?: ModelAnalysis;
}

// Analysis Details for backward compatibility
export interface AnalysisDetails {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  modelResponses?: {
    model: string;
    score: number;
    reasoning: string;
  }[];
  gameTheoryAnalysis?: {
    dominantStrategy: string;
    nashEquilibrium: string;
    payoffMatrix: string;
  };
}

// Zod Schemas
export const insertTokenAnalysisSchema = createInsertSchema(tokenAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const selectTokenAnalysisSchema = createSelectSchema(tokenAnalyses);

export type InsertTokenAnalysis = z.infer<typeof insertTokenAnalysisSchema>;
export type TokenAnalysis = typeof tokenAnalyses.$inferSelect;

// API Request/Response Types
export const analyzeTokenRequestSchema = z.object({
  tokenId: z.string().min(1),
  tokenSymbol: z.string().min(1),
  tokenName: z.string().min(1),
  tokenImage: z.string().optional(),
  chain: z.string().optional(),
  contractAddress: z.string().optional(),
});

export type AnalyzeTokenRequest = z.infer<typeof analyzeTokenRequestSchema>;

export const tokenSearchResultSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  thumb: z.string().optional(),
  large: z.string().optional(),
  market_cap_rank: z.number().nullable().optional(),
});

export type TokenSearchResult = z.infer<typeof tokenSearchResultSchema>;

export const tokenDetailsSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.object({
    thumb: z.string().optional(),
    small: z.string().optional(),
    large: z.string().optional(),
  }).optional(),
  asset_platform_id: z.string().nullable().optional(),
  contract_address: z.string().optional(),
  market_data: z.object({
    current_price: z.object({ usd: z.number() }).optional(),
    market_cap: z.object({ usd: z.number() }).optional(),
    fully_diluted_valuation: z.object({ usd: z.number() }).optional(),
    total_volume: z.object({ usd: z.number() }).optional(),
    price_change_percentage_24h: z.number().optional(),
    price_change_percentage_7d: z.number().optional(),
    circulating_supply: z.number().optional(),
    total_supply: z.number().nullable().optional(),
  }).optional(),
  description: z.object({ en: z.string() }).optional(),
  links: z.object({
    homepage: z.array(z.string()).optional(),
    twitter_screen_name: z.string().optional(),
    telegram_channel_identifier: z.string().optional(),
  }).optional(),
  categories: z.array(z.string()).optional(),
});

export type TokenDetails = z.infer<typeof tokenDetailsSchema>;

// Analysis status response
export const analysisStatusSchema = z.object({
  analysisId: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  message: z.string().optional(),
  startTime: z.string().optional(), // ISO date string of when analysis started
  elapsedSeconds: z.number().optional(), // Seconds since start
  nodesCompleted: z.number().optional(), // Number of workflow nodes completed
  currentNode: z.string().optional(), // Name of currently executing node
});

// Token stats response (aggregate data for tokens with multiple analyses)
export interface TokenStats {
  tokenId: string;
  analysisCount: number;
  averageScore: number;
  score7d: number | null;
  runs7d: number;
  latestAnalysisId: number;
  latestAnalysisDate: string;
}

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

// Leaderboard filter options
export interface LeaderboardFilters {
  tier?: string;
  narrative?: string;
  chain?: string;
  search?: string;
  tokenType?: string;
  marketCapTier?: string;
  upsideTier?: string;
}

// Aggregated leaderboard entry - one per token with average score
export interface AggregatedLeaderboardItem {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  averageScore: number;
  analysisCount: number;
  latestTier: string;
  latestNarrative: string | null;
  latestPrimaryNarrative: string | null;
  latestSubNarrative: string | null;
  latestAnalysisId: number;
  latestAnalysisDate: string; // ISO date string from API
}

// ==================== VOTING SYSTEM ====================
// Token vote requests - users vote for tokens they want analyzed
export const tokenVoteRequests = pgTable("token_vote_requests", {
  id: serial("id").primaryKey(),
  tokenId: text("token_id").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  tokenImage: text("token_image"),
  voteCount: integer("vote_count").default(0),
  priorityVoteCount: integer("priority_vote_count").default(0), // 2x weight votes from premium users
  status: text("status").default("pending"), // pending, analyzing, analyzed, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  analyzedAt: timestamp("analyzed_at"),
  analysisId: integer("analysis_id"), // Link to resulting analysis
});

// Individual votes - track who voted for what
export const tokenVotes = pgTable("token_votes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenVoteRequestId: integer("token_vote_request_id").notNull(),
  isPriorityVote: boolean("is_priority_vote").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily vote tracking - enforce daily limits
export const userDailyVotes = pgTable("user_daily_votes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  votesUsed: integer("votes_used").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for voting
export const insertTokenVoteRequestSchema = createInsertSchema(tokenVoteRequests).omit({
  id: true,
  createdAt: true,
});

export const selectTokenVoteRequestSchema = createSelectSchema(tokenVoteRequests);

export type InsertTokenVoteRequest = z.infer<typeof insertTokenVoteRequestSchema>;
export type TokenVoteRequest = typeof tokenVoteRequests.$inferSelect;

export const insertTokenVoteSchema = createInsertSchema(tokenVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertTokenVote = z.infer<typeof insertTokenVoteSchema>;
export type TokenVote = typeof tokenVotes.$inferSelect;

export const insertUserDailyVotesSchema = createInsertSchema(userDailyVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertUserDailyVotes = z.infer<typeof insertUserDailyVotesSchema>;
export type UserDailyVotes = typeof userDailyVotes.$inferSelect;

// Voting API types
export interface VoteStatus {
  votesRemaining: number;
  votesUsed: number;
  maxVotes: number;
  resetTime: string; // ISO date of next reset
  votedTokenIds: string[];
}

export interface VoteRequest {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
}

// ==================== PERFORMANCE TRACKING ====================
// Track historical prices and performance metrics for credibility

// Daily price snapshots for all leaderboard tokens
export const priceSnapshots = pgTable("price_snapshots", {
  id: serial("id").primaryKey(),
  tokenId: text("token_id").notNull(),
  priceUsd: numeric("price_usd", { precision: 20, scale: 10 }).notNull(),
  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  fdv: numeric("fdv", { precision: 20, scale: 2 }),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }),
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD format
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cached aggregate performance metrics (calculated daily)
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  metricDate: text("metric_date").notNull(), // YYYY-MM-DD
  top10Avg7dReturn: numeric("top10_avg_7d_return", { precision: 10, scale: 4 }),
  top10Avg30dReturn: numeric("top10_avg_30d_return", { precision: 10, scale: 4 }),
  hitRate7d: numeric("hit_rate_7d", { precision: 5, scale: 2 }), // % of BUY recs profitable
  hitRate30d: numeric("hit_rate_30d", { precision: 5, scale: 2 }),
  tierMetrics: jsonb("tier_metrics"), // { "S+": { avg7d, avg30d, count }, ... }
  totalTokens: integer("total_tokens").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for performance tracking
export const insertPriceSnapshotSchema = createInsertSchema(priceSnapshots).omit({
  id: true,
  createdAt: true,
});

export const selectPriceSnapshotSchema = createSelectSchema(priceSnapshots);

export type InsertPriceSnapshot = z.infer<typeof insertPriceSnapshotSchema>;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  createdAt: true,
});

export const selectPerformanceMetricsSchema = createSelectSchema(performanceMetrics);

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

// Tier metrics structure stored in JSONB
export interface TierMetric {
  avg7d: number | null;
  avg30d: number | null;
  count: number;
}

export interface TierMetrics {
  "S+": TierMetric;
  "S": TierMetric;
  "A": TierMetric;
  "B": TierMetric;
  "C": TierMetric;
}

// API response types for performance endpoints
export interface PerformanceSummary {
  top10Avg7dReturn: number | null;
  top10Avg30dReturn: number | null;
  hitRate7d: number | null;
  hitRate30d: number | null;
  tierMetrics: TierMetrics | null;
  totalTokens: number;
  metricDate: string | null;
}

export interface TokenPerformance {
  tokenId: string;
  priceAtFirstAnalysis: number | null;
  priceAtLatestAnalysis: number | null;
  currentPrice: number | null;
  returnSinceFirst: number | null;
  returnSinceLatest: number | null;
  firstAnalysisDate: string | null;
  latestAnalysisDate: string | null;
}

// ==================== USER FEEDBACK ====================
// Feedback and issue reports from users

export const userFeedback = pgTable("user_feedback", {
  id: serial("id").primaryKey(),
  userId: text("user_id"), // Optional - can submit anonymously
  userEmail: text("user_email"), // For follow-up
  type: text("type").notNull(), // 'feedback' | 'issue'
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  tokenSymbol: text("token_symbol"), // For token-specific reports
  analysisId: integer("analysis_id"), // Link to specific analysis
  status: text("status").default("new"), // new, reviewed, resolved
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  createdAt: true,
});

export const selectUserFeedbackSchema = createSelectSchema(userFeedback);

export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;

// ==================== SHARING & REFERRALS ====================
// Track user shares for priority queue access

export const userShares = pgTable("user_shares", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  shareType: text("share_type").notNull(), // 'twitter', 'scorecard_twitter'
  shareUrl: text("share_url"), // The URL that was shared
  tokenSymbol: text("token_symbol"), // If sharing a specific scorecard
  analysisId: integer("analysis_id"), // If sharing a specific analysis
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserShareSchema = createInsertSchema(userShares).omit({
  id: true,
  createdAt: true,
});

export type InsertUserShare = z.infer<typeof insertUserShareSchema>;
export type UserShare = typeof userShares.$inferSelect;

// Referral codes - unique codes for each user
export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  code: text("code").notNull().unique(), // e.g., "abc123"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralCode = typeof referralCodes.$inferSelect;

// Track anonymous visits from referral links
export const referralVisits = pgTable("referral_visits", {
  id: serial("id").primaryKey(),
  referralCode: text("referral_code").notNull(),
  visitorId: text("visitor_id").notNull(), // Anonymous ID from localStorage
  ipHash: text("ip_hash"), // Hashed IP for deduplication
  userAgent: text("user_agent"),
  landingPage: text("landing_page"),
  convertedUserId: text("converted_user_id"), // Set when visitor signs up
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralVisitSchema = createInsertSchema(referralVisits).omit({
  id: true,
  createdAt: true,
});

export type InsertReferralVisit = z.infer<typeof insertReferralVisitSchema>;
export type ReferralVisit = typeof referralVisits.$inferSelect;

// Priority sharer status - users who have verified shares get priority
export const prioritySharers = pgTable("priority_sharers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  verifiedShareCount: integer("verified_share_count").default(0),
  priorityGrantedAt: timestamp("priority_granted_at").defaultNow().notNull(),
  priorityExpiresAt: timestamp("priority_expires_at"), // Optional expiry
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPrioritySharerSchema = createInsertSchema(prioritySharers).omit({
  id: true,
  createdAt: true,
});

export type InsertPrioritySharer = z.infer<typeof insertPrioritySharerSchema>;
export type PrioritySharer = typeof prioritySharers.$inferSelect;

// Referral tier thresholds and rewards (for future paid tiers)
export const REFERRAL_TIERS = {
  bronze: { minReferrals: 3, reward: "1 month free Pro" },
  silver: { minReferrals: 10, reward: "3 months free Pro" },
  gold: { minReferrals: 25, reward: "6 months free Pro" },
  platinum: { minReferrals: 50, reward: "1 year free Pro" },
} as const;

// Minimum verified shares to get priority status
export const PRIORITY_SHARE_THRESHOLD = 1;

// ==================== AUTOMATED REANALYSIS QUEUE ====================
// Queue for scheduled token reanalyses

// Reanalysis priority levels
export const REANALYSIS_PRIORITIES = {
  TOP_25: 1,   // Weekly (every Monday)
  TOP_50: 2,   // Bi-weekly (every 2 weeks)
  TOP_100: 3,  // Monthly (every 4 weeks)
} as const;

export type ReanalysisPriority = typeof REANALYSIS_PRIORITIES[keyof typeof REANALYSIS_PRIORITIES];

// Queue table for scheduled reanalyses
export const reanalysisQueue = pgTable("reanalysis_queue", {
  id: serial("id").primaryKey(),

  // Token being analyzed
  tokenId: text("token_id").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  tokenImage: text("token_image"),
  chain: text("chain"),

  // Queue metadata
  priority: integer("priority").notNull(), // 1=top25 (weekly), 2=top50 (bi-weekly), 3=top100 (monthly)
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed

  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(), // When this reanalysis was scheduled to run
  batchId: text("batch_id"), // Groups items from same scheduling run (e.g., "2026-01-20-week1")

  // Processing tracking
  startedAt: timestamp("started_at"), // When processing began
  completedAt: timestamp("completed_at"), // When processing finished

  // Gumloop integration
  gumloopRunId: text("gumloop_run_id"), // Links to Gumloop for webhook matching
  analysisId: integer("analysis_id"), // Links to resulting tokenAnalysis record

  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReanalysisQueueSchema = createInsertSchema(reanalysisQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectReanalysisQueueSchema = createSelectSchema(reanalysisQueue);

export type InsertReanalysisQueue = z.infer<typeof insertReanalysisQueueSchema>;
export type ReanalysisQueueItem = typeof reanalysisQueue.$inferSelect;

// Reanalysis queue status type
export type ReanalysisQueueStatus = "pending" | "processing" | "completed" | "failed";
