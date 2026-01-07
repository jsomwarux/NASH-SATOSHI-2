import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Zap,
  Crown,
  Rocket,
  Loader2,
  ExternalLink,
  AlertCircle,
  TrendingUp,
  Building2,
  Coins,
  BarChart3,
  Search,
  FileText,
  Globe,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  useSubscriptionTiers,
  useSubscriptionStatus,
  useCreateCheckout,
  useCreateBillingPortal,
} from "@/hooks/useSubscription";
import { CREDIT_PACKS } from "@shared/schema";

const TIER_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  starter: TrendingUp,
  trader: Rocket,
  pro: Crown,
  desk: Building2,
};

const TIER_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  free: { border: "border-primary/30", bg: "bg-primary/5", icon: "text-primary" },
  starter: { border: "border-blue-500/30", bg: "bg-blue-500/5", icon: "text-blue-400" },
  trader: { border: "border-accent/50", bg: "bg-accent/10", icon: "text-accent" },
  pro: { border: "border-purple-500/30", bg: "bg-purple-500/10", icon: "text-purple-400" },
  desk: { border: "border-amber-500/50", bg: "bg-amber-500/10", icon: "text-amber-400" },
};

// Tier order for comparison (0 = lowest, 4 = highest)
const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  trader: 2,
  pro: 3,
  desk: 4,
};

// Shared features for all plans
const SHARED_FEATURES = [
  { icon: BarChart3, text: "Full community leaderboard access" },
  { icon: Search, text: "Unlimited token search" },
  { icon: FileText, text: "Full game-theory report with sources" },
  { icon: Globe, text: "7D/30D rolling averages on leaderboard" },
];

