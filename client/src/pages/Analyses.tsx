import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Search,
  History,
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Flame,
  Terminal,
  Database,
  CircuitBoard,
  UserPlus,
  LogIn,
  Lock,
  LogOut,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserAnalyses } from "@/hooks/useAnalyses";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import type { TokenAnalysis } from "@shared/schema";

// Score color helpers
function getScoreColor(score: number): string {
  if (score >= 85) return "text-amber-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBorderColor(score: number): string {
  if (score >= 85) return "border-amber-500/30";
  if (score >= 70) return "border-green-500/30";
  if (score >= 55) return "border-emerald-500/30";
  if (score >= 40) return "border-yellow-500/30";
  return "border-red-500/30";
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

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case "processing":
      return <CircuitBoard className="w-4 h-4 text-yellow-400 animate-spin" />;
    case "pending":
      return <Clock className="w-4 h-4 text-blue-400" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case "completed":
      return "COMPLETE";
    case "processing":
      return "PROCESSING...";
    case "pending":
      return "PENDING";
    case "failed":
      return "FAILED";
    default:
      return status.toUpperCase();
  }
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}m ago`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }

  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(price: string | null): string {
  if (!price) return "-";
  const num = parseFloat(price);
  if (isNaN(num)) return "-";
  if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(8)}`;
}

