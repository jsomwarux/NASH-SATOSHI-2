import { useEffect, useCallback } from 'react';

const REFERRAL_STORAGE_KEY = 'gtf_referral';
const REFERRAL_EXPIRY_DAYS = 30;

interface StoredReferral {
  code: string;
  capturedAt: number; // timestamp
  source?: string; // URL where it was captured
}

/**
 * Captures referral code from URL (?ref=CODE) and persists it for 30 days.
 * Call this hook at the app root level to capture referrals on any page.
 */
export function useReferralCapture() {
  useEffect(() => {
    // Check URL for ref parameter
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode && refCode.trim()) {
      const referral: StoredReferral = {
        code: refCode.trim().toUpperCase(),
        capturedAt: Date.now(),
        source: window.location.pathname,
      };

      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referral));
      console.log(`Referral code captured: ${referral.code}`);

      // Clean up URL (remove ref param) without page reload
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);
}

/**
 * Get the stored referral code if it exists and hasn't expired.
 */
export function getReferralCode(): string | null {
  try {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!stored) return null;

    const referral: StoredReferral = JSON.parse(stored);

    // Check if expired (30 days)
    const expiryMs = REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - referral.capturedAt > expiryMs) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }

    return referral.code;
  } catch {
    return null;
  }
}

/**
 * Clear the stored referral code (call after successful attribution).
 */
export function clearReferralCode(): void {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}

/**
 * Hook to get referral code with memoization.
 */
export function useReferralCode() {
  const getCode = useCallback(() => getReferralCode(), []);
  const clearCode = useCallback(() => clearReferralCode(), []);

  return {
    getReferralCode: getCode,
    clearReferralCode: clearCode,
  };
}
