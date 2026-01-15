import { useEffect, useCallback } from "react";
import { trackReferralVisit, convertReferral } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Generate a unique visitor ID for anonymous tracking
function getOrCreateVisitorId(): string {
  const stored = localStorage.getItem("visitorId");
  if (stored) return stored;

  // Generate a random ID
  const id = crypto.randomUUID ? crypto.randomUUID() :
    `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  localStorage.setItem("visitorId", id);
  return id;
}

// Get stored referral info
export function getReferralInfo(): { code: string; referredAt: string } | null {
  const code = localStorage.getItem("referrer");
  const referredAt = localStorage.getItem("referredAt");
  if (code && referredAt) {
    return { code, referredAt };
  }
  return null;
}

// Clear referral info (after conversion)
export function clearReferralInfo(): void {
  localStorage.removeItem("referrer");
  localStorage.removeItem("referredAt");
}

export function useReferralTracking() {
  const { user, getAccessToken } = useAuth();

  // Check for referral code in URL and track the visit
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");

    if (refCode) {
      // Store the referral code in localStorage
      localStorage.setItem("referrer", refCode);
      localStorage.setItem("referredAt", new Date().toISOString());

      // Track the visit
      const visitorId = getOrCreateVisitorId();
      trackReferralVisit(refCode, visitorId).catch((err) => {
        console.error("Failed to track referral visit:", err);
      });

      // Clean the URL (remove ref parameter)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("ref");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  // Convert referral when user signs up/logs in
  const handleReferralConversion = useCallback(async () => {
    if (!user) return;

    const referralInfo = getReferralInfo();
    if (!referralInfo) return;

    try {
      const token = await getAccessToken();
      if (!token) return;

      const visitorId = getOrCreateVisitorId();
      await convertReferral(visitorId, referralInfo.code, token);

      // Clear the referral info after successful conversion
      clearReferralInfo();

      console.log("Referral converted successfully");
    } catch (err) {
      console.error("Failed to convert referral:", err);
    }
  }, [user, getAccessToken]);

  // Automatically convert when user logs in
  useEffect(() => {
    if (user) {
      handleReferralConversion();
    }
  }, [user, handleReferralConversion]);

  return {
    getReferralInfo,
    clearReferralInfo,
    handleReferralConversion,
  };
}
