import { motion, AnimatePresence } from "framer-motion";
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
  Lightbulb,
  MessageCircle,
  Twitter,
  Unlock,
  Building,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  HelpCircle,
  Share2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ShareModal } from "./ShareModal";
import { ModelAnalysisModal } from "./ModelAnalysisModal";
import type { TokenAnalysis, ModelScores, ModelAnalyses } from "@shared/schema";

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
  // Purple for elite scores, green for good, yellow for medium, red for low
  if (score >= 85) return "bg-purple-400/20 border-purple-400/30";
  if (score >= 70) return "bg-green-400/20 border-green-400/30";
  if (score >= 55) return "bg-yellow-400/20 border-yellow-400/30";
  return "bg-red-400/20 border-red-400/30";
}

function getScoreGradient(score: number): string {
  // Purple gradient for elite, green for good, yellow for medium, red for low
  if (score >= 85) return "from-purple-500 to-violet-500";
  if (score >= 70) return "from-green-500 to-emerald-500";
  if (score >= 55) return "from-yellow-500 to-orange-500";
  return "from-red-500 to-pink-500";
}

function getTierBadgeStyle(tier: string): { bg: string; text: string } {
  switch (tier) {
    case "S+":
      return { bg: "bg-purple-500/20 border-purple-500/50", text: "text-purple-400" };
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

// Expandable text component for fields that may be truncated
function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };

    checkTruncation();
    // Recheck on window resize
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [text]);

  if (isExpanded) {
    return (
      <div className="relative">
        <div className={`${className} break-words`}>
          {text}
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-1"
        >
          <Minimize2 className="w-3 h-3" />
          Show less
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={textRef}
        className={`${className} truncate`}
        title={text}
      >
        {text}
      </div>
      {isTruncated && (
        <button
          onClick={() => setIsExpanded(true)}
          className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-1"
        >
          <Maximize2 className="w-3 h-3" />
          Show full
        </button>
      )}
    </div>
  );
}

// Extract OUTPUT SUMMARY section from the full response text
function extractOutputSummary(text: string): string {
  // Look for OUTPUT SUMMARY section markers
  const summaryPatterns = [
    /(?:^|\n)(?:##?\s*)?(?:\*\*)?OUTPUT\s*SUMMARY(?:\*\*)?[\s:]*\n([\s\S]*?)(?=\n##|\n---|\n\*\*[A-Z]|$)/i,
    /(?:^|\n)OUTPUT\s*SUMMARY[:\s]*\n([\s\S]*?)$/i,
    /(?:^|\n)---+\s*\n\s*OUTPUT\s*SUMMARY[:\s]*\n([\s\S]*?)$/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 50) {
      return match[1].trim();
    }
  }

  // If no OUTPUT SUMMARY found, return empty string (will fall back to full text)
  return "";
}

