import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Zap,
  Brain,
  Target,
  Sparkles,
  CheckCircle,
  Terminal,
  Hexagon,
  CircuitBoard,
  Scan,
  Eye,
  BarChart3,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { TokenSearch } from "@/components/search/TokenSearch";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/AuthModal";
import { useTokenAnalyzer } from "@/hooks/useAnalysis";
import { useAuth } from "@/contexts/AuthContext";
import type { TokenSearchResult } from "@shared/schema";

// AI Model data with cyber aesthetic
const aiModels = [
  {
    name: "ChatGPT-5.2",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "Deep reasoning & pattern recognition",
    icon: Brain,
  },
  {
    name: "Claude Opus 4.5",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    description: "Nuanced analysis & risk assessment",
    icon: Target,
  },
  {
    name: "Gemini 3 Pro",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Multi-modal data synthesis",
    icon: Hexagon,
  },
  {
    name: "Grok 4",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    description: "Real-time market sentiment",
    icon: Zap,
  },
];

const benefits = [
  {
    icon: Shield,
    title: "ELIMINATE AI BIAS",
    desc: "Single-model analysis has blind spots. Our 4-LLM ensemble cross-validates findings to eliminate hallucinations and bias.",
    color: "primary",
  },
  {
    icon: Target,
    title: "GAME THEORY SCORING",
    desc: "Go beyond price charts. Nash equilibrium analysis reveals coordination signals, Schelling points, and exit liquidity dynamics.",
    color: "accent",
  },
  {
    icon: Scan,
    title: "PHASE DETECTION",
    desc: "Know exactly where a token is in its lifecycle: Stealth, Expansion, Mania, Distribution, or Dead phase.",
    color: "primary",
  },
  {
    icon: Eye,
    title: "RISK TRANSPARENCY",
    desc: "Clear exit liquidity assessment tells you if you're positioned on the winning side or at risk of being exit liquidity.",
    color: "accent",
  },
];

const scoringComponents = [
  { label: "COORDINATION", max: 20, desc: "Multi-model consensus signals" },
  { label: "SCHELLING RANK", max: 15, desc: "Focal point positioning" },
  { label: "REFLEXIVITY", max: 15, desc: "Self-reinforcing dynamics" },
  { label: "VIRALITY", max: 15, desc: "Narrative spread momentum" },
  { label: "ASYMMETRY", max: 15, desc: "Risk/reward profile" },
  { label: "GAME THEORY", max: 20, desc: "Strategic Nash positioning" },
];

// Typing animation hook
function useTypingEffect(text: string, speed = 50) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayText("");
    setIsComplete(false);
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayText, isComplete };
}

