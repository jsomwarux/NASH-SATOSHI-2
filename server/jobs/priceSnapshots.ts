/**
 * Daily Price Snapshot Job
 *
 * Collects price data for all leaderboard tokens daily at midnight EST
 * and calculates performance metrics.
 */

import { storage } from "../storage";
import type { InsertPriceSnapshot, InsertPerformanceMetrics, TierMetrics } from "@shared/schema";

// ==================== HELPERS ====================

// Get current date string in EST (YYYY-MM-DD)
function getESTDateString(): string {
  const now = new Date();
  // Subtract 5 hours to convert UTC to EST
  const estTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return estTime.toISOString().split('T')[0];
}

// Get next midnight EST as a Date object
function getNextMidnightEST(): Date {
  const now = new Date();
  const estDate = getESTDateString();
  // Midnight EST tomorrow = 05:00 UTC tomorrow
  const [year, month, day] = estDate.split('-').map(Number);
  const tomorrowMidnight = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));

  // If we're past midnight EST today, schedule for tomorrow
  // If we're before midnight EST, schedule for tonight
  if (tomorrowMidnight.getTime() <= now.getTime()) {
    // Add another day
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
  }

  return tomorrowMidnight;
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate return percentage
function calculateReturn(startPrice: number | null, endPrice: number | null): number | null {
  if (!startPrice || !endPrice || startPrice === 0) return null;
  return ((endPrice - startPrice) / startPrice) * 100;
}

// ==================== COINGECKO API ====================

interface CoinGeckoPrice {
  id: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number;
  total_volume: number;
}

// Batch fetch prices for multiple tokens (more efficient, avoids rate limits)
async function fetchTokenPricesBatch(tokenIds: string[]): Promise<Map<string, CoinGeckoPrice>> {
  const results = new Map<string, CoinGeckoPrice>();

  if (tokenIds.length === 0) return results;

  // CoinGecko API setup
  const cgApiKey = process.env.COINGECKO_API_KEY;
  const cgApiType = process.env.COINGECKO_API_TYPE || 'demo';
  const cgBaseUrl = cgApiType === 'pro'
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3';

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (cgApiKey) {
    headers[cgApiType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = cgApiKey;
  }

  try {
    // Batch up to 50 tokens per request (CoinGecko limit)
    const batchSize = 50;
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      const response = await fetch(
        `${cgBaseUrl}/coins/markets?vs_currency=usd&ids=${idsParam}&per_page=${batchSize}`,
        { headers }
      );

      if (!response.ok) {
        console.error(`CoinGecko API error: ${response.status}`);
        // If rate limited, wait and retry once
        if (response.status === 429) {
          console.log('[PriceSnapshots] Rate limited, waiting 60 seconds...');
          await delay(60000);
          const retryResponse = await fetch(
            `${cgBaseUrl}/coins/markets?vs_currency=usd&ids=${idsParam}&per_page=${batchSize}`,
            { headers }
          );
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            for (const coin of data) {
              results.set(coin.id, {
                id: coin.id,
                current_price: coin.current_price,
                market_cap: coin.market_cap,
                fully_diluted_valuation: coin.fully_diluted_valuation,
                total_volume: coin.total_volume,
              });
            }
          }
        }
        continue;
      }

      const data = await response.json();
      for (const coin of data) {
        results.set(coin.id, {
          id: coin.id,
          current_price: coin.current_price,
          market_cap: coin.market_cap,
          fully_diluted_valuation: coin.fully_diluted_valuation,
          total_volume: coin.total_volume,
        });
      }

      // Delay between batches if we have more
      if (i + batchSize < tokenIds.length) {
        await delay(2000); // 2 second delay between batches
      }
    }
  } catch (err) {
    console.error('[PriceSnapshots] Error fetching prices:', err);
  }

  return results;
}

// ==================== PRICE SNAPSHOT COLLECTION ====================

