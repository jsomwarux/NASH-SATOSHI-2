// Aggregated leaderboard entry - one per token with 7D/30D metrics
export interface AggregatedLeaderboardItem {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  // Primary metric: 7D weighted average score
  score7d: number;
  runs7d: number;
  // Secondary metric: 30D average score
  score30d: number;
  runs30d: number;
  // Confidence indicator based on sample size
  confidence: 'high' | 'medium' | 'low';
  // Latest analysis info
  latestTier: string;
  latestNarrative: string | null;
  latestAnalysisId: number;
  latestAnalysisDate: string; // ISO date string from API
}
