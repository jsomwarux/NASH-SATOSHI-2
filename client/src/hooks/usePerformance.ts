import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { PerformanceSummary, TokenPerformance, GlobalMarketData } from "@shared/schema";

/**
 * Hook to fetch aggregate performance metrics for the leaderboard
 */
export function usePerformanceMetrics() {
  return useQuery({
    queryKey: ["performanceMetrics"],
    queryFn: () => fetchApi<PerformanceSummary>("/api/performance/summary"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

/**
 * Hook to fetch individual token performance data
 */
export function useTokenPerformance(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["tokenPerformance", tokenId],
    queryFn: () => fetchApi<TokenPerformance>(`/api/performance/token/${tokenId}`),
    enabled: !!tokenId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch global crypto market data (total market cap changes)
 */
export function useGlobalMarketData() {
  return useQuery({
    queryKey: ["globalMarketData"],
    queryFn: () => fetchApi<GlobalMarketData>("/api/market/global"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}
