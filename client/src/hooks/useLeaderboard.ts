import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, getFilterOptions, getLeaderboardStats, type LeaderboardOptions } from "@/lib/api";

export function useLeaderboard(options?: LeaderboardOptions) {
  return useQuery({
    queryKey: ["leaderboard", options],
    queryFn: () => getLeaderboard(options),
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ["filterOptions"],
    queryFn: () => getFilterOptions(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useLeaderboardStats() {
  return useQuery({
    queryKey: ["leaderboardStats"],
    queryFn: () => getLeaderboardStats(),
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchOnWindowFocus: true,
  });
}
