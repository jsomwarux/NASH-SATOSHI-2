import { eq, and, desc, sql, gte, lte, lt, ilike, or, count, isNotNull, inArray } from "drizzle-orm";
import { getDb, withRetry } from "./db";
import {
  userSubscriptions,
  dailyUsage,
  creditPurchases,
  tokenAnalyses,
  tokenVoteRequests,
  tokenVotes,
  userDailyVotes,
  priceSnapshots,
  performanceMetrics,
  userFeedback,
  userShares,
  referralCodes,
  referralVisits,
  prioritySharers,
  reanalysisQueue,
  SUBSCRIPTION_TIERS,
  PRIORITY_SHARE_THRESHOLD,
  REANALYSIS_PRIORITIES,
  type UserSubscription,
  type InsertUserSubscription,
  type TokenAnalysis,
  type InsertTokenAnalysis,
  type SubscriptionTierId,
  type TokenVoteRequest,
  type InsertTokenVoteRequest,
  type TokenVote,
  type InsertTokenVote,
  type UserDailyVotes,
  type PriceSnapshot,
  type InsertPriceSnapshot,
  type PerformanceMetrics,
  type InsertPerformanceMetrics,
  type UserFeedback,
  type InsertUserFeedback,
  type UserShare,
  type InsertUserShare,
  type ReferralCode,
  type InsertReferralCode,
  type ReferralVisit,
  type InsertReferralVisit,
  type PrioritySharer,
  type InsertPrioritySharer,
  type ReanalysisQueueItem,
  type InsertReanalysisQueue,
  type ReanalysisQueueStatus,
} from "@shared/schema";

// ==================== HELPERS ====================

// Get current date string in EST (YYYY-MM-DD)
// EST is UTC-5
function getESTDateString(): string {
  const now = new Date();
  // Subtract 5 hours to convert UTC to EST
  const estTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return estTime.toISOString().split('T')[0];
}

// Get start of today in EST as a Date object (for timestamp comparisons)
function getESTTodayStart(): Date {
  const estDate = getESTDateString();
  // Midnight EST = 05:00 UTC
  return new Date(`${estDate}T05:00:00.000Z`);
}

// Get yesterday's start and end times in EST
function getESTYesterdayRange(): { start: Date; end: Date } {
  const todayStart = getESTTodayStart();
  // Yesterday start = today start - 24 hours
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  // Yesterday end = today start
  return { start: yesterdayStart, end: todayStart };
}

// ==================== NARRATIVE NORMALIZATION ====================
// Groups similar narratives together for leaderboard stats
// e.g., "AI Agents / Autonomous AI" and "AI Agents" both map to "AI Agents"

// Define canonical narratives and their keyword patterns
const NARRATIVE_MAPPINGS: { canonical: string; keywords: string[] }[] = [
  // AI & Tech narratives - more specific patterns first
  { canonical: "AI Agents", keywords: ["ai agent", "autonomous ai", "ai assistant", "intelligent agent", "artificial intelligence", " ai ", " ai,", "(ai)", "ai/", "ai token", "ai crypto"] },
  { canonical: "AI Infrastructure", keywords: ["ai infra", "ai infrastructure", "machine learning infra", "ml infra", "gpu network", "compute network"] },
  { canonical: "DePIN", keywords: ["depin", "decentralized physical", "physical infrastructure"] },

  // Science & Research
  { canonical: "DeSci", keywords: ["desci", "decentralized science", "science token", "research token", "biotech"] },

  // Finance narratives
  { canonical: "Payments", keywords: ["payment", "neobank", "spending", "remittance", "transfer"] },
  { canonical: "DeFi", keywords: ["defi", "decentralized finance", "yield", "lending", "borrowing", "dex"] },
  { canonical: "RWA", keywords: ["rwa", "real world asset", "tokenized asset", "real-world"] },

  // Privacy & Security
  { canonical: "Privacy", keywords: ["privacy", "confidential", "anonymous", "zero knowledge", "zk"] },

  // Gaming & Entertainment
  { canonical: "Gaming", keywords: ["gaming", "gamefi", "play to earn", "p2e", "metaverse game"] },
  { canonical: "Metaverse", keywords: ["metaverse", "virtual world", "virtual reality", "vr"] },
  { canonical: "NFT", keywords: ["nft", "collectible", "digital art", "pfp"] },

  // Social & Identity
  { canonical: "SocialFi", keywords: ["socialfi", "social finance", "social token", "creator"] },
  { canonical: "Identity", keywords: ["identity", "did", "decentralized identity", "sybil"] },

  // Infrastructure
  { canonical: "L1/L2", keywords: ["layer 1", "layer 2", "l1 ", "l2 ", "rollup", "scaling", "smart contract platform"] },
  { canonical: "Interoperability", keywords: ["interop", "cross-chain", "bridge", "multichain"] },
  { canonical: "Data", keywords: ["data", "oracle", "indexing", "storage", "database"] },

  // Meme & Culture
  { canonical: "Meme", keywords: ["meme", "memecoin", "doge", "shib", "culture"] },
];

// Acronyms that should always be uppercase
const UPPERCASE_ACRONYMS = ["AI", "NFT", "DeFi", "RWA", "DePIN", "DeSci", "DAO", "DEX", "CEX", "APY", "TVL", "ZK"];

/**
 * Normalizes a narrative string to a canonical form for grouping
 * @param narrative - The raw narrative string (e.g., "AI Agents / Autonomous AI")
 * @returns The canonical narrative name (e.g., "AI Agents")
 */
function normalizeNarrative(narrative: string): string {
  if (!narrative) return "Unknown";

  const lowerNarrative = narrative.toLowerCase();

  // Check each mapping for keyword matches
  for (const mapping of NARRATIVE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (lowerNarrative.includes(keyword)) {
        return mapping.canonical;
      }
    }
  }

  // If no mapping found, clean up the narrative:
  // - Take the first part before "/" or "|"
  // - Trim whitespace
  // - Capitalize properly with acronym handling
  const firstPart = narrative.split(/[\/|]/)[0].trim();

  // Title case the result, preserving acronyms
  return firstPart
    .split(' ')
    .map(word => {
      // Check if this word matches any known acronym (case-insensitive)
      const upperWord = word.toUpperCase();
      const matchedAcronym = UPPERCASE_ACRONYMS.find(acr => acr.toUpperCase() === upperWord);
      if (matchedAcronym) {
        return matchedAcronym; // Use the canonical casing
      }
      // Otherwise title case it
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// ==================== END NARRATIVE NORMALIZATION ====================

export interface IStorage {
  // Subscription methods
  getUserSubscription(userId: string): Promise<UserSubscription | null>;
  getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | null>;
  getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | null>;
  createOrUpdateSubscription(data: Partial<InsertUserSubscription> & { userId: string }): Promise<UserSubscription>;
  updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | null>;
  resetMonthlyUsage(userId: string): Promise<void>;
  incrementMonthlyUsage(userId: string): Promise<void>;

  // Daily usage methods (for free tier trial)
  getDailyUsage(userId: string, date: string): Promise<number>;
  incrementDailyUsage(userId: string, date: string): Promise<void>;

  // Weekly usage methods (for free tier post-trial)
  getWeeklyUsage(userId: string): Promise<number>;
  incrementWeeklyUsage(userId: string): Promise<void>;
  resetWeeklyUsage(userId: string): Promise<void>;

  // Credit methods
  addCredits(userId: string, credits: number, packId: string, amountPaid: number, paymentIntentId?: string): Promise<void>;
  useCredit(userId: string): Promise<boolean>;

  // Referral methods
  setReferralCode(userId: string, referralCode: string): Promise<void>;

  // Analysis methods
  createAnalysis(data: InsertTokenAnalysis): Promise<TokenAnalysis>;
  getAnalysis(id: number): Promise<TokenAnalysis | null>;
  getAnalysisByToken(tokenId: string): Promise<TokenAnalysis | null>;
  getAnalysisByRunId(runId: string): Promise<TokenAnalysis | null>;
  getUserAnalyses(userId: string, limit?: number, offset?: number): Promise<{ items: TokenAnalysis[]; total: number }>;
  updateAnalysis(id: number, data: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | null>;
  getRunningAnalysesCount(userId: string): Promise<number>;
  getTotalRunningAnalyses(): Promise<number>;
  getStuckAnalyses(maxAgeMinutes?: number): Promise<TokenAnalysis[]>;
  getStuckAnalysesWithRunId(minAgeMinutes?: number): Promise<TokenAnalysis[]>;
  getAnalysesByTokenId(tokenId: string): Promise<TokenAnalysis[]>;
  getLatestAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | null>;
  getLatestAnalysisByContractAddress(contractAddress: string): Promise<TokenAnalysis | null>;
  getAllAnalyses(limit?: number, offset?: number, status?: string): Promise<{ items: TokenAnalysis[]; total: number }>;

  // Leaderboard methods
  getLeaderboard(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    order?: "asc" | "desc";
    filters?: {
      tier?: string;
      narrative?: string;
      chain?: string;
      search?: string;
      tokenType?: string;
      marketCapTier?: string;
      upsideTier?: string;
    };
  }): Promise<{ items: any[]; total: number }>;
  getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[]; upsideTiers: string[] }>;
  getLeaderboardStats(): Promise<{
    topTokens: { symbol: string; name: string; score: number; daysInTop3: number }[];
    topNarratives: { narrative: string; avgScore: number; tokenCount: number }[];
    winners7d: { symbol: string; name: string; score: number }[];
  }>;

  // Voting methods
  getVoteRequestByTokenId(tokenId: string): Promise<TokenVoteRequest | null>;
  getVoteRequests(options: { limit?: number; offset?: number; status?: string }): Promise<{ items: TokenVoteRequest[]; total: number }>;
  createVoteRequest(data: InsertTokenVoteRequest): Promise<TokenVoteRequest>;
  updateVoteRequest(id: number, data: Partial<InsertTokenVoteRequest>): Promise<TokenVoteRequest | null>;
  incrementVoteCount(requestId: number, isPriority: boolean): Promise<void>;
  hasUserVotedForRequest(userId: string, requestId: number): Promise<boolean>;
  createVote(data: InsertTokenVote): Promise<TokenVote>;
  getUserVotedRequestIds(userId: string): Promise<number[]>;
  getUserDailyVoteCount(userId: string, date: string): Promise<number>;
  incrementUserDailyVotes(userId: string, date: string): Promise<void>;
  getTopVoteRequests(limit?: number): Promise<TokenVoteRequest[]>;
  getRecentlyAnalyzedRequests(limit?: number): Promise<TokenVoteRequest[]>;
  getYesterdayTopVote(): Promise<{ request: TokenVoteRequest; voteCount: number; priorityVoteCount: number; totalScore: number } | null>;
  getYesterdayTopVotedToken(): Promise<TokenVoteRequest | null>;

  // Performance tracking methods
  createPriceSnapshot(data: InsertPriceSnapshot): Promise<PriceSnapshot>;
  getPriceSnapshot(tokenId: string, date: string): Promise<PriceSnapshot | null>;
  getTokenPriceHistory(tokenId: string, days: number): Promise<PriceSnapshot[]>;
  getLatestPriceSnapshot(tokenId: string): Promise<PriceSnapshot | null>;
  getLeaderboardTokenIds(): Promise<string[]>;
  getTokenFirstAnalysis(tokenId: string): Promise<TokenAnalysis | null>;
  getTokensByTier(tier: string): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]>;
  getTokensWithBuyRecommendation(): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]>;
  getLatestPerformanceMetrics(): Promise<PerformanceMetrics | null>;
  savePerformanceMetrics(data: InsertPerformanceMetrics): Promise<PerformanceMetrics>;

  // Feedback methods
  createFeedback(data: InsertUserFeedback): Promise<UserFeedback>;
  getFeedback(limit?: number): Promise<UserFeedback[]>;

  // Sharing methods
  createShare(data: InsertUserShare): Promise<UserShare>;
  getUserShares(userId: string): Promise<UserShare[]>;
  getVerifiedShareCount(userId: string): Promise<number>;
  verifyShare(shareId: number): Promise<UserShare | null>;

  // Referral methods
  getReferralCode(userId: string): Promise<ReferralCode | null>;
  createReferralCode(userId: string, code: string): Promise<ReferralCode>;
  getReferralCodeByCode(code: string): Promise<ReferralCode | null>;
  trackReferralVisit(data: InsertReferralVisit): Promise<ReferralVisit>;
  getReferralVisitByVisitorId(visitorId: string): Promise<ReferralVisit | null>;
  convertReferralVisit(visitorId: string, userId: string): Promise<void>;
  getReferralStats(userId: string): Promise<{ visits: number; conversions: number; returningVisitors: number }>;
  getUserByReferralCode(code: string): Promise<string | null>;

  // Priority sharer methods
  getPrioritySharer(userId: string): Promise<PrioritySharer | null>;
  grantPriorityStatus(userId: string): Promise<PrioritySharer>;
  isPrioritySharer(userId: string): Promise<boolean>;
  updateReferredBy(userId: string, referralCode: string): Promise<void>;

  // Reanalysis queue methods
  addToReanalysisQueue(data: InsertReanalysisQueue): Promise<ReanalysisQueueItem>;
  addBatchToReanalysisQueue(items: InsertReanalysisQueue[]): Promise<ReanalysisQueueItem[]>;
  getReanalysisQueueItem(id: number): Promise<ReanalysisQueueItem | null>;
  getReanalysisQueueItemByRunId(runId: string): Promise<ReanalysisQueueItem | null>;
  getPendingReanalysisItems(limit: number): Promise<ReanalysisQueueItem[]>;
  getProcessingReanalysisCount(): Promise<number>;
  updateReanalysisQueueItem(id: number, data: Partial<InsertReanalysisQueue>): Promise<ReanalysisQueueItem | null>;
  isTokenInReanalysisQueue(tokenId: string): Promise<boolean>;
  getTopTokensForReanalysis(count: number): Promise<{ tokenId: string; tokenSymbol: string; tokenName: string; tokenImage: string | null; chain: string | null; contractAddress: string | null; score: number }[]>;
  getReanalysisQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }>;
  getReanalysisQueueItems(options: { status?: ReanalysisQueueStatus; limit?: number; offset?: number }): Promise<{ items: ReanalysisQueueItem[]; total: number }>;
  cleanupOldQueueItems(daysOld: number): Promise<number>;
}