export async function collectDailyPriceSnapshots(): Promise<{ success: number; failed: number }> {
  console.log('[PriceSnapshots] Starting daily price snapshot collection...');
  const today = getESTDateString();

  let success = 0;
  let failed = 0;

  try {
    const tokenIds = await storage.getLeaderboardTokenIds();
    console.log(`[PriceSnapshots] Found ${tokenIds.length} tokens to snapshot`);

    // Batch fetch all prices at once (much more efficient)
    const prices = await fetchTokenPricesBatch(tokenIds);
    console.log(`[PriceSnapshots] Fetched prices for ${prices.size} tokens`);

    // Save snapshots for each token
    for (const tokenId of tokenIds) {
      try {
        const price = prices.get(tokenId);

        if (price && price.current_price > 0) {
          const snapshot: InsertPriceSnapshot = {
            tokenId,
            priceUsd: price.current_price.toString(),
            marketCap: price.market_cap?.toString() || null,
            fdv: price.fully_diluted_valuation?.toString() || null,
            volume24h: price.total_volume?.toString() || null,
            snapshotDate: today,
          };

          await storage.createPriceSnapshot(snapshot);
          success++;
          console.log(`[PriceSnapshots] Snapshot saved for ${tokenId}: $${price.current_price}`);
        } else {
          failed++;
          console.warn(`[PriceSnapshots] Skipping ${tokenId} - no price data returned (token may not exist on CoinGecko)`);
        }
      } catch (err) {
        failed++;
        console.error(`[PriceSnapshots] Error saving snapshot for ${tokenId}:`, err);
      }
    }

    console.log(`[PriceSnapshots] Collection complete: ${success} success, ${failed} failed`);
  } catch (err) {
    console.error('[PriceSnapshots] Fatal error during collection:', err);
  }

  return { success, failed };
}

// ==================== PERFORMANCE METRICS CALCULATION ====================

interface TokenReturn {
  tokenId: string;
  return7d: number | null;
  return30d: number | null;
  currentPrice: number | null;
}

async function calculateTokenReturns(tokens: { tokenId: string; score: number; firstAnalysisDate: Date }[]): Promise<TokenReturn[]> {
  const today = getESTDateString();
  const results: TokenReturn[] = [];

  for (const token of tokens) {
    // Get price history
    const history = await storage.getTokenPriceHistory(token.tokenId, 30);
    if (history.length === 0) {
      results.push({ tokenId: token.tokenId, return7d: null, return30d: null, currentPrice: null });
      continue;
    }

    // Sort by date descending (most recent first)
    const sorted = [...history].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

    const latestPrice = parseFloat(sorted[0]?.priceUsd as string) || null;

    // Find 7-day and 30-day ago prices
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const price7dAgo = sorted.find(s => s.snapshotDate <= sevenDaysAgo.toISOString().split('T')[0]);
    const price30dAgo = sorted.find(s => s.snapshotDate <= thirtyDaysAgo.toISOString().split('T')[0]);

    results.push({
      tokenId: token.tokenId,
      currentPrice: latestPrice,
      return7d: calculateReturn(parseFloat(price7dAgo?.priceUsd as string) || null, latestPrice),
      return30d: calculateReturn(parseFloat(price30dAgo?.priceUsd as string) || null, latestPrice),
    });
  }

  return results;
}

