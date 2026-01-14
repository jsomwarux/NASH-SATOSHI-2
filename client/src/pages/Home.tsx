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
  Vote,
  Users,
  TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";

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
    icon: Target,
    title: "FIND ASYMMETRIC PLAYS",
    desc: "Identify tokens with high upside potential before the crowd. Our scoring surfaces early-stage opportunities with favorable risk/reward.",
    color: "primary",
  },
  {
    icon: Eye,
    title: "AVOID EXIT LIQUIDITY",
    desc: "Know if you're buying into strength or holding someone else's bags. Clear positioning analysis tells you which side of the trade you're on.",
    color: "accent",
  },
  {
    icon: Scan,
    title: "PHASE DETECTION",
    desc: "Know exactly where a token is in its lifecycle: Stealth, Expansion, Mania, Distribution, or Dead. Time your entries and exits.",
    color: "primary",
  },
  {
    icon: BarChart3,
    title: "TRACK RECORD",
    desc: "See real performance data. We track how our top-rated tokens perform over time so you can judge the system yourself.",
    color: "accent",
  },
];

const scoringComponents = [
  { label: "COORDINATION", max: 20, desc: "Multi-model consensus signals" },
  { label: "SCHELLING RANK", max: 10, desc: "Focal point positioning" },
  { label: "REFLEXIVITY", max: 15, desc: "Self-reinforcing dynamics" },
  { label: "VIRALITY", max: 15, desc: "Narrative spread momentum" },
  { label: "ASYMMETRY", max: 25, desc: "Risk/reward profile" },
  { label: "GAME THEORY", max: 15, desc: "Strategic Nash positioning" },
];