export default function Pricing() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tiersData, isLoading: tiersLoading } = useSubscriptionTiers();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useSubscriptionStatus();
  const createCheckout = useCreateCheckout();
  const createPortal = useCreateBillingPortal();
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Invalidate subscription status when returning from Stripe checkout
  useEffect(() => {
    if (location.includes("subscription/success") || location.includes("session_id")) {
      // Invalidate and refetch subscription status
      queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
      refetchStatus();
      // Redirect to clean URL
      navigate("/pricing", { replace: true });
    }
  }, [location, queryClient, refetchStatus, navigate]);

  const handleSubscribe = async (tierId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setProcessingTier(tierId);
    try {
      const { url } = await createCheckout.mutateAsync(tierId);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setProcessingTier(null);
    }
  };

  const handleStartFree = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      navigate("/");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { url } = await createPortal.mutateAsync();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  };

  const isLoading = tiersLoading || statusLoading;
  const tiers = tiersData?.tiers || [];
  const stripeConfigured = tiersData?.stripeConfigured ?? false;
  const currentTier = status?.tier || "free";

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 mb-4 font-mono text-xs tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK
            </Button>
          </Link>

          <div className="text-center">
            <h1 className="text-4xl font-display font-bold mb-4">
              <span className="text-glow-cyan">CHOOSE</span>{" "}
              <span className="text-accent">YOUR PLAN</span>
            </h1>
            <p className="text-muted-foreground font-mono text-sm max-w-2xl mx-auto">
              Run game-theory token analyses powered by our 4-LLM consensus engine.
              Leaderboard access is free for everyone.
            </p>
          </div>
        </motion.div>

        {/* Current Plan Banner */}
        {status && status.tier !== "free" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-4 rounded border border-green-500/30 bg-green-500/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-mono font-bold text-green-400">
                  ACTIVE: {status.tierName.toUpperCase()} PLAN
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {status.monthlyUsed} / {status.monthlyLimit} analyses used this month
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={createPortal.isPending}
              className="font-mono"
            >
              {createPortal.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  MANAGE <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Stripe Not Configured Warning */}
        {!stripeConfigured && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded border border-amber-500/30 bg-amber-500/10 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-200 font-mono">
              Payment processing is not yet configured. Paid plans coming soon.
            </p>
          </motion.div>
        )}

        {/* Pricing Cards */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tiers.map((tier, index) => {
              const Icon = TIER_ICONS[tier.id] || Zap;
              const isCurrentPlan = tier.id === currentTier;
              const isPopular = tier.popular;
              const colors = TIER_COLORS[tier.id] || TIER_COLORS.free;

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  className={`relative rounded-lg border p-5 cyber-card flex flex-col ${colors.border} ${colors.bg} ${
                    isPopular ? "ring-2 ring-accent/30 scale-[1.02]" : ""
                  }`}
                >
                  {/* Badges - positioned inside card */}
                  {(isPopular || isCurrentPlan) && (
                    <div className="flex gap-2 mb-3 -mt-1">
                      {isPopular && (
                        <Badge className="bg-accent text-accent-foreground font-mono tracking-wider text-[10px]">
                          MOST POPULAR
                        </Badge>
                      )}
                      {isCurrentPlan && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-[10px]"
                        >
                          CURRENT
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Tier Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-black/20 border border-white/10 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold">{tier.name}</h2>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono">${tier.price}</span>
                        {tier.price > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">/mo</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Analysis Count - Big & Prominent */}
                  <div className="text-center py-4 mb-3 rounded bg-black/30 border border-white/5">
                    {tier.id === "free" ? (
                      <>
                        <p className="text-lg font-bold font-mono text-primary">FREE TRIAL</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          1/day for 7 days, then 1/week
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-bold font-mono text-primary">
                          {tier.analysesPerMonth}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          analyses / month
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                          Resets monthly
                        </p>
                      </>
                    )}
                  </div>

                  {/* Tagline */}
                  <p className="text-xs text-muted-foreground font-mono mb-4 min-h-[2.5rem]">
                    {(tier as any).tagline || tier.features[0]}
                  </p>

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1" />

                  {/* CTA Button */}
                  <div>
                    {(() => {
                      const tierOrder = TIER_ORDER[tier.id] ?? 0;
                      const currentTierOrder = TIER_ORDER[currentTier] ?? 0;
                      const isUpgrade = tierOrder > currentTierOrder;
                      const isDowngrade = tierOrder < currentTierOrder;

                      if (tier.id === "free") {
                        return (
                          <Button
                            variant="outline"
                            className={`w-full font-mono text-sm ${isCurrentPlan ? "border-green-500/30 text-green-400" : ""}`}
                            onClick={isCurrentPlan ? undefined : handleStartFree}
                            disabled={isCurrentPlan}
                          >
                            {isCurrentPlan ? "CURRENT PLAN" : user ? "START FREE" : "CREATE ACCOUNT"}
                          </Button>
                        );
                      }

                      if (isCurrentPlan) {
                        return (
                          <Button
                            variant="outline"
                            className="w-full font-mono text-sm border-green-500/30 text-green-400"
                            onClick={handleManageSubscription}
                            disabled={createPortal.isPending}
                          >
                            {createPortal.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "CURRENT PLAN"
                            )}
                          </Button>
                        );
                      }

                      if (isDowngrade) {
                        return (
                          <Button
                            variant="outline"
                            className="w-full font-mono text-sm opacity-50"
                            onClick={handleManageSubscription}
                            disabled={createPortal.isPending}
                          >
                            {createPortal.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "DOWNGRADE"
                            )}
                          </Button>
                        );
                      }

                      // Upgrade case
                      return (
                        <Button
                          className={`w-full font-mono text-sm ${isPopular ? "neon-button" : ""}`}
                          onClick={() => handleSubscribe(tier.id)}
                          disabled={processingTier === tier.id || !stripeConfigured || !tier.priceId}
                        >
                          {processingTier === tier.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : !stripeConfigured ? (
                            "COMING SOON"
                          ) : status?.isSubscribed ? (
                            "UPGRADE"
                          ) : (
                            "SUBSCRIBE"
                          )}
                        </Button>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Included in Every Plan Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 rounded-lg border border-primary/20 bg-primary/5"
        >
          <h3 className="text-center font-mono font-bold text-primary tracking-wider mb-6">
            INCLUDED IN EVERY PLAN
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHARED_FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded bg-black/20">
                <feature.icon className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm font-mono text-foreground/80">{feature.text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Credit Packs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-bold mb-2">
              <span className="text-primary">CREDIT</span>{" "}
              <span className="text-accent">TOP-UPS</span>
            </h2>
            <p className="text-muted-foreground font-mono text-sm">
              Need more analyses? Buy credit packs that never expire.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {Object.values(CREDIT_PACKS).map((pack, index) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className={`relative rounded-lg border p-6 cyber-card ${
                  pack.popular
                    ? "border-accent/50 bg-accent/10 ring-2 ring-accent/20"
                    : "border-primary/30 bg-primary/5"
                }`}
              >
                {pack.popular && (
                  <div className="mb-3">
                    <Badge className="bg-accent text-accent-foreground font-mono tracking-wider text-[10px]">
                      BEST VALUE
                    </Badge>
                  </div>
                )}
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                    <Coins className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-1">
                    {pack.credits} Credits
                  </h3>
                  <p className="text-2xl font-bold font-mono text-accent mb-1">
                    ${pack.price}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mb-4">
                    ${(pack.price / pack.credits).toFixed(2)} per analysis
                  </p>
                  <Button
                    variant={pack.popular ? "default" : "outline"}
                    className="w-full font-mono"
                    disabled={!stripeConfigured}
                  >
                    {stripeConfigured ? "BUY NOW" : "COMING SOON"}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16"
        >
          <h2 className="text-2xl font-display font-bold text-center mb-8">
            FREQUENTLY ASKED QUESTIONS
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: "When does my free trial start?",
                a: "Your 7-day trial starts when you run your first analysis, not when you sign up. Browse the leaderboard as long as you want before committing.",
              },
              {
                q: "How does the analysis work?",
                a: "Each analysis runs through our 4-LLM consensus engine (GPT, Claude, Gemini, Grok) to provide game-theory based token ratings.",
              },
              {
                q: "Can I upgrade or downgrade anytime?",
                a: "Yes! You can change your plan at any time. Upgrades take effect immediately, downgrades at period end.",
              },
              {
                q: "Do unused analyses roll over?",
                a: "No, monthly analyses reset each billing cycle. Buy credit packs if you need analyses that never expire.",
              },
              {
                q: "Is the leaderboard really free?",
                a: "Yes! All users get full leaderboard access including 7D/30D averages. It's our way of helping everyone discover promising tokens.",
              },
              {
                q: "How long does an analysis take?",
                a: "Most analyses complete in 15-30 minutes. Our 4-LLM ensemble runs comprehensive game-theory scoring for maximum accuracy.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="p-4 rounded border border-primary/20 cyber-card"
              >
                <h3 className="font-mono font-bold text-primary mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground font-mono">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        promptMessage="Create an account to run analyses"
      />
    </Layout>
  );
}
