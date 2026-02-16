/**
 * Auto-Analyze Top Vote Job
 *
 * Runs at midnight EST each day to automatically analyze the top voted token
 * from the previous day.
 *
 * IMPORTANT: Checks Gumloop capacity before triggering to avoid conflicts with
 * reanalysis queue and admin-triggered analyses.
 */

import { storage } from "../storage";
import type { TokenVoteRequest } from "@shared/schema";
import { fetchMarketData, extractTokenIdParts } from "../market-data";

// Maximum concurrent Gumloop runs (must match reanalysisQueue.ts)
const MAX_CONCURRENT_RUNS = 4;

// ==================== HELPERS ====================

// Get current date string in EST (YYYY-MM-DD)
function getESTDateString(): string {
  const now = new Date();
  // Subtract 5 hours to convert UTC to EST
  const estTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return estTime.toISOString().split("T")[0];
}

// Get next midnight EST as a Date object
function getNextMidnightEST(): Date {
  const now = new Date();
  // Get EST offset time
  const estNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // Get tomorrow's date in EST
  const tomorrow = new Date(estNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(5, 0, 0, 0); // Midnight EST = 05:00 UTC

  // Convert back to actual UTC time
  return new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000);
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== ANALYSIS TRIGGER ====================

/**
 * Triggers a Gumloop analysis for the top voted token.
 * Returns the analysis ID if successful.
 */
async function triggerGumloopAnalysis(
  voteRequest: TokenVoteRequest
): Promise<{ success: boolean; analysisId?: number; error?: string }> {
  const gumloopApiKey = process.env.GUMLOOP_API_KEY;
  const gumloopPipelineId = process.env.GUMLOOP_PIPELINE_ID;
  const gumloopUserId = process.env.GUMLOOP_USER_ID;

  if (!gumloopApiKey || !gumloopPipelineId || !gumloopUserId) {
    return { success: false, error: "Gumloop not configured" };
  }

  // Validate we have the required data
  if (!voteRequest.contractAddress || !voteRequest.chain || !voteRequest.source) {
    console.error(`[AutoAnalyzeTopVote] Missing required data for ${voteRequest.tokenSymbol}`);
    return { success: false, error: "Missing contract address, chain, or source" };
  }

  // Track analysis ID so we can clean it up if an exception occurs after creation
  let createdAnalysisId: number | null = null;

  try {
    // Check for existing pending/processing analysis
    const existingAnalysis = await storage.getLatestAnalysisByTokenId(voteRequest.tokenId);
    if (
      existingAnalysis &&
      (existingAnalysis.status === "pending" || existingAnalysis.status === "processing")
    ) {
      console.log(`[AutoAnalyzeTopVote] Skipping ${voteRequest.tokenSymbol} - analysis already in progress`);
      return { success: false, error: "Analysis already in progress" };
    }

    // Also check by contract address (in case tokenId differs)
    if (voteRequest.contractAddress) {
      const existingByContract = await storage.getLatestAnalysisByContractAddress(voteRequest.contractAddress);
      if (
        existingByContract &&
        (existingByContract.status === "pending" || existingByContract.status === "processing")
      ) {
        console.log(`[AutoAnalyzeTopVote] Skipping ${voteRequest.tokenSymbol} - analysis already in progress (by contract)`);
        return { success: false, error: "Analysis already in progress" };
      }
    }

    // Fetch market data using shared CoinGecko-first strategy (tries CG first, falls back to DexScreener)
    let marketData: {
      currentPrice?: string;
      marketCap?: string;
      fdv?: string;
      volume24h?: string;
      priceChange24h?: string;
      priceChange7d?: string;
      categories?: string[];
    } = {};

    // Resolve contract/chain from tokenId if not on the vote request
    let resolvedContract = voteRequest.contractAddress || "";
    let resolvedChain = voteRequest.chain || "";
    const idParts = extractTokenIdParts(voteRequest.tokenId);
    if (idParts) {
      if (!resolvedContract) resolvedContract = idParts.contractAddress;
      if (!resolvedChain) resolvedChain = idParts.chain;
    }

    try {
      const { data: fetchedData } = await fetchMarketData(
        voteRequest.tokenId,
        resolvedContract || null,
        resolvedChain || null
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
        console.log(`[AutoAnalyzeTopVote] Fetched ${fetchedData.source} market data for ${voteRequest.tokenSymbol} - FDV: $${marketData.fdv}`);
      }
    } catch {
      console.warn(`[AutoAnalyzeTopVote] Market data fetch failed for ${voteRequest.tokenId}`);
    }

    // Create analysis record
    const analysis = await storage.createAnalysis({
      tokenId: voteRequest.tokenId,
      tokenSymbol: voteRequest.tokenSymbol,
      tokenName: voteRequest.tokenName,
      tokenImage: voteRequest.tokenImage,
      chain: voteRequest.chain,
      contractAddress: voteRequest.contractAddress,
      userId: "system-auto-vote", // System-triggered from vote
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

    // Build pipeline inputs
    const gumloopPayload = {
      pipeline_inputs: [
        { input_name: "Source", value: voteRequest.source },
        { input_name: "Contract Address", value: voteRequest.contractAddress },
        { input_name: "Chain", value: voteRequest.chain },
      ],
    };

    console.log(`[AutoAnalyzeTopVote] Calling Gumloop for ${voteRequest.tokenSymbol} (source=${voteRequest.source}, chain=${voteRequest.chain})`);

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
      console.error(`[AutoAnalyzeTopVote] Gumloop API error for ${voteRequest.tokenSymbol}: ${gumloopResponse.status}`);

      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.message || errorJson.error || errorJson.detail || errorText;
      } catch {
        // Keep raw text if not JSON
      }

      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "API_ERROR",
        errorMessage: `Gumloop API error: ${gumloopResponse.status} - ${errorDetail}`,
      });

      return { success: false, error: `Gumloop API error: ${gumloopResponse.status}` };
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

    // Mark the vote request as being analyzed
    await storage.updateVoteRequest(voteRequest.id, {
      status: "analyzing",
      analysisId: analysis.id,
    });

    console.log(`[AutoAnalyzeTopVote] Started analysis for ${voteRequest.tokenSymbol} (run: ${runId}, analysis: ${analysis.id})`);

    return { success: true, analysisId: analysis.id };
  } catch (err) {
    console.error(`[AutoAnalyzeTopVote] Error triggering analysis for ${voteRequest.tokenSymbol}:`, err);
    // Clean up the analysis record if one was created before the error
    if (createdAnalysisId) {
      try {
        await storage.updateAnalysis(createdAnalysisId, {
          status: "failed",
          errorCode: "EXCEPTION",
          errorMessage: `Unexpected error: ${String(err)}`,
        });
      } catch (cleanupErr) {
        console.warn(`[AutoAnalyzeTopVote] Failed to clean up analysis ${createdAnalysisId}:`, cleanupErr);
      }
    }
    return { success: false, error: String(err) };
  }
}

