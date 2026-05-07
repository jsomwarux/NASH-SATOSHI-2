import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CircuitBoard,
  GitCompare,
  HelpCircle,
  Layers,
  Scale,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import { Layout } from "@/components/common/Layout";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    title: "Independent model reads",
    description: "Four AI models review the token separately so one model's framing does not control the whole output.",
    icon: Brain,
  },
  {
    title: "Cross-model comparison",
    description: "The system compares repeated strengths, repeated risks, and places where the models disagree.",
    icon: GitCompare,
  },
  {
    title: "Game-theory scoring",
    description: "Signals are mapped to coordination, incentives, reflexivity, narrative durability, and liquidity context.",
    icon: CircuitBoard,
  },
  {
    title: "Positioning rank",
    description: "The final score ranks relative positioning. It is not a forecast, trading instruction, or certainty claim.",
    icon: Target,
  },
];

const evaluatedSignals = [
  "Narrative strength and durability",
  "Incentive design for holders, builders, communities, and traders",
  "Coordination dynamics and Schelling-point potential",
  "Liquidity context and market-structure risk",
  "Reflexive loops between narrative, attention, and participation",
  "Consensus, disagreement, and repeated model-flagged risks",
];

const faqs = [
  {
    question: "Does Nash Satoshi predict token prices?",
    answer: "No. Nash Satoshi ranks tokens by game-theory positioning, narrative strength, incentives, liquidity context, and model consensus. It does not predict prices.",
  },
  {
    question: "Is Nash Satoshi financial advice?",
    answer: "No. Nash Satoshi is a research layer. Scores are not financial advice, buy or sell recommendations, or guarantees of any outcome.",
  },
  {
    question: "Why use multiple AI models?",
    answer: "Multiple models reduce dependence on one model's blind spots. Agreement can strengthen a research signal, while disagreement can reveal uncertainty or fragile assumptions.",
  },
  {
    question: "What makes a token rank highly?",
    answer: "A token ranks highly when it scores well across narrative, incentives, coordination, liquidity context, game-theory positioning, and model consensus.",
  },
  {
    question: "What should I do with model disagreement?",
    answer: "Treat disagreement as a research prompt. It can mean the token is ambiguous, polarizing, or dependent on assumptions that need closer inspection.",
  },
];

export default function Methodology() {
  return (
    <Layout>
      <section className="pt-16 pb-20 sm:pt-24 sm:pb-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-8">
              <CircuitBoard className="w-3 h-3" />
              METHODOLOGY::PUBLIC
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
              <span className="text-glow-cyan">How Nash Satoshi ranks crypto tokens</span>
            </h1>
            <p className="max-w-3xl mx-auto text-muted-foreground font-mono text-sm md:text-base leading-relaxed mb-8">
              Nash Satoshi uses multiple AI models to analyze narrative strength, incentives,
              coordination dynamics, liquidity context, and game-theory positioning. The goal is
              to make token research less dependent on hype, influencers, or one-model opinions.
            </p>
            <div className="cyber-card border border-amber-500/30 bg-amber-500/5 rounded-lg p-5 text-left max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-100/90 font-mono leading-relaxed">
                  Nash Satoshi is not price prediction, not financial advice, and not a buy or sell
                  signal. Scores are positioning research outputs, not instructions or guarantees.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 border-t border-primary/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-start">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-5">
              <span className="text-muted-foreground">Why single-model analysis</span>{" "}
              <span className="text-glow-cyan">is fragile</span>
            </h2>
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <p>
                One model can inherit the framing of the prompt. One model can overweight recent
                hype. One model can miss an incentive problem that another model catches.
              </p>
              <p>
                Crypto markets are reflexive: narratives move attention, attention changes behavior,
                and behavior can reinforce or break the narrative. That makes both consensus and
                disagreement useful research signals.
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="cyber-card rounded border border-primary/20 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-primary" />
              <h3 className="font-mono font-bold text-primary">CORE PRINCIPLE</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A high Nash Satoshi score does not mean a token will go up. It means the token appears
              better positioned across the framework than lower-ranked alternatives.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 border-t border-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-accent/20 bg-accent/5 text-accent text-xs font-mono tracking-wider mb-5">
              <Layers className="w-3 h-3" />
              4_MODEL_WORKFLOW
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              <span className="text-glow-cyan">The 4-model workflow</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflow.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true }}
                className="cyber-card rounded border border-white/10 p-6 hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 rounded border border-primary/30 bg-primary/10 flex items-center justify-center mb-5">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-[10px] font-mono text-accent mb-2">STEP_0{index + 1}</div>
                <h3 className="font-mono font-bold mb-3">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-primary/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
              <span className="text-muted-foreground">What gets</span>{" "}
              <span className="text-glow-cyan">evaluated</span>
            </h2>
            <div className="grid gap-3">
              {evaluatedSignals.map((signal) => (
                <div key={signal} className="flex items-start gap-3 rounded border border-white/10 bg-card/40 p-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{signal}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="cyber-card rounded border border-accent/20 p-6">
              <Users className="w-6 h-6 text-accent mb-4" />
              <h2 className="font-display font-bold text-2xl mb-4">Game-theory positioning</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Game-theory positioning asks what rational actors are incentivized to do. Does the
                token create durable reasons to hold, use, build, or coordinate? Can the narrative
                survive once rewards, hype, or short-term momentum fade?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A token can have strong product claims and weak incentives. It can have attention and
                weak coordination. Nash Satoshi tries to surface those differences.
              </p>
            </div>
            <div className="cyber-card rounded border border-primary/20 p-6">
              <Target className="w-6 h-6 text-primary mb-4" />
              <h2 className="font-display font-bold text-2xl mb-4">How to read a score</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Read the score as a positioning score, not a forecast. The most useful parts are often
                the repeated model reasoning, the recurring risks, and the gap between consensus and
                disagreement.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono tracking-wider mb-5">
              <HelpCircle className="w-3 h-3" />
              FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-glow-cyan">
              Methodology FAQ
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="cyber-card rounded border border-white/10 p-5">
                <h3 className="font-mono font-bold mb-2 text-primary">{faq.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
            <span className="text-muted-foreground">Read the current</span>{" "}
            <span className="text-glow-cyan">game-theory rankings</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto font-mono text-sm">
            Compare token positioning, model consensus, and ranked research outputs in the live Nash Satoshi rankings.
          </p>
          <Link href="/rankings">
            <Button size="lg" className="font-mono text-sm gap-2 bg-primary hover:bg-primary/90">
              VIEW CURRENT RANKINGS
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
