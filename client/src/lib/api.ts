import type {
  TokenSearchResult,
  TokenDetails,
  TokenAnalysis,
  AnalysisStatus,
  LeaderboardFilters,
  TokenStats,
} from "@shared/schema";
import type { AggregatedLeaderboardItem } from "@/types/leaderboard";

const API_BASE = "";

// Custom error class for API errors with code
export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchApi<T>(
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
    throw new ApiError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error.code
    );
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

// Dexscreener Token Lookup
export interface DexscreenerTokenInfo {
  contractAddress: string;
  chain: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: string | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;
  dexUrl: string | null;
}

export async function lookupDexscreenerToken(
  contractAddress: string,
  chain: string
): Promise<DexscreenerTokenInfo | null> {
  const data = await fetchApi<{ found: boolean; token?: DexscreenerTokenInfo }>(
    `/api/dexscreener/token?address=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}`
  );
  return data.found ? data.token! : null;
}

// Get supported Dexscreener chains
export async function getDexscreenerChains(): Promise<{ id: string; name: string }[]> {
  const data = await fetchApi<{ chains: { id: string; name: string }[] }>("/api/dexscreener/chains");
  return data.chains;
}

// Lookup token by contract address on CoinGecko
export interface CoinGeckoContractLookupResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string | null;
  large: string | null;
  market_cap_rank: number | null;
  platform?: string;
}

export async function lookupCoinGeckoByContract(
  contractAddress: string
): Promise<CoinGeckoContractLookupResult | null> {
  const data = await fetchApi<{ coins: CoinGeckoContractLookupResult[]; foundByContract?: boolean; platform?: string }>(
    `/api/token/search?q=${encodeURIComponent(contractAddress)}`
  );
  if (data.foundByContract && data.coins.length > 0) {
    return { ...data.coins[0], platform: data.platform };
  }
  return null;
}

// Get Analysis Status (for polling)
export async function getAnalysisStatus(analysisId: number): Promise<AnalysisStatus> {
  return fetchApi<AnalysisStatus>(`/api/analyze/${analysisId}/status`);
}

// Get Analysis by ID
export async function getAnalysis(analysisId: number, authToken?: string): Promise<TokenAnalysis> {
  return fetchApi<TokenAnalysis>(`/api/analyze/${analysisId}`, { authToken });
}

// Get Analysis by Token ID
export async function getAnalysisByToken(tokenId: string): Promise<TokenAnalysis> {
  return fetchApi<TokenAnalysis>(`/api/analyze/token/${tokenId}`);
}

// Get Analysis by Symbol/Ticker (for clean URLs like /token/PREDI)
export async function getAnalysisBySymbol(symbol: string, authToken?: string): Promise<TokenAnalysis> {
  return fetchApi<TokenAnalysis>(`/api/analyze/symbol/${encodeURIComponent(symbol)}`, { authToken });
}

// Get Token Stats (aggregate data for tokens with multiple analyses)
export async function getTokenStats(tokenId: string): Promise<TokenStats> {
  return fetchApi<TokenStats>(`/api/token/${tokenId}/stats`);
}

// Get Leaderboard
export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  sortBy?: "latestScore" | "scoreTrend" | "latestAnalysis" | "tier" | "tokenType" | "asymmetryScore" | "upsideTier";
  order?: "asc" | "desc";
  filters?: LeaderboardFilters;
}

export interface LeaderboardResponse {
  items: AggregatedLeaderboardItem[];
  total: number;
  accessLimit: number | null;
  hasGatedItems: boolean;
  isPremium: boolean;
  userTier: string;
  isBeta?: boolean; // True when platform is in beta mode
}

export async function getLeaderboard(
  options?: LeaderboardOptions,
  authToken?: string
): Promise<LeaderboardResponse> {
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
    if (options.filters.tokenType) params.set("tokenType", options.filters.tokenType);
    if (options.filters.marketCapTier) params.set("marketCapTier", options.filters.marketCapTier);
    if (options.filters.upsideTier) params.set("upsideTier", options.filters.upsideTier);
  }

  const queryString = params.toString();
  const url = queryString ? `/api/leaderboard?${queryString}` : "/api/leaderboard";

  return fetchApi<LeaderboardResponse>(url, { authToken });
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
  topTokens: { symbol: string; name: string; score: number; daysInTop3: number }[];
  topNarratives: { narrative: string; avgScore: number; tokenCount: number }[];
  winners7d: { symbol: string; name: string; score: number }[];
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
  isPremium: boolean;
  isBeta?: boolean; // True when platform is in beta mode (full access for all)
  isInTrial: boolean;
  trialDaysRemaining: number | null;
  // Vote tracking
  votesPerDay: number;
  votesUsedToday: number;
  votesRemaining: number;
  priorityVotes: boolean;
  // Legacy fields (deprecated but kept for backward compatibility)
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

