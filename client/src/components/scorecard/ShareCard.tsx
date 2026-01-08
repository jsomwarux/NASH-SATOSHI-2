import { forwardRef } from "react";
import { Trophy, TrendingUp, Zap, Target, Users, Brain } from "lucide-react";
import type { TokenAnalysis } from "@shared/schema";

interface ShareCardProps {
  analysis: TokenAnalysis;
}

// Get tier style for the share card
function getTierStyle(tier: string | null) {
  switch (tier?.toUpperCase()) {
    case "S+":
      return { bg: "from-amber-500 to-yellow-500", text: "text-amber-900", glow: "shadow-amber-500/50" };
    case "S":
      return { bg: "from-green-500 to-emerald-500", text: "text-green-900", glow: "shadow-green-500/50" };
    case "A":
      return { bg: "from-blue-500 to-cyan-500", text: "text-blue-900", glow: "shadow-blue-500/50" };
    case "B":
      return { bg: "from-yellow-500 to-orange-500", text: "text-yellow-900", glow: "shadow-yellow-500/50" };
    case "C":
      return { bg: "from-red-500 to-rose-500", text: "text-red-900", glow: "shadow-red-500/50" };
    default:
      return { bg: "from-gray-500 to-slate-500", text: "text-gray-900", glow: "shadow-gray-500/50" };
  }
}

// Get recommendation style
function getRecStyle(rec: string | null) {
  const r = rec?.toUpperCase();
  if (r?.includes("BUY") || r?.includes("STRONG")) {
    return { bg: "bg-green-500", text: "text-white", label: "BUY" };
  }
  if (r?.includes("HOLD") || r?.includes("MODERATE")) {
    return { bg: "bg-yellow-500", text: "text-yellow-900", label: "HOLD" };
  }
  if (r?.includes("AVOID") || r?.includes("SELL")) {
    return { bg: "bg-red-500", text: "text-white", label: "AVOID" };
  }
  return { bg: "bg-gray-500", text: "text-white", label: "PENDING" };
}

// Get score color
function getScoreColor(score: number) {
  if (score >= 85) return "text-amber-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ analysis }, ref) => {
    const finalScore = parseFloat(analysis.finalScore as string) || 0;
    const tierStyle = getTierStyle(analysis.tier);
    const recStyle = getRecStyle(analysis.recommendation);

    // Parse component scores
    const coordinationScore = parseFloat(analysis.coordinationScore as string) || 0;
    const schellingScore = parseFloat(analysis.schellingRankScore as string) || 0;
    const reflexivityScore = parseFloat(analysis.reflexivityScore as string) || 0;
    const viralityScore = parseFloat(analysis.viralityScore as string) || 0;
    const asymmetryScore = parseFloat(analysis.asymmetryScore as string) || 0;
    const gameTheoryBonus = parseFloat(analysis.gameTheoryBonus as string) || 0;

    const tokenType = (analysis.tokenType as string) || 'UTILITY';
    const isMemecoin = tokenType === 'MEMECOIN';

    return (
      <div
        ref={ref}
        className="w-[600px] h-[400px] bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] p-6 relative overflow-hidden"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Background grid effect */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
        </div>

        {/* Glow effects */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-cyan-500/20 rounded-full blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {analysis.tokenImage ? (
                <img
                  src={analysis.tokenImage}
                  alt={analysis.tokenName}
                  className="w-14 h-14 rounded-xl bg-white/10 ring-2 ring-white/20"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center ring-2 ring-white/20">
                  <span className="font-bold text-xl text-white">
                    {analysis.tokenSymbol.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{analysis.tokenName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-gray-400 uppercase font-mono text-sm">${analysis.tokenSymbol}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isMemecoin ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {isMemecoin ? 'MEMECOIN' : 'UTILITY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tier Badge */}
            <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierStyle.bg} ${tierStyle.glow} shadow-lg`}>
              <span className={`text-2xl font-black ${tierStyle.text}`}>{analysis.tier || 'N/A'}</span>
            </div>
          </div>

          {/* Main Score */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Game Theory Score</div>
              <div className={`text-7xl font-black ${getScoreColor(finalScore)} drop-shadow-lg`} style={{ textShadow: '0 0 40px currentColor' }}>
                {finalScore.toFixed(1)}
              </div>
              <div className="text-gray-500 text-sm mt-1">out of 100</div>
              <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${recStyle.bg} ${recStyle.text}`}>
                {recStyle.label}
              </div>
            </div>
          </div>

          {/* Component Scores */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {[
              { label: "COORD", value: coordinationScore, max: 20, icon: Users },
              { label: "SCHEL", value: schellingScore, max: 10, icon: Target },
              { label: "REFLEX", value: reflexivityScore, max: 15, icon: TrendingUp },
              { label: "VIRAL", value: viralityScore, max: 15, icon: Zap },
              { label: "ASYM", value: asymmetryScore, max: 25, icon: Trophy },
              { label: "GT", value: gameTheoryBonus, max: 15, icon: Brain },
            ].map((item) => {
              const Icon = item.icon;
              const pct = (item.value / item.max) * 100;
              return (
                <div key={item.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Icon className="w-3 h-3 text-gray-500" />
                    <span className="text-[9px] text-gray-500 font-medium">{item.label}</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold text-white">{item.value.toFixed(1)}</div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <span className="text-[10px] font-black text-white">NS</span>
              </div>
              <span className="text-xs text-gray-400 font-medium">Nash Satoshi</span>
            </div>
            <div className="text-[10px] text-gray-500">
              4-LLM Consensus • {analysis.consensusLevel || 'MIXED'}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
