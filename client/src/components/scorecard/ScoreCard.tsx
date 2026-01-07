import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  XCircle,
  Brain,
  Target,
  Flame,
  Shield,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  Loader2,
  CheckCircle,
  Sparkles,
  Zap,
  Users,
  TrendingUpIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TokenAnalysis, ModelScores } from "@shared/schema";

interface ScoreCardProps {
  analysis: TokenAnalysis;
  isPolling?: boolean;
  // Progress info for loading screen
  elapsedSeconds?: number;
  nodesCompleted?: number;
  currentNode?: string;
}

// Score color helpers based on spec: red (<40), yellow (40-54), light green (55-69), green (70-84), gold (85+)
function getScoreColor(score: number): string {
  if (score >= 85) return "text-amber-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 85) return "bg-amber-400/20 border-amber-400/30";
  if (score >= 70) return "bg-green-400/20 border-green-400/30";
  if (score >= 55) return "bg-emerald-400/20 border-emerald-400/30";
  if (score >= 40) return "bg-yellow-400/20 border-yellow-400/30";
  return "bg-red-400/20 border-red-400/30";
}

function getScoreGradient(score: number): string {
  if (score >= 85) return "from-amber-500 to-yellow-500";
  if (score >= 70) return "from-green-500 to-emerald-500";
  if (score >= 55) return "from-emerald-500 to-teal-500";
  if (score >= 40) return "from-yellow-500 to-orange-500";
  return "from-red-500 to-pink-500";
}

