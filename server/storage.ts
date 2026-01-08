import { eq, and, desc, sql, gte, lte, ilike, or, count, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  userSubscriptions,
  dailyUsage,
  creditPurchases,
  tokenAnalyses,
  SUBSCRIPTION_TIERS,
  type UserSubscription,
  type InsertUserSubscription,
  type TokenAnalysis,
  type InsertTokenAnalysis,
  type SubscriptionTierId,
} from "@shared/schema";

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
    };
  }): Promise<{ items: any[]; total: number }>;
  getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[] }>;
  getLeaderboardStats(): Promise<{
    topToken: { symbol: string; name: string; score: number; daysOnLeaderboard: number } | null;
    topNarrative: { narrative: string; avgScore: number; tokenCount: number } | null;
    strongestConviction: { symbol: string; name: string; score: number; consensus: string } | null;
  }>;
}

export class PostgresStorage implements IStorage {
  // ==================== SUBSCRIPTION METHODS ====================

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);
    return result[0] || null;
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

  // ==================== ANALYSIS METHODS ====================

  async createAnalysis(data: InsertTokenAnalysis): Promise<TokenAnalysis> {
    const db = getDb();
    const result = await db.insert(tokenAnalyses).values(data as any).returning();
    return result[0];
  }

  async getAnalysis(id: number): Promise<TokenAnalysis | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getAnalysisByToken(tokenId: string): Promise<TokenAnalysis | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.tokenId, tokenId))
      .orderBy(desc(tokenAnalyses.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async getAnalysisByRunId(runId: string): Promise<TokenAnalysis | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.gumloopRunId, runId))
      .limit(1);
    return result[0] || null;
  }

  async getUserAnalyses(userId: string, limit = 20, offset = 0): Promise<{ items: TokenAnalysis[]; total: number }> {
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
  }

  async updateAnalysis(id: number, data: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | null> {
    const db = getDb();
    const result = await db
      .update(tokenAnalyses)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(tokenAnalyses.id, id))
      .returning();
    return result[0] || null;
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
    };
  }): Promise<{ items: any[]; total: number }> {
    const db = getDb();
    const { limit = 50, offset = 0, sortBy = "score7d", order = "desc", filters } = options;

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
        recommendation: tokenAnalyses.recommendation,
        id: tokenAnalyses.id,
        createdAt: tokenAnalyses.createdAt,
        tokenType: tokenAnalyses.tokenType,
        asymmetryScore: tokenAnalyses.asymmetryScore,
        marketCapTier: tokenAnalyses.marketCapTier,
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
      latestRecommendation: string | null;
      latestAnalysisId: number;
      latestAnalysisDate: string;
      scores7d: number[];
      scores30d: number[];
      tokenType: string | null;
      asymmetryScore: number | null;
      marketCapTier: string | null;
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
          latestNarrative: row.narrative,
          latestRecommendation: row.recommendation,
          latestAnalysisId: row.id,
          latestAnalysisDate: row.createdAt.toISOString(),
          scores7d: [],
          scores30d: [],
          tokenType: row.tokenType,
          asymmetryScore: row.asymmetryScore ? parseFloat(row.asymmetryScore as string) : null,
          marketCapTier: row.marketCapTier,
        });
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

    // Sort based on sortBy parameter
    items.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case 'score7d':
          aVal = a.score7d;
          bVal = b.score7d;
          break;
        case 'score30d':
          aVal = a.score30d;
          bVal = b.score30d;
          break;
        case 'runs7d':
          aVal = a.runs7d;
          bVal = b.runs7d;
          break;
        case 'latestAnalysis':
          aVal = new Date(a.latestAnalysisDate).getTime();
          bVal = new Date(b.latestAnalysisDate).getTime();
          break;
        default:
          aVal = a.score7d;
          bVal = b.score7d;
      }

      return order === "desc" ? bVal - aVal : aVal - bVal;
    });

    // Paginate
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total: items.length,
    };
  }

  async getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[] }> {
    const db = getDb();

    const [tiersResult, narrativesResult, chainsResult, tokenTypesResult, marketCapTiersResult] = await Promise.all([
      db.selectDistinct({ tier: tokenAnalyses.tier }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ narrative: tokenAnalyses.narrative }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ chain: tokenAnalyses.chain }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ tokenType: tokenAnalyses.tokenType }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
      db.selectDistinct({ marketCapTier: tokenAnalyses.marketCapTier }).from(tokenAnalyses).where(eq(tokenAnalyses.status, "completed")),
    ]);

    return {
      tiers: tiersResult.map((r) => r.tier).filter(Boolean) as string[],
      narratives: narrativesResult.map((r) => r.narrative).filter(Boolean) as string[],
      chains: chainsResult.map((r) => r.chain).filter(Boolean) as string[],
      tokenTypes: tokenTypesResult.map((r) => r.tokenType).filter(Boolean) as string[],
      marketCapTiers: marketCapTiersResult.map((r) => r.marketCapTier).filter(Boolean) as string[],
    };
  }

  async getLeaderboardStats(): Promise<{
    topToken: { symbol: string; name: string; score: number; daysOnLeaderboard: number } | null;
    topNarrative: { narrative: string; avgScore: number; tokenCount: number } | null;
    strongestConviction: { symbol: string; name: string; score: number; consensus: string } | null;
  }> {
    const db = getDb();

    // Get the top token (highest 7-day average score) and when they first appeared
    const topTokenQuery = await db
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
      .limit(1);

    // Get narrative with highest average score (no minimum token count requirement)
    const topNarrativeQuery = await db
      .select({
        narrative: tokenAnalyses.narrative,
        avgScore: sql<number>`AVG(CAST(${tokenAnalyses.finalScore} AS DECIMAL))`.as('avg_score'),
        tokenCount: sql<number>`COUNT(DISTINCT ${tokenAnalyses.tokenId})`.as('token_count'),
      })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.status, 'completed'),
          isNotNull(tokenAnalyses.narrative),
          sql`${tokenAnalyses.narrative} != ''`
        )
      )
      .groupBy(tokenAnalyses.narrative)
      .orderBy(sql`avg_score DESC`)
      .limit(1);

    // Get token with strongest conviction - prefer STRONG consensus with BUY, fall back to any BUY
    let strongestConvictionQuery = await db
      .select({
        tokenSymbol: tokenAnalyses.tokenSymbol,
        tokenName: tokenAnalyses.tokenName,
        finalScore: tokenAnalyses.finalScore,
        consensusLevel: tokenAnalyses.consensusLevel,
      })
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.status, 'completed'),
          eq(tokenAnalyses.consensusLevel, 'STRONG'),
          eq(tokenAnalyses.recommendation, 'BUY')
        )
      )
      .orderBy(sql`CAST(${tokenAnalyses.finalScore} AS DECIMAL) DESC`)
      .limit(1);

    // Fallback: if no STRONG+BUY, get highest scoring BUY recommendation
    if (strongestConvictionQuery.length === 0) {
      strongestConvictionQuery = await db
        .select({
          tokenSymbol: tokenAnalyses.tokenSymbol,
          tokenName: tokenAnalyses.tokenName,
          finalScore: tokenAnalyses.finalScore,
          consensusLevel: tokenAnalyses.consensusLevel,
        })
        .from(tokenAnalyses)
        .where(
          and(
            eq(tokenAnalyses.status, 'completed'),
            eq(tokenAnalyses.recommendation, 'BUY')
          )
        )
        .orderBy(sql`CAST(${tokenAnalyses.finalScore} AS DECIMAL) DESC`)
        .limit(1);
    }

    // Calculate days on leaderboard for top token
    let topToken = null;
    if (topTokenQuery[0]) {
      const firstAnalysisDate = new Date(topTokenQuery[0].firstAnalysis);
      const daysOnLeaderboard = Math.floor((Date.now() - firstAnalysisDate.getTime()) / (1000 * 60 * 60 * 24));
      topToken = {
        symbol: topTokenQuery[0].tokenSymbol,
        name: topTokenQuery[0].tokenName,
        score: parseFloat(String(topTokenQuery[0].avgScore)) || 0,
        daysOnLeaderboard: Math.max(1, daysOnLeaderboard),
      };
    }

    let topNarrative = null;
    if (topNarrativeQuery[0] && topNarrativeQuery[0].narrative) {
      topNarrative = {
        narrative: topNarrativeQuery[0].narrative,
        avgScore: parseFloat(String(topNarrativeQuery[0].avgScore)) || 0,
        tokenCount: parseInt(String(topNarrativeQuery[0].tokenCount)) || 0,
      };
    }

    let strongestConviction = null;
    if (strongestConvictionQuery[0]) {
      strongestConviction = {
        symbol: strongestConvictionQuery[0].tokenSymbol,
        name: strongestConvictionQuery[0].tokenName,
        score: parseFloat(strongestConvictionQuery[0].finalScore as string) || 0,
        consensus: strongestConvictionQuery[0].consensusLevel || 'STRONG',
      };
    }

    return { topToken, topNarrative, strongestConviction };
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

  async getLeaderboard(_options: any): Promise<{ items: any[]; total: number }> {
    return { items: [], total: 0 };
  }

  async getFilterOptions(): Promise<{ tiers: string[]; narratives: string[]; chains: string[]; tokenTypes: string[]; marketCapTiers: string[] }> {
    return { tiers: [], narratives: [], chains: [], tokenTypes: [], marketCapTiers: [] };
  }

  async getLeaderboardStats(): Promise<{
    topToken: { symbol: string; name: string; score: number; daysOnLeaderboard: number } | null;
    topNarrative: { narrative: string; avgScore: number; tokenCount: number } | null;
    strongestConviction: { symbol: string; name: string; score: number; consensus: string } | null;
  }> {
    return { topToken: null, topNarrative: null, strongestConviction: null };
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
