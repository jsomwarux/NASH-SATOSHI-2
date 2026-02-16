import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, BarChart3, Lock, Crown } from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { ScoreCard } from "@/components/scorecard/ScoreCard";
import { Button } from "@/components/ui/button";
import { useAnalysisBySymbol, useTokenStats } from "@/hooks/useAnalysis";
import { useTokenRank } from "@/hooks/useLeaderboard";
import { ApiError } from "@/lib/api";

export default function Token() {
  const params = useParams();
  const symbol = params.symbol || null;

  const {
    data: analysis,
    isLoading,
    error,
    refetch,
  } = useAnalysisBySymbol(symbol);

  // Fetch token stats only when analysis is completed
  const { data: tokenStats } = useTokenStats(
    analysis?.status === "completed" ? analysis.tokenId : null
  );

  // Fetch token rank
  const { data: rankData } = useTokenRank(
    analysis?.status === "completed" ? analysis.tokenSymbol : null
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link href="/rankings">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Rankings
            </Button>
          </Link>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading analysis...</p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            {/* Access Denied Error */}
            {error instanceof ApiError && error.code === "ACCESS_DENIED" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">Premium Content</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  This scorecard is only available to Pro and Premium subscribers.
                  Upgrade your plan to access all token analyses.
                </p>
                <div className="flex gap-4">
                  <Link href="/pricing">
                    <Button>
                      <Crown className="w-4 h-4 mr-2" />
                      View Plans
                    </Button>
                  </Link>
                  <Link href="/rankings">
                    <Button variant="outline">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Rankings
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              /* Token Not Found */
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">Token Not Found</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  No analysis found for token "{symbol?.toUpperCase()}". It may not have been analyzed yet.
                </p>
                <div className="flex gap-4">
                  <Link href="/rankings">
                    <Button>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Rankings
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Analysis Content */}
        {analysis && (
          <ScoreCard
            analysis={analysis}
            isPolling={false}
            tokenStats={tokenStats}
            rank={rankData?.rank}
          />
        )}
      </div>
    </Layout>
  );
}
