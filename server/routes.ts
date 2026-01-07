import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { analyzeTokenRequestSchema, type ModelScores, type SubscriptionTierId, SUBSCRIPTION_TIERS } from "@shared/schema";
import { parseGumloopResponse, isValidGumloopResponse } from "./gumloop-parser";
import { log } from "./index";
import { createClient } from "@supabase/supabase-js";
import {
  stripe,
  isStripeConfigured,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
  getSubscriptionTiers,
} from "./stripe";

// Supabase config for JWT verification (support multiple naming conventions)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_PROJECT_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// Debug: Log Supabase config status
console.log(`Supabase config: URL=${SUPABASE_URL ? 'SET' : 'MISSING'}, SERVICE_KEY=${SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING'}, ANON_KEY=${SUPABASE_ANON_KEY ? 'SET' : 'MISSING'}`);

// Create Supabase client for server-side auth verification
const supabase = SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)
  : null;

console.log(`Supabase client: ${supabase ? 'CREATED' : 'NOT CREATED'}`);


// Helper to extract and verify user from JWT token
async function getUserFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log("No auth header or invalid format", "api");
    return null;
  }

  if (!supabase) {
    log("Supabase client not configured for auth verification", "api");
    return null;
  }

  const token = authHeader.substring(7);
  log(`Auth token received (length: ${token.length})`, "api");

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      log(`Auth verification failed: ${error?.message || 'No user returned'}`, "api");
      return null;
    }
    log(`Auth verified for user: ${user.id}`, "api");
    return user.id;
  } catch (error) {
    log(`Auth verification exception: ${error}`, "api");
    return null;
  }
}

// CoinGecko API base URL
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Gumloop API configuration
const GUMLOOP_API_KEY = process.env.GUMLOOP_API_KEY;
const GUMLOOP_PIPELINE_ID = process.env.GUMLOOP_PIPELINE_ID || process.env.GUMLOOP_WEBHOOK_URL; // saved_item_id
const GUMLOOP_USER_ID = process.env.GUMLOOP_USER_ID || "";
const GUMLOOP_API_BASE = "https://api.gumloop.com/api/v1";

async function fetchCoinGecko(endpoint: string) {
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };

  // Add API key if available
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const response = await fetch(`${COINGECKO_API}${endpoint}`, { headers });

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Start a Gumloop workflow run
async function startGumloopRun(tokenData: {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  chain?: string;
  marketCap?: string;
  price?: string;
  volume?: string;
  categories?: string[];
}): Promise<string | null> {
  if (!GUMLOOP_API_KEY || !GUMLOOP_PIPELINE_ID || !GUMLOOP_USER_ID) {
    log(`Gumloop API credentials not configured - API_KEY: ${!!GUMLOOP_API_KEY}, PIPELINE_ID: ${!!GUMLOOP_PIPELINE_ID}, USER_ID: ${!!GUMLOOP_USER_ID}`, "api");
    return null;
  }

  try {
    // Build the input data for Gumloop - send as the request body directly
    // The pipeline should have input nodes that match these field names
    const inputData = {
      ticker: tokenData.tokenSymbol.toUpperCase(),
      token_name: tokenData.tokenName,
      chain: tokenData.chain || "Unknown",
      market_cap: tokenData.marketCap || "Unknown",
      price: tokenData.price || "Unknown",
      volume_24h: tokenData.volume || "Unknown",
      categories: tokenData.categories?.join(", ") || "Unknown",
    };

    // Construct the API URL with query parameters
    const apiUrl = `${GUMLOOP_API_BASE}/start_pipeline?user_id=${encodeURIComponent(GUMLOOP_USER_ID)}&saved_item_id=${encodeURIComponent(GUMLOOP_PIPELINE_ID)}`;

    log(`Starting Gumloop pipeline for ${tokenData.tokenSymbol}: ${apiUrl}`, "api");
    log(`Gumloop input data: ${JSON.stringify(inputData)}`, "api");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GUMLOOP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inputData),
    });

    const responseText = await response.text();
    log(`Gumloop response (${response.status}): ${responseText}`, "api");

    if (!response.ok) {
      log(`Gumloop start error: ${response.status} ${response.statusText} - ${responseText}`, "api");
      return null;
    }

    const data = JSON.parse(responseText);
    log(`Gumloop run started with run_id: ${data.run_id}`, "api");
    return data.run_id || null;
  } catch (error) {
    log(`Gumloop start exception: ${error}`, "api");
    return null;
  }
}

