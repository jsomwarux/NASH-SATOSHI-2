import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowUpDown, ExternalLink, Clock, Terminal, Shield, ShieldCheck, ShieldAlert, Lock, Crown, HelpCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AggregatedLeaderboardItem } from "@/types/leaderboard";
import { formatScore, formatComponentScore } from "@/lib/utils";
import { ScoringMethodologyModal } from "@/components/common/ScoringMethodologyModal";

type SortField = "latestScore" | "scoreTrend" | "latestAnalysis" | "tier" | "tokenType" | "asymmetryScore" | "upsideTier";

interface LeaderboardTableProps {
  items: AggregatedLeaderboardItem[];
  sortBy: SortField;
  order: "asc" | "desc";
  onSort: (field: SortField) => void;
  accessLimit?: number | null; // null = unlimited
  totalTokens?: number; // Total tokens available (for CTA messaging)
  canSort?: boolean; // Whether user can sort (premium feature)
}

// Score color based on tier - matches tier badge colors
function getScoreColorByTier(tier: string): string {
  switch (tier) {
    case "S+":
      return "text-purple-400";
    case "S":
      return "text-green-400";
    case "A":
      return "text-emerald-400";
    case "B":
      return "text-yellow-400";
    default:
      return "text-red-400";
  }
}

function getTierBadgeStyle(tier: string): string {
  switch (tier) {
    case "S+":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "S":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "A":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "B":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default:
      return "bg-red-500/20 text-red-400 border-red-500/30";
  }
}

// Clean narrative text from markdown and special characters
function cleanNarrative(narrative: string | null): string {
  if (!narrative) return "";
  return narrative
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/\*/g, '')   // Remove italic markdown
    .replace(/#{1,6}\s?/g, '') // Remove headers
    .replace(/`/g, '')    // Remove code markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // Less than 1 hour ago
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}m`;
  }

  // Less than 24 hours ago
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h`;
  }

  // Less than 7 days ago
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d`;
  }

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getConfidenceInfo(confidence: 'high' | 'medium' | 'low') {
  switch (confidence) {
    case 'high':
      return { icon: ShieldCheck, color: 'text-green-400', label: 'High confidence (5+ runs)' };
    case 'medium':
      return { icon: Shield, color: 'text-yellow-400', label: 'Medium confidence (2-4 runs)' };
    case 'low':
      return { icon: ShieldAlert, color: 'text-red-400', label: 'Low confidence (<2 runs)' };
  }
}