function getTierBadgeStyle(tier: string): { bg: string; text: string } {
  switch (tier) {
    case "S+":
      return { bg: "bg-amber-500/20 border-amber-500/50", text: "text-amber-400" };
    case "S":
      return { bg: "bg-green-500/20 border-green-500/50", text: "text-green-400" };
    case "A":
      return { bg: "bg-emerald-500/20 border-emerald-500/50", text: "text-emerald-400" };
    case "B":
      return { bg: "bg-yellow-500/20 border-yellow-500/50", text: "text-yellow-400" };
    default:
      return { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400" };
  }
}

function getRecommendationStyle(rec: string | null): { bg: string; text: string; label: string } {
  const recommendation = rec?.toUpperCase() || "HOLD";
  if (recommendation.includes("BUY")) {
    return { bg: "bg-green-500/20", text: "text-green-400", label: "BUY" };
  }
  if (recommendation.includes("AVOID") || recommendation.includes("SELL")) {
    return { bg: "bg-red-500/20", text: "text-red-400", label: "AVOID" };
  }
  return { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "HOLD" };
}

// Better exit liquidity display
function getExitLiquidityDisplay(side: string | null): { bg: string; text: string; label: string; description: string } {
  const winningSide = side?.toUpperCase() || "AT_RISK";
  if (winningSide.includes("USER")) {
    return {
      bg: "bg-green-500/10 border border-green-500/30",
      text: "text-green-400",
      label: "Favorable",
      description: "You're positioned on the winning side"
    };
  }
  if (winningSide.includes("EXIT") || winningSide.includes("LIQ")) {
    return {
      bg: "bg-red-500/10 border border-red-500/30",
      text: "text-red-400",
      label: "Unfavorable",
      description: "Risk of being exit liquidity"
    };
  }
  return {
    bg: "bg-yellow-500/10 border border-yellow-500/30",
    text: "text-yellow-400",
    label: "Neutral",
    description: "Mixed signals on positioning"
  };
}

function formatPrice(price: string | null): string {
  if (!price) return "N/A";
  const num = parseFloat(price);
  if (isNaN(num)) return "N/A";
  if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(8)}`;
}

function formatMarketCap(cap: string | null): string {
  if (!cap) return "N/A";
  const num = parseFloat(cap);
  if (isNaN(num)) return "N/A";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Component to format and display the full Gumloop analysis output
function FormattedAnalysis({ content }: { content: string }) {
  // Parse markdown-like content into styled sections
  const sections = content.split(/(?=^##?\s)/m).filter(Boolean);

  return (
    <div className="space-y-6">
      {sections.map((section, idx) => {
        // Check if this is a header section
        const headerMatch = section.match(/^(#{1,3})\s*(\d+\.)?\s*(.+?)[\n\r]/);

        if (headerMatch) {
          const level = headerMatch[1].length;
          const title = headerMatch[3].replace(/\*\*/g, '').trim();
          const body = section.slice(headerMatch[0].length).trim();

          return (
            <div key={idx} className="space-y-3">
              <h3 className={`font-semibold ${level === 1 ? 'text-lg text-primary' : level === 2 ? 'text-base text-primary/90' : 'text-sm text-primary/80'}`}>
                {title}
              </h3>
              <FormattedContent content={body} />
            </div>
          );
        }

        return <FormattedContent key={idx} content={section} />;
      })}
    </div>
  );
}

// Helper component to format content within sections
function FormattedContent({ content }: { content: string }) {
  // Clean up markdown artifacts
  const cleaned = content
    .replace(/\*\*\*/g, '')
    .replace(/---+/g, '')
    .trim();

  if (!cleaned) return null;

  // Check if this is a table
  if (cleaned.includes('|') && cleaned.split('\n').some(line => line.includes('|') && line.includes('---'))) {
    return <FormattedTable content={cleaned} />;
  }

  // Check if this contains a numbered list
  const lines = cleaned.split('\n');
  const hasList = lines.some(line => /^\d+\.\s/.test(line.trim()) || /^[-•]\s/.test(line.trim()));

  if (hasList) {
    return (
      <div className="space-y-2">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Numbered list item
          const numberedMatch = trimmed.match(/^(\d+)\.\s*\*?\*?(.+?)\*?\*?\s*$/);
          if (numberedMatch) {
            return (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-primary font-medium">{numberedMatch[1]}.</span>
                <span className="text-muted-foreground">{numberedMatch[2].replace(/\*\*/g, '')}</span>
              </div>
            );
          }

          // Bullet list item
          const bulletMatch = trimmed.match(/^[-•]\s*(.+)$/);
          if (bulletMatch) {
            return (
              <div key={i} className="flex gap-2 text-sm ml-2">
                <span className="text-primary">•</span>
                <span className="text-muted-foreground">{bulletMatch[1].replace(/\*\*/g, '')}</span>
              </div>
            );
          }

          // Bold text as sub-header
          const boldMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
          if (boldMatch) {
            return (
              <div key={i} className="text-sm">
                <span className="font-medium text-foreground">{boldMatch[1]}: </span>
                <span className="text-muted-foreground">{boldMatch[2]}</span>
              </div>
            );
          }

          return <p key={i} className="text-sm text-muted-foreground">{trimmed.replace(/\*\*/g, '')}</p>;
        })}
      </div>
    );
  }

  // Regular paragraph content
  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      {cleaned.replace(/\*\*/g, '')}
    </p>
  );
}

// Helper component to format tables
function FormattedTable({ content }: { content: string }) {
  const lines = content.split('\n').filter(line => line.includes('|'));
  if (lines.length < 2) return <p className="text-sm text-muted-foreground">{content}</p>;

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);

  // Find data rows (skip separator line)
  const dataLines = lines.filter(line => !line.includes('---'));
  const rows = dataLines.slice(1).map(line =>
    line.split('|').map(cell => cell.trim().replace(/\*\*/g, '')).filter(Boolean)
  );

  if (headers.length === 0 || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{content}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((header, i) => (
              <th key={i} className="text-left py-2 px-3 text-muted-foreground font-medium">
                {header.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Loading screen component with animated progress
interface LoadingScreenProps {
  analysis: TokenAnalysis;
  startTime: number;
  elapsedSeconds?: number;
  nodesCompleted?: number;
  currentNode?: string;
}

function AnalysisLoadingScreen({ analysis, startTime, elapsedSeconds: serverElapsed, nodesCompleted }: LoadingScreenProps) {
  // Calculate elapsed time from analysis creation time (persists across refresh)
  const analysisStartTime = new Date(analysis.createdAt).getTime();
  const initialElapsed = Math.floor((Date.now() - analysisStartTime) / 1000);

  const [localElapsed, setLocalElapsed] = useState(initialElapsed);
  const [estimatedTotalTime, setEstimatedTotalTime] = useState<number | null>(null);

  // Use server elapsed time if available, otherwise use local tracking from createdAt
  const elapsedTime = serverElapsed ?? localElapsed;

  // Initialize progress based on elapsed time
  const fallbackTotal = 15 * 60;
  const initialProgress = Math.min(90, (initialElapsed / fallbackTotal) * 100);
  const [progress, setProgress] = useState(Math.max(5, initialProgress));
  const [currentStep, setCurrentStep] = useState(() => {
    return Math.min(7, Math.floor((initialProgress / 100) * 8));
  });

  const steps = [
    { label: "Fetching market data", icon: TrendingUpIcon },
    { label: "ChatGPT analyzing", icon: Brain },
    { label: "Claude analyzing", icon: Brain },
    { label: "Gemini analyzing", icon: Brain },
    { label: "Grok analyzing", icon: Brain },
    { label: "Building consensus", icon: Users },
    { label: "Computing game theory", icon: Activity },
    { label: "Finalizing score", icon: CheckCircle },
  ];

  // Estimated total nodes in the Gumloop workflow
  const estimatedTotalNodes = 12;

  useEffect(() => {
    // Only use local timer if server elapsed isn't available
    if (serverElapsed === undefined) {
      const interval = setInterval(() => {
        setLocalElapsed(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [serverElapsed]);

  useEffect(() => {
    // Calculate progress and estimated time based on nodes completed
    if (nodesCompleted !== undefined && nodesCompleted > 0 && elapsedTime > 0) {
      // Calculate progress percentage
      const nodeProgress = Math.min(95, (nodesCompleted / estimatedTotalNodes) * 100);
      setProgress(nodeProgress);

      // Estimate total time based on current pace
      // If we've completed X nodes in Y seconds, total time = Y / (X/totalNodes)
      const progressFraction = nodesCompleted / estimatedTotalNodes;
      if (progressFraction > 0.05) { // Only estimate after some progress
        const projectedTotal = Math.round(elapsedTime / progressFraction);
        // Clamp to reasonable range (5-30 minutes)
        const clampedTotal = Math.max(5 * 60, Math.min(30 * 60, projectedTotal));
        setEstimatedTotalTime(clampedTotal);
      }

      // Map nodes to steps
      const stepIndex = Math.min(steps.length - 1, Math.floor((nodesCompleted / estimatedTotalNodes) * steps.length));
      setCurrentStep(stepIndex);
    } else {
      // Fall back to time-based progress - assume ~15 min average
      const fallbackTotal = 15 * 60;
      const baseProgress = Math.min(90, (elapsedTime / fallbackTotal) * 100);
      const randomVariance = Math.sin(elapsedTime * 0.1) * 2;
      setProgress(Math.min(90, baseProgress + randomVariance));

      // Update current step based on progress
      const stepIndex = Math.min(steps.length - 1, Math.floor((baseProgress / 100) * steps.length));
      setCurrentStep(stepIndex);

      // Use fallback estimate if no node data
      if (estimatedTotalTime === null) {
        setEstimatedTotalTime(fallbackTotal);
      }
    }
  }, [elapsedTime, nodesCompleted, estimatedTotalTime]);

  // Calculate remaining time
  const totalTime = estimatedTotalTime ?? 15 * 60; // Default 15 min if no estimate
  const remainingSeconds = Math.max(0, totalTime - elapsedTime);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-8"
    >
      {/* Token Header */}
      <div className="flex items-center gap-4 mb-8">
        {analysis.tokenImage ? (
          <img
            src={analysis.tokenImage}
            alt={analysis.tokenName}
            className="w-20 h-20 rounded-2xl bg-secondary ring-4 ring-primary/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-4 ring-primary/20">
            <span className="font-bold text-2xl">
              {analysis.tokenSymbol.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{analysis.tokenName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground uppercase font-mono">${analysis.tokenSymbol}</span>
            {analysis.chain && (
              <Badge variant="outline" className="text-xs">{analysis.chain}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Progress Card */}
      <Card className="glass-card mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <motion.div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border-2 border-primary flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                </motion.div>
              </div>
              <div>
                <h3 className="font-semibold">Analyzing {analysis.tokenSymbol}</h3>
                <p className="text-sm text-muted-foreground">{steps[currentStep]?.label || "Processing..."}</p>
              </div>
            </div>
            <div className="text-right">
              {remainingSeconds <= 0 ? (
                <>
                  <div className="text-xl font-mono font-bold text-amber-400 animate-pulse">
                    Finalizing...
                  </div>
                  <div className="text-xs text-muted-foreground">almost done</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-mono font-bold text-primary">
                    {remainingMinutes}:{remainingSecs.toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-muted-foreground">estimated remaining</div>
                </>
              )}
            </div>
          </div>

          <Progress value={progress} className="h-3 mb-4" />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} elapsed</span>
            <span>{progress.toFixed(0)}% complete</span>
          </div>
        </CardContent>
      </Card>

      {/* Model Analysis Steps */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Multi-Model Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "ChatGPT", color: "emerald" },
              { name: "Claude", color: "orange" },
              { name: "Gemini", color: "blue" },
              { name: "Grok", color: "purple" },
            ].map((model, i) => {
              const isActive = currentStep >= i + 1 && currentStep <= i + 2;
              const isComplete = currentStep > i + 2;

              return (
                <motion.div
                  key={model.name}
                  className={`p-3 rounded-lg border transition-all ${
                    isComplete
                      ? `bg-${model.color}-500/10 border-${model.color}-500/30`
                      : isActive
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-secondary/50 border-white/5'
                  }`}
                  animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {isComplete ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className={`text-xs ${isComplete ? 'text-green-400' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isComplete ? 'Complete' : isActive ? 'Analyzing...' : 'Waiting'}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info text */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Our 4-LLM ensemble provides unbiased consensus scoring through game theory analysis.
        <br />
        <span className="text-xs">You can navigate away - we'll save your results.</span>
      </p>
    </motion.div>
  );
}

