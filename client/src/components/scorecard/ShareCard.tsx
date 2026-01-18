import { forwardRef, useState } from "react";
import { Trophy, TrendingUp, Zap, Target, Users, Brain } from "lucide-react";
import type { TokenAnalysis } from "@shared/schema";
import { formatScore } from "@/lib/utils";

interface ShareCardProps {
  analysis: TokenAnalysis;
  preloadedImageBase64?: string | null;
}

// Get tier style for the share card
// Note: Using solid colors and borders instead of shadows for reliable mobile capture
function getTierStyle(tier: string | null) {
  switch (tier?.toUpperCase()) {
    case "S+":
      return { bg: "from-amber-500 to-yellow-500", text: "text-amber-900", border: "border-2 border-amber-300" };
    case "S":
      return { bg: "from-green-500 to-emerald-500", text: "text-green-900", border: "border-2 border-green-300" };
    case "A":
      return { bg: "from-blue-500 to-cyan-500", text: "text-blue-900", border: "border-2 border-blue-300" };
    case "B":
      return { bg: "from-yellow-500 to-orange-500", text: "text-yellow-900", border: "border-2 border-yellow-300" };
    case "C":
      return { bg: "from-red-500 to-rose-500", text: "text-red-900", border: "border-2 border-red-300" };
    default:
      return { bg: "from-gray-500 to-slate-500", text: "text-gray-900", border: "border-2 border-gray-300" };
  }
}

// Get recommendation style
function getRecStyle(rec: string | null) {
  const r = rec?.toUpperCase();
  if (r?.includes("CAUTIOUS")) {
    return { bg: "bg-amber-500", text: "text-amber-900", label: "CAUTIOUS BUY" };
  }
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

// Get phase style
function getPhaseStyle(phase: number | null) {
  switch (phase) {
    case 1: return { label: "Stealth", color: "text-purple-400", bg: "bg-purple-500/20" };
    case 2: return { label: "Expansion", color: "text-green-400", bg: "bg-green-500/20" };
    case 3: return { label: "Mania", color: "text-amber-400", bg: "bg-amber-500/20" };
    case 4: return { label: "Distribution", color: "text-orange-400", bg: "bg-orange-500/20" };
    case 5: return { label: "Dead", color: "text-red-400", bg: "bg-red-500/20" };
    default: return { label: "Unknown", color: "text-gray-400", bg: "bg-gray-500/20" };
  }
}

// Nash Satoshi hexagonal logo SVG component
function NashSatoshiLogo({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      {/* Outer hexagon */}
      <polygon
        points="20,2 36,11 36,29 20,38 4,29 4,11"
        fill="none"
        stroke="url(#shareLogoGradient)"
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* Inner hexagon */}
      <polygon
        points="20,8 30,14 30,26 20,32 10,26 10,14"
        fill="url(#shareLogoGradient)"
        opacity="0.3"
      />
      {/* Center circuit node */}
      <circle cx="20" cy="20" r="4" fill="url(#shareLogoGradient)" />
      {/* Circuit lines */}
      <line x1="20" y1="16" x2="20" y2="8" stroke="url(#shareLogoGradient)" strokeWidth="1" />
      <line x1="23.5" y1="22" x2="30" y2="26" stroke="url(#shareLogoGradient)" strokeWidth="1" />
      <line x1="16.5" y1="22" x2="10" y2="26" stroke="url(#shareLogoGradient)" strokeWidth="1" />
      <defs>
        <linearGradient id="shareLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ff" />
          <stop offset="100%" stopColor="#f0f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ analysis, preloadedImageBase64 }, ref) => {
    const [imageError, setImageError] = useState(false);
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

    const narrative = (analysis.narrative as string) || 'Unknown';
    const phaseValue = analysis.phase;
    const phase = phaseValue ? parseInt(String(phaseValue)) : null;
    const phaseStyle = getPhaseStyle(phase);

    // Check if we should show the image or fallback to initials
    // Prefer preloaded base64 image if available (for reliable mobile capture)
    const showImage = (preloadedImageBase64 || analysis.tokenImage) && !imageError;
    const imageSrc = preloadedImageBase64 || `/api/image-proxy?url=${encodeURIComponent(analysis.tokenImage!)}`;

    return (
      <div
        ref={ref}
        className="w-[800px] h-[450px] bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] p-6 relative overflow-hidden"
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {showImage ? (
                <img
                  src={imageSrc}
                  alt={analysis.tokenName}
                  className="w-14 h-14 rounded-xl bg-white/10 ring-2 ring-white/20"
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
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
                    {isMemecoin ? 'MEME' : 'UTIL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tier Badge */}
            <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierStyle.bg} ${tierStyle.border}`}>
              <span className={`text-2xl font-black ${tierStyle.text}`}>{analysis.tier || 'N/A'}</span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex gap-6">
            {/* Left: Score Display */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center">
                <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Game Theory Score</div>
                <div className={`text-7xl font-black ${getScoreColor(finalScore)} drop-shadow-lg`} style={{ textShadow: '0 0 40px currentColor' }}>
                  {formatScore(finalScore)}
                </div>
                <div className="text-gray-500 text-sm mt-1">out of 100</div>
                <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${recStyle.bg} ${recStyle.text}`}>
                  {recStyle.label}
                </div>
              </div>
            </div>

            {/* Right: Narrative & Phase */}
            <div className="w-48 flex flex-col justify-center gap-3">
              {/* Narrative */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Narrative</div>
                <div className="text-sm font-bold text-cyan-400 truncate" title={narrative}>
                  {narrative}
                </div>
              </div>

              {/* Phase */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Phase</div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${phaseStyle.color}`}>
                    {phase || '?'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${phaseStyle.bg} ${phaseStyle.color} font-medium`}>
                    {phaseStyle.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Component Scores */}
          <div className="grid grid-cols-6 gap-3 mb-3 mt-2">
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
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold text-white">
                    {Math.round(item.value)}<span className="text-gray-500 font-normal">/{item.max}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer - Branding Strip */}
          <div className="flex items-center justify-center py-2.5 px-4 -mx-6 -mb-6 bg-gradient-to-r from-purple-900/50 via-slate-900/80 to-cyan-900/50 border-t border-white/10">
            <div className="flex items-center gap-3">
              {/* Nash Satoshi Logo */}
              <NashSatoshiLogo size={28} />
              {/* Branding Text */}
              <div className="text-sm text-gray-300">
                <span className="font-bold" style={{ color: '#0ff' }}>NASH</span>
                <span className="font-bold text-purple-400">SATOSHI</span>
                <span className="text-gray-500 mx-2">•</span>
                <span className="text-gray-400">4-LLM Game Theory Consensus</span>
                <span className="text-gray-500 mx-2">•</span>
                <span className="text-cyan-400 font-semibold">nashsatoshi.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