// Component to format and display the full Gumloop analysis output
function FormattedAnalysis({ content }: { content: string }) {
  // Extract just the OUTPUT SUMMARY section if present
  const outputSummary = extractOutputSummary(content);
  const displayContent = outputSummary || content;

  // Parse markdown-like content into styled sections
  const sections = displayContent.split(/(?=^##?\s)/m).filter(Boolean);

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

  // OPTIMAL SOLUTION: Start with realistic 25-minute estimate
  // Key insight: Never increase the displayed remaining time - only decrease or hold steady
  const DEFAULT_TOTAL_TIME = 25 * 60; // 25 minutes - based on actual Gumloop phase timing

  // Track the minimum remaining time we've ever calculated - we'll never show MORE than this
  const [minRemainingEverShown, setMinRemainingEverShown] = useState<number>(() => {
    // On initial load, calculate based on elapsed time
    return Math.max(0, DEFAULT_TOTAL_TIME - initialElapsed);
  });

  // Use server elapsed time if available, otherwise use local tracking from createdAt
  const elapsedTime = serverElapsed ?? localElapsed;

  // Initialize progress based on elapsed time with 25-minute assumption (linear)
  const initialProgress = Math.min(98, (initialElapsed / DEFAULT_TOTAL_TIME) * 100);
  const [progress, setProgress] = useState(Math.max(2, initialProgress));

  // Define the actual pipeline phases based on elapsed TIME (not eased progress)
  // Phase time thresholds in seconds (25 min = 1500 sec total):
  // - Collecting Data: 0-12 min (0-720 sec) - Gathering market data & social signals
  // - LLM Analysis: 12-18 min (720-1080 sec) - 4 AI models analyzing in parallel
  // - Cross-Validation: 18-23 min (1080-1380 sec) - Models checking each other's findings
  // - Score Aggregation: 23-25 min (1380-1500 sec) - Computing final consensus score
  const PHASE_TIME_DATA_COLLECTION = 12 * 60;  // 12 minutes in seconds
  const PHASE_TIME_LLM_ANALYSIS = 18 * 60;     // 18 minutes (12 + 6)
  const PHASE_TIME_CROSS_VALIDATION = 23 * 60; // 23 minutes (18 + 5)

  // Determine current phase based on elapsed TIME (not progress bar position)
  const getCurrentPhase = (elapsedSec: number) => {
    if (elapsedSec < PHASE_TIME_DATA_COLLECTION) return 0; // Data Collection
    if (elapsedSec < PHASE_TIME_LLM_ANALYSIS) return 1;    // Parallel LLM Analysis
    if (elapsedSec < PHASE_TIME_CROSS_VALIDATION) return 2; // Cross-Validation
    return 3;                                               // Final Aggregation
  };

  const [currentPhase, setCurrentPhase] = useState(() => getCurrentPhase(initialElapsed));

  const phases = [
    { label: "Collecting Data", description: "Gathering market data & social signals", time: "~12 min", icon: TrendingUpIcon },
    { label: "LLM Analysis", description: "4 AI models analyzing in parallel", time: "~6 min", icon: Brain },
    { label: "Cross-Validation", description: "Models checking each other's findings", time: "~5 min", icon: Users },
    { label: "Score Aggregation", description: "Computing final consensus score", time: "~2 min", icon: CheckCircle },
  ];

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
    // Calculate progress based on elapsed time with 25-minute baseline
    // Use linear progress for accurate time representation
    const linearProgress = elapsedTime / DEFAULT_TOTAL_TIME;
    const progressPercent = Math.max(2, Math.min(98, linearProgress * 100));

    setProgress(progressPercent);

    // Update current phase based on elapsed TIME (not eased progress)
    setCurrentPhase(getCurrentPhase(elapsedTime));

    // Calculate remaining time - KEY: never increase from what we've shown before
    const calculatedRemaining = Math.max(0, DEFAULT_TOTAL_TIME - elapsedTime);

    // Only update minRemainingEverShown if the new value is LOWER
    // This ensures the timer only goes down, never up
    setMinRemainingEverShown(prev => Math.min(prev, calculatedRemaining));
  }, [elapsedTime]);

  // Use the minimum remaining time we've ever calculated
  // This ensures users never see the timer go UP
  const remainingSeconds = minRemainingEverShown;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;

  // Show "Finalizing..." if we've exceeded our estimate but analysis isn't done
  const isPastEstimate = elapsedTime > DEFAULT_TOTAL_TIME;

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
                <p className="text-sm text-muted-foreground">{phases[currentPhase]?.label || "Processing..."}</p>
              </div>
            </div>
            <div className="text-right">
              {isPastEstimate || remainingSeconds <= 0 ? (
                <>
                  <div className="text-xl font-mono font-bold text-amber-400 animate-pulse">
                    Finalizing...
                  </div>
                  <div className="text-xs text-muted-foreground">almost done</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-mono font-bold text-primary">
                    ~{remainingMinutes}:{remainingSecs.toString().padStart(2, '0')}
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

      {/* Pipeline Phases */}
      <Card className="glass-card mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phases.map((phase, i) => {
              const isComplete = currentPhase > i;
              const isActive = currentPhase === i;
              const PhaseIcon = phase.icon;

              return (
                <div
                  key={phase.label}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isComplete
                      ? 'bg-green-500/10 border-green-500/30'
                      : isActive
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-secondary/30 border-white/5'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isComplete
                      ? 'bg-green-500/20'
                      : isActive
                        ? 'bg-primary/20'
                        : 'bg-secondary/50'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <PhaseIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        isComplete ? 'text-green-400' : isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {phase.label}
                      </span>
                      <span className="text-xs text-muted-foreground/60 font-mono">
                        {phase.time}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{phase.description}</div>
                  </div>
                  {isActive && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-xs text-primary font-mono"
                    >
                      IN PROGRESS
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4-LLM Ensemble Status */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            4-LLM Consensus Engine
            <Badge variant="outline" className="text-xs ml-auto">
              {currentPhase >= 2 ? "Cross-Checking" : currentPhase >= 1 ? "Analyzing" : "Standby"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "ChatGPT-5.2", color: "emerald", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/30", textClass: "text-emerald-400" },
              { name: "Claude Opus 4.5", color: "orange", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/30", textClass: "text-orange-400" },
              { name: "Gemini 3 Pro", color: "blue", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/30", textClass: "text-blue-400" },
              { name: "Grok 4", color: "purple", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/30", textClass: "text-purple-400" },
            ].map((model) => {
              // Models are in standby during data collection (phase 0)
              // All models analyze in parallel during phase 1
              // Models cross-check during phase 2
              // Models provide final input during phase 3
              const isStandby = currentPhase < 1;
              const isAnalyzing = currentPhase === 1;
              const isCrossChecking = currentPhase === 2;
              const isComplete = currentPhase >= 3;

              return (
                <motion.div
                  key={model.name}
                  className={`p-3 rounded-lg border transition-all ${
                    isComplete
                      ? `${model.bgClass} ${model.borderClass}`
                      : isAnalyzing || isCrossChecking
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-secondary/50 border-white/5'
                  }`}
                  animate={(isAnalyzing || isCrossChecking) ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5, delay: Math.random() * 0.5 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${isComplete ? model.textClass : ''}`}>{model.name}</span>
                    {isComplete ? (
                      <CheckCircle className={`w-4 h-4 ${model.textClass}`} />
                    ) : (isAnalyzing || isCrossChecking) ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className={`text-xs ${
                    isComplete ? model.textClass :
                    isCrossChecking ? 'text-accent' :
                    isAnalyzing ? 'text-primary' :
                    'text-muted-foreground'
                  }`}>
                    {isComplete ? 'Consensus Ready' :
                     isCrossChecking ? 'Cross-Checking' :
                     isAnalyzing ? 'Analyzing...' :
                     'Standby'}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Cross-checking explanation when in that phase */}
          {currentPhase === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/30"
            >
              <div className="flex items-center gap-2 text-accent text-sm">
                <Users className="w-4 h-4" />
                <span className="font-medium">Cross-Validation in Progress</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Each AI is reviewing the others' analyses to identify blind spots and build consensus.
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Info text */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Our 4-LLM ensemble cross-validates findings to eliminate bias and provide trusted consensus scores.
        <br />
        <span className="text-xs">Analysis typically takes ~25 minutes. You can navigate away - we'll save your results.</span>
      </p>
    </motion.div>
  );
}

export function ScoreCard({ analysis, isPolling, elapsedSeconds, nodesCompleted, currentNode }: ScoreCardProps) {
  const [showRisks, setShowRisks] = useState(false);
  const [showModels, setShowModels] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gpt' | 'claude' | 'gemini' | 'grok' | null>(null);

  const finalScore = parseFloat(analysis.finalScore as string) || 0;
  const priceChange24h = analysis.priceChange24h ? parseFloat(analysis.priceChange24h as string) : null;
  const priceChange7d = analysis.priceChange7d ? parseFloat(analysis.priceChange7d as string) : null;
  const narrativeHeat = analysis.narrativeHeat ? parseFloat(analysis.narrativeHeat as string) : null;
  const peakProximity = analysis.peakProximity ? parseFloat(analysis.peakProximity as string) : null;

  const tierStyle = getTierBadgeStyle(analysis.tier);
  const recStyle = getRecommendationStyle(analysis.recommendation);
  const exitStyle = getExitLiquidityDisplay(analysis.winningSide);
  const modelScores = analysis.modelScores as ModelScores | null;
  const modelAnalyses = analysis.modelAnalyses as ModelAnalyses | null;
  const coordinationRisks = analysis.coordinationRisks as string[] | null;
  const catalysts = analysis.catalysts as string[] | null;

  // Token type - UTILITY or MEMECOIN (default to UTILITY)
  const tokenType = (analysis.tokenType as string) || 'UTILITY';
  const isMemecoin = tokenType === 'MEMECOIN';

  // Component scores - show all 6 components
  const scoreComponents = [
    { label: "Coordination", score: parseFloat(analysis.coordinationScore as string) || 0, max: 20, icon: Users },
    { label: "Schelling Rank", score: parseFloat(analysis.schellingRankScore as string) || 0, max: 10, icon: Target },
    { label: "Reflexivity", score: parseFloat(analysis.reflexivityScore as string) || 0, max: 15, icon: Activity },
    { label: "Virality", score: parseFloat(analysis.viralityScore as string) || 0, max: 15, icon: Zap },
    { label: "Asymmetry", score: parseFloat(analysis.asymmetryScore as string) || 0, max: 25, icon: TrendingUp },
    { label: "Game Theory", score: parseFloat(analysis.gameTheoryBonus as string) || 0, max: 15, icon: Brain },
  ];

  // Check if we have real component scores (for legacy data handling)
  const hasComponentScores = scoreComponents.some(c => c.score > 0);

  // Calculate total component score
  const totalComponentScore = scoreComponents.reduce((sum, c) => sum + c.score, 0);
  const maxComponentScore = scoreComponents.reduce((sum, c) => sum + c.max, 0);

  // All modifiers for the detailed display
  const allModifiers = [
    { label: "Phase", value: parseFloat(analysis.phaseModifier as string) || 0 },
    { label: isMemecoin ? "Meta" : "Narrative", value: parseFloat(analysis.narrativeModifier as string) || 0 },
    { label: "Exit Liquidity", value: parseFloat(analysis.exitLiquidityModifier as string) || 0 },
    { label: "Peak Proximity", value: parseFloat(analysis.peakProximityModifier as string) || 0 },
    { label: "Data Quality", value: parseFloat(analysis.dataQualityModifier as string) || 0 },
    { label: "Market Cap", value: parseFloat(analysis.marketCapModifier as string) || 0 },
  ];

  // Only show modifiers that have non-zero values
  const modifiers = allModifiers.filter(m => m.value !== 0);

  // Calculate total modifiers
  const totalModifiersValue = modifiers.reduce((sum, m) => sum + m.value, 0);

  // Market cap scaling context
  const marketCapTier = analysis.marketCapTier as string | null;
  const scoreCapped = analysis.scoreCapped as boolean | null;
  const uncappedScore = analysis.uncappedScore ? parseFloat(analysis.uncappedScore as string) : null;

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
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-secondary"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <span className="font-bold text-lg sm:text-2xl">
                      {analysis.tokenSymbol.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold">{analysis.tokenName}</h1>
                    {analysis.chain && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {analysis.chain}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
                    <span className="text-muted-foreground uppercase font-mono text-base sm:text-lg">
                      ${analysis.tokenSymbol.toUpperCase()}
                    </span>
                    <Badge className={`${tierStyle.bg} ${tierStyle.text} border font-bold text-xs sm:text-sm px-2 sm:px-3`}>
                      {analysis.tier}
                    </Badge>
                    <Badge className={`${recStyle.bg} ${recStyle.text} font-bold text-xs sm:text-sm px-2 sm:px-3`}>
                      {recStyle.label}
                    </Badge>
                    <Badge className={`${isMemecoin ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'} border font-medium text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                      {isMemecoin ? '🎭 MEME' : '⚙️ UTIL'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowShareModal(true)}
                      className="h-7 sm:h-8 gap-1.5 text-xs bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-primary"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Center: Score Display */}
              <div className="flex-1 flex flex-col items-center justify-center lg:border-l lg:border-r border-white/10 px-6">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                  Game Theory Score
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs p-3">
                        <div className="space-y-1.5 text-xs">
                          <div className="font-semibold text-sm mb-2">Score Guide</div>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-mono font-bold">85+</span>
                            <span className="text-muted-foreground">S+ Tier • Strong Buy</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 font-mono font-bold">70-84</span>
                            <span className="text-muted-foreground">S Tier • Buy</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-mono font-bold">55-69</span>
                            <span className="text-muted-foreground">A Tier • Moderate Buy</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-400 font-mono font-bold">40-54</span>
                            <span className="text-muted-foreground">B Tier • Hold/Caution</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 font-mono font-bold">&lt;40</span>
                            <span className="text-muted-foreground">C Tier • Avoid</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`text-5xl sm:text-6xl md:text-7xl font-bold font-mono bg-gradient-to-r ${getScoreGradient(finalScore)} bg-clip-text text-transparent`}>
                  {finalScore.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">out of 100</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                  <Badge variant="outline" className="text-xs">
                    {analysis.consensusLevel || "MIXED"} Consensus
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {analysis.confidence === 'H' ? 'High' : analysis.confidence === 'L' ? 'Low' : 'Medium'} Confidence
                  </Badge>
                  {marketCapTier && marketCapTier !== 'small' && (
                    <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400">
                      {marketCapTier === 'mega' ? 'Mega Cap' : marketCapTier === 'large' ? 'Large Cap' : 'Mid Cap'}
                    </Badge>
                  )}
                </div>
                {/* Market Cap Context - show when score is capped */}
                {scoreCapped && uncappedScore !== null && (
                  <div className="mt-3 text-center">
                    <div className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                      <span className="font-medium">Excellent for size</span>
                      <span className="text-blue-400/70">
                        (uncapped: {uncappedScore.toFixed(1)})
                      </span>
                    </div>
                  </div>
                )}
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

            {/* Market Cap Scaling Explanation - show when score is capped */}
            {scoreCapped && uncappedScore !== null && marketCapTier && (
              <div className="mt-4 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-400 mb-1">
                      {marketCapTier === 'mega' ? 'Mega Cap Adjustment' : marketCapTier === 'large' ? 'Large Cap Adjustment' : 'Mid Cap Adjustment'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {marketCapTier === 'mega'
                        ? `This token's $${formatMarketCap(analysis.marketCap as string)} market cap means scores are capped at 80. An 80 for a mega-cap is exceptional—equivalent to a 90+ for smaller tokens. Raw score: ${uncappedScore.toFixed(1)}.`
                        : marketCapTier === 'large'
                          ? `Large caps ($1B-$5B) are capped at 85. This reflects reduced asymmetric upside for established tokens. Raw score: ${uncappedScore.toFixed(1)}.`
                          : `Mid caps ($500M-$1B) are capped at 90 to account for moderate size constraints. Raw score: ${uncappedScore.toFixed(1)}.`
                      }
                    </div>
                  </div>
                </div>
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

        {/* Narrative / Meta */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Flame className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">{isMemecoin ? 'Meta' : 'Narrative'}</span>
            </div>
            <ExpandableText
              text={analysis.narrative || (isMemecoin ? "Meme/Social Token" : "Utility/Infrastructure")}
              className="text-sm font-medium"
            />
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

      {/* Model Consensus - 4-LLM scores displayed prominently */}
      {modelScores && Object.keys(modelScores).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.11 }}
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
                  <button
                    onClick={() => setSelectedModel('gpt')}
                    className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.gpt)} text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">ChatGPT-5.2</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.gpt)}`}>
                      {modelScores.gpt.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-primary/70 mt-1">Click for details</div>
                  </button>
                )}
                {modelScores.claude !== undefined && (
                  <button
                    onClick={() => setSelectedModel('claude')}
                    className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.claude)} text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">Claude Opus 4.5</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.claude)}`}>
                      {modelScores.claude.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-primary/70 mt-1">Click for details</div>
                  </button>
                )}
                {modelScores.gemini !== undefined && (
                  <button
                    onClick={() => setSelectedModel('gemini')}
                    className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.gemini)} text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">Gemini 3 Pro</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.gemini)}`}>
                      {modelScores.gemini.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-primary/70 mt-1">Click for details</div>
                  </button>
                )}
                {modelScores.grok !== undefined && (
                  <button
                    onClick={() => setSelectedModel('grok')}
                    className={`p-4 rounded-xl border ${getScoreBgColor(modelScores.grok)} text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">Grok 4</div>
                    <div className={`text-3xl font-bold font-mono ${getScoreColor(modelScores.grok)}`}>
                      {modelScores.grok.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-primary/70 mt-1">Click for details</div>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Score Breakdown - directly after 4-Model Consensus */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
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

      {/* Project Context - Enhanced for traders */}
      {(analysis.thesis || analysis.schellingPosition || analysis.equilibriumType) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                Investment Thesis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Thesis */}
              {analysis.thesis && (
                <p className="text-muted-foreground leading-relaxed">{analysis.thesis}</p>
              )}

              {/* Game Theory Context Row */}
              {(analysis.schellingPosition || analysis.equilibriumType || analysis.dominantStrategies || analysis.asymmetryFloor || analysis.asymmetryCeiling) && (
                <div className="pt-4 border-t border-white/10">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Brain className="w-3 h-3" />
                    Game Theory Context
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.schellingPosition && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1">Schelling Position</div>
                        <div className="text-sm">{analysis.schellingPosition}</div>
                      </div>
                    )}
                    {analysis.equilibriumType && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1">Market Equilibrium</div>
                        <div className={`text-sm ${
                          analysis.equilibriumType.toLowerCase().includes('robust') ? 'text-green-400' :
                          analysis.equilibriumType.toLowerCase().includes('fragile') ? 'text-yellow-400' :
                          ''
                        }`}>{analysis.equilibriumType}</div>
                      </div>
                    )}
                    {analysis.dominantStrategies && !analysis.dominantStrategies.toLowerCase().includes('n/a') && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1">Dominant Strategy</div>
                        <div className={`text-sm ${
                          analysis.dominantStrategies.toLowerCase().includes('hold') || analysis.dominantStrategies.toLowerCase().includes('accumulate') ? 'text-green-400' :
                          analysis.dominantStrategies.toLowerCase().includes('sell') || analysis.dominantStrategies.toLowerCase().includes('exit') ? 'text-red-400' :
                          ''
                        }`}>{analysis.dominantStrategies}</div>
                      </div>
                    )}
                    {(analysis.asymmetryFloor || analysis.asymmetryCeiling) && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                        <div className="text-xs text-muted-foreground mb-1">Risk/Reward Profile</div>
                        <div className="flex items-center gap-3 text-sm">
                          {analysis.asymmetryFloor && (
                            <div className="flex items-center gap-1">
                              <ArrowDown className="w-3 h-3 text-red-400" />
                              <span className="text-red-400 font-mono">{analysis.asymmetryFloor}</span>
                            </div>
                          )}
                          {analysis.asymmetryFloor && analysis.asymmetryCeiling && (
                            <span className="text-muted-foreground">/</span>
                          )}
                          {analysis.asymmetryCeiling && (
                            <div className="flex items-center gap-1">
                              <ArrowUp className="w-3 h-3 text-green-400" />
                              <span className="text-green-400 font-mono">{analysis.asymmetryCeiling}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Team/Project Info Row */}
              {(analysis.teamStatus || analysis.notableBackers) && (
                <div className="pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysis.teamStatus && (
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Team</div>
                        <div className={`text-sm font-medium ${
                          analysis.teamStatus.toLowerCase().includes('anon') ? 'text-yellow-400' :
                          analysis.teamStatus.toLowerCase().includes('doxxed') ? 'text-green-400' :
                          ''
                        }`}>{analysis.teamStatus}</div>
                      </div>
                    </div>
                  )}
                  {analysis.notableBackers && analysis.notableBackers.toLowerCase() !== 'none known' && (
                    <div className="flex items-center gap-2 col-span-1 md:col-span-3">
                      <Award className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Backers</div>
                        <div className="text-sm">{analysis.notableBackers}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Unlock Warning - NEW (if present) */}
      {analysis.unlockWarning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.13 }}
        >
          <Card className="glass-card border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Unlock className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-orange-400 mb-1">Upcoming Token Unlock</div>
                  <div className="text-sm text-muted-foreground">{analysis.unlockWarning}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Catalysts & Risks - NEW */}
      {(analysis.catalyst1 || analysis.catalyst2 || analysis.catalyst3 ||
        analysis.risk1 || analysis.risk2 || analysis.risk3) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Catalysts / Moon Factors */}
          {(analysis.catalyst1 || analysis.catalyst2 || analysis.catalyst3) && (
            <Card className="glass-card border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">{isMemecoin ? 'Moon Factors' : 'Catalysts'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {analysis.catalyst1 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-green-400 font-bold">1.</span>
                      <span className="text-muted-foreground">{analysis.catalyst1}</span>
                    </li>
                  )}
                  {analysis.catalyst2 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-green-400 font-bold">2.</span>
                      <span className="text-muted-foreground">{analysis.catalyst2}</span>
                    </li>
                  )}
                  {analysis.catalyst3 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-green-400 font-bold">3.</span>
                      <span className="text-muted-foreground">{analysis.catalyst3}</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Risks / Rug Signals */}
          {(analysis.risk1 || analysis.risk2 || analysis.risk3) && (
            <Card className="glass-card border-red-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">{isMemecoin ? 'Rug Signals' : 'Key Risks'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {analysis.risk1 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-red-400 font-bold">1.</span>
                      <span className="text-muted-foreground">{analysis.risk1}</span>
                    </li>
                  )}
                  {analysis.risk2 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-red-400 font-bold">2.</span>
                      <span className="text-muted-foreground">{analysis.risk2}</span>
                    </li>
                  )}
                  {analysis.risk3 && (
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-red-400 font-bold">3.</span>
                      <span className="text-muted-foreground">{analysis.risk3}</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Social Signals */}
      {(analysis.xSentiment || analysis.xTopKols || narrativeHeat !== null) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Twitter className="w-5 h-5 text-sky-400" />
                Social Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Narrative/Meta Heat - replaces unreliable mentions trend */}
                {narrativeHeat !== null && (
                  <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{isMemecoin ? 'Meta Heat' : 'Narrative Heat'}</div>
                    <div className="flex items-center gap-2">
                      <Flame className={`w-4 h-4 ${
                        narrativeHeat >= 7 ? 'text-orange-400' :
                        narrativeHeat >= 4 ? 'text-yellow-400' :
                        'text-muted-foreground'
                      }`} />
                      <span className={`text-lg font-bold font-mono ${
                        narrativeHeat >= 7 ? 'text-orange-400' :
                        narrativeHeat >= 4 ? 'text-yellow-400' :
                        'text-muted-foreground'
                      }`}>{narrativeHeat.toFixed(1)}/10</span>
                      <span className="text-xs text-muted-foreground">
                        {narrativeHeat >= 7 ? 'Hot' : narrativeHeat >= 4 ? 'Warm' : 'Cool'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sentiment - fixed to detect bullish/bearish */}
                {analysis.xSentiment && !analysis.xSentiment.toLowerCase().includes('n/a') && (
                  <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">X Sentiment</div>
                    <div className={`text-sm font-medium ${
                      analysis.xSentiment.toLowerCase().includes('bullish') || analysis.xSentiment.toLowerCase().includes('positive') ? 'text-green-400' :
                      analysis.xSentiment.toLowerCase().includes('bearish') || analysis.xSentiment.toLowerCase().includes('negative') ? 'text-red-400' :
                      ''
                    }`}>
                      {analysis.xSentiment}
                    </div>
                  </div>
                )}

                {/* Top KOLs */}
                {analysis.xTopKols && !analysis.xTopKols.toLowerCase().includes('n/a') && (
                  <div className="p-3 rounded-lg bg-secondary/30 border border-white/5">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notable KOLs</div>
                    <div className="text-sm text-muted-foreground">{analysis.xTopKols}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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

        {/* Output Summary / Full Reasoning */}
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
                        Output Summary
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        analysis={analysis}
      />

      {/* Model Analysis Modal */}
      <ModelAnalysisModal
        isOpen={selectedModel !== null}
        onClose={() => setSelectedModel(null)}
        modelName={
          selectedModel === 'gpt' ? 'ChatGPT-5.2' :
          selectedModel === 'claude' ? 'Claude Opus 4.5' :
          selectedModel === 'gemini' ? 'Gemini 3 Pro' :
          selectedModel === 'grok' ? 'Grok 4' : ''
        }
        modelAnalysis={
          selectedModel && modelAnalyses
            ? modelAnalyses[selectedModel]
            : selectedModel && modelScores?.[selectedModel] !== undefined
              ? { score: modelScores[selectedModel]! }
              : undefined
        }
      />
    </div>
  );
}
