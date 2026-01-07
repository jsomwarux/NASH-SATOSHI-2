import {
  type TokenAnalysis,
  type InsertTokenAnalysis,
  type LeaderboardFilters,
  type ModelScores,
  type UserSubscription,
  type InsertUserSubscription,
  type DailyUsage,
  type InsertDailyUsage,
  type UserUsageInfo,
  type SubscriptionTierId,
  type CreditPurchase,
  type InsertCreditPurchase,
  tokenAnalyses,
  userSubscriptions,
  dailyUsage,
  creditPurchases,
  SUBSCRIPTION_TIERS,
} from "@shared/schema";
import { db, testConnection } from "./db";
import { eq, desc, asc, sql, ilike, or, and } from "drizzle-orm";

// Aggregated leaderboard entry - one per token with 7D/30D metrics
export interface AggregatedLeaderboardItem {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  // Primary metric: 7D weighted average score
  score7d: number;
  runs7d: number;
  // Secondary metric: 30D average score
  score30d: number;
  runs30d: number;
  // Confidence indicator based on sample size
  confidence: 'high' | 'medium' | 'low';
  // Latest analysis info
  latestTier: string;
  latestNarrative: string | null;
  latestAnalysisId: number;
  latestAnalysisDate: Date;
}

export interface IStorage {
  // Token Analysis
  getAnalysis(id: number): Promise<TokenAnalysis | undefined>;
  getAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | undefined>;
  createAnalysis(analysis: InsertTokenAnalysis): Promise<TokenAnalysis>;
  updateAnalysis(id: number, analysis: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | undefined>;
  getAllAnalyses(options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }>;
  getUserAnalyses(userId: string, options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }>;
  getLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'finalScore' | 'createdAt';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: TokenAnalysis[]; total: number }>;
  getAggregatedLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'score7d' | 'score30d' | 'runs7d' | 'latestAnalysis';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: AggregatedLeaderboardItem[]; total: number }>;
  getDistinctNarratives(): Promise<string[]>;
  getDistinctChains(): Promise<string[]>;
  getDistinctTiers(): Promise<string[]>;

  // Subscription Management
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  createOrUpdateSubscription(data: InsertUserSubscription): Promise<UserSubscription>;
  updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | undefined>;
  getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | undefined>;

  // Usage Tracking
  getDailyUsage(userId: string, date: string): Promise<DailyUsage | undefined>;
  incrementDailyUsage(userId: string, date: string): Promise<DailyUsage>;
  incrementUsage(userId: string): Promise<void>; // Smart usage increment based on tier
  resetMonthlyUsage(userId: string): Promise<void>;
  getUserUsageInfo(userId: string): Promise<UserUsageInfo>;

  // Credit Management
  addCredits(userId: string, credits: number): Promise<void>;
  useCredit(userId: string): Promise<boolean>; // Returns true if credit was used
  getCreditBalance(userId: string): Promise<number>;
  recordCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase>;
}

export class MemStorage implements IStorage {
  private analyses: Map<number, TokenAnalysis>;
  private currentId: number;

  constructor() {
    this.analyses = new Map();
    this.currentId = 1;
  }

  async getAnalysis(id: number): Promise<TokenAnalysis | undefined> {
    return this.analyses.get(id);
  }