// Set referral code for user (call after signup)
export async function setUserReferralCode(
  referralCode: string,
  authToken: string
): Promise<{ success: boolean; message?: string }> {
  return fetchApi<{ success: boolean; message?: string }>("/api/user/referral", {
    method: "POST",
    body: JSON.stringify({ referralCode }),
    authToken,
  });
}

// Create checkout session for subscription
export async function createCheckoutSession(
  tier: string,
  authToken: string,
  referralCode?: string
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>("/api/subscription/checkout", {
    method: "POST",
    body: JSON.stringify({ tier, referralCode }),
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
  authToken: string,
  referralCode?: string
): Promise<{ url: string }> {
  return fetchApi<{ url: string }>("/api/credits/checkout", {
    method: "POST",
    body: JSON.stringify({ packId, referralCode }),
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

// ==================== VOTING API ====================

export interface VoteStatus {
  votesRemaining: number;
  votesUsed: number;
  maxVotes: number;
  hasPriorityVotes: boolean;
  resetTime: string;
  votedRequestIds: number[];
  authenticated: boolean;
  isBeta?: boolean; // True when platform is in beta mode
}

export interface VoteRequest {
  id: number;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  contractAddress: string | null;
  source: string | null; // "coingecko" or "dexscreener"
  voteCount: number;
  priorityVoteCount: number;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
  analysisId: number | null;
}

// Get user's vote status
export async function getVoteStatus(authToken?: string): Promise<VoteStatus> {
  return fetchApi<VoteStatus>("/api/vote/status", { authToken });
}

// Get vote requests (pending tokens)
export async function getVoteRequests(
  options?: { limit?: number; offset?: number; status?: string }
): Promise<{ items: VoteRequest[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  if (options?.status) params.set("status", options.status);

  const queryString = params.toString();
  const url = queryString ? `/api/vote/requests?${queryString}` : "/api/vote/requests";
  return fetchApi<{ items: VoteRequest[]; total: number }>(url);
}

// Get top pending vote requests
export async function getTopVoteRequests(limit?: number): Promise<VoteRequest[]> {
  const url = limit ? `/api/vote/top?limit=${limit}` : "/api/vote/top";
  return fetchApi<VoteRequest[]>(url);
}

// Get recently analyzed vote requests
export async function getRecentlyAnalyzedRequests(limit?: number): Promise<VoteRequest[]> {
  const url = limit ? `/api/vote/recently-analyzed?limit=${limit}` : "/api/vote/recently-analyzed";
  return fetchApi<VoteRequest[]>(url);
}

// Yesterday's top vote result
export interface YesterdayTopVote {
  request: VoteRequest;
  voteCount: number;
  priorityVoteCount: number;
  totalScore: number;
}

// Get yesterday's top voted token
export async function getYesterdayTopVote(): Promise<YesterdayTopVote | null> {
  return fetchApi<YesterdayTopVote | null>("/api/vote/yesterday-top");
}

// Submit a vote for a token
export interface SubmitVoteRequest {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  chain?: string; // blockchain network
  contractAddress: string; // required - token contract address
  source: "coingecko" | "dexscreener"; // required - data source
}

export interface SubmitVoteResponse {
  message: string;
  voteRequest: VoteRequest;
  isPriorityVote: boolean;
  votesRemaining: number;
}

export async function submitVote(
  vote: SubmitVoteRequest,
  authToken: string
): Promise<SubmitVoteResponse> {
  return fetchApi<SubmitVoteResponse>("/api/vote", {
    method: "POST",
    body: JSON.stringify(vote),
    authToken,
  });
}

// ==================== SHARING & REFERRAL API ====================

// Share types
export interface ShareTwitterRequest {
  text: string;
  url?: string;
  tokenSymbol?: string;
  analysisId?: number;
}

export interface ShareTwitterResponse {
  shareId: number;
  intentUrl: string;
  message: string;
}

export async function createTwitterShare(
  data: ShareTwitterRequest,
  authToken: string
): Promise<ShareTwitterResponse> {
  return fetchApi<ShareTwitterResponse>("/api/share/twitter", {
    method: "POST",
    body: JSON.stringify(data),
    authToken,
  });
}

export interface VerifyShareResponse {
  verified: boolean;
  isPrioritySharer: boolean;
  message: string;
}

export async function verifyShare(
  shareId: number,
  authToken: string
): Promise<VerifyShareResponse> {
  return fetchApi<VerifyShareResponse>("/api/share/verify", {
    method: "POST",
    body: JSON.stringify({ shareId }),
    authToken,
  });
}

export interface ShareStats {
  totalShares: number;
  verifiedShares: number;
  isPrioritySharer: boolean;
  sharesNeededForPriority: number;
}

export async function getShareStats(authToken: string): Promise<ShareStats> {
  return fetchApi<ShareStats>("/api/share/stats", { authToken });
}

// Referral types
export interface ReferralCodeResponse {
  code: string;
  referralUrl: string;
  stats: {
    totalVisits: number;
    conversions: number;
    returningVisitors: number;
  };
}

export async function getReferralCode(authToken: string): Promise<ReferralCodeResponse> {
  return fetchApi<ReferralCodeResponse>("/api/referral/code", { authToken });
}

export interface ReferralStats {
  hasReferralCode: boolean;
  code: string | null;
  totalVisits: number;
  conversions: number;
  returningVisitors: number;
  tierProgress: {
    bronze: { required: number; current: number; unlocked: boolean };
    silver: { required: number; current: number; unlocked: boolean };
    gold: { required: number; current: number; unlocked: boolean };
    platinum: { required: number; current: number; unlocked: boolean };
  };
}

export async function getReferralStats(authToken: string): Promise<ReferralStats> {
  return fetchApi<ReferralStats>("/api/referral/stats", { authToken });
}

export async function trackReferralVisit(
  referralCode: string,
  visitorId: string
): Promise<{ tracked: boolean; returning: boolean }> {
  return fetchApi<{ tracked: boolean; returning: boolean }>("/api/referral/track", {
    method: "POST",
    body: JSON.stringify({ referralCode, visitorId }),
  });
}

export async function convertReferral(
  visitorId: string,
  referralCode: string,
  authToken: string
): Promise<{ converted: boolean; message: string }> {
  return fetchApi<{ converted: boolean; message: string }>("/api/referral/convert", {
    method: "POST",
    body: JSON.stringify({ visitorId, referralCode }),
    authToken,
  });
}

export interface PriorityStatus {
  isPrioritySharer: boolean;
  verifiedShareCount: number;
  priorityGrantedAt: string | null;
}

export async function getPriorityStatus(authToken: string): Promise<PriorityStatus> {
  return fetchApi<PriorityStatus>("/api/priority-status", { authToken });
}

// ==================== ADMIN API ====================

export interface AdminStatus {
  isAdmin: boolean;
  email: string | null;
}

export async function getAdminStatus(authToken?: string): Promise<AdminStatus> {
  return fetchApi<AdminStatus>("/api/admin/status", { authToken });
}

export type AnalysisSource = 'coingecko' | 'dexscreener';

export interface AdminAnalyzeRequest {
  tokenId?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenImage?: string;
  chain: string;
  contractAddress: string;
  source: AnalysisSource;
}

export interface AdminAnalyzeResponse {
  message: string;
  analysisId: number;
  runId: string;
  status: string;
  source?: AnalysisSource;
}

// ==================== DEXSCREENER API ====================

export interface DexscreenerTokenInfo {
  contractAddress: string;
  chain: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  websiteUrl: string | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;
  priceUsd: string | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;
  dexUrl: string | null;
  pairAddress: string | null;
}

export interface DexscreenerLookupResponse {
  found: boolean;
  token?: DexscreenerTokenInfo;
  message?: string;
}

export interface DexscreenerChain {
  id: string;
  name: string;
}

// Lookup token on Dexscreener by contract address
export async function getDexscreenerToken(
  contractAddress: string,
  chain: string
): Promise<DexscreenerLookupResponse> {
  return fetchApi<DexscreenerLookupResponse>(
    `/api/dexscreener/token?address=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent(chain)}`
  );
}

export async function adminStartAnalysis(
  data: AdminAnalyzeRequest,
  authToken: string
): Promise<AdminAnalyzeResponse> {
  return fetchApi<AdminAnalyzeResponse>("/api/admin/analyze", {
    method: "POST",
    body: JSON.stringify(data),
    authToken,
  });
}

export interface AdminLeaderboardResponse {
  items: AggregatedLeaderboardItem[];
  total: number;
  isAdmin: boolean;
  accessLimit: null;
}

export async function getAdminLeaderboard(
  options: LeaderboardOptions,
  authToken: string
): Promise<AdminLeaderboardResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  if (options.sortBy) params.set("sortBy", options.sortBy);
  if (options.order) params.set("order", options.order);

  // Add filters
  if (options.filters) {
    if (options.filters.tier) params.set("tier", options.filters.tier);
    if (options.filters.narrative) params.set("narrative", options.filters.narrative);
    if (options.filters.chain) params.set("chain", options.filters.chain);
    if (options.filters.search) params.set("search", options.filters.search);
    if (options.filters.tokenType) params.set("tokenType", options.filters.tokenType);
    if (options.filters.marketCapTier) params.set("marketCapTier", options.filters.marketCapTier);
    if (options.filters.upsideTier) params.set("upsideTier", options.filters.upsideTier);
  }

  const queryString = params.toString();
  const url = queryString ? `/api/admin/leaderboard?${queryString}` : "/api/admin/leaderboard";
  return fetchApi<AdminLeaderboardResponse>(url, { authToken });
}

export interface AdminAnalysesResponse {
  items: TokenAnalysis[];
  total: number;
}

export async function getAdminAnalyses(
  options: { limit?: number; offset?: number; status?: string; symbol?: string },
  authToken: string
): Promise<AdminAnalysesResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  if (options.status) params.set("status", options.status);
  if (options.symbol) params.set("symbol", options.symbol);

  const queryString = params.toString();
  const url = queryString ? `/api/admin/analyses?${queryString}` : "/api/admin/analyses";
  return fetchApi<AdminAnalysesResponse>(url, { authToken });
}

export async function adminSyncGumloop(authToken: string): Promise<{
  message: string;
  checked: number;
  synced: number;
}> {
  return fetchApi<{ message: string; checked: number; synced: number }>(
    "/api/admin/sync-gumloop",
    {
      method: "POST",
      authToken,
    }
  );
}

export async function adminCollectPerformance(authToken: string): Promise<{
  message: string;
}> {
  return fetchApi<{ message: string }>(
    "/api/admin/performance/collect",
    {
      method: "POST",
      authToken,
    }
  );
}

export async function adminReprocessAnalysis(
  analysisId: number,
  authToken: string
): Promise<{ message: string; updates: string[] }> {
  return fetchApi<{ message: string; updates: string[] }>(
    `/api/admin/analyze/${analysisId}/reprocess`,
    {
      method: "POST",
      authToken,
    }
  );
}

export async function adminRecoverAnalysis(
  analysisId: number,
  authToken: string
): Promise<{ message: string; gumloopState: string; status: string }> {
  return fetchApi<{ message: string; gumloopState: string; status: string }>(
    `/api/admin/analyze/${analysisId}/recover`,
    {
      method: "POST",
      authToken,
    }
  );
}

export async function adminRecoverAnalysisWithRun(
  analysisId: number,
  runId: string,
  authToken: string
): Promise<{ message: string; gumloopState: string; status: string }> {
  return fetchApi<{ message: string; gumloopState: string; status: string }>(
    `/api/admin/analyze/${analysisId}/recover-with-run`,
    {
      method: "POST",
      authToken,
      body: JSON.stringify({ runId }),
    }
  );
}

// ==================== REANALYSIS QUEUE API ====================

export interface ReanalysisQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface ReanalysisQueueItem {
  id: number;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  priority: number;
  status: "pending" | "processing" | "completed" | "failed";
  scheduledAt: string;
  batchId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  gumloopRunId: string | null;
  analysisId: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function getReanalysisQueueStats(
  authToken: string
): Promise<ReanalysisQueueStats> {
  return fetchApi<ReanalysisQueueStats>("/api/admin/reanalysis-queue/stats", {
    authToken,
  });
}

export async function getReanalysisQueueItems(
  authToken: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<{ items: ReanalysisQueueItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const path = `/api/admin/reanalysis-queue${queryString ? `?${queryString}` : ""}`;

  return fetchApi<{ items: ReanalysisQueueItem[]; total: number }>(path, {
    authToken,
  });
}

export async function triggerReanalysisSchedule(
  authToken: string
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/api/admin/reanalysis-queue/schedule", {
    method: "POST",
    authToken,
  });
}

export async function triggerReanalysisProcess(
  authToken: string
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/api/admin/reanalysis-queue/process", {
    method: "POST",
    authToken,
  });
}

export async function retryReanalysisItem(
  id: number,
  authToken: string
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/admin/reanalysis-queue/${id}/retry`, {
    method: "POST",
    authToken,
  });
}

export async function deleteReanalysisItem(
  id: number,
  authToken: string
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/admin/reanalysis-queue/${id}`, {
    method: "DELETE",
    authToken,
  });
}

export async function cleanupReanalysisQueue(
  authToken: string
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/api/admin/reanalysis-queue/cleanup", {
    method: "POST",
    authToken,
  });
}
