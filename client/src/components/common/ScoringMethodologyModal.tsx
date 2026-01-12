import { X, Brain, Target, Users, Sparkles, BarChart3, Zap, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ScoringMethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MethodologyItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay: number;
}

function MethodologyItem({ icon, title, description, color, delay }: MethodologyItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex gap-4"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function ScoringMethodologyModal({ isOpen, onClose }: ScoringMethodologyModalProps) {
  if (!isOpen) return null;

  const methodologyItems = [
    {
      icon: <Target className="w-5 h-5 text-blue-400" />,
      title: "Fundamentals",
      description: "We evaluate narrative positioning, technology, team credibility, tokenomics structure, traction metrics, and competitive landscape.",
      color: "bg-blue-500/20 border border-blue-500/30",
      delay: 0.1,
    },
    {
      icon: <Users className="w-5 h-5 text-purple-400" />,
      title: "Game Theory",
      description: "We go beyond fundamentals to analyze market coordination dynamics — assessing whether conditions favor buyers or sellers and how sustainable current market positioning is.",
      color: "bg-purple-500/20 border border-purple-500/30",
      delay: 0.2,
    },
    {
      icon: <Brain className="w-5 h-5 text-emerald-400" />,
      title: "Multi-Model Consensus",
      description: "Every token is independently analyzed by four AI models that deliberate and challenge each other before producing a final score.",
      color: "bg-emerald-500/20 border border-emerald-500/30",
      delay: 0.3,
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      title: "The Score",
      description: "A single 0-100 score representing probability-weighted expected value — balancing quality, timing, and risk-adjusted upside.",
      color: "bg-amber-500/20 border border-amber-500/30",
      delay: 0.4,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-lg w-full bg-card border border-primary/20 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative header gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-between p-5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">How Scoring Works</h3>
                <p className="text-xs text-muted-foreground">Understanding our methodology</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 hover:bg-primary/10">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="relative p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Intro text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-4 rounded-xl bg-secondary/50 border border-white/5"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our system combines <span className="text-foreground font-medium">traditional crypto research</span> with
                proprietary <span className="text-foreground font-medium">game-theoretic analysis</span> to surface
                high-conviction opportunities.
              </p>
            </motion.div>

            {/* Methodology items */}
            <div className="space-y-5">
              {methodologyItems.map((item, index) => (
                <MethodologyItem key={index} {...item} />
              ))}
            </div>

            {/* Score scale visual */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="pt-2"
            >
              <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Score Distribution
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                <div className="flex-1 bg-red-500/60" title="0-39: C Tier" />
                <div className="flex-1 bg-yellow-500/60" title="40-54: B Tier" />
                <div className="flex-1 bg-emerald-500/60" title="55-69: A Tier" />
                <div className="flex-1 bg-green-500/60" title="70-84: S Tier" />
                <div className="flex-1 bg-purple-500/60" title="85+: S+ Tier" />
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
            </motion.div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-secondary/30 border-t border-primary/10">
            <p className="text-xs text-muted-foreground text-center">
              Scores are updated with each new analysis run. Past performance does not guarantee future results.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
