import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Crown,
  Calendar,
  CreditCard,
  ExternalLink,
  Loader2,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubscriptionStatus,
  useCreateBillingPortal,
  useSyncSubscription,
} from "@/hooks/useSubscription";
import { SUBSCRIPTION_TIERS } from "@shared/schema";

export default function Account() {
  const { user, signOut, isConfigured } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { data: status, isLoading } = useSubscriptionStatus();
  const createPortal = useCreateBillingPortal();
  const syncSubscription = useSyncSubscription();
  const [syncProcessed, setSyncProcessed] = useState(false);

  // Sync subscription when returning from billing portal
  useEffect(() => {
    if (syncProcessed) return;

    const urlParams = new URLSearchParams(window.location.search);
    const shouldSync = urlParams.get("sync") === "true";

    if (shouldSync && user) {
      setSyncProcessed(true);

      syncSubscription.mutateAsync()
        .then((result) => {
          if (result.success) {
            toast({
              title: "Subscription updated",
              description: `Your subscription has been synced. Current plan: ${result.tier?.charAt(0).toUpperCase()}${result.tier?.slice(1)}`,
            });
          }
        })
        .catch((error) => {
          console.error("Failed to sync subscription:", error);
        })
        .finally(() => {
          navigate("/account", { replace: true });
        });
    }
  }, [user]);

  const handleManageBilling = async () => {
    try {
      const { url } = await createPortal.mutateAsync();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      const result = await syncSubscription.mutateAsync();
      if (result.success) {
        toast({
          title: "Subscription synced",
          description: `Current plan: ${result.tier?.charAt(0).toUpperCase()}${result.tier?.slice(1)}`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: result.message || "Could not sync subscription status.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Sync failed",
        description: error?.message || "Could not sync subscription status.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  // Calculate votes remaining (fallback calculation if field is missing)
  const getVotesRemaining = () => {
    if (typeof status?.votesRemaining === 'number') {
      return status.votesRemaining;
    }
    // Fallback: calculate from votesPerDay - votesUsedToday
    const perDay = status?.votesPerDay ?? 0;
    const used = status?.votesUsedToday ?? 0;
    return Math.max(0, perDay - used);
  };

  // Calculate vote remaining percentage (for progress bar)
  const getVoteRemainingPercentage = () => {
    const perDay = status?.votesPerDay ?? 0;
    if (perDay <= 0) return 0;
    const remaining = getVotesRemaining();
    return Math.min((remaining / perDay) * 100, 100);
  };

  // Get tier color
  const getTierColor = (tierId: string) => {
    const colors: Record<string, string> = {
      free: "text-primary border-primary/30 bg-primary/10",
      starter: "text-blue-400 border-blue-500/30 bg-blue-500/10",
      trader: "text-accent border-accent/30 bg-accent/10",
      pro: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      desk: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    };
    return colors[tierId] || colors.free;
  };

  if (!isConfigured) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Authentication Not Configured</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Please configure Supabase to enable account features.
          </p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Sign In Required</h1>
          <p className="text-muted-foreground font-mono text-sm mb-6">
            Please sign in to view your account.
          </p>
          <Link href="/">
            <Button className="font-mono">GO TO HOME</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
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

          <h1 className="text-3xl font-display font-bold">
            <span className="text-glow-cyan">YOUR</span>{" "}
            <span className="text-accent">ACCOUNT</span>
          </h1>
        </motion.div>

        {/* Account Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 p-6 rounded-lg border border-primary/20 bg-primary/5 cyber-card"
        >
          <h2 className="text-sm font-mono font-bold text-primary tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            ACCOUNT INFO
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm text-muted-foreground">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Subscription Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 p-6 rounded-lg border border-accent/20 bg-accent/5 cyber-card"
        >
          <h2 className="text-sm font-mono font-bold text-accent tracking-wider mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            SUBSCRIPTION
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : status ? (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-1">CURRENT PLAN</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-display font-bold">
                      {status.tierName}
                    </span>
                    <Badge className={getTierColor(status.tier)}>
                      {status.isSubscribed ? "ACTIVE" : status.tier === "free" ? "FREE" : "INACTIVE"}
                    </Badge>
                  </div>
                </div>
                {status.isSubscribed && status.subscription?.currentPeriodEnd && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-mono mb-1">RENEWS</p>
                    <p className="font-mono text-sm">
                      {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Votes Remaining */}
              <div className="p-4 rounded bg-black/30 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    VOTES REMAINING
                  </span>
                  <span className="text-sm font-mono font-bold">
                    {getVotesRemaining()} / {status.votesPerDay ?? 0}
                  </span>
                </div>
                <Progress
                  value={getVoteRemainingPercentage()}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground font-mono mt-2">
                  {(status.votesUsedToday ?? 0) > 0 && (
                    <span>{status.votesUsedToday} vote{status.votesUsedToday !== 1 ? 's' : ''} used today • </span>
                  )}
                  Resets at midnight EST
                  {status.priorityVotes && (
                    <span className="text-purple-400 ml-2">• Priority (2x weight)</span>
                  )}
                </p>
              </div>

              {/* Plan Benefits - Only show for paid users */}
              {status.tier !== 'free' && (
                <div className="p-4 rounded bg-black/30 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-mono text-muted-foreground">
                      PLAN BENEFITS
                    </span>
                  </div>
                  <ul className="text-sm font-mono space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Unlimited leaderboard access
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Unlimited scorecard views
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Full search, filter & sort
                    </li>
                    {status.priorityVotes && (
                      <li className="flex items-center gap-2">
                        <span className="text-purple-400">★</span> <span className="text-purple-400">Priority votes (2x weight)</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Subscription Status Details */}
              {status.subscription?.cancelAtPeriodEnd && (
                <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-mono text-sm">
                      Subscription will cancel at end of billing period
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {status.isSubscribed ? (
                  <Button
                    variant="outline"
                    className="flex-1 font-mono"
                    onClick={handleManageBilling}
                    disabled={createPortal.isPending}
                  >
                    {createPortal.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        MANAGE BILLING
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Link href="/pricing" className="flex-1">
                    <Button className="w-full font-mono">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      UPGRADE PLAN
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  className="font-mono"
                  onClick={handleSyncSubscription}
                  disabled={syncSubscription.isPending}
                  title="Refresh subscription status from Stripe"
                >
                  {syncSubscription.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
                <Link href="/pricing">
                  <Button variant="ghost" className="font-mono">
                    VIEW ALL PLANS
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-mono text-sm">Unable to load subscription info</p>
            </div>
          )}
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-lg border border-red-500/20 bg-red-500/5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono font-bold text-sm mb-1">Sign Out</h3>
              <p className="text-xs text-muted-foreground font-mono">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="outline"
              className="font-mono text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              SIGN OUT
            </Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
