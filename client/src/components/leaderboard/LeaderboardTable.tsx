import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowUpDown, ExternalLink, Clock, BarChart3, Terminal, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
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

interface LeaderboardTableProps {
  items: AggregatedLeaderboardItem[];
  sortBy: "score7d" | "score30d" | "runs7d" | "latestAnalysis";
  order: "asc" | "desc";
  onSort: (field: "score7d" | "score30d" | "runs7d" | "latestAnalysis") => void;
}

// Score color helpers based on spec: red (<40), yellow (40-54), light green (55-69), green (70-84), gold (85+)
function getScoreColor(score: number): string {
  if (score >= 85) return "text-amber-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getTierBadgeStyle(tier: string): string {
  switch (tier) {
    case "S+":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
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

export function LeaderboardTable({ items, sortBy, order, onSort }: LeaderboardTableProps) {
  const SortButton = ({ field, children }: { field: typeof sortBy; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(field)}
      className={`h-auto p-0 font-mono text-[10px] tracking-wider hover:bg-transparent ${sortBy === field ? "text-primary" : ""}`}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="cyber-card rounded border border-primary/20 overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10 bg-primary/5">
        <Terminal className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-mono text-primary tracking-wider">TOKEN_RANKINGS</span>
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-muted-foreground">{items.length} ENTRIES</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-primary/10 hover:bg-transparent">
            <TableHead className="w-12 text-center font-mono text-[10px] tracking-wider">#</TableHead>
            <TableHead className="font-mono text-[10px] tracking-wider">TOKEN</TableHead>
            <TableHead className="text-center font-mono text-[10px] tracking-wider">
              <SortButton field="score7d">7D_SCORE</SortButton>
            </TableHead>
            <TableHead className="text-center hidden sm:table-cell font-mono text-[10px] tracking-wider">
              <SortButton field="score30d">30D_SCORE</SortButton>
            </TableHead>
            <TableHead className="text-center font-mono text-[10px] tracking-wider">TIER</TableHead>
            <TableHead className="text-center hidden md:table-cell font-mono text-[10px] tracking-wider">
              <SortButton field="runs7d">RUNS</SortButton>
            </TableHead>
            <TableHead className="hidden lg:table-cell font-mono text-[10px] tracking-wider">NARRATIVE</TableHead>
            <TableHead className="text-center hidden md:table-cell font-mono text-[10px] tracking-wider">
              <SortButton field="latestAnalysis">LATEST</SortButton>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const score7d = item.score7d || 0;
            const score30d = item.score30d || 0;
            const cleanedNarrative = cleanNarrative(item.latestNarrative);
            const confidenceInfo = getConfidenceInfo(item.confidence || 'low');
            const ConfidenceIcon = confidenceInfo.icon;

            return (
              <motion.tr
                key={item.tokenId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                className="border-primary/5 transition-colors hover:bg-primary/5 cursor-pointer group"
                onClick={() => window.location.href = `/analyze/${item.latestAnalysisId}`}
              >
                <TableCell className="text-center font-mono text-muted-foreground text-xs">
                  {String(index + 1).padStart(2, '0')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.tokenImage ? (
                      <img
                        src={item.tokenImage}
                        alt={item.tokenName}
                        className="w-9 h-9 rounded bg-secondary ring-2 ring-primary/10"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center ring-2 ring-primary/10">
                        <span className="font-bold text-xs font-mono">
                          {item.tokenSymbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate max-w-[120px]">{item.tokenName}</span>
                        {item.chain && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono opacity-60">
                            {item.chain}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-primary/70 uppercase font-mono">
                        ${item.tokenSymbol}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center gap-1 cursor-help">
                        <span className={`text-lg font-bold font-mono ${getScoreColor(score7d)}`}>
                          {score7d.toFixed(1)}
                        </span>
                        <ConfidenceIcon className={`w-3 h-3 ${confidenceInfo.color}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="cyber-card border-primary/20">
                      <p className="text-sm font-mono">{confidenceInfo.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  <span className={`text-sm font-mono ${getScoreColor(score30d)} opacity-70`}>
                    {score30d.toFixed(1)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`${getTierBadgeStyle(item.latestTier)} font-mono font-bold`}>
                    {item.latestTier}
                  </Badge>
                </TableCell>
                <TableCell className="text-center hidden md:table-cell">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center gap-1 cursor-help">
                        <BarChart3 className="w-3 h-3 text-primary/70" />
                        <span className="font-mono text-sm text-primary/90">
                          {item.runs7d}/{item.runs30d}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="cyber-card border-primary/20">
                      <p className="text-sm font-mono">7D: {item.runs7d} runs | 30D: {item.runs30d} runs</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {cleanedNarrative ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-help">
                          <span className="text-sm truncate max-w-[180px]">{cleanedNarrative}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] cyber-card border-primary/20">
                        <p className="text-sm font-mono">{cleanedNarrative}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-sm font-mono">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center hidden md:table-cell">
                  <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.latestAnalysisDate)}
                  </span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link href={`/analyze/${item.latestAnalysisId}`}>
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
  );
}