export function ScoreCard({ analysis, isPolling, elapsedSeconds, nodesCompleted, currentNode }: ScoreCardProps) {
  const [showRisks, setShowRisks] = useState(false);
  const [showModels, setShowModels] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [loadingStartTime] = useState(Date.now());

  const finalScore = parseFloat(analysis.finalScore as string) || 0;
  const priceChange24h = analysis.priceChange24h ? parseFloat(analysis.priceChange24h as string) : null;
  const priceChange7d = analysis.priceChange7d ? parseFloat(analysis.priceChange7d as string) : null;
  const narrativeHeat = analysis.narrativeHeat ? parseFloat(analysis.narrativeHeat as string) : null;
  const peakProximity = analysis.peakProximity ? parseFloat(analysis.peakProximity as string) : null;

  const tierStyle = getTierBadgeStyle(analysis.tier);
  const recStyle = getRecommendationStyle(analysis.recommendation);
  const exitStyle = getExitLiquidityDisplay(analysis.winningSide);
  const modelScores = analysis.modelScores as ModelScores | null;
  const coordinationRisks = analysis.coordinationRisks as string[] | null;
  const catalysts = analysis.catalysts as string[] | null;

  // Component scores - show all 6 components
  const scoreComponents = [
    { label: "Coordination", score: parseFloat(analysis.coordinationScore as string) || 0, max: 20, icon: Users },
    { label: "Schelling Rank", score: parseFloat(analysis.schellingRankScore as string) || 0, max: 15, icon: Target },
    { label: "Reflexivity", score: parseFloat(analysis.reflexivityScore as string) || 0, max: 15, icon: Activity },
    { label: "Virality", score: parseFloat(analysis.viralityScore as string) || 0, max: 15, icon: Zap },
    { label: "Asymmetry", score: parseFloat(analysis.asymmetryScore as string) || 0, max: 15, icon: TrendingUp },
    { label: "Game Theory", score: parseFloat(analysis.gameTheoryBonus as string) || 0, max: 20, icon: Brain },
  ];

  // Check if we have real component scores (for legacy data handling)
  const hasComponentScores = scoreComponents.some(c => c.score > 0);

  // Calculate total component score
  const totalComponentScore = scoreComponents.reduce((sum, c) => sum + c.score, 0);
  const maxComponentScore = scoreComponents.reduce((sum, c) => sum + c.max, 0);

  // All modifiers for the detailed display
  const allModifiers = [
    { label: "Phase", value: parseFloat(analysis.phaseModifier as string) || 0 },
    { label: "Narrative", value: parseFloat(analysis.narrativeModifier as string) || 0 },
    { label: "Exit Liquidity", value: parseFloat(analysis.exitLiquidityModifier as string) || 0 },
    { label: "Peak Proximity", value: parseFloat(analysis.peakProximityModifier as string) || 0 },
    { label: "Data Quality", value: parseFloat(analysis.dataQualityModifier as string) || 0 },
  ];

  // Only show modifiers that have non-zero values
  const modifiers = allModifiers.filter(m => m.value !== 0);

  // Calculate total modifiers
  const totalModifiersValue = modifiers.reduce((sum, m) => sum + m.value, 0);

  // Pending/Processing state - use the new loading screen
  if (analysis.status === "pending" || analysis.status === "processing") {
    return (
      <AnalysisLoadingScreen
        analysis={analysis}
        startTime={loadingStartTime}
        elapsedSeconds={elapsedSeconds}
        nodesCompleted={nodesCompleted}
        currentNode={currentNode}
      />
    );
  }

  // Failed state
  if (analysis.status === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">Analysis Failed</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          We couldn't complete the analysis for {analysis.tokenName}. Please try again.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left: Token Info */}
              <div className="flex items-start gap-4">
                {analysis.tokenImage ? (
                  <img
                    src={analysis.tokenImage}
                    alt={analysis.tokenName}
                    className="w-20 h-20 rounded-2xl bg-secondary"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <span className="font-bold text-2xl">
                      {analysis.tokenSymbol.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{analysis.tokenName}</h1>
                    {analysis.chain && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {analysis.chain}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-muted-foreground uppercase font-mono text-lg">
                      ${analysis.tokenSymbol.toUpperCase()}
                    </span>
                    <Badge className={`${tierStyle.bg} ${tierStyle.text} border font-bold text-sm px-3`}>
                      {analysis.tier}
                    </Badge>
                    <Badge className={`${recStyle.bg} ${recStyle.text} font-bold text-sm px-3`}>
                      {recStyle.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Center: Score Display */}
              <div className="flex-1 flex flex-col items-center justify-center lg:border-l lg:border-r border-white/10 px-6">
                <div className="text-sm text-muted-foreground mb-1">Game Theory Score</div>
                <div className={`text-6xl md:text-7xl font-bold font-mono bg-gradient-to-r ${getScoreGradient(finalScore)} bg-clip-text text-transparent`}>
                  {finalScore.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">out of 100</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {analysis.consensusLevel || "MIXED"} Consensus
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {analysis.confidence === 'H' ? 'High' : analysis.confidence === 'L' ? 'Low' : 'Medium'} Confidence
                  </Badge>
                </div>
              </div>

              {/* Right: Market Data */}
              <div className="grid grid-cols-2 gap-4 lg:w-56">
                <div>
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-lg font-mono font-medium">
                    {formatPrice(analysis.currentPrice as string)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Market Cap</div>
                  <div className="text-lg font-mono font-medium">
                    {formatMarketCap(analysis.marketCap as string)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">24h Change</div>
                  <div className={`text-lg font-mono font-medium flex items-center gap-1 ${
                    priceChange24h === null ? "text-muted-foreground" :
                    priceChange24h >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {priceChange24h !== null && (
                      priceChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                    {priceChange24h !== null ? `${priceChange24h.toFixed(2)}%` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">7d Change</div>
                  <div className={`text-lg font-mono font-medium flex items-center gap-1 ${
                    priceChange7d === null ? "text-muted-foreground" :
                    priceChange7d >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {priceChange7d !== null && (
                      priceChange7d >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                    {priceChange7d !== null ? `${priceChange7d.toFixed(2)}%` : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            {analysis.displaySummary && (
              <div className="mt-6 p-4 rounded-lg bg-secondary/30 border border-white/5">
                <p className="text-muted-foreground leading-relaxed">{analysis.displaySummary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Metrics Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {/* Phase */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Phase</span>
            </div>
            <div className="text-2xl font-bold font-mono">{analysis.phase || "?"}</div>
            <div className="text-sm text-muted-foreground">{analysis.phaseName || "Unknown"}</div>
          </CardContent>
        </Card>

        {/* Narrative */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Flame className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Narrative</span>
            </div>
            <div className="text-sm font-medium truncate" title={analysis.narrative || "Unknown"}>
              {analysis.narrative || "Unknown"}
            </div>
            {narrativeHeat !== null && (
              <div className="flex items-center gap-2 mt-1">
                <div className={`flex items-center gap-1 text-sm ${
                  narrativeHeat >= 7 ? "text-orange-400" :
                  narrativeHeat >= 4 ? "text-yellow-400" :
                  "text-muted-foreground"
                }`}>
                  <Flame className="w-3 h-3" />
                  <span className="font-mono">{narrativeHeat.toFixed(1)}/10</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peak Proximity - Only show if we have data */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Peak Proximity</span>
            </div>
            {peakProximity !== null ? (
              <>
                <div className={`text-2xl font-bold font-mono ${
                  peakProximity > 80 ? "text-red-400" :
                  peakProximity > 50 ? "text-yellow-400" :
                  "text-green-400"
                }`}>
                  {peakProximity.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {peakProximity > 80 ? "Near all-time high" :
                   peakProximity > 50 ? "Mid-range" :
                   "Far from peak"}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-muted-foreground">—</div>
                <div className="text-xs text-muted-foreground">Data unavailable</div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Exit Liquidity - Improved display */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Position</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${exitStyle.bg}`}>
              <span className={`text-sm font-bold ${exitStyle.text}`}>{exitStyle.label}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{exitStyle.description}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Model Consensus - Show by default */}
      {modelScores && Object.keys(modelScores).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-accent" />
                4-Model Consensus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {modelScores.gpt !== undefined && (
                  <div className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.gpt)}`}>
                    <div className="text-xs text-muted-foreground mb-1">ChatGPT</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.gpt)}`}>
                      {modelScores.gpt.toFixed(1)}
                    </div>
                  </div>
                )}
                {modelScores.claude !== undefined && (
                  <div className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.claude)}`}>
                    <div className="text-xs text-muted-foreground mb-1">Claude</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.claude)}`}>
                      {modelScores.claude.toFixed(1)}
                    </div>
                  </div>
                )}
                {modelScores.gemini !== undefined && (
                  <div className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.gemini)}`}>
                    <div className="text-xs text-muted-foreground mb-1">Gemini</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.gemini)}`}>
                      {modelScores.gemini.toFixed(1)}
                    </div>
                  </div>
                )}
                {modelScores.grok !== undefined && (
                  <div className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.grok)}`}>
                    <div className="text-xs text-muted-foreground mb-1">Grok</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.grok)}`}>
                      {modelScores.grok.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Score Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Score Breakdown
              </div>
              {hasComponentScores && (
                <span className="text-sm font-normal text-muted-foreground">
                  {totalComponentScore.toFixed(1)} / {maxComponentScore} pts
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasComponentScores ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scoreComponents.map((component) => {
                  const percentage = component.max > 0 ? (component.score / component.max) * 100 : 0;
                  const Icon = component.icon;
                  return (
                    <div key={component.label} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{component.label}</span>
                        </div>
                        <span className={`font-mono font-bold ${getScoreColor(percentage)}`}>
                          {component.score.toFixed(1)}/{component.max}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Score breakdown unavailable for this analysis</p>
                <p className="text-xs mt-1">This analysis was run with an earlier version</p>
              </div>
            )}

            {/* Modifiers */}
            {modifiers.length > 0 && hasComponentScores && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-muted-foreground">Score Modifiers</div>
                  <div className={`text-sm font-mono font-bold ${
                    totalModifiersValue > 0 ? "text-green-400" :
                    totalModifiersValue < 0 ? "text-red-400" :
                    "text-muted-foreground"
                  }`}>
                    Total: {totalModifiersValue > 0 ? "+" : ""}{totalModifiersValue.toFixed(1)}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {modifiers.map((mod) => (
                    <div
                      key={mod.label}
                      className={`p-2 rounded-lg border text-center ${
                        mod.value > 0
                          ? "bg-green-500/10 border-green-500/30"
                          : mod.value < 0
                            ? "bg-red-500/10 border-red-500/30"
                            : "bg-secondary/50 border-white/10"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground">{mod.label}</div>
                      <div className={`text-sm font-mono font-bold ${
                        mod.value > 0 ? "text-green-400" :
                        mod.value < 0 ? "text-red-400" :
                        "text-muted-foreground"
                      }`}>
                        {mod.value > 0 ? "+" : ""}{mod.value.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Collapsible Sections */}
      <div className="space-y-4">
        {/* Coordination Risks */}
        {coordinationRisks && coordinationRisks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Collapsible open={showRisks} onOpenChange={setShowRisks}>
              <Card className="glass-card">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        Key Risks ({coordinationRisks.length})
                      </div>
                      {showRisks ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ul className="space-y-3">
                      {coordinationRisks.map((risk, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="text-orange-400 font-bold">{i + 1}.</span>
                          <span className="text-muted-foreground">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}

        {/* Full Reasoning */}
        {(analysis.rawGumloopResponse || analysis.reasoning) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
              <Card className="glass-card">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-white/5 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        Full Analysis
                      </div>
                      {showReasoning ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="prose prose-invert prose-sm max-w-none">
                      {analysis.rawGumloopResponse ? (
                        <FormattedAnalysis content={analysis.rawGumloopResponse} />
                      ) : (
                        <>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {analysis.reasoning}
                          </p>
                          {analysis.verdict && analysis.verdict !== analysis.reasoning && (
                            <>
                              <h4 className="text-sm font-semibold mt-4 mb-2">Verdict</h4>
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {analysis.verdict}
                              </p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}
      </div>

      {/* Footer with timestamp */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center text-xs text-muted-foreground pt-4"
      >
        Analysis completed {formatDate(analysis.updatedAt)}
      </motion.div>
    </div>
  );
}
