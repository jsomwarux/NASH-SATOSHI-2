import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import {
  getAnalysis,
  getAnalysisByToken,
  getAnalysisBySymbol,
  getAnalysisStatus,
  searchTokens,
  getTokenDetails,
  getTokenStats,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Token Search Hook - minimal caching to prevent stale results
export function useTokenSearch(query: string) {
  return useQuery({
    queryKey: ["tokenSearch", query],
    queryFn: () => searchTokens(query),
    enabled: query.length >= 2,
    staleTime: 0, // Always fetch fresh results
    gcTime: 10 * 1000, // Garbage collect after 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// Token Details Hook
export function useTokenDetails(tokenId: string | null) {
  return useQuery({
    queryKey: ["tokenDetails", tokenId],
    queryFn: () => getTokenDetails(tokenId!),
    enabled: !!tokenId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

// Analysis by ID Hook with status polling
export function useAnalysis(analysisId: number | null) {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const [shouldPoll, setShouldPoll] = useState(false);
  const [lastCompletedId, setLastCompletedId] = useState<number | null>(null);

  // Memoized fetch function that includes auth token
  const fetchAnalysis = useCallback(async () => {
    const token = await getAccessToken();
    return getAnalysis(analysisId!, token || undefined);
  }, [analysisId, getAccessToken]);

  const analysisQuery = useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: fetchAnalysis,
    enabled: !!analysisId && analysisId > 0,
    staleTime: 0, // Always refetch to get fresh data
    gcTime: 0, // Don't cache completed analyses to avoid stale data
    retry: 5, // Retry up to 5 times on failure (handles transient DB errors)
    retryDelay: (attemptIndex) => Math.min(500 * Math.pow(2, attemptIndex), 5000), // Exponential: 500ms, 1s, 2s, 4s, 5s
  });

  // Check if we need to poll for status updates
  useEffect(() => {
    const status = analysisQuery.data?.status;
    if (status === "pending" || status === "processing") {
      setShouldPoll(true);
    } else {
      setShouldPoll(false);
    }
  }, [analysisQuery.data?.status]);

  // Status polling query
  // With webhook-based completion, we can poll less frequently
  // The webhook updates the DB immediately, client picks it up on next poll
  const statusQuery = useQuery({
    queryKey: ["analysisStatus", analysisId],
    queryFn: () => getAnalysisStatus(analysisId!),
    enabled: !!analysisId && shouldPoll,
    refetchInterval: shouldPoll ? 10000 : false, // Poll every 10 seconds (webhook handles real-time)
    staleTime: 0,
  });

  // When status changes to completed, refetch the full analysis immediately
  useEffect(() => {
    if ((statusQuery.data?.status === "completed" || statusQuery.data?.status === "failed") && analysisId !== lastCompletedId) {
      setShouldPoll(false);
      setLastCompletedId(analysisId);
      // Force immediate refetch by removing from cache and refetching
      queryClient.removeQueries({ queryKey: ["analysis", analysisId] });
      queryClient.refetchQueries({ queryKey: ["analysis", analysisId] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["userAnalyses"] });
    }
  }, [statusQuery.data?.status, analysisId, queryClient, lastCompletedId]);

  return {
    ...analysisQuery,
    status: statusQuery.data?.status || analysisQuery.data?.status,
    isPolling: shouldPoll,
    // Progress info from status polling
    elapsedSeconds: statusQuery.data?.elapsedSeconds,
    nodesCompleted: statusQuery.data?.nodesCompleted,
    currentNode: statusQuery.data?.currentNode,
    startTime: statusQuery.data?.startTime,
  };
}

// Analysis by Token ID Hook
export function useAnalysisByToken(tokenId: string | null) {
  return useQuery({
    queryKey: ["analysisByToken", tokenId],
    queryFn: () => getAnalysisByToken(tokenId!),
    enabled: !!tokenId,
    retry: 3, // Retry for transient errors
    retryDelay: (attemptIndex) => Math.min(500 * Math.pow(2, attemptIndex), 3000),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Analysis by Symbol Hook (for clean URLs like /token/PREDI)
export function useAnalysisBySymbol(symbol: string | null) {
  const { getAccessToken } = useAuth();

  const fetchAnalysis = useCallback(async () => {
    const token = await getAccessToken();
    return getAnalysisBySymbol(symbol!, token || undefined);
  }, [symbol, getAccessToken]);

  return useQuery({
    queryKey: ["analysisBySymbol", symbol?.toUpperCase()],
    queryFn: fetchAnalysis,
    enabled: !!symbol,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(500 * Math.pow(2, attemptIndex), 3000),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Token Stats Hook (aggregate data for tokens with multiple analyses)
export function useTokenStats(tokenId: string | null) {
  return useQuery({
    queryKey: ["tokenStats", tokenId],
    queryFn: () => getTokenStats(tokenId!),
    enabled: !!tokenId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * Math.pow(2, attemptIndex), 2000),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}
