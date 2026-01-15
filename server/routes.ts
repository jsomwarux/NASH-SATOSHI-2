import type { Express, Request, Response } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import { Resend } from 'resend';
import { storage } from "./storage";
import { requireAuth, optionalAuth, requireAdmin, isAdminEmail } from "./auth";
import {
  isStripeConfigured,
  getSubscriptionTiers,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
  verifyAndSyncCheckoutSession,
  syncSubscriptionFromStripe,
  createCreditCheckoutSession,
  verifyAndCompleteCreditPurchase,
} from "./stripe";
import { CREDIT_PACKS, SUBSCRIPTION_TIERS, type CreditPackId, type SubscriptionTierId } from "@shared/schema";

// ==================== BETA MODE ====================
// When true, all users get full access (beta_free tier) bypassing paywalls
// Set to false when ready to launch paid tiers
const BETA_MODE = process.env.BETA_MODE === 'true';

// ==================== SUPPORT EMAIL HELPER ====================
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'nashsatoshi@gmail.com';
// RESEND_FROM_EMAIL should match your verified domain in Resend (e.g., "support@yourdomain.com")
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendSupportEmail(
  userEmail: string,
  subject: string,
  message: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.error('Resend not configured - RESEND_API_KEY missing');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: `Nash Satoshi Support <${RESEND_FROM_EMAIL}>`,
      to: SUPPORT_EMAIL,
      replyTo: userEmail,
      subject: `[Support] ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">New Support Request</h2>
          <p><strong>From:</strong> ${userName || 'User'} &lt;${userEmail}&gt;</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
          <div style="white-space: pre-wrap;">${message}</div>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            Reply directly to this email to respond to the user.
          </p>
        </div>
      `,
    });

    console.log(`Support email sent from ${userEmail}: ${subject}`, result);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send support email:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to send email' };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== HEALTH CHECK ====================
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ==================== IMAGE PROXY (for share card generation) ====================
  // Proxies external images to bypass CORS restrictions for html-to-image capture
  app.get("/api/image-proxy", async (req: Request, res: Response) => {
    try {
      const imageUrl = req.query.url as string;

      if (!imageUrl) {
        res.status(400).json({ message: "URL parameter is required" });
        return;
      }

      // Only allow image URLs from trusted domains
      const allowedDomains = [
        'assets.coingecko.com',
        'coin-images.coingecko.com',
        'static.coingecko.com',
        'i.imgur.com',
        'raw.githubusercontent.com',
      ];

      const url = new URL(imageUrl);
      if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
        res.status(403).json({ message: "Domain not allowed" });
        return;
      }

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NashSatoshi/1.0)',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({ message: "Failed to fetch image" });
        return;
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = await response.arrayBuffer();

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).json({ message: "Failed to proxy image" });
    }
  });

  // ==================== TOKEN SEARCH (CoinGecko Proxy) ====================
  app.get("/api/token/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 1) {
        res.status(400).json({ message: "Query parameter 'q' is required" });
        return;
      }

      // Use CoinGecko API with key if available (supports both Demo and Pro)
      const cgApiKey = process.env.COINGECKO_API_KEY;
      const cgApiType = process.env.COINGECKO_API_TYPE || 'demo'; // 'demo' or 'pro'
      const cgBaseUrl = cgApiType === 'pro' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      };
      if (cgApiKey) {
        headers[cgApiType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = cgApiKey;
      }

      // Check if query looks like a contract address
      const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
      const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) && !query.startsWith('0x');

      if (isEvmAddress || isSolanaAddress) {
        // Try to find token by contract address
        const platformsToTry = isEvmAddress
          ? ['ethereum', 'base', 'arbitrum-one', 'polygon-pos', 'binance-smart-chain', 'optimistic-ethereum', 'avalanche']
          : ['solana'];

        for (const platform of platformsToTry) {
          try {
            const contractResponse = await fetch(
              `${cgBaseUrl}/coins/${platform}/contract/${query.toLowerCase()}`,
              { headers, cache: 'no-store' }
            );

            if (contractResponse.ok) {
              const tokenData = await contractResponse.json();
              const coin = {
                id: tokenData.id,
                name: tokenData.name,
                symbol: tokenData.symbol?.toUpperCase(),
                thumb: tokenData.image?.thumb,
                large: tokenData.image?.large,
                market_cap_rank: tokenData.market_cap_rank,
              };

              res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              });
              res.json({ coins: [coin], foundByContract: true, platform });
              return;
            }
          } catch {
            // Continue to next platform
          }
        }
      }

      // Regular search by name/symbol
      const cacheBuster = Date.now();
      const response = await fetch(
        `${cgBaseUrl}/search?query=${encodeURIComponent(query)}&_t=${cacheBuster}`,
        { headers, cache: 'no-store' }
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
      // Set cache-control headers to prevent browser caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
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

      // Use CoinGecko API with key if available (supports both Demo and Pro)
      const cgApiKey = process.env.COINGECKO_API_KEY;
      const cgApiType = process.env.COINGECKO_API_TYPE || 'demo'; // 'demo' or 'pro'
      const cgBaseUrl = cgApiType === 'pro' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      };
      if (cgApiKey) {
        headers[cgApiType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = cgApiKey;
      }

      // Add cache-busting timestamp
      const cacheBuster = Date.now();
      const response = await fetch(
        `${cgBaseUrl}/coins/${encodeURIComponent(tokenId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false&_t=${cacheBuster}`,
        { headers, cache: 'no-store' }
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
      // Set cache-control headers to prevent browser caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.json(data);
    } catch (error) {
      console.error("Error getting token details:", error);
      res.status(500).json({ message: "Failed to get token details" });
    }
  });

  // ==================== TOKEN STATS (Aggregate analysis data) ====================
  app.get("/api/token/:tokenId/stats", async (req: Request, res: Response) => {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        res.status(400).json({ message: "Token ID is required" });
        return;
      }

      // Get all completed analyses for this token
      const analyses = await storage.getAnalysesByTokenId(tokenId);

      if (analyses.length === 0) {
        res.status(404).json({ message: "No analyses found for this token" });
        return;
      }

      // Calculate aggregate stats
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let totalScore = 0;
      let scores7d: number[] = [];

      for (const analysis of analyses) {
        const score = parseFloat(analysis.finalScore as string);
        if (!isNaN(score)) {
          totalScore += score;

          // Check if within 7 days
          if (analysis.createdAt >= sevenDaysAgo) {
            scores7d.push(score);
          }
        }
      }

      const averageScore = analyses.length > 0 ? Math.round((totalScore / analyses.length) * 10) / 10 : 0;
      const score7d = scores7d.length > 0
        ? Math.round((scores7d.reduce((a, b) => a + b, 0) / scores7d.length) * 10) / 10
        : null;

      // Find latest analysis
      const latestAnalysis = analyses.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest
      );

      res.json({
        tokenId,
        analysisCount: analyses.length,
        averageScore,
        score7d,
        runs7d: scores7d.length,
        latestAnalysisId: latestAnalysis.id,
        latestAnalysisDate: latestAnalysis.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Error getting token stats:", error);
      res.status(500).json({ message: "Failed to get token stats" });
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
  // Returns access-based subscription info (leaderboard access, voting limits)
  app.get("/api/subscription/status", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const freeTier = SUBSCRIPTION_TIERS.free;
      const betaTier = SUBSCRIPTION_TIERS.beta_free;

      // Default status for unauthenticated users
      if (!userId) {
        // During beta, unauthenticated users see beta tier info (but can't vote without account)
        const effectiveTier = BETA_MODE ? betaTier : freeTier;
        res.json({
          tier: BETA_MODE ? "beta_free" : "free",
          tierName: effectiveTier.name,
          isSubscribed: false,
          isPremium: BETA_MODE, // Beta users get premium features
          isBeta: BETA_MODE, // Flag for frontend to show beta UI
          leaderboardAccess: effectiveTier.leaderboardAccess,
          votesPerDay: effectiveTier.votesPerDay,
          votesUsedToday: 0,
          votesRemaining: effectiveTier.votesPerDay,
          priorityVotes: effectiveTier.priorityVotes,
          // Legacy fields for backward compatibility
          isInTrial: false,
          trialDaysRemaining: null,
          dailyLimit: null,
          dailyUsed: 0,
          dailyRemaining: null,
          weeklyLimit: null,
          weeklyUsed: 0,
          weeklyRemaining: null,
          monthlyLimit: null,
          monthlyUsed: 0,
          monthlyRemaining: null,
          creditBalance: 0,
          canAnalyze: false,
          leaderboardLimit: effectiveTier.leaderboardAccess,
          subscription: null,
        });
        return;
      }

      // Get or create subscription for authenticated user
      let subscription = await storage.getUserSubscription(userId);

      if (!subscription) {
        // Create default subscription (beta_free during beta, free otherwise)
        subscription = await storage.createOrUpdateSubscription({
          userId,
          tier: BETA_MODE ? "beta_free" : "free",
          status: "active",
        });
      }

      // During beta, override all users to beta_free tier for access checks
      // but preserve their actual tier in database for future migration
      const actualTier = subscription.tier as SubscriptionTierId;
      const effectiveTier = BETA_MODE ? "beta_free" : actualTier;
      const tierConfig = SUBSCRIPTION_TIERS[effectiveTier] || SUBSCRIPTION_TIERS.free;
      const isSubscribed = !BETA_MODE && actualTier !== "free" && actualTier !== "beta_free";
      const isPremium = BETA_MODE || actualTier === "pro" || actualTier === "premium";

      // Get user's vote usage for today (EST timezone)
      const today = getESTDateString();
      const votesUsedToday = await storage.getUserDailyVoteCount(userId, today);
      const votesPerDay = tierConfig.votesPerDay;
      const votesRemaining = Math.max(0, votesPerDay - votesUsedToday);

      res.json({
        tier: effectiveTier,
        tierName: tierConfig.name,
        isSubscribed,
        isPremium,
        isBeta: BETA_MODE, // Flag for frontend to show beta UI
        leaderboardAccess: tierConfig.leaderboardAccess,
        votesPerDay,
        votesUsedToday,
        votesRemaining,
        priorityVotes: tierConfig.priorityVotes,
        // Legacy fields for backward compatibility
        isInTrial: false,
        trialDaysRemaining: null,
        dailyLimit: null,
        dailyUsed: 0,
        dailyRemaining: null,
        weeklyLimit: null,
        weeklyUsed: 0,
        weeklyRemaining: null,
        monthlyLimit: null,
        monthlyUsed: 0,
        monthlyRemaining: null,
        creditBalance: 0, // Credits are deprecated
        canAnalyze: false, // User analysis is disabled
        leaderboardLimit: tierConfig.leaderboardAccess,
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

  // ==================== SET REFERRAL CODE (Auth Required) ====================
  app.post("/api/user/referral", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { referralCode } = req.body;

      if (!referralCode || typeof referralCode !== "string") {
        res.status(400).json({ message: "Referral code required" });
        return;
      }

      // Sanitize and validate referral code (alphanumeric, max 20 chars)
      const sanitizedCode = referralCode.trim().toUpperCase().slice(0, 20);
      if (!/^[A-Z0-9_-]+$/.test(sanitizedCode)) {
        res.status(400).json({ message: "Invalid referral code format" });
        return;
      }

      await storage.setReferralCode(userId, sanitizedCode);

      res.json({ success: true, message: "Referral code attached" });
    } catch (error) {
      console.error("Error setting referral code:", error);
      res.status(500).json({ message: "Failed to set referral code" });
    }
  });

  // ==================== CREATE CHECKOUT SESSION (Auth Required) ====================
  app.post("/api/subscription/checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const userEmail = req.userEmail!;
      const { tier, referralCode } = req.body;

      if (!tier || !["pro", "premium"].includes(tier)) {
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

      const result = await createCheckoutSession(
        userId,
        userEmail,
        tier as SubscriptionTierId,
        successUrl,
        cancelUrl,
        referralCode || undefined
      );

      if (result.type === 'upgraded') {
        // Subscription was upgraded/downgraded directly - no checkout needed
        const upgradedUrl = `${baseUrl}/pricing?subscription=upgraded&tier=${result.tier}`;
        res.json({ url: upgradedUrl, upgraded: true, tier: result.tier });
      } else {
        // New subscription - redirect to Stripe checkout
        res.json({ url: result.url });
      }
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

  // ==================== CREDIT PACK CHECKOUT (Auth Required) ====================
  app.post("/api/credits/checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const userEmail = req.userEmail!;
      const { packId, referralCode } = req.body;

      if (!packId || !CREDIT_PACKS[packId as CreditPackId]) {
        res.status(400).json({ message: "Invalid credit pack" });
        return;
      }

      if (!isStripeConfigured()) {
        res.status(503).json({ message: "Payment processing not configured" });
        return;
      }

      const pack = CREDIT_PACKS[packId as CreditPackId];
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const successUrl = `${baseUrl}/pricing?credits=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/pricing?credits=canceled`;

      const checkoutUrl = await createCreditCheckoutSession(
        userId,
        userEmail,
        packId,
        pack.credits,
        pack.price,
        successUrl,
        cancelUrl,
        referralCode || undefined
      );

      res.json({ url: checkoutUrl });
    } catch (error) {
      console.error("Error creating credit checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // ==================== VERIFY CREDIT PURCHASE (Auth Required) ====================
  app.post("/api/credits/verify", requireAuth, async (req: Request, res: Response) => {
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

      const result = await verifyAndCompleteCreditPurchase(sessionId, userId);

      if (result.success) {
        res.json({ success: true, credits: result.credits });
      } else {
        res.status(400).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error verifying credit purchase:", error);
      res.status(500).json({ message: "Failed to verify credit purchase" });
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

  // ==================== GUMLOOP WEBHOOK ====================
  // Gumloop calls this endpoint when an analysis run completes
  // This eliminates the need for polling and enables better scaling
  // SECURITY NOTE: Webhook is validated by verifying run_id exists in our database.
  // This prevents unauthorized parties from injecting fake analysis results.
  // If Gumloop adds HMAC signature support, implement verification here.
  app.post("/api/webhook/gumloop", async (req: Request, res: Response) => {
    try {
      const { run_id, state, outputs } = req.body;

      // Validate run_id format (alphanumeric with hyphens/underscores)
      if (run_id && typeof run_id === 'string' && !/^[\w-]+$/.test(run_id)) {
        console.error("Gumloop webhook: Invalid run_id format");
        res.status(400).json({ message: "Invalid run_id format" });
        return;
      }

      if (!run_id) {
        console.error("Gumloop webhook: Missing run_id");
        res.status(400).json({ message: "Missing run_id" });
        return;
      }

      console.log(`Gumloop webhook received: run_id=${run_id}, state=${state}`);

      // Find the analysis by run_id
      const analysis = await storage.getAnalysisByRunId(run_id);

      if (!analysis) {
        console.error(`Gumloop webhook: No analysis found for run_id ${run_id}`);
        res.status(404).json({ message: "Analysis not found for this run_id" });
        return;
      }

      const analysisId = analysis.id;

      // Process based on state
      if (state === "DONE") {
        console.log(`Gumloop webhook: Processing completion for analysis ${analysisId}`);
        await processGumloopCompletion(analysisId, outputs);
      } else if (state === "FAILED" || state === "TERMINATED") {
        console.log(`Gumloop webhook: Analysis ${analysisId} ${state}`);
        await storage.updateAnalysis(analysisId, {
          status: "failed",
          errorCode: state === "FAILED" ? "PIPELINE_ERROR" : "TERMINATED",
          errorMessage: `Analysis pipeline ${state.toLowerCase()}. The token input may be invalid or the service encountered an error.`,
          displaySummary: `Analysis ${state.toLowerCase()}. Please try again.`,
        });

        // Publish completion event to Redis for real-time updates
        const { publishAnalysisComplete, invalidateCache, CACHE_KEYS } = await import("./redis");
        await publishAnalysisComplete(analysisId);
        await invalidateCache(CACHE_KEYS.ANALYSIS(analysisId));
      }
      // Ignore other states (RUNNING, QUEUED) - they're progress updates

      res.json({ received: true, run_id, state });
    } catch (error) {
      console.error("Gumloop webhook error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Webhook error" });
    }
  });

  // ==================== ADMIN ENDPOINTS ====================

  // Check if current user is admin
  app.get("/api/admin/status", optionalAuth, async (req: Request, res: Response) => {
    const isAdmin = req.isAdmin || false;
    // Debug logging for admin status check
    console.log(`[Admin Status] userId: ${req.userId || 'none'}, email: ${req.userEmail || 'none'}, isAdmin: ${isAdmin}`);
    res.json({ isAdmin, email: req.userEmail || null });
  });

  // Manual endpoint to sync stuck analyses with Gumloop
  app.post("/api/admin/sync-gumloop", requireAdmin, async (req: Request, res: Response) => {
    try {
      console.log(`Admin ${req.userEmail}: Manual Gumloop sync triggered`);
      const result = await syncStuckAnalysesWithGumloop();

      res.json({
        message: `Synced ${result.synced} of ${result.checked} stuck analyses`,
        ...result,
      });
    } catch (error) {
      console.error("Admin sync error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Sync error" });
    }
  });

  // Admin: Trigger a new analysis
  app.post("/api/admin/analyze", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tokenId, tokenSymbol, tokenName, tokenImage, chain } = req.body;

      if (!tokenId || !tokenSymbol || !tokenName) {
        res.status(400).json({ message: "tokenId, tokenSymbol, and tokenName are required" });
        return;
      }

      console.log(`Admin ${req.userEmail}: Starting analysis for ${tokenSymbol} (${tokenId})`);

      // Check Gumloop configuration
      const gumloopApiKey = process.env.GUMLOOP_API_KEY;
      const gumloopPipelineId = process.env.GUMLOOP_PIPELINE_ID;
      const gumloopUserId = process.env.GUMLOOP_USER_ID;

      if (!gumloopApiKey || !gumloopPipelineId || !gumloopUserId) {
        res.status(503).json({ message: "Gumloop not configured. Set GUMLOOP_API_KEY, GUMLOOP_PIPELINE_ID, and GUMLOOP_USER_ID." });
        return;
      }

      // Check for existing pending/processing analysis for this token
      const existingAnalysis = await storage.getLatestAnalysisByTokenId(tokenId);
      if (existingAnalysis && (existingAnalysis.status === "pending" || existingAnalysis.status === "processing")) {
        res.status(409).json({
          message: `Analysis already in progress for ${tokenSymbol}`,
          analysisId: existingAnalysis.id,
          status: existingAnalysis.status,
        });
        return;
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
        const cgApiType = process.env.COINGECKO_API_TYPE || 'demo';
        const cgBaseUrl = cgApiType === 'pro' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (cgApiKey) {
          headers[cgApiType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = cgApiKey;
        }

        const cgResponse = await fetch(
          `${cgBaseUrl}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`,
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
          console.log(`Admin: Fetched market data for ${tokenSymbol} - FDV: $${marketData.fdv}`);
        } else {
          console.warn(`Admin: Failed to fetch CoinGecko data for ${tokenId}: ${cgResponse.status}`);
        }
      } catch (err) {
        console.warn(`Admin: CoinGecko fetch error for ${tokenId}:`, err);
      }

      // Create the analysis record with defaults and market data
      const analysis = await storage.createAnalysis({
        tokenId,
        tokenSymbol,
        tokenName,
        tokenImage: tokenImage || null,
        chain: chain || null,
        userId: req.userId!, // Track which admin triggered it
        status: "processing",
        finalScore: "0", // Will be updated when analysis completes
        tier: "?", // Will be updated when analysis completes
        // Market data from CoinGecko
        currentPrice: marketData.currentPrice,
        marketCap: marketData.marketCap,
        fdv: marketData.fdv,
        volume24h: marketData.volume24h,
        priceChange24h: marketData.priceChange24h,
        priceChange7d: marketData.priceChange7d,
        categories: marketData.categories,
      });

      console.log(`Admin: Created analysis ${analysis.id} for ${tokenSymbol}`);

      // Call Gumloop API to start the pipeline
      const gumloopUrl = new URL("https://api.gumloop.com/api/v1/start_pipeline");
      gumloopUrl.searchParams.set("user_id", gumloopUserId);
      gumloopUrl.searchParams.set("saved_item_id", gumloopPipelineId);

      const gumloopPayload = {
        pipeline_inputs: [
          { input_name: "Token Input", value: tokenSymbol }, // NO $ prefix
        ],
      };

      console.log(`Admin: Calling Gumloop API for ${tokenSymbol}`);

      const gumloopResponse = await fetch(gumloopUrl.toString(), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gumloopApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gumloopPayload),
      });

      if (!gumloopResponse.ok) {
        const errorText = await gumloopResponse.text();
        console.error(`Admin: Gumloop API error: ${gumloopResponse.status} - ${errorText}`);

        // Mark analysis as failed
        await storage.updateAnalysis(analysis.id, {
          status: "failed",
          errorCode: "API_ERROR",
          errorMessage: `Gumloop API error: ${gumloopResponse.status}`,
        });

        res.status(502).json({ message: `Gumloop API error: ${gumloopResponse.status}` });
        return;
      }

      const gumloopData = await gumloopResponse.json();
      const runId = gumloopData.run_id;

      if (!runId) {
        console.error("Admin: No run_id returned from Gumloop");
        await storage.updateAnalysis(analysis.id, {
          status: "failed",
          errorCode: "API_ERROR",
          errorMessage: "No run_id returned from Gumloop",
        });
        res.status(502).json({ message: "No run_id returned from Gumloop" });
        return;
      }

      // Save the run_id for webhook matching
      await storage.updateAnalysis(analysis.id, {
        gumloopRunId: runId,
      });

      console.log(`Admin: Started Gumloop run ${runId} for analysis ${analysis.id}`);

      res.json({
        message: `Analysis started for ${tokenSymbol}`,
        analysisId: analysis.id,
        runId,
        status: "processing",
      });
    } catch (error) {
      console.error("Admin analyze error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Analysis error" });
    }
  });

  // Admin: Get full leaderboard (no access limits)
  app.get("/api/admin/leaderboard", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10000;
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || "score7d";
      const order = (req.query.order as "asc" | "desc") || "desc";

      // Build filters from query params
      const filters: any = {};
      if (req.query.tier) filters.tier = req.query.tier;
      if (req.query.narrative) filters.narrative = req.query.narrative;
      if (req.query.chain) filters.chain = req.query.chain;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.tokenType) filters.tokenType = req.query.tokenType;
      if (req.query.marketCapTier) filters.marketCapTier = req.query.marketCapTier;
      if (req.query.upsideTier) filters.upsideTier = req.query.upsideTier;

      const result = await storage.getLeaderboard({
        limit,
        offset,
        sortBy,
        order,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      res.json({
        ...result,
        isAdmin: true,
        accessLimit: null, // No limit for admin
      });
    } catch (error) {
      console.error("Admin leaderboard error:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Admin: Get all analyses history
  app.get("/api/admin/analyses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      // Get all analyses (not filtered by user)
      const result = await storage.getAllAnalyses(limit, offset, status);

      res.json(result);
    } catch (error) {
      console.error("Admin analyses error:", error);
      res.status(500).json({ message: "Failed to fetch analyses" });
    }
  });

  // Admin: Reprocess an analysis (re-fetch market data and re-parse output)
  app.post("/api/admin/analyze/:id/reprocess", requireAdmin, async (req: Request, res: Response) => {
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

      console.log(`Admin ${req.userEmail}: Reprocessing analysis ${analysisId} (${analysis.tokenSymbol})`);

      const updates: Record<string, any> = {};

      // Re-fetch market data from CoinGecko
      try {
        const cgApiKey = process.env.COINGECKO_API_KEY;
        const cgApiType = process.env.COINGECKO_API_TYPE || 'demo';
        const cgBaseUrl = cgApiType === 'pro' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (cgApiKey) {
          headers[cgApiType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = cgApiKey;
        }

        const cgResponse = await fetch(
          `${cgBaseUrl}/coins/${analysis.tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`,
          { headers }
        );

        if (cgResponse.ok) {
          const data = await cgResponse.json();
          updates.currentPrice = data.market_data?.current_price?.usd?.toString();
          updates.marketCap = data.market_data?.market_cap?.usd?.toString();
          updates.fdv = data.market_data?.fully_diluted_valuation?.usd?.toString();
          updates.volume24h = data.market_data?.total_volume?.usd?.toString();
          updates.priceChange24h = data.market_data?.price_change_percentage_24h?.toString();
          updates.priceChange7d = data.market_data?.price_change_percentage_7d?.toString();
          updates.categories = data.categories || [];
          console.log(`Admin: Re-fetched market data for ${analysis.tokenSymbol} - FDV: $${updates.fdv}`);
        }
      } catch (err) {
        console.warn(`Admin: CoinGecko fetch error:`, err);
      }

      // Re-parse raw output if available to extract upside fields
      if (analysis.rawGumloopResponse) {
        try {
          const { parseGumloopResponse, parseGumloopOutputs } = await import("./gumloop-parser");

          let parsed;
          // Try to parse as JSON first (new format)
          try {
            const outputs = JSON.parse(analysis.rawGumloopResponse as string);
            parsed = parseGumloopOutputs(outputs);
          } catch {
            // Fall back to text parsing
            parsed = parseGumloopResponse(analysis.rawGumloopResponse as string);
          }

          // Update upside fields if found
          if (parsed.currentFdv) updates.currentFdv = parsed.currentFdv;
          if (parsed.realisticPeakFdv) updates.realisticPeakFdv = parsed.realisticPeakFdv;
          if (parsed.upsideMultiple) updates.upsideMultiple = parsed.upsideMultiple;
          if (parsed.upsideTier) updates.upsideTier = parsed.upsideTier;

          console.log(`Admin: Re-parsed upside fields - multiple: ${updates.upsideMultiple}, tier: ${updates.upsideTier}`);
        } catch (err) {
          console.warn(`Admin: Re-parse error:`, err);
        }
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await storage.updateAnalysis(analysisId, updates);

        // Invalidate cache
        const { invalidateCache, CACHE_KEYS } = await import("./redis");
        await invalidateCache(CACHE_KEYS.ANALYSIS(analysisId));
        await invalidateCache(CACHE_KEYS.LEADERBOARD);

        res.json({
          message: `Reprocessed analysis ${analysisId}`,
          updates: Object.keys(updates),
        });
      } else {
        res.json({ message: "No updates found", updates: [] });
      }
    } catch (error) {
      console.error("Admin reprocess error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Reprocess error" });
    }
  });

  // Admin: Recover a failed analysis by re-syncing with Gumloop
  app.post("/api/admin/analyze/:id/recover", requireAdmin, async (req: Request, res: Response) => {
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

      if (!analysis.gumloopRunId) {
        res.status(400).json({ message: "Analysis has no Gumloop run ID - cannot recover" });
        return;
      }

      console.log(`Admin ${req.userEmail}: Recovering failed analysis ${analysisId} (${analysis.tokenSymbol}) - Run ID: ${analysis.gumloopRunId}`);

      // Fetch current status from Gumloop
      const runStatus = await fetchGumloopRunStatus(analysis.gumloopRunId);
      if (!runStatus) {
        res.status(502).json({ message: "Could not fetch status from Gumloop" });
        return;
      }

      console.log(`Admin: Gumloop run ${analysis.gumloopRunId} state: ${runStatus.state}`);

      if (runStatus.state === "DONE" && runStatus.outputs) {
        // Process the completion - this will update all fields and mark as completed
        await processGumloopCompletion(analysisId, runStatus.outputs);

        // Invalidate cache
        const { invalidateCache, CACHE_KEYS } = await import("./redis");
        await invalidateCache(CACHE_KEYS.ANALYSIS(analysisId));
        await invalidateCache(CACHE_KEYS.LEADERBOARD);

        res.json({
          message: `Successfully recovered analysis ${analysisId}`,
          gumloopState: runStatus.state,
          status: "completed",
        });
      } else if (runStatus.state === "RUNNING" || runStatus.state === "STARTED") {
        // Still running - update status to processing
        await storage.updateAnalysis(analysisId, {
          status: "processing",
          errorCode: null,
          errorMessage: null,
        });

        res.json({
          message: `Analysis ${analysisId} is still running in Gumloop - status updated to processing`,
          gumloopState: runStatus.state,
          status: "processing",
        });
      } else {
        // Failed or terminated in Gumloop
        res.json({
          message: `Gumloop run is in state: ${runStatus.state} - cannot recover`,
          gumloopState: runStatus.state,
          status: analysis.status,
        });
      }
    } catch (error) {
      console.error("Admin recover error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Recover error" });
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

  // ==================== LEADERBOARD (Access-Gated with Preview) ====================
  app.get("/api/leaderboard", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const requestedLimit = parseInt(req.query.limit as string) || 10000;
      const requestedOffset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || "score7d";
      const order = (req.query.order as "asc" | "desc") || "desc";

      // Determine user's leaderboard access limit
      let accessLimit: number | null = null; // null = unlimited
      let isPremium = false;
      let userTier = "free";
      let isBeta = BETA_MODE;

      // During beta, everyone gets full access
      if (BETA_MODE) {
        accessLimit = null; // Unlimited
        isPremium = true;
        userTier = "beta_free";
      } else if (userId) {
        const subscription = await storage.getUserSubscription(userId);
        userTier = subscription?.tier || "free";
        const tierConfig = SUBSCRIPTION_TIERS[userTier as SubscriptionTierId] || SUBSCRIPTION_TIERS.free;
        accessLimit = tierConfig.leaderboardAccess;
        isPremium = userTier === "pro" || userTier === "premium";
      } else {
        // Non-authenticated users get free tier access
        accessLimit = SUBSCRIPTION_TIERS.free.leaderboardAccess;
      }

      const filters: any = {};
      if (req.query.tier) filters.tier = req.query.tier;
      if (req.query.narrative) filters.narrative = req.query.narrative;
      if (req.query.chain) filters.chain = req.query.chain;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.tokenType) filters.tokenType = req.query.tokenType;
      if (req.query.marketCapTier) filters.marketCapTier = req.query.marketCapTier;
      if (req.query.upsideTier) filters.upsideTier = req.query.upsideTier;

      // Use Redis caching for leaderboard (expensive aggregation query)
      const { getCachedOrFetch, CACHE_KEYS, CACHE_TTL } = await import("./redis");

      // Always fetch the full requested amount - frontend will blur gated items
      const cacheKey = `${CACHE_KEYS.LEADERBOARD}:${requestedLimit}:${requestedOffset}:${sortBy}:${order}:${JSON.stringify(filters)}`;

      const result = await getCachedOrFetch(
        cacheKey,
        CACHE_TTL.LEADERBOARD,
        () => storage.getLeaderboard({
          limit: requestedLimit,
          offset: requestedOffset,
          sortBy,
          order,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        })
      );

      // Determine if any items are gated (beyond access limit)
      const hasGatedItems = accessLimit !== null && (requestedOffset + result.items.length) > accessLimit;

      // Add access control metadata to response
      res.json({
        ...result,
        accessLimit,
        hasGatedItems,
        isPremium,
        userTier,
        isBeta,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  // ==================== LEADERBOARD STATS (Public) ====================
  app.get("/api/leaderboard/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getLeaderboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting leaderboard stats:", error);
      res.status(500).json({ message: "Failed to get leaderboard stats" });
    }
  });

  // ==================== PERFORMANCE TRACKING (Public) ====================

  // Get latest cached performance metrics summary
  app.get("/api/performance/summary", async (_req: Request, res: Response) => {
    try {
      const metrics = await storage.getLatestPerformanceMetrics();

      if (!metrics) {
        // Return empty metrics if none exist yet
        res.json({
          top10Avg7dReturn: null,
          top10Avg30dReturn: null,
          hitRate7d: null,
          hitRate30d: null,
          tierMetrics: {},
          totalTokens: 0,
          metricDate: null,
        });
        return;
      }

      res.json({
        top10Avg7dReturn: metrics.top10Avg7dReturn ? parseFloat(metrics.top10Avg7dReturn as string) : null,
        top10Avg30dReturn: metrics.top10Avg30dReturn ? parseFloat(metrics.top10Avg30dReturn as string) : null,
        hitRate7d: metrics.hitRate7d ? parseFloat(metrics.hitRate7d as string) : null,
        hitRate30d: metrics.hitRate30d ? parseFloat(metrics.hitRate30d as string) : null,
        tierMetrics: metrics.tierMetrics || {},
        totalTokens: metrics.totalTokens || 0,
        metricDate: metrics.metricDate,
      });
    } catch (error) {
      console.error("Error getting performance summary:", error);
      res.status(500).json({ message: "Failed to get performance summary" });
    }
  });

  // Get individual token performance metrics
  app.get("/api/performance/token/:tokenId", async (req: Request, res: Response) => {
    try {
      const { tokenId } = req.params;

      const [firstAnalysis, latestAnalysis, latestSnapshot] = await Promise.all([
        storage.getTokenFirstAnalysis(tokenId),
        storage.getLatestAnalysisByTokenId(tokenId),
        storage.getLatestPriceSnapshot(tokenId),
      ]);

      if (!firstAnalysis && !latestAnalysis) {
        res.status(404).json({ message: "Token not found" });
        return;
      }

      // Calculate returns
      const priceAtFirst = firstAnalysis?.priceAtAnalysis
        ? parseFloat(firstAnalysis.priceAtAnalysis as string)
        : firstAnalysis?.currentPrice
          ? parseFloat(firstAnalysis.currentPrice as string)
          : null;

      const priceAtLatest = latestAnalysis?.currentPrice
        ? parseFloat(latestAnalysis.currentPrice as string)
        : null;

      const currentPrice = latestSnapshot?.priceUsd
        ? parseFloat(latestSnapshot.priceUsd as string)
        : null;

      const calculateReturn = (start: number | null, end: number | null): number | null => {
        if (!start || !end || start === 0) return null;
        return ((end - start) / start) * 100;
      };

      res.json({
        tokenId,
        priceAtFirstAnalysis: priceAtFirst,
        priceAtLatestAnalysis: priceAtLatest,
        currentPrice,
        returnSinceFirst: calculateReturn(priceAtFirst, currentPrice),
        returnSinceLatest: calculateReturn(priceAtLatest, currentPrice),
        firstAnalysisDate: firstAnalysis?.createdAt?.toISOString() || null,
        latestAnalysisDate: latestAnalysis?.createdAt?.toISOString() || null,
        snapshotDate: latestSnapshot?.snapshotDate || null,
      });
    } catch (error) {
      console.error("Error getting token performance:", error);
      res.status(500).json({ message: "Failed to get token performance" });
    }
  });

  // Admin endpoint to manually trigger performance data collection
  app.post("/api/admin/performance/collect", requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Dynamically import to avoid circular dependencies
      const { runDailyJob } = await import("./jobs/priceSnapshots");

      // Run in background
      runDailyJob().catch(err => {
        console.error("Background performance collection error:", err);
      });

      res.json({ message: "Performance data collection started" });
    } catch (error) {
      console.error("Error starting performance collection:", error);
      res.status(500).json({ message: "Failed to start performance collection" });
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

  // User-triggered analysis has been discontinued
  // The platform now operates as a view-only leaderboard with admin-curated analyses
  app.post("/api/analyze", optionalAuth, async (req: Request, res: Response) => {
    res.status(410).json({
      message: "User-triggered analysis has been discontinued. Browse our curated leaderboard or vote for tokens you'd like to see analyzed.",
      code: "FEATURE_DISCONTINUED",
    });
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

  // Get analysis by ID (Access-Gated)
  app.get("/api/analyze/:id", optionalAuth, async (req: Request, res: Response) => {
    try {
      const analysisId = parseInt(req.params.id, 10);
      const userId = req.userId;
      const isAdmin = req.isAdmin;

      console.log(`GET /api/analyze/${analysisId}: userId=${userId}, isAdmin=${isAdmin}`);

      if (isNaN(analysisId)) {
        res.status(400).json({ message: "Invalid analysis ID" });
        return;
      }

      const analysis = await storage.getAnalysis(analysisId);

      if (!analysis) {
        console.log(`Analysis ${analysisId}: Not found in database`);
        res.status(404).json({ message: "Analysis not found" });
        return;
      }

      // Check access for completed analyses (admins bypass)
      if (analysis.status === "completed" && !isAdmin) {
        const accessCheck = await checkScorecardAccess(userId, analysis.tokenId);
        console.log(`Analysis ${analysisId}: Access check - hasAccess=${accessCheck.hasAccess}, rank=${accessCheck.rank}, limit=${accessCheck.accessLimit}`);
        if (!accessCheck.hasAccess) {
          res.status(403).json({
            message: "Upgrade to view this scorecard",
            code: "ACCESS_DENIED",
            rank: accessCheck.rank,
            accessLimit: accessCheck.accessLimit,
            requiresUpgrade: true,
          });
          return;
        }
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error getting analysis:", error);
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  // Get analysis by token ID (Access-Gated)
  app.get("/api/analyze/token/:tokenId", optionalAuth, async (req: Request, res: Response) => {
    try {
      const tokenId = req.params.tokenId;
      const userId = req.userId;
      const isAdmin = req.isAdmin;

      if (!tokenId) {
        res.status(400).json({ message: "Token ID is required" });
        return;
      }

      const analysis = await storage.getAnalysisByToken(tokenId);

      if (!analysis) {
        res.status(404).json({ message: "No analysis found for this token" });
        return;
      }

      // Check access for completed analyses (admins bypass)
      if (analysis.status === "completed" && !isAdmin) {
        const accessCheck = await checkScorecardAccess(userId, tokenId);
        if (!accessCheck.hasAccess) {
          res.status(403).json({
            message: "Upgrade to view this scorecard",
            code: "ACCESS_DENIED",
            rank: accessCheck.rank,
            accessLimit: accessCheck.accessLimit,
            requiresUpgrade: true,
          });
          return;
        }
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error getting analysis by token:", error);
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  // Retry endpoint - DISCONTINUED
  // User-triggered retries have been removed as part of the view-only pivot
  app.post("/api/analyze/:id/retry", requireAuth, async (req: Request, res: Response) => {
    res.status(410).json({
      message: "Analysis retry has been discontinued. Browse our curated leaderboard or vote for tokens you'd like to see analyzed.",
      code: "FEATURE_DISCONTINUED",
    });
  });

  // Cancel endpoint - DISCONTINUED
  // User-triggered cancellation has been removed as part of the view-only pivot
  app.post("/api/analyze/:id/cancel", requireAuth, async (req: Request, res: Response) => {
    res.status(410).json({
      message: "Analysis cancellation has been discontinued. Browse our curated leaderboard or vote for tokens you'd like to see analyzed.",
      code: "FEATURE_DISCONTINUED",
    });
  });

  // ==================== SHARE IMAGE ENDPOINTS ====================
  // Directory for share images (use process.cwd() for CommonJS compatibility)
  const shareImagesDir = path.resolve(process.cwd(), "share-images");
  if (!fs.existsSync(shareImagesDir)) {
    fs.mkdirSync(shareImagesDir, { recursive: true });
  }

  // Save share card image
  app.post("/api/analyze/:id/share-image", async (req: Request, res: Response) => {
    try {
      const analysisId = parseInt(req.params.id, 10);
      const { imageData } = req.body;

      if (!analysisId || isNaN(analysisId)) {
        res.status(400).json({ message: "Valid analysis ID is required" });
        return;
      }

      if (!imageData || !imageData.startsWith("data:image/png;base64,")) {
        res.status(400).json({ message: "Valid PNG image data is required" });
        return;
      }

      // Validate image size (max 5MB)
      const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (imageBuffer.length > maxSize) {
        res.status(413).json({ message: "Image too large. Maximum size is 5MB." });
        return;
      }

      // Verify the analysis exists
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        res.status(404).json({ message: "Analysis not found" });
        return;
      }

      // Save the image
      const imagePath = path.join(shareImagesDir, `${analysisId}.png`);
      fs.writeFileSync(imagePath, imageBuffer);

      res.json({
        success: true,
        imageUrl: `/api/share/${analysisId}.png`
      });
    } catch (error) {
      console.error("Error saving share image:", error);
      res.status(500).json({ message: "Failed to save share image" });
    }
  });

  // Serve share card image
  app.get("/api/share/:id.png", async (req: Request, res: Response) => {
    try {
      const analysisId = req.params.id;

      // Security: Validate analysisId is numeric only to prevent path traversal
      if (!/^\d+$/.test(analysisId)) {
        res.status(400).json({ message: "Invalid analysis ID format" });
        return;
      }

      const imagePath = path.join(shareImagesDir, `${analysisId}.png`);

      // Security: Ensure resolved path is within shareImagesDir
      const resolvedPath = path.resolve(imagePath);
      if (!resolvedPath.startsWith(path.resolve(shareImagesDir))) {
        res.status(400).json({ message: "Invalid path" });
        return;
      }

      if (!fs.existsSync(imagePath)) {
        res.status(404).json({ message: "Share image not found" });
        return;
      }

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
      res.sendFile(imagePath);
    } catch (error) {
      console.error("Error serving share image:", error);
      res.status(500).json({ message: "Failed to serve share image" });
    }
  });

  // Get analysis metadata for Open Graph (used by static.ts)
  app.get("/api/analyze/:id/og-data", async (req: Request, res: Response) => {
    try {
      const analysisId = parseInt(req.params.id, 10);

      if (!analysisId || isNaN(analysisId)) {
        res.status(400).json({ message: "Valid analysis ID is required" });
        return;
      }

      const analysis = await storage.getAnalysis(analysisId);

      if (!analysis) {
        res.status(404).json({ message: "Analysis not found" });
        return;
      }

      // Return minimal data needed for OG tags
      res.json({
        id: analysis.id,
        tokenSymbol: analysis.tokenSymbol,
        tokenName: analysis.tokenName,
        finalScore: analysis.finalScore,
        tier: analysis.tier,
        recommendation: analysis.recommendation,
        consensusLevel: analysis.consensusLevel,
      });
    } catch (error) {
      console.error("Error getting OG data:", error);
      res.status(500).json({ message: "Failed to get OG data" });
    }
  });

  // ==================== VOTING SYSTEM ====================

  // Get user's voting status (remaining votes, voted tokens)
  app.get("/api/vote/status", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const today = getESTDateString();

      // Default for unauthenticated users
      if (!userId) {
        // During beta, show beta_free tier info (but they still need to auth to vote)
        const effectiveTier = BETA_MODE ? SUBSCRIPTION_TIERS.beta_free : SUBSCRIPTION_TIERS.free;
        res.json({
          votesRemaining: 0,
          votesUsed: 0,
          maxVotes: effectiveTier.votesPerDay,
          hasPriorityVotes: effectiveTier.priorityVotes,
          resetTime: getNextMidnightEST(),
          votedTokenIds: [],
          authenticated: false,
          isBeta: BETA_MODE,
        });
        return;
      }

      // Get user subscription to determine vote limits
      // During beta, all users get beta_free tier (1 vote/day, no priority)
      const subscription = await storage.getUserSubscription(userId);
      const actualTier = (subscription?.tier || "free") as SubscriptionTierId;
      const effectiveTier = BETA_MODE ? "beta_free" : actualTier;
      const tierConfig = SUBSCRIPTION_TIERS[effectiveTier] || SUBSCRIPTION_TIERS.free;

      const maxVotes = tierConfig.votesPerDay;
      const hasPriorityFromTier = tierConfig.priorityVotes;
      const isPrioritySharer = await storage.isPrioritySharer(userId);
      const hasPriorityVotes = hasPriorityFromTier || isPrioritySharer;
      const votesUsed = await storage.getUserDailyVoteCount(userId, today);
      const votedRequestIds = await storage.getUserVotedRequestIds(userId);

      res.json({
        votesRemaining: Math.max(0, maxVotes - votesUsed),
        votesUsed,
        maxVotes,
        hasPriorityVotes,
        isPrioritySharer,
        resetTime: getNextMidnightEST(),
        votedRequestIds,
        authenticated: true,
        isBeta: BETA_MODE,
      });
    } catch (error) {
      console.error("Error getting vote status:", error);
      res.status(500).json({ message: "Failed to get vote status" });
    }
  });

  // Get vote requests (tokens users want analyzed)
  app.get("/api/vote/requests", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const status = (req.query.status as string) || "pending";

      const result = await storage.getVoteRequests({ limit, offset, status });

      res.json(result);
    } catch (error) {
      console.error("Error getting vote requests:", error);
      res.status(500).json({ message: "Failed to get vote requests" });
    }
  });

  // Get top pending vote requests
  app.get("/api/vote/top", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const requests = await storage.getTopVoteRequests(limit);
      res.json(requests);
    } catch (error) {
      console.error("Error getting top vote requests:", error);
      res.status(500).json({ message: "Failed to get top vote requests" });
    }
  });

  // Get recently analyzed requests
  app.get("/api/vote/recently-analyzed", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
      const requests = await storage.getRecentlyAnalyzedRequests(limit);
      res.json(requests);
    } catch (error) {
      console.error("Error getting recently analyzed requests:", error);
      res.status(500).json({ message: "Failed to get recently analyzed requests" });
    }
  });

  // Get yesterday's top voted token
  app.get("/api/vote/yesterday-top", async (req: Request, res: Response) => {
    try {
      const result = await storage.getYesterdayTopVote();
      res.json(result);
    } catch (error) {
      console.error("Error getting yesterday's top vote:", error);
      res.status(500).json({ message: "Failed to get yesterday's top vote" });
    }
  });

  // Submit a vote for a token (creates request if needed, then votes)
  app.post("/api/vote", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { tokenId, tokenSymbol, tokenName, tokenImage } = req.body;

      if (!tokenId || !tokenSymbol || !tokenName) {
        res.status(400).json({ message: "Token ID, symbol, and name are required" });
        return;
      }

      // Security: Validate and sanitize input to prevent XSS
      const sanitize = (str: string) => str.replace(/[<>'"&]/g, '').trim().slice(0, 200);
      const sanitizedTokenId = sanitize(tokenId);
      const sanitizedTokenSymbol = sanitize(tokenSymbol).slice(0, 20);
      const sanitizedTokenName = sanitize(tokenName).slice(0, 100);
      const sanitizedTokenImage = tokenImage ? sanitize(tokenImage).slice(0, 500) : null;

      // Validate tokenId format (CoinGecko IDs are lowercase alphanumeric with hyphens)
      if (!/^[a-z0-9-]+$/.test(sanitizedTokenId)) {
        res.status(400).json({ message: "Invalid token ID format" });
        return;
      }

      // Check if token already has a completed analysis (already on leaderboard)
      const existingAnalysis = await storage.getLatestAnalysisByTokenId(sanitizedTokenId);
      if (existingAnalysis && existingAnalysis.status === "completed") {
        res.status(400).json({
          message: "This token has already been analyzed and is on the leaderboard.",
          code: "ALREADY_ANALYZED",
          analysisId: existingAnalysis.id,
        });
        return;
      }

      // Check user's vote limit
      // During beta, all users get beta_free tier voting limits (1 vote/day, no priority)
      const subscription = await storage.getUserSubscription(userId);
      const actualTier = (subscription?.tier || "free") as SubscriptionTierId;
      const effectiveTier = BETA_MODE ? "beta_free" : actualTier;
      const tierConfig = SUBSCRIPTION_TIERS[effectiveTier] || SUBSCRIPTION_TIERS.free;

      const today = getESTDateString();
      const votesUsed = await storage.getUserDailyVoteCount(userId, today);
      const maxVotes = tierConfig.votesPerDay;

      if (votesUsed >= maxVotes) {
        res.status(403).json({
          message: `Daily vote limit reached (${maxVotes} votes). Resets at midnight EST.`,
          code: "VOTE_LIMIT_REACHED",
          votesUsed,
          maxVotes,
          resetTime: getNextMidnightEST(),
        });
        return;
      }

      // Check if a vote request already exists for this token
      let voteRequest = await storage.getVoteRequestByTokenId(sanitizedTokenId);

      if (!voteRequest) {
        // Create new vote request with sanitized values
        voteRequest = await storage.createVoteRequest({
          tokenId: sanitizedTokenId,
          tokenSymbol: sanitizedTokenSymbol,
          tokenName: sanitizedTokenName,
          tokenImage: sanitizedTokenImage,
          voteCount: 0,
          priorityVoteCount: 0,
          status: "pending",
        });
      }

      // Check if user already voted for this request
      const alreadyVoted = await storage.hasUserVotedForRequest(userId, voteRequest.id);
      if (alreadyVoted) {
        res.status(400).json({
          message: "You have already voted for this token",
          code: "ALREADY_VOTED",
        });
        return;
      }

      // Determine if this is a priority vote
      // Priority votes come from: 1) Premium tier users, OR 2) Verified sharers
      const isPriorityFromTier = tierConfig.priorityVotes;
      const isPrioritySharer = await storage.isPrioritySharer(userId);
      const isPriorityVote = isPriorityFromTier || isPrioritySharer;

      // Create the vote
      await storage.createVote({
        userId,
        tokenVoteRequestId: voteRequest.id,
        isPriorityVote,
      });

      // Increment vote count
      await storage.incrementVoteCount(voteRequest.id, isPriorityVote);

      // Increment user's daily vote count
      await storage.incrementUserDailyVotes(userId, today);

      // Get updated request
      const updatedRequest = await storage.getVoteRequestByTokenId(sanitizedTokenId);

      res.json({
        message: isPrioritySharer && !isPriorityFromTier
          ? "Priority vote recorded! (Sharer bonus)"
          : "Vote recorded successfully",
        voteRequest: updatedRequest,
        isPriorityVote,
        isPrioritySharer,
        votesRemaining: maxVotes - votesUsed - 1,
      });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).json({ message: "Failed to submit vote" });
    }
  });

  // ==================== SUPPORT / CONTACT ====================
  app.post("/api/support", optionalAuth, async (req: Request, res: Response) => {
    try {
      const { email, subject, message, name } = req.body;

      // Validate required fields
      if (!email || !subject || !message) {
        return res.status(400).json({ message: "Email, subject, and message are required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      // Send the support email
      const result = await sendSupportEmail(email, subject, message, name);

      if (result.success) {
        res.json({ message: "Support request sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send support request" });
      }
    } catch (error) {
      console.error("Error sending support request:", error);
      res.status(500).json({ message: "Failed to send support request" });
    }
  });

  // ==================== FEEDBACK ENDPOINTS ====================

  // Submit feedback or report an issue
  app.post("/api/feedback", optionalAuth, async (req: Request, res: Response) => {
    try {
      const { email, subject, message, type, tokenSymbol, analysisId } = req.body;

      // Validate required fields
      if (!email || !subject || !message) {
        return res.status(400).json({ message: "Email, subject, and message are required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      // Save to database
      const feedback = await storage.createFeedback({
        userId: req.userId || null,
        userEmail: email,
        type: type || 'feedback',
        subject,
        message,
        tokenSymbol: tokenSymbol || null,
        analysisId: analysisId || null,
        status: 'new',
      });

      // Also send email notification
      const emailSubject = type === 'issue'
        ? `[Issue Report] ${tokenSymbol ? `$${tokenSymbol}: ` : ''}${subject}`
        : `[Feedback] ${subject}`;

      const emailMessage = tokenSymbol
        ? `Token: $${tokenSymbol}\n${analysisId ? `Analysis ID: ${analysisId}\n` : ''}\n${message}`
        : message;

      await sendSupportEmail(email, emailSubject, emailMessage);

      console.log(`Feedback saved: ${type} from ${email} - ${subject}`);
      res.json({ message: "Feedback submitted successfully", id: feedback.id });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Get all feedback (admin only)
  app.get("/api/feedback", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const feedback = await storage.getFeedback(100);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ==================== SHARING & REFERRAL ENDPOINTS ====================

  // Generate a Twitter share intent URL and track the share
  app.post("/api/share/twitter", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { text, url, tokenSymbol, analysisId } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Share text is required" });
      }

      // Create Twitter intent URL
      const params = new URLSearchParams();
      params.set("text", text);
      if (url) params.set("url", url);

      const twitterIntentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;

      // Track the share attempt
      const share = await storage.createShare({
        userId,
        shareType: tokenSymbol ? "scorecard_twitter" : "twitter",
        shareUrl: url,
        tokenSymbol: tokenSymbol || null,
        analysisId: analysisId || null,
        verified: false,
      });

      res.json({
        shareId: share.id,
        intentUrl: twitterIntentUrl,
        message: "Share tracked. Click the intent URL to post on Twitter.",
      });
    } catch (error) {
      console.error("Error creating share:", error);
      res.status(500).json({ message: "Failed to create share" });
    }
  });

  // Verify a share was made (honor system - user clicks to confirm)
  app.post("/api/share/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { shareId } = req.body;

      if (!shareId) {
        return res.status(400).json({ message: "Share ID is required" });
      }

      // Get the share and verify ownership
      const shares = await storage.getUserShares(userId);
      const share = shares.find(s => s.id === shareId);

      if (!share) {
        return res.status(404).json({ message: "Share not found" });
      }

      if (share.verified) {
        return res.status(400).json({ message: "Share already verified" });
      }

      // Verify the share
      const verifiedShare = await storage.verifyShare(shareId);

      // Check if user now has priority status
      const isPriority = await storage.isPrioritySharer(userId);

      res.json({
        verified: true,
        isPrioritySharer: isPriority,
        message: isPriority
          ? "Share verified! You now have Priority status for the analysis queue."
          : "Share verified! Keep sharing to earn Priority status.",
      });
    } catch (error) {
      console.error("Error verifying share:", error);
      res.status(500).json({ message: "Failed to verify share" });
    }
  });

  // Get user's sharing stats
  app.get("/api/share/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

      const shares = await storage.getUserShares(userId);
      const verifiedCount = await storage.getVerifiedShareCount(userId);
      const isPriority = await storage.isPrioritySharer(userId);

      res.json({
        totalShares: shares.length,
        verifiedShares: verifiedCount,
        isPrioritySharer: isPriority,
        sharesNeededForPriority: Math.max(0, 1 - verifiedCount), // Need 1 verified share
      });
    } catch (error) {
      console.error("Error fetching share stats:", error);
      res.status(500).json({ message: "Failed to fetch share stats" });
    }
  });

  // Get or create user's referral code
  app.get("/api/referral/code", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

      // Check if user already has a referral code
      let refCode = await storage.getReferralCode(userId);

      if (!refCode) {
        // Generate a unique code (first 8 chars of a hash)
        const crypto = await import("crypto");
        const code = crypto
          .createHash("sha256")
          .update(userId + Date.now().toString())
          .digest("hex")
          .substring(0, 8);

        refCode = await storage.createReferralCode(userId, code);
      }

      // Get referral stats
      const stats = await storage.getReferralStats(userId);

      res.json({
        code: refCode.code,
        referralUrl: `${req.protocol}://${req.get("host")}?ref=${refCode.code}`,
        stats: {
          totalVisits: stats.visits,
          conversions: stats.conversions,
          returningVisitors: stats.returningVisitors,
        },
      });
    } catch (error) {
      console.error("Error getting referral code:", error);
      res.status(500).json({ message: "Failed to get referral code" });
    }
  });

  // Track a referral visit (called from frontend when ?ref= param is present)
  app.post("/api/referral/track", async (req: Request, res: Response) => {
    try {
      const { referralCode, visitorId } = req.body;

      if (!referralCode || !visitorId) {
        return res.status(400).json({ message: "Referral code and visitor ID are required" });
      }

      // Verify the referral code exists
      const refCodeRecord = await storage.getReferralCodeByCode(referralCode);
      if (!refCodeRecord) {
        return res.status(404).json({ message: "Invalid referral code" });
      }

      // Check if this visitor already visited
      const existingVisit = await storage.getReferralVisitByVisitorId(visitorId);
      if (existingVisit) {
        // Just update the visit count (visitor returned)
        return res.json({ tracked: true, returning: true });
      }

      // Hash the IP for privacy
      const crypto = await import("crypto");
      const ip = req.ip || req.socket.remoteAddress || "";
      const ipHash = crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);

      // Track the visit
      await storage.trackReferralVisit({
        referralCode,
        visitorId,
        ipHash,
        userAgent: req.get("user-agent") || null,
        landingPage: req.get("referer") || null,
      });

      res.json({ tracked: true, returning: false });
    } catch (error) {
      console.error("Error tracking referral visit:", error);
      res.status(500).json({ message: "Failed to track referral" });
    }
  });

  // Convert a referral (called during sign-up if visitor has referral in localStorage)
  app.post("/api/referral/convert", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { visitorId, referralCode } = req.body;

      if (!visitorId || !referralCode) {
        return res.status(400).json({ message: "Visitor ID and referral code are required" });
      }

      // Convert the referral visit
      await storage.convertReferralVisit(visitorId, userId);

      // Update user's subscription with referral info
      await storage.updateReferredBy(userId, referralCode);

      res.json({ converted: true, message: "Referral attributed successfully" });
    } catch (error) {
      console.error("Error converting referral:", error);
      res.status(500).json({ message: "Failed to convert referral" });
    }
  });

  // Get user's referral stats
  app.get("/api/referral/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const stats = await storage.getReferralStats(userId);
      const refCode = await storage.getReferralCode(userId);

      res.json({
        hasReferralCode: !!refCode,
        code: refCode?.code || null,
        totalVisits: stats.visits,
        conversions: stats.conversions,
        returningVisitors: stats.returningVisitors,
        // Referral tier progress
        tierProgress: {
          bronze: { required: 3, current: stats.conversions, unlocked: stats.conversions >= 3 },
          silver: { required: 10, current: stats.conversions, unlocked: stats.conversions >= 10 },
          gold: { required: 25, current: stats.conversions, unlocked: stats.conversions >= 25 },
          platinum: { required: 50, current: stats.conversions, unlocked: stats.conversions >= 50 },
        },
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Check if user is a priority sharer
  app.get("/api/priority-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const isPriority = await storage.isPrioritySharer(userId);
      const prioritySharer = await storage.getPrioritySharer(userId);

      res.json({
        isPrioritySharer: isPriority,
        verifiedShareCount: prioritySharer?.verifiedShareCount || 0,
        priorityGrantedAt: prioritySharer?.priorityGrantedAt || null,
      });
    } catch (error) {
      console.error("Error checking priority status:", error);
      res.status(500).json({ message: "Failed to check priority status" });
    }
  });

  return httpServer;
}

// Helper to get current date string in EST (YYYY-MM-DD)
// EST is UTC-5
function getESTDateString(): string {
  const now = new Date();
  // Subtract 5 hours to convert UTC to EST
  const estTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return estTime.toISOString().split('T')[0];
}

// Helper to get next midnight EST as ISO string
// Midnight EST = 05:00 UTC
function getNextMidnightEST(): string {
  const now = new Date();
  const utcHours = now.getUTCHours();

  // Midnight EST is 05:00 UTC
  // If current UTC time is before 05:00, reset is today at 05:00 UTC
  // If current UTC time is 05:00 or later, reset is tomorrow at 05:00 UTC
  let resetDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    5, 0, 0, 0
  ));

  if (utcHours >= 5) {
    // Add one day
    resetDate = new Date(resetDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return resetDate.toISOString();
}

// Helper to check if user can access a specific scorecard
async function checkScorecardAccess(
  userId: string | undefined,
  tokenId: string
): Promise<{ hasAccess: boolean; rank: number | null; accessLimit: number | null }> {
  // During beta, everyone gets full access to all scorecards
  if (BETA_MODE) {
    return { hasAccess: true, rank: null, accessLimit: null };
  }

  // Determine user's access limit
  let accessLimit: number | null = null;

  if (userId) {
    const subscription = await storage.getUserSubscription(userId);
    const tier = (subscription?.tier || "free") as SubscriptionTierId;
    const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
    accessLimit = tierConfig.leaderboardAccess;
  } else {
    accessLimit = SUBSCRIPTION_TIERS.free.leaderboardAccess;
  }

  // If unlimited access, allow
  if (accessLimit === null) {
    return { hasAccess: true, rank: null, accessLimit };
  }

  // Check if this token is within the access limit by checking its leaderboard rank
  // Get leaderboard to find this token's rank
  try {
    const leaderboard = await storage.getLeaderboard({
      limit: 100, // Get enough to find the token
      offset: 0,
      sortBy: "score7d",
      order: "desc",
    });

    const tokenIndex = leaderboard.items.findIndex(item => item.tokenId === tokenId);
    const rank = tokenIndex >= 0 ? tokenIndex + 1 : null;

    // If token is not on leaderboard or is beyond access limit, deny
    if (rank === null || rank > accessLimit) {
      return { hasAccess: false, rank, accessLimit };
    }

    return { hasAccess: true, rank, accessLimit };
  } catch (error) {
    console.error("Error checking scorecard access:", error);
    // On error, default to allowing access
    return { hasAccess: true, rank: null, accessLimit };
  }
}

// ==================== PROCESS GUMLOOP COMPLETION ====================
// Shared function for processing Gumloop completion (used by both polling and webhook)
async function processGumloopCompletion(
  analysisId: number,
  outputs: Record<string, any>
): Promise<void> {
  console.log(`Processing Gumloop completion for analysis ${analysisId}`);
  console.log(`Output keys:`, Object.keys(outputs));

  // Try to find the output text - it could be named differently
  let output = "";
  const possibleKeys = ["analysis_result", "output", "result", "text", "response", "final_output", "aggregated_output", "analysis"];

  // First, try known keys
  for (const key of possibleKeys) {
    if (outputs[key] && typeof outputs[key] === "string") {
      output = outputs[key];
      console.log(`Analysis ${analysisId}: Found output in field "${key}", length: ${output.length}`);
      break;
    }
  }

  // Keys that should NOT be used as the main analysis output (they have special purposes)
  const excludeFromMainOutput = ["narrative", "final_narrative", "output narrative", "token_narrative"];

  // If not found, take the first string value from outputs that looks like analysis content
  if (!output) {
    for (const [key, value] of Object.entries(outputs)) {
      if (typeof value === "string" && value.length > 100 && !excludeFromMainOutput.includes(key.toLowerCase())) {
        output = value;
        console.log(`Analysis ${analysisId}: Using output from field "${key}", length: ${output.length}`);
        break;
      }
    }
  }

  // If still not found, try to stringify the entire outputs object
  if (!output && Object.keys(outputs).length > 0) {
    const firstKey = Object.keys(outputs)[0];
    const firstValue = outputs[firstKey];
    if (typeof firstValue === "object") {
      output = JSON.stringify(firstValue);
    } else if (firstValue) {
      output = String(firstValue);
    }
  }

  if (!output || output.length < 50) {
    console.error(`Analysis ${analysisId}: No valid output found`);
    await storage.updateAnalysis(analysisId, {
      status: "failed",
      errorCode: "EMPTY_OUTPUT",
      errorMessage: "Analysis completed but returned empty or invalid output.",
      displaySummary: "Analysis completed but no valid output was returned.",
    });
    return;
  }

  // Import the parser functions
  const { parseGumloopResponse, parseGumloopOutputs, hasDirectOutputFields } = await import("./gumloop-parser");

  // Check if outputs have direct field outputs (new format with "output fieldname")
  let parsed;
  let rawResponseToSave: string;
  const useDirectFields = hasDirectOutputFields(outputs);

  if (useDirectFields) {
    console.log(`Analysis ${analysisId}: Using direct output fields parser (new format)`);
    parsed = parseGumloopOutputs(outputs);
    // Save full outputs object as JSON when using direct fields
    rawResponseToSave = JSON.stringify(outputs, null, 2);
  } else {
    console.log(`Analysis ${analysisId}: Using text-based parser (legacy format)`);
    parsed = parseGumloopResponse(output);
    rawResponseToSave = output;
  }

  // FALLBACK: If model scores are empty after direct parsing, try text extraction
  if (Object.keys(parsed.modelScores).length === 0 && output && output.length > 100) {
    console.log(`Analysis ${analysisId}: Model scores empty, attempting text extraction fallback`);
    const textParsed = parseGumloopResponse(output);
    if (Object.keys(textParsed.modelScores).length > 0) {
      parsed.modelScores = textParsed.modelScores;
      console.log(`Analysis ${analysisId}: Recovered model scores from text: ${JSON.stringify(parsed.modelScores)}`);
    }
    // Also try to recover narrative from text if missing
    if (!parsed.narrative && textParsed.narrative) {
      parsed.narrative = textParsed.narrative;
      console.log(`Analysis ${analysisId}: Recovered narrative from text: ${parsed.narrative}`);
    }
    // Recover model analyses if missing
    if (Object.keys(parsed.modelAnalyses).length === 0 && Object.keys(textParsed.modelAnalyses).length > 0) {
      parsed.modelAnalyses = textParsed.modelAnalyses;
      console.log(`Analysis ${analysisId}: Recovered model analyses from text`);
    }
  }

  // FALLBACK: Extract social signals from text if missing
  if (output && output.length > 100) {
    const textParsed = parseGumloopResponse(output);
    if (!parsed.xSentiment && textParsed.xSentiment) {
      parsed.xSentiment = textParsed.xSentiment;
      console.log(`Analysis ${analysisId}: Recovered xSentiment from text: ${parsed.xSentiment}`);
    }
    if (!parsed.xMentionsTrend && textParsed.xMentionsTrend) {
      parsed.xMentionsTrend = textParsed.xMentionsTrend;
      console.log(`Analysis ${analysisId}: Recovered xMentionsTrend from text: ${parsed.xMentionsTrend}`);
    }
    if (!parsed.xTopKols && textParsed.xTopKols) {
      parsed.xTopKols = textParsed.xTopKols;
      console.log(`Analysis ${analysisId}: Recovered xTopKols from text: ${parsed.xTopKols}`);
    }
  }

  // FALLBACK: Try to extract narrative from analysis_result text if still missing
  if (!parsed.narrative && outputs['analysis_result'] && typeof outputs['analysis_result'] === 'string') {
    const analysisText = outputs['analysis_result'];
    // Look for common narrative patterns in the text
    const narrativePatterns = [
      /narrative[:\s]+([^\n|,]+)/i,
      /\*\*narrative\*\*[:\s]+([^\n|*]+)/i,
      /category[:\s]+([^\n|,]+)/i,
      /sector[:\s]+([^\n|,]+)/i,
    ];
    for (const pattern of narrativePatterns) {
      const match = analysisText.match(pattern);
      if (match && match[1]) {
        const extractedNarrative = match[1].trim();
        if (extractedNarrative.length > 2 && extractedNarrative.length < 50) {
          parsed.narrative = extractedNarrative;
          console.log(`Analysis ${analysisId}: Extracted narrative from text: ${parsed.narrative}`);
          break;
        }
      }
    }
  }

  // Provide fallback narrative if not found
  if (!parsed.narrative) {
    const tokenType = parsed.tokenType?.toUpperCase() || 'UTILITY';
    if (tokenType.includes('MEME')) {
      parsed.narrative = 'Meme/Social Token';
    } else {
      parsed.narrative = 'Utility/Infrastructure';
    }
    console.log(`Analysis ${analysisId}: Using fallback narrative: ${parsed.narrative}`);
  }

  console.log(`Analysis ${analysisId}: Parsed - score: ${parsed.finalScore}, tier: ${parsed.tier}, narrative: ${parsed.narrative}`);

  // Fetch existing analysis to get FDV for score capping (fall back to market cap)
  const existingAnalysis = await storage.getAnalysis(analysisId);
  const fdvStr = existingAnalysis?.fdv || existingAnalysis?.marketCap;
  const fdvValue = fdvStr ? parseFloat(fdvStr as string) : null;

  // Determine FDV tier and apply hard caps
  // Thresholds: Nano <$5M, Micro $5M-$15M, Small $15M-$50M, Mid $50M-$150M, Upper Mid $150M-$500M, Large $500M-$1B, Mega $1B-$5B, Giga >$5B
  let fdvTier = "nano";
  let scoreCap = 100;
  if (fdvValue !== null && !isNaN(fdvValue)) {
    if (fdvValue > 5_000_000_000) {
      fdvTier = "giga";
      scoreCap = 75;
    } else if (fdvValue > 1_000_000_000) {
      fdvTier = "mega";
      scoreCap = 80;
    } else if (fdvValue > 500_000_000) {
      fdvTier = "large";
      scoreCap = 85;
    } else if (fdvValue > 150_000_000) {
      fdvTier = "upper_mid";
      scoreCap = 90;
    } else if (fdvValue > 50_000_000) {
      fdvTier = "mid";
    } else if (fdvValue > 15_000_000) {
      fdvTier = "small";
    } else if (fdvValue > 5_000_000) {
      fdvTier = "micro";
    } else {
      fdvTier = "nano";
    }
  }

  // Apply hard cap to final score
  const uncappedScore = parsed.finalScore;
  const cappedScore = Math.min(parsed.finalScore, scoreCap);
  const scoreCapped = cappedScore < uncappedScore;

  // Calculate FDV modifier as the penalty applied by score capping
  // If Gumloop provided a modifier, use that; otherwise calculate from cap
  const calculatedFdvModifier = scoreCapped ? (cappedScore - uncappedScore) : 0;
  const finalFdvModifier = parsed.fdvModifier !== undefined
    ? parsed.fdvModifier
    : calculatedFdvModifier;

  if (scoreCapped) {
    console.log(`Analysis ${analysisId}: Score capped from ${uncappedScore} to ${cappedScore} (${fdvTier} cap, FDV: $${fdvValue?.toLocaleString()}, modifier: ${finalFdvModifier})`);
  }

  // Update the analysis with parsed results
  await storage.updateAnalysis(analysisId, {
    status: "completed",
    finalScore: cappedScore.toString(),
    tier: parsed.tier,
    tokenType: parsed.tokenType || 'UTILITY',
    phase: parsed.phase,
    phaseName: parsed.phaseName,
    narrative: parsed.narrative,
    narrativeHeat: parsed.narrativeHeat?.toString(),
    narrativeRank: parsed.narrativeRank,
    peakProximity: parsed.peakProximity?.toString(),
    winningSide: parsed.winningSide,
    consensusLevel: parsed.consensusLevel,
    confidence: parsed.confidence,
    thesis: parsed.thesis,
    catalyst1: parsed.catalyst1,
    catalyst2: parsed.catalyst2,
    catalyst3: parsed.catalyst3,
    risk1: parsed.risk1,
    risk2: parsed.risk2,
    risk3: parsed.risk3,
    xMentionsTrend: parsed.xMentionsTrend,
    xSentiment: parsed.xSentiment,
    xTopKols: parsed.xTopKols,
    communityStatus: parsed.communityStatus,
    accountQuality: parsed.accountQuality,
    // X Research qualitative fields
    engagementQuality: parsed.engagementQuality,
    overallSentiment: parsed.overallSentiment,
    cultVsMercenary: parsed.cultVsMercenary,
    // X Research flexible format fields
    sentimentBullishRatio: parsed.sentimentBullishRatio,
    sentimentBearishRatio: parsed.sentimentBearishRatio,
    sentimentNeutralRatio: parsed.sentimentNeutralRatio,
    likesPerPostAvg: parsed.likesPerPostAvg,
    retweetsPerPostAvg: parsed.retweetsPerPostAvg,
    repliesPerPostAvg: parsed.repliesPerPostAvg,
    cultMercenaryRatio: parsed.cultMercenaryRatio,
    sentimentSampleSize: parsed.sentimentSampleSize,
    unlockWarning: parsed.unlockWarning,
    teamStatus: parsed.teamStatus,
    notableBackers: parsed.notableBackers,
    coordinationScore: parsed.coordinationScore?.toString(),
    schellingRankScore: parsed.schellingRankScore?.toString(),
    schellingPosition: parsed.schellingPosition,
    reflexivityScore: parsed.reflexivityScore?.toString(),
    viralityScore: parsed.viralityScore?.toString(),
    asymmetryScore: parsed.asymmetryScore?.toString(),
    asymmetryFloor: parsed.asymmetryFloor,
    asymmetryCeiling: parsed.asymmetryCeiling,
    gameTheoryBonus: parsed.gameTheoryBonus?.toString(),
    phaseModifier: parsed.phaseModifier?.toString(),
    narrativeModifier: parsed.narrativeModifier?.toString(),
    exitLiquidityModifier: parsed.exitLiquidityModifier?.toString(),
    peakProximityModifier: parsed.peakProximityModifier?.toString(),
    dataQualityModifier: parsed.dataQualityModifier?.toString(),
    fdvModifier: finalFdvModifier.toString(),
    marketCapModifier: finalFdvModifier.toString(), // deprecated, keep for backward compat
    fdvTier: fdvTier,
    marketCapTier: fdvTier, // deprecated, keep for backward compat
    scoreCapped: scoreCapped,
    uncappedScore: uncappedScore.toString(),
    // Upside Assessment fields
    currentFdv: parsed.currentFdv,
    realisticPeakFdv: parsed.realisticPeakFdv,
    upsideMultiple: parsed.upsideMultiple,
    upsideTier: parsed.upsideTier,
    // New Stage 4 fields
    narrativeDurability: parsed.narrativeDurability,
    kolMentionRecency: parsed.kolMentionRecency,
    distributionWarning: parsed.distributionWarning,
    scoreCalculation: parsed.scoreCalculation,
    equilibriumType: parsed.equilibriumType,
    dominantStrategies: parsed.dominantStrategies,
    coordinationRisks: parsed.coordinationRisks,
    catalysts: parsed.catalysts,
    recommendation: parsed.recommendation,
    displaySummary: parsed.displaySummary,
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    modelScores: parsed.modelScores,
    modelAnalyses: parsed.modelAnalyses,
    // Model divergence metrics
    scoreSpread: parsed.scoreSpread?.toString(),
    divergenceFlag: parsed.divergenceFlag,
    divergenceNote: parsed.divergenceNote,
    rawGumloopResponse: rawResponseToSave,
    // Clear any previous error state on success
    errorMessage: null,
    errorCode: null,
  });

  // NOW charge the user - only on successful completion
  if (existingAnalysis?.userId && existingAnalysis?.chargeType) {
    await chargeForSuccessfulAnalysis(existingAnalysis.userId, existingAnalysis.chargeType as string);
    console.log(`Analysis ${analysisId}: Charged user ${existingAnalysis.userId} via ${existingAnalysis.chargeType}`);
  }

  // Publish completion event to Redis for real-time updates
  const { publishAnalysisComplete, invalidateCache, CACHE_KEYS } = await import("./redis");
  await publishAnalysisComplete(analysisId);
  await invalidateCache(CACHE_KEYS.ANALYSIS(analysisId));
  await invalidateCache(CACHE_KEYS.LEADERBOARD);

  // Update vote request if this token was voted for
  if (existingAnalysis?.tokenId) {
    const voteRequest = await storage.getVoteRequestByTokenId(existingAnalysis.tokenId);
    if (voteRequest && voteRequest.status === "pending") {
      await storage.updateVoteRequest(voteRequest.id, {
        status: "analyzed",
        analyzedAt: new Date(),
        analysisId: analysisId,
      });
      console.log(`Analysis ${analysisId}: Updated vote request ${voteRequest.id} to analyzed`);
    }
  }

  console.log(`Analysis ${analysisId}: Completed successfully`);
}

// Helper function to charge user on successful analysis completion
async function chargeForSuccessfulAnalysis(userId: string, chargeType: string): Promise<void> {
  const today = getESTDateString();

  switch (chargeType) {
    case "daily":
      await storage.incrementDailyUsage(userId, today);
      break;
    case "weekly":
      await storage.incrementWeeklyUsage(userId);
      break;
    case "monthly":
      await storage.incrementMonthlyUsage(userId);
      break;
    case "credit":
      await storage.useCredit(userId);
      break;
    default:
      console.warn(`Unknown chargeType: ${chargeType} for user ${userId}`);
  }
}

// ==================== ANALYSIS RECOVERY ====================
// Mark stuck analyses as failed on server startup
// Note: User-triggered analyses have been discontinued. This just cleans up any stuck analyses.

export async function recoverStuckAnalyses(): Promise<void> {
  try {
    // Find analyses stuck in processing/pending for more than 60 minutes
    const stuckAnalyses = await storage.getStuckAnalyses(60);

    if (stuckAnalyses.length === 0) {
      console.log("No stuck analyses to recover");
      return;
    }

    console.log(`Found ${stuckAnalyses.length} stuck analyses to mark as failed`);

    for (const analysis of stuckAnalyses) {
      const ageMinutes = Math.floor((Date.now() - analysis.createdAt.getTime()) / (1000 * 60));
      console.log(`Marking analysis ${analysis.id} (${analysis.tokenSymbol}) as failed, age: ${ageMinutes}min`);

      await storage.updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: "TIMEOUT",
        errorMessage: "Analysis timed out after extended processing.",
        displaySummary: "Analysis timed out.",
      });
    }

    console.log("Analysis recovery complete");
  } catch (error) {
    console.error("Error recovering stuck analyses:", error);
  }
}

