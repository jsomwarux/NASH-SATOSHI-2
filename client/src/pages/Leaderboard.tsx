import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Search, Trophy, BarChart3, Filter, X, Scan, Database, Crown, Flame, Award } from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaderboard, useFilterOptions, useLeaderboardStats } from "@/hooks/useLeaderboard";
import type { LeaderboardFilters } from "@shared/schema";

type SortField = "score7d" | "score30d" | "runs7d" | "latestAnalysis" | "tier" | "tokenType" | "asymmetryScore" | "recommendation";
type SortOrder = "asc" | "desc";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortField>("score7d");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<LeaderboardFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Build filter options with search
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchQuery || undefined,
  }), [filters, searchQuery]);

  const { data, isLoading, error } = useLeaderboard({
    sortBy,
    order,
    limit: 50,
    filters: activeFilters,
  });

  const { data: filterOptions } = useFilterOptions();
  const { data: leaderboardStats } = useLeaderboardStats();

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("desc");
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery("");
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || searchQuery;

  // Stats calculations
  const stats = useMemo(() => {
    if (!data?.items.length) return null;

    const items = data.items;
    const avgScore = items.reduce((acc, item) => acc + (item.score7d || 0), 0) / items.length;
    const topScore = Math.max(...items.map(i => i.score7d || 0));
    const totalRuns7d = items.reduce((acc, item) => acc + (item.runs7d || 0), 0);

    return { avgScore, topScore, totalRuns7d, totalTokens: data.total };
  }, [data]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4 font-mono text-xs tracking-wider">
              <ArrowLeft className="w-4 h-4" />
              BACK_TO_SEARCH
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <span className="text-glow-cyan">LEADERBOARD</span>
              </h1>
              <p className="text-muted-foreground mt-2 font-mono text-sm">
                {">"} All analyzed tokens ranked by game theory score
              </p>
            </div>

            <Link href="/">
              <Button className="neon-button font-mono tracking-wider">
                <Search className="w-4 h-4 mr-2" />
                ANALYZE_NEW
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Summary */}
        {(stats || leaderboardStats) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            {/* Total Tokens */}
            <div className="cyber-card p-4 rounded border border-primary/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3" />
                UNIQUE_TOKENS
              </div>
              <div className="text-2xl font-bold font-mono text-primary">{stats?.totalTokens || 0}</div>
            </div>

            {/* #1 Token Dominance */}
            <div className="cyber-card p-4 rounded border border-purple-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3" />
                TOP_RANKED
              </div>
              {leaderboardStats?.topToken ? (
                <div>
                  <div className="text-lg font-bold font-mono text-purple-400 truncate">
                    ${leaderboardStats.topToken.symbol}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {leaderboardStats.topToken.daysOnLeaderboard}d on board
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>

            {/* Top Narrative */}
            <div className="cyber-card p-4 rounded border border-orange-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3" />
                HOT_NARRATIVE
              </div>
              {leaderboardStats?.topNarrative ? (
                <div>
                  <div className="text-lg font-bold font-mono text-orange-400 truncate" title={leaderboardStats.topNarrative.narrative}>
                    {leaderboardStats.topNarrative.narrative.length > 12
                      ? leaderboardStats.topNarrative.narrative.slice(0, 12) + "…"
                      : leaderboardStats.topNarrative.narrative}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    avg {leaderboardStats.topNarrative.avgScore.toFixed(1)} • {leaderboardStats.topNarrative.tokenCount} tokens
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>

            {/* 24H Winner */}
            <div className="cyber-card p-4 rounded border border-green-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider flex items-center gap-1">
                <Award className="w-3 h-3" />
                24H_WINNER
              </div>
              {leaderboardStats?.winner24h ? (
                <div>
                  <div className="text-lg font-bold font-mono text-green-400 truncate">
                    ${leaderboardStats.winner24h.symbol}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    score {leaderboardStats.winner24h.score.toFixed(1)}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-4">
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
              className="flex flex-wrap gap-4 p-4 rounded cyber-card border border-primary/20"
            >
              {/* Tier Filter */}
              <div className="w-40">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TIER</label>
                <Select
                  value={filters.tier || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, tier: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono">
                    <SelectValue placeholder="All tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    {filterOptions?.tiers.map(tier => (
                      <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                    ))}
                    {!filterOptions?.tiers.length && (
                      <>
                        <SelectItem value="S+">S+</SelectItem>
                        <SelectItem value="S">S</SelectItem>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Narrative Filter */}
              {filterOptions?.narratives && filterOptions.narratives.length > 0 && (
                <div className="w-48">
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">NARRATIVE</label>
                  <Select
                    value={filters.narrative || "all"}
                    onValueChange={(value) => setFilters(f => ({ ...f, narrative: value === "all" ? undefined : value }))}
                  >
                    <SelectTrigger className="bg-background/50 border-primary/20 font-mono">
                      <SelectValue placeholder="All narratives" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All narratives</SelectItem>
                      {filterOptions.narratives.map(narrative => (
                        <SelectItem key={narrative} value={narrative}>{narrative}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Chain Filter */}
              {filterOptions?.chains && filterOptions.chains.length > 0 && (
                <div className="w-40">
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">CHAIN</label>
                  <Select
                    value={filters.chain || "all"}
                    onValueChange={(value) => setFilters(f => ({ ...f, chain: value === "all" ? undefined : value }))}
                  >
                    <SelectTrigger className="bg-background/50 border-primary/20 font-mono">
                      <SelectValue placeholder="All chains" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All chains</SelectItem>
                      {filterOptions.chains.map(chain => (
                        <SelectItem key={chain} value={chain}>{chain}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Token Type Filter */}
              <div className="w-40">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TYPE</label>
                <Select
                  value={filters.tokenType || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, tokenType: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MEMECOIN">Memecoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Market Cap Tier Filter */}
              <div className="w-48">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">MARKET_CAP</label>
                <Select
                  value={filters.marketCapTier || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, marketCapTier: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono">
                    <SelectValue placeholder="All caps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All caps</SelectItem>
                    <SelectItem value="mega">Mega (&gt;$5B)</SelectItem>
                    <SelectItem value="large">Large ($1B-$5B)</SelectItem>
                    <SelectItem value="mid">Mid ($500M-$1B)</SelectItem>
                    <SelectItem value="small">Small ($100M-$500M)</SelectItem>
                    <SelectItem value="micro">Micro ($10M-$100M)</SelectItem>
                    <SelectItem value="nano">Nano (&lt;$10M)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="cyber-card p-8 rounded border border-primary/20 text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground font-mono">LOADING_LEADERBOARD...</p>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="cyber-card p-8 rounded border border-red-500/30">
              <div className="w-16 h-16 rounded border border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-mono font-bold mb-2 text-red-400">LOAD_ERROR</h2>
              <p className="text-muted-foreground mb-6 font-mono text-sm">
                Failed to retrieve leaderboard data. Please retry.
              </p>
              <Button onClick={() => window.location.reload()} className="font-mono">
                RETRY
              </Button>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {data && data.items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="cyber-card p-8 rounded border border-primary/20">
              <div className="w-16 h-16 rounded border border-primary/30 bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-mono font-bold mb-2">
                {hasActiveFilters ? "NO_MATCHES" : "NO_DATA"}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md font-mono text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters or search criteria."
                  : "Be the first to analyze a token and appear on the leaderboard."}
              </p>
              {hasActiveFilters ? (
                <Button onClick={clearFilters} variant="outline" className="font-mono">
                  CLEAR_FILTERS
                </Button>
              ) : (
                <Link href="/">
                  <Button className="neon-button font-mono">
                    <Search className="w-4 h-4 mr-2" />
                    ANALYZE_TOKEN
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Table */}
        {data && data.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <LeaderboardTable
              items={data.items}
              sortBy={sortBy}
              order={order}
              onSort={handleSort}
            />

            {/* Pagination info */}
            <div className="mt-4 text-center text-xs font-mono text-muted-foreground">
              SHOWING {data.items.length} OF {data.total} TOKENS
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
