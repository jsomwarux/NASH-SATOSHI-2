import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Vote as VoteIcon,
  Search,
  ArrowRight,
  Check,
  Clock,
  Crown,
  Loader2,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { ContractAddressLookup } from "@/components/vote/ContractAddressLookup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  getVoteStatus,
  getTopVoteRequests,
  getRecentlyAnalyzedRequests,
  submitVote,
  type VoteRequest,
} from "@/lib/api";

// Token lookup result type for contract address lookups
interface TokenLookupResult {
  source: "coingecko" | "dexscreener";
  tokenId: string;
  symbol: string;
  name: string;
  image: string | null;
  chain: string;
  contractAddress: string;
}

export default function Vote() {
  const { user, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingToken, setPendingToken] = useState<TokenLookupResult | null>(null);

  // Get vote status
  const { data: voteStatus } = useQuery({
    queryKey: ["voteStatus", user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      return getVoteStatus(token || undefined);
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Get top vote requests (show top 10 for optimal UX - enough variety without overwhelming)
  const { data: topRequests, isLoading: loadingTop } = useQuery({
    queryKey: ["topVoteRequests"],
    queryFn: () => getTopVoteRequests(10),
    staleTime: 30000,
  });

  // Get analyzed vote winners (ordered by vote count, top winners first)
  const { data: recentlyAnalyzed, isLoading: loadingRecent } = useQuery({
    queryKey: ["recentlyAnalyzedRequests"],
    queryFn: () => getRecentlyAnalyzedRequests(10),
    staleTime: 60000,
  });

  // Submit vote mutation - now requires contract address and source
  const voteMutation = useMutation({
    mutationFn: async (token: TokenLookupResult) => {
      const authToken = await getAccessToken();
      if (!authToken) throw new Error("Authentication required");
      return submitVote(
        {
          tokenId: token.tokenId,
          tokenSymbol: token.symbol,
          tokenName: token.name,
          tokenImage: token.image || undefined,
          chain: token.chain,
          contractAddress: token.contractAddress,
          source: token.source,
        },
        authToken
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voteStatus"] });
      queryClient.invalidateQueries({ queryKey: ["topVoteRequests"] });
    },
  });

  const handleTokenSelect = async (token: TokenLookupResult) => {
    if (!user) {
      setPendingToken(token);
      setShowAuthModal(true);
      return;
    }

    try {
      await voteMutation.mutateAsync(token);
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  const handleVoteForRequest = async (request: VoteRequest) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Existing vote requests may not have contract address info
    // Only allow voting for requests that have the required fields
    if (!request.contractAddress || !request.source) {
      console.error("Vote request missing contract address or source");
      return;
    }

    try {
      await voteMutation.mutateAsync({
        tokenId: request.tokenId,
        symbol: request.tokenSymbol,
        name: request.tokenName,
        image: request.tokenImage,
        chain: request.chain || "",
        contractAddress: request.contractAddress,
        source: request.source as "coingecko" | "dexscreener",
      });
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  const handleAuthModalClose = async () => {
    setShowAuthModal(false);
    if (pendingToken && user) {
      try {
        await voteMutation.mutateAsync(pendingToken);
      } catch (err) {
        console.error("Vote failed after auth:", err);
      }
      setPendingToken(null);
    }
  };

  const formatTimeUntilReset = (resetTime: string) => {
    const reset = new Date(resetTime);
    const now = new Date();
    const hours = Math.floor((reset.getTime() - now.getTime()) / (1000 * 60 * 60));
    const minutes = Math.floor(((reset.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getTotalVotes = (request: VoteRequest) => {
    return (request.voteCount || 0) + ((request.priorityVoteCount || 0) * 2);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent/5 text-accent text-xs font-mono tracking-wider mb-6">
            <VoteIcon className="w-4 h-4" />
            COMMUNITY VOTING
          </div>

          <h1 className="text-3xl md:text-5xl font-display font-bold mb-4">
            <span className="text-muted-foreground">Vote for</span>{" "}
            <span className="text-glow-cyan">Token Analysis</span>
          </h1>

          <p className="text-muted-foreground max-w-2xl mx-auto font-mono text-sm mb-8">
            {">"} Search for any token and vote to get it analyzed by our 4-LLM ensemble.
            Top voted tokens get analyzed first.
          </p>

          {/* Vote Status */}
          {voteStatus && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                <VoteIcon className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground hidden sm:inline">Votes remaining:</span>
                <span className="text-muted-foreground sm:hidden">Votes:</span>
                <span className="font-bold text-primary">{voteStatus.votesRemaining}/{voteStatus.maxVotes}</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                {voteStatus.hasPriorityVotes && (
                  <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-400">
                    <Crown className="w-3 h-3" />
                    <span className="hidden sm:inline">Priority</span> (2x)
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Resets in</span> {formatTimeUntilReset(voteStatus.resetTime)}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Contract Address Lookup Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-lg mx-auto mb-12"
        >
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-mono">
                <Search className="w-5 h-5 text-primary" />
                Lookup Token by Contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContractAddressLookup
                onSelect={handleTokenSelect}
                isLoading={voteMutation.isPending}
              />

              {voteMutation.isSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 mt-4 text-green-400"
                >
                  <Check className="w-5 h-5" />
                  Vote recorded successfully!
                </motion.div>
              )}

              {voteMutation.isError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-4 text-red-400 text-sm"
                >
                  {voteMutation.error instanceof Error ? voteMutation.error.message : "Failed to submit vote"}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Top Voted Tokens */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-mono">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Top Voted Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTop ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : topRequests && topRequests.length > 0 ? (
                  <div className="space-y-3">
                    {topRequests.map((request, index) => {
                      const hasVoted = voteStatus?.votedRequestIds?.includes(request.id);
                      const hasContractInfo = !!request.contractAddress && !!request.source;
                      return (
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
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              ${request.tokenSymbol.toUpperCase()}
                              {request.source && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0">
                                  {request.source === "dexscreener" ? "DEX" : "CG"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-primary">{getTotalVotes(request)}</div>
                            <div className="text-xs text-muted-foreground">votes</div>
                          </div>
                          <Button
                            size="sm"
                            variant={hasVoted ? "outline" : "default"}
                            disabled={hasVoted || voteMutation.isPending || (voteStatus?.votesRemaining || 0) <= 0 || !hasContractInfo}
                            onClick={() => handleVoteForRequest(request)}
                            className="w-20"
                            title={!hasContractInfo ? "This token was submitted before contract address requirement" : undefined}
                          >
                            {hasVoted ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <VoteIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No pending votes yet. Be the first to vote!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Previous Vote Winners */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-mono">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Previous Vote Winners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : recentlyAnalyzed && recentlyAnalyzed.length > 0 ? (
                  <div className="space-y-3">
                    {recentlyAnalyzed.map((request) => (
                      <Link key={request.id} href={request.analysisId ? `/analyze/${request.analysisId}` : "#"}>
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
                    <p>No vote winners analyzed yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <Link href="/rankings">
            <Button variant="outline" className="font-mono gap-2">
              <BarChart3 className="w-4 h-4" />
              View Rankings
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        defaultMode="signup"
        promptMessage="Sign up to vote for tokens"
      />
    </Layout>
  );
}
