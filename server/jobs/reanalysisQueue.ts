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
import { fetchMarketData, extractTokenIdParts, resolveContractFromPlatforms } from "../market-data";

// Maximum concurrent Gumloop runs
const MAX_CONCURRENT_RUNS = 4;

// Worker interval (3 minutes)
const WORKER_INTERVAL_MS = 3 * 60 * 1000;

// Maximum retries for failed items (increased from 2 to 5 for better resilience)
const MAX_RETRIES = 5;

// Errors that indicate Gumloop is at capacity (should wait, not retry)
const CAPACITY_ERROR_PATTERNS = [
  "concurrent",
  "rate limit",
  "too many",
  "capacity",
  "429",
  "throttl",
];

// Timeout for stuck "processing" items (40 minutes)
const STUCK_TIMEOUT_MS = 40 * 60 * 1000;

// Maximum age for analysis records to count as "running" (45 minutes)
// Anything older than this is definitely stuck and should not block slots
const MAX_ANALYSIS_AGE_MS = 45 * 60 * 1000;

// Job name for tracking in job_runs table
const JOB_NAME = "reanalysis_weekly";

// Mutex flag to prevent concurrent processQueue() calls
let isProcessingQueue = false;

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

// Get the most recent Monday's date string in EST (YYYY-MM-DD)
// If today is Monday, returns today's date
function getMostRecentMondayEST(): string {
  const now = new Date();
  // Get EST offset time
  const estNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = estNow.getUTCDay();

  // Calculate days since last Monday (0 if today is Monday)
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Go back to most recent Monday
  const monday = new Date(estNow);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);

  return monday.toISOString().split("T")[0];
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

