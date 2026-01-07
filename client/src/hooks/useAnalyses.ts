import { useQuery } from "@tanstack/react-query";
import { getUserAnalyses, getAllAnalyses, type AllAnalysesOptions } from "@/lib/api";

// For authenticated users - get their analyses
export function useUserAnalyses(authToken: string | null, options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["userAnalyses", authToken, options],
    queryFn: () => {
      if (!authToken) {
        return { items: [], total: 0 };
      }
      return getUserAnalyses({
        authToken,
        limit: options?.limit,
        offset: options?.offset,
      });
    },
    enabled: !!authToken,
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Legacy: For unauthenticated view (all analyses)
export function useAllAnalyses(options?: AllAnalysesOptions) {
  return useQuery({
    queryKey: ["allAnalyses", options],
    queryFn: () => getAllAnalyses(options),
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });
}