export async function calculatePerformanceMetrics(): Promise<void> {
  console.log('[PerformanceMetrics] Starting metrics calculation...');
  const today = getESTDateString();

  try {
    // Get all tokens for tier breakdown
    const tiers = ['S+', 'S', 'A', 'B', 'C'] as const;

    // Initialize tierMetrics with proper type structure
    const tierMetrics: TierMetrics = {
      'S+': { avg7d: null, avg30d: null, count: 0 },
      'S': { avg7d: null, avg30d: null, count: 0 },
      'A': { avg7d: null, avg30d: null, count: 0 },
      'B': { avg7d: null, avg30d: null, count: 0 },
      'C': { avg7d: null, avg30d: null, count: 0 },
    };

    let allTokenReturns: TokenReturn[] = [];

    // Calculate per-tier metrics
    for (const tier of tiers) {
      const tokens = await storage.getTokensByTier(tier);
      const returns = await calculateTokenReturns(tokens);

      allTokenReturns = [...allTokenReturns, ...returns];

      // Calculate tier averages
      const valid7d = returns.filter(r => r.return7d !== null);
      const valid30d = returns.filter(r => r.return30d !== null);

      const avg7d = valid7d.length > 0
        ? valid7d.reduce((sum, r) => sum + (r.return7d || 0), 0) / valid7d.length
        : null;
      const avg30d = valid30d.length > 0
        ? valid30d.reduce((sum, r) => sum + (r.return30d || 0), 0) / valid30d.length
        : null;

      tierMetrics[tier] = {
        avg7d,
        avg30d,
        count: tokens.length,
      };

      console.log(`[PerformanceMetrics] Tier ${tier}: ${tokens.length} tokens, 7d avg: ${avg7d?.toFixed(2) || 'N/A'}%`);
    }

    // Calculate top 10 metrics (highest scores)
    // For simplicity, use all S+ and S tier tokens as "top"
    const topTokens = allTokenReturns.slice(0, 10);
    const validTop7d = topTokens.filter(t => t.return7d !== null);
    const validTop30d = topTokens.filter(t => t.return30d !== null);

    const top10Avg7d = validTop7d.length > 0
      ? validTop7d.reduce((sum, r) => sum + (r.return7d || 0), 0) / validTop7d.length
      : null;
    const top10Avg30d = validTop30d.length > 0
      ? validTop30d.reduce((sum, r) => sum + (r.return30d || 0), 0) / validTop30d.length
      : null;

    // Calculate hit rate for BUY recommendations (score >= 70)
    const buyTokens = await storage.getTokensWithBuyRecommendation();
    const buyReturns = await calculateTokenReturns(buyTokens);

    const validBuy7d = buyReturns.filter(r => r.return7d !== null);
    const validBuy30d = buyReturns.filter(r => r.return30d !== null);

    const hits7d = validBuy7d.filter(r => (r.return7d || 0) > 0).length;
    const hits30d = validBuy30d.filter(r => (r.return30d || 0) > 0).length;

    const hitRate7d = validBuy7d.length > 0 ? (hits7d / validBuy7d.length) * 100 : null;
    const hitRate30d = validBuy30d.length > 0 ? (hits30d / validBuy30d.length) * 100 : null;

    // Get total token count
    const tokenIds = await storage.getLeaderboardTokenIds();

    // Save metrics
    const metricsData: InsertPerformanceMetrics = {
      metricDate: today,
      top10Avg7dReturn: top10Avg7d?.toString() || null,
      top10Avg30dReturn: top10Avg30d?.toString() || null,
      hitRate7d: hitRate7d?.toString() || null,
      hitRate30d: hitRate30d?.toString() || null,
      tierMetrics,
      totalTokens: tokenIds.length,
    };

    await storage.savePerformanceMetrics(metricsData);

    console.log('[PerformanceMetrics] Metrics saved successfully');
    console.log(`  Top 10 Avg 7D: ${top10Avg7d?.toFixed(2) || 'N/A'}%`);
    console.log(`  Top 10 Avg 30D: ${top10Avg30d?.toFixed(2) || 'N/A'}%`);
    console.log(`  Hit Rate 7D: ${hitRate7d?.toFixed(1) || 'N/A'}%`);
    console.log(`  Hit Rate 30D: ${hitRate30d?.toFixed(1) || 'N/A'}%`);
    console.log(`  Total Tokens: ${tokenIds.length}`);
  } catch (err) {
    console.error('[PerformanceMetrics] Error calculating metrics:', err);
  }
}

// ==================== JOB SCHEDULING ====================

let snapshotTimeout: NodeJS.Timeout | null = null;

async function runDailyJob(): Promise<void> {
  console.log('[PriceSnapshots] Starting daily job...');

  // Collect price snapshots
  await collectDailyPriceSnapshots();

  // Calculate performance metrics
  await calculatePerformanceMetrics();

  console.log('[PriceSnapshots] Daily job completed');
}

function scheduleNextRun(): void {
  const now = new Date();
  const nextMidnight = getNextMidnightEST();
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  console.log(`[PriceSnapshots] Next run scheduled for ${nextMidnight.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);

  snapshotTimeout = setTimeout(async () => {
    await runDailyJob();
    scheduleNextRun(); // Schedule next day
  }, msUntilMidnight);
}

export function startPriceSnapshotJob(): void {
  console.log('[PriceSnapshots] Starting price snapshot job scheduler...');

  // Run initial collection on startup (with a delay to let other things initialize)
  setTimeout(async () => {
    console.log('[PriceSnapshots] Running initial snapshot collection...');
    await runDailyJob();
  }, 10000); // 10 second delay on startup

  // Schedule daily runs at midnight EST
  scheduleNextRun();
}

export function stopPriceSnapshotJob(): void {
  if (snapshotTimeout) {
    clearTimeout(snapshotTimeout);
    snapshotTimeout = null;
    console.log('[PriceSnapshots] Job scheduler stopped');
  }
}

// Export for manual triggering (useful for admin/testing)
export { runDailyJob };
