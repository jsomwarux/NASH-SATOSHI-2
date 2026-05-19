import { useCallback, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Clipboard, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AggregatedLeaderboardItem } from "@/types/leaderboard";
import { WeeklyReceiptCard, buildWeeklyReceiptRows, type WeeklyReceiptData } from "./WeeklyReceiptCard";

interface WeeklyReceiptGeneratorProps {
  items: AggregatedLeaderboardItem[];
}

function getWeekLabel(now = new Date()) {
  return now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGeneratedAtLabel(now = new Date()) {
  return now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function buildHeadline(rows: WeeklyReceiptData["rows"], sourceMode: WeeklyReceiptData["sourceMode"]) {
  const top = rows[0];
  if (!top) return "Current rankings snapshot for AI-agent-linked crypto narratives.";

  const movement = rows.find((row) => row.rankDelta.includes("score") && !row.rankDelta.startsWith("-"));
  const sourcePrefix = sourceMode === "live" ? "Live AI Agents category snapshot" : "Curated AI Agents fallback snapshot";

  if (movement) {
    return `${sourcePrefix}: $${top.tokenSymbol} leads; $${movement.tokenSymbol} shows the sharpest positive model-score move.`;
  }

  return `${sourcePrefix}: $${top.tokenSymbol} leads the receipt; model confidence lines show where the thesis is still early.`;
}

function buildReceipt(items: AggregatedLeaderboardItem[]): WeeklyReceiptData {
  const { rows, sourceMode } = buildWeeklyReceiptRows(items);
  return {
    weekLabel: getWeekLabel(),
    generatedAtLabel: getGeneratedAtLabel(),
    category: "AI Agents",
    rows,
    headline: buildHeadline(rows, sourceMode),
    sourceMode,
    sourceTags: ["nash_aiagents_receipt_x_20260519", "nash_weekly_receipt_ai_agents"],
  };
}

function buildCaption(receipt: WeeklyReceiptData) {
  const leader = receipt.rows[0];
  const movement = receipt.rows.find((row) => row.rankDelta.includes("score"));
  const movementLine = movement
    ? `$${movement.tokenSymbol}: ${movement.rankDelta}; ${movement.disagreement}`
    : leader
      ? `$${leader.tokenSymbol} leads the category receipt; ${leader.disagreement}`
      : "Current AI Agents ranking snapshot.";

  return `This week's Nash Satoshi AI Agents receipt:\n\n${movementLine}\n\nNot a price call. Just the ranking thesis and where the models split.\n\nSource tags: ${receipt.sourceTags.join(", ")}`;
}

export function WeeklyReceiptGenerator({ items }: WeeklyReceiptGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const receipt = useMemo(() => buildReceipt(items), [items]);
  const caption = useMemo(() => buildCaption(receipt), [receipt]);
  const canExport = receipt.rows.length >= 5;

  const generatePng = useCallback(async () => {
    if (!receiptRef.current) return null;

    setIsGenerating(true);
    let tempContainer: HTMLDivElement | null = null;

    try {
      tempContainer = document.createElement("div");
      tempContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 1200px;
        height: 1200px;
        z-index: -9999;
        opacity: 0;
        pointer-events: none;
        overflow: visible;
      `;

      const clone = receiptRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = "1200px";
      clone.style.height = "1200px";
      clone.style.transform = "none";
      tempContainer.appendChild(clone);
      document.body.appendChild(tempContainer);
      void tempContainer.offsetHeight;
      await new Promise((resolve) => setTimeout(resolve, 250));

      return await toPng(clone, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: true,
        width: 1200,
        height: 1200,
        style: {
          width: "1200px",
          height: "1200px",
          transform: "none",
        },
        filter: (node: HTMLElement) => {
          if (node.tagName === "IMG") {
            const src = (node as HTMLImageElement).src;
            if (src && !src.startsWith(window.location.origin) && !src.startsWith("data:")) {
              return false;
            }
          }
          return true;
        },
      });
    } finally {
      if (tempContainer) document.body.removeChild(tempContainer);
      setIsGenerating(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!canExport) return;

    try {
      const dataUrl = await generatePng();
      if (!dataUrl) throw new Error("Receipt card is not mounted");

      const link = document.createElement("a");
      link.download = `nash-weekly-ai-agents-receipt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Weekly receipt PNG generation failed:", error);
      toast({
        title: "PNG export failed",
        description: "The receipt rendered, but browser image capture failed. Try again after the page finishes loading.",
        variant: "destructive",
      });
    }
  }, [canExport, generatePng, toast]);

  const handleCopyCaption = useCallback(async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [caption]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-2xl border border-primary/20 bg-black/40 p-3 shadow-2xl shadow-primary/5">
        <div className="flex justify-center overflow-auto rounded-xl bg-black/60 p-4">
          <div className="origin-top scale-[0.28] sm:scale-[0.42] lg:scale-[0.58] xl:scale-[0.50] 2xl:scale-[0.62]" style={{ width: 1200, height: 1200 }}>
            <WeeklyReceiptCard ref={receiptRef} receipt={receipt} />
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="border-primary/20 bg-black/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-lg text-primary">
              <RefreshCw className="h-4 w-4" />
              EXPORT_CONTROLS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 font-mono text-xs text-cyan-100">
              <div className="font-bold uppercase tracking-wider">Data source</div>
              <div className="mt-1 text-cyan-100/80">
                {receipt.sourceMode === "live"
                  ? "Live leaderboard rows matched to AI-agent narratives."
                  : "Curated fallback from current leaderboard rows because fewer than 5 exact AI-agent matches were available."}
              </div>
            </div>

            {!canExport && (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Need at least 5 leaderboard rows before exporting a receipt.
              </div>
            )}

            <Button onClick={handleDownload} disabled={!canExport || isGenerating} className="w-full gap-2 font-mono">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              DOWNLOAD_PNG
            </Button>

            <Button variant="outline" onClick={handleCopyCaption} className="w-full gap-2 font-mono">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "COPIED" : "COPY_CAPTION"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-black/50">
          <CardHeader>
            <CardTitle className="font-mono text-lg text-primary">SAFE_CAPTION</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200">{caption}</pre>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-black/50">
          <CardHeader>
            <CardTitle className="font-mono text-lg text-primary">SOURCE_TAGS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-muted-foreground">
            {receipt.sourceTags.map((tag) => (
              <div key={tag} className="rounded border border-white/10 bg-white/5 px-3 py-2">{tag}</div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
