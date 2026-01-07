import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSubscriptionTiers,
  getSubscriptionStatus,
  createCheckoutSession,
  createBillingPortal,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@/lib/api";

// Get subscription tiers (public)
export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ["subscriptionTiers"],
    queryFn: getSubscriptionTiers,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Get current user's subscription status
export function useSubscriptionStatus() {
  const { getAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["subscriptionStatus", user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      return getSubscriptionStatus(token || undefined);
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Create checkout session mutation
export function useCreateCheckout() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tier: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return createCheckoutSession(tier, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
    },
  });
}

// Create billing portal mutation
export function useCreateBillingPortal() {
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return createBillingPortal(token);
    },
  });
}

// Helper hook for checking if user can perform analysis
export function useCanAnalyze() {
  const { data: status, isLoading } = useSubscriptionStatus();

  return {
    canAnalyze: status?.canAnalyze ?? true,
    isLoading,
    dailyRemaining: status?.dailyRemaining,
    monthlyRemaining: status?.monthlyRemaining,
    tier: status?.tier ?? "free",
    tierName: status?.tierName ?? "Free",
  };
}

// Helper hook for getting leaderboard limit
export function useLeaderboardLimit() {
  const { data: status, isLoading } = useSubscriptionStatus();

  return {
    limit: status?.leaderboardLimit ?? 3,
    isLoading,
    isSubscribed: status?.isSubscribed ?? false,
  };
}
