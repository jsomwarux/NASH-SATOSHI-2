import type {
  TokenSearchResult,
  TokenDetails,
  TokenAnalysis,
  AnalyzeTokenRequest,
  AnalysisStatus,
  LeaderboardFilters,
} from "@shared/schema";
import type { AggregatedLeaderboardItem } from "@/types/leaderboard";

const API_BASE = "";

async function fetchApi<T>(
  path: string,
  options?: RequestInit & { authToken?: string }
): Promise<T> {
  const { authToken, ...fetchOptions } = options || {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...fetchOptions?.headers as Record<string, string>,
  };

  // Add auth token if provided
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Token Search
export async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  const data = await fetchApi<{ coins: TokenSearchResult[] }>(
    `/api/token/search?q=${encodeURIComponent(query)}`
  );
  return data.coins;
}

// Token Details
export async function getTokenDetails(tokenId: string): Promise<TokenDetails> {
  return fetchApi<TokenDetails>(`/api/token/${tokenId}`);
}

// Start Analysis (with optional auth token to associate with user)
export async function analyzeToken(
  request: AnalyzeTokenRequest,
  authToken?: string
): Promise<{ analysisId: number; status: string }> {
  return fetchApi<{ analysisId: number; status: string }>("/api/analyze", {
    method: "POST",
    body: JSON.stringify(request),
    authToken,
  });
}

// Get Analysis Status (for polling)
export async function getAnalysisStatus(analysisId: number): Promise<AnalysisStatus> {
  return fetchApi<AnalysisStatus>(`/api/analyze/${analysisId}/status`);
}

// Get Analysis by ID
export async function getAnalysis(analysisId: number): Promise<TokenAnalysis> {
  return fetchApi<TokenAnalysis>(`/api/analyze/${analysisId}`);
}

// Get Analysis by Token ID
export async function getAnalysisByToken(tokenId: string): Promise<TokenAnalysis> {
  return fetchApi<TokenAnalysis>(`/api/analyze/token/${tokenId}`);
}

// Get Leaderboard
export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  sortBy?: "score7d" | "score30d" | "runs7d" | "latestAnalysis";
  order?: "asc" | "desc";
  filters?: LeaderboardFilters;
}

export async function getLeaderboard(
  options?: LeaderboardOptions
): Promise<{ items: AggregatedLeaderboardItem[]; total: number }> {
  const params = new URLSearchParams();

  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  if (options?.sortBy) params.set("sortBy", options.sortBy);
  if (options?.order) params.set("order", options.order);

  if (options?.filters) {
    if (options.filters.tier) params.set("tier", options.filters.tier);
    if (options.filters.narrative) params.set("narrative", options.filters.narrative);
    if (options.filters.chain) params.set("chain", options.filters.chain);
    if (options.filters.search) params.set("search", options.filters.search);
  }

  const queryString = params.toString();
  const url = queryString ? `/api/leaderboard?${queryString}` : "/api/leaderboard";

  return fetchApi<{ items: AggregatedLeaderboardItem[]; total: number }>(url);
}

// Get Filter Options
export async function getFilterOptions(): Promise<{
  tiers: string[];
  narratives: string[];
  chains: string[];
}> {
  return fetchApi<{ tiers: string[]; narratives: string[]; chains: string[] }>("/api/filters");
}

// Leaderboard Stats
export interface LeaderboardStats {
  topToken: { symbol: string; name: string; score: number; daysOnLeaderboard: number } | null;
  topNarrative: { narrative: string; avgScore: number; tokenCount: number } | null;
  strongestConviction: { symbol: string; name: string; score: number; consensus: string } | null;
}

export async function getLeaderboardStats(): Promise<LeaderboardStats> {
  return fetchApi<LeaderboardStats>("/api/leaderboard/stats");
}

// Get User's Analyses (requires auth)
export interface UserAnalysesOptions {
  limit?: number;
  offset?: number;
  authToken: string;
}

