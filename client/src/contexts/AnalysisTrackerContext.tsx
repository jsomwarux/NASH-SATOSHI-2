import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { getAnalysisStatus, getAnalysis } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { TokenAnalysis } from "@shared/schema";

interface TrackedAnalysis {
  id: number;
  tokenSymbol: string;
  tokenName: string;
  startedAt: number;
}

interface AnalysisTrackerContextType {
  trackedAnalyses: TrackedAnalysis[];
  trackAnalysis: (analysis: { id: number; tokenSymbol: string; tokenName: string }) => void;
  untrackAnalysis: (id: number) => void;
  completedAnalyses: TokenAnalysis[];
  clearCompletedAnalysis: (id: number) => void;
}

const AnalysisTrackerContext = createContext<AnalysisTrackerContextType | null>(null);

const STORAGE_KEY = "nash-satoshi-tracked-analyses";

export function AnalysisTrackerProvider({ children }: { children: React.ReactNode }) {
  const [trackedAnalyses, setTrackedAnalyses] = useState<TrackedAnalysis[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out analyses older than 1 hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        return parsed.filter((a: TrackedAnalysis) => a.startedAt > oneHourAgo);
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [completedAnalyses, setCompletedAnalyses] = useState<TokenAnalysis[]>([]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Persist tracked analyses to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedAnalyses));
  }, [trackedAnalyses]);

  const trackAnalysis = useCallback((analysis: { id: number; tokenSymbol: string; tokenName: string }) => {
    setTrackedAnalyses((prev) => {
      // Don't add duplicates
      if (prev.some((a) => a.id === analysis.id)) return prev;
      return [...prev, { ...analysis, startedAt: Date.now() }];
    });
  }, []);

  const untrackAnalysis = useCallback((id: number) => {
    setTrackedAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearCompletedAnalysis = useCallback((id: number) => {
    setCompletedAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Poll for analysis status
  useEffect(() => {
    if (trackedAnalyses.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollStatuses = async () => {
      for (const tracked of trackedAnalyses) {
        try {
          const status = await getAnalysisStatus(tracked.id);

          if (status.status === "completed") {
            // Fetch the full analysis
            const fullAnalysis = await getAnalysis(tracked.id);
            setCompletedAnalyses((prev) => {
              if (prev.some((a) => a.id === tracked.id)) return prev;
              return [...prev, fullAnalysis];
            });

            // Show toast notification
            toast({
              title: `Analysis Complete: ${tracked.tokenSymbol}`,
              description: `${tracked.tokenName} analysis finished with score ${fullAnalysis.finalScore}/100`,
              action: (
                <button
                  onClick={() => navigate(`/analyze/${tracked.id}`)}
                  className="px-3 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors"
                >
                  VIEW
                </button>
              ),
            });

            // Remove from tracked
            untrackAnalysis(tracked.id);
          } else if (status.status === "failed") {
            toast({
              title: `Analysis Failed: ${tracked.tokenSymbol}`,
              description: "The analysis encountered an error. Please try again.",
              variant: "destructive",
            });
            untrackAnalysis(tracked.id);
          }
        } catch (error) {
          console.error(`Error polling analysis ${tracked.id}:`, error);
        }
      }
    };

    // Poll immediately
    pollStatuses();

    // Then poll every 10 seconds
    pollingRef.current = setInterval(pollStatuses, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [trackedAnalyses, toast, navigate, untrackAnalysis]);

  return (
    <AnalysisTrackerContext.Provider
      value={{
        trackedAnalyses,
        trackAnalysis,
        untrackAnalysis,
        completedAnalyses,
        clearCompletedAnalysis,
      }}
    >
      {children}
    </AnalysisTrackerContext.Provider>
  );
}

export function useAnalysisTracker() {
  const context = useContext(AnalysisTrackerContext);
  if (!context) {
    throw new Error("useAnalysisTracker must be used within AnalysisTrackerProvider");
  }
  return context;
}
