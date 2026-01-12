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
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-4">
                <span className="text-primary font-mono text-lg md:text-xl block mb-2 opacity-70">
                  {">"} init_rankings.exe
                </span>
                <span className="text-glow-cyan block leading-tight">
                  {displayText}
                  {!isComplete && <span className="animate-pulse">_</span>}
                </span>
              </h1>
              <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground font-mono leading-relaxed">
                Curated token rankings powered by a 4-LLM ensemble. Game theory scores you can actually act on.
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
              <Link href="/leaderboard">
                <Button size="lg" className="font-mono text-sm gap-2 bg-primary hover:bg-primary/90">
                  <BarChart3 className="w-4 h-4" />
                  VIEW LEADERBOARD
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
                determines the final score.
              </p>

              <div className="space-y-4">
                {scoringComponents.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-2 sm:gap-4"
                  >
                    <div className="w-10 sm:w-16 text-right flex-shrink-0">
                      <span className="font-mono text-[10px] sm:text-xs text-primary">0-{item.max}</span>
                    </div>
                    <div className="flex-1 min-w-0">
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
                    <div className="w-24 sm:w-36 flex-shrink-0">
                      <div className="font-mono text-[10px] sm:text-xs font-bold tracking-wider truncate">{item.label}</div>
                      <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">{item.desc}</div>
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
                  { range: "85-100", tier: "S+", color: "purple", label: "STRONG BUY", desc: "Top-tier asymmetry" },
                  { range: "70-84", tier: "S", color: "green", label: "BUY", desc: "Favorable setup" },
                  { range: "55-69", tier: "A", color: "emerald", label: "ACCUMULATE", desc: "Worth watching" },
                  { range: "40-54", tier: "B", color: "yellow", label: "HOLD", desc: "Limited upside" },
                  { range: "0-39", tier: "C", color: "red", label: "AVOID", desc: "Poor risk/reward" },
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
              RANKINGS::LIVE
            </div>

            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              <span className="text-muted-foreground">Discover</span>{" "}
              <span className="text-glow-cyan">Top Tokens</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto font-mono text-sm">
              {">"} Browse our curated leaderboard of game-theory analyzed tokens.
              Vote for tokens you want to see analyzed next.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/leaderboard">
                <Button size="lg" className="font-mono text-sm gap-2 bg-primary hover:bg-primary/90">
                  <BarChart3 className="w-4 h-4" />
                  EXPLORE LEADERBOARD
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="font-mono text-sm gap-2">
                  VIEW PRICING
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
