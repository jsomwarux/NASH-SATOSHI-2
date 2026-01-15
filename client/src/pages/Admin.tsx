import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Shield,
  Search,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  History,
  AlertTriangle,
  Filter,
  X,
  Scan,
  Vote,
  TrendingUp,
  ArrowRight,
  Trophy,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { TokenSearch } from "@/components/search/TokenSearch";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAdminStatus,
  getAdminLeaderboard,
  getAdminAnalyses,
  adminStartAnalysis,
  adminSyncGumloop,
  adminCollectPerformance,
  adminReprocessAnalysis,
  adminRecoverAnalysis,
  getTopVoteRequests,
  getRecentlyAnalyzedRequests,
  getYesterdayTopVote,
  type AdminAnalyzeRequest,
  type VoteRequest,
  type YesterdayTopVote,
} from "@/lib/api";
import type { TokenSearchResult, TokenAnalysis, LeaderboardFilters } from "@shared/schema";

function getTierColor(tier: string | null): string {
  switch (tier?.toUpperCase()) {
    case "S+": return "text-amber-400 bg-amber-500/20";
    case "S": return "text-green-400 bg-green-500/20";
    case "A": return "text-emerald-400 bg-emerald-500/20";
    case "B": return "text-yellow-400 bg-yellow-500/20";
    case "C": return "text-red-400 bg-red-500/20";
    default: return "text-gray-400 bg-gray-500/20";
  }
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "completed": return { bg: "bg-green-500/20", text: "text-green-400" };
    case "processing": return { bg: "bg-blue-500/20", text: "text-blue-400" };
    case "pending": return { bg: "bg-yellow-500/20", text: "text-yellow-400" };
    case "failed": return { bg: "bg-red-500/20", text: "text-red-400" };
    default: return { bg: "bg-gray-500/20", text: "text-gray-400" };
  }
}

type SortField = "latestScore" | "scoreTrend" | "latestAnalysis" | "tier" | "tokenType" | "asymmetryScore" | "upsideTier";