// ==================== GUMLOOP SYNC ====================
// Fetch run status from Gumloop API and sync with local database

interface GumloopRunStatus {
  state: "STARTED" | "RUNNING" | "DONE" | "FAILED" | "TERMINATED" | "QUEUED";
  outputs?: Record<string, any>;
}

async function fetchGumloopRunStatus(runId: string): Promise<GumloopRunStatus | null> {
  const apiKey = process.env.GUMLOOP_API_KEY;
  const userId = process.env.GUMLOOP_USER_ID;

  if (!apiKey || !userId) {
    console.error("Gumloop sync: Missing API key or user ID");
    return null;
  }

  try {
    const url = new URL("https://api.gumloop.com/api/v1/get_pl_run");
    url.searchParams.set("run_id", runId);
    url.searchParams.set("user_id", userId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Gumloop sync: API error ${response.status} for run ${runId}`);
      return null;
    }

    const data = await response.json();
    return {
      state: data.state,
      outputs: data.outputs,
    };
  } catch (error) {
    console.error(`Gumloop sync: Fetch error for run ${runId}:`, error);
    return null;
  }
}

async function syncAnalysisWithGumloop(analysis: { id: number; gumloopRunId: string | null; tokenSymbol: string }): Promise<boolean> {
  if (!analysis.gumloopRunId) {
    console.log(`Gumloop sync: Analysis ${analysis.id} has no run ID, skipping`);
    return false;
  }

  const runStatus = await fetchGumloopRunStatus(analysis.gumloopRunId);
  if (!runStatus) {
    console.log(`Gumloop sync: Could not fetch status for analysis ${analysis.id}`);
    return false;
  }

  console.log(`Gumloop sync: Analysis ${analysis.id} (${analysis.tokenSymbol}) - Gumloop state: ${runStatus.state}`);

  if (runStatus.state === "DONE" && runStatus.outputs) {
    console.log(`Gumloop sync: Processing completion for analysis ${analysis.id}`);
    await processGumloopCompletion(analysis.id, runStatus.outputs);
    return true;
  } else if (runStatus.state === "FAILED" || runStatus.state === "TERMINATED") {
    console.log(`Gumloop sync: Marking analysis ${analysis.id} as failed (${runStatus.state})`);
    await storage.updateAnalysis(analysis.id, {
      status: "failed",
      errorCode: runStatus.state === "FAILED" ? "PIPELINE_ERROR" : "TERMINATED",
      errorMessage: `Analysis pipeline ${runStatus.state.toLowerCase()}. Synced from Gumloop.`,
      displaySummary: `Analysis ${runStatus.state.toLowerCase()}.`,
    });
    return true;
  }

  // Still running or queued - no action needed
  return false;
}

export async function syncStuckAnalysesWithGumloop(): Promise<{ synced: number; checked: number }> {
  try {
    // Get analyses stuck for more than 5 minutes that have a gumloopRunId
    const stuckAnalyses = await storage.getStuckAnalysesWithRunId(5);

    if (stuckAnalyses.length === 0) {
      console.log("Gumloop sync: No stuck analyses to check");
      return { synced: 0, checked: 0 };
    }

    console.log(`Gumloop sync: Checking ${stuckAnalyses.length} stuck analyses`);

    let synced = 0;
    for (const analysis of stuckAnalyses) {
      const wasSynced = await syncAnalysisWithGumloop(analysis);
      if (wasSynced) synced++;

      // Small delay between API calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Gumloop sync: Synced ${synced}/${stuckAnalyses.length} analyses`);
    return { synced, checked: stuckAnalyses.length };
  } catch (error) {
    console.error("Gumloop sync: Error syncing stuck analyses:", error);
    return { synced: 0, checked: 0 };
  }
}

// Background polling interval (runs every 2 minutes)
let gumloopSyncInterval: NodeJS.Timeout | null = null;

export function startGumloopSyncPolling(): void {
  if (gumloopSyncInterval) {
    console.log("Gumloop sync: Polling already running");
    return;
  }

  const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  console.log("Gumloop sync: Starting background polling (every 2 minutes)");

  gumloopSyncInterval = setInterval(async () => {
    try {
      await syncStuckAnalysesWithGumloop();
    } catch (error) {
      console.error("Gumloop sync: Background polling error:", error);
    }
  }, SYNC_INTERVAL_MS);

  // Also run immediately on startup
  syncStuckAnalysesWithGumloop().catch((error) => {
    console.error("Gumloop sync: Initial sync error:", error);
  });
}

export function stopGumloopSyncPolling(): void {
  if (gumloopSyncInterval) {
    clearInterval(gumloopSyncInterval);
    gumloopSyncInterval = null;
    console.log("Gumloop sync: Stopped background polling");
  }
}
