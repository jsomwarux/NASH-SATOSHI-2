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
  useVerifyCheckout,
} from "@/hooks/useSubscription";

const TIER_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  pro: Crown,
  premium: Rocket,
};

const TIER_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  free: { border: "border-primary/30", bg: "bg-primary/5", icon: "text-primary" },
  pro: { border: "border-accent/50", bg: "bg-accent/10", icon: "text-accent" },
  premium: { border: "border-purple-500/30", bg: "bg-purple-500/10", icon: "text-purple-400" },
};

// Tier order for comparison (0 = lowest, 2 = highest)
const TIER_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

// Shared features for all plans
const SHARED_FEATURES = [
  { icon: Search, text: "Unlimited token search" },
  { icon: FileText, text: "Full game-theory scorecards" },
  { icon: Globe, text: "7D/30D rolling averages" },
  { icon: BarChart3, text: "Vote for token analysis" },
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
  const verifyCheckout = useVerifyCheckout();
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Track if we've already processed the checkout to prevent double-processing
  const [checkoutProcessed, setCheckoutProcessed] = useState(false);

  // Verify and sync subscription when returning from Stripe checkout or after upgrade
  useEffect(() => {
    // Only run once and only when we have the necessary conditions
    if (checkoutProcessed) return;

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const subscriptionCanceled = urlParams.get("subscription") === "canceled";
    const subscriptionUpgraded = urlParams.get("subscription") === "upgraded";
    const upgradedTier = urlParams.get("tier");

    // Handle canceled checkouts
    if (subscriptionCanceled) {
      setCheckoutProcessed(true);
      toast({
        title: "Checkout canceled",
        description: "No changes were made to your subscription.",
        variant: "destructive",
      });
      navigate("/pricing", { replace: true });
      return;
    }

    // Handle direct subscription upgrade/downgrade (no Stripe checkout needed)
    if (subscriptionUpgraded && upgradedTier && user) {
      setCheckoutProcessed(true);
      toast({
        title: "Subscription updated!",
        description: `You're now on the ${upgradedTier.charAt(0).toUpperCase()}${upgradedTier.slice(1)} plan.`,
      });
      // Refetch subscription status to update UI
      queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
      navigate("/pricing", { replace: true });
      return;
    }

    // Handle successful subscription checkout - need user to be logged in
    if (sessionId && user) {
      setCheckoutProcessed(true);

      // Verify the checkout session and sync subscription
      verifyCheckout.mutateAsync(sessionId)
        .then((result) => {
          if (result.success) {
            toast({
              title: "Subscription activated!",
              description: `You're now on the ${result.tier?.charAt(0).toUpperCase()}${result.tier?.slice(1)} plan.`,
            });
          }
        })
        .catch((error) => {
          console.error("Failed to verify checkout:", error);
        })
        .finally(() => {
          navigate("/pricing", { replace: true });
        });
    }
  }, [user]); // Only depend on user - other deps are stable or handled via state

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
              Access 4-LLM consensus scorecards and vote for token analysis.
              Free users can view top 10 rankings.
            </p>
          </div>
        </motion.div>

        {/* Current Plan Banner */}
        {status && status.tier !== "free" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-4 rounded border border-green-500/30 bg-green-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-mono font-bold text-green-400 text-sm sm:text-base">
                  ACTIVE: {status.tierName.toUpperCase()} PLAN
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                  Full rankings access + unlimited scorecards
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={createPortal.isPending}
              className="font-mono w-full sm:w-auto"
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
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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

                  {/* Access Info - Big & Prominent */}
                  <div className="text-center py-4 mb-3 rounded bg-black/30 border border-white/5">
                    {tier.id === "free" ? (
                      <>
                        <p className="text-lg font-bold font-mono text-primary">TOP 10</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          rankings + scorecards
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                          1 vote per day • no search/filter/sort
                        </p>
                      </>
                    ) : tier.id === "pro" ? (
                      <>
                        <p className="text-lg font-bold font-mono text-primary">FULL ACCESS</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          all rankings + search, filter & sort
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                          5 votes per day
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold font-mono text-primary">FULL ACCESS</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          + priority votes (2x weight)
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                          15 votes per day + search, filter & sort
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
                q: "How does the scoring system work?",
                a: "Each token is analyzed by 4 independent LLMs (GPT, Claude, Gemini, Grok) using game theory principles. The final score (0-100) is a weighted consensus. 70+ = BUY, 40-69 = HOLD, <40 = SELL.",
              },
              {
                q: "What data sources are used?",
                a: "We pull real-time data from CoinGecko (price, volume, market cap), on-chain metrics, tokenomics, and social signals. Each analysis reflects current market conditions.",
              },
              {
                q: "How accurate are the scores?",
                a: "We track 7-day and 30-day returns for all analyzed tokens. Performance metrics are displayed on the rankings page so you can verify our track record yourself.",
              },
              {
                q: "What do free users get?",
                a: "Access to top 10 ranked tokens with full scorecards. Upgrade to unlock the complete rankings with search, filter, and sort by score, tier, or volume.",
              },
              {
                q: "How does voting work?",
                a: "Vote for tokens you want analyzed. Top-voted tokens get processed by our 4-LLM engine. Premium votes count 2x, helping your picks get analyzed faster.",
              },
              {
                q: "When do votes reset?",
                a: "Daily vote limits reset at midnight EST. Free users get 1 vote/day, Pro gets 5, and Premium gets 15 with 2x weight.",
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
