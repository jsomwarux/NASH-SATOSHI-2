import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Search, Trophy, BarChart3, Filter, X, Scan, Database, Crown, Flame, Award, Sparkles, Lock, TrendingUp } from "lucide-react";
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
import { usePerformanceMetrics } from "@/hooks/usePerformance";
import type { LeaderboardFilters } from "@shared/schema";
import { formatScore } from "@/lib/utils";

type SortField = "score7d" | "score30d" | "runs7d" | "latestAnalysis" | "tier" | "tokenType" | "asymmetryScore" | "upsideTier";
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
  const { data: performanceMetrics } = usePerformanceMetrics();

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

  // Check if user can use advanced features (sorting/filtering)
  const canUseAdvancedFeatures = data?.isPremium ?? false;

  // Reset filters/sorting if user is not premium
  useEffect(() => {
    if (data && !data.isPremium) {
      // Reset to default sort for free users
      if (sortBy !== "score7d" || order !== "desc") {
        setSortBy("score7d");
        setOrder("desc");
      }
      // Clear any filters
      if (hasActiveFilters) {
        setFilters({});
        setSearchQuery("");
      }
      // Close filter panel
      if (showFilters) {
        setShowFilters(false);
      }
    }
  }, [data?.isPremium]);

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

            <Link href="/vote">
              <Button className="neon-button font-mono tracking-wider">
                <Sparkles className="w-4 h-4 mr-2" />
                VOTE_FOR_TOKENS
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Summary - 4 cards across */}
        {(stats || leaderboardStats) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2"
          >
            {/* Performance Summary - Combined metrics in one card */}
            <div className="cyber-card p-4 rounded border border-cyan-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                PERFORMANCE
              </div>
              <div className="space-y-2">
                {/* Top 10 Avg 7D */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">7D Avg</span>
                  {performanceMetrics?.top10Avg7dReturn !== null && performanceMetrics?.top10Avg7dReturn !== undefined ? (
                    <span className={`text-sm font-bold font-mono ${performanceMetrics.top10Avg7dReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {performanceMetrics.top10Avg7dReturn >= 0 ? '+' : ''}{performanceMetrics.top10Avg7dReturn.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-sm font-bold font-mono text-muted-foreground">—</span>
                  )}
                </div>
                {/* Top 10 Avg 30D */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">30D Avg</span>
                  {performanceMetrics?.top10Avg30dReturn !== null && performanceMetrics?.top10Avg30dReturn !== undefined ? (
                    <span className={`text-sm font-bold font-mono ${performanceMetrics.top10Avg30dReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {performanceMetrics.top10Avg30dReturn >= 0 ? '+' : ''}{performanceMetrics.top10Avg30dReturn.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-sm font-bold font-mono text-muted-foreground">—</span>
                  )}
                </div>
                {/* Hit Rate */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">Hit Rate</span>
                  {performanceMetrics?.hitRate30d !== null && performanceMetrics?.hitRate30d !== undefined ? (
                    <span className="text-sm font-bold font-mono text-primary">
                      {performanceMetrics.hitRate30d.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-sm font-bold font-mono text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Top 3 Ranked Tokens */}
            <div className="cyber-card p-4 rounded border border-purple-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3" />
                TOP_RANKED
              </div>
              {leaderboardStats?.topTokens && leaderboardStats.topTokens.length > 0 ? (
                <div className="space-y-1">
                  {leaderboardStats.topTokens.map((token, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const textSize = isFirst ? 'text-base' : isSecond ? 'text-sm' : 'text-xs';
                    const opacity = isFirst ? '' : isSecond ? 'opacity-85' : 'opacity-70';

                    return (
                      <div key={token.symbol} className={`flex items-center justify-between gap-2 ${opacity}`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-mono text-purple-400/50 ${textSize} flex-shrink-0`}>#{index + 1}</span>
                          <span className={`font-bold font-mono text-purple-400 ${textSize} truncate`}>
                            ${token.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`${isFirst ? 'text-xs' : 'text-[10px]'} text-muted-foreground font-mono`}>
                            {token.daysInTop3}d
                          </span>
                          <span className={`${isFirst ? 'text-xs' : 'text-[10px]'} text-purple-400/70 font-mono font-bold`}>
                            {formatScore(token.score)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>

            {/* Hot Narratives - Top 3 */}
            <div className="cyber-card p-4 rounded border border-orange-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3" />
                HOT_NARRATIVES
              </div>
              {leaderboardStats?.topNarratives && leaderboardStats.topNarratives.length > 0 ? (
                <div className="space-y-1">
                  {leaderboardStats.topNarratives.map((narrative, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const textSize = isFirst ? 'text-base' : isSecond ? 'text-sm' : 'text-xs';
                    const opacity = isFirst ? '' : isSecond ? 'opacity-85' : 'opacity-70';

                    return (
                      <div key={narrative.narrative} className={`flex items-center justify-between gap-2 ${opacity}`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-mono text-orange-400/50 ${textSize} flex-shrink-0`}>#{index + 1}</span>
                          <span
                            className={`font-bold font-mono text-orange-400 ${textSize} truncate`}
                            title={narrative.narrative}
                          >
                            {narrative.narrative.length > 8
                              ? narrative.narrative.slice(0, 8) + "…"
                              : narrative.narrative}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`${isFirst ? 'text-xs' : 'text-[10px]'} text-muted-foreground font-mono`}>
                            {narrative.tokenCount}
                          </span>
                          <span className={`${isFirst ? 'text-xs' : 'text-[10px]'} text-orange-400/70 font-mono font-bold`}>
                            {formatScore(narrative.avgScore)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>

            {/* 7D Winners - Top 3 */}
            <div className="cyber-card p-4 rounded border border-green-500/20">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 tracking-wider flex items-center gap-1">
                <Award className="w-3 h-3" />
                7D_WINNERS
              </div>
              {leaderboardStats?.winners7d && leaderboardStats.winners7d.length > 0 ? (
                <div className="space-y-1">
                  {leaderboardStats.winners7d.map((winner, index) => {
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const textSize = isFirst ? 'text-base' : isSecond ? 'text-sm' : 'text-xs';
                    const opacity = isFirst ? '' : isSecond ? 'opacity-85' : 'opacity-70';

                    return (
                      <div key={`${winner.symbol}-${index}`} className={`flex items-center justify-between gap-2 ${opacity}`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`font-mono text-green-400/50 ${textSize} flex-shrink-0`}>#{index + 1}</span>
                          <span className={`font-bold font-mono text-green-400 ${textSize} truncate`}>
                            ${winner.symbol}
                          </span>
                        </div>
                        <span className={`${isFirst ? 'text-xs' : 'text-[10px]'} text-green-400/70 font-mono font-bold flex-shrink-0`}>
                          {formatScore(winner.score)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-muted-foreground">—</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground text-center mb-8 font-mono">
          Past performance does not guarantee future results. Returns require 7+ days of price history.
        </p>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className={`relative flex-1 cyber-card rounded border overflow-hidden ${canUseAdvancedFeatures ? 'border-primary/20' : 'border-muted/30 opacity-60'}`}>
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/10 bg-primary/5">
                {canUseAdvancedFeatures ? (
                  <Scan className="w-3 h-3 text-primary" />
                ) : (
                  <Lock className="w-3 h-3 text-muted-foreground" />
                )}
                <span className={`text-[10px] font-mono tracking-wider ${canUseAdvancedFeatures ? 'text-primary' : 'text-muted-foreground'}`}>
                  {canUseAdvancedFeatures ? 'SEARCH' : 'SEARCH (PRO)'}
                </span>
              </div>
              <div className="flex items-center">
                <span className={`pl-3 font-mono ${canUseAdvancedFeatures ? 'text-primary' : 'text-muted-foreground'}`}>&gt;</span>
                <Input
                  type="text"
                  placeholder={canUseAdvancedFeatures ? "Enter ticker or name..." : "Upgrade to search..."}
                  value={searchQuery}
                  onChange={(e) => canUseAdvancedFeatures && setSearchQuery(e.target.value)}
                  disabled={!canUseAdvancedFeatures}
                  className="border-0 bg-transparent font-mono focus-visible:ring-0 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => canUseAdvancedFeatures && setShowFilters(!showFilters)}
              disabled={!canUseAdvancedFeatures}
              className={`gap-2 font-mono tracking-wider ${!canUseAdvancedFeatures ? 'opacity-60' : ''}`}
            >
              {canUseAdvancedFeatures ? (
                <Filter className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {canUseAdvancedFeatures ? 'FILTERS' : 'FILTERS (PRO)'}
              {hasActiveFilters && canUseAdvancedFeatures && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-mono">
                  {Object.values(filters).filter(v => v).length + (searchQuery ? 1 : 0)}
                </Badge>
              )}
            </Button>

            {/* Clear Filters */}
            {hasActiveFilters && canUseAdvancedFeatures && (
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
              className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4 p-4 rounded cyber-card border border-primary/20"
            >
              {/* Tier Filter */}
              <div className="min-w-0 sm:w-40">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TIER</label>
                <Select
                  value={filters.tier || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, tier: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
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
                <div className="min-w-0 sm:w-48">
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">NARRATIVE</label>
                  <Select
                    value={filters.narrative || "all"}
                    onValueChange={(value) => setFilters(f => ({ ...f, narrative: value === "all" ? undefined : value }))}
                  >
                    <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
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
                <div className="min-w-0 sm:w-40">
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">CHAIN</label>
                  <Select
                    value={filters.chain || "all"}
                    onValueChange={(value) => setFilters(f => ({ ...f, chain: value === "all" ? undefined : value }))}
                  >
                    <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
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
              <div className="min-w-0 sm:w-40">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">TYPE</label>
                <Select
                  value={filters.tokenType || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, tokenType: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MEMECOIN">Memecoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* FDV Tier Filter */}
              <div className="col-span-2 sm:col-span-1 min-w-0 sm:w-48">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">FDV</label>
                <Select
                  value={filters.marketCapTier || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, marketCapTier: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
                    <SelectValue placeholder="All FDVs" />
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

              {/* Upside Tier Filter */}
              <div className="min-w-0">
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">UPSIDE</label>
                <Select
                  value={filters.upsideTier || "all"}
                  onValueChange={(value) => setFilters(f => ({ ...f, upsideTier: value === "all" ? undefined : value }))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/20 font-mono text-xs sm:text-sm">
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
              accessLimit={data.accessLimit}
              totalTokens={data.total}
              canSort={canUseAdvancedFeatures}
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