export default function Home() {
  const [, navigate] = useLocation();
  const { startAnalysis, isAnalyzing, error } = useTokenAnalyzer();
  const { user } = useAuth();
  const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingToken, setPendingToken] = useState<TokenSearchResult | null>(null);
  const { displayText, isComplete } = useTypingEffect("Crypto Game Theory Token Analyzer", 35);

  // Check if error is an auth required error
  const isAuthError = error?.message?.includes("Sign up to analyze") ||
                      error?.message?.includes("AUTH_REQUIRED");

  // Check if error is a limit reached error
  const isLimitError = error?.message?.includes("limit reached") ||
                       error?.message?.includes("LIMIT_REACHED") ||
                       error?.message?.includes("upgrade your plan");

  // Check if error is a concurrent analysis limit error
  const isConcurrentError = error?.message?.includes("analyses in progress") ||
                            error?.message?.includes("CONCURRENT_LIMIT");

  // Check if system is at capacity
  const isSystemBusy = error?.message?.includes("System is at capacity") ||
                       error?.message?.includes("SYSTEM_BUSY");

  const handleTokenSelect = async (token: TokenSearchResult) => {
    setSelectedToken(token);

    // If user is not authenticated, show auth modal with the token they want to analyze
    if (!user) {
      setPendingToken(token);
      setShowAuthModal(true);
      return;
    }

    try {
      const result = await startAnalysis(token);
      navigate(`/analyze/${result.analysisId}`);
    } catch (err) {
      console.error("Analysis failed:", err);
      // If it's an auth error, show the modal
      if (err instanceof Error && (err.message.includes("Sign up") || err.message.includes("AUTH_REQUIRED"))) {
        setPendingToken(token);
        setShowAuthModal(true);
      }
    }
  };

  // When auth modal closes and user is now authenticated, start the pending analysis
  const handleAuthModalClose = async () => {
    setShowAuthModal(false);
    // Small delay to allow auth state to update
    if (pendingToken) {
      setTimeout(async () => {
        try {
          const result = await startAnalysis(pendingToken);
          navigate(`/analyze/${result.analysisId}`);
        } catch (err) {
          console.error("Analysis failed after auth:", err);
        }
        setPendingToken(null);
      }, 500);
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="pt-16 pb-24 sm:pt-24 sm:pb-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* System Status Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-4 py-2 rounded border border-primary/30 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-8"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                SYSTEM::ONLINE
              </span>
              <span className="text-white/30">|</span>
              <span>4 LLMs • CONSENSUS MODE • ZERO BIAS</span>
            </motion.div>

            {/* Main Headline - Terminal Style */}
            <div className="mb-8">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-4">
                <span className="text-primary font-mono text-lg md:text-xl block mb-2 opacity-70">
                  {">"} init_analysis.exe
                </span>
                <span className="text-glow-cyan block leading-tight">
                  {displayText}
                  {!isComplete && <span className="animate-pulse">_</span>}
                </span>
              </h1>
              <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground font-mono leading-relaxed">
                A 4-LLM ensemble that cross-checks itself to produce game-theory token ratings you can actually act on.
              </p>
            </div>

            {/* AI Models - Cyber Cards */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {aiModels.map((model, i) => (
                <motion.div
                  key={model.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                  className={`cyber-card flex items-center gap-2 px-4 py-2 rounded border ${model.borderColor} ${model.bgColor}`}
                >
                  <model.icon className={`w-4 h-4 ${model.color}`} />
                  <span className={`font-mono text-sm ${model.color}`}>{model.name}</span>
                </motion.div>
              ))}
            </div>

            {/* Token Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="max-w-2xl mx-auto mb-6"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-lg blur opacity-30" />
                <div className="relative">
                  <TokenSearch onSelect={handleTokenSelect} isLoading={isAnalyzing} />
                </div>
              </div>
            </motion.div>

            {/* View Leaderboard Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mb-8"
            >
              <Link href="/leaderboard">
                <Button variant="ghost" className="font-mono text-sm text-muted-foreground hover:text-primary gap-2">
                  <BarChart3 className="w-4 h-4" />
                  VIEW LEADERBOARD
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>

            {/* Loading/Error State */}
            {isAnalyzing && selectedToken && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-3 text-primary font-mono text-sm"
              >
                <CircuitBoard className="w-5 h-5 animate-spin" />
                <span>
                  INITIALIZING 4-LLM ANALYSIS FOR{" "}
                  <span className="text-white font-bold">{selectedToken.name.toUpperCase()}</span>...
                </span>
              </motion.div>
            )}

            {error && !isAuthError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`font-mono text-sm mt-4 p-3 border rounded ${
                  isLimitError || isConcurrentError || isSystemBusy
                    ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    : "text-red-400 border-red-500/30 bg-red-500/10"
                }`}
              >
                {isSystemBusy ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <span>System is at capacity. Please try again in a few minutes.</span>
                  </div>
                ) : isConcurrentError ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <span>You have analyses in progress. Please wait for one to complete.</span>
                    <Link href="/history">
                      <Button size="sm" variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                        VIEW HISTORY
                      </Button>
                    </Link>
                  </div>
                ) : isLimitError ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <span>Analysis limit reached for today.</span>
                    <Link href="/pricing">
                      <Button size="sm" variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                        UPGRADE PLAN
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>ERROR: Analysis failed. Please retry.</>
                )}
              </motion.div>
            )}

          </motion.div>
        </div>
      </section>

      {/* Why 4 LLMs Section */}
      <section className="py-20 border-t border-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-6">
              <Terminal className="w-3 h-3" />
              WHY_MULTI_LLM
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              <span className="text-muted-foreground">One AI Can Be Wrong.</span>
              <br />
              <span className="text-glow-cyan">Four AIs Reach Consensus.</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto font-mono text-sm">
              Each AI model has unique strengths and biases. By combining outputs,
              we eliminate blind spots and deliver trusted scores.
            </p>
          </motion.div>

          {/* AI Model Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {aiModels.map((model, i) => (
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`cyber-card p-6 rounded border ${model.borderColor} group hover:shadow-lg hover:shadow-primary/10 transition-all`}
              >
                <div className={`w-12 h-12 rounded ${model.bgColor} border ${model.borderColor} flex items-center justify-center mb-4`}>
                  <model.icon className={`w-6 h-6 ${model.color}`} />
                </div>
                <h3 className={`text-lg font-mono font-bold mb-2 ${model.color}`}>{model.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{model.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Consensus Flow Visual */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-4 px-6 py-4 rounded border border-primary/20 bg-card/50">
              <div className="flex -space-x-3">
                {aiModels.map((model, i) => (
                  <div
                    key={model.name}
                    className={`w-10 h-10 rounded ${model.bgColor} border-2 border-background flex items-center justify-center`}
                    style={{ zIndex: 4 - i }}
                  >
                    <model.icon className={`w-5 h-5 ${model.color}`} />
                  </div>
                ))}
              </div>
              <ArrowRight className="w-5 h-5 text-primary animate-pulse" />
              <div className="flex items-center gap-2 px-4 py-2 rounded border border-green-500/30 bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="font-mono text-sm text-green-400">CONSENSUS_SCORE</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20 border-t border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-accent/20 bg-accent/5 text-accent text-xs font-mono tracking-wider mb-6">
              <Sparkles className="w-3 h-3" />
              FEATURES
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-glow-magenta">
              Analysis You Can Trust
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto font-mono text-sm">
              Go beyond basic metrics. Understand the game theory behind every token.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="cyber-card p-8 rounded border border-white/10 hover:border-primary/30 transition-all group"
              >
                <div className={`w-14 h-14 rounded border ${
                  benefit.color === "primary" ? "border-primary/30 bg-primary/10" : "border-accent/30 bg-accent/10"
                } flex items-center justify-center mb-6`}>
                  <benefit.icon className={`w-7 h-7 ${
                    benefit.color === "primary" ? "text-primary" : "text-accent"
                  }`} />
                </div>
                <h3 className="text-xl font-mono font-bold mb-3 tracking-wider">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring Methodology */}
      <section className="py-20 border-t border-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-6">
                <CircuitBoard className="w-3 h-3" />
                METHODOLOGY
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
                <span className="text-glow-cyan">Game Theory</span>
                <br />
                <span className="text-muted-foreground">Scoring Engine</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed font-mono text-sm">
                {">"} Our scoring system evaluates tokens across six key dimensions.
                Each component is analyzed by all four AI models, and the consensus
                determines your final score.
              </p>

              <div className="space-y-4">
                {scoringComponents.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-16 text-right">
                      <span className="font-mono text-xs text-primary">0-{item.max}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(item.max / 20) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          viewport={{ once: true }}
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        />
                      </div>
                    </div>
                    <div className="w-36">
                      <div className="font-mono text-xs font-bold tracking-wider">{item.label}</div>
                      <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="cyber-card p-8 rounded border border-primary/20"
            >
              <div className="text-center mb-8">
                <div className="text-7xl font-bold font-mono text-glow-cyan mb-2">
                  0-100
                </div>
                <div className="text-muted-foreground font-mono text-sm tracking-wider">
                  FINAL_GAME_THEORY_SCORE
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { range: "85-100", tier: "S+", color: "amber", label: "STRONG BUY", desc: "Exceptional opportunity" },
                  { range: "70-84", tier: "S", color: "green", label: "BUY", desc: "High conviction" },
                  { range: "55-69", tier: "A", color: "emerald", label: "BUY/HOLD", desc: "Solid fundamentals" },
                  { range: "40-54", tier: "B", color: "yellow", label: "HOLD", desc: "Caution advised" },
                  { range: "0-39", tier: "DQ", color: "red", label: "AVOID", desc: "High risk" },
                ].map((item) => (
                  <div
                    key={item.tier}
                    className={`flex items-center gap-3 p-3 rounded border bg-${item.color}-500/5 border-${item.color}-500/20`}
                  >
                    <div className={`px-2 py-1 rounded font-mono font-bold text-xs bg-${item.color}-500/20 text-${item.color}-400 border border-${item.color}-500/30`}>
                      {item.tier}
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-xs">{item.range}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-xs font-bold text-${item.color}-400`}>{item.label}</div>
                      <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-green-500/30 bg-green-500/5 text-green-400 text-xs font-mono tracking-wider mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              ANALYZER::READY
            </div>

            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              <span className="text-muted-foreground">Ready to</span>{" "}
              <span className="text-glow-cyan">Analyze?</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto font-mono text-sm">
              {">"} Search any token and get a comprehensive game theory analysis
              powered by our 4-LLM ensemble in under 30 minutes.
            </p>

            <div className="max-w-xl mx-auto relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-lg blur" />
              <div className="relative">
                <TokenSearch onSelect={handleTokenSelect} isLoading={isAnalyzing} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Auth Modal for anonymous users trying to analyze */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        defaultMode="signup"
        promptMessage={pendingToken ? `Sign up to analyze ${pendingToken.name}` : "Sign up to analyze tokens"}
        tokenName={pendingToken?.name}
      />
    </Layout>
  );
}
