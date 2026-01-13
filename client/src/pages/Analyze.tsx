import { useParams, Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, BarChart3, Shield, Lock, Crown } from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { ScoreCard } from "@/components/scorecard/ScoreCard";
import { Button } from "@/components/ui/button";
import { useAnalysis, useTokenStats } from "@/hooks/useAnalysis";
import { ApiError } from "@/lib/api";

export default function Analyze() {
  const params = useParams();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const fromAdmin = searchParams.get("from") === "admin";
  const analysisId = params.id ? parseInt(params.id, 10) : null;

  const {
    data: analysis,
    isLoading,
    error,
    refetch,
    isPolling,
    elapsedSeconds,
    nodesCompleted,
    currentNode,
  } = useAnalysis(analysisId);

  // Fetch token stats only when analysis is completed
  const { data: tokenStats } = useTokenStats(
    analysis?.status === "completed" ? analysis.tokenId : null
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
          <Link href={fromAdmin ? "/admin" : "/rankings"}>
            <Button variant="ghost" size="sm" className="gap-2">
              {fromAdmin ? (
                <>
                  <Shield className="w-4 h-4" />
                  Back to Admin Panel
                </>
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  Back to Rankings
                </>
              )}
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
              /* Generic Error */
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">Analysis Not Found</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  The requested analysis could not be found. It may have been removed or the ID is invalid.
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
            isPolling={isPolling}
            elapsedSeconds={elapsedSeconds}
            nodesCompleted={nodesCompleted}
            currentNode={currentNode}
            tokenStats={tokenStats}
          />
        )}
      </div>
    </Layout>
  );
}
