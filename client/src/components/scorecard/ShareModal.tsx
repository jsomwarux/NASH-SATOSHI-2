import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { X, Download, Share2, Copy, Check, Loader2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShareCard } from "./ShareCard";
import { useAuth } from "@/contexts/AuthContext";
import { createTwitterShare, verifyShare } from "@/lib/api";
import type { TokenAnalysis } from "@shared/schema";
import { formatScore } from "@/lib/utils";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: TokenAnalysis;
}

export function ShareModal({ isOpen, onClose, analysis }: ShareModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shareVerified, setShareVerified] = useState(false);
  const [isPriorityUnlocked, setIsPriorityUnlocked] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { user, getAccessToken } = useAuth();

  const finalScore = parseFloat(analysis.finalScore as string) || 0;
  const shareUrl = `${window.location.origin}/analyze/${analysis.id}`;

  // Upload image to server for Twitter card
  const uploadImage = useCallback(async (dataUrl: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(`/api/analyze/${analysis.id}/share-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });

      if (response.ok) {
        setImageUploaded(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error uploading share image:", error);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [analysis.id]);

  // Generate image from ShareCard
  const generateImage = useCallback(async () => {
    if (!shareCardRef.current) {
      console.error("ShareCard ref not available");
      return null;
    }

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: true,
        // Handle CORS for external images
        fetchRequestInit: {
          mode: 'cors',
          cache: 'no-cache',
        },
        // Filter out problematic elements or convert external images
        filter: (node: HTMLElement) => {
          // Skip any hidden elements
          if (node.style?.display === 'none') return false;
          return true;
        },
      });
      setImageUrl(dataUrl);

      // Upload to server for Twitter card
      await uploadImage(dataUrl);

      return dataUrl;
    } catch (error) {
      console.error("Error generating image:", error);
      // Try again without external images if CORS fails
      try {
        const dataUrl = await toPng(shareCardRef.current, {
          quality: 1,
          pixelRatio: 2,
          cacheBust: true,
          skipAutoScale: true,
          // Skip external images that might cause CORS issues
          filter: (node: HTMLElement) => {
            if (node.tagName === 'IMG') {
              const src = (node as HTMLImageElement).src;
              // Skip external images
              if (src && !src.startsWith(window.location.origin) && !src.startsWith('data:')) {
                return false;
              }
            }
            return true;
          },
        });
        setImageUrl(dataUrl);
        await uploadImage(dataUrl);
        return dataUrl;
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
        return null;
      }
    } finally {
      setIsGenerating(false);
    }
  }, [uploadImage]);

  // Download the image
  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      let url = imageUrl;
      if (!url) {
        url = await generateImage();
      }
      if (url) {
        const link = document.createElement("a");
        link.download = `${analysis.tokenSymbol}-scorecard.png`;
        link.href = url;
        // Append to body for Firefox compatibility
        document.body.appendChild(link);
        link.click();
        // Clean up
        document.body.removeChild(link);
      } else {
        console.error("Failed to generate image for download");
        alert("Failed to generate image. Please try again.");
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [imageUrl, generateImage, analysis.tokenSymbol]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  // Share to X (Twitter)
  const handleShareToX = useCallback(async () => {
    // Ensure image is uploaded before sharing
    if (!imageUploaded && imageUrl) {
      await uploadImage(imageUrl);
    } else if (!imageUrl) {
      const dataUrl = await generateImage();
      if (dataUrl) {
        await uploadImage(dataUrl);
      }
    }

    // Generate the share text - Nash Satoshi branding
    const tierEmoji = analysis.tier === "S+" ? "🏆" : analysis.tier === "S" ? "🔥" : analysis.tier === "A" ? "✨" : "📊";
    const recEmoji = analysis.recommendation?.toUpperCase().includes("BUY") ? "🟢" :
                     analysis.recommendation?.toUpperCase().includes("HOLD") ? "🟡" : "🔴";

    const shareText = `${tierEmoji} Nash Satoshi $${analysis.tokenSymbol} Game Theory Analysis

Score: ${formatScore(finalScore)}/100 (${analysis.tier} Tier)
Signal: ${recEmoji} ${analysis.recommendation || 'PENDING'}
Consensus: ${analysis.consensusLevel || 'MIXED'}

Analyzed by 4-LLM ensemble for unbiased scoring 🤖

${shareUrl}`;

    // Track the share for priority queue (if user is authenticated)
    if (user) {
      try {
        const token = await getAccessToken();
        if (token) {
          const shareResult = await createTwitterShare({
            text: shareText,
            url: shareUrl,
            tokenSymbol: analysis.tokenSymbol,
            analysisId: analysis.id,
          }, token);
          setPendingShareId(shareResult.shareId);
        }
      } catch (error) {
        console.error("Failed to track share:", error);
      }
    }

    // Open Twitter intent
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  }, [analysis, finalScore, shareUrl, imageUploaded, imageUrl, uploadImage, generateImage, user, getAccessToken]);

  // Verify share was posted
  const handleVerifyShare = useCallback(async () => {
    if (!pendingShareId) return;

    setIsVerifying(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await verifyShare(pendingShareId, token);
      setShareVerified(true);
      setPendingShareId(null);

      if (result.isPrioritySharer) {
        setIsPriorityUnlocked(true);
      }
    } catch (error) {
      console.error("Failed to verify share:", error);
    } finally {
      setIsVerifying(false);
    }
  }, [pendingShareId, getAccessToken]);

  // Generate image when modal opens
  useEffect(() => {
    if (isOpen && !imageUrl && !isGenerating) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        generateImage();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, imageUrl, isGenerating, generateImage]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-2xl w-full bg-card border border-primary/20 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Share Scorecard</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Preview Card */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-xl mb-6">
              {isGenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}
              <div className="overflow-auto max-h-[400px] flex justify-center bg-black/50">
                <ShareCard ref={shareCardRef} analysis={analysis} />
              </div>
            </div>

            {/* Share URL */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Shareable Link
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-secondary/50 rounded-lg border border-primary/10 font-mono text-sm truncate">
                  {shareUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Image Upload Status */}
            {imageUploaded && (
              <div className="mb-4 flex items-center gap-2 text-xs text-green-500">
                <Check className="w-3 h-3" />
                <span>Image ready for sharing - Twitter will show your scorecard</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isGenerating}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download Image
              </Button>
              <Button
                onClick={handleShareToX}
                disabled={isGenerating || isUploading}
                className="gap-2 bg-black hover:bg-black/80 text-white"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Share to X
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Footer - Share Verification */}
          <div className="px-6 py-4 bg-secondary/30 border-t border-primary/10">
            {isPriorityUnlocked ? (
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Priority Queue Unlocked! Your votes now count 2x</span>
              </div>
            ) : shareVerified ? (
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm">Share verified! Thanks for spreading the word</span>
              </div>
            ) : pendingShareId && user ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <span className="text-xs text-muted-foreground">Posted your tweet?</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyShare}
                  disabled={isVerifying}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Verify & Get Priority Status
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                {user
                  ? "Share to X to unlock Priority Queue status for your votes"
                  : "Share your analysis and help others make informed decisions"}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