// Methodology pillars for the enhanced scoring section
const methodologyPillars = [
  {
    icon: Target,
    title: "Fundamentals",
    description: "Narrative positioning, technology, team credibility, tokenomics structure, traction metrics, and competitive landscape.",
    color: "blue",
  },
  {
    icon: Users,
    title: "Game Theory",
    description: "Market coordination dynamics — assessing whether conditions favor buyers or sellers and how sustainable current positioning is.",
    color: "purple",
  },
  {
    icon: Brain,
    title: "Multi-Model Consensus",
    description: "Every token is independently analyzed by four AI models that deliberate and challenge each other before producing a final score.",
    color: "emerald",
  },
  {
    icon: TrendingUp,
    title: "The Score",
    description: "A single 0-100 score representing probability-weighted expected value — balancing quality, timing, and risk-adjusted upside.",
    color: "amber",
  },
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
  const { displayText, isComplete } = useTypingEffect("Crypto Game Theory Rankings", 35);

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
              className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded border border-primary/30 bg-primary/5 text-primary text-[10px] sm:text-xs font-mono tracking-wider mb-8"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="hidden sm:inline">SYSTEM::</span>ONLINE
              </span>
              <span className="text-white/30">|</span>
              <span className="hidden sm:inline">4 LLMs • CONSENSUS MODE • ZERO BIAS</span>
              <span className="sm:hidden">4 LLMs • CONSENSUS</span>
            </motion.div>

            {/* Main Headline - Terminal Style */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-4">
                <span className="text-primary font-mono text-base sm:text-lg md:text-xl block mb-2 opacity-70">
                  {">"} init_rankings.exe
                </span>
                <span className="text-glow-cyan block leading-tight">
                  {displayText}
                  {!isComplete && <span className="animate-pulse">_</span>}
                </span>
              </h1>
              <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-muted-foreground font-mono leading-relaxed">
                4 AI models cross-checking each other to help you find the best risk/reward tokens right now.
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

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/rankings">
                <Button size="lg" className="font-mono text-sm gap-2 bg-primary hover:bg-primary/90">
                  <BarChart3 className="w-4 h-4" />
                  VIEW RANKINGS
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/vote">
                <Button size="lg" variant="outline" className="font-mono text-sm gap-2 border-accent/50 text-accent hover:bg-accent/10">
                  <Vote className="w-4 h-4" />
                  VOTE FOR TOKENS
                </Button>
              </Link>
            </motion.div>
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
              Your Edge in Crypto
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto font-mono text-sm">
              Game theory analysis powered by 4-LLM consensus. No single point of failure.
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

      {/* Scoring Methodology - Enhanced Section */}
      <section className="py-20 border-t border-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-6">
              <CircuitBoard className="w-3 h-3" />
              METHODOLOGY
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
              <span className="text-glow-cyan">How Scoring</span>{" "}
              <span className="text-muted-foreground">Works</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto font-mono text-sm leading-relaxed">
              Our system combines <span className="text-foreground">traditional crypto research</span> with
              proprietary <span className="text-foreground">game-theoretic analysis</span> to surface
              asymmetric opportunities.
            </p>
          </motion.div>

          {/* Four Methodology Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {methodologyPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`cyber-card p-5 sm:p-6 rounded border border-${pillar.color}-500/30 bg-${pillar.color}-500/5 hover:bg-${pillar.color}-500/10 transition-all`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-${pillar.color}-500/20 border border-${pillar.color}-500/30 flex items-center justify-center mb-4`}>
                  <pillar.icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${pillar.color}-400`} />
                </div>
                <h3 className={`text-sm sm:text-base font-mono font-bold mb-2 text-${pillar.color}-400`}>{pillar.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{pillar.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Score Components + Tier Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            {/* Left: Component Scores */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="cyber-card p-6 sm:p-8 rounded border border-white/10 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm sm:text-base">Six Scoring Dimensions</h3>
                  <p className="text-xs text-muted-foreground">Each analyzed by all 4 AI models</p>
                </div>
              </div>

              <div className="space-y-5 flex-1">
                {scoringComponents.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3 sm:gap-4"
                  >
                    <div className="w-10 sm:w-14 text-right flex-shrink-0">
                      <span className="font-mono text-[10px] sm:text-xs text-primary">0-{item.max}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(item.max / 25) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          viewport={{ once: true }}
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        />
                      </div>
                    </div>
                    <div className="w-24 sm:w-32 flex-shrink-0">
                      <div className="font-mono text-[10px] sm:text-xs font-bold tracking-wider truncate">{item.label}</div>
                      <div className="text-[8px] sm:text-[10px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Total Score Sum */}
              <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">TOTAL MAX POINTS</span>
                <span className="font-mono text-lg font-bold text-primary">100</span>
              </div>
            </motion.div>

            {/* Right: Tier Breakdown */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="cyber-card p-6 sm:p-8 rounded border border-primary/20 flex flex-col"
            >
              <div className="text-center mb-6">
                <div className="text-5xl sm:text-6xl lg:text-7xl font-bold font-mono text-glow-cyan mb-2">
                  0-100
                </div>
                <div className="text-muted-foreground font-mono text-xs sm:text-sm tracking-wider">
                  FINAL CONSENSUS SCORE
                </div>
              </div>

              <div className="space-y-2 flex-1">
                {[
                  { range: "85-100", tier: "S+", color: "purple", label: "STRONG BUY", desc: "Top-tier asymmetry" },
                  { range: "70-84", tier: "S", color: "green", label: "BUY", desc: "Favorable setup" },
                  { range: "55-69", tier: "A", color: "emerald", label: "ACCUMULATE", desc: "Worth watching" },
                  { range: "40-54", tier: "B", color: "yellow", label: "HOLD", desc: "Limited upside" },
                  { range: "0-39", tier: "C", color: "red", label: "AVOID", desc: "Poor risk/reward" },
                ].map((item) => (
                  <div
                    key={item.tier}
                    className={`flex items-center gap-3 p-2.5 sm:p-3 rounded border bg-${item.color}-500/5 border-${item.color}-500/20`}
                  >
                    <div className={`px-2 py-1 rounded font-mono font-bold text-xs bg-${item.color}-500/20 text-${item.color}-400 border border-${item.color}-500/30`}>
                      {item.tier}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs">{item.range}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-xs font-bold text-${item.color}-400`}>{item.label}</div>
                      <div className="text-[9px] text-muted-foreground hidden sm:block">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Score Distribution Visual */}
              <div className="mt-auto pt-6 border-t border-primary/10">
                <div className="text-xs font-mono text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Score Distribution
                </div>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                  <div className="flex-[39] bg-red-500/60" title="0-39: C Tier" />
                  <div className="flex-[15] bg-yellow-500/60" title="40-54: B Tier" />
                  <div className="flex-[15] bg-emerald-500/60" title="55-69: A Tier" />
                  <div className="flex-[15] bg-green-500/60" title="70-84: S Tier" />
                  <div className="flex-[16] bg-purple-500/60" title="85+: S+ Tier" />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-mono">
                  <span>0</span>
                  <span className="text-red-400">C</span>
                  <span className="text-yellow-400">B</span>
                  <span className="text-emerald-400">A</span>
                  <span className="text-green-400">S</span>
                  <span className="text-purple-400">S+</span>
                  <span>100</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom Note */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-muted-foreground font-mono">
              Scores are updated with each new analysis run. Past performance does not guarantee future results.
            </p>
          </motion.div>
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
              RANKINGS::LIVE
            </div>

            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              <span className="text-muted-foreground">Discover</span>{" "}
              <span className="text-glow-cyan">Top Tokens</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto font-mono text-sm">
              {">"} Browse our curated rankings of game-theory analyzed tokens.
              Vote for tokens you want to see analyzed next.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/rankings">
                <Button size="lg" className="font-mono text-sm gap-2 bg-primary hover:bg-primary/90">
                  <BarChart3 className="w-4 h-4" />
                  EXPLORE RANKINGS
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/vote">
                <Button size="lg" variant="outline" className="font-mono text-sm gap-2 border-accent/50 text-accent hover:bg-accent/10">
                  <Vote className="w-4 h-4" />
                  VOTE FOR TOKENS
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