// ==================== DAILY JOB ====================

/**
 * Runs at midnight EST to analyze the top voted token from yesterday.
 * Checks Gumloop capacity first to avoid conflicts with reanalysis queue.
 */
async function analyzeYesterdaysTopVote(): Promise<void> {
  const dateStr = getESTDateString();
  console.log(`[AutoAnalyzeTopVote] Running daily job for ${dateStr}`);

  try {
    // Check Gumloop capacity first
    const totalRunning = await storage.getTotalRunningAnalyses();
    console.log(`[AutoAnalyzeTopVote] Current running analyses: ${totalRunning}/${MAX_CONCURRENT_RUNS}`);

    if (totalRunning >= MAX_CONCURRENT_RUNS) {
      console.log("[AutoAnalyzeTopVote] Gumloop at capacity, skipping today's auto-analyze (queue will handle remaining)");
      return;
    }

    // Get yesterday's top voted token with contract info
    const topVotedToken = await storage.getYesterdayTopVotedToken();

    if (!topVotedToken) {
      console.log("[AutoAnalyzeTopVote] No eligible token found for yesterday");
      return;
    }

    const voteScore = (topVotedToken.voteCount || 0) + ((topVotedToken.priorityVoteCount || 0) * 2);
    console.log(`[AutoAnalyzeTopVote] Top voted token: ${topVotedToken.tokenSymbol} (${topVotedToken.tokenName}) with score ${voteScore}`);

    // Trigger the analysis
    const result = await triggerGumloopAnalysis(topVotedToken);

    if (result.success) {
      console.log(`[AutoAnalyzeTopVote] Successfully triggered analysis ${result.analysisId} for ${topVotedToken.tokenSymbol}`);
    } else {
      console.log(`[AutoAnalyzeTopVote] Failed to analyze ${topVotedToken.tokenSymbol}: ${result.error}`);
    }
  } catch (err) {
    console.error("[AutoAnalyzeTopVote] Error in daily job:", err);
  }
}

// ==================== JOB SCHEDULING ====================

let schedulerTimeout: NodeJS.Timeout | null = null;

function scheduleNextMidnightRun(): void {
  const nextMidnight = getNextMidnightEST();
  const msUntilMidnight = nextMidnight.getTime() - Date.now();

  console.log(
    `[AutoAnalyzeTopVote] Next run scheduled for ${nextMidnight.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60 / 60)} hours)`
  );

  schedulerTimeout = setTimeout(async () => {
    await analyzeYesterdaysTopVote();
    scheduleNextMidnightRun(); // Schedule next day
  }, msUntilMidnight);
}

export function startAutoAnalyzeTopVoteJob(): void {
  console.log("[AutoAnalyzeTopVote] Starting auto-analyze top vote job...");

  // Schedule daily runs at midnight EST
  scheduleNextMidnightRun();

  console.log("[AutoAnalyzeTopVote] Job started successfully");
}

export function stopAutoAnalyzeTopVoteJob(): void {
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
  }
  console.log("[AutoAnalyzeTopVote] Job stopped");
}

// Manual trigger for testing
export async function triggerManualAnalyzeTopVote(): Promise<void> {
  console.log("[AutoAnalyzeTopVote] Manual trigger requested");
  await analyzeYesterdaysTopVote();
}
