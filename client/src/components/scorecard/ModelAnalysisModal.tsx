import { X, AlertTriangle, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ModelAnalysis } from "@shared/schema";

interface ModelAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
  modelAnalysis?: ModelAnalysis;
}

// Score color helper
function getScoreColor(score: number): string {
  if (score >= 85) return "text-amber-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 85) return "bg-purple-400/20 border-purple-400/30";
  if (score >= 70) return "bg-green-400/20 border-green-400/30";
  if (score >= 55) return "bg-yellow-400/20 border-yellow-400/30";
  return "bg-red-400/20 border-red-400/30";
}

export function ModelAnalysisModal({ isOpen, onClose, modelName, modelAnalysis }: ModelAnalysisModalProps) {
  if (!isOpen) return null;

  const score = modelAnalysis?.score ?? 0;
  const hasContent = modelAnalysis?.verdict || modelAnalysis?.reasoning;

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
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{modelName} Analysis</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Score Display */}
            <div className={`p-4 rounded-xl border ${getScoreBgColor(score)} text-center`}>
              <div className="text-xs text-muted-foreground mb-1">Model Score</div>
              <div className={`text-4xl font-bold font-mono ${getScoreColor(score)}`}>
                {score.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">out of 100</div>
            </div>

            {hasContent ? (
              <>
                {/* Verdict */}
                {modelAnalysis?.verdict && (
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">Verdict</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {modelAnalysis.verdict}
                    </p>
                  </div>
                )}

                {/* Reasoning */}
                {modelAnalysis?.reasoning && (
                  <div>
                    <h4 className="text-sm font-medium text-primary mb-2">Reasoning</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {modelAnalysis.reasoning}
                    </p>
                  </div>
                )}

                {/* Risks */}
                {modelAnalysis?.risks && modelAnalysis.risks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Key Risks Identified
                    </h4>
                    <ul className="space-y-2">
                      {modelAnalysis.risks.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-red-400 font-bold shrink-0">{i + 1}.</span>
                          <span className="text-muted-foreground">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              /* Fallback when no content */
              <div className="text-center py-8">
                <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Analysis details not available
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  This analysis was run before detailed model outputs were captured
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-secondary/30 border-t border-primary/10 text-center">
            <p className="text-xs text-muted-foreground">
              Individual model analysis from the 4-LLM consensus engine
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
