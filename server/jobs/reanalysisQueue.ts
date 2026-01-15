/**
 * Automated Reanalysis Queue Job
 *
 * Handles scheduled reanalysis of top tokens:
 * - Top 25: Weekly (every Monday)
 * - Top 50: Bi-weekly (every 2 weeks)
 * - Top 100: Monthly (every 4 weeks)
 *
 * Respects Gumloop's 4 concurrent run limit.
 */

import { storage } from "../storage";
import {
  REANALYSIS_PRIORITIES,
  type InsertReanalysisQueue,
  type ReanalysisQueueItem,
} from "@shared/schema";

// Maximum concurrent Gumloop runs
const MAX_CONCURRENT_RUNS = 4;

// Worker interval (3 minutes)
const WORKER_INTERVAL_MS = 3 * 60 * 1000;

// Maximum retries for failed items
const MAX_RETRIES = 2;

// Timeout for stuck "processing" items (40 minutes)
const STUCK_TIMEOUT_MS = 40 * 60 * 1000;

// ==================== HELPERS ====================

// Get current date string in EST (YYYY-MM-DD)
function getESTDateString(): string {
  const now = new Date();
  // Subtract 5 hours to convert UTC to EST
  const estTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return estTime.toISOString().split("T")[0];
}

// Get next Monday at midnight EST as a Date object
function getNextMondayMidnightEST(): Date {
  const now = new Date();
  // Get EST offset time
  const estNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = estNow.getUTCDay();

  // Calculate days until next Monday
  let daysUntilMonday = (8 - dayOfWeek) % 7;
  if (daysUntilMonday === 0) {
    // If today is Monday, check if we've passed midnight
    const estHour = estNow.getUTCHours();
    if (estHour >= 0) {
      // Already past midnight Monday, schedule for next Monday
      daysUntilMonday = 7;
    }
  }

  // Create next Monday at midnight EST (05:00 UTC)
  const nextMonday = new Date(estNow);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(5, 0, 0, 0); // Midnight EST = 05:00 UTC

  // Convert back to actual UTC time
  return new Date(nextMonday.getTime() + 5 * 60 * 60 * 1000);
}