export default function Admin() {
  const { user, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState("analyze");
  const [sortBy, setSortBy] = useState<SortField>("latestScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<LeaderboardFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Build active filters
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchQuery || undefined,
  }), [filters, searchQuery]);

  const hasActiveFilters = Object.values(filters).some(v => v) || searchQuery;

  const clearFilters = () => {
    setFilters({});
    setSearchQuery("");
  };

  // Check admin status
  const { data: adminStatus, isLoading: checkingAdmin } = useQuery({
    queryKey: ["adminStatus", user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      return getAdminStatus(token || undefined);
    },
    enabled: !!user,
  });

  // Get admin leaderboard
  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["adminLeaderboard", sortBy, sortOrder, activeFilters],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No auth token");
      return getAdminLeaderboard({
        sortBy,
        order: sortOrder,
        filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
      }, token);
    },
    enabled: !!adminStatus?.isAdmin,
  });

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Get all analyses
  const { data: analyses, isLoading: loadingAnalyses } = useQuery({
    queryKey: ["adminAnalyses"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("No auth token");
      return getAdminAnalyses({}, token);
    },
    enabled: !!adminStatus?.isAdmin,
  });

  // Get vote queue data
  const { data: pendingVotes, isLoading: loadingPendingVotes } = useQuery({
    queryKey: ["adminPendingVotes"],
    queryFn: () => getTopVoteRequests(50),
    enabled: !!adminStatus?.isAdmin,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: analyzedVotes, isLoading: loadingAnalyzedVotes } = useQuery({
    queryKey: ["adminAnalyzedVotes"],
    queryFn: () => getRecentlyAnalyzedRequests(20),
    enabled: !!adminStatus?.isAdmin,
  });

  // Get yesterday's top voted token
  const { data: yesterdayTop, isLoading: loadingYesterdayTop } = useQuery({
    queryKey: ["adminYesterdayTop"],
    queryFn: () => getYesterdayTopVote(),
    enabled: !!adminStatus?.isAdmin,
  });

  // Helper to calculate total votes (regular + priority*2)
  const getTotalVotes = (request: VoteRequest) => {
    return (request.voteCount || 0) + ((request.priorityVoteCount || 0) * 2);
  };

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async (data: AdminAnalyzeRequest) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return adminStartAnalysis(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnalyses"] });
      queryClient.invalidateQueries({ queryKey: ["adminLeaderboard"] });
      setSelectedToken(null);
    },
  });

  // Sync Gumloop mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return adminSyncGumloop(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnalyses"] });
    },
  });

  // Collect Performance Data mutation
  const performanceMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return adminCollectPerformance(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performanceMetrics"] });
    },
  });

  // Reprocess analysis mutation
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const reprocessMutation = useMutation({
    mutationFn: async (analysisId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      setReprocessingId(analysisId);
      return adminReprocessAnalysis(analysisId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnalyses"] });
      queryClient.invalidateQueries({ queryKey: ["adminLeaderboard"] });
      setReprocessingId(null);
    },
    onError: () => {
      setReprocessingId(null);
    },
  });

  // Recover failed analysis mutation
  const [recoveringId, setRecoveringId] = useState<number | null>(null);
  const recoverMutation = useMutation({
    mutationFn: async (analysisId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      setRecoveringId(analysisId);
      return adminRecoverAnalysis(analysisId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnalyses"] });
      queryClient.invalidateQueries({ queryKey: ["adminLeaderboard"] });
      setRecoveringId(null);
    },
    onError: () => {
      setRecoveringId(null);
    },
  });

  const handleTokenSelect = (token: TokenSearchResult) => {
    setSelectedToken(token);
  };

  const handleStartAnalysis = async () => {
    if (!selectedToken) return;

    await startAnalysisMutation.mutateAsync({
      tokenId: selectedToken.id,
      tokenSymbol: selectedToken.symbol,
      tokenName: selectedToken.name,
      tokenImage: selectedToken.large || selectedToken.thumb,
    });
  };

  // Not logged in
  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground">Please sign in to access the admin panel.</p>
        </div>
      </Layout>
    );
  }

  // Loading admin check
  if (checkingAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Checking admin access...</p>
        </div>
      </Layout>
    );
  }

  // Not an admin
  if (!adminStatus?.isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have admin access. Contact the site owner to be added.
          </p>
          <p className="text-sm text-muted-foreground">
            Signed in as: {adminStatus?.email || user.email}
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Manage analyses and view full rankings
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="votes" className="flex items-center gap-2">
              <Vote className="w-4 h-4" />
              Vote Queue
            </TabsTrigger>
            <TabsTrigger value="analyze" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Run Analysis
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              All Analyses
            </TabsTrigger>
          </TabsList>

          {/* Vote Queue Tab */}
          <TabsContent value="votes" className="space-y-6">
            {/* Yesterday's Winner - Most Voted Token */}
            <Card className="glass-card border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Yesterday's Top Voted
                  </span>
                  <Badge variant="outline" className="font-mono border-amber-500/30 text-amber-400">
                    Previous Day Winner
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingYesterdayTop ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  </div>
                ) : yesterdayTop ? (
                  <div className="flex items-center gap-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    {yesterdayTop.request.tokenImage && (
                      <img
                        src={yesterdayTop.request.tokenImage}
                        alt={yesterdayTop.request.tokenSymbol}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold truncate">{yesterdayTop.request.tokenName}</div>
                      <div className="text-sm text-muted-foreground">${yesterdayTop.request.tokenSymbol.toUpperCase()}</div>
                    </div>
                    <div className="text-right mr-4">
                      <div className="text-2xl font-bold text-amber-400">{yesterdayTop.totalScore}</div>
                      <div className="text-xs text-muted-foreground">
                        {yesterdayTop.voteCount} + {yesterdayTop.priorityVoteCount}P votes
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {yesterdayTop.request.status === "analyzed" ? (
                        <Link href={yesterdayTop.request.analysisId ? `/analyze/${yesterdayTop.request.analysisId}?from=admin` : "#"}>
                          <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer hover:bg-green-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Analyzed
                          </Badge>
                        </Link>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedToken({
                              id: yesterdayTop.request.tokenId,
                              symbol: yesterdayTop.request.tokenSymbol,
                              name: yesterdayTop.request.tokenName,
                              thumb: yesterdayTop.request.tokenImage || undefined,
                              large: yesterdayTop.request.tokenImage || undefined,
                            });
                            setActiveTab("analyze");
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-black"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Run Analysis
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No votes recorded yesterday</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Pending Vote Requests */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Pending Requests
                    </span>
                    <Badge variant="outline" className="font-mono">
                      {pendingVotes?.length || 0} pending
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPendingVotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : pendingVotes && pendingVotes.length > 0 ? (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {pendingVotes.map((request, index) => (
                        <div
                          key={request.id}
                          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {index + 1}
                          </div>
                          {request.tokenImage && (
                            <img
                              src={request.tokenImage}
                              alt={request.tokenSymbol}
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{request.tokenName}</div>
                            <div className="text-xs text-muted-foreground">${request.tokenSymbol.toUpperCase()}</div>
                          </div>
                          <div className="text-right mr-2">
                            <div className="text-sm font-bold text-primary">{getTotalVotes(request)}</div>
                            <div className="text-xs text-muted-foreground">
                              {request.voteCount || 0} + {(request.priorityVoteCount || 0)}P
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedToken({
                                id: request.tokenId,
                                symbol: request.tokenSymbol,
                                name: request.tokenName,
                                thumb: request.tokenImage || undefined,
                                large: request.tokenImage || undefined,
                              });
                              setActiveTab("analyze");
                            }}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Vote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No pending vote requests</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recently Analyzed from Votes */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      Recently Analyzed
                    </span>
                    <Badge variant="outline" className="font-mono border-green-500/30 text-green-400">
                      {analyzedVotes?.length || 0} completed
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingAnalyzedVotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : analyzedVotes && analyzedVotes.length > 0 ? (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {analyzedVotes.map((request) => (
                        <Link
                          key={request.id}
                          href={request.analysisId ? `/analyze/${request.analysisId}?from=admin` : "#"}
                        >
                          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            {request.tokenImage && (
                              <img
                                src={request.tokenImage}
                                alt={request.tokenSymbol}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{request.tokenName}</div>
                              <div className="text-xs text-muted-foreground">${request.tokenSymbol.toUpperCase()}</div>
                            </div>
                            <div className="text-right mr-2">
                              <div className="text-xs text-muted-foreground">
                                {getTotalVotes(request)} votes
                              </div>
                              {request.analyzedAt && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(request.analyzedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="border-green-500/30 text-green-400">
                              Analyzed
                            </Badge>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No analyzed tokens from votes yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info card */}
            <Card className="glass-card border-blue-500/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-400 mb-1">How Voting Works</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Users vote for tokens they want analyzed</li>
                      <li>• Regular votes = 1 point, Priority votes (Premium users) = 2 points</li>
                      <li>• User vote limits reset daily at midnight EST</li>
                      <li>• Pending requests accumulate votes until you analyze them</li>
                      <li>• Click the play button to analyze the top-voted token</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Run Analysis Tab */}
          <TabsContent value="analyze" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search & Analyze Token
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TokenSearch
                  onSelect={handleTokenSelect}
                />

                {selectedToken && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-secondary/30 border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedToken.thumb && (
                          <img
                            src={selectedToken.thumb}
                            alt={selectedToken.name}
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium">{selectedToken.name}</div>
                          <div className="text-sm text-muted-foreground uppercase">
                            ${selectedToken.symbol}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleStartAnalysis}
                        disabled={startAnalysisMutation.isPending}
                      >
                        {startAnalysisMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Start Analysis
                          </>
                        )}
                      </Button>
                    </div>

                    {startAnalysisMutation.isSuccess && (
                      <div className="mt-3 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Analysis started! Run ID: {startAnalysisMutation.data.runId}
                      </div>
                    )}

                    {startAnalysisMutation.isError && (
                      <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        <XCircle className="w-4 h-4 inline mr-2" />
                        Error: {startAnalysisMutation.error?.message || "Failed to start analysis"}
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Sync Gumloop */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Sync Stuck Analyses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manually sync analyses that may be stuck due to webhook failures.
                </p>
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Now
                    </>
                  )}
                </Button>

                {syncMutation.isSuccess && (
                  <div className="mt-3 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    {syncMutation.data.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collect Performance Data */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Collect Performance Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manually trigger price snapshot collection and performance metrics calculation for all ranked tokens.
                </p>
                <Button
                  variant="outline"
                  onClick={() => performanceMutation.mutate()}
                  disabled={performanceMutation.isPending}
                >
                  {performanceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Collecting...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Collect Now
                    </>
                  )}
                </Button>

                {performanceMutation.isSuccess && (
                  <div className="mt-3 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    {performanceMutation.data.message}
                  </div>
                )}

                {performanceMutation.isError && (
                  <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <XCircle className="w-4 h-4 inline mr-2" />
                    Failed to collect performance data
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold">Full Rankings</h2>
                </div>
                <Badge variant="outline" className="font-mono">
                  {leaderboard?.total || 0} tokens
                </Badge>
              </div>

              {/* Search and Filter Controls */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 cyber-card rounded border border-primary/20 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/10 bg-primary/5">
                      <Scan className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-mono text-primary tracking-wider">SEARCH</span>
                    </div>
                    <div className="flex items-center">
                      <span className="pl-3 text-primary font-mono">&gt;</span>
                      <Input
                        type="text"
                        placeholder="Enter ticker or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-0 bg-transparent font-mono focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Filter Toggle */}
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2 font-mono tracking-wider"
                  >
                    <Filter className="w-4 h-4" />
                    FILTERS
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-mono">
                        {Object.values(filters).filter(v => v).length + (searchQuery ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 font-mono text-xs">
                      <X className="w-4 h-4" />
                      CLEAR
                    </Button>
                  )}
                </div>

                {/* Filter Dropdowns */}
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4 rounded cyber-card border border-primary/20"
                  >
                    {/* Tier Filter */}
                    <div className="min-w-0">
                      <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TIER</label>
                      <Select
                        value={filters.tier || "all"}
                        onValueChange={(value) => setFilters(f => ({ ...f, tier: value === "all" ? undefined : value }))}
                      >
                        <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tiers</SelectItem>
                          <SelectItem value="S+">S+</SelectItem>
                          <SelectItem value="S">S</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Token Type Filter */}
                    <div className="min-w-0">
                      <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TYPE</label>
                      <Select
                        value={filters.tokenType || "all"}
                        onValueChange={(value) => setFilters(f => ({ ...f, tokenType: value === "all" ? undefined : value }))}
                      >
                        <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          <SelectItem value="UTILITY">Utility</SelectItem>
                          <SelectItem value="MEMECOIN">Memecoin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* FDV Filter */}
                    <div className="min-w-0">
                      <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">FDV</label>
                      <Select
                        value={filters.marketCapTier || "all"}
                        onValueChange={(value) => setFilters(f => ({ ...f, marketCapTier: value === "all" ? undefined : value }))}
                      >
                        <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All FDVs</SelectItem>
                          <SelectItem value="giga">Giga (&gt;$5B)</SelectItem>
                          <SelectItem value="mega">Mega ($1B-$5B)</SelectItem>
                          <SelectItem value="large">Large ($500M-$1B)</SelectItem>
                          <SelectItem value="upper_mid">Upper Mid ($150M-$500M)</SelectItem>
                          <SelectItem value="mid">Mid ($50M-$150M)</SelectItem>
                          <SelectItem value="small">Small ($15M-$50M)</SelectItem>
                          <SelectItem value="micro">Micro ($5M-$15M)</SelectItem>
                          <SelectItem value="nano">Nano (&lt;$5M)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Upside Filter */}
                    <div className="min-w-0">
                      <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">UPSIDE</label>
                      <Select
                        value={filters.upsideTier || "all"}
                        onValueChange={(value) => setFilters(f => ({ ...f, upsideTier: value === "all" ? undefined : value }))}
                      >
                        <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Upside</SelectItem>
                          <SelectItem value="100x+">100x+</SelectItem>
                          <SelectItem value="50-100x">50-100x</SelectItem>
                          <SelectItem value="25-50x">25-50x</SelectItem>
                          <SelectItem value="10-25x">10-25x</SelectItem>
                          <SelectItem value="5-10x">5-10x</SelectItem>
                          <SelectItem value="<5x">&lt;5x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </div>

              {loadingLeaderboard ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : leaderboard?.items?.length ? (
                <LeaderboardTable
                  items={leaderboard.items}
                  sortBy={sortBy}
                  order={sortOrder}
                  onSort={handleSort}
                  accessLimit={null}
                  totalTokens={leaderboard.total}
                />
              ) : (
                <div className="cyber-card rounded border border-primary/20 p-8 text-center">
                  <p className="text-muted-foreground">No analyses on rankings yet.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* All Analyses Tab */}
          <TabsContent value="history">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    All Analyses History
                  </span>
                  <Badge variant="outline">
                    {analyses?.total || 0} total
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAnalyses ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : analyses?.items?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10 text-left">
                          <th className="py-3 px-2 text-xs text-muted-foreground">ID</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Token</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Status</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Score</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Tier</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Created</th>
                          <th className="py-3 px-2 text-xs text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.items.map((analysis: TokenAnalysis) => {
                          const statusStyle = getStatusColor(analysis.status);
                          return (
                            <tr
                              key={analysis.id}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-3 px-2 text-sm font-mono text-muted-foreground">
                                {analysis.id}
                              </td>
                              <td className="py-3 px-2">
                                <Link
                                  href={`/analyze/${analysis.id}?from=admin`}
                                  className="flex items-center gap-2 hover:text-primary transition-colors"
                                >
                                  {analysis.tokenImage && (
                                    <img
                                      src={analysis.tokenImage as string}
                                      alt={analysis.tokenName}
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <span className="font-medium">{analysis.tokenSymbol}</span>
                                </Link>
                              </td>
                              <td className="py-3 px-2">
                                <Badge className={`${statusStyle.bg} ${statusStyle.text}`}>
                                  {analysis.status === "processing" && (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  )}
                                  {analysis.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 font-mono font-bold">
                                {analysis.status === "completed"
                                  ? (parseFloat(analysis.finalScore as string) || 0).toFixed(1)
                                  : "—"}
                              </td>
                              <td className="py-3 px-2">
                                {analysis.status === "completed" && analysis.tier ? (
                                  <Badge className={getTierColor(analysis.tier as string)}>
                                    {analysis.tier}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground">
                                {new Date(analysis.createdAt).toLocaleString()}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex gap-1">
                                  {analysis.status === "completed" && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        reprocessMutation.mutate(analysis.id);
                                      }}
                                      disabled={reprocessingId === analysis.id || reprocessMutation.isPending}
                                      className="h-7 text-xs"
                                    >
                                      {reprocessingId === analysis.id ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Processing
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1" />
                                          Reprocess
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {analysis.status === "failed" && analysis.gumloopRunId && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        recoverMutation.mutate(analysis.id);
                                      }}
                                      disabled={recoveringId === analysis.id || recoverMutation.isPending}
                                      className="h-7 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                    >
                                      {recoveringId === analysis.id ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Recovering
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1" />
                                          Recover
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {(analysis.status === "pending" || analysis.status === "processing") && analysis.gumloopRunId && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        recoverMutation.mutate(analysis.id);
                                      }}
                                      disabled={recoveringId === analysis.id || recoverMutation.isPending}
                                      className="h-7 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                    >
                                      {recoveringId === analysis.id ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Syncing
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1" />
                                          Sync
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No analyses yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