// Check if an error indicates Gumloop is at capacity
function isCapacityError(error: string | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return CAPACITY_ERROR_PATTERNS.some(pattern => lowerError.includes(pattern));
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

      // Check if already in queue for this batch (by tokenId or symbol to catch duplicates with different IDs)
      const inQueue = await storage.isTokenInReanalysisQueue(token.tokenId, token.tokenSymbol, batchId);
      if (inQueue) {
        skipped++;
        continue;
      }

      // Derive source from tokenId prefix (dex_ = dexscreener, otherwise coingecko)
      const source = token.tokenId.startsWith("dex_") ? "dexscreener" : "coingecko";

      queueItems.push({
        tokenId: token.tokenId,
        tokenSymbol: token.tokenSymbol,
        tokenName: token.tokenName,
        tokenImage: token.tokenImage,
        chain: token.chain,
        contractAddress: token.contractAddress,
        source,
        priority: getPriorityForRank(rank),
        rank, // Preserve leaderboard order
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

    // Record successful run in job_runs table
    const mondayDate = getMostRecentMondayEST();
    await storage.upsertJobRun(JOB_NAME, {
      lastRunAt: new Date(),
      lastScheduledDate: mondayDate,
      lastRunMetadata: { batchType, tokenCount: queueItems.length, skipped },
    });
    console.log(`[ReanalysisQueue] Recorded run for ${mondayDate}`);
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

  // Track analysis ID so we can clean it up if an exception occurs after creation
  let createdAnalysisId: number | null = null;

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

    // Determine source and extract contract address/chain from tokenId
    let source = item.source || "coingecko";
    let contractAddress = item.contractAddress || "";
    let chain = item.chain || "";

    // Extract source/chain/contract from tokenId format
    const idParts = extractTokenIdParts(item.tokenId);
    if (idParts) {
      if (item.tokenId.startsWith("dex_")) source = "dexscreener";
      else if (item.tokenId.startsWith("cg_")) source = "coingecko";
      if (!contractAddress) contractAddress = idParts.contractAddress;
      if (!chain) chain = idParts.chain;
    }

    // Fetch market data using CoinGecko-first strategy (all tokens try CoinGecko first)
    let marketData: {
      currentPrice?: string;
      marketCap?: string;
      fdv?: string;
      volume24h?: string;
      priceChange24h?: string;
      priceChange7d?: string;
      categories?: string[];
    } = {};
    let cgPlatforms: Record<string, string> | null = null;

    const { data: fetchedData, cgPlatforms: platforms } = await fetchMarketData(
      item.tokenId,
      contractAddress || null,
      chain || null
    );

    if (fetchedData) {
      marketData = {
        currentPrice: fetchedData.currentPrice,
        marketCap: fetchedData.marketCap,
        fdv: fetchedData.fdv,
        volume24h: fetchedData.volume24h,
        priceChange24h: fetchedData.priceChange24h,
        priceChange7d: fetchedData.priceChange7d,
        categories: fetchedData.categories,
      };
      // If CoinGecko was the source, update source tracking
      if (fetchedData.source === "coingecko") {
        source = "coingecko";
      }
      console.log(`[ReanalysisQueue] Fetched ${fetchedData.source} market data for ${item.tokenSymbol} - FDV: $${marketData.fdv}`);
    }
    cgPlatforms = platforms;

    // Create analysis record (use resolved chain/contractAddress, not just item values)
    const analysis = await storage.createAnalysis({
      tokenId: item.tokenId,
      tokenSymbol: item.tokenSymbol,
      tokenName: item.tokenName,
      tokenImage: item.tokenImage,
      chain: chain || item.chain,
      contractAddress: contractAddress || item.contractAddress,
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
    createdAnalysisId = analysis.id;

    // Call Gumloop API
    const gumloopUrl = new URL("https://api.gumloop.com/api/v1/start_pipeline");
    gumloopUrl.searchParams.set("user_id", gumloopUserId);
    gumloopUrl.searchParams.set("saved_item_id", gumloopPipelineId);

    // Use CoinGecko platforms data if contract address still missing
    if (!contractAddress && cgPlatforms) {
      const resolved = resolveContractFromPlatforms(cgPlatforms);
      if (resolved) {
        contractAddress = resolved.contractAddress;
        chain = resolved.chain;
        source = "coingecko";
        console.log(`[ReanalysisQueue] Using CoinGecko platforms fallback for ${item.tokenSymbol}: chain=${chain}, address=${contractAddress.slice(0, 10)}...`);
      }
    }

    // Validate we have the required data
    if (!contractAddress || !chain) {
      console.error(`[ReanalysisQueue] Missing contract address or chain for ${item.tokenSymbol} (tokenId: ${item.tokenId})`);
      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "MISSING_DATA",
        errorMessage: "Missing contract address or chain - token may need manual reanalysis",
      });
      return { success: false, error: "Missing contract address or chain" };
    }

    // Build pipeline inputs with new format:
    // 1. "Source" - determines which lookup path to use ("coingecko" or "dexscreener")
    // 2. "Contract Address" - the token contract address
    // 3. "Chain" - the blockchain network
    const gumloopPayload = {
      pipeline_inputs: [
        { input_name: "Source", value: source },
        { input_name: "Contract Address", value: contractAddress },
        { input_name: "Chain", value: chain },
      ],
    };

    console.log(`[ReanalysisQueue] Calling Gumloop for ${item.tokenSymbol} with source=${source}, chain=${chain}`);

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
      console.error(`[ReanalysisQueue] Gumloop error details: ${errorText}`);
      console.error(`[ReanalysisQueue] Request params - user_id: ${gumloopUserId}, saved_item_id: ${gumloopPipelineId}`);

      // Try to parse error for more details
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.message || errorJson.error || errorJson.detail || errorText;
      } catch {
        // Keep raw text if not JSON
      }

      // Check if this is a rate limit / capacity error (429 or error message indicates capacity)
      const isRateLimit = gumloopResponse.status === 429 ||
        errorDetail.toLowerCase().includes("concurrent") ||
        errorDetail.toLowerCase().includes("rate limit") ||
        errorDetail.toLowerCase().includes("too many");

      if (isRateLimit) {
        // For capacity errors, delete the analysis record we created (it never started)
        // and return a special error so the queue doesn't count this as a failure
        console.log(`[ReanalysisQueue] Gumloop at capacity for ${item.tokenSymbol}, cleaning up and will retry`);
        await storage.deleteAnalysis(analysis.id);
        return { success: false, error: `Gumloop concurrent limit reached (429)` };
      }

      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "API_ERROR",
        errorMessage: `Gumloop API error: ${gumloopResponse.status} - ${errorDetail}`,
      });

      return { success: false, error: `Gumloop API error: ${gumloopResponse.status} - ${errorDetail}` };
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
    // Clean up the analysis record if one was created before the error.
    // Without this, a network error during the Gumloop API call would leave the
    // analysis in "processing" status and block a Gumloop slot for up to 45 minutes.
    if (createdAnalysisId) {
      try {
        await storage.updateAnalysis(createdAnalysisId, {
          status: "failed",
          errorCode: "EXCEPTION",
          errorMessage: `Unexpected error: ${String(err)}`,
        });
        console.log(`[ReanalysisQueue] Cleaned up analysis ${createdAnalysisId} after exception`);
      } catch (cleanupErr) {
        console.warn(`[ReanalysisQueue] Failed to clean up analysis ${createdAnalysisId}:`, cleanupErr);
      }
    }
    return { success: false, error: String(err) };
  }
}

