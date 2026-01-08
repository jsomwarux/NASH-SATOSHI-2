import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  analyzeToken,
  getAnalysis,
  getAnalysisByToken,
  getAnalysisStatus,
  searchTokens,
  getTokenDetails,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalysisTracker } from "@/contexts/AnalysisTrackerContext";
import type { AnalyzeTokenRequest, TokenSearchResult } from "@shared/schema";

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
  const [shouldPoll, setShouldPoll] = useState(false);
  const [lastCompletedId, setLastCompletedId] = useState<number | null>(null);

  const analysisQuery = useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: () => getAnalysis(analysisId!),
    enabled: !!analysisId && analysisId > 0,
    staleTime: 0, // Always refetch to get fresh data
    gcTime: 0, // Don't cache completed analyses to avoid stale data
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
    retry: false, // Don't retry on 404
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Analyze Token Mutation
export function useAnalyzeToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AnalyzeTokenRequest) => analyzeToken(request),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["analysisByToken", variables.tokenId] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// Combined hook for selecting and analyzing a token
export function useTokenAnalyzer() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { trackAnalysis } = useAnalysisTracker();

  const analyzeTokenMutation = useMutation({
    mutationFn: async ({ request, authToken }: { request: AnalyzeTokenRequest; authToken?: string }) => {
      return analyzeToken(request, authToken);
    },
    onSuccess: (data, variables) => {
      // Track the analysis for background monitoring
      trackAnalysis({
        id: data.analysisId,
        tokenSymbol: variables.request.tokenSymbol,
        tokenName: variables.request.tokenName,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["analysisByToken", variables.request.tokenId] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["userAnalyses"] });
    },
  });

  const startAnalysis = async (token: TokenSearchResult) => {
    // Get the auth token to associate analysis with user
    const authToken = await getAccessToken();

    const result = await analyzeTokenMutation.mutateAsync({
      request: {
        tokenId: token.id,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenImage: token.large || token.thumb,
      },
      authToken: authToken || undefined,
    });
    return result;
  };

  return {
    startAnalysis,
    isAnalyzing: analyzeTokenMutation.isPending,
    error: analyzeTokenMutation.error,
  };
}
