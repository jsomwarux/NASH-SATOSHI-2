import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { WeeklyReceiptGenerator } from "@/components/receipts/WeeklyReceiptGenerator";
import { Button } from "@/components/ui/button";
import { useLeaderboard } from "@/hooks/useLeaderboard";

export default function WeeklyReceipt() {
  const { data, isLoading, error, refetch, isFetching } = useLeaderboard({
    limit: 100,
    sortBy: "latestScore",
    order: "desc",
  });

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/rankings">
            <Button variant="ghost" size="sm" className="mb-4 gap-2 font-mono text-xs tracking-wider">
              <ArrowLeft className="h-4 w-4" />
              BACK_TO_RANKINGS
            </Button>
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.24em] text-cyan-200">
                <ReceiptText className="h-3.5 w-3.5" />
                Acquisition Artifact
              </div>
              <h1 className="text-3xl font-bold font-display md:text-5xl">
                <span className="text-glow-cyan">WEEKLY AI AGENTS</span> RECEIPT
              </h1>
              <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-muted-foreground">
                Generate a square X-ready ranking receipt from current Nash Satoshi leaderboard data. Built for weekly public posts, analyst replies, and borrowed-audience outreach.
              </p>
            </div>

            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 font-mono">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              REFRESH_DATA
            </Button>
          </div>
        </motion.div>

        {isLoading && (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-primary/20 bg-black/30">
            <div className="flex items-center gap-3 font-mono text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              LOADING_RANKING_DATA
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="font-mono text-lg font-bold text-red-300">Leaderboard data unavailable</h2>
            <p className="mt-2 text-sm text-red-100/80">
              The receipt route rendered, but the leaderboard request failed. Refresh data after the API is available.
            </p>
          </div>
        )}

        {!isLoading && !error && data?.items && <WeeklyReceiptGenerator items={data.items} />}
      </div>
    </Layout>
  );
}
