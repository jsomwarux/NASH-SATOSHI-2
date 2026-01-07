import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { requireAuth, optionalAuth } from "./auth";
import {
  isStripeConfigured,
  getSubscriptionTiers,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
  verifyAndSyncCheckoutSession,
  syncSubscriptionFromStripe,
} from "./stripe";
import { SUBSCRIPTION_TIERS, type SubscriptionTierId } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== HEALTH CHECK ====================
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ==================== TOKEN SEARCH (CoinGecko Proxy) ====================
  app.get("/api/token/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 1) {
        res.status(400).json({ message: "Query parameter 'q' is required" });
        return;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        res.status(response.status).json({
          message: `CoinGecko API error: ${response.statusText}`,
          coins: []
        });
        return;
      }

      const data = await response.json();
      res.json({ coins: data.coins || [] });
    } catch (error) {
      console.error("Error searching tokens:", error);
      res.status(500).json({ message: "Failed to search tokens", coins: [] });
    }
  });

  // ==================== TOKEN DETAILS (CoinGecko Proxy) ====================
  app.get("/api/token/:id", async (req: Request, res: Response) => {
    try {
      const tokenId = req.params.id;

      if (!tokenId) {
        res.status(400).json({ message: "Token ID is required" });
        return;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(tokenId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          res.status(404).json({ message: "Token not found" });
          return;
        }
        console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        res.status(response.status).json({ message: `CoinGecko API error: ${response.statusText}` });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error getting token details:", error);
      res.status(500).json({ message: "Failed to get token details" });
    }
  });

  // ==================== SUBSCRIPTION TIERS (Public) ====================
  app.get("/api/subscription/tiers", (_req, res) => {
    const tiers = getSubscriptionTiers();
    res.json({
      tiers,
      stripeConfigured: isStripeConfigured(),
    });
  });

  // ==================== SUBSCRIPTION STATUS (Auth Required) ====================
  app.get("/api/subscription/status", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;

      // Default status for unauthenticated users
      if (!userId) {
        const freeTier = SUBSCRIPTION_TIERS.free;
        res.json({
          tier: "free",
          tierName: freeTier.name,
          isSubscribed: false,
          isInTrial: false,
          trialDaysRemaining: null,
          dailyLimit: freeTier.trialAnalysesPerDay,
          dailyUsed: 0,
          dailyRemaining: freeTier.trialAnalysesPerDay,
          weeklyLimit: freeTier.postTrialAnalysesPerWeek,
          weeklyUsed: 0,
          weeklyRemaining: freeTier.postTrialAnalysesPerWeek,
          monthlyLimit: null,
          monthlyUsed: 0,
          monthlyRemaining: null,
          creditBalance: 0,
          canAnalyze: true,
          leaderboardLimit: null,
          subscription: null,
        });
        return;
      }

      // Get or create subscription for authenticated user
      let subscription = await storage.getUserSubscription(userId);

      if (!subscription) {
        // Create default free subscription
        subscription = await storage.createOrUpdateSubscription({
          userId,
          tier: "free",
          status: "active",
        });
      }

      const tier = subscription.tier as SubscriptionTierId;
      const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
      const isSubscribed = tier !== "free";
      const today = new Date().toISOString().split("T")[0];

      // Calculate trial status for free tier
      let isInTrial = false;
      let trialDaysRemaining: number | null = null;

      if (tier === "free" && subscription.trialStartDate) {
        const trialStart = new Date(subscription.trialStartDate);
        const now = new Date();
        const daysSinceTrialStart = Math.floor(
          (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const freeTierConfig = SUBSCRIPTION_TIERS.free;

        if (daysSinceTrialStart < freeTierConfig.trialDays) {
          isInTrial = true;
          trialDaysRemaining = freeTierConfig.trialDays - daysSinceTrialStart;
        }
      }

      // Get daily usage for free tier trial
      const dailyUsed = tier === "free" ? await storage.getDailyUsage(userId, today) : 0;

      // Calculate limits based on tier
      let dailyLimit: number | null = null;
      let dailyRemaining: number | null = null;
      let weeklyLimit: number | null = null;
      let weeklyUsed = 0;
      let weeklyRemaining: number | null = null;
      let monthlyLimit: number | null = null;
      let monthlyUsed = subscription.monthlyAnalysesUsed || 0;
      let monthlyRemaining: number | null = null;

      if (tier === "free") {
        const freeTierConfig = SUBSCRIPTION_TIERS.free;
        if (isInTrial) {
          dailyLimit = freeTierConfig.trialAnalysesPerDay;
          dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
        } else {
          weeklyLimit = freeTierConfig.postTrialAnalysesPerWeek;
          weeklyUsed = subscription.weeklyAnalysesUsed || 0;
          weeklyRemaining = Math.max(0, weeklyLimit - weeklyUsed);
        }
      } else {
        monthlyLimit = tierConfig.analysesPerMonth || null;
        if (monthlyLimit !== null) {
          monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
        }
      }

      // Determine if user can analyze
      const creditBalance = subscription.creditBalance || 0;
      let canAnalyze = creditBalance > 0; // Can always use credits

      if (!canAnalyze) {
        if (tier === "free") {
          if (isInTrial) {
            canAnalyze = (dailyRemaining || 0) > 0;
          } else {
            canAnalyze = (weeklyRemaining || 0) > 0;
          }
        } else {
          canAnalyze = (monthlyRemaining || 0) > 0;
        }
      }

      res.json({
        tier,
        tierName: tierConfig.name,
        isSubscribed,
        isInTrial,
        trialDaysRemaining,
        dailyLimit,
        dailyUsed,
        dailyRemaining,
        weeklyLimit,
        weeklyUsed,
        weeklyRemaining,
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining,
        creditBalance,
        canAnalyze,
        leaderboardLimit: tierConfig.leaderboardLimit,
        subscription: isSubscribed
          ? {
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
            }
          : null,
      });
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  // ==================== CREATE CHECKOUT SESSION (Auth Required) ====================
  app.post("/api/subscription/checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const userEmail = req.userEmail!;
      const { tier } = req.body;

      if (!tier || !["starter", "trader", "pro", "desk"].includes(tier)) {
        res.status(400).json({ message: "Invalid tier" });
        return;
      }

      if (!isStripeConfigured()) {
        res.status(503).json({ message: "Payment processing not configured" });
        return;
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/pricing?subscription=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/pricing?subscription=canceled`;

      const checkoutUrl = await createCheckoutSession(
        userId,
        userEmail,
        tier as SubscriptionTierId,
        successUrl,
        cancelUrl
      );

      res.json({ url: checkoutUrl });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // ==================== CREATE BILLING PORTAL SESSION (Auth Required) ====================
  app.post("/api/subscription/portal", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

      if (!isStripeConfigured()) {
        res.status(503).json({ message: "Payment processing not configured" });
        return;
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      // Add sync parameter to trigger subscription sync on return
      const returnUrl = `${baseUrl}/account?sync=true`;

      const portalUrl = await createBillingPortalSession(userId, returnUrl);

      res.json({ url: portalUrl });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  // ==================== SYNC SUBSCRIPTION FROM STRIPE (Auth Required) ====================
  // Fetches current subscription status directly from Stripe and updates database
  app.post("/api/subscription/sync", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

      if (!isStripeConfigured()) {
        res.status(503).json({ message: "Payment processing not configured" });
        return;
      }

      const result = await syncSubscriptionFromStripe(userId);

      if (result.success) {
        res.json({ success: true, tier: result.tier, status: result.status });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error syncing subscription:", error);
      res.status(500).json({ message: "Failed to sync subscription" });
    }
  });

  // ==================== VERIFY CHECKOUT SESSION (Auth Required) ====================
  // Called after user returns from Stripe checkout to sync subscription status
  app.post("/api/subscription/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ message: "Session ID required" });
        return;
      }

      if (!isStripeConfigured()) {
        res.status(503).json({ message: "Payment processing not configured" });
        return;
      }

      const result = await verifyAndSyncCheckoutSession(sessionId, userId);

      if (result.success) {
        res.json({ success: true, tier: result.tier });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error verifying checkout session:", error);
      res.status(500).json({ message: "Failed to verify checkout session" });
    }
  });

  // ==================== STRIPE WEBHOOK ====================
  app.post("/api/webhook/stripe", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["stripe-signature"] as string;

      if (!signature) {
        res.status(400).json({ message: "Missing stripe-signature header" });
        return;
      }

      // Use rawBody from express.json verify option
      const rawBody = (req as any).rawBody;

      if (!rawBody) {
        res.status(400).json({ message: "Missing raw body" });
        return;
      }

      const result = await handleWebhookEvent(rawBody, signature);

      if (result.received) {
        res.json({ received: true, type: result.type });
      } else {
        res.status(400).json({ message: "Webhook processing failed" });
      }
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Webhook error" });
    }
  });

  // ==================== USER ANALYSES (Auth Required) ====================
  app.get("/api/user/analyses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await storage.getUserAnalyses(userId, limit, offset);

      res.json(result);
    } catch (error) {
      console.error("Error getting user analyses:", error);
      res.status(500).json({ message: "Failed to get analyses" });
    }
  });

  // ==================== LEADERBOARD (Public) ====================
  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || "score7d";
      const order = (req.query.order as "asc" | "desc") || "desc";

      const filters: any = {};
      if (req.query.tier) filters.tier = req.query.tier;
      if (req.query.narrative) filters.narrative = req.query.narrative;
      if (req.query.chain) filters.chain = req.query.chain;
      if (req.query.search) filters.search = req.query.search;

      const result = await storage.getLeaderboard({
        limit,
        offset,
        sortBy,
        order,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  // ==================== FILTER OPTIONS (Public) ====================
  app.get("/api/filters", async (_req: Request, res: Response) => {
    try {
      const options = await storage.getFilterOptions();
      res.json(options);
    } catch (error) {
      console.error("Error getting filter options:", error);
      res.status(500).json({ message: "Failed to get filter options" });
    }
  });

  // ==================== TOKEN ANALYSIS ====================

  // Start a new analysis (Auth Required)
  app.post("/api/analyze", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;

      // Require authentication to analyze tokens
      if (!userId) {
        res.status(401).json({ message: "Authentication required to analyze tokens" });
        return;
      }

      const { tokenId, tokenSymbol, tokenName, tokenImage, chain, contractAddress } = req.body;

      if (!tokenId || !tokenSymbol || !tokenName) {
        res.status(400).json({ message: "Token ID, symbol, and name are required" });
        return;
      }

      // Check if user can analyze (subscription limits)
      const subscription = await storage.getUserSubscription(userId);
      const tier = (subscription?.tier || "free") as SubscriptionTierId;
      const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;

      // Check usage limits
      let canAnalyze = false;
      const today = new Date().toISOString().split("T")[0];

      if (tier === "free") {
        // Check if in trial
        let isInTrial = false;
        if (subscription?.trialStartDate) {
          const trialStart = new Date(subscription.trialStartDate);
          const now = new Date();
          const daysSinceTrialStart = Math.floor(
            (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
          );
          isInTrial = daysSinceTrialStart < SUBSCRIPTION_TIERS.free.trialDays;
        } else {
          // First analysis starts trial
          isInTrial = true;
          await storage.createOrUpdateSubscription({
            userId,
            tier: "free",
            status: "active",
            trialStartDate: today,
          });
        }

        if (isInTrial) {
          const dailyUsed = await storage.getDailyUsage(userId, today);
          canAnalyze = dailyUsed < SUBSCRIPTION_TIERS.free.trialAnalysesPerDay;
        } else {
          // Post-trial: weekly limit
          const weeklyUsed = await storage.getWeeklyUsage(userId);
          canAnalyze = weeklyUsed < SUBSCRIPTION_TIERS.free.postTrialAnalysesPerWeek;
        }
      } else {
        // Paid tier: monthly limit
        const monthlyUsed = subscription?.monthlyAnalysesUsed || 0;
        const monthlyLimit = tierConfig.analysesPerMonth || 0;
        canAnalyze = monthlyUsed < monthlyLimit;
      }

      // Check credit balance as fallback
      const creditBalance = subscription?.creditBalance || 0;
      if (!canAnalyze && creditBalance > 0) {
        canAnalyze = true;
      }

      if (!canAnalyze) {
        res.status(403).json({
          message: "Analysis limit reached. Please upgrade your plan or purchase credits.",
          code: "LIMIT_REACHED",
        });
        return;
      }

      // Create the analysis record with pending status
      const analysis = await storage.createAnalysis({
        tokenId,
        tokenSymbol,
        tokenName,
        tokenImage,
        chain,
        contractAddress,
        userId,
        status: "pending",
        finalScore: "0",
        tier: "PENDING",
      });

      // Track usage
      if (tier === "free") {
        const sub = await storage.getUserSubscription(userId);
        const trialStart = sub?.trialStartDate ? new Date(sub.trialStartDate) : null;
        const now = new Date();
        const daysSinceTrialStart = trialStart
          ? Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const isInTrial = daysSinceTrialStart < SUBSCRIPTION_TIERS.free.trialDays;

        if (isInTrial) {
          await storage.incrementDailyUsage(userId, today);
        } else {
          await storage.incrementWeeklyUsage(userId);
        }
      } else if (creditBalance > 0 && !(await canUseSubscription(subscription, tierConfig))) {
        // Use credit if subscription limit reached
        await storage.useCredit(userId);
      } else {
        await storage.incrementMonthlyUsage(userId);
      }

      // Start the Gumloop analysis asynchronously
      startGumloopAnalysis(analysis.id, tokenId, tokenSymbol, tokenName).catch((err) => {
        console.error("Error starting Gumloop analysis:", err);
      });

      res.json({
        analysisId: analysis.id,
        status: "pending",
      });
    } catch (error) {
      console.error("Error starting analysis:", error);
      res.status(500).json({ message: "Failed to start analysis" });
    }
  });

  // Get analysis status (for polling)
  app.get("/api/analyze/:id/status", async (req: Request, res: Response) => {
    try {
      const analysisId = parseInt(req.params.id, 10);

      if (isNaN(analysisId)) {
        res.status(400).json({ message: "Invalid analysis ID" });
        return;
      }

      const analysis = await storage.getAnalysis(analysisId);

      if (!analysis) {
        res.status(404).json({ message: "Analysis not found" });
        return;
      }

      // Calculate elapsed time
      const startTime = analysis.createdAt;
      const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);

      res.json({
        analysisId: analysis.id,
        status: analysis.status,
        startTime: startTime.toISOString(),
        elapsedSeconds,
        // Progress info - estimate based on typical Gumloop run times
        nodesCompleted: analysis.status === "completed" ? 4 : analysis.status === "processing" ? 2 : 0,
        currentNode: analysis.status === "processing" ? "LLM Consensus" : undefined,
      });
    } catch (error) {
      console.error("Error getting analysis status:", error);
      res.status(500).json({ message: "Failed to get analysis status" });
    }
  });

  // Get analysis by ID
  app.get("/api/analyze/:id", async (req: Request, res: Response) => {
    try {
      const analysisId = parseInt(req.params.id, 10);

      if (isNaN(analysisId)) {
        res.status(400).json({ message: "Invalid analysis ID" });
        return;
      }

      const analysis = await storage.getAnalysis(analysisId);

      if (!analysis) {
        res.status(404).json({ message: "Analysis not found" });
        return;
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error getting analysis:", error);
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  // Get analysis by token ID
  app.get("/api/analyze/token/:tokenId", async (req: Request, res: Response) => {
    try {
      const tokenId = req.params.tokenId;

      if (!tokenId) {
        res.status(400).json({ message: "Token ID is required" });
        return;
      }

      const analysis = await storage.getAnalysisByToken(tokenId);

      if (!analysis) {
        res.status(404).json({ message: "No analysis found for this token" });
        return;
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error getting analysis by token:", error);
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  return httpServer;
}

// Helper to check if user can use subscription (hasn't hit limit)
async function canUseSubscription(
  subscription: Awaited<ReturnType<typeof storage.getUserSubscription>>,
  tierConfig: typeof SUBSCRIPTION_TIERS[SubscriptionTierId]
): Promise<boolean> {
  if (!subscription) return false;
  const monthlyUsed = subscription.monthlyAnalysesUsed || 0;
  const monthlyLimit = tierConfig.analysesPerMonth || 0;
  return monthlyUsed < monthlyLimit;
}

// Start Gumloop analysis asynchronously
async function startGumloopAnalysis(
  analysisId: number,
  tokenId: string,
  tokenSymbol: string,
  tokenName: string
): Promise<void> {
  const GUMLOOP_API_KEY = process.env.GUMLOOP_API_KEY;
  const GUMLOOP_PIPELINE_ID = process.env.GUMLOOP_PIPELINE_ID;
  const GUMLOOP_USER_ID = process.env.GUMLOOP_USER_ID;

  try {
    // Update status to processing
    await storage.updateAnalysis(analysisId, { status: "processing" });

    if (!GUMLOOP_API_KEY || !GUMLOOP_PIPELINE_ID || !GUMLOOP_USER_ID) {
      // Gumloop not configured - create demo analysis for testing
      console.log("Gumloop not configured, creating demo analysis for:", tokenSymbol);
      await createDemoAnalysis(analysisId, tokenId, tokenSymbol, tokenName);
      return;
    }

    console.log(`Starting Gumloop analysis for ${tokenSymbol} (${tokenId})`);

    // Start Gumloop pipeline
    const startResponse = await fetch("https://api.gumloop.com/api/v1/start_pipeline", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GUMLOOP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: GUMLOOP_USER_ID,
        saved_item_id: GUMLOOP_PIPELINE_ID,
        pipeline_inputs: [
          { input_name: "token_id", value: tokenId },
          { input_name: "token_symbol", value: tokenSymbol },
          { input_name: "token_name", value: tokenName },
        ],
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Gumloop start error:", errorText);
      throw new Error(`Gumloop API error: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    const runId = startData.run_id;

    await storage.updateAnalysis(analysisId, { gumloopRunId: runId });

    // Poll for completion
    await pollGumloopStatus(analysisId, runId, GUMLOOP_API_KEY);
  } catch (error) {
    console.error("Gumloop analysis error:", error);
    await storage.updateAnalysis(analysisId, {
      status: "failed",
      displaySummary: error instanceof Error ? error.message : "Analysis failed",
    });
  }
}

// Poll Gumloop for run status
async function pollGumloopStatus(
  analysisId: number,
  runId: string,
  apiKey: string
): Promise<void> {
  const GUMLOOP_USER_ID = process.env.GUMLOOP_USER_ID;
  const maxAttempts = 120; // 10 minutes with 5s intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    try {
      const statusUrl = new URL("https://api.gumloop.com/api/v1/get_pl_run");
      statusUrl.searchParams.set("run_id", runId);
      if (GUMLOOP_USER_ID) {
        statusUrl.searchParams.set("user_id", GUMLOOP_USER_ID);
      }

      const statusResponse = await fetch(statusUrl.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error("Gumloop status check failed:", statusResponse.status);
        continue;
      }

      const statusData = await statusResponse.json();
      const state = statusData.state;

      if (state === "DONE") {
        // Get the output
        const output = statusData.outputs?.output || statusData.outputs?.result || "";

        // Parse the Gumloop response
        const { parseGumloopResponse } = await import("./gumloop-parser");
        const parsed = parseGumloopResponse(output);

        // Update the analysis with parsed results
        await storage.updateAnalysis(analysisId, {
          status: "completed",
          finalScore: parsed.finalScore.toString(),
          tier: parsed.tier,
          phase: parsed.phase,
          phaseName: parsed.phaseName,
          narrative: parsed.narrative,
          narrativeHeat: parsed.narrativeHeat?.toString(),
          peakProximity: parsed.peakProximity?.toString(),
          winningSide: parsed.winningSide,
          consensusLevel: parsed.consensusLevel,
          confidence: parsed.confidence,
          coordinationScore: parsed.coordinationScore?.toString(),
          schellingRankScore: parsed.schellingRankScore?.toString(),
          schellingPosition: parsed.schellingPosition,
          reflexivityScore: parsed.reflexivityScore?.toString(),
          viralityScore: parsed.viralityScore?.toString(),
          asymmetryScore: parsed.asymmetryScore?.toString(),
          gameTheoryBonus: parsed.gameTheoryBonus?.toString(),
          phaseModifier: parsed.phaseModifier?.toString(),
          narrativeModifier: parsed.narrativeModifier?.toString(),
          exitLiquidityModifier: parsed.exitLiquidityModifier?.toString(),
          peakProximityModifier: parsed.peakProximityModifier?.toString(),
          dataQualityModifier: parsed.dataQualityModifier?.toString(),
          equilibriumType: parsed.equilibriumType,
          dominantStrategies: parsed.dominantStrategies,
          coordinationRisks: parsed.coordinationRisks,
          catalysts: parsed.catalysts,
          recommendation: parsed.recommendation,
          displaySummary: parsed.displaySummary,
          verdict: parsed.verdict,
          reasoning: parsed.reasoning,
          modelScores: parsed.modelScores,
          rawGumloopResponse: output,
        });
        return;
      } else if (state === "FAILED" || state === "TERMINATED") {
        throw new Error(`Gumloop run ${state.toLowerCase()}`);
      }
      // Continue polling for RUNNING, QUEUED states
    } catch (pollError) {
      console.error("Gumloop poll error:", pollError);
    }
  }

  // Timeout
  await storage.updateAnalysis(analysisId, {
    status: "failed",
    displaySummary: "Analysis timed out",
  });
}

// Create a demo analysis when Gumloop is not configured
async function createDemoAnalysis(
  analysisId: number,
  tokenId: string,
  tokenSymbol: string,
  tokenName: string
): Promise<void> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Generate demo scores based on token name hash for consistency
  const hash = tokenName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseScore = 45 + (hash % 40); // Score between 45-85

  const tier =
    baseScore >= 85 ? "S+" :
    baseScore >= 70 ? "S" :
    baseScore >= 55 ? "A" :
    baseScore >= 40 ? "B" : "DISQUALIFIED";

  const phases = ["Stealth", "Expansion", "Mania", "Distribution", "Dead"];
  const phase = (hash % 5) + 1;

  await storage.updateAnalysis(analysisId, {
    status: "completed",
    finalScore: baseScore.toFixed(2),
    tier,
    phase,
    phaseName: phases[phase - 1],
    narrative: "DeFi Infrastructure",
    narrativeHeat: ((hash % 8) + 3).toString(),
    winningSide: baseScore >= 60 ? "USER" : "AT_RISK",
    consensusLevel: baseScore >= 70 ? "HIGH" : baseScore >= 50 ? "MIXED" : "LOW",
    confidence: baseScore >= 70 ? "H" : baseScore >= 50 ? "M" : "L",
    coordinationScore: ((baseScore * 0.2) + (hash % 3)).toFixed(2),
    schellingRankScore: ((baseScore * 0.15) + (hash % 2)).toFixed(2),
    reflexivityScore: ((baseScore * 0.15) + (hash % 3)).toFixed(2),
    viralityScore: ((baseScore * 0.15) + (hash % 2)).toFixed(2),
    asymmetryScore: ((baseScore * 0.15) + (hash % 3)).toFixed(2),
    gameTheoryBonus: ((baseScore * 0.2) + (hash % 2)).toFixed(2),
    recommendation: baseScore >= 70 ? "BUY" : baseScore >= 50 ? "HOLD" : "AVOID",
    displaySummary: `${tokenName} (${tokenSymbol}) is a ${tier}-tier token with ${baseScore >= 70 ? "strong" : baseScore >= 50 ? "moderate" : "weak"} fundamentals. ${
      baseScore >= 70
        ? "Multi-model consensus indicates favorable risk/reward."
        : baseScore >= 50
        ? "Mixed signals require careful position sizing."
        : "Elevated risk factors suggest caution."
    }`,
    modelScores: {
      gpt: baseScore + (hash % 5) - 2,
      claude: baseScore + ((hash + 1) % 5) - 2,
      gemini: baseScore + ((hash + 2) % 5) - 2,
      grok: baseScore + ((hash + 3) % 5) - 2,
    },
    coordinationRisks: [
      "Market volatility risk",
      "Regulatory uncertainty",
      "Competition from established protocols",
    ],
    catalysts: [
      "Growing ecosystem adoption",
      "Strategic partnerships",
      "Technical development progress",
    ],
  });
}