  async getAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | undefined> {
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.tokenId === tokenId) {
        // Check if analysis is recent (within 24 hours)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (analysis.createdAt > dayAgo && analysis.status === 'completed') {
          return analysis;
        }
      }
    }
    return undefined;
  }

  async createAnalysis(insertAnalysis: InsertTokenAnalysis): Promise<TokenAnalysis> {
    const id = this.currentId++;
    const now = new Date();
    const analysis: TokenAnalysis = {
      id,
      tokenId: insertAnalysis.tokenId,
      tokenSymbol: insertAnalysis.tokenSymbol,
      tokenName: insertAnalysis.tokenName,
      tokenImage: insertAnalysis.tokenImage ?? null,
      chain: insertAnalysis.chain ?? null,
      contractAddress: insertAnalysis.contractAddress ?? null,
      finalScore: insertAnalysis.finalScore,
      tier: insertAnalysis.tier,
      phase: insertAnalysis.phase ?? null,
      phaseName: insertAnalysis.phaseName ?? null,
      narrative: insertAnalysis.narrative ?? null,
      narrativeHeat: insertAnalysis.narrativeHeat ?? null,
      narrativeAcceleration: insertAnalysis.narrativeAcceleration ?? null,
      peakProximity: insertAnalysis.peakProximity ?? null,
      winningSide: insertAnalysis.winningSide ?? null,
      consensusLevel: insertAnalysis.consensusLevel ?? null,
      confidence: insertAnalysis.confidence ?? null,
      coordinationScore: insertAnalysis.coordinationScore ?? null,
      schellingRankScore: insertAnalysis.schellingRankScore ?? null,
      schellingPosition: insertAnalysis.schellingPosition ?? null,
      reflexivityScore: insertAnalysis.reflexivityScore ?? null,
      viralityScore: insertAnalysis.viralityScore ?? null,
      asymmetryScore: insertAnalysis.asymmetryScore ?? null,
      asymmetryFloor: insertAnalysis.asymmetryFloor ?? null,
      asymmetryCeiling: insertAnalysis.asymmetryCeiling ?? null,
      gameTheoryBonus: insertAnalysis.gameTheoryBonus ?? null,
      phaseModifier: insertAnalysis.phaseModifier ?? null,
      narrativeModifier: insertAnalysis.narrativeModifier ?? null,
      exitLiquidityModifier: insertAnalysis.exitLiquidityModifier ?? null,
      peakProximityModifier: insertAnalysis.peakProximityModifier ?? null,
      dataQualityModifier: insertAnalysis.dataQualityModifier ?? null,
      equilibriumType: insertAnalysis.equilibriumType ?? null,
      equilibriumEvolution: insertAnalysis.equilibriumEvolution ?? null,
      playerMap: insertAnalysis.playerMap ?? null,
      dominantStrategies: insertAnalysis.dominantStrategies ?? null,
      coordinationRisks: insertAnalysis.coordinationRisks as string[] ?? null,
      catalysts: insertAnalysis.catalysts as string[] ?? null,
      recommendation: insertAnalysis.recommendation ?? null,
      displaySummary: insertAnalysis.displaySummary ?? null,
      verdict: insertAnalysis.verdict ?? null,
      reasoning: insertAnalysis.reasoning ?? null,
      modelScores: insertAnalysis.modelScores as ModelScores ?? null,
      currentPrice: insertAnalysis.currentPrice ?? null,
      marketCap: insertAnalysis.marketCap ?? null,
      fdv: insertAnalysis.fdv ?? null,
      volume24h: insertAnalysis.volume24h ?? null,
      priceChange24h: insertAnalysis.priceChange24h ?? null,
      priceChange7d: insertAnalysis.priceChange7d ?? null,
      categories: insertAnalysis.categories as string[] ?? null,
      status: insertAnalysis.status ?? "pending",
      gumloopRunId: insertAnalysis.gumloopRunId ?? null,
      rawGumloopResponse: insertAnalysis.rawGumloopResponse ?? null,
      userId: insertAnalysis.userId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async updateAnalysis(id: number, update: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | undefined> {
    const existing = this.analyses.get(id);
    if (!existing) return undefined;

    // Build merged object, handling jsonb fields specially
    const updated: TokenAnalysis = {
      ...existing,
      tokenId: update.tokenId ?? existing.tokenId,
      tokenSymbol: update.tokenSymbol ?? existing.tokenSymbol,
      tokenName: update.tokenName ?? existing.tokenName,
      tokenImage: update.tokenImage !== undefined ? update.tokenImage ?? null : existing.tokenImage,
      chain: update.chain !== undefined ? update.chain ?? null : existing.chain,
      contractAddress: update.contractAddress !== undefined ? update.contractAddress ?? null : existing.contractAddress,
      finalScore: update.finalScore ?? existing.finalScore,
      tier: update.tier ?? existing.tier,
      phase: update.phase !== undefined ? update.phase ?? null : existing.phase,
      phaseName: update.phaseName !== undefined ? update.phaseName ?? null : existing.phaseName,
      narrative: update.narrative !== undefined ? update.narrative ?? null : existing.narrative,
      narrativeHeat: update.narrativeHeat !== undefined ? update.narrativeHeat ?? null : existing.narrativeHeat,
      narrativeAcceleration: update.narrativeAcceleration !== undefined ? update.narrativeAcceleration ?? null : existing.narrativeAcceleration,
      peakProximity: update.peakProximity !== undefined ? update.peakProximity ?? null : existing.peakProximity,
      winningSide: update.winningSide !== undefined ? update.winningSide ?? null : existing.winningSide,
      consensusLevel: update.consensusLevel !== undefined ? update.consensusLevel ?? null : existing.consensusLevel,
      confidence: update.confidence !== undefined ? update.confidence ?? null : existing.confidence,
      coordinationScore: update.coordinationScore !== undefined ? update.coordinationScore ?? null : existing.coordinationScore,
      schellingRankScore: update.schellingRankScore !== undefined ? update.schellingRankScore ?? null : existing.schellingRankScore,
      schellingPosition: update.schellingPosition !== undefined ? update.schellingPosition ?? null : existing.schellingPosition,
      reflexivityScore: update.reflexivityScore !== undefined ? update.reflexivityScore ?? null : existing.reflexivityScore,
      viralityScore: update.viralityScore !== undefined ? update.viralityScore ?? null : existing.viralityScore,
      asymmetryScore: update.asymmetryScore !== undefined ? update.asymmetryScore ?? null : existing.asymmetryScore,
      asymmetryFloor: update.asymmetryFloor !== undefined ? update.asymmetryFloor ?? null : existing.asymmetryFloor,
      asymmetryCeiling: update.asymmetryCeiling !== undefined ? update.asymmetryCeiling ?? null : existing.asymmetryCeiling,
      gameTheoryBonus: update.gameTheoryBonus !== undefined ? update.gameTheoryBonus ?? null : existing.gameTheoryBonus,
      phaseModifier: update.phaseModifier !== undefined ? update.phaseModifier ?? null : existing.phaseModifier,
      narrativeModifier: update.narrativeModifier !== undefined ? update.narrativeModifier ?? null : existing.narrativeModifier,
      exitLiquidityModifier: update.exitLiquidityModifier !== undefined ? update.exitLiquidityModifier ?? null : existing.exitLiquidityModifier,
      peakProximityModifier: update.peakProximityModifier !== undefined ? update.peakProximityModifier ?? null : existing.peakProximityModifier,
      dataQualityModifier: update.dataQualityModifier !== undefined ? update.dataQualityModifier ?? null : existing.dataQualityModifier,
      equilibriumType: update.equilibriumType !== undefined ? update.equilibriumType ?? null : existing.equilibriumType,
      equilibriumEvolution: update.equilibriumEvolution !== undefined ? update.equilibriumEvolution ?? null : existing.equilibriumEvolution,
      playerMap: update.playerMap !== undefined ? update.playerMap ?? null : existing.playerMap,
      dominantStrategies: update.dominantStrategies !== undefined ? update.dominantStrategies ?? null : existing.dominantStrategies,
      coordinationRisks: update.coordinationRisks !== undefined ? (update.coordinationRisks as string[] | null) : existing.coordinationRisks,
      catalysts: update.catalysts !== undefined ? (update.catalysts as string[] | null) : existing.catalysts,
      recommendation: update.recommendation !== undefined ? update.recommendation ?? null : existing.recommendation,
      displaySummary: update.displaySummary !== undefined ? update.displaySummary ?? null : existing.displaySummary,
      verdict: update.verdict !== undefined ? update.verdict ?? null : existing.verdict,
      reasoning: update.reasoning !== undefined ? update.reasoning ?? null : existing.reasoning,
      modelScores: update.modelScores !== undefined ? (update.modelScores as ModelScores | null) : existing.modelScores,
      currentPrice: update.currentPrice !== undefined ? update.currentPrice ?? null : existing.currentPrice,
      marketCap: update.marketCap !== undefined ? update.marketCap ?? null : existing.marketCap,
      fdv: update.fdv !== undefined ? update.fdv ?? null : existing.fdv,
      volume24h: update.volume24h !== undefined ? update.volume24h ?? null : existing.volume24h,
      priceChange24h: update.priceChange24h !== undefined ? update.priceChange24h ?? null : existing.priceChange24h,
      priceChange7d: update.priceChange7d !== undefined ? update.priceChange7d ?? null : existing.priceChange7d,
      categories: update.categories !== undefined ? (update.categories as string[] | null) : existing.categories,
      status: update.status ?? existing.status,
      gumloopRunId: update.gumloopRunId !== undefined ? update.gumloopRunId ?? null : existing.gumloopRunId,
      rawGumloopResponse: update.rawGumloopResponse !== undefined ? update.rawGumloopResponse ?? null : existing.rawGumloopResponse,
      updatedAt: new Date(),
    };
    this.analyses.set(id, updated);
    return updated;
  }

  async getAllAnalyses(options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    const allAnalyses = Array.from(this.analyses.values());

    // Sort by createdAt descending (most recent first)
    const sorted = allAnalyses.sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Paginate
    const paginated = sorted.slice(options.offset, options.offset + options.limit);

    return {
      items: paginated,
      total: allAnalyses.length,
    };
  }

  async getUserAnalyses(userId: string, options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    // Filter analyses by userId
    const userAnalyses = Array.from(this.analyses.values())
      .filter(a => a.userId === userId);

    // Sort by createdAt descending (most recent first)
    const sorted = userAnalyses.sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Paginate
    const paginated = sorted.slice(options.offset, options.offset + options.limit);

    return {
      items: paginated,
      total: userAnalyses.length,
    };
  }

  async getLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'finalScore' | 'createdAt';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    let allAnalyses = Array.from(this.analyses.values())
      .filter(a => a.status === 'completed');

    // Apply filters
    if (options.filters) {
      const { tier, narrative, chain, search } = options.filters;

      if (tier) {
        allAnalyses = allAnalyses.filter(a => a.tier === tier);
      }

      if (narrative) {
        allAnalyses = allAnalyses.filter(a =>
          a.narrative?.toLowerCase().includes(narrative.toLowerCase())
        );
      }

      if (chain) {
        allAnalyses = allAnalyses.filter(a =>
          a.chain?.toLowerCase() === chain.toLowerCase()
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        allAnalyses = allAnalyses.filter(a =>
          a.tokenName.toLowerCase().includes(searchLower) ||
          a.tokenSymbol.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort
    const sorted = allAnalyses.sort((a, b) => {
      if (options.sortBy === 'createdAt') {
        return options.order === 'asc'
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime();
      } else {
        const aVal = Number(a.finalScore) || 0;
        const bVal = Number(b.finalScore) || 0;
        return options.order === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    // Paginate
    const paginated = sorted.slice(options.offset, options.offset + options.limit);

    return {
      items: paginated,
      total: allAnalyses.length,
    };
  }

  async getAggregatedLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'score7d' | 'score30d' | 'runs7d' | 'latestAnalysis';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: AggregatedLeaderboardItem[]; total: number }> {
    let allAnalyses = Array.from(this.analyses.values())
      .filter(a => a.status === 'completed');

    // Apply filters
    if (options.filters) {
      const { tier, narrative, chain, search } = options.filters;
      if (tier) allAnalyses = allAnalyses.filter(a => a.tier === tier);
      if (narrative) allAnalyses = allAnalyses.filter(a => a.narrative?.toLowerCase().includes(narrative.toLowerCase()));
      if (chain) allAnalyses = allAnalyses.filter(a => a.chain?.toLowerCase() === chain.toLowerCase());
      if (search) {
        const searchLower = search.toLowerCase();
        allAnalyses = allAnalyses.filter(a => a.tokenName.toLowerCase().includes(searchLower) || a.tokenSymbol.toLowerCase().includes(searchLower));
      }
    }

    // Group by tokenId
    const tokenGroups = new Map<string, TokenAnalysis[]>();
    for (const analysis of allAnalyses) {
      const existing = tokenGroups.get(analysis.tokenId) || [];
      existing.push(analysis);
      tokenGroups.set(analysis.tokenId, existing);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Create aggregated items with 7D/30D metrics
    const aggregated: AggregatedLeaderboardItem[] = [];
    for (const [tokenId, analyses] of Array.from(tokenGroups.entries())) {
      const latest = analyses.sort((a: TokenAnalysis, b: TokenAnalysis) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      // 7D metrics
      const analyses7d = analyses.filter(a => a.createdAt >= sevenDaysAgo);
      const score7d = analyses7d.length > 0
        ? analyses7d.reduce((sum, a) => sum + Number(a.finalScore), 0) / analyses7d.length
        : Number(latest.finalScore);
      const runs7d = analyses7d.length;

      // 30D metrics
      const analyses30d = analyses.filter(a => a.createdAt >= thirtyDaysAgo);
      const score30d = analyses30d.length > 0
        ? analyses30d.reduce((sum, a) => sum + Number(a.finalScore), 0) / analyses30d.length
        : Number(latest.finalScore);
      const runs30d = analyses30d.length;

      // Confidence based on 7D sample size
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (runs7d >= 5) confidence = 'high';
      else if (runs7d >= 2) confidence = 'medium';

      aggregated.push({
        tokenId,
        tokenSymbol: latest.tokenSymbol,
        tokenName: latest.tokenName,
        tokenImage: latest.tokenImage,
        chain: latest.chain,
        score7d: Math.round(score7d * 100) / 100,
        runs7d,
        score30d: Math.round(score30d * 100) / 100,
        runs30d,
        confidence,
        latestTier: latest.tier,
        latestNarrative: latest.narrative,
        latestAnalysisId: latest.id,
        latestAnalysisDate: latest.createdAt,
      });
    }

    // Sort
    const sorted = aggregated.sort((a, b) => {
      if (options.sortBy === 'latestAnalysis') {
        return options.order === 'asc'
          ? a.latestAnalysisDate.getTime() - b.latestAnalysisDate.getTime()
          : b.latestAnalysisDate.getTime() - a.latestAnalysisDate.getTime();
      } else if (options.sortBy === 'runs7d') {
        return options.order === 'asc' ? a.runs7d - b.runs7d : b.runs7d - a.runs7d;
      } else if (options.sortBy === 'score30d') {
        return options.order === 'asc' ? a.score30d - b.score30d : b.score30d - a.score30d;
      } else {
        // Default: score7d (primary metric)
        return options.order === 'asc' ? a.score7d - b.score7d : b.score7d - a.score7d;
      }
    });

    const paginated = sorted.slice(options.offset, options.offset + options.limit);
    return { items: paginated, total: aggregated.length };
  }

  async getDistinctNarratives(): Promise<string[]> {
    const narratives = new Set<string>();
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.narrative && analysis.status === 'completed') {
        narratives.add(analysis.narrative);
      }
    }
    return Array.from(narratives).sort();
  }

  async getDistinctChains(): Promise<string[]> {
    const chains = new Set<string>();
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.chain && analysis.status === 'completed') {
        chains.add(analysis.chain);
      }
    }
    return Array.from(chains).sort();
  }

  async getDistinctTiers(): Promise<string[]> {
    const tiers = new Set<string>();
    for (const analysis of Array.from(this.analyses.values())) {
      if (analysis.tier && analysis.status === 'completed') {
        tiers.add(analysis.tier);
      }
    }
    // Sort by tier quality
    const tierOrder = ['S+', 'S', 'A', 'B', 'DISQUALIFIED'];
    return Array.from(tiers).sort((a, b) => {
      const aIdx = tierOrder.indexOf(a);
      const bIdx = tierOrder.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }

  // In-memory subscription storage (for development only)
  private subscriptions: Map<string, UserSubscription> = new Map();
  private dailyUsageMap: Map<string, DailyUsage> = new Map();
  private subscriptionIdCounter = 1;
  private usageIdCounter = 1;

  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    return this.subscriptions.get(userId);
  }

  async createOrUpdateSubscription(data: InsertUserSubscription): Promise<UserSubscription> {
    const existing = this.subscriptions.get(data.userId);
    if (existing) {
      const updated: UserSubscription = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      this.subscriptions.set(data.userId, updated);
      return updated;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const subscription: UserSubscription = {
      id: this.subscriptionIdCounter++,
      userId: data.userId,
      tier: data.tier || 'free',
      status: data.status || 'active',
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      stripePriceId: data.stripePriceId || null,
      currentPeriodStart: data.currentPeriodStart || null,
      currentPeriodEnd: data.currentPeriodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      monthlyAnalysesUsed: data.monthlyAnalysesUsed || 0,
      monthlyResetDate: data.monthlyResetDate || null,
      creditBalance: data.creditBalance || 0,
      trialStartDate: data.trialStartDate || today,
      weeklyAnalysesUsed: data.weeklyAnalysesUsed || 0,
      weeklyResetDate: data.weeklyResetDate || today,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(data.userId, subscription);
    return subscription;
  }

  async updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    const existing = this.subscriptions.get(userId);
    if (!existing) return undefined;

    const updated: UserSubscription = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.subscriptions.set(userId, updated);
    return updated;
  }

  async getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | undefined> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.stripeCustomerId === customerId) return sub;
    }
    return undefined;
  }

  async getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | undefined> {
    for (const sub of Array.from(this.subscriptions.values())) {
      if (sub.stripeSubscriptionId === subscriptionId) return sub;
    }
    return undefined;
  }

  async getDailyUsage(userId: string, date: string): Promise<DailyUsage | undefined> {
    return this.dailyUsageMap.get(`${userId}:${date}`);
  }

  async incrementDailyUsage(userId: string, date: string): Promise<DailyUsage> {
    const key = `${userId}:${date}`;
    const existing = this.dailyUsageMap.get(key);

    if (existing) {
      const updated: DailyUsage = {
        ...existing,
        analysesCount: (existing.analysesCount || 0) + 1,
      };
      this.dailyUsageMap.set(key, updated);
      return updated;
    }

    const usage: DailyUsage = {
      id: this.usageIdCounter++,
      userId,
      date,
      analysesCount: 1,
      createdAt: new Date(),
    };
    this.dailyUsageMap.set(key, usage);
    return usage;
  }

  // Smart usage increment - handles trial, weekly, monthly based on tier
  // IMPORTANT: This is where trial starts for free tier users (on first analysis, not sign-up)
  async incrementUsage(userId: string): Promise<void> {
    let sub = this.subscriptions.get(userId);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (!sub) {
      // Create free tier subscription for user - trial starts NOW (first analysis)
      sub = {
        id: this.subscriptionIdCounter++,
        userId,
        tier: 'free',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        monthlyAnalysesUsed: 0,
        monthlyResetDate: today,
        creditBalance: 0,
        trialStartDate: today, // Trial starts on first analysis
        weeklyAnalysesUsed: 0,
        weeklyResetDate: today,
        createdAt: now,
        updatedAt: now,
      };
    } else if (sub.tier === 'free' && !sub.trialStartDate) {
      // User had subscription but hadn't started trial yet - start it now
      sub.trialStartDate = today;
      sub.weeklyResetDate = today;
    }

    const tier = sub.tier as SubscriptionTierId;

    if (tier === 'free') {
      // Free tier: track daily usage during trial, weekly after
      await this.incrementDailyUsage(userId, today);

      // Also track weekly for post-trial
      const weekStart = getWeekStart(now);
      if (sub.weeklyResetDate !== weekStart) {
        sub.weeklyAnalysesUsed = 1;
        sub.weeklyResetDate = weekStart;
      } else {
        sub.weeklyAnalysesUsed = (sub.weeklyAnalysesUsed || 0) + 1;
      }
    } else {
      // Paid tiers: monthly tracking
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const resetMonth = sub.monthlyResetDate?.slice(0, 7);

      if (resetMonth !== currentMonth) {
        sub.monthlyAnalysesUsed = 1;
        sub.monthlyResetDate = today;
      } else {
        sub.monthlyAnalysesUsed = (sub.monthlyAnalysesUsed || 0) + 1;
      }
    }

    sub.updatedAt = now;
    this.subscriptions.set(userId, sub);
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const sub = this.subscriptions.get(userId);
    if (sub) {
      sub.monthlyAnalysesUsed = 0;
      sub.monthlyResetDate = new Date().toISOString().split('T')[0];
      this.subscriptions.set(userId, sub);
    }
  }

  // Credit management
  async addCredits(userId: string, credits: number): Promise<void> {
    let sub = this.subscriptions.get(userId);
    if (sub) {
      sub.creditBalance = (sub.creditBalance || 0) + credits;
      this.subscriptions.set(userId, sub);
    }
  }

  async useCredit(userId: string): Promise<boolean> {
    const sub = this.subscriptions.get(userId);
    if (sub && (sub.creditBalance || 0) > 0) {
      sub.creditBalance = (sub.creditBalance || 0) - 1;
      this.subscriptions.set(userId, sub);
      return true;
    }
    return false;
  }

  async getCreditBalance(userId: string): Promise<number> {
    const sub = this.subscriptions.get(userId);
    return sub?.creditBalance || 0;
  }

  async recordCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase> {
    // In-memory: just return a mock purchase record
    return {
      id: Date.now(),
      userId: purchase.userId,
      packId: purchase.packId,
      credits: purchase.credits,
      amountPaid: purchase.amountPaid,
      stripePaymentIntentId: purchase.stripePaymentIntentId || null,
      createdAt: new Date(),
    };
  }

  async getUserUsageInfo(userId: string): Promise<UserUsageInfo> {
    const subscription = await this.getUserSubscription(userId);
    const tier = (subscription?.tier || 'free') as SubscriptionTierId;
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Get daily usage
    const dailyUsageRecord = await this.getDailyUsage(userId, today);
    const dailyUsed = dailyUsageRecord?.analysesCount || 0;

    // Calculate trial status for free tier
    let isInTrial = false;
    let trialDaysRemaining: number | null = null;
    let dailyLimit: number | null = null;
    let weeklyLimit: number | null = null;
    let weeklyUsed = 0;
    let weeklyRemaining: number | null = null;
    let hasStartedTrial = true; // Default to true for paid tiers

    if (tier === 'free') {
      const trialStartDate = subscription?.trialStartDate;

      // Check if user has started their trial yet
      if (!trialStartDate) {
        // User signed up but hasn't run their first analysis yet
        // They're in "pre-trial" state - trial starts on first analysis
        hasStartedTrial = false;
        isInTrial = true; // They'll be in trial once they start
        trialDaysRemaining = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialDays;
        dailyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialAnalysesPerDay;
      } else {
        hasStartedTrial = true;
        const trialStart = new Date(trialStartDate);
        const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        const trialDays = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialDays;

        if (daysSinceStart < trialDays) {
          isInTrial = true;
          trialDaysRemaining = trialDays - daysSinceStart;
          dailyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialAnalysesPerDay;
        } else {
          isInTrial = false;
          trialDaysRemaining = 0;
          weeklyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).postTrialAnalysesPerWeek;
          weeklyUsed = subscription?.weeklyAnalysesUsed || 0;
          weeklyRemaining = Math.max(0, weeklyLimit - weeklyUsed);
        }
      }
    }

    // Monthly usage for paid tiers
    const monthlyUsed = subscription?.monthlyAnalysesUsed || 0;
    const monthlyLimit = tierConfig.analysesPerMonth;
    const creditBalance = subscription?.creditBalance || 0;

    // Determine if user can analyze
    let canAnalyze = true;
    if (tier === 'free') {
      if (!hasStartedTrial) {
        // Pre-trial: user can always analyze (it will start their trial)
        canAnalyze = true;
      } else if (isInTrial) {
        canAnalyze = dailyLimit === null || dailyUsed < dailyLimit || creditBalance > 0;
      } else {
        canAnalyze = weeklyLimit === null || weeklyUsed < weeklyLimit || creditBalance > 0;
      }
    } else {
      canAnalyze = monthlyLimit === null || monthlyUsed < monthlyLimit || creditBalance > 0;
    }

    return {
      tier,
      tierName: tierConfig.name,
      isSubscribed: tier !== 'free',
      isInTrial,
      trialDaysRemaining,
      dailyLimit,
      dailyUsed,
      dailyRemaining: dailyLimit !== null ? Math.max(0, dailyLimit - dailyUsed) : null,
      weeklyLimit,
      weeklyUsed,
      weeklyRemaining,
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlyUsed) : null,
      creditBalance,
      canAnalyze,
      leaderboardLimit: null, // All tiers get full access
    };
  }
}

// Helper function to get week start date (Monday)
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// PostgreSQL Storage Implementation
export class PostgresStorage implements IStorage {
  async getAnalysis(id: number): Promise<TokenAnalysis | undefined> {
    if (!db) return undefined;
    const results = await db.select().from(tokenAnalyses).where(eq(tokenAnalyses.id, id)).limit(1);
    return results[0];
  }

  async getAnalysisByTokenId(tokenId: string): Promise<TokenAnalysis | undefined> {
    if (!db) return undefined;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await db
      .select()
      .from(tokenAnalyses)
      .where(
        and(
          eq(tokenAnalyses.tokenId, tokenId),
          eq(tokenAnalyses.status, "completed"),
          sql`${tokenAnalyses.createdAt} > ${dayAgo}`
        )
      )
      .limit(1);
    return results[0];
  }

  async createAnalysis(insertAnalysis: InsertTokenAnalysis): Promise<TokenAnalysis> {
    if (!db) throw new Error("Database not available");
    // Cast jsonb fields explicitly to match Drizzle's expected types
    const values = {
      ...insertAnalysis,
      coordinationRisks: insertAnalysis.coordinationRisks as string[] | null | undefined,
      catalysts: insertAnalysis.catalysts as string[] | null | undefined,
      categories: insertAnalysis.categories as string[] | null | undefined,
      modelScores: insertAnalysis.modelScores as ModelScores | null | undefined,
    };
    const results = await db.insert(tokenAnalyses).values(values).returning();
    return results[0];
  }

  async updateAnalysis(id: number, update: Partial<InsertTokenAnalysis>): Promise<TokenAnalysis | undefined> {
    if (!db) return undefined;
    // Destructure to handle jsonb fields separately
    const { coordinationRisks, catalysts, categories, modelScores, ...rest } = update;

    // Build values with proper type casting for jsonb fields
    const values: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };

    if (coordinationRisks !== undefined) {
      values.coordinationRisks = coordinationRisks as string[] | null;
    }
    if (catalysts !== undefined) {
      values.catalysts = catalysts as string[] | null;
    }
    if (categories !== undefined) {
      values.categories = categories as string[] | null;
    }
    if (modelScores !== undefined) {
      values.modelScores = modelScores as ModelScores | null;
    }

    const results = await db
      .update(tokenAnalyses)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(values as any)
      .where(eq(tokenAnalyses.id, id))
      .returning();
    return results[0];
  }

  async getAllAnalyses(options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    if (!db) return { items: [], total: 0 };

    // Get items sorted by createdAt descending
    const items = await db
      .select()
      .from(tokenAnalyses)
      .orderBy(desc(tokenAnalyses.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenAnalyses);

    return {
      items,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async getUserAnalyses(userId: string, options: {
    limit: number;
    offset: number;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    if (!db) return { items: [], total: 0 };

    // Get items for specific user sorted by createdAt descending
    const items = await db
      .select()
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.userId, userId))
      .orderBy(desc(tokenAnalyses.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    // Get total count for this user
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.userId, userId));

    return {
      items,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async getLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'finalScore' | 'createdAt';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: TokenAnalysis[]; total: number }> {
    if (!db) return { items: [], total: 0 };

    // Build where conditions
    const conditions = [eq(tokenAnalyses.status, "completed")];

    if (options.filters?.tier) {
      conditions.push(eq(tokenAnalyses.tier, options.filters.tier));
    }

    if (options.filters?.narrative) {
      conditions.push(ilike(tokenAnalyses.narrative, `%${options.filters.narrative}%`));
    }

    if (options.filters?.chain) {
      conditions.push(ilike(tokenAnalyses.chain, options.filters.chain));
    }

    if (options.filters?.search) {
      conditions.push(
        or(
          ilike(tokenAnalyses.tokenName, `%${options.filters.search}%`),
          ilike(tokenAnalyses.tokenSymbol, `%${options.filters.search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Build order
    const orderColumn = options.sortBy === 'createdAt' ? tokenAnalyses.createdAt : tokenAnalyses.finalScore;
    const orderFn = options.order === 'asc' ? asc : desc;

    // Get items
    const items = await db
      .select()
      .from(tokenAnalyses)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(options.limit)
      .offset(options.offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenAnalyses)
      .where(whereClause);

    return {
      items,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async getAggregatedLeaderboard(options: {
    limit: number;
    offset: number;
    sortBy: 'score7d' | 'score30d' | 'runs7d' | 'latestAnalysis';
    order: 'asc' | 'desc';
    filters?: LeaderboardFilters;
  }): Promise<{ items: AggregatedLeaderboardItem[]; total: number }> {
    if (!db) return { items: [], total: 0 };

    // Build filter conditions for the subquery
    let filterConditions = `status = 'completed'`;
    if (options.filters?.tier) {
      filterConditions += ` AND tier = '${options.filters.tier.replace(/'/g, "''")}'`;
    }
    if (options.filters?.narrative) {
      filterConditions += ` AND narrative ILIKE '%${options.filters.narrative.replace(/'/g, "''")}%'`;
    }
    if (options.filters?.chain) {
      filterConditions += ` AND chain ILIKE '${options.filters.chain.replace(/'/g, "''")}'`;
    }
    if (options.filters?.search) {
      const search = options.filters.search.replace(/'/g, "''");
      filterConditions += ` AND (token_name ILIKE '%${search}%' OR token_symbol ILIKE '%${search}%')`;
    }

    // Determine sort column and order
    let orderBy = 'score_7d DESC';
    if (options.sortBy === 'latestAnalysis') {
      orderBy = options.order === 'asc' ? 'latest_date ASC' : 'latest_date DESC';
    } else if (options.sortBy === 'runs7d') {
      orderBy = options.order === 'asc' ? 'runs_7d ASC' : 'runs_7d DESC';
    } else if (options.sortBy === 'score30d') {
      orderBy = options.order === 'asc' ? 'score_30d ASC' : 'score_30d DESC';
    } else {
      // Default: score7d (primary metric)
      orderBy = options.order === 'asc' ? 'score_7d ASC' : 'score_7d DESC';
    }

    // Use raw SQL for aggregation query with 7D/30D metrics
    const query = sql`
      WITH latest_analyses AS (
        SELECT DISTINCT ON (token_id)
          id, token_id, token_symbol, token_name, token_image, chain,
          COALESCE(tier, 'B') as tier,
          narrative,
          created_at,
          COALESCE(CAST(final_score AS numeric), 0) as final_score
        FROM token_analyses
        WHERE ${sql.raw(filterConditions)}
        ORDER BY token_id, created_at DESC
      ),
      aggregated AS (
        SELECT
          t.token_id,
          la.token_symbol,
          la.token_name,
          la.token_image,
          la.chain,
          -- 7D metrics
          COALESCE(ROUND(AVG(CASE WHEN t.created_at >= NOW() - INTERVAL '7 days' THEN CAST(t.final_score AS numeric) END), 2), CAST(la.final_score AS numeric)) as score_7d,
          COUNT(CASE WHEN t.created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int as runs_7d,
          -- 30D metrics
          COALESCE(ROUND(AVG(CASE WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN CAST(t.final_score AS numeric) END), 2), CAST(la.final_score AS numeric)) as score_30d,
          COUNT(CASE WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as runs_30d,
          la.tier as latest_tier,
          la.narrative as latest_narrative,
          la.id as latest_analysis_id,
          la.created_at as latest_date
        FROM token_analyses t
        JOIN latest_analyses la ON t.token_id = la.token_id
        WHERE t.status = 'completed'
        GROUP BY t.token_id, la.token_symbol, la.token_name, la.token_image, la.chain, la.tier, la.narrative, la.id, la.created_at, la.final_score
      )
      SELECT * FROM aggregated
      ORDER BY ${sql.raw(orderBy)}
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `;

    const countQuery = sql`
      SELECT COUNT(DISTINCT token_id)::int as count
      FROM token_analyses
      WHERE ${sql.raw(filterConditions)}
    `;

    try {
      const results = await db.execute(query);
      const countResult = await db.execute(countQuery);

      const items: AggregatedLeaderboardItem[] = (results.rows as Record<string, unknown>[]).map(row => {
        // Handle date - could be Date object or string
        let latestDate: Date;
        if (row.latest_date instanceof Date) {
          latestDate = row.latest_date;
        } else if (row.latest_date) {
          latestDate = new Date(row.latest_date as string);
        } else {
          latestDate = new Date();
        }

        const runs7d = Number(row.runs_7d) || 0;
        // Confidence based on 7D sample size
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (runs7d >= 5) confidence = 'high';
        else if (runs7d >= 2) confidence = 'medium';

        return {
          tokenId: row.token_id as string,
          tokenSymbol: row.token_symbol as string || '',
          tokenName: row.token_name as string || '',
          tokenImage: row.token_image as string | null,
          chain: row.chain as string | null,
          score7d: Number(row.score_7d) || 0,
          runs7d,
          score30d: Number(row.score_30d) || 0,
          runs30d: Number(row.runs_30d) || 0,
          confidence,
          latestTier: (row.latest_tier as string) || 'B',
          latestNarrative: row.latest_narrative as string | null,
          latestAnalysisId: Number(row.latest_analysis_id) || 0,
          latestAnalysisDate: latestDate,
        };
      });

      return {
        items,
        total: Number((countResult.rows[0] as Record<string, unknown>)?.count || 0),
      };
    } catch (error) {
      console.error("Error in getAggregatedLeaderboard:", error);
      return { items: [], total: 0 };
    }
  }

  async getDistinctNarratives(): Promise<string[]> {
    if (!db) return [];
    const results = await db
      .selectDistinct({ narrative: tokenAnalyses.narrative })
      .from(tokenAnalyses)
      .where(and(eq(tokenAnalyses.status, "completed"), sql`${tokenAnalyses.narrative} IS NOT NULL`));
    return results.map((r) => r.narrative!).filter(Boolean).sort();
  }

  async getDistinctChains(): Promise<string[]> {
    if (!db) return [];
    const results = await db
      .selectDistinct({ chain: tokenAnalyses.chain })
      .from(tokenAnalyses)
      .where(and(eq(tokenAnalyses.status, "completed"), sql`${tokenAnalyses.chain} IS NOT NULL`));
    return results.map((r) => r.chain!).filter(Boolean).sort();
  }

  async getDistinctTiers(): Promise<string[]> {
    if (!db) return [];
    const results = await db
      .selectDistinct({ tier: tokenAnalyses.tier })
      .from(tokenAnalyses)
      .where(eq(tokenAnalyses.status, "completed"));

    const tierOrder = ['S+', 'S', 'A', 'B', 'DISQUALIFIED'];
    return results
      .map((r) => r.tier)
      .filter(Boolean)
      .sort((a, b) => {
        const aIdx = tierOrder.indexOf(a);
        const bIdx = tierOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
  }

  // Subscription Management
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    if (!db) return undefined;
    const results = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
    return results[0];
  }

  async createOrUpdateSubscription(data: InsertUserSubscription): Promise<UserSubscription> {
    if (!db) throw new Error("Database not available");

    const existing = await this.getUserSubscription(data.userId);
    if (existing) {
      const results = await db
        .update(userSubscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, data.userId))
        .returning();
      return results[0];
    }

    const results = await db.insert(userSubscriptions).values(data).returning();
    return results[0];
  }

  async updateSubscription(userId: string, data: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    if (!db) return undefined;
    const results = await db
      .update(userSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId))
      .returning();
    return results[0];
  }

  async getSubscriptionByStripeCustomerId(customerId: string): Promise<UserSubscription | undefined> {
    if (!db) return undefined;
    const results = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeCustomerId, customerId))
      .limit(1);
    return results[0];
  }

  async getSubscriptionByStripeSubscriptionId(subscriptionId: string): Promise<UserSubscription | undefined> {
    if (!db) return undefined;
    const results = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return results[0];
  }

  // Usage Tracking
  async getDailyUsage(userId: string, date: string): Promise<DailyUsage | undefined> {
    if (!db) return undefined;
    const results = await db
      .select()
      .from(dailyUsage)
      .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)))
      .limit(1);
    return results[0];
  }

  async incrementDailyUsage(userId: string, date: string): Promise<DailyUsage> {
    if (!db) throw new Error("Database not available");

    const existing = await this.getDailyUsage(userId, date);
    if (existing) {
      const results = await db
        .update(dailyUsage)
        .set({ analysesCount: (existing.analysesCount || 0) + 1 })
        .where(eq(dailyUsage.id, existing.id))
        .returning();
      return results[0];
    }

    const results = await db.insert(dailyUsage).values({ userId, date, analysesCount: 1 }).returning();
    return results[0];
  }

  // Smart usage increment - handles trial, weekly, monthly based on tier
  // IMPORTANT: This is where trial starts for free tier users (on first analysis, not sign-up)
  async incrementUsage(userId: string): Promise<void> {
    if (!db) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const existing = await this.getUserSubscription(userId);

    if (!existing) {
      // Create free tier subscription - trial starts NOW (first analysis)
      await db.insert(userSubscriptions).values({
        userId,
        tier: 'free',
        status: 'active',
        monthlyAnalysesUsed: 0,
        monthlyResetDate: today,
        creditBalance: 0,
        trialStartDate: today, // Trial starts on first analysis
        weeklyAnalysesUsed: 1,
        weeklyResetDate: getWeekStart(now),
      });
      await this.incrementDailyUsage(userId, today);
      return;
    }

    const tier = existing.tier as SubscriptionTierId;

    if (tier === 'free') {
      // Check if this is the first analysis (trial not started yet)
      if (!existing.trialStartDate) {
        // Start trial now
        await db
          .update(userSubscriptions)
          .set({
            trialStartDate: today,
            weeklyResetDate: getWeekStart(now),
            updatedAt: now,
          })
          .where(eq(userSubscriptions.userId, userId));
      }

      // Free tier: track daily and weekly
      await this.incrementDailyUsage(userId, today);

      const weekStart = getWeekStart(now);
      if (existing.weeklyResetDate !== weekStart) {
        await db
          .update(userSubscriptions)
          .set({
            weeklyAnalysesUsed: 1,
            weeklyResetDate: weekStart,
            updatedAt: now,
          })
          .where(eq(userSubscriptions.userId, userId));
      } else {
        await db
          .update(userSubscriptions)
          .set({
            weeklyAnalysesUsed: sql`COALESCE(${userSubscriptions.weeklyAnalysesUsed}, 0) + 1`,
            updatedAt: now,
          })
          .where(eq(userSubscriptions.userId, userId));
      }
    } else {
      // Paid tiers: monthly tracking
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const resetMonth = existing.monthlyResetDate?.slice(0, 7);

      if (resetMonth !== currentMonth) {
        await db
          .update(userSubscriptions)
          .set({
            monthlyAnalysesUsed: 1,
            monthlyResetDate: today,
            updatedAt: now,
          })
          .where(eq(userSubscriptions.userId, userId));
      } else {
        await db
          .update(userSubscriptions)
          .set({
            monthlyAnalysesUsed: sql`COALESCE(${userSubscriptions.monthlyAnalysesUsed}, 0) + 1`,
            updatedAt: now,
          })
          .where(eq(userSubscriptions.userId, userId));
      }
    }
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    if (!db) return;
    await db
      .update(userSubscriptions)
      .set({
        monthlyAnalysesUsed: 0,
        monthlyResetDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  // Credit management
  async addCredits(userId: string, credits: number): Promise<void> {
    if (!db) return;
    await db
      .update(userSubscriptions)
      .set({
        creditBalance: sql`COALESCE(${userSubscriptions.creditBalance}, 0) + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, userId));
  }

  async useCredit(userId: string): Promise<boolean> {
    if (!db) return false;
    const sub = await this.getUserSubscription(userId);
    if (sub && (sub.creditBalance || 0) > 0) {
      await db
        .update(userSubscriptions)
        .set({
          creditBalance: sql`${userSubscriptions.creditBalance} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.userId, userId));
      return true;
    }
    return false;
  }

  async getCreditBalance(userId: string): Promise<number> {
    const sub = await this.getUserSubscription(userId);
    return sub?.creditBalance || 0;
  }

  async recordCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase> {
    if (!db) throw new Error("Database not available");
    const results = await db.insert(creditPurchases).values(purchase).returning();
    return results[0];
  }

  async getUserUsageInfo(userId: string): Promise<UserUsageInfo> {
    const subscription = await this.getUserSubscription(userId);
    const tier = (subscription?.tier || 'free') as SubscriptionTierId;
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Get daily usage
    const dailyUsageRecord = await this.getDailyUsage(userId, today);
    const dailyUsed = dailyUsageRecord?.analysesCount || 0;

    // Calculate trial status for free tier
    let isInTrial = false;
    let trialDaysRemaining: number | null = null;
    let dailyLimit: number | null = null;
    let weeklyLimit: number | null = null;
    let weeklyUsed = 0;
    let weeklyRemaining: number | null = null;
    let hasStartedTrial = true; // Default to true for paid tiers

    if (tier === 'free') {
      const trialStartDate = subscription?.trialStartDate;

      // Check if user has started their trial yet
      if (!trialStartDate) {
        // User signed up but hasn't run their first analysis yet
        // They're in "pre-trial" state - trial starts on first analysis
        hasStartedTrial = false;
        isInTrial = true; // They'll be in trial once they start
        trialDaysRemaining = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialDays;
        dailyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialAnalysesPerDay;
      } else {
        hasStartedTrial = true;
        const trialStart = new Date(trialStartDate);
        const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        const trialDays = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialDays;

        if (daysSinceStart < trialDays) {
          isInTrial = true;
          trialDaysRemaining = trialDays - daysSinceStart;
          dailyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).trialAnalysesPerDay;
        } else {
          isInTrial = false;
          trialDaysRemaining = 0;
          weeklyLimit = (tierConfig as typeof SUBSCRIPTION_TIERS.free).postTrialAnalysesPerWeek;
          weeklyUsed = subscription?.weeklyAnalysesUsed || 0;
          weeklyRemaining = Math.max(0, weeklyLimit - weeklyUsed);
        }
      }
    }

    // Monthly usage for paid tiers
    const monthlyUsed = subscription?.monthlyAnalysesUsed || 0;
    const monthlyLimit = tierConfig.analysesPerMonth;
    const creditBalance = subscription?.creditBalance || 0;

    // Determine if user can analyze
    let canAnalyze = true;
    if (tier === 'free') {
      if (!hasStartedTrial) {
        // Pre-trial: user can always analyze (it will start their trial)
        canAnalyze = true;
      } else if (isInTrial) {
        canAnalyze = dailyLimit === null || dailyUsed < dailyLimit || creditBalance > 0;
      } else {
        canAnalyze = weeklyLimit === null || weeklyUsed < weeklyLimit || creditBalance > 0;
      }
    } else {
      canAnalyze = monthlyLimit === null || monthlyUsed < monthlyLimit || creditBalance > 0;
    }

    return {
      tier,
      tierName: tierConfig.name,
      isSubscribed: tier !== 'free',
      isInTrial,
      trialDaysRemaining,
      dailyLimit,
      dailyUsed,
      dailyRemaining: dailyLimit !== null ? Math.max(0, dailyLimit - dailyUsed) : null,
      weeklyLimit,
      weeklyUsed,
      weeklyRemaining,
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlyUsed) : null,
      creditBalance,
      canAnalyze,
      leaderboardLimit: null, // All tiers get full access
    };
  }
}

// Storage factory - uses PostgreSQL if available, falls back to in-memory
let storageInstance: IStorage = new MemStorage();

export async function initStorage(): Promise<IStorage> {
  const dbConnected = await testConnection();
  if (dbConnected && db) {
    console.log("Using PostgreSQL storage");
    storageInstance = new PostgresStorage();
  } else {
    console.log("Using in-memory storage (data will not persist)");
    storageInstance = new MemStorage();
  }

  // Update the exported storage reference
  storage = storageInstance;
  return storageInstance;
}

// Export as getter that returns current instance
export let storage: IStorage = storageInstance;