function getUpsideTierInfo(tier: string | null, multiple: string | null) {
  // Display the multiple if available, otherwise the tier
  const display = multiple || tier || '—';

  switch (tier) {
    case '100x+':
      return { color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', display };
    case '50-100x':
      return { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', display };
    case '25-50x':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', display };
    case '10-25x':
      return { color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', display };
    case '5-10x':
      return { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', display };
    case '<5x':
      return { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', display };
    default:
      return { color: 'text-muted-foreground', bg: 'bg-muted/10 border-muted/20', display: '—' };
  }
}

// Get trend display info based on score change
function getTrendInfo(scoreTrend: number | null): {
  icon: typeof TrendingUp | typeof TrendingDown | typeof Minus;
  color: string;
  bg: string;
  display: string;
  label: string;
} {
  if (scoreTrend === null) {
    return {
      icon: Minus,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      display: 'NEW',
      label: 'First analysis - no trend data yet'
    };
  }

  const absChange = Math.abs(scoreTrend);
  const sign = scoreTrend >= 0 ? '+' : '';

  // Show actual trend values for changes >= 0.5 points
  if (scoreTrend >= 0.5) {
    return {
      icon: TrendingUp,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
      display: `${sign}${scoreTrend.toFixed(1)}`,
      label: `Score improved by ${absChange.toFixed(1)} points`
    };
  }

  if (scoreTrend <= -0.5) {
    return {
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      display: `${scoreTrend.toFixed(1)}`,
      label: `Score declined by ${absChange.toFixed(1)} points`
    };
  }

  // Only show stable for very small changes (between -0.5 and +0.5)
  return {
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted/10 border-muted/20',
    display: '—',
    label: `Stable (${sign}${scoreTrend.toFixed(1)} points)`
  };
}

export function LeaderboardTable({ items, sortBy, order, onSort, accessLimit, totalTokens, canSort = true }: LeaderboardTableProps) {
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => canSort && onSort(field)}
      disabled={!canSort}
      className={`h-auto p-0 font-mono text-[10px] tracking-wider hover:bg-transparent ${sortBy === field ? "text-primary" : ""} ${!canSort ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
      <ArrowUpDown className={`ml-1 h-3 w-3 ${!canSort ? "opacity-50" : ""}`} />
    </Button>
  );

  // Check if item is gated (beyond access limit)
  // accessLimit: undefined = not set (show all), null = unlimited, number = limit
  const isGated = (index: number) => accessLimit !== undefined && accessLimit !== null && index >= accessLimit;

  // Count gated items
  const gatedCount = (accessLimit !== undefined && accessLimit !== null) ? Math.max(0, items.length - accessLimit) : 0;
  const hasGatedItems = gatedCount > 0;

  return (
    <div className="relative">
      <div className="cyber-card rounded border border-primary/20 overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10 bg-primary/5">
          <Terminal className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-mono text-primary tracking-wider">TOKEN_RANKINGS</span>
          <button
            onClick={() => setShowMethodologyModal(true)}
            className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            How it works
          </button>
          <div className="flex-1" />
          <span className="text-[10px] font-mono text-muted-foreground">{items.length} ENTRIES</span>
          {gatedCount > 0 && (
            <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {gatedCount} LOCKED
            </span>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-primary/10 hover:bg-transparent">
              <TableHead className="w-12 text-center font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger className="cursor-help">#</TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20">
                    <p className="text-xs font-mono">Rankings position</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="font-mono text-[10px] tracking-wider min-w-[140px] max-w-[200px]">
                <Tooltip>
                  <TooltipTrigger className="cursor-help">TOKEN</TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20">
                    <p className="text-xs font-mono">Token name, symbol, and chain</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell font-mono text-[10px] tracking-wider w-16 min-w-[64px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="tokenType">TYPE</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20">
                    <p className="text-xs font-mono">UTIL = Utility token | MEME = Memecoin</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="latestScore">SCORE</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[200px]">
                    <p className="text-xs font-mono">Latest game theory score (0-100) with time since analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="tier">TIER</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[200px]">
                    <p className="text-xs font-mono">S+ (85+) | S (75-84) | A (65-74) | B (50-64) | C (&lt;50)</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="upsideTier">UPSIDE</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[280px]">
                    <p className="text-xs font-mono font-bold mb-1">Potential Price Multiple</p>
                    <p className="text-xs text-muted-foreground">Estimated upside based on current FDV vs realistic peak FDV. Higher = more room to grow.</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center hidden lg:table-cell font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="asymmetryScore">ASYM</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[280px]">
                    <p className="text-xs font-mono font-bold mb-1">Entry Timing Score (0-25)</p>
                    <p className="text-xs text-muted-foreground">Game-theoretic favorability of current entry. Considers your position vs other market participants.</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center hidden md:table-cell font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><SortButton field="scoreTrend">TREND</SortButton></span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[200px]">
                    <p className="text-xs font-mono">Score change from previous analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="hidden xl:table-cell font-mono text-[10px] tracking-wider">
                <Tooltip>
                  <TooltipTrigger className="cursor-help">NARRATIVE</TooltipTrigger>
                  <TooltipContent side="bottom" className="cyber-card border-primary/20 max-w-[200px]">
                    <p className="text-xs font-mono">Token's market narrative or category</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-14 pr-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const cleanedNarrative = cleanNarrative(item.latestNarrative);
              const cleanedPrimaryNarrative = cleanNarrative(item.latestPrimaryNarrative);
              const gated = isGated(index);
              const isFirstGatedRow = gated && accessLimit !== null && index === accessLimit;

              // Insert CTA row right before the first gated row
              if (isFirstGatedRow) {
                return (
                  <React.Fragment key={`cta-and-${item.tokenId}`}>
                    {/* Sticky CTA Row */}
                    <tr className="sticky top-16 z-20">
                      <td colSpan={10} className="p-0 border-0 bg-transparent">
                        <div className="flex justify-center py-3">
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="p-4 sm:p-5 rounded-lg border border-amber-500/40 bg-background/95 backdrop-blur-md shadow-xl shadow-amber-500/20 max-w-lg mx-4"
                          >
                            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                              <div className="w-11 h-11 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                                <Lock className="w-5 h-5 text-amber-400" />
                              </div>
                              <div className="text-center sm:text-left flex-1">
                                <h3 className="text-base font-display font-bold text-amber-400 mb-0.5">
                                  Unlock Full Rankings
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono">
                                  Viewing top {accessLimit}.
                                  {totalTokens && totalTokens > (accessLimit || 0) && (
                                    <> Upgrade for all <span className="text-primary font-bold">{totalTokens}</span> tokens</>
                                  )}
                                  {" + "}search, filter & sort.
                                </p>
                              </div>
                              <Link href="/pricing">
                                <Button className="neon-button font-mono tracking-wider text-sm">
                                  <Crown className="w-4 h-4 mr-2" />
                                  UPGRADE
                                </Button>
                              </Link>
                            </div>
                          </motion.div>
                        </div>
                      </td>
                    </tr>
                    {/* First gated row */}
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="border-primary/5 relative group"
                    >
                      <TableCell className="text-center font-mono text-muted-foreground/50 text-xs blur-[2px]">
                        {String(item.overallRank || index + 1).padStart(2, '0')}
                      </TableCell>
                      <TableCell className="min-w-[140px] max-w-[200px]">
                        <div className="flex items-center gap-2 blur-[3px] select-none">
                          <div className="w-8 h-8 rounded bg-muted/50 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-muted-foreground/70">Hidden Token</div>
                            <div className="text-xs text-muted-foreground/50 font-mono">$???</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell blur-[2px]">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono opacity-30">???</Badge>
                      </TableCell>
                      <TableCell className="text-center blur-[2px]">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold font-mono text-muted-foreground/50">??.??</span>
                          <span className="text-[9px] text-muted-foreground/30 font-mono">??h</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center blur-[2px]">
                        <Badge variant="outline" className="font-mono font-bold opacity-30">?</Badge>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell blur-[2px]">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 opacity-30">
                          <span className="text-[10px] font-mono">???</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell blur-[2px]">
                        <span className="text-sm font-mono text-muted-foreground/30">?</span>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell blur-[2px]">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 opacity-30">
                          <span className="text-[10px] font-mono">???</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell blur-[2px]">
                        <span className="text-sm text-muted-foreground/30">Hidden</span>
                      </TableCell>
                      <TableCell className="pr-2">
                        <Link href="/pricing">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-60 hover:opacity-100">
                            <Lock className="w-4 h-4 text-amber-400" />
                          </Button>
                        </Link>
                      </TableCell>
                    </motion.tr>
                  </React.Fragment>
                );
              }

              // Gated row - show blurred with lock overlay
              if (gated) {
                return (
                  <motion.tr
                    key={item.tokenId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="border-primary/5 relative group"
                  >
                    <TableCell className="text-center font-mono text-muted-foreground/50 text-xs blur-[2px]">
                      {String(item.overallRank || index + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="min-w-[140px] max-w-[200px]">
                      <div className="flex items-center gap-2 blur-[3px] select-none">
                        <div className="w-8 h-8 rounded bg-muted/50 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-muted-foreground/70">Hidden Token</div>
                          <div className="text-xs text-muted-foreground/50 font-mono">$???</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell blur-[2px]">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono opacity-30">???</Badge>
                    </TableCell>
                    <TableCell className="text-center blur-[2px]">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold font-mono text-muted-foreground/50">??.??</span>
                        <span className="text-[9px] text-muted-foreground/30 font-mono">??h</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center blur-[2px]">
                      <Badge variant="outline" className="font-mono font-bold opacity-30">?</Badge>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell blur-[2px]">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 opacity-30">
                        <span className="text-[10px] font-mono">???</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell blur-[2px]">
                      <span className="text-sm font-mono text-muted-foreground/30">?</span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell blur-[2px]">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 opacity-30">
                        <span className="text-[10px] font-mono">???</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell blur-[2px]">
                      <span className="text-sm text-muted-foreground/30">Hidden</span>
                    </TableCell>
                    <TableCell className="pr-2">
                      <Link href="/pricing">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-60 hover:opacity-100">
                          <Lock className="w-4 h-4 text-amber-400" />
                        </Button>
                      </Link>
                    </TableCell>
                  </motion.tr>
                );
              }

              return (
                <motion.tr
                  key={item.tokenId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className="border-primary/5 transition-colors hover:bg-primary/5 cursor-pointer group"
                  onClick={() => window.location.href = `/token/${item.tokenSymbol}`}
                >
                  <TableCell className="text-center font-mono text-muted-foreground text-xs">
                    {String(item.overallRank || index + 1).padStart(2, '0')}
                  </TableCell>
                  <TableCell className="min-w-[140px] max-w-[200px]">
                    <div className="flex items-center gap-2">
                      {item.tokenImage ? (
                        <img
                          src={item.tokenImage}
                          alt={item.tokenName}
                          className="w-8 h-8 rounded bg-secondary ring-2 ring-primary/10 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center ring-2 ring-primary/10 flex-shrink-0">
                          <span className="font-bold text-xs font-mono">
                            {item.tokenSymbol.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-1">
                          <span className="truncate text-sm">{item.tokenName}</span>
                          {item.chain && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 font-mono opacity-60 flex-shrink-0">
                              {item.chain}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-primary/70 uppercase font-mono truncate">
                          ${item.tokenSymbol}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell w-16 min-w-[64px]">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 font-mono ${
                        item.tokenType === 'MEMECOIN'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {item.tokenType === 'MEMECOIN' ? 'MEME' : 'UTIL'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center cursor-help">
                          <span className={`text-lg font-bold font-mono ${getScoreColorByTier(item.latestTier)}`}>
                            {formatScore(item.latestScore)}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDate(item.latestAnalysisDate)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="cyber-card border-primary/20">
                        <p className="text-sm font-mono">Latest: {new Date(item.latestAnalysisDate).toLocaleDateString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`${getTierBadgeStyle(item.latestTier)} font-mono font-bold`}>
                      {item.latestTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {(() => {
                      const upsideInfo = getUpsideTierInfo(item.upsideTier, item.upsideMultiple);
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded border ${upsideInfo.bg} cursor-help min-w-[52px]`}>
                              <span className={`text-[11px] font-mono font-bold ${upsideInfo.color}`}>{upsideInfo.display}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="cyber-card border-primary/20 max-w-[200px]">
                            <p className="text-xs font-mono">Potential upside: {item.upsideTier || 'Unknown'}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-center hidden lg:table-cell">
                    {item.asymmetryScore !== null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-sm font-mono font-bold ${getScoreColorByTier(item.latestTier)}`}>
                            {formatComponentScore(item.asymmetryScore)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="cyber-card border-primary/20">
                          <p className="text-sm font-mono">Asymmetry Score (out of 25)</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm font-mono">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    {(() => {
                      const trendInfo = getTrendInfo(item.scoreTrend ?? null);
                      const TrendIcon = trendInfo.icon;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded border ${trendInfo.bg} cursor-help min-w-[52px]`}>
                              <TrendIcon className={`w-3 h-3 ${trendInfo.color}`} />
                              <span className={`text-[11px] font-mono font-bold ${trendInfo.color}`}>{trendInfo.display}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="cyber-card border-primary/20">
                            <p className="text-sm font-mono">{trendInfo.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {cleanedNarrative ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-help">
                            <span className="text-sm truncate max-w-[180px]">{cleanedNarrative}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] cyber-card border-primary/20">
                          {/* Show primary narrative as breadcrumb if different from sub-narrative */}
                          {cleanedPrimaryNarrative && cleanedPrimaryNarrative !== cleanedNarrative && (
                            <p className="text-xs text-muted-foreground mb-1">{cleanedPrimaryNarrative}</p>
                          )}
                          <p className="text-sm font-mono">{cleanedNarrative}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm font-mono">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-2" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/token/${item.tokenSymbol}`}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4 text-primary" />
                      </Button>
                    </Link>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Scoring Methodology Modal */}
      <ScoringMethodologyModal
        isOpen={showMethodologyModal}
        onClose={() => setShowMethodologyModal(false)}
      />
    </div>
  );
}