export async function getUserAnalyses(
  options: UserAnalysesOptions
): Promise<{ items: TokenAnalysis[]; total: number }> {
  const params = new URLSearchParams();

  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const url = queryString ? `/api/user/analyses?${queryString}` : "/api/user/analyses";

  try {
    return await fetchApi<{ items: TokenAnalysis[]; total: number }>(url, {
      authToken: options.authToken,
    });
  } catch (error) {
    // If server auth isn't configured, return empty array instead of erroring
    if (error instanceof Error && error.message.includes("Authentication")) {
      console.warn("Server auth not configured, returning empty analyses");
      return { items: [], total: 0 };
    }
    throw error;
  }
}

// Legacy: Get All Analyses (no auth - returns all for leaderboard-style view)
export interface AllAnalysesOptions {
  limit?: number;
  offset?: number;
}

export async function getAllAnalyses(
  options?: AllAnalysesOptions
): Promise<{ items: TokenAnalysis[]; total: number }> {
  const params = new URLSearchParams();

  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const url = queryString ? `/api/analyses?${queryString}` : "/api/analyses";

  return fetchApi<{ items: TokenAnalysis[]; total: number }>(url);
}

// ==================== SUBSCRIPTION API ====================

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  priceId: string | null;
  features: string[];
  analysesPerDay: number | null;
  analysesPerMonth: number | null;
  leaderboardLimit: number | null;
  popular: boolean;
}

export interface SubscriptionStatus {
  tier: string;
  tierName: string;
  isSubscribed: boolean;
  isInTrial: boolean;
  trialDaysRemaining: number | null;
  dailyLimit: number | null;
  dailyUsed: number;
  dailyRemaining: number | null;
  weeklyLimit: number | null;
  weeklyUsed: number;
  weeklyRemaining: number | null;
  monthlyLimit: number | null;
  monthlyUsed: number;
  monthlyRemaining: number | null;
  creditBalance: number;
  canAnalyze: boolean;
  leaderboardLimit: number | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

// Get subscription tiers (public)
export async function getSubscriptionTiers(): Promise<{
  tiers: SubscriptionTier[];
  stripeConfigured: boolean;
}> {
  return fetchApi<{ tiers: SubscriptionTier[]; stripeConfigured: boolean }>(
    "/api/subscription/tiers"
  );
}

// Get current user's subscription status
export async function getSubscriptionStatus(
  authToken?: string
): Promise<SubscriptionStatus> {
  return fetchApi<SubscriptionStatus>("/api/subscription/status", {
    authToken,
  });
}

// Create checkout session for subscription
export async function createCheckoutSession(
  tier: string,
  authToken: string
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>("/api/subscription/checkout", {
    method: "POST",
    body: JSON.stringify({ tier }),
    authToken,
  });
}

// Create billing portal session
export async function createBillingPortal(
  authToken: string
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>("/api/subscription/portal", {
    method: "POST",
    authToken,
  });
}

// Verify checkout session and sync subscription
export async function verifyCheckoutSession(
  sessionId: string,
  authToken: string
): Promise<{ success: boolean; tier?: string; message?: string }> {
  return fetchApi<{ success: boolean; tier?: string; message?: string }>(
    "/api/subscription/verify",
    {
      method: "POST",
      body: JSON.stringify({ sessionId }),
      authToken,
    }
  );
}

// Sync subscription from Stripe (for after billing portal changes)
export async function syncSubscription(
  authToken: string
): Promise<{ success: boolean; tier?: string; status?: string; message?: string }> {
  return fetchApi<{ success: boolean; tier?: string; status?: string; message?: string }>(
    "/api/subscription/sync",
    {
      method: "POST",
      authToken,
    }
  );
}

// ==================== CREDIT PACK API ====================

// Create checkout session for credit pack
export async function createCreditCheckout(
  packId: string,
  authToken: string
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>("/api/credits/checkout", {
    method: "POST",
    body: JSON.stringify({ packId }),
    authToken,
  });
}

// Verify credit purchase and add credits
export async function verifyCreditPurchase(
  sessionId: string,
  authToken: string
): Promise<{ success: boolean; credits?: number; message?: string }> {
  return fetchApi<{ success: boolean; credits?: number; message?: string }>(
    "/api/credits/verify",
    {
      method: "POST",
      body: JSON.stringify({ sessionId }),
      authToken,
    }
  );
}
