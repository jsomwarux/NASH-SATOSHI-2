import { forwardRef } from "react";
import { Brain, CircuitBoard, Hash, ShieldCheck, TrendingUp } from "lucide-react";
import type { AggregatedLeaderboardItem } from "@/types/leaderboard";
import { formatScore } from "@/lib/utils";

export interface WeeklyReceiptRow {
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  rank: number;
  rankDelta: string;
  thesis: string;
  disagreement: string;
  sourceTag: string;
  score: number;
  tier: string;
  narrative: string;
}

export interface WeeklyReceiptData {
  weekLabel: string;
  generatedAtLabel: string;
  category: string;
  rows: WeeklyReceiptRow[];
  headline: string;
  sourceMode: "live" | "curated_fallback";
  sourceTags: string[];
}

interface WeeklyReceiptCardProps {
  receipt: WeeklyReceiptData;
}

const AI_AGENT_MATCHERS = ["ai agent", "agent", "x402", "autonomous", "bot", "automation", "agentic"];

export function isAiAgentLeaderboardItem(item: AggregatedLeaderboardItem) {
  const fields = [item.latestPrimaryNarrative, item.latestSubNarrative, item.latestNarrative]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (item.latestPrimaryNarrative?.trim().toLowerCase() === "ai agents") return true;
  return AI_AGENT_MATCHERS.some((matcher) => fields.includes(matcher));
}

function cleanNarrative(value: string | null | undefined) {
  if (!value) return "AI Agents";
  return value.replace(/^Narrative:\s*/i, "").trim() || "AI Agents";
}

function rankDeltaLabel(item: AggregatedLeaderboardItem) {
  if (typeof item.scoreTrend !== "number") return "tracked";
  if (Math.abs(item.scoreTrend) < 0.01) return "flat";
  return item.scoreTrend > 0 ? `+${item.scoreTrend.toFixed(1)} score` : `${item.scoreTrend.toFixed(1)} score`;
}

function thesisForItem(item: AggregatedLeaderboardItem) {
  const primary = cleanNarrative(item.latestPrimaryNarrative || item.latestNarrative);
  const sub = cleanNarrative(item.latestSubNarrative);
  const score = formatScore(item.latestScore);

  if (sub && sub !== primary) {
    return `${primary} / ${sub} narrative strength; latest model score ${score}.`;
  }

  return `${primary} narrative strength; latest model score ${score}.`;
}

function disagreementForItem(item: AggregatedLeaderboardItem) {
  if (typeof item.scoreTrend === "number" && Math.abs(item.scoreTrend) >= 5) {
    return `Model consensus moved ${item.scoreTrend > 0 ? "up" : "down"} by ${Math.abs(item.scoreTrend).toFixed(1)} pts.`;
  }

  if (item.confidence === "high") return "High sample confidence across recent analyses.";
  if (item.confidence === "medium") return "Moderate sample confidence; monitor next run.";
  return "Low sample count; treat as early ranking signal.";
}

export function buildWeeklyReceiptRows(items: AggregatedLeaderboardItem[], maxRows = 7) {
  const aiAgentMatches = items.filter(isAiAgentLeaderboardItem);
  const sourceItems = aiAgentMatches.length >= 5 ? aiAgentMatches : items.slice(0, maxRows);
  const rows = sourceItems.slice(0, maxRows).map((item, index) => ({
    tokenSymbol: item.tokenSymbol,
    tokenName: item.tokenName,
    tokenImage: item.tokenImage,
    rank: item.overallRank || index + 1,
    rankDelta: rankDeltaLabel(item),
    thesis: thesisForItem(item),
    disagreement: disagreementForItem(item),
    sourceTag: isAiAgentLeaderboardItem(item) ? "live_ai_agent_match" : "curated_top_rank_fallback",
    score: item.latestScore,
    tier: item.latestTier,
    narrative: cleanNarrative(item.latestPrimaryNarrative || item.latestSubNarrative || item.latestNarrative),
  }));

  return {
    rows,
    sourceMode: aiAgentMatches.length >= 5 ? "live" as const : "curated_fallback" as const,
    aiAgentMatchCount: aiAgentMatches.length,
  };
}

function tierColor(tier: string) {
  const normalized = tier?.toUpperCase();
  if (normalized === "S+") return "text-amber-300 border-amber-300/50 bg-amber-300/10";
  if (normalized === "S") return "text-emerald-300 border-emerald-300/50 bg-emerald-300/10";
  if (normalized === "A") return "text-cyan-300 border-cyan-300/50 bg-cyan-300/10";
  return "text-slate-300 border-slate-300/40 bg-slate-300/10";
}

