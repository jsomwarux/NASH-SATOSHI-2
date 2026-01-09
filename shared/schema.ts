import { pgTable, text, serial, timestamp, numeric, jsonb, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription Tiers Configuration
// Pricing based on ~$1.81 cost per analysis (560 Gumloop credits)
// All tiers get full leaderboard access - it's a free "crypto screener" habit builder
export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    // Free tier: 7-day trial (1/day), then 1/week (4/month)
    trialDays: 7,
    trialAnalysesPerDay: 1,
    postTrialAnalysesPerWeek: 1, // ~4/month after trial
    analysesPerMonth: null, // Dynamic based on trial status
    tagline: 'Explore the leaderboard. Try a few runs.',
    features: [
      'Unlimited leaderboard + token search',
      '7-day trial: 1 analysis/day (starts on first run)',
      'After trial: 1 analysis/week',
    ],
    leaderboardLimit: null,
    popular: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    analysesPerMonth: 10, // $18.10 COGS, $49 revenue = 63% margin
    tagline: 'For casual scanning and watchlists.',
    features: [
      '10 analyses per month',
      'View your full analysis history',
    ],
    leaderboardLimit: null,
    popular: false,
  },
  trader: {
    id: 'trader',
    name: 'Trader',
    price: 99,
    analysesPerMonth: 25, // $45.25 COGS, $99 revenue = 54% margin
    tagline: 'Best for active traders tracking multiple tokens.',
    features: [
      '25 analyses per month',
      'Built for daily market checks',
    ],
    leaderboardLimit: null,
    popular: true, // Sweet spot tier
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 199,
    analysesPerMonth: 60, // $108.60 COGS, $199 revenue = 45% margin
    tagline: 'For serious daily research.',
    features: [
      '60 analyses per month',
      'Great for full market sweeps',
    ],
    leaderboardLimit: null,
    popular: false,
  },
  desk: {
    id: 'desk',
    name: 'Desk',
    price: 399,
    analysesPerMonth: 120, // $217.20 COGS, $399 revenue = 46% margin
    tagline: 'High-volume research for power users.',
    features: [
      '120 analyses per month',
      'Ideal for running many comparisons',
    ],
    leaderboardLimit: null,
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
  xMentionsTrend: text("x_mentions_trend"), // ↑/↓/→
  xSentiment: text("x_sentiment"), // positive/mixed/negative
  xTopKols: text("x_top_kols"), // influencer mentions

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
  marketCapModifier: numeric("market_cap_modifier", { precision: 5, scale: 2 }), // -15 to +5, large caps penalized

  // Market cap scaling
  marketCapTier: text("market_cap_tier"), // mega, large, mid, small
  scoreCapped: boolean("score_capped"), // true if score was capped due to market cap
  uncappedScore: numeric("uncapped_score", { precision: 5, scale: 2 }), // original score before cap

  // Game theory analysis
  equilibriumType: text("equilibrium_type"),
  equilibriumEvolution: text("equilibrium_evolution"),
  playerMap: text("player_map"),
  dominantStrategies: text("dominant_strategies"),
  coordinationRisks: jsonb("coordination_risks").$type<string[]>(),
  catalysts: jsonb("catalysts").$type<string[]>(),

  // Recommendations
  recommendation: text("recommendation"), // BUY, HOLD, AVOID
  displaySummary: text("display_summary"),
  verdict: text("verdict"),
  reasoning: text("reasoning"),

  // Model consensus
  modelScores: jsonb("model_scores").$type<ModelScores>(),
  modelAnalyses: jsonb("model_analyses").$type<ModelAnalyses>(),

  // Market data snapshot
  currentPrice: numeric("current_price", { precision: 20, scale: 10 }),
  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  fdv: numeric("fdv", { precision: 20, scale: 2 }),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }),
  priceChange24h: numeric("price_change_24h", { precision: 10, scale: 4 }),
  priceChange7d: numeric("price_change_7d", { precision: 10, scale: 4 }),
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
  latestAnalysisId: number;
  latestAnalysisDate: string; // ISO date string from API
}