function AnalysisCard({ analysis, index }: { analysis: TokenAnalysis; index: number }) {
  const finalScore = parseFloat(analysis.finalScore as string) || 0;
  const priceChange = analysis.priceChange24h ? parseFloat(analysis.priceChange24h as string) : null;
  const narrativeHeat = analysis.narrativeHeat ? parseFloat(analysis.narrativeHeat as string) : null;
  const isCompleted = analysis.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/analyze/${analysis.id}`}>
        <div className={`relative group cursor-pointer cyber-card rounded border ${isCompleted ? getScoreBorderColor(finalScore) : 'border-primary/20'} overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 ${!isCompleted ? 'opacity-75' : ''}`}>
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10 bg-primary/5">
            <Terminal className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-mono text-primary tracking-wider">ANALYSIS_{String(analysis.id).slice(0, 8).toUpperCase()}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              {getStatusIcon(analysis.status)}
              <span className="text-muted-foreground">{getStatusText(analysis.status)}</span>
            </div>
          </div>

          <div className="relative p-5">
            {/* Header: Token Info */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {analysis.tokenImage ? (
                  <img
                    src={analysis.tokenImage}
                    alt={analysis.tokenName}
                    className="w-12 h-12 rounded bg-secondary ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center ring-2 ring-primary/20">
                    <span className="font-bold text-lg font-mono">
                      {analysis.tokenSymbol.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {analysis.tokenName}
                    {analysis.chain && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono opacity-70">
                        {analysis.chain}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-primary/70 font-mono uppercase">
                    ${analysis.tokenSymbol}
                  </div>
                </div>
              </div>
            </div>

            {/* Score and Tier (only for completed) */}
            {isCompleted && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-bold font-mono ${getScoreColor(finalScore)}`}>
                    {finalScore.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground text-sm font-mono">/100</span>
                </div>
                <Badge variant="outline" className={`${getTierBadgeStyle(analysis.tier)} font-mono font-bold text-lg px-3 py-1`}>
                  {analysis.tier}
                </Badge>
                {analysis.recommendation && (
                  <Badge variant="outline" className={`font-mono text-xs ${
                    analysis.recommendation.toUpperCase().includes('BUY')
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : analysis.recommendation.toUpperCase().includes('AVOID')
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {analysis.recommendation.toUpperCase()}
                  </Badge>
                )}
              </div>
            )}

            {/* Processing placeholder */}
            {!isCompleted && analysis.status === "processing" && (
              <div className="flex items-center gap-3 mb-4 py-3">
                <CircuitBoard className="w-8 h-8 text-primary animate-spin" />
                <div>
                  <div className="font-mono font-medium">ANALYSIS_IN_PROGRESS</div>
                  <div className="text-sm text-muted-foreground font-mono">Multi-LLM evaluation running...</div>
                </div>
              </div>
            )}

            {/* Failed state */}
            {analysis.status === "failed" && (
              <div className="flex items-center gap-3 mb-4 py-3 text-red-400">
                <AlertCircle className="w-8 h-8" />
                <div>
                  <div className="font-mono font-medium">ANALYSIS_FAILED</div>
                  <div className="text-sm opacity-70 font-mono">Click to retry</div>
                </div>
              </div>
            )}

            {/* Metrics Row (for completed) */}
            {isCompleted && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Phase */}
                <div className="bg-black/30 rounded border border-primary/10 p-2.5">
                  <div className="text-[9px] uppercase text-muted-foreground mb-0.5 font-mono tracking-wider">PHASE</div>
                  <div className="font-mono font-bold text-sm">
                    {analysis.phase || "—"}
                    {analysis.phaseName && (
                      <span className="text-muted-foreground text-xs ml-1 font-normal">
                        {analysis.phaseName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="bg-black/30 rounded border border-primary/10 p-2.5">
                  <div className="text-[9px] uppercase text-muted-foreground mb-0.5 font-mono tracking-wider">PRICE</div>
                  <div className="font-mono font-bold text-sm flex items-center gap-1">
                    {formatPrice(analysis.currentPrice as string | null)}
                    {priceChange !== null && (
                      <span className={`text-xs flex items-center ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Narrative */}
                <div className="bg-black/30 rounded border border-primary/10 p-2.5">
                  <div className="text-[9px] uppercase text-muted-foreground mb-0.5 font-mono tracking-wider">NARRATIVE</div>
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    {analysis.narrative || (analysis.tokenType === 'MEMECOIN' ? "Meme/Social Token" : "Utility/Infrastructure")}
                    {narrativeHeat !== null && narrativeHeat >= 6 && (
                      <Flame className="w-3 h-3 text-orange-400" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-primary/10">
              <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {formatDate(analysis.createdAt)}
              </div>
              <div className="flex items-center gap-1 text-xs text-primary font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                VIEW_DETAILS
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Auth Required Component
function AuthRequired({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="cyber-card p-8 rounded border border-primary/20 max-w-md">
        <div className="w-20 h-20 rounded border border-primary/30 bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-3 text-glow-cyan">
          Sign In Required
        </h2>
        <p className="text-muted-foreground mb-6 font-mono text-sm leading-relaxed">
          Create an account or sign in to track your token analyses. Your analyses will be saved and accessible only to you.
        </p>

        <div className="space-y-3">
          <Button
            onClick={onSignUp}
            className="w-full neon-button font-mono tracking-wider"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            CREATE_ACCOUNT
          </Button>
          <Button
            onClick={onSignIn}
            variant="outline"
            className="w-full font-mono tracking-wider border-primary/30 hover:bg-primary/10"
          >
            <LogIn className="w-4 h-4 mr-2" />
            SIGN_IN
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6 font-mono">
          Your analyses are private and secure.
        </p>
      </div>
    </motion.div>
  );
}

export default function Analyses() {
  const { user, session, loading: authLoading, signOut, isConfigured } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  // Get auth token from session
  useEffect(() => {
    if (session?.access_token) {
      setAuthToken(session.access_token);
    } else {
      setAuthToken(null);
    }
  }, [session]);

  const { data, isLoading, error } = useUserAnalyses(authToken, { limit: 50 });

  const handleSignIn = () => {
    setAuthMode('signin');
    setAuthModalOpen(true);
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground font-mono">INITIALIZING...</p>
          </div>
        </div>
      </Layout>
    );
  }

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
                  <History className="w-5 h-5 text-primary" />
                </div>
                <span className="text-glow-cyan">HISTORY</span>
              </h1>
              <p className="text-muted-foreground mt-2 font-mono text-sm">
                {">"} {user ? `Signed in as ${user.email}` : "Sign in to view your analysis history"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2 font-mono text-xs tracking-wider text-muted-foreground hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                  SIGN_OUT
                </Button>
              )}
              <Link href="/">
                <Button className="neon-button font-mono tracking-wider">
                  <Search className="w-4 h-4 mr-2" />
                  ANALYZE_NEW
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Auth Required State */}
        {!user && isConfigured && (
          <AuthRequired onSignIn={handleSignIn} onSignUp={handleSignUp} />
        )}

        {/* Auth Not Configured Warning */}
        {!isConfigured && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="cyber-card p-8 rounded border border-yellow-500/30">
              <div className="w-16 h-16 rounded border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-xl font-mono font-bold mb-2 text-yellow-400">AUTH_NOT_CONFIGURED</h2>
              <p className="text-muted-foreground mb-6 font-mono text-sm">
                Supabase authentication is not configured. Please set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.
              </p>
            </div>
          </motion.div>
        )}

        {/* Authenticated Content */}
        {user && (
          <>
            {/* Stats */}
            {data && data.items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
              >
                <div className="cyber-card p-4 rounded border border-primary/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider">TOTAL_ANALYSES</div>
                  <div className="text-2xl font-bold font-mono text-primary">{data.total}</div>
                </div>
                <div className="cyber-card p-4 rounded border border-green-500/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider">COMPLETED</div>
                  <div className="text-2xl font-bold font-mono text-green-400">
                    {data.items.filter(a => a.status === 'completed').length}
                  </div>
                </div>
                <div className="cyber-card p-4 rounded border border-yellow-500/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider">IN_PROGRESS</div>
                  <div className="text-2xl font-bold font-mono text-yellow-400">
                    {data.items.filter(a => a.status === 'processing' || a.status === 'pending').length}
                  </div>
                </div>
                <div className="cyber-card p-4 rounded border border-primary/20">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wider">AVG_SCORE</div>
                  <div className="text-2xl font-bold font-mono text-glow-cyan">
                    {(() => {
                      const completed = data.items.filter(a => a.status === 'completed');
                      if (completed.length === 0) return '—';
                      const avg = completed.reduce((acc, a) => acc + (parseFloat(a.finalScore as string) || 0), 0) / completed.length;
                      return avg.toFixed(1);
                    })()}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading State */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="cyber-card p-8 rounded border border-primary/20 text-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground font-mono">LOADING_ANALYSES...</p>
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
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-xl font-mono font-bold mb-2 text-red-400">LOAD_ERROR</h2>
                  <p className="text-muted-foreground mb-6 font-mono text-sm">
                    Failed to retrieve analyses. Please retry.
                  </p>
                  <Button onClick={() => window.location.reload()} className="font-mono">
                    RETRY
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Empty State */}
            {data && data.items.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="cyber-card p-8 rounded border border-primary/20">
                  <div className="w-16 h-16 rounded border border-primary/30 bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Database className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-mono font-bold mb-2">NO_ANALYSES_YET</h2>
                  <p className="text-muted-foreground mb-6 max-w-md font-mono text-sm">
                    Start analyzing tokens to build your analysis history. Each analysis uses our 4-LLM ensemble for comprehensive game theory evaluation.
                  </p>
                  <Link href="/">
                    <Button className="neon-button font-mono">
                      <Search className="w-4 h-4 mr-2" />
                      ANALYZE_FIRST_TOKEN
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Analysis Grid */}
            {data && data.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.items.map((analysis, index) => (
                  <AnalysisCard key={analysis.id} analysis={analysis} index={index} />
                ))}
              </div>
            )}

            {/* Pagination info */}
            {data && data.items.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 text-center text-xs font-mono text-muted-foreground"
              >
                SHOWING {data.items.length} OF {data.total} ANALYSES
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </Layout>
  );
}