export class PostgresStorage implements IStorage {
  // ==================== SUBSCRIPTION METHODS ====================

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
      return result[0] || null;
    });
  }

  async getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeCustomerId, customerId))
      .limit(1);
    return result[0] || null;
  }

  async getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return result[0] || null;
  }

  async createOrUpdateSubscription(data: Partial<InsertUserSubscription> & { userId: string }): Promise<UserSubscription> {
    const db = getDb();
    const existing = await this.getUserSubscription(data.userId);

    if (existing) {
      const result = await db
        .update(userSubscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, data.userId))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(userSubscriptions)
        .values({
          userId: data.userId,
          tier: data.tier || "free",
          status: data.status || "active",
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripePriceId: data.stripePriceId,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          monthlyAnalysesUsed: data.monthlyAnalysesUsed || 0,
          monthlyResetDate: data.monthlyResetDate,
          creditBalance: data.creditBalance || 0,
          trialStartDate: data.trialStartDate,
          weeklyAnalysesUsed: data.weeklyAnalysesUsed || 0,
          weeklyResetDate: data.weeklyResetDate,
        })
        .returning();
      return result[0];
    }
  }

  async updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | null> {
    const db = getDb();
    const result = await db
      .update(userSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId))
      .returning();
    return result[0] || null;
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const db = getDb();
    await db
      .update(userSubscriptions)
      .set({
        monthlyAnalysesUsed: 0,
        monthlyResetDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  async incrementMonthlyUsage(userId: string): Promise<void> {
    const db = getDb();
    await db
      .update(userSubscriptions)
      .set({
        monthlyAnalysesUsed: sql`${userSubscriptions.monthlyAnalysesUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  // ==================== DAILY USAGE METHODS ====================

  async getDailyUsage(userId: string, date: string): Promise<number> {
    const db = getDb();
    const result = await db
      .select()
      .from(dailyUsage)
      .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)))
      .limit(1);
    return result[0]?.analysesCount || 0;
  }

  async incrementDailyUsage(userId: string, date: string): Promise<void> {
    const db = getDb();
    const existing = await this.getDailyUsage(userId, date);

    if (existing > 0) {
      await db
        .update(dailyUsage)
        .set({ analysesCount: sql`${dailyUsage.analysesCount} + 1` })
        .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)));
    } else {
      await db.insert(dailyUsage).values({
        userId,
        date,
        analysesCount: 1,
      });
    }
  }

  // ==================== WEEKLY USAGE METHODS ====================

  async getWeeklyUsage(userId: string): Promise<number> {
    const sub = await this.getUserSubscription(userId);
    return sub?.weeklyAnalysesUsed || 0;
  }

  async incrementWeeklyUsage(userId: string): Promise<void> {
    const db = getDb();
    await db
      .update(userSubscriptions)
      .set({
        weeklyAnalysesUsed: sql`${userSubscriptions.weeklyAnalysesUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  async resetWeeklyUsage(userId: string): Promise<void> {
    const db = getDb();
    await db
      .update(userSubscriptions)
      .set({
        weeklyAnalysesUsed: 0,
        weeklyResetDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  // ==================== CREDIT METHODS ====================

  async addCredits(userId: string, credits: number, packId: string, amountPaid: number, paymentIntentId?: string): Promise<void> {
    const db = getDb();

    // Add credits to user's balance
    await db
      .update(userSubscriptions)
      .set({
        creditBalance: sql`${userSubscriptions.creditBalance} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    // Record the purchase
    await db.insert(creditPurchases).values({
      userId,
      packId,
      credits,
      amountPaid,
      stripePaymentIntentId: paymentIntentId,
    });
  }

  async useCredit(userId: string): Promise<boolean> {
    const db = getDb();
    const sub = await this.getUserSubscription(userId);

    if (!sub || (sub.creditBalance || 0) <= 0) {
      return false;
    }

    await db
      .update(userSubscriptions)
      .set({
        creditBalance: sql`${userSubscriptions.creditBalance} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    return true;
  }

  async setReferralCode(userId: string, referralCode: string): Promise<void> {
    const db = getDb();

    // First ensure the user subscription exists
    let sub = await this.getUserSubscription(userId);
    if (!sub) {
      // Create subscription if it doesn't exist
      await this.createOrUpdateSubscription({ userId });
    }

    // Update with referral code (only if not already set)
    await db
      .update(userSubscriptions)
      .set({
        referredBy: sql`COALESCE(${userSubscriptions.referredBy}, ${referralCode})`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));

    console.log(`Referral code "${referralCode}" attached to user ${userId}`);
  }

  // ==================== ANALYSIS METHODS ====================

  async createAnalysis(data: InsertTokenAnalysis): Promise<TokenAnalysis> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db.insert(tokenAnalyses).values(data as any).returning();
      return result[0];
    });
  }

  async getAnalysis(id: number): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(eq(tokenAnalyses.id, id))
        .limit(1);
      return result[0] || null;
    });
  }

  async getAnalysisByToken(tokenId: string): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      // Use case-insensitive comparison for token ID matching
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(sql`LOWER(${tokenAnalyses.tokenId}) = LOWER(${tokenId})`)
        .orderBy(desc(tokenAnalyses.createdAt))
        .limit(1);
      return result[0] || null;
    });
  }

  async getAnalysisByRunId(runId: string): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(eq(tokenAnalyses.gumloopRunId, runId))
        .limit(1);
      return result[0] || null;
    });
  }

  async getUserAnalyses(userId: string, limit = 20, offset = 0): Promise<{ items: TokenAnalysis[]; total: number }> {
    return withRetry(async () => {
      const db = getDb();

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(tokenAnalyses)
          .where(eq(tokenAnalyses.userId, userId))
          .orderBy(desc(tokenAnalyses.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(tokenAnalyses)
          .where(eq(tokenAnalyses.userId, userId)),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
      };
    });
  }

  async updateAnalysis(id: number, data: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .update(tokenAnalyses)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(tokenAnalyses.id, id))
        .returning();
      return result[0] || null;
    });
  }

  async getRunningAnalysesCount(userId: string): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ count: count() })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.userId, userId),
          or(
            eq(tokenAnalyses.status, "pending"),
            eq(tokenAnalyses.status, "processing")
          )
        )
      );
    return result[0]?.count || 0;
  }

  async getTotalRunningAnalyses(): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ count: count() })
      .from(tokenAnalyses)
      .where(
        or(
          eq(tokenAnalyses.status, "pending"),
          eq(tokenAnalyses.status, "processing")
        )
      );
    return result[0]?.count || 0;
  }

  async getStuckAnalyses(maxAgeMinutes: number = 60): Promise<TokenAnalysis[]> {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    const result = await db
      .select()
      .from(tokenAnalyses)
      .where(
        and(
          or(
            eq(tokenAnalyses.status, "pending"),
            eq(tokenAnalyses.status, "processing")
          ),
          lte(tokenAnalyses.createdAt, cutoffTime)
        )
      );
    return result;
  }

  async getStuckAnalysesWithRunId(minAgeMinutes: number = 5): Promise<TokenAnalysis[]> {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - minAgeMinutes * 60 * 1000);

    const result = await db
      .select()
      .from(tokenAnalyses)
      .where(
        and(
          or(
            eq(tokenAnalyses.status, "pending"),
            eq(tokenAnalyses.status, "processing")
          ),
          lte(tokenAnalyses.createdAt, cutoffTime),
          isNotNull(tokenAnalyses.gumloopRunId)
        )
      );
    return result;
  }

  async getAnalysesByTokenId(tokenId: string): Promise<TokenAnalysis[]> {
    return withRetry(async () => {
      const db = getDb();
      // Use case-insensitive comparison for token ID matching
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(
          and(
            sql`LOWER(${tokenAnalyses.tokenId}) = LOWER(${tokenId})`,
            eq(tokenAnalyses.status, "completed")
          )
        )
        .orderBy(desc(tokenAnalyses.createdAt));
      return result;
    });
  }

  async getLatestAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      // Use case-insensitive comparison for token ID matching
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(sql`LOWER(${tokenAnalyses.tokenId}) = LOWER(${tokenId})`)
        .orderBy(desc(tokenAnalyses.createdAt))
        .limit(1);
      return result[0] || null;
    });
  }

  async getLatestAnalysisByContractAddress(contractAddress: string): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      // Use case-insensitive comparison for contract address matching
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(sql`LOWER(${tokenAnalyses.contractAddress}) = LOWER(${contractAddress})`)
        .orderBy(desc(tokenAnalyses.createdAt))
        .limit(1);
      return result[0] || null;
    });
  }

  async getAllAnalyses(limit = 50, offset = 0, status?: string): Promise<{ items: TokenAnalysis[]; total: number }> {
    return withRetry(async () => {
      const db = getDb();

      const conditions = status ? [eq(tokenAnalyses.status, status)] : [];

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(tokenAnalyses)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(tokenAnalyses.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(tokenAnalyses)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
      };
    });
  }

  // ==================== LEADERBOARD METHODS ====================

  async getLeaderboard(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    order?: "asc" | "desc";
    filters?: {
      tier?: string;
      narrative?: string;
      chain?: string;
      search?: string;
      tokenType?: string;
      marketCapTier?: string;
      upsideTier?: string;
    };
  }): Promise<{ items: any[]; total: number }> {
    return withRetry(async () => {
      const db = getDb();
      const { limit = 10000, offset = 0, sortBy = "latestScore", order = "desc", filters } = options;

    // Build WHERE conditions
    const conditions = [eq(tokenAnalyses.status, "completed")];

    if (filters?.tier) {
      conditions.push(eq(tokenAnalyses.tier, filters.tier));
    }
    if (filters?.narrative) {
      conditions.push(eq(tokenAnalyses.narrative, filters.narrative));
    }
    if (filters?.chain) {
      conditions.push(eq(tokenAnalyses.chain, filters.chain));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(tokenAnalyses.tokenName, `%${filters.search}%`),
          ilike(tokenAnalyses.tokenSymbol, `%${filters.search}%`)
        )!
      );
    }
    if (filters?.tokenType) {
      conditions.push(eq(tokenAnalyses.tokenType, filters.tokenType));
    }
    if (filters?.marketCapTier) {
      conditions.push(eq(tokenAnalyses.marketCapTier, filters.marketCapTier));
    }
    // Note: upsideTier filter is applied post-aggregation to filter by LATEST analysis

    // Get aggregated data per token with time-based metrics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all completed analyses
    const query = db
      .select({
        tokenId: tokenAnalyses.tokenId,
        tokenSymbol: tokenAnalyses.tokenSymbol,
        tokenName: tokenAnalyses.tokenName,
        tokenImage: tokenAnalyses.tokenImage,
        chain: tokenAnalyses.chain,
        finalScore: tokenAnalyses.finalScore,
        tier: tokenAnalyses.tier,
        narrative: tokenAnalyses.narrative,
        primaryNarrative: tokenAnalyses.primaryNarrative,
        subNarrative: tokenAnalyses.subNarrative,
        recommendation: tokenAnalyses.recommendation,
        id: tokenAnalyses.id,
        createdAt: tokenAnalyses.createdAt,
        tokenType: tokenAnalyses.tokenType,
        asymmetryScore: tokenAnalyses.asymmetryScore,
        marketCapTier: tokenAnalyses.marketCapTier,
        upsideTier: tokenAnalyses.upsideTier,
        upsideMultiple: tokenAnalyses.upsideMultiple,
      })
      .from(tokenAnalyses)
      .where(and(...conditions))
      .orderBy(desc(tokenAnalyses.createdAt));

    const allResults = await query;

    // Aggregate by tokenId with 7D/30D metrics
    const tokenMap = new Map<string, {
      tokenId: string;
      tokenSymbol: string;
      tokenName: string;
      tokenImage: string | null;
      chain: string | null;
      score7d: number;
      runs7d: number;
      score30d: number;
      runs30d: number;
      confidence: 'high' | 'medium' | 'low';
      latestTier: string;
      latestNarrative: string | null;
      latestPrimaryNarrative: string | null;
      latestSubNarrative: string | null;
      latestRecommendation: string | null;
      latestAnalysisId: number;
      latestAnalysisDate: string;
      latestScore: number;
      previousScore: number | null; // Score from second most recent analysis
      scoreTrend: number | null; // Difference between latest and previous score
      scores7d: number[];
      scores30d: number[];
      tokenType: string | null;
      asymmetryScore: number | null;
      marketCapTier: string | null;
      upsideTier: string | null;
      upsideMultiple: string | null;
    }>();

    for (const row of allResults) {
      const score = parseFloat(row.finalScore as string) || 0;
      const analysisDate = new Date(row.createdAt);
      const isWithin7d = analysisDate >= sevenDaysAgo;
      const isWithin30d = analysisDate >= thirtyDaysAgo;

      if (!tokenMap.has(row.tokenId)) {
        tokenMap.set(row.tokenId, {
          tokenId: row.tokenId,
          tokenSymbol: row.tokenSymbol,
          tokenName: row.tokenName,
          tokenImage: row.tokenImage,
          chain: row.chain,
          score7d: 0,
          runs7d: 0,
          score30d: 0,
          runs30d: 0,
          confidence: 'low',
          latestTier: row.tier || 'B',
          latestNarrative: row.subNarrative || row.narrative, // Prefer subNarrative
          latestPrimaryNarrative: row.primaryNarrative,
          latestSubNarrative: row.subNarrative,
          latestRecommendation: row.recommendation,
          latestAnalysisId: row.id,
          latestAnalysisDate: row.createdAt.toISOString(),
          latestScore: score, // Score from the most recent analysis
          previousScore: null, // Will be set when we see the second analysis
          scoreTrend: null, // Will be calculated after we have previousScore
          scores7d: [],
          scores30d: [],
          tokenType: row.tokenType,
          asymmetryScore: row.asymmetryScore ? parseFloat(row.asymmetryScore as string) : null,
          marketCapTier: row.marketCapTier,
          upsideTier: row.upsideTier,
          upsideMultiple: row.upsideMultiple,
        });
      } else {
        // This is not the first analysis for this token - capture as previousScore if not set
        const item = tokenMap.get(row.tokenId)!;
        if (item.previousScore === null) {
          item.previousScore = score;
          item.scoreTrend = item.latestScore - score;
        }
      }

      const item = tokenMap.get(row.tokenId)!;

      // Add to 7D metrics if within 7 days
      if (isWithin7d) {
        item.scores7d.push(score);
        item.runs7d = item.scores7d.length;
      }

      // Add to 30D metrics if within 30 days
      if (isWithin30d) {
        item.scores30d.push(score);
        item.runs30d = item.scores30d.length;
      }
    }

    // Calculate averages and confidence for each token
    const items: any[] = [];
    const tokenEntries = Array.from(tokenMap.values());
    for (const item of tokenEntries) {
      // Calculate 7D average score
      if (item.scores7d.length > 0) {
        item.score7d = item.scores7d.reduce((a: number, b: number) => a + b, 0) / item.scores7d.length;
      } else {
        // If no 7D runs, use latest score
        item.score7d = item.scores30d.length > 0
          ? item.scores30d[0] // Most recent score from 30D
          : 0;
      }

      // Calculate 30D average score
      if (item.scores30d.length > 0) {
        item.score30d = item.scores30d.reduce((a: number, b: number) => a + b, 0) / item.scores30d.length;
      } else {
        item.score30d = item.score7d; // Fallback to 7D score
      }

      // Calculate confidence based on run count
      const totalRuns = item.runs30d;
      if (totalRuns >= 5) {
        item.confidence = 'high';
      } else if (totalRuns >= 2) {
        item.confidence = 'medium';
      } else {
        item.confidence = 'low';
      }

      // Remove temporary arrays before adding to result
      const { scores7d, scores30d, ...cleanItem } = item;
      items.push(cleanItem);
    }

    // Post-aggregation filter: filter by latest analysis's upside tier
    let filteredItems = items;
    if (filters?.upsideTier) {
      filteredItems = items.filter(item => item.upsideTier === filters.upsideTier);
    }

    // Sort based on sortBy parameter
    filteredItems.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'latestScore':
          comparison = (a.latestScore || 0) - (b.latestScore || 0);
          break;
        case 'score7d':
          comparison = (a.score7d || 0) - (b.score7d || 0);
          break;
        case 'score30d':
          comparison = (a.score30d || 0) - (b.score30d || 0);
          break;
        case 'scoreTrend':
          // Sort by score trend, nulls (new tokens) at the end
          const aTrend = a.scoreTrend;
          const bTrend = b.scoreTrend;
          if (aTrend === null && bTrend === null) comparison = 0;
          else if (aTrend === null) comparison = -1;
          else if (bTrend === null) comparison = 1;
          else comparison = aTrend - bTrend;
          break;
        case 'latestAnalysis':
          comparison = new Date(a.latestAnalysisDate).getTime() - new Date(b.latestAnalysisDate).getTime();
          break;
        case 'tier': {
          // Sort by tier rank: S+ > S > A > B > C
          const tierRank: Record<string, number> = { 'S+': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1 };
          const aRank = tierRank[a.latestTier] || 0;
          const bRank = tierRank[b.latestTier] || 0;
          comparison = aRank - bRank;
          break;
        }
        case 'tokenType': {
          // Sort by type: MEMECOIN before UTILITY (M < U alphabetically)
          const aType = a.tokenType || 'ZZZZ';
          const bType = b.tokenType || 'ZZZZ';
          comparison = aType.localeCompare(bType);
          break;
        }
        case 'asymmetryScore': {
          // Put null values at the end
          const aScore = a.asymmetryScore;
          const bScore = b.asymmetryScore;
          if (aScore === null && bScore === null) comparison = 0;
          else if (aScore === null) comparison = -1; // nulls go to end in desc, start in asc
          else if (bScore === null) comparison = 1;
          else comparison = aScore - bScore;
          break;
        }
        case 'upsideTier': {
          // Sort by actual upside multiple value (extract number from "58x", "100x+", etc.)
          const parseMultiple = (val: string | null): number => {
            if (!val) return 0;
            // Remove 'x' and '+' suffixes, parse as float
            const num = parseFloat(val.replace(/[x+]/gi, ''));
            return isNaN(num) ? 0 : num;
          };
          const aVal = parseMultiple(a.upsideMultiple);
          const bVal = parseMultiple(b.upsideMultiple);
          comparison = aVal - bVal;
          break;
        }
        case 'recommendation': {
          // Sort by recommendation: BUY > HOLD > AVOID
          const aRec = (a.latestRecommendation || '').toUpperCase();
          const bRec = (b.latestRecommendation || '').toUpperCase();
          const aRank = aRec.includes('BUY') ? 3 : aRec.includes('AVOID') ? 1 : 2;
          const bRank = bRec.includes('BUY') ? 3 : bRec.includes('AVOID') ? 1 : 2;
          comparison = aRank - bRank;
          break;
        }
        default:
          comparison = (a.latestScore || 0) - (b.latestScore || 0);
      }

      return order === "desc" ? -comparison : comparison;
    });

    // Paginate
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total: filteredItems.length,
    };
    });
  }

  async getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[]; upsideTiers: string[] }> {
    const db = getDb();

    const [tiersResult, narrativesResult, chainsResult, tokenTypesResult, marketCapTiersResult, upsideTiersResult] = await Promise.all([
      db.selectDistinct({ tier: tokenAnalyses.tier }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ narrative: tokenAnalyses.narrative }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ chain: tokenAnalyses.chain }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ tokenType: tokenAnalyses.tokenType }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ marketCapTier: tokenAnalyses.marketCapTier }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ upsideTier: tokenAnalyses.upsideTier }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
    ]);

    // Sort upside tiers in descending order (highest upside first)
    const upsideTierOrder = ['100x+', '50-100x', '25-50x', '10-25x', '5-10x', '<5x'];
    const upsideTiers = upsideTiersResult
      .map((r) => r.upsideTier)
      .filter(Boolean) as string[];
    upsideTiers.sort((a, b) => upsideTierOrder.indexOf(a) - upsideTierOrder.indexOf(b));

    return {
      tiers: tiersResult.map((r) => r.tier).filter(Boolean) as string[],
      narratives: narrativesResult.map((r) => r.narrative).filter(Boolean) as string[],
      chains: chainsResult.map((r) => r.chain).filter(Boolean) as string[],
      tokenTypes: tokenTypesResult.map((r) => r.tokenType).filter(Boolean) as string[],
      marketCapTiers: marketCapTiersResult.map((r) => r.marketCapTier).filter(Boolean) as string[],
      upsideTiers,
    };
  }

  async getLeaderboardStats(): Promise<{
    topTokens: { symbol: string; name: string; score: number; daysInTop3: number }[];
    topNarratives: { narrative: string; avgScore: number; tokenCount: number }[];
    winners7d: { symbol: string; name: string; score: number }[];
  }> {
    const db = getDb();

    // Get the top 3 tokens (highest 7-day average score) and when they first appeared
    const topTokensQuery = await db
      .select({
        tokenSymbol: tokenAnalyses.tokenSymbol,
        tokenName: tokenAnalyses.tokenName,
        avgScore: sql<number>`AVG(CAST(${tokenAnalyses.finalScore} AS DECIMAL))`.as('avg_score'),
        firstAnalysis: sql<Date>`MIN(${tokenAnalyses.createdAt})`.as('first_analysis'),
      })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.status, 'completed'),
          gte(tokenAnalyses.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .groupBy(tokenAnalyses.tokenSymbol, tokenAnalyses.tokenName)
      .orderBy(sql`avg_score DESC`)
      .limit(3);

    // Get all narratives with their scores and token IDs for normalization
    const allNarrativesQuery = await db
      .select({
        narrative: tokenAnalyses.narrative,
        finalScore: tokenAnalyses.finalScore,
        tokenId: tokenAnalyses.tokenId,
      })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.status, 'completed'),
          isNotNull(tokenAnalyses.narrative),
          sql`${tokenAnalyses.narrative} != ''`
        )
      );

    // Normalize and group narratives
    const narrativeGroups = new Map<string, { scores: number[]; tokenIds: Set<string> }>();

    for (const row of allNarrativesQuery) {
      if (!row.narrative) continue;
      const normalized = normalizeNarrative(row.narrative);
      if (!narrativeGroups.has(normalized)) {
        narrativeGroups.set(normalized, { scores: [], tokenIds: new Set() });
      }
      const group = narrativeGroups.get(normalized)!;
      group.scores.push(parseFloat(row.finalScore as string) || 0);
      group.tokenIds.add(row.tokenId);
    }

    // Find the top 3 narratives with highest average scores
    // Minimum 3 unique tokens required to qualify as "hot narrative"
    const MIN_TOKENS_FOR_HOT_NARRATIVE = 3;
    const narrativeScores: { narrative: string; avgScore: number; tokenCount: number }[] = [];

    narrativeGroups.forEach((data, narrative) => {
      const tokenCount = data.tokenIds.size;
      // Only consider narratives with at least 3 unique tokens
      if (tokenCount < MIN_TOKENS_FOR_HOT_NARRATIVE) return;

      const avgScore = data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length;
      narrativeScores.push({ narrative, avgScore, tokenCount });
    });

    // Sort by avgScore descending
    const sortedNarratives = narrativeScores.sort((a, b) => b.avgScore - a.avgScore);

    // Filter out generic narratives when more specific ones exist
    // e.g., if "AI Agents" is present, filter out "AI"
    const GENERIC_NARRATIVE_PARENTS: Record<string, string[]> = {
      "AI": ["AI Agents", "AI Infrastructure"],
      "Gaming": ["GameFi"],
      "Finance": ["DeFi"],
      "Social": ["SocialFi"],
      "Infrastructure": ["L1/L2", "DePIN", "Interoperability"],
    };

    const filteredNarratives = sortedNarratives.filter(narrative => {
      // Check if this narrative is a generic parent of any other narrative in the list
      const moreSpecificNarratives = GENERIC_NARRATIVE_PARENTS[narrative.narrative];
      if (moreSpecificNarratives) {
        // If any more specific narrative exists in our list, filter out this generic one
        const hasMoreSpecific = sortedNarratives.some(other =>
          moreSpecificNarratives.includes(other.narrative)
        );
        if (hasMoreSpecific) {
          return false;
        }
      }
      return true;
    });

    // Take top 3 from filtered list
    const topNarratives = filteredNarratives.slice(0, 3);

    // Get top 3 highest rated UNIQUE tokens from past 7 days (deduplicated by symbol)
    const winners7dQuery = await db
      .select({
        tokenSymbol: tokenAnalyses.tokenSymbol,
        tokenName: tokenAnalyses.tokenName,
        maxScore: sql<number>`MAX(CAST(${tokenAnalyses.finalScore} AS DECIMAL))`.as('max_score'),
      })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.status, 'completed'),
          gte(tokenAnalyses.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .groupBy(tokenAnalyses.tokenSymbol, tokenAnalyses.tokenName)
      .orderBy(sql`max_score DESC`)
      .limit(3);

    // Calculate days in top 3 for each top token
    const topTokens = topTokensQuery.map(row => {
      const firstAnalysisDate = new Date(row.firstAnalysis);
      const daysInTop3 = Math.floor((Date.now() - firstAnalysisDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        symbol: row.tokenSymbol,
        name: row.tokenName,
        score: parseFloat(String(row.avgScore)) || 0,
        daysInTop3: Math.max(1, daysInTop3),
      };
    });

    // Map all 7d winners (now deduplicated)
    const winners7d = winners7dQuery.map(row => ({
      symbol: row.tokenSymbol,
      name: row.tokenName,
      score: parseFloat(String(row.maxScore)) || 0,
    }));

    return { topTokens, topNarratives, winners7d };
  }

  // ==================== VOTING METHODS ====================

  async getVoteRequestByTokenId(tokenId: string): Promise<TokenVoteRequest | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(tokenVoteRequests)
        .where(eq(tokenVoteRequests.tokenId, tokenId))
        .limit(1);
      return result[0] || null;
    });
  }

  async getVoteRequests(options: { limit?: number; offset?: number; status?: string }): Promise<{ items: TokenVoteRequest[]; total: number }> {
    return withRetry(async () => {
      const db = getDb();
      const { limit = 50, offset = 0, status } = options;

      const conditions = [];
      if (status) {
        conditions.push(eq(tokenVoteRequests.status, status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(tokenVoteRequests)
          .where(whereClause)
          .orderBy(desc(sql`${tokenVoteRequests.voteCount} + (${tokenVoteRequests.priorityVoteCount} * 2)`))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(tokenVoteRequests)
          .where(whereClause),
      ]);

      return {
        items,
        total: countResult[0]?.count || 0,
      };
    });
  }

  async createVoteRequest(data: InsertTokenVoteRequest): Promise<TokenVoteRequest> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db.insert(tokenVoteRequests).values(data).returning();
      return result[0];
    });
  }

  async updateVoteRequest(id: number, data: Partial<InsertTokenVoteRequest>): Promise<TokenVoteRequest | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .update(tokenVoteRequests)
        .set(data)
        .where(eq(tokenVoteRequests.id, id))
        .returning();
      return result[0] || null;
    });
  }

  async incrementVoteCount(requestId: number, isPriority: boolean): Promise<void> {
    return withRetry(async () => {
      const db = getDb();
      if (isPriority) {
        await db
          .update(tokenVoteRequests)
          .set({
            priorityVoteCount: sql`${tokenVoteRequests.priorityVoteCount} + 1`,
          })
          .where(eq(tokenVoteRequests.id, requestId));
      } else {
        await db
          .update(tokenVoteRequests)
          .set({
            voteCount: sql`${tokenVoteRequests.voteCount} + 1`,
          })
          .where(eq(tokenVoteRequests.id, requestId));
      }
    });
  }

  async hasUserVotedForRequest(userId: string, requestId: number): Promise<boolean> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ count: count() })
        .from(tokenVotes)
        .where(
          and(
            eq(tokenVotes.userId, userId),
            eq(tokenVotes.tokenVoteRequestId, requestId)
          )
        );
      return (result[0]?.count || 0) > 0;
    });
  }

  async createVote(data: InsertTokenVote): Promise<TokenVote> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db.insert(tokenVotes).values(data).returning();
      return result[0];
    });
  }

  async getUserVotedRequestIds(userId: string): Promise<number[]> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ requestId: tokenVotes.tokenVoteRequestId })
        .from(tokenVotes)
        .where(eq(tokenVotes.userId, userId));
      return result.map(r => r.requestId);
    });
  }

  async getUserDailyVoteCount(userId: string, date: string): Promise<number> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(userDailyVotes)
        .where(
          and(
            eq(userDailyVotes.userId, userId),
            eq(userDailyVotes.date, date)
          )
        )
        .limit(1);
      return result[0]?.votesUsed || 0;
    });
  }

  async incrementUserDailyVotes(userId: string, date: string): Promise<void> {
    return withRetry(async () => {
      const db = getDb();
      const existing = await this.getUserDailyVoteCount(userId, date);

      if (existing > 0) {
        await db
          .update(userDailyVotes)
          .set({ votesUsed: sql`${userDailyVotes.votesUsed} + 1` })
          .where(
            and(
              eq(userDailyVotes.userId, userId),
              eq(userDailyVotes.date, date)
            )
          );
      } else {
        await db.insert(userDailyVotes).values({
          userId,
          date,
          votesUsed: 1,
        });
      }
    });
  }

  async getTopVoteRequests(limit: number = 20): Promise<TokenVoteRequest[]> {
    return withRetry(async () => {
      const db = getDb();
      const todayStart = getESTTodayStart();

      // Get today's votes grouped by request, calculating scores
      // Regular votes = 1 point, Priority votes = 2 points
      const todaysVotes = await db
        .select({
          tokenVoteRequestId: tokenVotes.tokenVoteRequestId,
          totalScore: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 2 ELSE 1 END)`.as('total_score'),
          regularVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 0 ELSE 1 END)`.as('regular_votes'),
          priorityVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 1 ELSE 0 END)`.as('priority_votes'),
        })
        .from(tokenVotes)
        .where(gte(tokenVotes.createdAt, todayStart))
        .groupBy(tokenVotes.tokenVoteRequestId)
        .orderBy(desc(sql`total_score`))
        .limit(limit);

      if (todaysVotes.length === 0) {
        return [];
      }

      // Get the full request details for tokens with votes today
      const requestIds = todaysVotes.map(v => v.tokenVoteRequestId);

      const requests = await db
        .select()
        .from(tokenVoteRequests)
        .where(
          and(
            inArray(tokenVoteRequests.id, requestIds),
            eq(tokenVoteRequests.status, "pending")
          )
        );

      // Create a map for quick lookup and merge vote counts
      const requestMap = new Map(requests.map(r => [r.id, r]));

      // Return requests sorted by today's votes, with today's counts
      return todaysVotes
        .filter(v => requestMap.has(v.tokenVoteRequestId))
        .map(v => {
          const request = requestMap.get(v.tokenVoteRequestId)!;
          // Override counts with today's counts for display
          // Note: PostgreSQL SUM returns bigint as string, so we convert to number
          return {
            ...request,
            voteCount: Number(v.regularVotes) || 0,
            priorityVoteCount: Number(v.priorityVotes) || 0,
          };
        });
    });
  }

  /**
   * Get the top voted token from yesterday that is still pending and has contract address info.
   * Used by the auto-analyze job to trigger analysis for the daily winner.
   */
  async getYesterdayTopVotedToken(): Promise<TokenVoteRequest | null> {
    return withRetry(async () => {
      const db = getDb();
      const { start: yesterdayStart, end: yesterdayEnd } = getESTYesterdayRange();

      // Get yesterday's votes grouped by request, calculating scores
      // Regular votes = 1 point, Priority votes = 2 points
      const yesterdaysVotes = await db
        .select({
          tokenVoteRequestId: tokenVotes.tokenVoteRequestId,
          totalScore: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 2 ELSE 1 END)`.as('total_score'),
          regularVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 0 ELSE 1 END)`.as('regular_votes'),
          priorityVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 1 ELSE 0 END)`.as('priority_votes'),
        })
        .from(tokenVotes)
        .where(
          and(
            gte(tokenVotes.createdAt, yesterdayStart),
            lt(tokenVotes.createdAt, yesterdayEnd)
          )
        )
        .groupBy(tokenVotes.tokenVoteRequestId)
        .orderBy(desc(sql`total_score`))
        .limit(10); // Get top 10 to find one with contract info

      if (yesterdaysVotes.length === 0) {
        console.log('[Storage] No votes found for yesterday');
        return null;
      }

      // Get the full request details for tokens with votes yesterday
      const requestIds = yesterdaysVotes.map(v => v.tokenVoteRequestId);

      const requests = await db
        .select()
        .from(tokenVoteRequests)
        .where(
          and(
            inArray(tokenVoteRequests.id, requestIds),
            eq(tokenVoteRequests.status, "pending"),
            isNotNull(tokenVoteRequests.contractAddress),
            isNotNull(tokenVoteRequests.source)
          )
        );

      if (requests.length === 0) {
        console.log('[Storage] No pending vote requests with contract info found for yesterday');
        return null;
      }

      // Create a map for quick lookup
      const requestMap = new Map(requests.map(r => [r.id, r]));

      // Find the highest voted request that has contract info
      for (const v of yesterdaysVotes) {
        const request = requestMap.get(v.tokenVoteRequestId);
        if (request) {
          // Return the request with yesterday's vote counts
          return {
            ...request,
            voteCount: Number(v.regularVotes) || 0,
            priorityVoteCount: Number(v.priorityVotes) || 0,
          };
        }
      }

      return null;
    });
  }

  async getRecentlyAnalyzedRequests(limit: number = 10): Promise<TokenVoteRequest[]> {
    return withRetry(async () => {
      const db = getDb();

      // Find vote requests where the token has a completed analysis
      // This handles both:
      // 1. Vote requests with status='analyzed' (properly updated)
      // 2. Vote requests where token was analyzed but status wasn't updated
      const result = await db
        .select({
          id: tokenVoteRequests.id,
          tokenId: tokenVoteRequests.tokenId,
          tokenSymbol: tokenVoteRequests.tokenSymbol,
          tokenName: tokenVoteRequests.tokenName,
          tokenImage: tokenVoteRequests.tokenImage,
          chain: tokenVoteRequests.chain,
          contractAddress: tokenVoteRequests.contractAddress,
          source: tokenVoteRequests.source,
          voteCount: tokenVoteRequests.voteCount,
          priorityVoteCount: tokenVoteRequests.priorityVoteCount,
          status: tokenVoteRequests.status,
          createdAt: tokenVoteRequests.createdAt,
          analyzedAt: sql<Date>`COALESCE(${tokenVoteRequests.analyzedAt}, ${tokenAnalyses.createdAt})`.as('analyzed_at'),
          analysisId: sql<number>`COALESCE(${tokenVoteRequests.analysisId}, ${tokenAnalyses.id})`.as('analysis_id'),
        })
        .from(tokenVoteRequests)
        .innerJoin(tokenAnalyses, eq(tokenVoteRequests.tokenId, tokenAnalyses.tokenId))
        .where(eq(tokenAnalyses.status, "completed"))
        .orderBy(desc(sql`${tokenVoteRequests.voteCount} + (${tokenVoteRequests.priorityVoteCount} * 2)`))
        .limit(limit);

      // Map to TokenVoteRequest shape
      return result.map(r => ({
        id: r.id,
        tokenId: r.tokenId,
        tokenSymbol: r.tokenSymbol,
        tokenName: r.tokenName,
        tokenImage: r.tokenImage,
        chain: r.chain,
        contractAddress: r.contractAddress,
        source: r.source,
        voteCount: r.voteCount,
        priorityVoteCount: r.priorityVoteCount,
        status: "analyzed" as const,
        createdAt: r.createdAt,
        analyzedAt: r.analyzedAt,
        analysisId: r.analysisId,
      }));
    });
  }

  async getYesterdayTopVote(): Promise<{ request: TokenVoteRequest; voteCount: number; priorityVoteCount: number; totalScore: number } | null> {
    return withRetry(async () => {
      const db = getDb();
      const { start: yesterdayStart, end: yesterdayEnd } = getESTYesterdayRange();

      // First, try to get yesterday's votes from individual vote records
      // Regular votes = 1 point, Priority votes = 2 points
      const yesterdaysVotes = await db
        .select({
          tokenVoteRequestId: tokenVotes.tokenVoteRequestId,
          totalScore: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 2 ELSE 1 END)`.as('total_score'),
          regularVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 0 ELSE 1 END)`.as('regular_votes'),
          priorityVotes: sql<number>`SUM(CASE WHEN ${tokenVotes.isPriorityVote} THEN 1 ELSE 0 END)`.as('priority_votes'),
        })
        .from(tokenVotes)
        .where(
          and(
            gte(tokenVotes.createdAt, yesterdayStart),
            lt(tokenVotes.createdAt, yesterdayEnd)
          )
        )
        .groupBy(tokenVotes.tokenVoteRequestId)
        .orderBy(desc(sql`total_score`))
        .limit(1);

      // If we found individual vote records from yesterday, use them
      if (yesterdaysVotes.length > 0) {
        const topVote = yesterdaysVotes[0];
        const requests = await db
          .select()
          .from(tokenVoteRequests)
          .where(eq(tokenVoteRequests.id, topVote.tokenVoteRequestId))
          .limit(1);

        if (requests.length > 0) {
          return {
            request: requests[0],
            voteCount: Number(topVote.regularVotes) || 0,
            priorityVoteCount: Number(topVote.priorityVotes) || 0,
            totalScore: Number(topVote.totalScore) || 0,
          };
        }
      }

      // Fallback: Get the top pending request by accumulated vote counts
      // This handles cases where votes were added without individual vote records
      const topPendingRequests = await db
        .select()
        .from(tokenVoteRequests)
        .where(eq(tokenVoteRequests.status, "pending"))
        .orderBy(desc(sql`${tokenVoteRequests.voteCount} + (${tokenVoteRequests.priorityVoteCount} * 2)`))
        .limit(1);

      if (topPendingRequests.length === 0) {
        return null;
      }

      const topRequest = topPendingRequests[0];
      const voteCount = topRequest.voteCount || 0;
      const priorityVoteCount = topRequest.priorityVoteCount || 0;

      return {
        request: topRequest,
        voteCount,
        priorityVoteCount,
        totalScore: voteCount + (priorityVoteCount * 2),
      };
    });
  }

  // ==================== PERFORMANCE TRACKING METHODS ====================

  async createPriceSnapshot(data: InsertPriceSnapshot): Promise<PriceSnapshot> {
    return withRetry(async () => {
      const db = getDb();
      // Use upsert to handle duplicate snapshots for same token/date
      const result = await db
        .insert(priceSnapshots)
        .values(data as any)
        .onConflictDoUpdate({
          target: [priceSnapshots.tokenId, priceSnapshots.snapshotDate],
          set: {
            priceUsd: data.priceUsd,
            marketCap: data.marketCap,
            fdv: data.fdv,
            volume24h: data.volume24h,
          },
        })
        .returning();
      return result[0];
    });
  }

  async getPriceSnapshot(tokenId: string, date: string): Promise<PriceSnapshot | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(priceSnapshots)
        .where(
          and(
            sql`LOWER(${priceSnapshots.tokenId}) = LOWER(${tokenId})`,
            eq(priceSnapshots.snapshotDate, date)
          )
        )
        .limit(1);
      return result[0] || null;
    });
  }

  async getTokenPriceHistory(tokenId: string, days: number): Promise<PriceSnapshot[]> {
    return withRetry(async () => {
      const db = getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const result = await db
        .select()
        .from(priceSnapshots)
        .where(
          and(
            sql`LOWER(${priceSnapshots.tokenId}) = LOWER(${tokenId})`,
            gte(priceSnapshots.snapshotDate, cutoffStr)
          )
        )
        .orderBy(desc(priceSnapshots.snapshotDate));
      return result;
    });
  }

  async getLatestPriceSnapshot(tokenId: string): Promise<PriceSnapshot | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(priceSnapshots)
        .where(sql`LOWER(${priceSnapshots.tokenId}) = LOWER(${tokenId})`)
        .orderBy(desc(priceSnapshots.snapshotDate))
        .limit(1);
      return result[0] || null;
    });
  }

  async getLeaderboardTokenIds(): Promise<string[]> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .selectDistinct({ tokenId: tokenAnalyses.tokenId })
        .from(tokenAnalyses)
        .where(eq(tokenAnalyses.status, "completed"));
      return result.map(r => r.tokenId);
    });
  }

  async getTokenFirstAnalysis(tokenId: string): Promise<TokenAnalysis | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(tokenAnalyses)
        .where(
          and(
            sql`LOWER(${tokenAnalyses.tokenId}) = LOWER(${tokenId})`,
            eq(tokenAnalyses.status, "completed")
          )
        )
        .orderBy(tokenAnalyses.createdAt) // ASC to get first
        .limit(1);
      return result[0] || null;
    });
  }

  async getTokensByTier(tier: string): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]> {
    return withRetry(async () => {
      const db = getDb();
      // Get unique tokens by tier with their first analysis date and latest score
      const result = await db
        .select({
          tokenId: tokenAnalyses.tokenId,
          score: sql<number>`CAST(${tokenAnalyses.finalScore} AS DECIMAL)`.as('score'),
          firstAnalysisDate: sql<Date>`MIN(${tokenAnalyses.createdAt})`.as('first_analysis_date'),
        })
        .from(tokenAnalyses)
        .where(
          and(
            eq(tokenAnalyses.status, "completed"),
            eq(tokenAnalyses.tier, tier)
          )
        )
        .groupBy(tokenAnalyses.tokenId, tokenAnalyses.finalScore);
      return result;
    });
  }

  async getTokensWithBuyRecommendation(): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]> {
    return withRetry(async () => {
      const db = getDb();
      // BUY recommendation = score >= 70
      const result = await db
        .select({
          tokenId: tokenAnalyses.tokenId,
          score: sql<number>`CAST(${tokenAnalyses.finalScore} AS DECIMAL)`.as('score'),
          firstAnalysisDate: sql<Date>`MIN(${tokenAnalyses.createdAt})`.as('first_analysis_date'),
        })
        .from(tokenAnalyses)
        .where(
          and(
            eq(tokenAnalyses.status, "completed"),
            gte(tokenAnalyses.finalScore, "70")
          )
        )
        .groupBy(tokenAnalyses.tokenId, tokenAnalyses.finalScore);
      return result;
    });
  }

  async getLatestPerformanceMetrics(): Promise<PerformanceMetrics | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(performanceMetrics)
        .orderBy(desc(performanceMetrics.metricDate))
        .limit(1);
      return result[0] || null;
    });
  }

  async savePerformanceMetrics(data: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    return withRetry(async () => {
      const db = getDb();
      // Upsert to update if date already exists
      const result = await db
        .insert(performanceMetrics)
        .values(data as any)
        .onConflictDoUpdate({
          target: [performanceMetrics.metricDate],
          set: {
            top10Avg7dReturn: data.top10Avg7dReturn,
            top10Avg30dReturn: data.top10Avg30dReturn,
            hitRate7d: data.hitRate7d,
            hitRate30d: data.hitRate30d,
            tierMetrics: data.tierMetrics,
            totalTokens: data.totalTokens,
          },
        })
        .returning();
      return result[0];
    });
  }

  // ==================== FEEDBACK METHODS ====================

  async createFeedback(data: InsertUserFeedback): Promise<UserFeedback> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(userFeedback)
        .values(data as any)
        .returning();
      return result[0];
    });
  }

  async getFeedback(limit: number = 100): Promise<UserFeedback[]> {
    return withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(userFeedback)
        .orderBy(desc(userFeedback.createdAt))
        .limit(limit);
    });
  }

  // ==================== SHARING METHODS ====================

  async createShare(data: InsertUserShare): Promise<UserShare> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(userShares)
        .values(data as any)
        .returning();
      return result[0];
    });
  }

  async getUserShares(userId: string): Promise<UserShare[]> {
    return withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(userShares)
        .where(eq(userShares.userId, userId))
        .orderBy(desc(userShares.createdAt));
    });
  }

  async getVerifiedShareCount(userId: string): Promise<number> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ count: count() })
        .from(userShares)
        .where(and(eq(userShares.userId, userId), eq(userShares.verified, true)));
      return result[0]?.count || 0;
    });
  }

  async verifyShare(shareId: number): Promise<UserShare | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .update(userShares)
        .set({ verified: true, verifiedAt: new Date() })
        .where(eq(userShares.id, shareId))
        .returning();

      if (result[0]) {
        // Check if user now qualifies for priority status
        const verifiedCount = await this.getVerifiedShareCount(result[0].userId);
        if (verifiedCount >= PRIORITY_SHARE_THRESHOLD) {
          await this.grantPriorityStatus(result[0].userId);
        }
      }

      return result[0] || null;
    });
  }

  // ==================== REFERRAL METHODS ====================

  async getReferralCode(userId: string): Promise<ReferralCode | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1);
      return result[0] || null;
    });
  }

  async createReferralCode(userId: string, code: string): Promise<ReferralCode> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(referralCodes)
        .values({ userId, code })
        .returning();
      return result[0];
    });
  }

  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);
      return result[0] || null;
    });
  }

  async trackReferralVisit(data: InsertReferralVisit): Promise<ReferralVisit> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(referralVisits)
        .values(data as any)
        .returning();
      return result[0];
    });
  }

  async getReferralVisitByVisitorId(visitorId: string): Promise<ReferralVisit | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(referralVisits)
        .where(eq(referralVisits.visitorId, visitorId))
        .orderBy(desc(referralVisits.createdAt))
        .limit(1);
      return result[0] || null;
    });
  }

  async convertReferralVisit(visitorId: string, userId: string): Promise<void> {
    return withRetry(async () => {
      const db = getDb();
      await db
        .update(referralVisits)
        .set({ convertedUserId: userId, convertedAt: new Date() })
        .where(and(
          eq(referralVisits.visitorId, visitorId),
          sql`${referralVisits.convertedUserId} IS NULL`
        ));
    });
  }

  async getReferralStats(userId: string): Promise<{ visits: number; conversions: number; returningVisitors: number }> {
    return withRetry(async () => {
      const db = getDb();

      // Get user's referral code
      const refCode = await this.getReferralCode(userId);
      if (!refCode) {
        return { visits: 0, conversions: 0, returningVisitors: 0 };
      }

      // Count total visits
      const visitsResult = await db
        .select({ count: count() })
        .from(referralVisits)
        .where(eq(referralVisits.referralCode, refCode.code));

      // Count conversions
      const conversionsResult = await db
        .select({ count: count() })
        .from(referralVisits)
        .where(and(
          eq(referralVisits.referralCode, refCode.code),
          isNotNull(referralVisits.convertedUserId)
        ));

      // Count unique visitors who visited more than once
      const returningResult = await db
        .select({ visitorId: referralVisits.visitorId, visitCount: count() })
        .from(referralVisits)
        .where(eq(referralVisits.referralCode, refCode.code))
        .groupBy(referralVisits.visitorId)
        .having(sql`count(*) > 1`);

      return {
        visits: visitsResult[0]?.count || 0,
        conversions: conversionsResult[0]?.count || 0,
        returningVisitors: returningResult.length,
      };
    });
  }

  async getUserByReferralCode(code: string): Promise<string | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ userId: referralCodes.userId })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);
      return result[0]?.userId || null;
    });
  }

  // ==================== PRIORITY SHARER METHODS ====================

  async getPrioritySharer(userId: string): Promise<PrioritySharer | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(prioritySharers)
        .where(eq(prioritySharers.userId, userId))
        .limit(1);
      return result[0] || null;
    });
  }

  async grantPriorityStatus(userId: string): Promise<PrioritySharer> {
    return withRetry(async () => {
      const db = getDb();
      const verifiedCount = await this.getVerifiedShareCount(userId);

      // Upsert priority status
      const result = await db
        .insert(prioritySharers)
        .values({
          userId,
          verifiedShareCount: verifiedCount,
          priorityGrantedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [prioritySharers.userId],
          set: { verifiedShareCount: verifiedCount },
        })
        .returning();

      return result[0];
    });
  }

  async isPrioritySharer(userId: string): Promise<boolean> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(prioritySharers)
        .where(and(
          eq(prioritySharers.userId, userId),
          or(
            sql`${prioritySharers.priorityExpiresAt} IS NULL`,
            gte(prioritySharers.priorityExpiresAt, new Date())
          )
        ))
        .limit(1);
      return result.length > 0;
    });
  }

  async updateReferredBy(userId: string, referralCode: string): Promise<void> {
    return withRetry(async () => {
      const db = getDb();
      await db
        .update(userSubscriptions)
        .set({ referredBy: referralCode })
        .where(eq(userSubscriptions.userId, userId));
    });
  }

  // ==================== REANALYSIS QUEUE METHODS ====================

  async addToReanalysisQueue(data: InsertReanalysisQueue): Promise<ReanalysisQueueItem> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(reanalysisQueue)
        .values(data)
        .returning();
      return result[0];
    });
  }

  async addBatchToReanalysisQueue(items: InsertReanalysisQueue[]): Promise<ReanalysisQueueItem[]> {
    if (items.length === 0) return [];
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .insert(reanalysisQueue)
        .values(items)
        .returning();
      return result;
    });
  }

  async getReanalysisQueueItem(id: number): Promise<ReanalysisQueueItem | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(reanalysisQueue)
        .where(eq(reanalysisQueue.id, id))
        .limit(1);
      return result[0] || null;
    });
  }

  async getReanalysisQueueItemByRunId(runId: string): Promise<ReanalysisQueueItem | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(reanalysisQueue)
        .where(eq(reanalysisQueue.gumloopRunId, runId))
        .limit(1);
      return result[0] || null;
    });
  }

  async getPendingReanalysisItems(limit: number): Promise<ReanalysisQueueItem[]> {
    return withRetry(async () => {
      const db = getDb();
      // Get pending items ordered by priority (lower = higher priority) then by created time
      const result = await db
        .select()
        .from(reanalysisQueue)
        .where(eq(reanalysisQueue.status, "pending"))
        .orderBy(reanalysisQueue.priority, reanalysisQueue.createdAt)
        .limit(limit);
      return result;
    });
  }

  async getProcessingReanalysisCount(): Promise<number> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ count: count() })
        .from(reanalysisQueue)
        .where(eq(reanalysisQueue.status, "processing"));
      return result[0]?.count || 0;
    });
  }

  async updateReanalysisQueueItem(id: number, data: Partial<InsertReanalysisQueue>): Promise<ReanalysisQueueItem | null> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .update(reanalysisQueue)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(reanalysisQueue.id, id))
        .returning();
      return result[0] || null;
    });
  }

  async isTokenInReanalysisQueue(tokenId: string): Promise<boolean> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({ id: reanalysisQueue.id })
        .from(reanalysisQueue)
        .where(and(
          eq(reanalysisQueue.tokenId, tokenId),
          or(
            eq(reanalysisQueue.status, "pending"),
            eq(reanalysisQueue.status, "processing")
          )
        ))
        .limit(1);
      return result.length > 0;
    });
  }

  async getTopTokensForReanalysis(count: number): Promise<{ tokenId: string; tokenSymbol: string; tokenName: string; tokenImage: string | null; chain: string | null; contractAddress: string | null; score: number }[]> {
    return withRetry(async () => {
      const db = getDb();
      // Get tokens with most recent completed analysis, ordered by score
      // Uses a subquery to get the latest analysis per token
      const result = await db.execute(sql`
        WITH latest_analyses AS (
          SELECT DISTINCT ON (token_id)
            token_id,
            token_symbol,
            token_name,
            token_image,
            chain,
            contract_address,
            CAST(final_score AS FLOAT) as score
          FROM token_analyses
          WHERE status = 'completed'
          ORDER BY token_id, created_at DESC
        )
        SELECT * FROM latest_analyses
        ORDER BY score DESC
        LIMIT ${count}
      `);
      return (result.rows as any[]).map(row => ({
        tokenId: row.token_id,
        tokenSymbol: row.token_symbol,
        tokenName: row.token_name,
        tokenImage: row.token_image,
        chain: row.chain,
        contractAddress: row.contract_address,
        score: row.score,
      }));
    });
  }

  async getReanalysisQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    return withRetry(async () => {
      const db = getDb();
      const result = await db
        .select({
          status: reanalysisQueue.status,
          count: count(),
        })
        .from(reanalysisQueue)
        .groupBy(reanalysisQueue.status);

      const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
      for (const row of result) {
        if (row.status in stats) {
          stats[row.status as keyof typeof stats] = row.count;
        }
      }
      return stats;
    });
  }

  async getReanalysisQueueItems(options: { status?: ReanalysisQueueStatus; limit?: number; offset?: number }): Promise<{ items: ReanalysisQueueItem[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options;
    return withRetry(async () => {
      const db = getDb();

      const conditions = [];
      if (status) {
        conditions.push(eq(reanalysisQueue.status, status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select()
          .from(reanalysisQueue)
          .where(whereClause)
          .orderBy(desc(reanalysisQueue.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(reanalysisQueue)
          .where(whereClause),
      ]);

      return {
        items,
        total: totalResult[0]?.count || 0,
      };
    });
  }

  async cleanupOldQueueItems(daysOld: number): Promise<number> {
    return withRetry(async () => {
      const db = getDb();
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(reanalysisQueue)
        .where(and(
          or(
            eq(reanalysisQueue.status, "completed"),
            eq(reanalysisQueue.status, "failed")
          ),
          lt(reanalysisQueue.createdAt, cutoffDate)
        ))
        .returning({ id: reanalysisQueue.id });

      return result.length;
    });
  }
}

// In-memory fallback for when DATABASE_URL is not set
export class MemStorage implements IStorage {
  private subscriptions = new Map<string, UserSubscription>();
  private dailyUsageMap = new Map<string, number>();
  private analyses = new Map<number, TokenAnalysis>();
  private analysisCounter = 1;

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    return this.subscriptions.get(userId) || null;
  }

  async getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | null> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.stripeCustomerId === customerId) return sub;
    }
    return null;
  }

  async getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | null> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.stripeSubscriptionId === subscriptionId) return sub;
    }
    return null;
  }

  async createOrUpdateSubscription(data: Partial<InsertUserSubscription> & { userId: string }): Promise<UserSubscription> {
    const existing = this.subscriptions.get(data.userId);
    const now = new Date();

    const sub: UserSubscription = {
      id: existing?.id || Math.floor(Math.random() * 100000),
      userId: data.userId,
      tier: data.tier || existing?.tier || "free",
      status: data.status || existing?.status || "active",
      stripeCustomerId: data.stripeCustomerId ?? existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
      stripePriceId: data.stripePriceId ?? existing?.stripePriceId ?? null,
      currentPeriodStart: data.currentPeriodStart ?? existing?.currentPeriodStart ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false,
      monthlyAnalysesUsed: data.monthlyAnalysesUsed ?? existing?.monthlyAnalysesUsed ?? 0,
      monthlyResetDate: data.monthlyResetDate ?? existing?.monthlyResetDate ?? null,
      creditBalance: data.creditBalance ?? existing?.creditBalance ?? 0,
      trialStartDate: data.trialStartDate ?? existing?.trialStartDate ?? null,
      weeklyAnalysesUsed: data.weeklyAnalysesUsed ?? existing?.weeklyAnalysesUsed ?? 0,
      weeklyResetDate: data.weeklyResetDate ?? existing?.weeklyResetDate ?? null,
      referredBy: data.referredBy ?? existing?.referredBy ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.subscriptions.set(data.userId, sub);
    return sub;
  }

  async updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | null> {
    const existing = this.subscriptions.get(userId);
    if (!existing) return null;
    return this.createOrUpdateSubscription({ ...data, userId });
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.monthlyAnalysesUsed = 0;
      sub.monthlyResetDate = new Date().toISOString().split("T")[0];
      sub.updatedAt = new Date();
    }
  }

  async incrementMonthlyUsage(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.monthlyAnalysesUsed = (sub.monthlyAnalysesUsed || 0) + 1;
      sub.updatedAt = new Date();
    }
  }

  async getDailyUsage(userId: string, date: string): Promise<number> {
    return this.dailyUsageMap.get(`${userId}:${date}`) || 0;
  }

  async incrementDailyUsage(userId: string, date: string): Promise<void> {
    const key = `${userId}:${date}`;
    this.dailyUsageMap.set(key, (this.dailyUsageMap.get(key) || 0) + 1);
  }

  async getWeeklyUsage(userId: string): Promise<number> {
    const sub = this.subscriptions.get(userId);
    return sub?.weeklyAnalysesUsed || 0;
  }

  async incrementWeeklyUsage(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.weeklyAnalysesUsed = (sub.weeklyAnalysesUsed || 0) + 1;
      sub.updatedAt = new Date();
    }
  }

  async resetWeeklyUsage(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.weeklyAnalysesUsed = 0;
      sub.weeklyResetDate = new Date().toISOString().split("T")[0];
      sub.updatedAt = new Date();
    }
  }

  async addCredits(userId: string, credits: number, _packId: string, _amountPaid: number, _paymentIntentId?: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.creditBalance = (sub.creditBalance || 0) + credits;
      sub.updatedAt = new Date();
    }
  }

  async useCredit(userId: string): Promise<boolean> {
    const sub = this.subscriptions.get(userId);
    if (!sub || (sub.creditBalance || 0) <= 0) return false;
    sub.creditBalance = (sub.creditBalance || 0) - 1;
    sub.updatedAt = new Date();
    return true;
  }

  async setReferralCode(userId: string, referralCode: string): Promise<void> {
    let sub = this.subscriptions.get(userId);
    if (!sub) {
      sub = await this.createOrUpdateSubscription({ userId });
    }
    // Only set if not already set
    if (!sub.referredBy) {
      sub.referredBy = referralCode;
      sub.updatedAt = new Date();
    }
  }

  async createAnalysis(data: InsertTokenAnalysis): Promise<TokenAnalysis> {
    const id = this.analysisCounter++;
    const now = new Date();
    const analysis: TokenAnalysis = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    } as TokenAnalysis;
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: number): Promise<TokenAnalysis | null> {
    return this.analyses.get(id) || null;
  }

  async getAnalysisByToken(tokenId: string): Promise<TokenAnalysis | null> {
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.tokenId === tokenId) return analysis;
    }
    return null;
  }

  async getAnalysisByRunId(runId: string): Promise<TokenAnalysis | null> {
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.gumloopRunId === runId) return analysis;
    }
    return null;
  }

  async getUserAnalyses(userId: string, limit = 20, offset = 0): Promise<{ items: TokenAnalysis[]; total: number }> {
    const userAnalyses = Array.from(this.analyses.values())
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items: userAnalyses.slice(offset, offset + limit),
      total: userAnalyses.length,
    };
  }

  async updateAnalysis(id: number, data: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | null> {
    const existing = this.analyses.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() } as TokenAnalysis;
    this.analyses.set(id, updated);
    return updated;
  }

  async getRunningAnalysesCount(userId: string): Promise<number> {
    return Array.from(this.analyses.values())
      .filter((a) => a.userId === userId && (a.status === "pending" || a.status === "processing"))
      .length;
  }

  async getTotalRunningAnalyses(): Promise<number> {
    return Array.from(this.analyses.values())
      .filter((a) => a.status === "pending" || a.status === "processing")
      .length;
  }

  async getStuckAnalyses(maxAgeMinutes: number = 60): Promise<TokenAnalysis[]> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    return Array.from(this.analyses.values())
      .filter((a) =>
        (a.status === "pending" || a.status === "processing") &&
        a.createdAt <= cutoffTime
      );
  }

  async getStuckAnalysesWithRunId(minAgeMinutes: number = 5): Promise<TokenAnalysis[]> {
    const cutoffTime = new Date(Date.now() - minAgeMinutes * 60 * 1000);
    return Array.from(this.analyses.values())
      .filter((a) =>
        (a.status === "pending" || a.status === "processing") &&
        a.createdAt <= cutoffTime &&
        a.gumloopRunId != null
      );
  }

  async getAnalysesByTokenId(tokenId: string): Promise<TokenAnalysis[]> {
    return Array.from(this.analyses.values())
      .filter((a) => a.tokenId === tokenId && a.status === "completed")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLatestAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | null> {
    const analyses = Array.from(this.analyses.values())
      .filter((a) => a.tokenId === tokenId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return analyses[0] || null;
  }

  async getLatestAnalysisByContractAddress(contractAddress: string): Promise<TokenAnalysis | null> {
    const analyses = Array.from(this.analyses.values())
      .filter((a) => a.contractAddress?.toLowerCase() === contractAddress.toLowerCase())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return analyses[0] || null;
  }

  async getAllAnalyses(limit = 50, offset = 0, status?: string): Promise<{ items: TokenAnalysis[]; total: number }> {
    let analyses = Array.from(this.analyses.values());
    if (status) {
      analyses = analyses.filter((a) => a.status === status);
    }
    analyses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: analyses.slice(offset, offset + limit),
      total: analyses.length,
    };
  }

  async getLeaderboard(_options: any): Promise<{ items: any[]; total: number }> {
    return { items: [], total: 0 };
  }

  async getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[]; upsideTiers: string[] }> {
    return { tiers: [], narratives: [], chains: [], tokenTypes: [], marketCapTiers: [], upsideTiers: [] };
  }

  async getLeaderboardStats(): Promise<{
    topTokens: { symbol: string; name: string; score: number; daysInTop3: number }[];
    topNarratives: { narrative: string; avgScore: number; tokenCount: number }[];
    winners7d: { symbol: string; name: string; score: number }[];
  }> {
    return { topTokens: [], topNarratives: [], winners7d: [] };
  }

  // ==================== VOTING METHODS (In-Memory) ====================
  private voteRequests = new Map<number, TokenVoteRequest>();
  private votes = new Map<number, TokenVote>();
  private dailyVotes = new Map<string, number>(); // key: `${userId}:${date}`
  private voteRequestCounter = 1;
  private voteCounter = 1;

  async getVoteRequestByTokenId(tokenId: string): Promise<TokenVoteRequest | null> {
    for (const request of Array.from(this.voteRequests.values())) {
      if (request.tokenId === tokenId) return request;
    }
    return null;
  }

  async getVoteRequests(options: { limit?: number; offset?: number; status?: string }): Promise<{ items: TokenVoteRequest[]; total: number }> {
    const { limit = 50, offset = 0, status } = options;
    let items = Array.from(this.voteRequests.values());

    if (status) {
      items = items.filter(r => r.status === status);
    }

    // Sort by weighted vote count
    items.sort((a, b) => {
      const scoreA = (a.voteCount || 0) + ((a.priorityVoteCount || 0) * 2);
      const scoreB = (b.voteCount || 0) + ((b.priorityVoteCount || 0) * 2);
      return scoreB - scoreA;
    });

    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
    };
  }

  async createVoteRequest(data: InsertTokenVoteRequest): Promise<TokenVoteRequest> {
    const id = this.voteRequestCounter++;
    const now = new Date();
    const request: TokenVoteRequest = {
      id,
      tokenId: data.tokenId,
      tokenSymbol: data.tokenSymbol,
      tokenName: data.tokenName,
      tokenImage: data.tokenImage ?? null,
      chain: data.chain ?? null,
      contractAddress: data.contractAddress ?? null,
      source: data.source ?? null,
      voteCount: data.voteCount ?? 0,
      priorityVoteCount: data.priorityVoteCount ?? 0,
      status: data.status ?? "pending",
      createdAt: now,
      analyzedAt: data.analyzedAt ?? null,
      analysisId: data.analysisId ?? null,
    };
    this.voteRequests.set(id, request);
    return request;
  }

  async updateVoteRequest(id: number, data: Partial<InsertTokenVoteRequest>): Promise<TokenVoteRequest | null> {
    const existing = this.voteRequests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data } as TokenVoteRequest;
    this.voteRequests.set(id, updated);
    return updated;
  }

  async incrementVoteCount(requestId: number, isPriority: boolean): Promise<void> {
    const request = this.voteRequests.get(requestId);
    if (request) {
      if (isPriority) {
        request.priorityVoteCount = (request.priorityVoteCount || 0) + 1;
      } else {
        request.voteCount = (request.voteCount || 0) + 1;
      }
    }
  }

  async hasUserVotedForRequest(userId: string, requestId: number): Promise<boolean> {
    for (const vote of Array.from(this.votes.values())) {
      if (vote.userId === userId && vote.tokenVoteRequestId === requestId) {
        return true;
      }
    }
    return false;
  }

  async createVote(data: InsertTokenVote): Promise<TokenVote> {
    const id = this.voteCounter++;
    const now = new Date();
    const vote: TokenVote = {
      id,
      userId: data.userId,
      tokenVoteRequestId: data.tokenVoteRequestId,
      isPriorityVote: data.isPriorityVote ?? false,
      createdAt: now,
    };
    this.votes.set(id, vote);
    return vote;
  }

  async getUserVotedRequestIds(userId: string): Promise<number[]> {
    return Array.from(this.votes.values())
      .filter(v => v.userId === userId)
      .map(v => v.tokenVoteRequestId);
  }

  async getUserDailyVoteCount(userId: string, date: string): Promise<number> {
    return this.dailyVotes.get(`${userId}:${date}`) || 0;
  }

  async incrementUserDailyVotes(userId: string, date: string): Promise<void> {
    const key = `${userId}:${date}`;
    this.dailyVotes.set(key, (this.dailyVotes.get(key) || 0) + 1);
  }

  async getTopVoteRequests(limit: number = 20): Promise<TokenVoteRequest[]> {
    const items = Array.from(this.voteRequests.values())
      .filter(r => r.status === "pending")
      .sort((a, b) => {
        const scoreA = (a.voteCount || 0) + ((a.priorityVoteCount || 0) * 2);
        const scoreB = (b.voteCount || 0) + ((b.priorityVoteCount || 0) * 2);
        return scoreB - scoreA;
      });
    return items.slice(0, limit);
  }

  async getRecentlyAnalyzedRequests(limit: number = 10): Promise<TokenVoteRequest[]> {
    const items = Array.from(this.voteRequests.values())
      .filter(r => r.status === "analyzed" && r.analyzedAt)
      .sort((a, b) => (b.analyzedAt?.getTime() || 0) - (a.analyzedAt?.getTime() || 0));
    return items.slice(0, limit);
  }

  async getYesterdayTopVote(): Promise<{ request: TokenVoteRequest; voteCount: number; priorityVoteCount: number; totalScore: number } | null> {
    // In-memory storage doesn't track vote timestamps, so return null
    return null;
  }

  async getYesterdayTopVotedToken(): Promise<TokenVoteRequest | null> {
    // In-memory storage doesn't track vote timestamps, so return null
    return null;
  }

  // ==================== PERFORMANCE TRACKING METHODS (In-Memory Stubs) ====================

  async createPriceSnapshot(_data: InsertPriceSnapshot): Promise<PriceSnapshot> {
    throw new Error("Performance tracking not available in memory storage");
  }

  async getPriceSnapshot(_tokenId: string, _date: string): Promise<PriceSnapshot | null> {
    return null;
  }

  async getTokenPriceHistory(_tokenId: string, _days: number): Promise<PriceSnapshot[]> {
    return [];
  }

  async getLatestPriceSnapshot(_tokenId: string): Promise<PriceSnapshot | null> {
    return null;
  }

  async getLeaderboardTokenIds(): Promise<string[]> {
    return [];
  }

  async getTokenFirstAnalysis(_tokenId: string): Promise<TokenAnalysis | null> {
    return null;
  }

  async getTokensByTier(_tier: string): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]> {
    return [];
  }

  async getTokensWithBuyRecommendation(): Promise<{ tokenId: string; score: number; firstAnalysisDate: Date }[]> {
    return [];
  }

  async getLatestPerformanceMetrics(): Promise<PerformanceMetrics | null> {
    return null;
  }

  async savePerformanceMetrics(_data: InsertPerformanceMetrics): Promise<PerformanceMetrics> {
    throw new Error("Performance tracking not available in memory storage");
  }

  async createFeedback(_data: InsertUserFeedback): Promise<UserFeedback> {
    throw new Error("Feedback not available in memory storage");
  }

  async getFeedback(_limit?: number): Promise<UserFeedback[]> {
    return [];
  }

  // ==================== SHARING METHODS (In-Memory Stubs) ====================

  async createShare(_data: InsertUserShare): Promise<UserShare> {
    throw new Error("Sharing not available in memory storage");
  }

  async getUserShares(_userId: string): Promise<UserShare[]> {
    return [];
  }

  async getVerifiedShareCount(_userId: string): Promise<number> {
    return 0;
  }

  async verifyShare(_shareId: number): Promise<UserShare | null> {
    return null;
  }

  // ==================== REFERRAL METHODS (In-Memory Stubs) ====================

  async getReferralCode(_userId: string): Promise<ReferralCode | null> {
    return null;
  }

  async createReferralCode(_userId: string, _code: string): Promise<ReferralCode> {
    throw new Error("Referrals not available in memory storage");
  }

  async getReferralCodeByCode(_code: string): Promise<ReferralCode | null> {
    return null;
  }

  async trackReferralVisit(_data: InsertReferralVisit): Promise<ReferralVisit> {
    throw new Error("Referrals not available in memory storage");
  }

  async getReferralVisitByVisitorId(_visitorId: string): Promise<ReferralVisit | null> {
    return null;
  }

  async convertReferralVisit(_visitorId: string, _userId: string): Promise<void> {
    // No-op in memory
  }

  async getReferralStats(_userId: string): Promise<{ visits: number; conversions: number; returningVisitors: number }> {
    return { visits: 0, conversions: 0, returningVisitors: 0 };
  }

  async getUserByReferralCode(_code: string): Promise<string | null> {
    return null;
  }

  // ==================== PRIORITY SHARER METHODS (In-Memory Stubs) ====================

  async getPrioritySharer(_userId: string): Promise<PrioritySharer | null> {
    return null;
  }

  async grantPriorityStatus(_userId: string): Promise<PrioritySharer> {
    throw new Error("Priority status not available in memory storage");
  }

  async isPrioritySharer(_userId: string): Promise<boolean> {
    return false;
  }

  async updateReferredBy(_userId: string, _referralCode: string): Promise<void> {
    // No-op in memory
  }

  // ==================== REANALYSIS QUEUE METHODS (In-Memory Stubs) ====================

  async addToReanalysisQueue(_data: InsertReanalysisQueue): Promise<ReanalysisQueueItem> {
    throw new Error("Reanalysis queue not available in memory storage");
  }

  async addBatchToReanalysisQueue(_items: InsertReanalysisQueue[]): Promise<ReanalysisQueueItem[]> {
    return [];
  }

  async getReanalysisQueueItem(_id: number): Promise<ReanalysisQueueItem | null> {
    return null;
  }

  async getReanalysisQueueItemByRunId(_runId: string): Promise<ReanalysisQueueItem | null> {
    return null;
  }

  async getPendingReanalysisItems(_limit: number): Promise<ReanalysisQueueItem[]> {
    return [];
  }

  async getProcessingReanalysisCount(): Promise<number> {
    return 0;
  }

  async updateReanalysisQueueItem(_id: number, _data: Partial<InsertReanalysisQueue>): Promise<ReanalysisQueueItem | null> {
    return null;
  }

  async isTokenInReanalysisQueue(_tokenId: string): Promise<boolean> {
    return false;
  }

  async getTopTokensForReanalysis(_count: number): Promise<{ tokenId: string; tokenSymbol: string; tokenName: string; tokenImage: string | null; chain: string | null; contractAddress: string | null; score: number }[]> {
    return [];
  }

  async getReanalysisQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  async getReanalysisQueueItems(_options: { status?: ReanalysisQueueStatus; limit?: number; offset?: number }): Promise<{ items: ReanalysisQueueItem[]; total: number }> {
    return { items: [], total: 0 };
  }

  async cleanupOldQueueItems(_daysOld: number): Promise<number> {
    return 0;
  }
}

export let storage: IStorage = new MemStorage();

export async function initStorage(): Promise<IStorage> {
  if (process.env.DATABASE_URL) {
    console.log("Initializing PostgreSQL storage...");
    storage = new PostgresStorage();
  } else {
    console.log("DATABASE_URL not set, using in-memory storage");
    storage = new MemStorage();
  }
  return storage;
}
