import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Rocket,
  Share2,
  Users,
  Copy,
  Twitter,
  Gift,
  Zap,
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
import {
  getReferralCode,
  getReferralStats,
  getShareStats,
  createTwitterShare,
  verifyShare,
} from "@/lib/api";
import { SUBSCRIPTION_TIERS, REFERRAL_TIERS } from "@shared/schema";

export default function Account() {
  const { user, signOut, isConfigured, getAccessToken } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useSubscriptionStatus();
  const createPortal = useCreateBillingPortal();
  const syncSubscription = useSyncSubscription();
  const [syncProcessed, setSyncProcessed] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<number | null>(null);

  // Fetch referral code and stats
  const { data: referralData, isLoading: loadingReferral } = useQuery({
    queryKey: ["referralCode"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      return getReferralCode(token);
    },
    enabled: !!user,
  });

  const { data: referralStats } = useQuery({
    queryKey: ["referralStats"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      return getReferralStats(token);
    },
    enabled: !!user,
  });

  const { data: shareStats } = useQuery({
    queryKey: ["shareStats"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      return getShareStats(token);
    },
    enabled: !!user,
  });

  // Handle share to Twitter - must open window synchronously to avoid popup blocker
  const handleShareToTwitter = async () => {
    const shareText = `The first-ever crypto game theory rankings. It has GPT-5.5, Opus 4.7, Gemini 3.1 Pro, and Grok 4 work together and cross check each other with a focus on game theory positioning to produce an overall score for each coin. Check it out.`;
    const shareUrl = referralData?.referralUrl || window.location.origin;

    // Build Twitter intent URL
    const params = new URLSearchParams();
    params.set("text", shareText);
    params.set("url", shareUrl);
    const twitterIntentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;

    // Open Twitter window FIRST (synchronously) to avoid popup blocker
    window.open(twitterIntentUrl, "_blank", "width=550,height=420");

    // Then track the share in the background
    try {
      const token = await getAccessToken();
      if (token) {
        const result = await createTwitterShare({ text: shareText, url: shareUrl }, token);
        setPendingShareId(result.shareId);
      }
    } catch (error) {
      console.error("Failed to track share:", error);
    }
  };

  // Verify share mutation
  const verifyMutation = useMutation({
    mutationFn: async (shareId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      return verifyShare(shareId, token);
    },
    onSuccess: (data) => {
      setPendingShareId(null);
      queryClient.invalidateQueries({ queryKey: ["shareStats"] });
      toast({
        title: data.isPrioritySharer ? "Priority Status Unlocked!" : "Share Verified!",
        description: data.message,
      });
    },
  });

  const copyReferralLink = () => {
    if (referralData?.referralUrl) {
      navigator.clipboard.writeText(referralData.referralUrl);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  // Handle hash scrolling on mount (for deep links like #priority-queue)
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, []);

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
      beta_free: "text-green-400 border-green-500/30 bg-green-500/10",
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-1">CURRENT PLAN</p>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xl sm:text-2xl font-display font-bold">
                      {status.tierName}
                    </span>
                    <Badge className={getTierColor(status.tier)}>
                      {status.isBeta ? "BETA" : status.isSubscribed ? "ACTIVE" : status.tier === "free" ? "FREE" : "INACTIVE"}
                    </Badge>
                  </div>
                </div>
                {status.isSubscribed && status.subscription?.currentPeriodEnd && !status.isBeta && (
                  <div className="sm:text-right">
                    <p className="text-xs text-muted-foreground font-mono mb-1">RENEWS</p>
                    <p className="font-mono text-sm">
                      {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Beta Access Message */}
              {status.isBeta && (
                <div className="p-3 sm:p-4 rounded bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-mono font-bold text-sm sm:text-base">FULL BETA ACCESS</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                    You have full platform access during our beta period. Premium tiers coming soon.
                  </p>
                </div>
              )}

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

              {/* Plan Benefits - Show for paid users and beta users */}
              {(status.tier !== 'free' || status.isBeta) && (
                <div className="p-4 rounded bg-black/30 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {status.isBeta ? 'BETA BENEFITS' : 'PLAN BENEFITS'}
                    </span>
                  </div>
                  <ul className="text-sm font-mono space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> Unlimited rankings access
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
                    {status.isBeta && (
                      <li className="flex items-center gap-2">
                        <span className="text-primary">•</span> 1 vote per day during beta
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
                {status.isBeta ? (
                  // During beta, no billing or upgrade options
                  <div className="flex-1 text-center text-muted-foreground font-mono text-sm py-2">
                    Premium tiers launching soon
                  </div>
                ) : status.isSubscribed ? (
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
                {!status.isBeta && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-mono text-sm">Unable to load subscription info</p>
            </div>
          )}
        </motion.div>

        {/* Share & Earn Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 p-6 rounded-lg border border-purple-500/20 bg-purple-500/5 cyber-card"
        >
          <h2 className="text-sm font-mono font-bold text-purple-400 tracking-wider mb-4 flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            SHARE & EARN
          </h2>

          <div className="space-y-6">
            {/* Priority Status */}
            <div id="priority-queue" className="p-4 rounded bg-black/30 border border-white/5 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span className="font-mono font-bold">Priority Analysis Queue</span>
                </div>
                {shareStats?.isPrioritySharer ? (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    LOCKED
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-3">
                {shareStats?.isPrioritySharer
                  ? "Your votes count as Priority votes - your token requests jump the queue!"
                  : "Share on Twitter to unlock Priority status. Your votes will count 2x in the analysis queue."}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-muted-foreground">Verified Shares</span>
                    <span>{shareStats?.verifiedShares || 0} / 1</span>
                  </div>
                  <Progress
                    value={Math.min(100, (shareStats?.verifiedShares || 0) * 100)}
                    className="h-2"
                  />
                </div>
                {!shareStats?.isPrioritySharer && (
                  <Button
                    size="sm"
                    onClick={handleShareToTwitter}
                    className="bg-[#1DA1F2] hover:bg-[#1a8cd8] font-mono"
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                )}
              </div>
              {pendingShareId && (
                <div className="mt-3 p-3 rounded bg-blue-500/10 border border-blue-500/30">
                  <p className="text-xs text-blue-400 font-mono mb-2">
                    Posted your tweet? Click below to verify and unlock Priority status:
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyMutation.mutate(pendingShareId)}
                    disabled={verifyMutation.isPending}
                    className="border-blue-500/30 text-blue-400"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    I Posted It
                  </Button>
                </div>
              )}
            </div>

            {/* Referral Program */}
            <div id="referral-program" className="p-4 rounded bg-black/30 border border-white/5 scroll-mt-24">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-green-400" />
                <span className="font-mono font-bold">Referral Program</span>
                <Badge variant="outline" className="text-xs text-muted-foreground ml-auto">
                  BETA
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Invite friends and earn rewards when we launch paid tiers. Track your referrals below.
              </p>

              {/* Referral Link */}
              {loadingReferral ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : referralData ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralData.referralUrl}
                      className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded font-mono text-xs text-muted-foreground"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyReferralLink}
                      className="font-mono"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Referral Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded bg-black/30">
                      <p className="text-lg font-bold font-mono text-green-400">
                        {referralData.stats.totalVisits}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">Clicks</p>
                    </div>
                    <div className="text-center p-3 rounded bg-black/30">
                      <p className="text-lg font-bold font-mono text-blue-400">
                        {referralData.stats.returningVisitors}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">Returning</p>
                    </div>
                    <div className="text-center p-3 rounded bg-black/30">
                      <p className="text-lg font-bold font-mono text-purple-400">
                        {referralData.stats.conversions}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">Sign-ups</p>
                    </div>
                  </div>

                  {/* Tier Progress */}
                  {referralStats && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-mono">REWARD TIERS (when paid plans launch)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(REFERRAL_TIERS).map(([tier, config]) => {
                          const progress = referralStats.tierProgress[tier as keyof typeof REFERRAL_TIERS];
                          const isUnlocked = progress?.unlocked;
                          return (
                            <div
                              key={tier}
                              className={`p-2 rounded border ${
                                isUnlocked
                                  ? "border-green-500/30 bg-green-500/10"
                                  : "border-white/5 bg-black/30"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono font-bold capitalize">
                                  {tier}
                                </span>
                                {isUnlocked && (
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {config.minReferrals} referrals = {config.reward}
                              </p>
                              <Progress
                                value={Math.min(100, (progress?.current || 0) / config.minReferrals * 100)}
                                className="h-1 mt-1"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono text-center py-4">
                  Unable to load referral data
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