// Poll Gumloop for run status
// Gumloop states: RUNNING, DONE, QUEUED, TERMINATING, TERMINATED, FAILED
async function pollGumloopRun(runId: string): Promise<{
  status: 'running' | 'completed' | 'failed';
  output?: string;
  nodesCompleted?: number;
  totalNodes?: number;
  currentNode?: string;
}> {
  if (!GUMLOOP_API_KEY) {
    return { status: 'failed' };
  }

  try {
    const pollUrl = `${GUMLOOP_API_BASE}/get_pl_run?run_id=${encodeURIComponent(runId)}&user_id=${encodeURIComponent(GUMLOOP_USER_ID)}`;

    const response = await fetch(pollUrl, {
      headers: {
        "Authorization": `Bearer ${GUMLOOP_API_KEY}`,
      },
    });

    if (!response.ok) {
      log(`Gumloop poll error: ${response.status} ${response.statusText}`, "api");
      return { status: 'failed' };
    }

    const data = await response.json();
    const state = data.state?.toUpperCase() || 'UNKNOWN';

    // Log full response to understand what progress info is available
    const progressInfo = {
      state,
      nodesCompleted: data.nodes_completed || data.completed_nodes || Object.keys(data.outputs || {}).length,
      totalNodes: data.total_nodes || data.node_count,
      currentNode: data.current_node || data.executing_node,
      outputKeys: Object.keys(data.outputs || {}),
    };
    log(`Gumloop poll: ${JSON.stringify(progressInfo)}`, "api");

    if (state === "DONE") {
      // Get the output from the final node
      const outputs = data.outputs || {};
      log(`Gumloop outputs keys: ${Object.keys(outputs).join(", ")}`, "api");

      let outputText: string | undefined;

      // First, look for the specific "analysis_result" output node
      if (outputs.analysis_result && typeof outputs.analysis_result === 'string') {
        outputText = outputs.analysis_result;
        log(`Found analysis_result output with length ${outputs.analysis_result.length}`, "api");
      } else {
        // Fallback: find the longest string output
        for (const [key, value] of Object.entries(outputs)) {
          if (typeof value === 'string' && value.length > 100) {
            log(`Found output in key "${key}" with length ${value.length}`, "api");
            if (!outputText || value.length > outputText.length) {
              outputText = value;
            }
          }
        }
      }

      if (!outputText) {
        log(`No suitable output found, raw outputs: ${JSON.stringify(outputs).slice(0, 500)}`, "api");
        // Try to extract any output if available
        const allOutputs = Object.values(outputs).filter(v => typeof v === 'string' && v.length > 0);
        if (allOutputs.length > 0) {
          outputText = allOutputs.join('\n');
        } else {
          outputText = JSON.stringify(outputs);
        }
      }

      return {
        status: 'completed',
        output: outputText,
      };
    } else if (state === "FAILED" || state === "TERMINATED" || state === "TERMINATING") {
      log(`Gumloop run ended with state ${state}: ${JSON.stringify(data)}`, "api");
      return { status: 'failed' };
    } else if (state === "RUNNING" || state === "QUEUED") {
      // Return progress info for running state
      const outputKeys = Object.keys(data.outputs || {});
      return {
        status: 'running',
        nodesCompleted: outputKeys.length,
        totalNodes: data.total_nodes || data.node_count,
        currentNode: data.current_node || data.executing_node || (outputKeys.length > 0 ? `Node ${outputKeys.length + 1}` : undefined),
      };
    } else {
      // Unknown state - log and treat as running
      log(`Gumloop unknown state: ${state}`, "api");
      return { status: 'running' };
    }
  } catch (error) {
    log(`Gumloop poll exception: ${error}`, "api");
    return { status: 'failed' };
  }
}

