// Aggregated leaderboard entry - one per token with 7D/30D metrics
export interface AggregatedLeaderboardItem {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  // Historical metrics (kept for backward compatibility)
  score7d: number;
  runs7d: number;
  score30d: number;
  runs30d: number;
  // Confidence indicator based on sample size
  confidence: 'high' | 'medium' | 'low';
  // Latest analysis info (primary display)
  latestTier: string;
  latestNarrative: string | null;
  latestPrimaryNarrative: string | null;
  latestSubNarrative: string | null;
  latestRecommendation: string | null; // BUY, HOLD, AVOID
  latestAnalysisId: number;
  latestAnalysisDate: string; // ISO date string from API
  latestScore: number; // Score from the most recent analysis (PRIMARY SCORE)
  // Score trend (for TREND column)
  previousScore: number | null; // Score from second most recent analysis
  scoreTrend: number | null; // Difference: latestScore - previousScore
  // Token type and asymmetry
  tokenType: 'UTILITY' | 'MEMECOIN' | 'HYBRID' | null;
  asymmetryScore: number | null;
  marketCapTier: 'mega' | 'large' | 'mid' | 'small' | null;
  // Upside potential
  upsideTier: '<5x' | '5-10x' | '10-25x' | '25-50x' | '50-100x' | '100x+' | null;
  upsideMultiple: string | null; // e.g., "10x", "50x", "100x"
  // Overall rank (by latestScore desc, unaffected by filters/sorting)
  overallRank: number;
}
