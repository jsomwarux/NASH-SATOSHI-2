import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSubscriptionTiers,
  getSubscriptionStatus,
  createCheckoutSession,
  createBillingPortal,
  verifyCheckoutSession,
  syncSubscription,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@/lib/api";

// Get subscription tiers (public)
export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ["subscriptionTiers"],
    queryFn: getSubscriptionTiers,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}

// Get current user's subscription status
export function useSubscriptionStatus() {
  const { getAccessToken, user, isConfigured } = useAuth();

  return useQuery({
    queryKey: ["subscriptionStatus", user?.id],
    queryFn: async () => {
      // Only try to get token if auth is configured
      const token = isConfigured ? await getAccessToken() : null;
      return getSubscriptionStatus(token || undefined);
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
    // Always fetch - API returns free tier status for unauthenticated users
    // No need to wait for auth config since API handles both cases
    retry: 1,
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

// Verify checkout session mutation
export function useVerifyCheckout() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return verifyCheckoutSession(sessionId, token);
    },
    onSuccess: () => {
      // Invalidate subscription status to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
    },
  });
}

// Sync subscription from Stripe mutation
// Used after returning from billing portal to get latest subscription state
export function useSyncSubscription() {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");
      return syncSubscription(token);
    },
    onSuccess: () => {
      // Invalidate subscription status to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["subscriptionStatus"] });
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