// Simulate Gumloop analysis (fallback when API not configured)
async function simulateAnalysis(tokenId: string, tokenName: string, tokenSymbol: string): Promise<{
  rawResponse: string;
  parsedData: ReturnType<typeof parseGumloopResponse>;
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate realistic simulated scores
  const baseScore = 50 + Math.random() * 40;
  const gptScore = Math.round(baseScore + (Math.random() * 10 - 5));
  const claudeScore = Math.round(baseScore + (Math.random() * 10 - 5));
  const geminiScore = Math.round(baseScore + (Math.random() * 10 - 5));
  const grokScore = Math.round(baseScore + (Math.random() * 10 - 5));
  const finalScore = (gptScore + claudeScore + geminiScore + grokScore) / 4;

  let tier: string;
  if (finalScore >= 85) tier = 'S+';
  else if (finalScore >= 70) tier = 'S';
  else if (finalScore >= 55) tier = 'A';
  else if (finalScore >= 40) tier = 'B';
  else tier = 'DISQUALIFIED';

  const phases = ['Stealth', 'Expansion', 'Mania', 'Distribution', 'Dead'];
  const phase = Math.floor(Math.random() * 3) + 1; // 1-3 for simulation
  const phaseName = phases[phase - 1];

  const narratives = [
    'AI Infrastructure',
    'DeFi 2.0',
    'Gaming/Metaverse',
    'Privacy Tech',
    'Layer 2 Scaling',
    'Real World Assets',
    'Meme Culture',
  ];
  const narrative = narratives[Math.floor(Math.random() * narratives.length)];

  const winningSides = ['USER', 'AT_RISK', 'EXIT_LIQ'];
  const winningSide = winningSides[Math.floor(Math.random() * 2)]; // Favor USER and AT_RISK

  let recommendation: string;
  if (finalScore >= 65) recommendation = 'BUY';
  else if (finalScore >= 45) recommendation = 'HOLD';
  else recommendation = 'AVOID';

  const rawResponse = `
# ${tokenSymbol.toUpperCase()} Consensus Aggregation

## 1. EXTRACT DELIBERATED SCORES

| Model | Deliberated Score |
|-------|-------------------|
| ChatGPT | ${gptScore.toFixed(2)} |
| Claude | ${claudeScore.toFixed(2)} |
| Gemini | ${geminiScore.toFixed(2)} |
| Grok | ${grokScore.toFixed(2)} |

## 5. PHASE CONSENSUS

| Model | Phase Assessment |
|-------|------------------|
| ChatGPT | Phase ${phase} (${phaseName}) |
| Claude | Phase ${phase} (${phaseName}) |
| Gemini | Phase ${phase} (${phaseName}) |
| Grok | Phase ${phase} (${phaseName}) |

- **Final Phase:** ${phase}
- **Phase Name:** ${phaseName}
- **Agreement:** 4/4 models agree ✓

## 6. EXIT LIQUIDITY CONSENSUS

- **Final Assessment:** ${winningSide}
- **Agreement:** 3/4 models agree

## 7. TIER CONSENSUS

- **Modal Tier:** ${tier} (unanimous)

## 12. FINAL CONSENSUS SCORE

| Component | Value |
|-----------|-------|
| Base (Mean of Deliberated) | ${finalScore.toFixed(2)} |
| Penalties | 0 |
| **FINAL SCORE** | **${finalScore.toFixed(2)}/100** |

## 13. FINAL TIER

**FINAL TIER: ${tier}**

## 14. CONFIDENCE ASSESSMENT

- Consensus Level: MIXED
- Convergence: Strong
- Phase Agreement: Unanimous

**CONFIDENCE: M (Medium)**

## 15. FINAL VERDICT

${tokenName} (${tokenSymbol.toUpperCase()}) scores ${finalScore.toFixed(2)}/100 as a ${phaseName.toLowerCase()}-phase ${narrative.toLowerCase()} play. ${
    finalScore >= 65
      ? `The token shows strong coordination signals with favorable risk/reward dynamics.`
      : finalScore >= 45
      ? `The token presents mixed signals requiring careful position sizing and risk management.`
      : `The token shows concerning metrics and elevated risk factors.`
  }

---

# OUTPUT SUMMARY

| Metric | Value |
|--------|-------|
| **FINAL SCORE** | **${finalScore.toFixed(2)}/100** |
| **FINAL TIER** | **${tier}** |
| **CONSENSUS** | **MIXED** |
| **PHASE** | **${phase} (${phaseName})** |
| **EXIT LIQUIDITY** | **${winningSide}** |
| **CONFIDENCE** | **M** |
| **RECOMMENDATION** | **${recommendation}** |

## REASONING

${tokenName} demonstrates ${finalScore >= 60 ? 'solid' : 'moderate'} game-theoretic properties with ${
    phase <= 2 ? 'early-stage growth potential' : 'mature market positioning'
  }. The ${narrative.toLowerCase()} narrative provides ${
    Math.random() > 0.5 ? 'strong' : 'adequate'
  } thematic backing for coordination.

## TOP RISKS

1. **Market Volatility** - Macro conditions may impact price action
2. **Narrative Rotation** - Capital may flow to competing narratives
3. **Execution Risk** - Team must deliver on roadmap milestones

## KEY AGREEMENTS

- ${phaseName} phase with ${phase <= 2 ? 'accumulation' : 'distribution'} dynamics
- ${narrative} narrative provides thematic coordination
- ${finalScore >= 55 ? 'Favorable' : 'Cautious'} risk/reward profile
  `.trim();

  return {
    rawResponse,
    parsedData: {
      finalScore,
      tier,
      phase,
      phaseName,
      narrative,
      narrativeHeat: 5 + Math.random() * 4,
      winningSide,
      consensusLevel: 'MIXED',
      confidence: 'M',
      recommendation,
      displaySummary: `${tokenName} scores ${finalScore.toFixed(1)}/100 as a ${tier}-tier ${narrative.toLowerCase()} play in ${phaseName} phase.`,
      reasoning: `${tokenName} demonstrates ${finalScore >= 60 ? 'solid' : 'moderate'} game-theoretic properties.`,
      coordinationRisks: ['Market Volatility', 'Narrative Rotation', 'Execution Risk'],
      catalysts: [`${phaseName} phase dynamics`, `${narrative} narrative`, 'Risk/reward profile'],
      modelScores: {
        gpt: gptScore,
        claude: claudeScore,
        gemini: geminiScore,
        grok: grokScore,
      },
    },
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Status endpoint
  app.get(api.status.path, (_req, res) => {
    res.json({ status: "ok" });
  });

  // Token Search (CoinGecko)
  app.get(api.tokenSearch.path, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 1) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const data = await fetchCoinGecko(`/search?query=${encodeURIComponent(query)}`);
      res.json({ coins: data.coins || [] });
    } catch (error) {
      log(`Token search error: ${error}`, "api");
      res.status(500).json({ message: "Failed to search tokens" });
    }
  });

  // Token Details (CoinGecko)
  app.get(api.tokenDetails.path, async (req, res) => {
    try {
      const { id } = req.params;
      const data = await fetchCoinGecko(`/coins/${id}?localization=false&tickers=false&community_data=true&developer_data=false`);
      res.json(data);
    } catch (error) {
      log(`Token details error: ${error}`, "api");
      res.status(404).json({ message: "Token not found" });
    }
  });

  // Start Token Analysis
  app.post(api.analyzeToken.path, async (req, res) => {
    try {
      const parseResult = analyzeTokenRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const { tokenId, tokenSymbol, tokenName, tokenImage, chain, contractAddress } = parseResult.data;

      // Authentication is REQUIRED for analysis - this is our metering boundary
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          message: "Sign up to analyze tokens. Your free trial starts when you run your first analysis.",
          code: 'AUTH_REQUIRED',
        });
      }

      log(`Analysis requested by user: ${userId}`, "api");

      // Check usage limits before starting analysis
      const usageInfo = await storage.getUserUsageInfo(userId);
      if (!usageInfo.canAnalyze) {
        const limitType = usageInfo.isInTrial
          ? 'daily'
          : usageInfo.tier === 'free'
            ? 'weekly'
            : 'monthly';
        return res.status(403).json({
          message: `You've reached your ${limitType} analysis limit. ${usageInfo.tier === 'free' ? 'Upgrade for more analyses.' : 'Purchase credits or wait for your limit to reset.'}`,
          code: 'LIMIT_REACHED',
          limitType,
          tier: usageInfo.tier,
          isInTrial: usageInfo.isInTrial,
          trialDaysRemaining: usageInfo.trialDaysRemaining,
          dailyUsed: usageInfo.dailyUsed,
          dailyLimit: usageInfo.dailyLimit,
          weeklyUsed: usageInfo.weeklyUsed,
          weeklyLimit: usageInfo.weeklyLimit,
          monthlyUsed: usageInfo.monthlyUsed,
          monthlyLimit: usageInfo.monthlyLimit,
          creditBalance: usageInfo.creditBalance,
        });
      }

      // Check if we already have a recent completed analysis for this token
      const existingAnalysis = await storage.getAnalysisByTokenId(tokenId);
      if (existingAnalysis) {
        return res.json({
          analysisId: existingAnalysis.id,
          status: existingAnalysis.status as 'pending' | 'processing' | 'completed' | 'failed',
        });
      }

      // Fetch current market data
      let marketData = {
        currentPrice: null as string | null,
        marketCap: null as string | null,
        fdv: null as string | null,
        volume24h: null as string | null,
        priceChange24h: null as string | null,
        priceChange7d: null as string | null,
        categories: [] as string[],
        detectedChain: chain || null,
      };

      try {
        const tokenData = await fetchCoinGecko(`/coins/${tokenId}?localization=false&tickers=false`);
        if (tokenData.market_data) {
          marketData = {
            currentPrice: tokenData.market_data.current_price?.usd?.toString() || null,
            marketCap: tokenData.market_data.market_cap?.usd?.toString() || null,
            fdv: tokenData.market_data.fully_diluted_valuation?.usd?.toString() || null,
            volume24h: tokenData.market_data.total_volume?.usd?.toString() || null,
            priceChange24h: tokenData.market_data.price_change_percentage_24h?.toString() || null,
            priceChange7d: tokenData.market_data.price_change_percentage_7d?.toString() || null,
            categories: tokenData.categories || [],
            detectedChain: tokenData.asset_platform_id || chain || null,
          };
        }
      } catch (e) {
        log(`Could not fetch market data for ${tokenId}`, "api");
      }

      // Create initial analysis record with pending status
      const analysis = await storage.createAnalysis({
        tokenId,
        tokenSymbol,
        tokenName,
        tokenImage: tokenImage || null,
        chain: marketData.detectedChain,
        contractAddress: contractAddress || null,
        finalScore: "0",
        tier: "B",
        status: "pending",
        userId: userId, // Associate with user if authenticated
        currentPrice: marketData.currentPrice,
        marketCap: marketData.marketCap,
        fdv: marketData.fdv,
        volume24h: marketData.volume24h,
        priceChange24h: marketData.priceChange24h,
        priceChange7d: marketData.priceChange7d,
        categories: marketData.categories,
      });

      // Increment usage counters after analysis is created
      // This also starts the free trial on first analysis
      await storage.incrementUsage(userId);

      // Start Gumloop analysis in background
      (async () => {
        try {
          // Update status to processing
          await storage.updateAnalysis(analysis.id, { status: "processing" });

          let rawResponse: string = "";
          let parsedData: ReturnType<typeof parseGumloopResponse> | null = null;

          // Try Gumloop first, fall back to simulation
          const runId = await startGumloopRun({
            tokenId,
            tokenName,
            tokenSymbol,
            chain: marketData.detectedChain || undefined,
            marketCap: marketData.marketCap || undefined,
            price: marketData.currentPrice || undefined,
            volume: marketData.volume24h || undefined,
            categories: marketData.categories,
          });

          if (runId) {
            // Store run ID
            await storage.updateAnalysis(analysis.id, { gumloopRunId: runId });

            // Poll for completion (max 40 minutes - complex multi-LLM workflows can take 20-30 min)
            const maxAttempts = 240;
            const pollInterval = 10000; // 10 seconds

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));

              const result = await pollGumloopRun(runId);

              if (result.status === 'completed' && result.output) {
                rawResponse = result.output;
                parsedData = parseGumloopResponse(rawResponse);
                break;
              } else if (result.status === 'failed') {
                throw new Error('Gumloop run failed');
              }
            }

            if (!rawResponse || !parsedData) {
              throw new Error('Gumloop run timed out');
            }
          } else {
            // Fall back to simulation
            log(`Using simulated analysis for ${tokenSymbol}`, "api");
            const simResult = await simulateAnalysis(tokenId, tokenName, tokenSymbol);
            rawResponse = simResult.rawResponse;
            parsedData = simResult.parsedData;
          }

          // Update analysis with results - include ALL parsed fields
          await storage.updateAnalysis(analysis.id, {
            status: "completed",
            rawGumloopResponse: rawResponse,
            finalScore: parsedData.finalScore.toString(),
            tier: parsedData.tier,
            phase: parsedData.phase,
            phaseName: parsedData.phaseName,
            narrative: parsedData.narrative,
            narrativeHeat: parsedData.narrativeHeat?.toString(),
            narrativeAcceleration: parsedData.narrativeAcceleration,
            peakProximity: parsedData.peakProximity?.toString(),
            winningSide: parsedData.winningSide,
            consensusLevel: parsedData.consensusLevel,
            confidence: parsedData.confidence,
            recommendation: parsedData.recommendation,
            displaySummary: parsedData.displaySummary,
            verdict: parsedData.verdict,
            reasoning: parsedData.reasoning,
            // Component scores
            coordinationScore: parsedData.coordinationScore?.toString(),
            schellingRankScore: parsedData.schellingRankScore?.toString(),
            schellingPosition: parsedData.schellingPosition,
            reflexivityScore: parsedData.reflexivityScore?.toString(),
            viralityScore: parsedData.viralityScore?.toString(),
            asymmetryScore: parsedData.asymmetryScore?.toString(),
            asymmetryFloor: parsedData.asymmetryFloor,
            asymmetryCeiling: parsedData.asymmetryCeiling,
            gameTheoryBonus: parsedData.gameTheoryBonus?.toString(),
            // Modifiers
            phaseModifier: parsedData.phaseModifier?.toString(),
            narrativeModifier: parsedData.narrativeModifier?.toString(),
            exitLiquidityModifier: parsedData.exitLiquidityModifier?.toString(),
            peakProximityModifier: parsedData.peakProximityModifier?.toString(),
            dataQualityModifier: parsedData.dataQualityModifier?.toString(),
            // Game theory details
            equilibriumType: parsedData.equilibriumType,
            equilibriumEvolution: parsedData.equilibriumEvolution,
            playerMap: parsedData.playerMap,
            dominantStrategies: parsedData.dominantStrategies,
            coordinationRisks: parsedData.coordinationRisks,
            catalysts: parsedData.catalysts,
            modelScores: parsedData.modelScores,
          });

        } catch (error) {
          log(`Analysis failed for ${tokenId}: ${error}`, "api");
          await storage.updateAnalysis(analysis.id, { status: "failed" });
        }
      })();

      res.json({
        analysisId: analysis.id,
        status: 'pending' as const,
      });
    } catch (error) {
      log(`Analysis error: ${error}`, "api");
      res.status(500).json({ message: "Failed to start analysis" });
    }
  });

  // Get Analysis Status (for polling)
  app.get("/api/analyze/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      // Calculate elapsed time
      const startTime = new Date(analysis.createdAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // If we have a Gumloop run, try to get progress info
      let progressInfo: { nodesCompleted?: number; currentNode?: string } = {};
      if (analysis.gumloopRunId && analysis.status === 'processing') {
        const pollResult = await pollGumloopRun(analysis.gumloopRunId);
        if (pollResult.status === 'running') {
          progressInfo = {
            nodesCompleted: pollResult.nodesCompleted,
            currentNode: pollResult.currentNode,
          };
        }
      }

      res.json({
        analysisId: analysis.id,
        status: analysis.status,
        startTime: analysis.createdAt,
        elapsedSeconds,
        nodesCompleted: progressInfo.nodesCompleted,
        currentNode: progressInfo.currentNode,
        message: analysis.status === 'processing' ? 'Analysis in progress...' : undefined,
      });
    } catch (error) {
      log(`Get status error: ${error}`, "api");
      res.status(500).json({ message: "Failed to get status" });
    }
  });

  // Get Analysis by ID
  app.get(api.getAnalysis.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      log(`Get analysis error: ${error}`, "api");
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  // Get Analysis by Token ID
  app.get(api.getAnalysisByToken.path, async (req, res) => {
    try {
      const { tokenId } = req.params;
      const analysis = await storage.getAnalysisByTokenId(tokenId);

      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found for this token" });
      }

      res.json(analysis);
    } catch (error) {
      log(`Get analysis by token error: ${error}`, "api");
      res.status(500).json({ message: "Failed to get analysis" });
    }
  });

  // Get all analyses (legacy - returns all for admin/debug)
  app.get("/api/analyses", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
      const offset = parseInt(req.query.offset as string || '0', 10);

      const result = await storage.getAllAnalyses({ limit, offset });
      res.json(result);
    } catch (error) {
      log(`Get all analyses error: ${error}`, "api");
      res.status(500).json({ message: "Failed to get analyses" });
    }
  });

  // Get user's analyses (requires auth)
  app.get("/api/user/analyses", async (req, res) => {
    try {
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
      const offset = parseInt(req.query.offset as string || '0', 10);

      const result = await storage.getUserAnalyses(userId, { limit, offset });
      res.json(result);
    } catch (error) {
      console.error(`Get user analyses error:`, error);
      res.status(500).json({ message: "Failed to get user analyses" });
    }
  });

  // Leaderboard with filters - returns aggregated data (one entry per token with average score)
  app.get(api.leaderboard.path, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
      const offset = parseInt(req.query.offset as string || '0', 10);
      // Map old sortBy values to new 7D/30D ones
      const sortByParam = req.query.sortBy as string || 'score7d';
      const sortBy = sortByParam === 'finalScore' || sortByParam === 'averageScore' ? 'score7d'
        : sortByParam === 'createdAt' ? 'latestAnalysis'
        : sortByParam === 'analysisCount' ? 'runs7d'
        : sortByParam as 'score7d' | 'score30d' | 'runs7d' | 'latestAnalysis';
      const order = (req.query.order as string || 'desc') as 'asc' | 'desc';

      // Extract filters
      const filters = {
        tier: req.query.tier as string | undefined,
        narrative: req.query.narrative as string | undefined,
        chain: req.query.chain as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await storage.getAggregatedLeaderboard({ limit, offset, sortBy, order, filters });
      res.json(result);
    } catch (error) {
      console.error(`Leaderboard error:`, error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  // Get filter options
  app.get("/api/filters", async (_req, res) => {
    try {
      const [tiers, narratives, chains] = await Promise.all([
        storage.getDistinctTiers(),
        storage.getDistinctNarratives(),
        storage.getDistinctChains(),
      ]);

      res.json({ tiers, narratives, chains });
    } catch (error) {
      console.error(`Filters error:`, error);
      res.status(500).json({ message: "Failed to get filters" });
    }
  });

  // ==================== SUBSCRIPTION & BILLING ROUTES ====================

  // Get subscription tiers (public)
  app.get("/api/subscription/tiers", (_req, res) => {
    res.json({ tiers: getSubscriptionTiers(), stripeConfigured: isStripeConfigured() });
  });

  // Get user's current subscription and usage info
  app.get("/api/subscription/status", async (req, res) => {
    try {
      const userId = await getUserFromRequest(req);
      log(`Subscription status check - userId: ${userId || 'null'}`, "api");

      if (!userId) {
        // Return free tier info for unauthenticated users (trial mode)
        const freeTier = SUBSCRIPTION_TIERS.free;
        return res.json({
          tier: 'free',
          tierName: freeTier.name,
          isSubscribed: false,
          isInTrial: true,
          trialDaysRemaining: freeTier.trialDays,
          dailyLimit: freeTier.trialAnalysesPerDay,
          dailyUsed: 0,
          dailyRemaining: freeTier.trialAnalysesPerDay,
          weeklyLimit: null,
          weeklyUsed: 0,
          weeklyRemaining: null,
          monthlyLimit: null,
          monthlyUsed: 0,
          monthlyRemaining: null,
          creditBalance: 0,
          canAnalyze: true,
          leaderboardLimit: freeTier.leaderboardLimit,
          subscription: null,
        });
      }

      log(`Getting usage info for user: ${userId}`, "api");
      const usageInfo = await storage.getUserUsageInfo(userId);
      log(`Got usage info, getting subscription for user: ${userId}`, "api");
      const subscription = await storage.getUserSubscription(userId);
      log(`Got subscription info for user: ${userId}`, "api");

      res.json({
        ...usageInfo,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        } : null,
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get subscription status";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Create checkout session for subscription
  app.post("/api/subscription/checkout", async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing not configured" });
      }

      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get user email from Supabase
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);
      let email = '';

      if (supabase && token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        email = user?.email || '';
      }

      if (!email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const { tier } = req.body as { tier: SubscriptionTierId };
      if (!tier || !['starter', 'trader', 'pro', 'desk'].includes(tier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/pricing`;

      const checkoutUrl = await createCheckoutSession(userId, email, tier, successUrl, cancelUrl);

      res.json({ url: checkoutUrl });
    } catch (error) {
      console.error("Checkout session error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Create billing portal session
  app.post("/api/subscription/portal", async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Payment processing not configured" });
      }

      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/settings`;

      const portalUrl = await createBillingPortalSession(userId, returnUrl);

      res.json({ url: portalUrl });
    } catch (error) {
      console.error("Billing portal error:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  // Stripe webhook handler
  // Uses rawBody captured by express.json verify option in index.ts
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({ message: "Missing stripe-signature header" });
      }

      // Use the raw body captured by the verify middleware
      const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
      if (!rawBody) {
        return res.status(400).json({ message: "Missing raw body" });
      }

      const result = await handleWebhookEvent(rawBody, signature);

      if (!result.received) {
        return res.status(400).json({ message: "Webhook processing failed" });
      }

      res.json({ received: true, type: result.type });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  return httpServer;
}