export const WeeklyReceiptCard = forwardRef<HTMLDivElement, WeeklyReceiptCardProps>(({ receipt }, ref) => {
  const sourceLabel = receipt.sourceMode === "live" ? "LIVE CATEGORY FILTER" : "CURATED FALLBACK FROM CURRENT RANKINGS";

  return (
    <div
      ref={ref}
      className="relative h-[1200px] w-[1200px] overflow-hidden bg-[#05070d] p-12 text-white"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}
    >
      <div className="absolute inset-0 opacity-[0.09]" style={{
        backgroundImage: "linear-gradient(rgba(34,211,238,.75) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.75) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
      }} />
      <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-cyan-400/20 blur-[130px]" />
      <div className="absolute -right-28 bottom-24 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-[150px]" />
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-cyan-300" />

      <div className="relative z-10 flex h-full flex-col rounded-[36px] border border-cyan-300/30 bg-black/45 p-9 shadow-[0_0_70px_rgba(34,211,238,.12)]">
        <header className="flex items-start justify-between border-b border-cyan-300/20 pb-7">
          <div>
            <div className="mb-4 flex items-center gap-3 font-mono text-2xl uppercase tracking-[0.28em] text-cyan-200">
              <CircuitBoard className="h-7 w-7" />
              Nash Satoshi
            </div>
            <h1 className="max-w-[760px] text-7xl font-black leading-[0.93] tracking-[-0.06em]">
              Weekly AI Agents Ranking Receipt
            </h1>
            <p className="mt-5 max-w-[780px] font-mono text-2xl leading-snug text-slate-300">
              {receipt.headline}
            </p>
          </div>
          <div className="rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-5 text-right font-mono">
            <div className="text-xs uppercase tracking-[0.35em] text-cyan-200">Week</div>
            <div className="mt-2 text-3xl font-black text-white">{receipt.weekLabel}</div>
            <div className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">Category</div>
            <div className="mt-1 text-2xl font-bold text-fuchsia-200">{receipt.category}</div>
          </div>
        </header>

        <section className="mt-8 grid gap-4">
          {receipt.rows.map((row) => (
            <div key={`${row.rank}-${row.tokenSymbol}`} className="grid grid-cols-[112px_1fr_128px] items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
              <div className="text-center font-mono">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Rank</div>
                <div className="text-5xl font-black text-cyan-200">#{row.rank}</div>
                <div className="mt-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] uppercase text-cyan-100">{row.rankDelta}</div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-4">
                  {row.tokenImage ? (
                    <img src={row.tokenImage} alt={row.tokenName} crossOrigin="anonymous" className="h-14 w-14 rounded-2xl border border-white/20 bg-white/10" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30 font-mono text-xl font-black">
                      {row.tokenSymbol.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h2 className="truncate text-3xl font-black tracking-tight">{row.tokenName}</h2>
                      <span className="font-mono text-xl uppercase text-cyan-200">${row.tokenSymbol}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                      <Hash className="h-3.5 w-3.5" />
                      {row.narrative}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xl leading-snug text-slate-200">{row.thesis}</p>
                <div className="mt-3 flex items-center gap-2 font-mono text-sm text-slate-400">
                  <Brain className="h-4 w-4 text-fuchsia-200" />
                  {row.disagreement}
                </div>
              </div>

              <div className="text-right font-mono">
                <div className={`ml-auto inline-flex rounded-2xl border px-4 py-2 text-3xl font-black ${tierColor(row.tier)}`}>{row.tier || "—"}</div>
                <div className="mt-4 text-xs uppercase tracking-[0.28em] text-slate-500">Score</div>
                <div className="text-4xl font-black text-white">{formatScore(row.score)}</div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.sourceTag}</div>
              </div>
            </div>
          ))}
        </section>

        <footer className="mt-auto border-t border-cyan-300/20 pt-7">
          <div className="mb-5 grid grid-cols-3 gap-4 font-mono text-sm">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-cyan-200"><TrendingUp className="h-4 w-4" /> Source</div>
              <div className="text-slate-300">{sourceLabel}</div>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-fuchsia-200"><Brain className="h-4 w-4" /> Method</div>
              <div className="text-slate-300">4-model game-theory ranking</div>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" /> Safety</div>
              <div className="text-slate-300">Research artifact, not a trade signal</div>
            </div>
          </div>
          <p className="font-mono text-xl leading-snug text-slate-300">
            Game theory + narrative + incentives + model disagreement. Not financial advice. No future-price forecast.
          </p>
          <div className="mt-4 font-mono text-sm text-slate-500">
            {receipt.generatedAtLabel} · {receipt.sourceTags.join(" · ")}
          </div>
        </footer>
      </div>
    </div>
  );
});

WeeklyReceiptCard.displayName = "WeeklyReceiptCard";