// Get the week number of the month (1-4/5)
function getWeekOfMonth(date: Date = new Date()): number {
  // Get EST time
  const estDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const dayOfMonth = estDate.getUTCDate();
  // Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4+: days 22+
  return Math.ceil(dayOfMonth / 7);
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== SCHEDULE LOGIC ====================

/**
 * Determines how many tokens to reanalyze based on the week of the month.
 *
 * Schedule:
 * - Week 1: Top 100 (monthly includes all tiers)
 * - Week 2: Top 25 (weekly tier only)
 * - Week 3: Top 50 (bi-weekly includes top 25)
 * - Week 4: Top 25 (weekly tier only)
 * - Week 5 (if exists): Top 25
 */
function getReanalysisCount(): { count: number; batchType: string } {
  const week = getWeekOfMonth();

  switch (week) {
    case 1:
      return { count: 100, batchType: "monthly" };
    case 2:
      return { count: 25, batchType: "weekly" };
    case 3:
      return { count: 50, batchType: "bi-weekly" };
    case 4:
    default:
      return { count: 25, batchType: "weekly" };
  }
}

/**
 * Assigns priority based on token rank.
 * Lower priority number = higher priority in queue.
 */
function getPriorityForRank(rank: number): number {
  if (rank <= 25) return REANALYSIS_PRIORITIES.TOP_25;
  if (rank <= 50) return REANALYSIS_PRIORITIES.TOP_50;
  return REANALYSIS_PRIORITIES.TOP_100;
}

// ==================== SCHEDULER ====================

/**
 * Weekly scheduler - runs Monday at midnight EST.
 * Adds tokens to the reanalysis queue based on the week of the month.
 */
async function scheduleWeeklyReanalysis(): Promise<void> {
  const { count, batchType } = getReanalysisCount();
  const batchId = `${getESTDateString()}-${batchType}`;

  console.log(`[ReanalysisQueue] Scheduling ${batchType} reanalysis for top ${count} tokens (batch: ${batchId})`);

  try {
    // Get top N tokens by score
    const topTokens = await storage.getTopTokensForReanalysis(count);

    if (topTokens.length === 0) {
      console.log("[ReanalysisQueue] No tokens found for reanalysis");
      return;
    }

    console.log(`[ReanalysisQueue] Found ${topTokens.length} tokens to reanalyze`);

    // Filter out tokens already in queue (pending or processing)
    const queueItems: InsertReanalysisQueue[] = [];
    let skipped = 0;

    for (let i = 0; i < topTokens.length; i++) {
      const token = topTokens[i];
      const rank = i + 1;

      // Check if already in queue
      const inQueue = await storage.isTokenInReanalysisQueue(token.tokenId);
      if (inQueue) {
        skipped++;
        continue;
      }

      queueItems.push({
        tokenId: token.tokenId,
        tokenSymbol: token.tokenSymbol,
        tokenName: token.tokenName,
        tokenImage: token.tokenImage,
        chain: token.chain,
        priority: getPriorityForRank(rank),
        status: "pending",
        scheduledAt: new Date(),
        batchId,
      });
    }

    if (queueItems.length > 0) {
      await storage.addBatchToReanalysisQueue(queueItems);
      console.log(`[ReanalysisQueue] Added ${queueItems.length} tokens to queue (skipped ${skipped} already queued)`);
    } else {
      console.log(`[ReanalysisQueue] All ${skipped} tokens already in queue, nothing to add`);
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error scheduling reanalysis:", err);
  }
}

// ==================== QUEUE WORKER ====================

/**
 * Triggers a Gumloop analysis for a queue item.
 * Returns the Gumloop run ID if successful.
 */
async function triggerGumloopAnalysis(
  item: ReanalysisQueueItem
): Promise<{ success: boolean; runId?: string; analysisId?: number; error?: string }> {
  const gumloopApiKey = process.env.GUMLOOP_API_KEY;
  const gumloopPipelineId = process.env.GUMLOOP_PIPELINE_ID;
  const gumloopUserId = process.env.GUMLOOP_USER_ID;

  if (!gumloopApiKey || !gumloopPipelineId || !gumloopUserId) {
    return { success: false, error: "Gumloop not configured" };
  }

  try {
    // Check for existing pending/processing analysis
    const existingAnalysis = await storage.getLatestAnalysisByTokenId(item.tokenId);
    if (
      existingAnalysis &&
      (existingAnalysis.status === "pending" || existingAnalysis.status === "processing")
    ) {
      console.log(`[ReanalysisQueue] Skipping ${item.tokenSymbol} - analysis already in progress`);
      return { success: false, error: "Analysis already in progress" };
    }

    // Fetch market data from CoinGecko
    let marketData: {
      currentPrice?: string;
      marketCap?: string;
      fdv?: string;
      volume24h?: string;
      priceChange24h?: string;
      priceChange7d?: string;
      categories?: string[];
    } = {};

    try {
      const cgApiKey = process.env.COINGECKO_API_KEY;
      const cgApiType = process.env.COINGECKO_API_TYPE || "demo";
      const cgBaseUrl =
        cgApiType === "pro"
          ? "https://pro-api.coingecko.com/api/v3"
          : "https://api.coingecko.com/api/v3";

      const headers: Record<string, string> = { Accept: "application/json" };
      if (cgApiKey) {
        headers[cgApiType === "pro" ? "x-cg-pro-api-key" : "x-cg-demo-api-key"] = cgApiKey;
      }

      const cgResponse = await fetch(
        `${cgBaseUrl}/coins/${item.tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { headers }
      );

      if (cgResponse.ok) {
        const data = await cgResponse.json();
        marketData = {
          currentPrice: data.market_data?.current_price?.usd?.toString(),
          marketCap: data.market_data?.market_cap?.usd?.toString(),
          fdv: data.market_data?.fully_diluted_valuation?.usd?.toString(),
          volume24h: data.market_data?.total_volume?.usd?.toString(),
          priceChange24h: data.market_data?.price_change_percentage_24h?.toString(),
          priceChange7d: data.market_data?.price_change_percentage_7d?.toString(),
          categories: data.categories || [],
        };
      }
    } catch {
      console.warn(`[ReanalysisQueue] CoinGecko fetch failed for ${item.tokenId}`);
    }

    // Create analysis record
    const analysis = await storage.createAnalysis({
      tokenId: item.tokenId,
      tokenSymbol: item.tokenSymbol,
      tokenName: item.tokenName,
      tokenImage: item.tokenImage,
      chain: item.chain,
      userId: "system-reanalysis", // System-triggered
      status: "processing",
      finalScore: "0",
      tier: "?",
      currentPrice: marketData.currentPrice,
      marketCap: marketData.marketCap,
      fdv: marketData.fdv,
      volume24h: marketData.volume24h,
      priceChange24h: marketData.priceChange24h,
      priceChange7d: marketData.priceChange7d,
      categories: marketData.categories,
    });

    // Call Gumloop API
    const gumloopUrl = new URL("https://api.gumloop.com/api/v1/start_pipeline");
    gumloopUrl.searchParams.set("user_id", gumloopUserId);
    gumloopUrl.searchParams.set("saved_item_id", gumloopPipelineId);

    const gumloopPayload = {
      pipeline_inputs: [{ input_name: "Token Input", value: item.tokenSymbol }],
    };

    const gumloopResponse = await fetch(gumloopUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gumloopApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gumloopPayload),
    });

    if (!gumloopResponse.ok) {
      const errorText = await gumloopResponse.text();
      console.error(`[ReanalysisQueue] Gumloop API error for ${item.tokenSymbol}: ${gumloopResponse.status}`);

      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "API_ERROR",
        errorMessage: `Gumloop API error: ${gumloopResponse.status}`,
      });

      return { success: false, error: `Gumloop API error: ${gumloopResponse.status} - ${errorText}` };
    }

    const gumloopData = await gumloopResponse.json();
    const runId = gumloopData.run_id;

    if (!runId) {
      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "API_ERROR",
        errorMessage: "No run_id returned from Gumloop",
      });
      return { success: false, error: "No run_id returned from Gumloop" };
    }

    // Update analysis with run ID
    await storage.updateAnalysis(analysis.id, { gumloopRunId: runId });

    console.log(`[ReanalysisQueue] Started analysis for ${item.tokenSymbol} (run: ${runId}, analysis: ${analysis.id})`);

    return { success: true, runId, analysisId: analysis.id };
  } catch (err) {
    console.error(`[ReanalysisQueue] Error triggering analysis for ${item.tokenSymbol}:`, err);
    return { success: false, error: String(err) };
  }
}

/**
 * Handles stuck "processing" items that never completed.
 * Resets them to pending for retry if under max retries.
 */
async function handleStuckItems(): Promise<void> {
  try {
    const { items } = await storage.getReanalysisQueueItems({ status: "processing" });

    for (const item of items) {
      if (!item.startedAt) continue;

      const elapsed = Date.now() - new Date(item.startedAt).getTime();
      if (elapsed > STUCK_TIMEOUT_MS) {
        const retryCount = (item.retryCount || 0) + 1;

        if (retryCount > MAX_RETRIES) {
          // Mark as permanently failed
          await storage.updateReanalysisQueueItem(item.id, {
            status: "failed",
            errorMessage: "Stuck processing - max retries exceeded",
            retryCount,
          });
          console.log(`[ReanalysisQueue] Marked stuck item ${item.tokenSymbol} as failed (max retries)`);
        } else {
          // Reset to pending for retry
          await storage.updateReanalysisQueueItem(item.id, {
            status: "pending",
            startedAt: null,
            gumloopRunId: null,
            analysisId: null,
            retryCount,
          });
          console.log(`[ReanalysisQueue] Reset stuck item ${item.tokenSymbol} for retry (attempt ${retryCount})`);
        }
      }
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error handling stuck items:", err);
  }
}

/**
 * Queue worker - runs every 3 minutes.
 * Processes pending items up to the concurrent limit.
 */
async function processQueue(): Promise<void> {
  try {
    // Handle any stuck items first
    await handleStuckItems();

    // Check how many are currently processing
    const processingCount = await storage.getProcessingReanalysisCount();

    if (processingCount >= MAX_CONCURRENT_RUNS) {
      console.log(`[ReanalysisQueue] At capacity (${processingCount}/${MAX_CONCURRENT_RUNS}), waiting...`);
      return;
    }

    const availableSlots = MAX_CONCURRENT_RUNS - processingCount;
    console.log(`[ReanalysisQueue] ${availableSlots} slots available (${processingCount} processing)`);

    // Get pending items
    const pendingItems = await storage.getPendingReanalysisItems(availableSlots);

    if (pendingItems.length === 0) {
      console.log("[ReanalysisQueue] No pending items in queue");
      return;
    }

    console.log(`[ReanalysisQueue] Processing ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      // Mark as processing
      await storage.updateReanalysisQueueItem(item.id, {
        status: "processing",
        startedAt: new Date(),
      });

      // Trigger the analysis
      const result = await triggerGumloopAnalysis(item);

      if (result.success) {
        // Update with Gumloop run ID and analysis ID
        await storage.updateReanalysisQueueItem(item.id, {
          gumloopRunId: result.runId,
          analysisId: result.analysisId,
        });
      } else {
        // Handle failure
        const retryCount = (item.retryCount || 0) + 1;

        if (retryCount > MAX_RETRIES) {
          await storage.updateReanalysisQueueItem(item.id, {
            status: "failed",
            errorMessage: result.error || "Unknown error",
            retryCount,
          });
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} failed permanently: ${result.error}`);
        } else {
          // Schedule for retry (reset to pending)
          await storage.updateReanalysisQueueItem(item.id, {
            status: "pending",
            startedAt: null,
            retryCount,
            errorMessage: result.error,
          });
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} will retry (attempt ${retryCount}): ${result.error}`);
        }
      }

      // Small delay between triggers to avoid rate limiting
      await delay(2000);
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error processing queue:", err);
  }
}

/**
 * Called when an analysis completes (from webhook or polling).
 * Marks the corresponding queue item as completed.
 */
export async function onAnalysisComplete(analysisId: number, success: boolean): Promise<void> {
  try {
    // Get the analysis to find the run ID
    const analysis = await storage.getAnalysis(analysisId);
    if (!analysis || !analysis.gumloopRunId) return;

    // Find queue item by run ID
    const queueItem = await storage.getReanalysisQueueItemByRunId(analysis.gumloopRunId);
    if (!queueItem) return; // Not from reanalysis queue

    if (success) {
      await storage.updateReanalysisQueueItem(queueItem.id, {
        status: "completed",
        completedAt: new Date(),
        analysisId,
      });
      console.log(`[ReanalysisQueue] Marked ${queueItem.tokenSymbol} as completed (analysis ${analysisId})`);
    } else {
      const retryCount = (queueItem.retryCount || 0) + 1;

      if (retryCount > MAX_RETRIES) {
        await storage.updateReanalysisQueueItem(queueItem.id, {
          status: "failed",
          errorMessage: "Analysis failed",
          retryCount,
        });
      } else {
        // Reset for retry
        await storage.updateReanalysisQueueItem(queueItem.id, {
          status: "pending",
          startedAt: null,
          gumloopRunId: null,
          analysisId: null,
          retryCount,
        });
      }
    }

    // Trigger queue worker to process next items
    setTimeout(() => processQueue(), 5000);
  } catch (err) {
    console.error("[ReanalysisQueue] Error handling analysis completion:", err);
  }
}

// ==================== JOB SCHEDULING ====================

let schedulerTimeout: NodeJS.Timeout | null = null;
let workerInterval: NodeJS.Timeout | null = null;

function scheduleNextMondayRun(): void {
  const nextMonday = getNextMondayMidnightEST();
  const msUntilMonday = nextMonday.getTime() - Date.now();

  console.log(
    `[ReanalysisQueue] Next weekly run scheduled for ${nextMonday.toISOString()} (in ${Math.round(msUntilMonday / 1000 / 60 / 60)} hours)`
  );

  schedulerTimeout = setTimeout(async () => {
    await scheduleWeeklyReanalysis();
    scheduleNextMondayRun(); // Schedule next week
  }, msUntilMonday);
}

export function startReanalysisQueueJob(): void {
  console.log("[ReanalysisQueue] Starting reanalysis queue job...");

  // Start the queue worker (every 3 minutes)
  workerInterval = setInterval(async () => {
    await processQueue();
  }, WORKER_INTERVAL_MS);

  // Run worker immediately on startup
  setTimeout(async () => {
    console.log("[ReanalysisQueue] Running initial queue check...");
    await processQueue();
  }, 15000); // 15 second delay

  // Schedule weekly runs at Monday midnight EST
  scheduleNextMondayRun();

  console.log("[ReanalysisQueue] Queue job started successfully");
}

export function stopReanalysisQueueJob(): void {
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
  }
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  console.log("[ReanalysisQueue] Job stopped");
}

// Manual trigger for testing
export async function triggerManualSchedule(): Promise<void> {
  console.log("[ReanalysisQueue] Manual schedule triggered");
  await scheduleWeeklyReanalysis();
}

// Manual queue processing for testing
export async function triggerManualProcess(): Promise<void> {
  console.log("[ReanalysisQueue] Manual process triggered");
  await processQueue();
}

// Cleanup old completed/failed items (older than 30 days)
export async function cleanupOldItems(): Promise<void> {
  const deleted = await storage.cleanupOldQueueItems(30);
  console.log(`[ReanalysisQueue] Cleaned up ${deleted} old queue items`);
}