/**
 * Handles stuck "processing" items that never completed.
 * Resets them to pending for retry if under max retries.
 * ALSO cleans up the corresponding analysis record to free the Gumloop slot.
 */
async function handleStuckItems(): Promise<void> {
  try {
    const { items } = await storage.getReanalysisQueueItems({ status: "processing" });

    for (const item of items) {
      if (!item.startedAt) continue;

      const elapsed = Date.now() - new Date(item.startedAt).getTime();
      if (elapsed > STUCK_TIMEOUT_MS) {
        // CRITICAL: Also clean up the corresponding analysis record.
        // Without this, the analysis stays in "processing" and permanently blocks a Gumloop slot.
        if (item.analysisId) {
          try {
            const analysis = await storage.getAnalysis(item.analysisId);
            if (analysis && (analysis.status === "completed")) {
              // Analysis actually completed but queue item wasn't updated (e.g., onAnalysisComplete failed).
              // Mark queue item as completed instead of retrying.
              await storage.updateReanalysisQueueItem(item.id, {
                status: "completed",
                completedAt: new Date(),
              });
              console.log(`[ReanalysisQueue] Queue item ${item.tokenSymbol} was stuck but analysis ${item.analysisId} already completed - marking queue item as completed`);
              continue;
            }
            if (analysis && (analysis.status === "pending" || analysis.status === "processing")) {
              await storage.updateAnalysis(item.analysisId, {
                status: "failed",
                errorCode: "TIMEOUT",
                errorMessage: "Analysis timed out - stuck in processing for too long",
              });
              console.log(`[ReanalysisQueue] Force-failed stuck analysis ${item.analysisId} for ${item.tokenSymbol}`);
            }
          } catch (err) {
            console.warn(`[ReanalysisQueue] Error cleaning up analysis ${item.analysisId}:`, err);
          }
        }

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
 * Periodic cleanup: Force-fail any analysis records that have been stuck
 * in "processing" or "pending" for more than MAX_ANALYSIS_AGE_MS.
 * This prevents permanently blocked Gumloop slots.
 * Runs inside processQueue() to ensure regular execution.
 */
async function cleanupStaleAnalysisRecords(): Promise<void> {
  try {
    const stuckAnalyses = await storage.getStuckAnalyses(Math.floor(MAX_ANALYSIS_AGE_MS / 60000));
    if (stuckAnalyses.length === 0) return;

    console.log(`[ReanalysisQueue] Found ${stuckAnalyses.length} stale analysis records to clean up`);

    for (const analysis of stuckAnalyses) {
      const ageMinutes = Math.floor((Date.now() - analysis.createdAt.getTime()) / 60000);
      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "TIMEOUT",
        errorMessage: `Analysis timed out after ${ageMinutes} minutes in processing`,
      });
      console.log(`[ReanalysisQueue] Force-failed stale analysis ${analysis.id} (${analysis.tokenSymbol}), age: ${ageMinutes}min`);

      // Also notify the queue in case this was a queued item
      try {
        await onAnalysisComplete(analysis.id, false);
      } catch {
        // Ignore - may not be a queued item
      }
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error cleaning up stale analysis records:", err);
  }
}

/**
 * Queue worker - runs every 3 minutes.
 * Processes pending items up to the concurrent limit.
 *
 * IMPORTANT: Uses getTotalRunningAnalyses() to check ALL active Gumloop runs,
 * not just queue items. This prevents failures when admin, daily vote, or other
 * sources have triggered analyses that count toward Gumloop's 4 concurrent limit.
 *
 * MUTEX: Only one processQueue() call can run at a time. Concurrent calls
 * (from timer, onAnalysisComplete, cron) are safely skipped.
 */
async function processQueue(): Promise<void> {
  // MUTEX: Prevent concurrent execution. Multiple sources can trigger processQueue():
  // - The 3-minute interval timer
  // - onAnalysisComplete() callbacks (setTimeout 5s each)
  // - The cron endpoint
  // - Startup check
  // Without this lock, concurrent calls can both see available slots and start
  // more analyses than the limit allows.
  if (isProcessingQueue) {
    console.log("[ReanalysisQueue] processQueue already running, skipping concurrent call");
    return;
  }

  isProcessingQueue = true;

  try {
    // Periodic cleanup: force-fail any analysis records stuck for too long
    // This prevents permanently blocked Gumloop slots from stale records
    await cleanupStaleAnalysisRecords();

    // Handle any stuck queue items
    await handleStuckItems();

    // Check how many analyses are ACTUALLY running (from ALL sources, not just queue)
    // This is critical: admin-triggered and daily-vote analyses also count toward Gumloop's limit
    const totalRunning = await storage.getTotalRunningAnalyses();
    const queueProcessing = await storage.getProcessingReanalysisCount();

    console.log(`[ReanalysisQueue] Total running analyses: ${totalRunning}, Queue processing: ${queueProcessing}`);

    if (totalRunning >= MAX_CONCURRENT_RUNS) {
      console.log(`[ReanalysisQueue] Gumloop at capacity (${totalRunning}/${MAX_CONCURRENT_RUNS} running), waiting...`);
      return;
    }

    const availableSlots = MAX_CONCURRENT_RUNS - totalRunning;
    console.log(`[ReanalysisQueue] ${availableSlots} Gumloop slots available`);

    // Get pending items (only as many as we have slots for)
    const pendingItems = await storage.getPendingReanalysisItems(availableSlots);

    if (pendingItems.length === 0) {
      console.log("[ReanalysisQueue] No pending items in queue");
      return;
    }

    console.log(`[ReanalysisQueue] Processing ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      // Re-check capacity before each item (another source could have started an analysis)
      const currentRunning = await storage.getTotalRunningAnalyses();
      if (currentRunning >= MAX_CONCURRENT_RUNS) {
        console.log(`[ReanalysisQueue] Gumloop reached capacity during batch, pausing...`);
        break; // Exit loop, will continue next cycle
      }

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
        // Check if this is a capacity/rate-limit error (don't count as retry)
        if (isCapacityError(result.error)) {
          // Don't increment retry count for capacity errors - just reset to pending
          await storage.updateReanalysisQueueItem(item.id, {
            status: "pending",
            startedAt: null,
            errorMessage: `Capacity limit hit, will retry: ${result.error}`,
          });
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} hit capacity limit, will retry later (not counting as failure)`);
          // Stop processing more items since Gumloop is at capacity
          break;
        }

        // Check if this is an "already in progress" error - clean up the old analysis
        if (result.error && result.error.includes("already in progress")) {
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} has a stuck old analysis, attempting cleanup...`);
          // Force-fail any stuck analyses for this token so the next retry can succeed
          await forceCleanupStuckAnalysesForToken(item.tokenId);
          // Don't count as a failure - reset to pending for immediate retry
          await storage.updateReanalysisQueueItem(item.id, {
            status: "pending",
            startedAt: null,
            errorMessage: "Cleaned up stuck old analysis, will retry",
          });
          continue;
        }

        // Handle actual failures (increment retry count)
        const retryCount = (item.retryCount || 0) + 1;

        if (retryCount > MAX_RETRIES) {
          await storage.updateReanalysisQueueItem(item.id, {
            status: "failed",
            errorMessage: result.error || "Unknown error",
            retryCount,
          });
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} failed permanently after ${retryCount} attempts: ${result.error}`);
        } else {
          // Schedule for retry (reset to pending)
          await storage.updateReanalysisQueueItem(item.id, {
            status: "pending",
            startedAt: null,
            retryCount,
            errorMessage: result.error,
          });
          console.log(`[ReanalysisQueue] ${item.tokenSymbol} will retry (attempt ${retryCount}/${MAX_RETRIES}): ${result.error}`);
        }
      }

      // Small delay between triggers to avoid rate limiting
      await delay(2000);
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error processing queue:", err);
  } finally {
    // Always release the mutex
    isProcessingQueue = false;
  }
}

