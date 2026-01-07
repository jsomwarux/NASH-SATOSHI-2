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
      const returnUrl = `${baseUrl}/account`;

      const portalUrl = await createBillingPortalSession(userId, returnUrl);

      res.json({ url: portalUrl });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
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

  return httpServer;
}