/**
 * Force-cleanup any stuck "pending" or "processing" analyses for a specific token.
 * Used when "Analysis already in progress" blocks a queue retry.
 */
async function forceCleanupStuckAnalysesForToken(tokenId: string): Promise<void> {
  try {
    const existingAnalysis = await storage.getLatestAnalysisByTokenId(tokenId);
    if (existingAnalysis && (existingAnalysis.status === "pending" || existingAnalysis.status === "processing")) {
      const ageMinutes = Math.floor((Date.now() - existingAnalysis.createdAt.getTime()) / 60000);
      await storage.updateAnalysis(existingAnalysis.id, {
        status: "failed",
        errorCode: "TIMEOUT",
        errorMessage: `Force-failed stuck analysis (age: ${ageMinutes}min) to allow queue retry`,
      });
      console.log(`[ReanalysisQueue] Force-failed stuck analysis ${existingAnalysis.id} for token ${tokenId} (age: ${ageMinutes}min)`);
    }
  } catch (err) {
    console.error(`[ReanalysisQueue] Error cleaning up stuck analyses for token ${tokenId}:`, err);
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

export async function startReanalysisQueueJob(): Promise<void> {
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

  // Check if we missed a scheduled run (e.g., server was down on Monday)
  await checkForMissedRun();

  // Schedule weekly runs at Monday midnight EST
  scheduleNextMondayRun();

  console.log("[ReanalysisQueue] Queue job started successfully");
}

/**
 * Checks if we missed a scheduled run and triggers it if needed.
 * This handles cases where the server was down or restarted after the scheduled time.
 */
async function checkForMissedRun(): Promise<void> {
  try {
    const mostRecentMonday = getMostRecentMondayEST();
    const lastRun = await storage.getJobRun(JOB_NAME);

    console.log(`[ReanalysisQueue] Checking for missed runs...`);
    console.log(`[ReanalysisQueue] Most recent Monday: ${mostRecentMonday}`);
    console.log(`[ReanalysisQueue] Last scheduled date: ${lastRun?.lastScheduledDate || "never"}`);

    // If we've never run, or if the last run was before the most recent Monday
    if (!lastRun || !lastRun.lastScheduledDate || lastRun.lastScheduledDate < mostRecentMonday) {
      console.log(`[ReanalysisQueue] ⚠️ MISSED RUN DETECTED! Triggering weekly reanalysis now...`);
      await scheduleWeeklyReanalysis();
    } else {
      console.log(`[ReanalysisQueue] ✓ No missed runs - last run was for ${lastRun.lastScheduledDate}`);
    }
  } catch (err) {
    console.error("[ReanalysisQueue] Error checking for missed runs:", err);
  }
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
