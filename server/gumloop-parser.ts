import type { ModelScores, ModelAnalyses } from "@shared/schema";

export interface ParsedGumloopResponse {
  // Primary results
  finalScore: number;
  tier: string;
  tokenType?: string; // UTILITY or MEMECOIN
  phase: number;
  phaseName: string;

  // Narrative
  narrative?: string;
  narrativeHeat?: number;
  narrativeRank?: string; // 1st/2nd/3rd/lower
  narrativeAcceleration?: string;

  // Sub-narrative classification (hierarchical narrative support)
  primaryNarrative?: string;       // Broad category (e.g., "AI Agents")
  subNarrative?: string;           // Specific classification (e.g., "Agent Payments / x402")
  subNarrativeCeiling?: string;    // Peak FDV for sub-narrative leader (e.g., "$500M")
  subNarrativeConsensus?: string;  // Notes on model agreement

  // Project context (NEW)
  thesis?: string;
  catalyst1?: string;
  catalyst2?: string;
  catalyst3?: string;
  risk1?: string;
  risk2?: string;
  risk3?: string;

  // Social signals (NEW)
  xMentionsTrend?: string; // ↑/↓/→ (deprecated, often N/A)
  xSentiment?: string; // positive/mixed/negative (deprecated, often N/A)
  xTopKols?: string; // Notable KOLs
  communityStatus?: string; // Very Active/Active/Moderate/Low/Dead
  accountQuality?: string; // Builders/Researchers, Traders/Degens, Mixed Quality, Promoters/Shills

  // X Research qualitative fields (NEW - replacing numeric versions)
  engagementQuality?: string; // "High", "Moderate", "Low", "Bot-Heavy"
  overallSentiment?: string; // "Strongly Bullish", "Bullish", "Mixed", "Bearish", "Strongly Bearish"
  cultVsMercenary?: string; // "Cult-Heavy", "Mercenary-Heavy", "Balanced Mix", "Unable to Assess"

  // X Research flexible format fields (can be numeric OR qualitative)
  sentimentBullishRatio?: string; // "72%" or "High (~70%+)"
  sentimentBearishRatio?: string; // "8%" or "Low (<10%)"
  sentimentNeutralRatio?: string; // "20%" or "Moderate (~40-70%)"
  likesPerPostAvg?: string; // "150" or "High (hundreds+)"
  retweetsPerPostAvg?: string; // "45" or "Moderate (tens)"
  repliesPerPostAvg?: string; // "12" or "Low (minimal)"
  cultMercenaryRatio?: string; // "80% cult / 20% mercenary" or "Cult-Heavy"
  sentimentSampleSize?: string; // "25" or "~20 posts observed"

  // Team/Project info (NEW)
  unlockWarning?: string;
  teamStatus?: string;
  notableBackers?: string;

  // Key metrics
  peakProximity?: number;
  winningSide: string; // USER, AT_RISK, EXIT_LIQ
  consensusLevel: string; // HIGH, MIXED, LOW, CONFLICTED
  confidence: string; // H, M, L

  // Component scores
  coordinationScore?: number;
  schellingRankScore?: number;
  schellingPosition?: string;
  reflexivityScore?: number;
  viralityScore?: number;
  asymmetryScore?: number;
  asymmetryFloor?: string;
  asymmetryCeiling?: string;
  gameTheoryBonus?: number;
  baseScore?: number;

  // Modifiers
  phaseModifier?: number;
  narrativeModifier?: number;
  exitLiquidityModifier?: number;
  peakProximityModifier?: number;
  dataQualityModifier?: number;
  fdvModifier?: number; // -15 to +5, large FDV penalized (replaces marketCapModifier)
  marketCapModifier?: number; // deprecated, use fdvModifier
  totalModifiers?: number;
  penalties?: number;

  // Market cap scaling
  marketCapTier?: string; // mega, large, mid, small
  scoreCapped?: boolean;
  uncappedScore?: number;

  // Upside Assessment (from Stage 4)
  currentFdv?: string; // e.g., "$5M", "$44.33M"
  realisticPeakFdv?: string; // e.g., "$500M"
  upsideMultiple?: string; // e.g., "10x", "50x", "100x"
  upsideTier?: string; // "<5x", "5-10x", "10-25x", "25-50x", "50-100x", "100x+"

  // Market data from Gumloop (fallback when CoinGecko unavailable)
  gumloopTicker?: string; // Token ticker/symbol from Gumloop
  gumloopPrice?: string; // Current price from Gumloop (e.g., "$0.0001234")
  gumloopMarketCap?: string; // Market cap from Gumloop (e.g., "$5M", "$50,000,000")
  gumloopFdv?: string; // FDV from Gumloop (e.g., "$10M", "$100,000,000")

  // New Stage 4 fields
  narrativeDurability?: string; // "High", "Medium", "Low" - from NARRATIVE section
  kolMentionRecency?: string; // "Last 7 days", "Last 30 days", "1-3 months ago", "Older than 3 months"
  distributionWarning?: string; // "DISTRIBUTION SIGNAL DETECTED" or null - from X Research divergence check
  scoreCalculation?: string; // LLM arithmetic work showing final score average calculation (for verification)

  // Game theory
  equilibriumType?: string;
  equilibriumEvolution?: string;
  playerMap?: string;
  dominantStrategies?: string;
  coordinationRisks?: string[];
  catalysts?: string[];

  // Recommendations
  recommendation: string;
  displaySummary?: string;
  verdict?: string;
  reasoning?: string;

  // Model scores
  modelScores: ModelScores;
  modelAnalyses: ModelAnalyses;
  modelAgreement?: string;

  // Model divergence metrics (NEW)
  scoreSpread?: number; // Difference between highest and lowest model scores
  divergenceFlag?: string; // "HIGH" (>15 pts), "MODERATE" (10-15 pts), "LOW" (<10 pts)
  divergenceNote?: string; // Explanation when divergence is HIGH
}

// Clean text - remove markdown formatting
function cleanText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[:\s]+/, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean upside multiple - extract just the "Xx" value from calculation text
// Handles cases like "150000000 ÷ 574800 = 260.96x" -> "260.96x"
// Also handles "10x", "50x", "100x+" already clean values
function cleanUpsideMultiple(text: string): string {
  if (!text) return "";
  // If it already looks clean (just a number followed by x), return as-is
  if (/^\d+(\.\d+)?x\+?$/i.test(text.trim())) {
    return text.trim();
  }
  // Look for the "= Xx" pattern (result of calculation)
  const calcResultMatch = text.match(/=\s*(\d+(?:\.\d+)?)\s*x/i);
  if (calcResultMatch) {
    return calcResultMatch[1] + 'x';
  }
  // Look for any "Xx" pattern in the text (last one is likely the result)
  const allMultiples = text.match(/(\d+(?:\.\d+)?)\s*x/gi);
  if (allMultiples && allMultiples.length > 0) {
    // Use the last match (most likely the calculated result)
    const lastMatch = allMultiples[allMultiples.length - 1];
    const numMatch = lastMatch.match(/(\d+(?:\.\d+)?)\s*x/i);
    if (numMatch) {
      return numMatch[1] + 'x';
    }
  }
  // Fallback: return original cleaned text
  return text.trim();
}

// Clean FDV value - extract just the dollar amount from calculation text
// Handles cases like "(60000000 + 40000000 + ...) = 600000000 ÷ 4 = 150000000" -> "$150,000,000"
// Also handles "$5M", "$44.33M", "$574,800" already clean values
function cleanFdvValue(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  // If it already looks clean (starts with $ or is a short value), return as-is
  if (/^\$[\d,.]+[KMBTkmbt]?$/.test(trimmed) || trimmed.length < 30) {
    return trimmed;
  }
  // Look for the last "= number" pattern (result of calculation)
  const calcResults = trimmed.match(/=\s*(\d[\d,]*(?:\.\d+)?)/g);
  if (calcResults && calcResults.length > 0) {
    const lastResult = calcResults[calcResults.length - 1];
    const numMatch = lastResult.match(/=\s*(\d[\d,]*(?:\.\d+)?)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1].replace(/,/g, ''));
      if (!isNaN(num)) {
        return '$' + num.toLocaleString('en-US');
      }
    }
  }
  // Fallback: return original
  return trimmed;
}

// Sanitize field names by stripping asterisks (e.g., **final_score:** -> final_score:)
// This handles Stage 4 outputs that may have asterisks around field names
function sanitizeFieldText(text: string): string {
  if (!text) return "";
  // Replace **field_name:** with field_name: (preserve the colon)
  // Also handles **field_name**: and ** field_name **:
  return text.replace(/\*\*\s*([a-zA-Z_][a-zA-Z0-9_\s]*[a-zA-Z0-9_])\s*\*\*\s*:/gi, '$1:');
}

// Valid categories for community status parsing
const COMMUNITY_STATUS_CATEGORIES = ["Very Active", "Active", "Moderate", "Low", "Dead"];

// Valid categories for account quality parsing
const ACCOUNT_QUALITY_CATEGORIES = ["Builders/Researchers", "Traders/Degens", "Mixed Quality", "Promoters/Shills", "Bots/Spam"];

// Extract valid category from a longer string (e.g., "Active. The community shows..." -> "Active")
// Handles verbose responses with keyword-based matching
function extractCommunityStatusCategory(value: string): string {
  if (!value) return "Unknown";
  const cleanValue = cleanText(value);
  const lowerValue = cleanValue.toLowerCase();

  // Step 1: Check for exact match with any valid category
  for (const category of COMMUNITY_STATUS_CATEGORIES) {
    if (lowerValue === category.toLowerCase()) {
      return category;
    }
  }

  // Step 2: Check if value starts with any valid category
  for (const category of COMMUNITY_STATUS_CATEGORIES) {
    if (lowerValue.startsWith(category.toLowerCase())) {
      return category;
    }
  }

  // Step 3: Keyword-based matching for verbose responses
  // Order matters: check "very active" before "active", "moderately active" before "active"
  if (lowerValue.includes("very active")) {
    return "Very Active";
  }
  if (lowerValue.includes("moderately active") || lowerValue.includes("moderate")) {
    return "Moderate";
  }
  // Check "active" only if not "very active" or "moderately active" (already handled above)
  if (lowerValue.includes("active") && !lowerValue.includes("inactive")) {
    return "Active";
  }
  if (lowerValue.includes("low") || lowerValue.includes("minimal")) {
    return "Low";
  }
  if (lowerValue.includes("dead") || lowerValue.includes("no activity") || lowerValue.includes("inactive")) {
    return "Dead";
  }

  // Step 4: Final fallback - check if any category is contained in the value
  for (const category of COMMUNITY_STATUS_CATEGORIES) {
    if (lowerValue.includes(category.toLowerCase())) {
      return category;
    }
  }

  // Return "Unknown" if no match found
  return "Unknown";
}

// Extract valid category from account quality string
// Handles verbose responses with keyword-based matching
function extractAccountQualityCategory(value: string): string {
  if (!value) return "Unknown";
  const cleanValue = cleanText(value);
  const lowerValue = cleanValue.toLowerCase();

  // Step 1: Check for exact match with any valid category
  for (const category of ACCOUNT_QUALITY_CATEGORIES) {
    if (lowerValue === category.toLowerCase()) {
      return category;
    }
  }

  // Step 2: Check if value starts with any valid category
  for (const category of ACCOUNT_QUALITY_CATEGORIES) {
    if (lowerValue.startsWith(category.toLowerCase())) {
      return category;
    }
  }

  // Step 3: Keyword-based matching for verbose responses
  if (lowerValue.includes("builder") || lowerValue.includes("researcher") ||
      lowerValue.includes("developer") || lowerValue.includes("technical")) {
    return "Builders/Researchers";
  }
  if (lowerValue.includes("trader") || lowerValue.includes("degen")) {
    return "Traders/Degens";
  }
  if (lowerValue.includes("mixed")) {
    return "Mixed Quality";
  }
  if (lowerValue.includes("promoter") || lowerValue.includes("shill")) {
    return "Promoters/Shills";
  }
  if (lowerValue.includes("bot") || lowerValue.includes("spam")) {
    return "Bots/Spam";
  }

  // Step 4: Final fallback - check if any category is contained in the value
  for (const category of ACCOUNT_QUALITY_CATEGORIES) {
    if (lowerValue.includes(category.toLowerCase())) {
      return category;
    }
  }

  // Return "Unknown" if no match found
  return "Unknown";
}

// Normalize KOL (Key Opinion Leader) value
// Returns "None identified" for empty/null/placeholder values
function normalizeKolValue(value: string | null | undefined): string {
  if (!value) return "None identified";

  const cleanValue = cleanText(value);
  const lowerValue = cleanValue.toLowerCase();

  // Check for various "none" or empty indicators
  if (!cleanValue ||
      cleanValue === "" ||
      lowerValue === "none identified" ||
      lowerValue === "no value available for this output" ||
      lowerValue === "none" ||
      lowerValue === "n/a" ||
      lowerValue === "na" ||
      lowerValue === "none known" ||
      lowerValue.includes("none found") ||
      lowerValue.includes("no notable") ||
      lowerValue.includes("no kol") ||
      lowerValue.includes("not identified") ||
      lowerValue.includes("could not identify") ||
      lowerValue.includes("unable to identify")) {
    return "None identified";
  }

  return cleanValue;
}

// Clean text but preserve paragraph structure
function cleanTextPreserveStructure(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[:\s]+/, '')
    .replace(/\|[^\n]*\|/g, '')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n')
    .trim();
}

// Extract just the numeric value from asymmetry floor/ceiling fields
// These often come with calculation text like "8.69 (calculated from...)" or full formulas
function extractAsymmetryNumeric(text: string | undefined | null): string {
  if (!text) return "";

  // Clean the text first
  const cleaned = cleanText(text);

  // Try to find a decimal number at the start or standalone
  // Match patterns like: "8.69", "11.00", "8.69/15", etc.
  const numericMatch = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (numericMatch) {
    return numericMatch[1];
  }

  // Try to find any decimal number in the text
  const anyNumericMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (anyNumericMatch) {
    return anyNumericMatch[1];
  }

  return cleaned;
}

// Field names that should never be used as values (malformed output detection)
// If a value equals one of these, it's clearly a parsing error
const INVALID_VALUES_FIELD_NAMES = new Set([
  'primary_narrative',
  'sub_narrative',
  'narrative',
  'primary narrative',
  'sub narrative',
  'thesis',
  'display_summary',
  'recommendation',
  'final_score',
  'final_tier',
  'token_type',
]);

// Check if a value is actually a field name (malformed output)
// Exported for use in routes.ts as final safety check
export function isFieldNameAsValue(value: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return INVALID_VALUES_FIELD_NAMES.has(normalized);
}

// Strip common field label prefixes from values
// Many fields come through with their label included (e.g., "narrative: AI Agents")
const FIELD_LABEL_PREFIXES = [
  'narrative:',
  'primary_narrative:',
  'primary narrative:',
  'sub_narrative:',
  'sub narrative:',
  'sub_narrative_ceiling:',
  'sub narrative ceiling:',
  'sub_narrative_consensus:',
  'sub narrative consensus:',
  'thesis:',
  'display_summary:',
  'display summary:',
  'recommendation:',
  'confidence:',
  'phase_name:',
  'phase name:',
  'winning_side:',
  'winning side:',
  'equilibrium_type:',
  'equilibrium type:',
  'team_status:',
  'team status:',
  'notable_backers:',
  'notable backers:',
  'unlock_warning:',
  'unlock warning:',
  'x_sentiment:',
  'x sentiment:',
  'x_top_kols:',
  'x top kols:',
  'x_mentions_trend:',
  'x mentions trend:',
  'schelling_position:',
  'schelling position:',
  'narrative_rank:',
  'narrative rank:',
];

// Exported for use in routes.ts as final safety check
export function stripFieldLabelPrefix(text: string): string {
  if (!text) return "";
  let result = text.trim();

  // Simple direct string check - more reliable than regex
  const lowerResult = result.toLowerCase();
  for (const prefix of FIELD_LABEL_PREFIXES) {
    if (lowerResult.startsWith(prefix)) {
      result = result.substring(prefix.length).trim();
      console.log(`stripFieldLabelPrefix: Stripped "${prefix}" -> "${result}"`);
      break;
    }
    // Also check with space after colon
    const prefixWithSpace = prefix.replace(':', ': ');
    if (lowerResult.startsWith(prefixWithSpace)) {
      result = result.substring(prefixWithSpace.length).trim();
      console.log(`stripFieldLabelPrefix: Stripped "${prefixWithSpace}" -> "${result}"`);
      break;
    }
  }

  return result;
}

// ==================== OUTPUT SUMMARY PARSER (PRIMARY STRATEGY) ====================
// The OUTPUT SUMMARY section at the end of Gumloop output is the most reliable source
// It uses a consistent `field_name: value` format on each line

// Field name variations mapping - normalize to canonical names
const FIELD_ALIASES: Record<string, string> = {
  // Score variations
  'final_score': 'final_score',
  'final score': 'final_score',
  'finalscore': 'final_score',
  'score': 'final_score',

  // Tier variations
  'final_tier': 'final_tier',
  'final tier': 'final_tier',
  'tier': 'final_tier',
  'finaltier': 'final_tier',

  // Narrative variations
  'narrative': 'narrative',
  'narrative/meta': 'narrative',
  'meta': 'narrative',

  // Primary narrative variations (broad category)
  'primary_narrative': 'primary_narrative',
  'primary narrative': 'primary_narrative',
  'primarynarrative': 'primary_narrative',
  'broad_narrative': 'primary_narrative',
  'broad narrative': 'primary_narrative',
  'narrative_category': 'primary_narrative',
  'narrative category': 'primary_narrative',
  'main_narrative': 'primary_narrative',
  'main narrative': 'primary_narrative',

  // Sub-narrative variations (specific classification)
  'sub_narrative': 'sub_narrative',
  'sub narrative': 'sub_narrative',
  'subnarrative': 'sub_narrative',
  'specific_narrative': 'sub_narrative',
  'specific narrative': 'sub_narrative',
  'narrative_subcategory': 'sub_narrative',
  'narrative subcategory': 'sub_narrative',
  'detailed_narrative': 'sub_narrative',
  'detailed narrative': 'sub_narrative',

  // Sub-narrative ceiling variations (peak FDV for sub-narrative leader)
  'sub_narrative_ceiling': 'sub_narrative_ceiling',
  'sub narrative ceiling': 'sub_narrative_ceiling',
  'subnarrative_ceiling': 'sub_narrative_ceiling',
  'sub_narrative_peak_fdv': 'sub_narrative_ceiling',
  'sub narrative peak fdv': 'sub_narrative_ceiling',
  'narrative_ceiling': 'sub_narrative_ceiling',
  'narrative ceiling': 'sub_narrative_ceiling',
  'sub_ceiling': 'sub_narrative_ceiling',
  'sub ceiling': 'sub_narrative_ceiling',

  // Sub-narrative consensus variations (model agreement notes)
  'sub_narrative_consensus': 'sub_narrative_consensus',
  'sub narrative consensus': 'sub_narrative_consensus',
  'subnarrative_consensus': 'sub_narrative_consensus',
  'narrative_consensus': 'sub_narrative_consensus',
  'narrative consensus': 'sub_narrative_consensus',
  'model_narrative_agreement': 'sub_narrative_consensus',
  'model narrative agreement': 'sub_narrative_consensus',

  // Token type variations
  'token_type': 'token_type',
  'token type': 'token_type',
  'tokentype': 'token_type',
  'type': 'token_type',

  // Phase variations
  'phase': 'phase',
  'phase_number': 'phase',
  'phase number': 'phase',

  'phase_name': 'phase_name',
  'phase name': 'phase_name',
  'phasename': 'phase_name',

  // Peak proximity variations
  'peak_proximity_pct': 'peak_proximity_pct',
  'peak_proximity': 'peak_proximity_pct',
  'peak proximity': 'peak_proximity_pct',
  'peakproximity': 'peak_proximity_pct',

  // Winning side variations
  'winning_side': 'winning_side',
  'winning side': 'winning_side',
  'winningside': 'winning_side',

  // Consensus variations
  'consensus_level': 'consensus_level',
  'consensus level': 'consensus_level',
  'consensus': 'consensus_level',

  // Confidence variations
  'confidence': 'confidence',
  'confidence_level': 'confidence',

  // Recommendation variations
  'recommendation': 'recommendation',
  'rec': 'recommendation',
  'signal': 'recommendation',

  // Component scores
  'coordination_score': 'coordination_score',
  'coordination score': 'coordination_score',
  'coordination': 'coordination_score',

  'schelling_score': 'schelling_score',
  'schelling score': 'schelling_score',
  'schelling_rank_score': 'schelling_score',
  'schelling': 'schelling_score',

  'reflexivity_score': 'reflexivity_score',
  'reflexivity score': 'reflexivity_score',
  'reflexivity': 'reflexivity_score',

  'virality_score': 'virality_score',
  'virality score': 'virality_score',
  'virality': 'virality_score',

  'asymmetry_score': 'asymmetry_score',
  'asymmetry score': 'asymmetry_score',
  'asymmetry': 'asymmetry_score',

  'game_theory_score': 'game_theory_score',
  'game theory score': 'game_theory_score',
  'game_theory_bonus': 'game_theory_score',
  'gametheory': 'game_theory_score',

  'base_score': 'base_score',
  'base score': 'base_score',
  'basescore': 'base_score',

  // Modifiers
  'phase_modifier': 'phase_modifier',
  'phase modifier': 'phase_modifier',

  'narrative_modifier': 'narrative_modifier',
  'narrative modifier': 'narrative_modifier',
  'meta_modifier': 'narrative_modifier',
  'meta modifier': 'narrative_modifier',

  'narrative_heat': 'narrative_heat',
  'narrative heat': 'narrative_heat',
  'meta_heat': 'narrative_heat',
  'meta heat': 'narrative_heat',

  'exit_liquidity_modifier': 'exit_liquidity_modifier',
  'exit liquidity modifier': 'exit_liquidity_modifier',
  'exit_liq_modifier': 'exit_liquidity_modifier',
  'exitliq_modifier': 'exit_liquidity_modifier',

  'peak_proximity_modifier': 'peak_proximity_modifier',
  'peak proximity modifier': 'peak_proximity_modifier',

  'data_quality_modifier': 'data_quality_modifier',
  'data quality modifier': 'data_quality_modifier',

  'fdv_modifier': 'fdv_modifier',
  'fdv modifier': 'fdv_modifier',
  'market_cap_modifier': 'market_cap_modifier',
  'market cap modifier': 'market_cap_modifier',

  'total_modifiers': 'total_modifiers',
  'total modifiers': 'total_modifiers',

  'penalties': 'penalties',
  'penalty': 'penalties',

  // Model scores
  'gpt_score': 'gpt_score',
  'gpt score': 'gpt_score',
  'chatgpt_score': 'gpt_score',
  'chatgpt': 'gpt_score',

  'claude_score': 'claude_score',
  'claude score': 'claude_score',
  'claude': 'claude_score',

  'gemini_score': 'gemini_score',
  'gemini score': 'gemini_score',
  'gemini': 'gemini_score',

  'grok_score': 'grok_score',
  'grok score': 'grok_score',
  'grok': 'grok_score',

  // Model verdicts (handle all case/separator variations)
  'gpt_verdict': 'gpt_verdict',
  'gpt verdict': 'gpt_verdict',
  'gptverdict': 'gpt_verdict',
  'chatgpt_verdict': 'gpt_verdict',
  'chatgpt verdict': 'gpt_verdict',
  'chatgptverdict': 'gpt_verdict',
  'claude_verdict': 'claude_verdict',
  'claude verdict': 'claude_verdict',
  'claudeverdict': 'claude_verdict',
  'gemini_verdict': 'gemini_verdict',
  'gemini verdict': 'gemini_verdict',
  'geminiverdict': 'gemini_verdict',
  'grok_verdict': 'grok_verdict',
  'grok verdict': 'grok_verdict',
  'grokverdict': 'grok_verdict',

  // Model reasoning (handle all case/separator variations)
  'gpt_reasoning': 'gpt_reasoning',
  'gpt reasoning': 'gpt_reasoning',
  'gptreasoning': 'gpt_reasoning',
  'chatgpt_reasoning': 'gpt_reasoning',
  'chatgpt reasoning': 'gpt_reasoning',
  'chatgptreasoning': 'gpt_reasoning',
  'gpt_analysis': 'gpt_reasoning',
  'gpt analysis': 'gpt_reasoning',
  'claude_reasoning': 'claude_reasoning',
  'claude reasoning': 'claude_reasoning',
  'claudereasoning': 'claude_reasoning',
  'claude_analysis': 'claude_reasoning',
  'claude analysis': 'claude_reasoning',
  'gemini_reasoning': 'gemini_reasoning',
  'gemini reasoning': 'gemini_reasoning',
  'geminireasoning': 'gemini_reasoning',
  'gemini_analysis': 'gemini_reasoning',
  'gemini analysis': 'gemini_reasoning',
  'grok_reasoning': 'grok_reasoning',
  'grok reasoning': 'grok_reasoning',
  'grokreasoning': 'grok_reasoning',
  'grok_analysis': 'grok_reasoning',
  'grok analysis': 'grok_reasoning',

  // Model risks (handle all case/separator variations)
  'gpt_risks': 'gpt_risks',
  'gpt risks': 'gpt_risks',
  'gptrisks': 'gpt_risks',
  'chatgpt_risks': 'gpt_risks',
  'chatgpt risks': 'gpt_risks',
  'chatgptrisks': 'gpt_risks',
  'gpt_key_risks': 'gpt_risks',
  'claude_risks': 'claude_risks',
  'claude risks': 'claude_risks',
  'clauderisks': 'claude_risks',
  'claude_key_risks': 'claude_risks',
  'gemini_risks': 'gemini_risks',
  'gemini risks': 'gemini_risks',
  'geminirisks': 'gemini_risks',
  'gemini_key_risks': 'gemini_risks',
  'grok_risks': 'grok_risks',
  'grok risks': 'grok_risks',
  'grokrisks': 'grok_risks',
  'grok_key_risks': 'grok_risks',

  // Other fields
  'thesis': 'thesis',
  'project_thesis': 'thesis',

  'verdict': 'verdict',
  'final_verdict': 'verdict',

  'reasoning': 'reasoning',
  'rationale': 'reasoning',

  'equilibrium_type': 'equilibrium_type',
  'equilibrium type': 'equilibrium_type',

  'schelling_position': 'schelling_position',
  'schelling position': 'schelling_position',

  // Asymmetry floor/ceiling variations
  'asymmetry_floor': 'asymmetry_floor',
  'asymmetry floor': 'asymmetry_floor',
  'asymmetry_floor_score': 'asymmetry_floor',
  'asymmetry floor score': 'asymmetry_floor',
  'downside_risk': 'asymmetry_floor',
  'downside risk': 'asymmetry_floor',

  'asymmetry_ceiling': 'asymmetry_ceiling',
  'asymmetry ceiling': 'asymmetry_ceiling',
  'asymmetry_ceiling_score': 'asymmetry_ceiling',
  'asymmetry ceiling score': 'asymmetry_ceiling',
  'upside_potential': 'asymmetry_ceiling',
  'upside potential': 'asymmetry_ceiling',

  // X Sentiment variations (deprecated - often N/A)
  'x_sentiment': 'x_sentiment',
  'x sentiment': 'x_sentiment',
  'xsentiment': 'x_sentiment',
  'twitter_sentiment': 'x_sentiment',
  'twitter sentiment': 'x_sentiment',
  'sentiment': 'x_sentiment',

  // Community Status - new reliable field
  'community_status': 'community_status',
  'community status': 'community_status',
  'community_coordination_active_community_status': 'community_status',
  'active_community_status': 'community_status',
  'active community status': 'community_status',

  // Account Quality - new reliable field
  'account_quality': 'account_quality',
  'account quality': 'account_quality',
  'account_analysis_account_quality_assessment': 'account_quality',
  'account_quality_assessment': 'account_quality',
  'account quality assessment': 'account_quality',

  // Top KOLs variations
  'top_kols': 'top_kols',
  'top kols': 'top_kols',
  'x_top_kols': 'top_kols',
  'x top kols': 'top_kols',
  'notable_kols': 'top_kols',
  'notable kols': 'top_kols',

  // Upside Assessment fields
  'current_fdv': 'current_fdv',
  'current fdv': 'current_fdv',
  'currentfdv': 'current_fdv',
  'realistic_peak_fdv': 'realistic_peak_fdv',
  'realistic peak fdv': 'realistic_peak_fdv',
  'peak_fdv': 'realistic_peak_fdv',
  'peak fdv': 'realistic_peak_fdv',
  'upside_multiple': 'upside_multiple',
  'upside multiple': 'upside_multiple',
  'upsidemultiple': 'upside_multiple',
  'multiple': 'upside_multiple',
  'upside_tier': 'upside_tier',
  'upside tier': 'upside_tier',
  'upsidetier': 'upside_tier',

  // New Stage 4 fields
  'narrative_durability': 'narrative_durability',
  'narrative durability': 'narrative_durability',
  'narrativedurability': 'narrative_durability',
  'durability': 'narrative_durability',

  'kol_mention_recency': 'kol_mention_recency',
  'kol mention recency': 'kol_mention_recency',
  'kolmentionrecency': 'kol_mention_recency',
  'mention_recency': 'kol_mention_recency',
  'mention recency': 'kol_mention_recency',

  'divergence_check_distribution_warning': 'distribution_warning',
  'divergence check distribution warning': 'distribution_warning',
  'distribution_warning': 'distribution_warning',
  'distribution warning': 'distribution_warning',
  'distributionwarning': 'distribution_warning',

  // Score calculation field (LLM arithmetic verification)
  'score_calculation': 'score_calculation',
  'score calculation': 'score_calculation',
  'scorecalculation': 'score_calculation',
  'final_score_calculation': 'score_calculation',
  'final score calculation': 'score_calculation',
  'calculation': 'score_calculation',

  // X Research qualitative fields
  'engagement_quality': 'engagement_quality',
  'engagement quality': 'engagement_quality',
  'engagementquality': 'engagement_quality',
  'attention_metrics_engagement_quality': 'engagement_quality',
  'attention metrics engagement quality': 'engagement_quality',

  'overall_sentiment': 'overall_sentiment',
  'overall sentiment': 'overall_sentiment',
  'overallsentiment': 'overall_sentiment',
  'sentiment_analysis_overall_sentiment': 'overall_sentiment',
  'sentiment analysis overall sentiment': 'overall_sentiment',

  'cult_vs_mercenary': 'cult_vs_mercenary',
  'cult vs mercenary': 'cult_vs_mercenary',
  'cultvsmercenary': 'cult_vs_mercenary',
  'community_coordination_cult_vs_mercenary': 'cult_vs_mercenary',
  'community coordination cult vs mercenary': 'cult_vs_mercenary',

  // Model divergence fields
  'score_spread': 'score_spread',
  'score spread': 'score_spread',
  'scorespread': 'score_spread',
  'model_score_spread': 'score_spread',
  'model score spread': 'score_spread',

  'divergence_flag': 'divergence_flag',
  'divergence flag': 'divergence_flag',
  'divergenceflag': 'divergence_flag',
  'model_divergence': 'divergence_flag',
  'model divergence': 'divergence_flag',

  'divergence_note': 'divergence_note',
  'divergence note': 'divergence_note',
  'divergencenote': 'divergence_note',
  'divergence_explanation': 'divergence_note',
  'divergence explanation': 'divergence_note',

  // X Research flexible format fields (sentiment ratios)
  'sentiment_analysis_overall_sentiment_ratio_bullish': 'sentiment_bullish_ratio',
  'sentiment analysis overall sentiment ratio bullish': 'sentiment_bullish_ratio',
  'sentiment_ratio_bullish': 'sentiment_bullish_ratio',
  'bullish_ratio': 'sentiment_bullish_ratio',
  'bullish ratio': 'sentiment_bullish_ratio',

  'sentiment_analysis_overall_sentiment_ratio_bearish': 'sentiment_bearish_ratio',
  'sentiment analysis overall sentiment ratio bearish': 'sentiment_bearish_ratio',
  'sentiment_ratio_bearish': 'sentiment_bearish_ratio',
  'bearish_ratio': 'sentiment_bearish_ratio',
  'bearish ratio': 'sentiment_bearish_ratio',

  'sentiment_analysis_overall_sentiment_ratio_neutral': 'sentiment_neutral_ratio',
  'sentiment analysis overall sentiment ratio neutral': 'sentiment_neutral_ratio',
  'sentiment_ratio_neutral': 'sentiment_neutral_ratio',
  'neutral_ratio': 'sentiment_neutral_ratio',
  'neutral ratio': 'sentiment_neutral_ratio',

  // X Research flexible format fields (engagement quality details)
  'attention_metrics_engagement_quality_likes_per_post_average': 'likes_per_post_avg',
  'attention metrics engagement quality likes per post average': 'likes_per_post_avg',
  'likes_per_post_average': 'likes_per_post_avg',
  'likes_per_post': 'likes_per_post_avg',
  'likes per post': 'likes_per_post_avg',

  'attention_metrics_engagement_quality_retweets_per_post_average': 'retweets_per_post_avg',
  'attention metrics engagement quality retweets per post average': 'retweets_per_post_avg',
  'retweets_per_post_average': 'retweets_per_post_avg',
  'retweets_per_post': 'retweets_per_post_avg',
  'retweets per post': 'retweets_per_post_avg',

  'attention_metrics_engagement_quality_replies_per_post_average': 'replies_per_post_avg',
  'attention metrics engagement quality replies per post average': 'replies_per_post_avg',
  'replies_per_post_average': 'replies_per_post_avg',
  'replies_per_post': 'replies_per_post_avg',
  'replies per post': 'replies_per_post_avg',

  // X Research flexible format fields (cult/mercenary ratio)
  'community_coordination_cult_vs_mercenary_ratio': 'cult_mercenary_ratio',
  'community coordination cult vs mercenary ratio': 'cult_mercenary_ratio',
  'cult_mercenary_ratio': 'cult_mercenary_ratio',
  'cult mercenary ratio': 'cult_mercenary_ratio',

  // X Research flexible format fields (sample size)
  'sentiment_analysis_sample_size_of_posts_analyzed': 'sentiment_sample_size',
  'sentiment analysis sample size of posts analyzed': 'sentiment_sample_size',
  'sample_size_of_posts_analyzed': 'sentiment_sample_size',
  'sample_size': 'sentiment_sample_size',
  'sample size': 'sentiment_sample_size',
  'posts_analyzed': 'sentiment_sample_size',
};

// Normalize a field name to its canonical form
function normalizeFieldName(name: string): string {
  const normalized = name.toLowerCase().trim();
  return FIELD_ALIASES[normalized] || normalized.replace(/\s+/g, '_');
}

// Extract the OUTPUT SUMMARY section from text
function extractOutputSummarySection(text: string): string | null {
  // Look for OUTPUT SUMMARY markers - try multiple patterns
  const patterns = [
    // ════ bordered section
    /═{3,}[^\n]*OUTPUT\s*SUMMARY[^\n]*═*\s*\n([\s\S]*?)(?=═{3,}|$)/i,
    // ## OUTPUT SUMMARY or # OUTPUT SUMMARY (markdown headers)
    /#{1,3}\s*OUTPUT\s*SUMMARY\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/i,
    // **OUTPUT SUMMARY** (bold markdown)
    /\*\*\s*OUTPUT\s*SUMMARY\s*\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*[A-Z]|\n#{1,3}|$)/i,
    // --- OUTPUT SUMMARY --- (with dashes)
    /-{3,}\s*OUTPUT\s*SUMMARY\s*-*\s*\n([\s\S]*?)(?=-{3,}|$)/i,
    // OUTPUT SUMMARY: or OUTPUT SUMMARY (plain, captures to end)
    /OUTPUT\s*SUMMARY\s*:?\s*\n([\s\S]*?)$/i,
    // Just look for lines starting with common field names after any "summary" marker
    /(?:summary|output)\s*:?\s*\n((?:[a-z_]+\s*:\s*[^\n]+\n?)+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const content = match[1].trim();
      // Validate that it looks like key-value pairs (at least 3 lines with colons)
      const lines = content.split('\n').filter(l => l.includes(':'));
      if (lines.length >= 3 || content.length > 50) {
        console.log(`Parser: Found OUTPUT SUMMARY section (${content.length} chars, ${lines.length} kv lines)`);
        return content;
      }
    }
  }

  // Last resort: find the last section that looks like structured data
  // Look for a block of consecutive "field: value" lines near the end
  const lines = text.split('\n');
  let kvStart = -1;
  let kvEnd = -1;
  const kvPattern = /^[a-z_\s]+:\s*.+/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (kvPattern.test(line)) {
      if (kvEnd === -1) kvEnd = i;
      kvStart = i;
    } else if (kvEnd !== -1 && kvStart !== -1 && (kvEnd - kvStart) >= 3) {
      // Found a block of 4+ consecutive kv lines
      break;
    } else if (kvEnd !== -1 && line.length > 0 && !line.startsWith('#') && !line.startsWith('-')) {
      // Non-empty, non-header line breaks the sequence
      if ((kvEnd - kvStart) >= 3) break;
      kvEnd = -1;
      kvStart = -1;
    }
  }

  if (kvStart !== -1 && kvEnd !== -1 && (kvEnd - kvStart) >= 3) {
    const summaryLines = lines.slice(kvStart, kvEnd + 1).join('\n');
    console.log(`Parser: Found OUTPUT SUMMARY via kv-block detection (lines ${kvStart}-${kvEnd})`);
    return summaryLines;
  }

  console.log(`Parser: No OUTPUT SUMMARY section found in text of ${text.length} chars`);
  return null;
}

// Parse OUTPUT SUMMARY section into key-value pairs
function parseOutputSummaryToMap(summaryText: string): Map<string, string> {
  const result = new Map<string, string>();

  // Split into lines and parse each as key: value
  const lines = summaryText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, markdown headers, table separators
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || /^[-=]+$/.test(trimmed)) {
      continue;
    }

    // Try multiple patterns to match key: value
    const patterns = [
      // Standard: field_name: value (with optional ** or * around field name)
      /^\*{0,2}([a-z_\s/]+)\*{0,2}\s*:\s*(.+)$/i,
      // With bullet: - field_name: value
      /^[-•]\s*\*{0,2}([a-z_\s/]+)\*{0,2}\s*:\s*(.+)$/i,
      // With number: 1. field_name: value
      /^\d+\.\s*\*{0,2}([a-z_\s/]+)\*{0,2}\s*:\s*(.+)$/i,
    ];

    let matched = false;
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1] && match[2]) {
        const rawKey = match[1].trim();
        const rawValue = match[2].trim();

        // Skip if value looks like a markdown header, empty, or placeholder
        if (!rawValue || rawValue === '-' || rawValue === 'N/A' ||
            rawValue === 'undefined' || rawValue === 'null' || rawValue.startsWith('#')) {
          continue;
        }

        const canonicalKey = normalizeFieldName(rawKey);
        // Clean the value (remove trailing markdown, extra quotes, brackets)
        let cleanedValue = rawValue
          .replace(/\*\*/g, '')
          .replace(/^\s*["'\[\(]|["'\]\)]\s*$/g, '')
          .replace(/\s*\|.*$/, '') // Remove table continuation
          .trim();

        if (cleanedValue) {
          result.set(canonicalKey, cleanedValue);
          matched = true;
          break;
        }
      }
    }
  }

  console.log(`Parser: Parsed ${result.size} fields from OUTPUT SUMMARY`);
  if (result.size > 0) {
    console.log(`Parser: OUTPUT SUMMARY fields: ${Array.from(result.keys()).join(', ')}`);
  }

  return result;
}

// Get a string value from the parsed map
function getStringFromMap(map: Map<string, string>, key: string): string | null {
  const canonicalKey = normalizeFieldName(key);
  const value = map.get(canonicalKey);
  if (value && value !== 'N/A' && value !== 'undefined' && value !== 'null') {
    // Clean text and strip any field label prefix
    return stripFieldLabelPrefix(cleanText(value));
  }
  return null;
}

// Get a numeric value from the parsed map
function getNumberFromMap(map: Map<string, string>, key: string): number | null {
  const value = getStringFromMap(map, key);
  if (!value) return null;

  // Extract number from formats like: 72.5, 72.5/100, +5, -3
  const numMatch = value.match(/([+-]?\d+\.?\d*)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (!isNaN(num)) return num;
  }
  return null;
}

// ==================== END OUTPUT SUMMARY PARSER ====================

// Extract a structured field value from the text
// Handles formats like: field_name: value, | field_name | value |, **field_name**: value
// Also handles values inside code blocks (```...```)
function extractField(text: string, fieldName: string): string | null {
  // Normalize field name for regex (handle underscores and spaces)
  const normalizedName = fieldName.replace(/_/g, '[_\\s]*');

  const patterns = [
    // Inside code block: field_name: value (on its own line within ``` blocks)
    new RegExp(`\`\`\`[\\s\\S]*?${normalizedName}:\\s*([^\\n\`]+)`, 'i'),
    // Table format: | field_name | value |
    new RegExp(`\\|\\s*${normalizedName}\\s*\\|\\s*([^|\\n]+)\\s*\\|`, 'i'),
    // Bullet point with bold label: - **field_name**: value
    new RegExp(`-\\s*\\*\\*${normalizedName}\\*\\*[:\\s]+([^\\n]+)`, 'i'),
    // Bold label: **field_name**: value or **field_name** | value
    new RegExp(`\\*\\*${normalizedName}\\*\\*[:\\s|]+([^\\n|]+)`, 'i'),
    // Simple label on its own line: field_name: value
    new RegExp(`^${normalizedName}:\\s*([^\\n]+)`, 'mi'),
    // Simple label: field_name: value (anywhere)
    new RegExp(`${normalizedName}:\\s*([^\\n|]+)`, 'i'),
    // Markdown table with header
    new RegExp(`${normalizedName}\\s*\\|\\s*([^|\\n]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = match[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
      // Remove trailing backticks from code blocks
      value = value.replace(/```.*$/, '').trim();
      // Strip any field label prefix from the value
      value = stripFieldLabelPrefix(value);
      if (value && value !== '-' && value !== 'N/A' && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

// Extract a numeric field
function extractNumericField(text: string, fieldName: string): number | undefined {
  const value = extractField(text, fieldName);
  if (!value) return undefined;

  // Handle formats like: 65.5, +5, -3, 65.5/100
  const numMatch = value.match(/([+-]?\d+\.?\d*)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (!isNaN(num)) return num;
  }
  return undefined;
}

// Extract a number from text using patterns (legacy support)
function extractNumber(text: string, label: string): number | undefined {
  const tableMatch = text.match(new RegExp(`\\|\\s*${label}[^|]*\\|\\s*([\\d.]+)`, 'i'));
  if (tableMatch) return parseFloat(tableMatch[1]);

  const colonMatch = text.match(new RegExp(`${label}[:\\s|]*\\*?\\*?([\\d.]+)`, 'i'));
  if (colonMatch) return parseFloat(colonMatch[1]);

  const slashMatch = text.match(new RegExp(`${label}[:\\s]*([\\d.]+)\\s*/\\s*\\d+`, 'i'));
  if (slashMatch) return parseFloat(slashMatch[1]);

  return undefined;
}

// Dedicated narrative extraction - handles the specific Gumloop output format
function extractNarrativeField(text: string): string | null {
  // Validation function for narrative values
  const isValidNarrative = (value: string): boolean => {
    if (!value || value.length < 3 || value.length > 100) return false;
    // Reject pure numbers or modifier values like "-5", "+3"
    if (/^[+-]?\d+\.?\d*$/.test(value.trim())) return false;
    // Reject common non-narrative values
    const rejectPatterns = ['AT_RISK', 'USER', 'N/A', 'UNKNOWN', 'undefined', 'null'];
    if (rejectPatterns.some(p => value.toUpperCase().includes(p))) return false;
    return true;
  };

  // Patterns ordered by specificity (most specific first)
  // IMPORTANT: Use negative lookbehind (?<!...) to avoid matching "narrative:" within "primary_narrative:" or "sub_narrative:"
  const patterns = [
    // **NARRATIVE:** followed by narrative: value (Gumloop format)
    /\*\*NARRATIVE:\*\*\s*\n?\s*(?<!primary_|sub_)narrative:\s*([^\n]+)/i,
    // narrative: value on its own line (not in a table) - NOT preceded by primary_ or sub_
    /(?:^|\n)\s*(?<!primary_|sub_)narrative:\s*([A-Za-z][^\n|]+)/im,
    // **Narrative**: value or **Narrative:** value - but not Primary Narrative or Sub Narrative
    /(?<!\bPrimary\s)(?<!\bSub\s)\*\*Narrative\*\*[:\s]+([A-Za-z][^\n*|]+)/i,
    // Primary Narrative: value - skip this for plain narrative extraction
    // narrative in quotes: "value" or 'value' - NOT preceded by primary_ or sub_
    /(?<!primary_|sub_)narrative[:\s]+["']([^"']+)["']/i,
    // thesis as fallback
    /thesis[:\s]+["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Apply cleanText first, then strip any field label prefix
      let value = cleanText(match[1].trim());
      value = stripFieldLabelPrefix(value);
      if (isValidNarrative(value)) {
        console.log(`extractNarrativeField: Found valid narrative: "${value}" (after cleaning)`);
        return value;
      }
    }
  }

  return null;
}

// Extract narrative fields from ## NARRATIVE: markdown section
// Returns { primaryNarrative, subNarrative } when found
function extractNarrativeSectionFields(text: string): { primaryNarrative?: string; subNarrative?: string } {
  const result: { primaryNarrative?: string; subNarrative?: string } = {};

  // Look for NARRATIVE: section in various formats
  const narrativeSectionPatterns = [
    // Plain "NARRATIVE:" section header (most common in Gumloop output)
    // Ends at next all-caps section header like "THESIS:" or "CATALYSTS:"
    /(?:^|\n)NARRATIVE:\s*\n([\s\S]*?)(?=\n[A-Z]{4,}:|\n##|\n---|\n\*\*[A-Z]|$)/i,
    // ## NARRATIVE: markdown header
    /##\s*NARRATIVE:?\s*\n([\s\S]*?)(?=\n##|\n---|\n\*\*[A-Z]|$)/i,
    // **NARRATIVE:** bold markdown
    /\*\*NARRATIVE:?\*\*\s*:?\s*\n([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/i,
    // NARRATIVE SECTION: alternative format
    /NARRATIVE\s*SECTION:?\s*\n([\s\S]*?)(?=\n##|\n---|\n\*\*[A-Z]|$)/i,
  ];

  let sectionContent: string | null = null;
  for (const pattern of narrativeSectionPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 5) {
      sectionContent = match[1].trim();
      console.log(`extractNarrativeSectionFields: Found NARRATIVE section (${sectionContent.length} chars)`);
      break;
    }
  }

  if (!sectionContent) {
    return result;
  }

  // Extract primary_narrative from section
  const primaryMatch = sectionContent.match(/primary[_\s]?narrative[:\s]+([^\n]+)/i);
  if (primaryMatch && primaryMatch[1]) {
    const value = stripFieldLabelPrefix(primaryMatch[1].trim());
    if (value && value.length >= 2 && value.length < 100) {
      result.primaryNarrative = value;
      console.log(`extractNarrativeSectionFields: Got primary_narrative: "${value}"`);
    }
  }

  // Extract sub_narrative from section
  const subMatch = sectionContent.match(/sub[_\s]?narrative[:\s]+([^\n]+)/i);
  if (subMatch && subMatch[1]) {
    const value = stripFieldLabelPrefix(subMatch[1].trim());
    if (value && value.length >= 2 && value.length < 150) {
      result.subNarrative = value;
      console.log(`extractNarrativeSectionFields: Got sub_narrative: "${value}"`);
    }
  }

  return result;
}

// Dedicated final score extraction - avoids picking up individual model scores from tables
function extractFinalScoreField(text: string): number | null {
  // Patterns ordered by specificity - look for CONSENSUS/AGGREGATED final score
  const patterns = [
    // "Final Score: 74.25 → Rounded to 74" pattern
    /Final\s*Score[:\s]+(\d+\.?\d*)\s*[→\->]/i,
    // "**Final Score: 74.25/100**" pattern
    /\*\*Final\s*Score[:\s]*\*?\*?\s*(\d+\.?\d*)\s*\/\s*100/i,
    // "**Final Score:** 74" or "**Final Score: 74**"
    /\*\*Final\s*Score:?\*\*[:\s]*(\d+\.?\d*)/i,
    // Section 17 FINAL CONSENSUS SCORE pattern - look for score after "Final Score:" NOT in a table
    /FINAL\s*CONSENSUS\s*SCORE[\s\S]*?Final\s*Score[:\s]+(\d+\.?\d*)/i,
    // Standalone "Final Score: 74" not preceded by | (table cell)
    /(?<!\|[^|\n]*)\bFinal\s*Score[:\s]+(\d+\.?\d*)(?!\s*\|)/i,
    // "final_score: 74" field format
    /final[_\s]score[:\s]+(\d+\.?\d*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (!isNaN(score) && score >= 0 && score <= 100) {
        console.log(`extractFinalScoreField: Found score ${score} using pattern: ${pattern.source.substring(0, 50)}...`);
        return score;
      }
    }
  }

  return null;
}

// Extract OUTPUT SUMMARY section from the full text
function extractOutputSummary(text: string): { summary: string; fullText: string } {
  // Look for OUTPUT SUMMARY section markers
  const summaryPatterns = [
    /(?:^|\n)(?:##?\s*)?(?:\*\*)?OUTPUT\s*SUMMARY(?:\*\*)?[\s:]*\n([\s\S]*?)(?=\n##|\n---|\n\*\*[A-Z]|$)/i,
    /(?:^|\n)OUTPUT\s*SUMMARY[:\s]*\n([\s\S]*?)$/i,
    /(?:^|\n)---+\s*\n\s*OUTPUT\s*SUMMARY[:\s]*\n([\s\S]*?)$/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 50) {
      return { summary: match[1].trim(), fullText: text };
    }
  }

  // If no OUTPUT SUMMARY found, return the full text
  return { summary: text, fullText: text };
}

// Parse the new structured OUTPUT SUMMARY format
function parseStructuredOutput(text: string, result: ParsedGumloopResponse): void {
  // Extract OUTPUT SUMMARY section for more accurate parsing
  const { summary: summaryText } = extractOutputSummary(text);

  // Use summary text for field extraction when available
  const parseText = summaryText.length > 100 ? summaryText : text;

  // Core Scores - Use dedicated final score extraction to avoid picking up model scores
  // First try the full text (more context for finding consensus score)
  let finalScore = extractFinalScoreField(text);
  // Fall back to summary text
  if (finalScore === null) {
    finalScore = extractFinalScoreField(parseText);
  }
  // Last resort: use generic extraction
  if (finalScore === null) {
    const genericScore = extractNumericField(parseText, 'final_score');
    if (genericScore !== undefined && genericScore >= 0 && genericScore <= 100) {
      finalScore = genericScore;
    }
  }
  if (finalScore !== null) {
    result.finalScore = finalScore;
  }

  const tier = extractField(parseText, 'final_tier');
  if (tier) {
    const cleanTier = tier.toUpperCase().replace(/[^A-Z+]/g, '');
    if (['S+', 'S', 'A', 'B', 'C'].includes(cleanTier)) {
      result.tier = cleanTier;
    }
  }

  // Token type - UTILITY or MEMECOIN
  const tokenType = extractField(parseText, 'token_type');
  if (tokenType) {
    const cleanType = tokenType.toUpperCase().trim();
    if (cleanType.includes('MEME')) {
      result.tokenType = 'MEMECOIN';
    } else if (cleanType.includes('UTIL')) {
      result.tokenType = 'UTILITY';
    } else {
      result.tokenType = cleanType === 'MEMECOIN' ? 'MEMECOIN' : 'UTILITY';
    }
  }

  const consensusLevel = extractField(parseText, 'consensus_level');
  if (consensusLevel) {
    const level = consensusLevel.toUpperCase();
    if (['HIGH', 'MIXED', 'LOW', 'CONFLICTED'].includes(level)) {
      result.consensusLevel = level;
    }
  }

  const phase = extractNumericField(parseText, 'phase');
  if (phase !== undefined && phase >= 1 && phase <= 5) {
    result.phase = phase;
  }

  const phaseName = extractField(parseText, 'phase_name');
  if (phaseName) {
    result.phaseName = cleanText(phaseName);
  }

  const peakProximity = extractNumericField(parseText, 'peak_proximity_pct');
  if (peakProximity !== undefined && peakProximity >= 0 && peakProximity <= 100) {
    result.peakProximity = peakProximity;
  }

  const winningSide = extractField(parseText, 'winning_side');
  if (winningSide) {
    const side = winningSide.toUpperCase();
    if (side.includes('USER')) result.winningSide = 'USER';
    else if (side.includes('EXIT') || side.includes('LIQUIDITY')) result.winningSide = 'EXIT_LIQ';
    else result.winningSide = 'AT_RISK';
  }

  const confidence = extractField(parseText, 'confidence');
  if (confidence) {
    const conf = confidence.toUpperCase().charAt(0);
    if (['H', 'M', 'L'].includes(conf)) {
      result.confidence = conf;
    }
  }

  const recommendation = extractField(parseText, 'recommendation');
  if (recommendation) {
    const rec = recommendation.toUpperCase();
    // Check for CAUTIOUS BUY first (before plain BUY, since it contains "BUY")
    if (rec.includes('CAUTIOUS') && rec.includes('BUY')) result.recommendation = 'CAUTIOUS BUY';
    else if (rec.includes('BUY')) result.recommendation = 'BUY';
    else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
    else result.recommendation = 'HOLD';
  }

  // Component Scores
  const coordinationScore = extractNumericField(parseText, 'coordination_score');
  if (coordinationScore !== undefined) result.coordinationScore = coordinationScore;

  const schellingScore = extractNumericField(parseText, 'schelling_score');
  if (schellingScore !== undefined) result.schellingRankScore = schellingScore;

  const reflexivityScore = extractNumericField(parseText, 'reflexivity_score');
  if (reflexivityScore !== undefined) result.reflexivityScore = reflexivityScore;

  const viralityScore = extractNumericField(parseText, 'virality_score');
  if (viralityScore !== undefined) result.viralityScore = viralityScore;

  const asymmetryScore = extractNumericField(parseText, 'asymmetry_score');
  if (asymmetryScore !== undefined) result.asymmetryScore = asymmetryScore;

  const gameTheoryScore = extractNumericField(parseText, 'game_theory_score');
  if (gameTheoryScore !== undefined) result.gameTheoryBonus = gameTheoryScore;

  const baseScore = extractNumericField(parseText, 'base_score');
  if (baseScore !== undefined) result.baseScore = baseScore;

  // Modifiers
  const phaseModifier = extractNumericField(parseText, 'phase_modifier');
  if (phaseModifier !== undefined) result.phaseModifier = phaseModifier;

  const narrativeModifier = extractNumericField(parseText, 'narrative_modifier');
  if (narrativeModifier !== undefined) result.narrativeModifier = narrativeModifier;

  const exitLiquidityModifier = extractNumericField(parseText, 'exit_liquidity_modifier');
  if (exitLiquidityModifier !== undefined) result.exitLiquidityModifier = exitLiquidityModifier;

  const peakProximityModifier = extractNumericField(parseText, 'peak_proximity_modifier');
  if (peakProximityModifier !== undefined) result.peakProximityModifier = peakProximityModifier;

  const dataQualityModifier = extractNumericField(parseText, 'data_quality_modifier');
  if (dataQualityModifier !== undefined) result.dataQualityModifier = dataQualityModifier;

  // FDV modifier with fallback to market_cap_modifier for backward compatibility
  const fdvModifier = extractNumericField(parseText, 'fdv_modifier');
  const marketCapModifier = extractNumericField(parseText, 'market_cap_modifier');
  if (fdvModifier !== undefined) {
    result.fdvModifier = fdvModifier;
  } else if (marketCapModifier !== undefined) {
    result.fdvModifier = marketCapModifier; // Use market cap as fallback
  }
  if (marketCapModifier !== undefined) result.marketCapModifier = marketCapModifier;

  const totalModifiers = extractNumericField(parseText, 'total_modifiers');
  if (totalModifiers !== undefined) result.totalModifiers = totalModifiers;

  const penalties = extractNumericField(parseText, 'penalties');
  if (penalties !== undefined) result.penalties = penalties;

  // Log all modifiers for debugging
  console.log(`Parser: Modifiers - phase: ${result.phaseModifier}, narrative: ${result.narrativeModifier}, exitLiq: ${result.exitLiquidityModifier}, peakProx: ${result.peakProximityModifier}, dataQuality: ${result.dataQualityModifier}, fdv: ${result.fdvModifier}, total: ${result.totalModifiers}`);

  // Narrative - use dedicated extraction with multiple patterns
  const narrative = extractNarrativeField(parseText);
  if (narrative) {
    const cleanedNarrative = stripFieldLabelPrefix(narrative);
    // IMPORTANT: Reject if the value is actually a field name (malformed output)
    if (!isFieldNameAsValue(cleanedNarrative)) {
      result.narrative = cleanedNarrative;
    } else {
      console.log(`Parser: Rejecting narrative value "${cleanedNarrative}" from extractNarrativeField - it's a field name`);
    }
  }

  const narrativeHeat = extractNumericField(parseText, 'narrative_heat');
  if (narrativeHeat !== undefined && narrativeHeat >= 0 && narrativeHeat <= 10) {
    result.narrativeHeat = narrativeHeat;
  }

  const narrativeRank = extractField(parseText, 'narrative_rank');
  if (narrativeRank) {
    result.narrativeRank = cleanText(narrativeRank);
  }

  // Schelling Position - should be short value like "1st", "2nd", etc.
  // Use narrative_rank as primary source, schelling_position as fallback
  let schellingPosition = extractField(parseText, 'schelling_position');
  if (schellingPosition) {
    schellingPosition = stripFieldLabelPrefix(cleanText(schellingPosition));
    // Validate it's a short, valid position value (not reasoning text)
    if (schellingPosition.length <= 50 && !schellingPosition.includes('.')) {
      result.schellingPosition = schellingPosition;
    } else {
      console.log(`Parser: Rejected long schellingPosition (${schellingPosition.length} chars), using narrativeRank fallback`);
    }
  }
  // If schellingPosition not set or invalid, use narrativeRank
  if (!result.schellingPosition && result.narrativeRank) {
    result.schellingPosition = result.narrativeRank;
    console.log(`Parser: Using narrativeRank "${result.narrativeRank}" as schellingPosition`);
  }

  const equilibriumType = extractField(parseText, 'equilibrium_type');
  if (equilibriumType) {
    result.equilibriumType = cleanText(equilibriumType);
  }

  // Game Theory fields
  const dominantStrategy = extractField(parseText, 'dominant_strategy') || extractField(parseText, 'dominant_strategies');
  if (dominantStrategy && dominantStrategy.length > 2) {
    result.dominantStrategies = cleanText(dominantStrategy);
  }

  const asymmetryFloor = extractField(parseText, 'asymmetry_floor') ||
                         extractField(parseText, 'asymmetry_floor_score') ||
                         extractField(parseText, 'downside_risk');
  if (asymmetryFloor && asymmetryFloor.length > 0) {
    result.asymmetryFloor = extractAsymmetryNumeric(asymmetryFloor);
    console.log(`Parser: Extracted asymmetryFloor: "${result.asymmetryFloor}"`);
  }

  const asymmetryCeiling = extractField(parseText, 'asymmetry_ceiling') ||
                           extractField(parseText, 'asymmetry_ceiling_score') ||
                           extractField(parseText, 'upside_potential');
  if (asymmetryCeiling && asymmetryCeiling.length > 0) {
    result.asymmetryCeiling = extractAsymmetryNumeric(asymmetryCeiling);
    console.log(`Parser: Extracted asymmetryCeiling: "${result.asymmetryCeiling}"`);
  }

  // Project Context (NEW fields)
  const thesis = extractField(parseText, 'thesis');
  if (thesis && thesis.length > 3) {
    result.thesis = stripFieldLabelPrefix(cleanText(thesis));
  }

  // Catalysts (individual fields)
  const catalyst1 = extractField(parseText, 'catalyst_1');
  if (catalyst1 && catalyst1.length > 3) {
    result.catalyst1 = cleanText(catalyst1);
  }
  const catalyst2 = extractField(parseText, 'catalyst_2');
  if (catalyst2 && catalyst2.length > 3) {
    result.catalyst2 = cleanText(catalyst2);
  }
  const catalyst3 = extractField(parseText, 'catalyst_3');
  if (catalyst3 && catalyst3.length > 3) {
    result.catalyst3 = cleanText(catalyst3);
  }

  // Risks (individual fields)
  const risk1 = extractField(parseText, 'risk_1');
  if (risk1 && risk1.length > 3) {
    result.risk1 = cleanText(risk1);
  }
  const risk2 = extractField(parseText, 'risk_2');
  if (risk2 && risk2.length > 3) {
    result.risk2 = cleanText(risk2);
  }
  const risk3 = extractField(parseText, 'risk_3');
  if (risk3 && risk3.length > 3) {
    result.risk3 = cleanText(risk3);
  }

  // Social Signals (NEW) - with reliable new fields and fallbacks
  const xMentionsTrend = extractField(parseText, 'x_mentions_trend');
  if (xMentionsTrend) {
    result.xMentionsTrend = stripFieldLabelPrefix(cleanText(xMentionsTrend));
  }

  const xSentiment = extractField(parseText, 'x_sentiment') || extractField(parseText, 'sentiment');
  if (xSentiment) {
    result.xSentiment = stripFieldLabelPrefix(cleanText(xSentiment));
    console.log(`Parser: Extracted xSentiment: "${result.xSentiment}"`);
  } else {
    console.log(`Parser: xSentiment NOT found in text`);
  }

  // Top KOLs with multiple fallbacks
  const xTopKols = extractField(parseText, 'top_kols')
    || extractField(parseText, 'x_top_kols')
    || extractField(parseText, 'notable_kols');
  // Always normalize KOL value - handles empty, null, and placeholder values
  result.xTopKols = normalizeKolValue(xTopKols ? stripFieldLabelPrefix(cleanText(xTopKols)) : null);
  console.log(`Parser: Extracted xTopKols: "${result.xTopKols}"`);

  // Community Status - new reliable field with fallback to old long field name
  // Extract just the category if value contains additional text
  const communityStatus = extractField(parseText, 'community_status')
    || extractField(parseText, 'community_coordination_active_community_status')
    || extractField(parseText, 'active_community_status');
  if (communityStatus) {
    result.communityStatus = extractCommunityStatusCategory(stripFieldLabelPrefix(communityStatus));
    console.log(`Parser: Extracted communityStatus: "${result.communityStatus}"`);
  }

  // Account Quality - new reliable field with fallback to old long field name
  // Extract just the category if value contains additional text
  const accountQuality = extractField(parseText, 'account_quality')
    || extractField(parseText, 'account_analysis_account_quality_assessment')
    || extractField(parseText, 'account_quality_assessment');
  if (accountQuality) {
    result.accountQuality = extractAccountQualityCategory(stripFieldLabelPrefix(accountQuality));
    console.log(`Parser: Extracted accountQuality: "${result.accountQuality}"`);
  }

  // X Research qualitative fields (NEW - replacing numeric versions)
  const engagementQuality = extractField(parseText, 'engagement_quality')
    || extractField(parseText, 'attention_metrics_engagement_quality');
  if (engagementQuality) {
    result.engagementQuality = cleanText(engagementQuality);
    console.log(`Parser: Extracted engagementQuality: "${result.engagementQuality}"`);
  }

  const overallSentiment = extractField(parseText, 'overall_sentiment')
    || extractField(parseText, 'sentiment_analysis_overall_sentiment');
  if (overallSentiment) {
    result.overallSentiment = cleanText(overallSentiment);
    console.log(`Parser: Extracted overallSentiment: "${result.overallSentiment}"`);
  }

  const cultVsMercenary = extractField(parseText, 'cult_vs_mercenary')
    || extractField(parseText, 'community_coordination_cult_vs_mercenary');
  if (cultVsMercenary) {
    result.cultVsMercenary = cleanText(cultVsMercenary);
    console.log(`Parser: Extracted cultVsMercenary: "${result.cultVsMercenary}"`);
  }

  // X Research flexible format fields (can be numeric OR qualitative)
  // Sentiment ratios
  const sentimentBullishRatio = extractField(parseText, 'sentiment_analysis_overall_sentiment_ratio_bullish')
    || extractField(parseText, 'sentiment_ratio_bullish')
    || extractField(parseText, 'bullish_ratio');
  if (sentimentBullishRatio) {
    result.sentimentBullishRatio = cleanText(sentimentBullishRatio);
    console.log(`Parser: Extracted sentimentBullishRatio: "${result.sentimentBullishRatio}"`);
  }

  const sentimentBearishRatio = extractField(parseText, 'sentiment_analysis_overall_sentiment_ratio_bearish')
    || extractField(parseText, 'sentiment_ratio_bearish')
    || extractField(parseText, 'bearish_ratio');
  if (sentimentBearishRatio) {
    result.sentimentBearishRatio = cleanText(sentimentBearishRatio);
    console.log(`Parser: Extracted sentimentBearishRatio: "${result.sentimentBearishRatio}"`);
  }

  const sentimentNeutralRatio = extractField(parseText, 'sentiment_analysis_overall_sentiment_ratio_neutral')
    || extractField(parseText, 'sentiment_ratio_neutral')
    || extractField(parseText, 'neutral_ratio');
  if (sentimentNeutralRatio) {
    result.sentimentNeutralRatio = cleanText(sentimentNeutralRatio);
    console.log(`Parser: Extracted sentimentNeutralRatio: "${result.sentimentNeutralRatio}"`);
  }

  // Engagement quality details
  const likesPerPostAvg = extractField(parseText, 'attention_metrics_engagement_quality_likes_per_post_average')
    || extractField(parseText, 'likes_per_post_average')
    || extractField(parseText, 'likes_per_post');
  if (likesPerPostAvg) {
    result.likesPerPostAvg = cleanText(likesPerPostAvg);
    console.log(`Parser: Extracted likesPerPostAvg: "${result.likesPerPostAvg}"`);
  }

  const retweetsPerPostAvg = extractField(parseText, 'attention_metrics_engagement_quality_retweets_per_post_average')
    || extractField(parseText, 'retweets_per_post_average')
    || extractField(parseText, 'retweets_per_post');
  if (retweetsPerPostAvg) {
    result.retweetsPerPostAvg = cleanText(retweetsPerPostAvg);
    console.log(`Parser: Extracted retweetsPerPostAvg: "${result.retweetsPerPostAvg}"`);
  }

  const repliesPerPostAvg = extractField(parseText, 'attention_metrics_engagement_quality_replies_per_post_average')
    || extractField(parseText, 'replies_per_post_average')
    || extractField(parseText, 'replies_per_post');
  if (repliesPerPostAvg) {
    result.repliesPerPostAvg = cleanText(repliesPerPostAvg);
    console.log(`Parser: Extracted repliesPerPostAvg: "${result.repliesPerPostAvg}"`);
  }

  // Cult/Mercenary ratio (flexible format)
  const cultMercenaryRatio = extractField(parseText, 'community_coordination_cult_vs_mercenary_ratio')
    || extractField(parseText, 'cult_mercenary_ratio');
  if (cultMercenaryRatio) {
    result.cultMercenaryRatio = cleanText(cultMercenaryRatio);
    console.log(`Parser: Extracted cultMercenaryRatio: "${result.cultMercenaryRatio}"`);
  }

  // Sample size (flexible format)
  const sentimentSampleSize = extractField(parseText, 'sentiment_analysis_sample_size_of_posts_analyzed')
    || extractField(parseText, 'sample_size_of_posts_analyzed')
    || extractField(parseText, 'sample_size');
  if (sentimentSampleSize) {
    result.sentimentSampleSize = cleanText(sentimentSampleSize);
    console.log(`Parser: Extracted sentimentSampleSize: "${result.sentimentSampleSize}"`);
  }

  // Upside Assessment (from Stage 4)
  const currentFdv = extractField(parseText, 'current_fdv');
  if (currentFdv) {
    result.currentFdv = cleanFdvValue(cleanText(currentFdv));
    console.log(`Parser: Extracted currentFdv: "${result.currentFdv}"`);
  }

  const realisticPeakFdv = extractField(parseText, 'realistic_peak_fdv');
  if (realisticPeakFdv) {
    result.realisticPeakFdv = cleanFdvValue(cleanText(realisticPeakFdv));
    console.log(`Parser: Extracted realisticPeakFdv: "${result.realisticPeakFdv}"`);
  }

  const upsideMultiple = extractField(parseText, 'upside_multiple');
  if (upsideMultiple) {
    result.upsideMultiple = cleanUpsideMultiple(cleanText(upsideMultiple));
    console.log(`Parser: Extracted upsideMultiple: "${result.upsideMultiple}"`);
  }

  const upsideTier = extractField(parseText, 'upside_tier');
  if (upsideTier) {
    result.upsideTier = cleanText(upsideTier);
    console.log(`Parser: Extracted upsideTier: "${result.upsideTier}"`);
  }

  // New Stage 4 fields
  const narrativeDurability = extractField(parseText, 'narrative_durability');
  if (narrativeDurability) {
    result.narrativeDurability = cleanText(narrativeDurability);
    console.log(`Parser: Extracted narrativeDurability: "${result.narrativeDurability}"`);
  }

  const kolMentionRecency = extractField(parseText, 'kol_mention_recency');
  if (kolMentionRecency) {
    result.kolMentionRecency = cleanText(kolMentionRecency);
    console.log(`Parser: Extracted kolMentionRecency: "${result.kolMentionRecency}"`);
  }

  const distributionWarning = extractField(parseText, 'divergence_check_distribution_warning')
    || extractField(parseText, 'distribution_warning');
  if (distributionWarning) {
    const cleanedWarning = cleanText(distributionWarning);
    // Only store if it's the actual signal detection
    if (cleanedWarning.toUpperCase().includes('DISTRIBUTION') && cleanedWarning.toUpperCase().includes('DETECTED')) {
      result.distributionWarning = 'DISTRIBUTION SIGNAL DETECTED';
      console.log(`Parser: Extracted distributionWarning: DISTRIBUTION SIGNAL DETECTED`);
    } else {
      result.distributionWarning = cleanedWarning;
      console.log(`Parser: Extracted distributionWarning: "${cleanedWarning}"`);
    }
  }

  // Score calculation (LLM arithmetic work for verification)
  const scoreCalculation = extractField(parseText, 'score_calculation');
  if (scoreCalculation) {
    // Store the raw calculation string - don't clean it as it contains arithmetic
    result.scoreCalculation = scoreCalculation.trim();
    console.log(`Parser: Extracted scoreCalculation: "${result.scoreCalculation}"`);
  }

  // Team/Project Info (NEW)
  const unlockWarning = extractField(parseText, 'unlock_warning');
  if (unlockWarning) {
    result.unlockWarning = cleanText(unlockWarning);
  }

  const teamStatus = extractField(parseText, 'team_status');
  if (teamStatus) {
    result.teamStatus = cleanText(teamStatus);
  }

  const notableBackers = extractField(parseText, 'notable_backers');
  if (notableBackers) {
    result.notableBackers = cleanText(notableBackers);
  }

  // Model Scores
  const gptScore = extractNumericField(parseText, 'gpt_score');
  if (gptScore !== undefined) result.modelScores.gpt = gptScore;

  const claudeScore = extractNumericField(parseText, 'claude_score');
  if (claudeScore !== undefined) result.modelScores.claude = claudeScore;

  const geminiScore = extractNumericField(parseText, 'gemini_score');
  if (geminiScore !== undefined) result.modelScores.gemini = geminiScore;

  const grokScore = extractNumericField(parseText, 'grok_score');
  if (grokScore !== undefined) result.modelScores.grok = grokScore;

  const modelAgreement = extractField(parseText, 'model_agreement');
  if (modelAgreement) {
    result.modelAgreement = cleanText(modelAgreement);
  }

  // Model divergence metrics (NEW)
  const scoreSpread = extractNumericField(parseText, 'score_spread');
  if (scoreSpread !== undefined) {
    result.scoreSpread = scoreSpread;
    console.log(`Parser: Extracted scoreSpread: ${result.scoreSpread}`);
  }

  const divergenceFlag = extractField(parseText, 'divergence_flag');
  if (divergenceFlag) {
    const flag = cleanText(divergenceFlag).toUpperCase();
    if (['HIGH', 'MODERATE', 'LOW'].includes(flag)) {
      result.divergenceFlag = flag;
      console.log(`Parser: Extracted divergenceFlag: ${result.divergenceFlag}`);
    }
  }

  const divergenceNote = extractField(parseText, 'divergence_note');
  if (divergenceNote) {
    result.divergenceNote = cleanText(divergenceNote);
    console.log(`Parser: Extracted divergenceNote: "${result.divergenceNote}"`);
  }

  // Model Analysis - verdict, reasoning, and risks for each model
  // Helper to parse comma-separated risks into array
  const parseRisksString = (risksStr: string): string[] => {
    if (!risksStr) return [];
    return risksStr.split(',').map(r => r.trim()).filter(r => r.length > 0);
  };

  // GPT Analysis
  const gptVerdict = extractField(parseText, 'gpt_verdict');
  const gptReasoning = extractField(parseText, 'gpt_reasoning');
  const gptRisks = extractField(parseText, 'gpt_risks');
  console.log(`Parser: GPT analysis fields - verdict: ${gptVerdict ? 'found' : 'missing'}, reasoning: ${gptReasoning ? 'found' : 'missing'}, risks: ${gptRisks ? 'found' : 'missing'}`);
  if (gptScore !== undefined || gptVerdict || gptReasoning) {
    result.modelAnalyses.gpt = {
      score: gptScore ?? 0,
      verdict: gptVerdict ? cleanText(gptVerdict) : undefined,
      reasoning: gptReasoning ? cleanTextPreserveStructure(gptReasoning) : undefined,
      risks: gptRisks ? parseRisksString(gptRisks) : undefined,
    };
  }

  // Claude Analysis
  const claudeVerdict = extractField(parseText, 'claude_verdict');
  const claudeReasoning = extractField(parseText, 'claude_reasoning');
  const claudeRisks = extractField(parseText, 'claude_risks');
  if (claudeScore !== undefined || claudeVerdict || claudeReasoning) {
    result.modelAnalyses.claude = {
      score: claudeScore ?? 0,
      verdict: claudeVerdict ? cleanText(claudeVerdict) : undefined,
      reasoning: claudeReasoning ? cleanTextPreserveStructure(claudeReasoning) : undefined,
      risks: claudeRisks ? parseRisksString(claudeRisks) : undefined,
    };
  }

  // Gemini Analysis
  const geminiVerdict = extractField(parseText, 'gemini_verdict');
  const geminiReasoning = extractField(parseText, 'gemini_reasoning');
  const geminiRisks = extractField(parseText, 'gemini_risks');
  if (geminiScore !== undefined || geminiVerdict || geminiReasoning) {
    result.modelAnalyses.gemini = {
      score: geminiScore ?? 0,
      verdict: geminiVerdict ? cleanText(geminiVerdict) : undefined,
      reasoning: geminiReasoning ? cleanTextPreserveStructure(geminiReasoning) : undefined,
      risks: geminiRisks ? parseRisksString(geminiRisks) : undefined,
    };
  }

  // Grok Analysis
  const grokVerdict = extractField(parseText, 'grok_verdict');
  const grokReasoning = extractField(parseText, 'grok_reasoning');
  const grokRisks = extractField(parseText, 'grok_risks');
  if (grokScore !== undefined || grokVerdict || grokReasoning) {
    result.modelAnalyses.grok = {
      score: grokScore ?? 0,
      verdict: grokVerdict ? cleanText(grokVerdict) : undefined,
      reasoning: grokReasoning ? cleanTextPreserveStructure(grokReasoning) : undefined,
      risks: grokRisks ? parseRisksString(grokRisks) : undefined,
    };
  }

  // Risks array (from individual fields or legacy)
  const risks: string[] = [];
  if (result.risk1) risks.push(result.risk1);
  if (result.risk2) risks.push(result.risk2);
  if (result.risk3) risks.push(result.risk3);
  if (risks.length === 0) {
    for (let i = 1; i <= 3; i++) {
      const risk = extractField(parseText, `risk_${i}`);
      if (risk && risk.length > 3) {
        risks.push(cleanText(risk));
      }
    }
  }
  if (risks.length > 0) {
    result.coordinationRisks = risks;
  }

  // Catalysts array (from individual fields or legacy)
  const catalysts: string[] = [];
  if (result.catalyst1) catalysts.push(result.catalyst1);
  if (result.catalyst2) catalysts.push(result.catalyst2);
  if (result.catalyst3) catalysts.push(result.catalyst3);
  if (catalysts.length === 0) {
    for (let i = 1; i <= 3; i++) {
      const catalyst = extractField(parseText, `catalyst_${i}`);
      if (catalyst && catalyst.length > 3) {
        catalysts.push(cleanText(catalyst));
      }
    }
  }
  if (catalysts.length > 0) {
    result.catalysts = catalysts;
  }

  // Display Text
  const displaySummary = extractField(parseText, 'display_summary');
  if (displaySummary) {
    result.displaySummary = stripFieldLabelPrefix(cleanText(displaySummary));
  }

  const verdict = extractField(parseText, 'verdict');
  if (verdict) {
    result.verdict = cleanText(verdict);
  }

  const reasoning = extractField(parseText, 'reasoning');
  if (reasoning) {
    result.reasoning = cleanTextPreserveStructure(reasoning);
  }
}

// Extract model scores from various formats (legacy support)
function extractModelScores(text: string): ModelScores {
  const scores: ModelScores = {};

  const deliberatedSection = text.match(/DELIBERATED SCORES[\s\S]*?(?=##|$)/i);
  const searchText = deliberatedSection ? deliberatedSection[0] : text;

  const patterns = [
    { key: 'gpt' as const, regex: /(?:ChatGPT|GPT-?4o?)[^|]*\|\s*([\d.]+)/i },
    { key: 'claude' as const, regex: /Claude[^|]*\|\s*([\d.]+)/i },
    { key: 'gemini' as const, regex: /Gemini[^|]*\|\s*([\d.]+)/i },
    { key: 'grok' as const, regex: /Grok[^|]*\|\s*([\d.]+)/i },
  ];

  for (const { key, regex } of patterns) {
    const match = searchText.match(regex);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        scores[key] = num;
      }
    }
  }

  return scores;
}

// Extract section content between headers
function extractSection(text: string, startPattern: RegExp, endPatterns: RegExp[] = [/^##/m, /^---/m]): string {
  const startMatch = text.match(startPattern);
  if (!startMatch) return "";

  const startIndex = startMatch.index! + startMatch[0].length;
  let endIndex = text.length;

  for (const endPattern of endPatterns) {
    const restText = text.slice(startIndex);
    const endMatch = restText.match(endPattern);
    if (endMatch && endMatch.index !== undefined) {
      endIndex = Math.min(endIndex, startIndex + endMatch.index);
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

// Extract risks from the text (legacy support)
function extractRisks(text: string): string[] {
  const risks: string[] = [];

  const riskSection = extractSection(text, /(?:SYNTHESIZED RISKS|TOP RISKS|KEY RISKS|RISKS)\s*/i);

  if (riskSection) {
    const tableRisks = Array.from(riskSection.matchAll(/\|\s*\d+\s*\|\s*\*\*([^*|]+)\*\*/g));
    for (const match of tableRisks) {
      if (match[1]) risks.push(cleanText(match[1]));
    }

    if (risks.length === 0) {
      const numberedRisks = Array.from(riskSection.matchAll(/^\d+\.\s*\*\*([^*:]+)\*\*/gm));
      for (const match of numberedRisks) {
        if (match[1]) risks.push(cleanText(match[1]));
      }
    }

    if (risks.length === 0) {
      const dashRisks = Array.from(riskSection.matchAll(/^-\s+([^\n]+)/gm));
      for (const match of dashRisks) {
        if (match[1] && !match[1].startsWith('**')) {
          risks.push(cleanText(match[1]));
        }
      }
    }
  }

  return Array.from(new Set(risks)).slice(0, 5);
}

// Extract catalysts/agreements (legacy support)
function extractCatalysts(text: string): string[] {
  const catalysts: string[] = [];

  const catalystSection = extractSection(text, /(?:UNIVERSAL AGREEMENTS|KEY AGREEMENTS|CATALYSTS|BULLISH FACTORS)\s*/i);

  if (catalystSection) {
    const numbered = Array.from(catalystSection.matchAll(/^\d+\.\s*\*\*([^*:]+)\*\*/gm));
    for (const match of numbered) {
      if (match[1]) catalysts.push(cleanText(match[1]));
    }

    if (catalysts.length === 0) {
      const dashes = Array.from(catalystSection.matchAll(/^-\s+([^\n]+)/gm));
      for (const match of dashes) {
        if (match[1]) catalysts.push(cleanText(match[1]));
      }
    }
  }

  return Array.from(new Set(catalysts)).slice(0, 5);
}

// Legacy parser for older format responses
// NOTE: This function should only FILL IN missing values, not overwrite already-set ones
function parseLegacyFormat(rawText: string, result: ParsedGumloopResponse): void {
  // FINAL SCORE - only if not already set by parseStructuredOutput
  if (!result.finalScore || result.finalScore === 0) {
    const scorePatterns = [
      /\*\*FINAL SCORE\*\*\s*\|\s*\*\*(\d+\.?\d*)/i,
      /FINAL\s*SCORE[^\d]*(\d+\.?\d*)/i,
      /Final\s*Score[:\s|]+(\d+\.?\d*)/i,
      /\|\s*FINAL\s*SCORE\s*\|\s*\*?\*?(\d+\.?\d*)/i,
    ];
    for (const pattern of scorePatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          result.finalScore = num;
          break;
        }
      }
    }
  }

  // TIER - only if not already set
  if (!result.tier || result.tier === '') {
    const tierPatterns = [
      /\*\*FINAL\s*TIER\*\*\s*\|\s*\*\*([A-Z+]+)/i,
      /FINAL\s*TIER[:\s|]+\*?\*?([A-Z+]+)/i,
      /\|\s*TIER\s*\|\s*\*?\*?([A-Z+]+)/i,
    ];
    for (const pattern of tierPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const tier = match[1].replace(/\*/g, '').trim().toUpperCase();
        if (['S+', 'S', 'A', 'B', 'C'].includes(tier)) {
          result.tier = tier;
          break;
        }
      }
    }
  }

  // PHASE
  const phasePatterns = [
    /\*\*PHASE\*\*\s*\|\s*\*\*(\d+)\s*\(([^)]+)\)/i,
    /PHASE[:\s|]+\*?\*?(\d+)\s*\(([^)]+)\)/i,
    /Phase[:\s]*(\d+)/i,
  ];
  for (const pattern of phasePatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        result.phase = num;
        if (match[2]) result.phaseName = cleanText(match[2]);
        break;
      }
    }
  }

  // Phase name fallback
  if (!result.phaseName || result.phaseName === 'Expansion') {
    const phaseNames = ['Stealth', 'Expansion', 'Mania', 'Distribution', 'Dead'];
    if (result.phase >= 1 && result.phase <= 5) {
      result.phaseName = phaseNames[result.phase - 1];
    }
  }

  // CONSENSUS
  const consensusMatch = rawText.match(/CONSENSUS[:\s|]+\*?\*?([A-Z]+)/i);
  if (consensusMatch) {
    const level = consensusMatch[1].toUpperCase();
    if (['HIGH', 'MIXED', 'LOW', 'CONFLICTED'].includes(level)) {
      result.consensusLevel = level;
    }
  }

  // CONFIDENCE
  const confMatch = rawText.match(/CONFIDENCE[:\s|]+\*?\*?([HML])/i);
  if (confMatch) {
    result.confidence = confMatch[1].toUpperCase();
  }

  // WINNING SIDE / EXIT LIQUIDITY
  const exitMatch = rawText.match(/(?:EXIT\s*LIQUIDITY|Winning\s*Side)[:\s|]+\*?\*?([^\n|]+)/i);
  if (exitMatch) {
    const val = exitMatch[1].toUpperCase();
    if (val.includes('USER') || val.includes('FAVORABLE')) result.winningSide = 'USER';
    else if (val.includes('EXIT') || val.includes('LIQ')) result.winningSide = 'EXIT_LIQ';
  }

  // RECOMMENDATION
  const recMatch = rawText.match(/RECOMMENDATION[:\s|]+\*?\*?([^\n|]+)/i);
  if (recMatch) {
    const rec = recMatch[1].toUpperCase();
    if (rec.includes('BUY')) result.recommendation = 'BUY';
    else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
  }

  // NARRATIVE (multiple patterns)
  if (!result.narrative) {
    const narrativePatterns = [
      /["']([A-Z][a-zA-Z]+(?:\s+(?:on|for|in|and)\s+[A-Z][a-zA-Z]+)+)["']/,
      /coordination\s*game\s*(?:around|for)\s*(?:the\s*)?["']([^"']+)["']/i,
      /Primary\s*Narrative[:\s]*["']?([^"'\n|]+)/i,
      /\|\s*Narrative\s*\|\s*([^|]+)\|/i,
      /(?:narrative|thesis)[:\s]*["']([^"']+)["']/i,
    ];
    for (const pattern of narrativePatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const narrative = stripFieldLabelPrefix(cleanText(match[1]));
        if (narrative.length > 3 && narrative.length < 60 &&
            !narrative.includes('AT_RISK') && !narrative.includes('USER') &&
            !isFieldNameAsValue(narrative)) {
          result.narrative = narrative;
          break;
        }
      }
    }
  }

  // NARRATIVE HEAT
  if (result.narrativeHeat === undefined) {
    const heatMatch = rawText.match(/(?:Narrative\s*)?Heat[:\s]*(\d+\.?\d*)(?:\/10)?/i);
    if (heatMatch) {
      const heat = parseFloat(heatMatch[1]);
      if (!isNaN(heat) && heat >= 0 && heat <= 10) {
        result.narrativeHeat = heat;
      }
    }
  }

  // PEAK PROXIMITY
  if (result.peakProximity === undefined) {
    const peakPatterns = [
      /Peak\s*Proximity[:\s]*(\d+\.?\d*)\s*%?/i,
      /(\d+\.?\d*)\s*%\s*(?:from|to)\s*(?:ATH|peak)/i,
    ];
    for (const pattern of peakPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const peak = parseFloat(match[1]);
        if (!isNaN(peak) && peak >= 0 && peak <= 100) {
          result.peakProximity = peak;
          break;
        }
      }
    }
  }

  // COMPONENT SCORES (legacy extraction)
  if (!result.coordinationScore) {
    result.coordinationScore = extractNumber(rawText, 'Coordination');
  }
  if (!result.schellingRankScore) {
    result.schellingRankScore = extractNumber(rawText, 'Schelling');
  }
  if (!result.reflexivityScore) {
    result.reflexivityScore = extractNumber(rawText, 'Reflexivity');
  }
  if (!result.viralityScore) {
    result.viralityScore = extractNumber(rawText, 'Virality');
  }
  if (!result.asymmetryScore) {
    result.asymmetryScore = extractNumber(rawText, 'Asymmetry');
  }
  if (!result.gameTheoryBonus) {
    result.gameTheoryBonus = extractNumber(rawText, 'Game\\s*Theory');
  }

  // MODIFIERS (legacy)
  if (result.phaseModifier === undefined) {
    const phaseModMatch = rawText.match(/Phase(?:\s*Modifier)?[:\s]*([+-]?\d+\.?\d*)/i);
    if (phaseModMatch) result.phaseModifier = parseFloat(phaseModMatch[1]);
  }
  if (result.narrativeModifier === undefined) {
    const narrativeModMatch = rawText.match(/Narrative(?:\s*Modifier)?[:\s]*([+-]?\d+\.?\d*)/i);
    if (narrativeModMatch) result.narrativeModifier = parseFloat(narrativeModMatch[1]);
  }

  // MODEL SCORES (legacy)
  if (Object.keys(result.modelScores).length === 0) {
    result.modelScores = extractModelScores(rawText);
  }

  // RISKS AND CATALYSTS (legacy)
  if (!result.coordinationRisks || result.coordinationRisks.length === 0) {
    result.coordinationRisks = extractRisks(rawText);
  }
  if (!result.catalysts || result.catalysts.length === 0) {
    result.catalysts = extractCatalysts(rawText);
  }

  // VERDICT/REASONING (legacy)
  if (!result.verdict) {
    const verdictSection = rawText.match(/FINAL\s*VERDICT[\s\S]*?(?=---|\n##|$)/i);
    if (verdictSection) {
      result.verdict = cleanTextPreserveStructure(
        verdictSection[0].replace(/^.*FINAL\s*VERDICT[:\s]*/i, '')
      );
    }
  }
  if (!result.reasoning) {
    const reasoningSection = rawText.match(/REASONING[\s\S]*?(?=##|---|\n\n\n|$)/i);
    if (reasoningSection) {
      result.reasoning = cleanTextPreserveStructure(
        reasoningSection[0].replace(/^.*REASONING[:\s]*/i, '')
      );
    }
  }

  // GAME THEORY (legacy/fallback)
  if (!result.equilibriumType) {
    const eqMatch = rawText.match(/Equilibrium(?:\s*Type)?[:\s]*([^\n|]+)/i);
    if (eqMatch) result.equilibriumType = cleanText(eqMatch[1]);
  }
  if (!result.dominantStrategies) {
    const stratMatch = rawText.match(/Dominant\s*Strateg(?:y|ies)[:\s]*([^\n|]+)/i);
    if (stratMatch) result.dominantStrategies = cleanText(stratMatch[1]);
  }
  if (!result.schellingPosition) {
    const schellingMatch = rawText.match(/Schelling\s*(?:Point|Position|Focal)[:\s]*([^\n|]+)/i);
    if (schellingMatch) {
      const value = stripFieldLabelPrefix(cleanText(schellingMatch[1]));
      // Only use if it's a short, valid value
      if (value.length <= 50 && !value.includes('.')) {
        result.schellingPosition = value;
      }
    }
    // If still no schellingPosition, use narrativeRank
    if (!result.schellingPosition && result.narrativeRank) {
      result.schellingPosition = result.narrativeRank;
    }
  }
  if (!result.asymmetryFloor) {
    const floorMatch = rawText.match(/(?:Downside|Floor|Risk)[:\s]*(-?\d+(?:\.\d+)?)/i);
    if (floorMatch) result.asymmetryFloor = floorMatch[1];
  }
  if (!result.asymmetryCeiling) {
    const ceilingMatch = rawText.match(/(?:Upside|Ceiling|Potential)[:\s]*(\+?\d+(?:\.\d+)?)/i);
    if (ceilingMatch) result.asymmetryCeiling = ceilingMatch[1].replace(/^\+/, '');
  }
}

// Calculate tier from final score
function calculateTierFromScore(score: number): string {
  if (score >= 85) return 'S+';
  if (score >= 70) return 'S';
  if (score >= 55) return 'A';
  if (score >= 40) return 'B';
  return 'C';
}

// Main parser function
export function parseGumloopResponse(rawText: string): ParsedGumloopResponse {
  const result: ParsedGumloopResponse = {
    finalScore: 0,
    tier: '', // Will be calculated from score if not parsed
    phase: 2,
    phaseName: 'Expansion',
    winningSide: 'AT_RISK',
    consensusLevel: 'MIXED',
    confidence: 'M',
    recommendation: 'HOLD',
    modelScores: {},
    modelAnalyses: {},
  };

  if (!rawText || rawText.length < 100) {
    // Calculate tier from default score
    result.tier = calculateTierFromScore(result.finalScore);
    return result;
  }

  // Sanitize field names by stripping asterisks (e.g., **final_score:** -> final_score:)
  const sanitizedText = sanitizeFieldText(rawText);

  try {
    // ==================== PRIMARY STRATEGY: Parse OUTPUT SUMMARY section ====================
    // The OUTPUT SUMMARY section uses a consistent field_name: value format
    const summarySection = extractOutputSummarySection(sanitizedText);
    let summaryMap: Map<string, string> | null = null;

    if (summarySection) {
      summaryMap = parseOutputSummaryToMap(summarySection);
      console.log(`Parser: OUTPUT SUMMARY found with ${summaryMap.size} fields`);

      // Extract primary fields from OUTPUT SUMMARY (most reliable)
      const summaryScore = getNumberFromMap(summaryMap, 'final_score');
      if (summaryScore !== null && summaryScore >= 0 && summaryScore <= 100) {
        result.finalScore = summaryScore;
        console.log(`Parser: Got final_score from OUTPUT SUMMARY: ${summaryScore}`);
      }

      const summaryTier = getStringFromMap(summaryMap, 'final_tier');
      if (summaryTier) {
        const cleanTier = summaryTier.toUpperCase().replace(/[^A-Z+]/g, '');
        if (['S+', 'S', 'A', 'B', 'C'].includes(cleanTier)) {
          result.tier = cleanTier;
        }
      }

      const summaryNarrative = getStringFromMap(summaryMap, 'narrative');
      if (summaryNarrative && summaryNarrative.length > 2 && summaryNarrative.length < 100) {
        const cleanedNarrative = stripFieldLabelPrefix(summaryNarrative);
        // IMPORTANT: Reject if the value is actually a field name (malformed output)
        if (!isFieldNameAsValue(cleanedNarrative)) {
          result.narrative = cleanedNarrative;
          console.log(`Parser: Got narrative from OUTPUT SUMMARY: ${result.narrative}`);
        } else {
          console.log(`Parser: Rejecting narrative value "${cleanedNarrative}" - it's a field name, not a valid value`);
        }
      }

      const summaryTokenType = getStringFromMap(summaryMap, 'token_type');
      if (summaryTokenType) {
        const cleanType = summaryTokenType.toUpperCase();
        result.tokenType = cleanType.includes('MEME') ? 'MEMECOIN' : 'UTILITY';
      }

      const summaryPhase = getNumberFromMap(summaryMap, 'phase');
      if (summaryPhase !== null && summaryPhase >= 1 && summaryPhase <= 5) {
        result.phase = summaryPhase;
      }

      const summaryPhaseName = getStringFromMap(summaryMap, 'phase_name');
      if (summaryPhaseName) {
        result.phaseName = summaryPhaseName;
      }

      const summaryWinningSide = getStringFromMap(summaryMap, 'winning_side');
      if (summaryWinningSide) {
        const side = summaryWinningSide.toUpperCase();
        if (side.includes('USER')) result.winningSide = 'USER';
        else if (side.includes('EXIT') || side.includes('LIQ')) result.winningSide = 'EXIT_LIQ';
        else result.winningSide = 'AT_RISK';
      }

      const summaryConsensus = getStringFromMap(summaryMap, 'consensus_level');
      if (summaryConsensus) {
        const level = summaryConsensus.toUpperCase();
        if (['HIGH', 'MIXED', 'LOW', 'CONFLICTED'].includes(level)) {
          result.consensusLevel = level;
        }
      }

      const summaryConfidence = getStringFromMap(summaryMap, 'confidence');
      if (summaryConfidence) {
        const conf = summaryConfidence.toUpperCase().charAt(0);
        if (['H', 'M', 'L'].includes(conf)) {
          result.confidence = conf;
        }
      }

      const summaryRec = getStringFromMap(summaryMap, 'recommendation');
      if (summaryRec) {
        const rec = summaryRec.toUpperCase();
        if (rec.includes('BUY') || rec.includes('STRONG')) result.recommendation = 'BUY';
        else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
        else result.recommendation = 'HOLD';
      }

      // Component scores from OUTPUT SUMMARY
      const summaryCoord = getNumberFromMap(summaryMap, 'coordination_score');
      if (summaryCoord !== null) result.coordinationScore = summaryCoord;

      const summarySchelling = getNumberFromMap(summaryMap, 'schelling_score');
      if (summarySchelling !== null) result.schellingRankScore = summarySchelling;

      const summaryReflex = getNumberFromMap(summaryMap, 'reflexivity_score');
      if (summaryReflex !== null) result.reflexivityScore = summaryReflex;

      const summaryViral = getNumberFromMap(summaryMap, 'virality_score');
      if (summaryViral !== null) result.viralityScore = summaryViral;

      const summaryAsym = getNumberFromMap(summaryMap, 'asymmetry_score');
      if (summaryAsym !== null) result.asymmetryScore = summaryAsym;

      const summaryGT = getNumberFromMap(summaryMap, 'game_theory_score');
      if (summaryGT !== null) result.gameTheoryBonus = summaryGT;

      // Other fields from OUTPUT SUMMARY
      const summaryThesis = getStringFromMap(summaryMap, 'thesis');
      if (summaryThesis) result.thesis = stripFieldLabelPrefix(summaryThesis);

      const summaryVerdict = getStringFromMap(summaryMap, 'verdict');
      if (summaryVerdict) result.verdict = summaryVerdict;

      const summaryReasoning = getStringFromMap(summaryMap, 'reasoning');
      if (summaryReasoning) result.reasoning = summaryReasoning;

      const summaryNarrativeHeat = getNumberFromMap(summaryMap, 'narrative_heat');
      if (summaryNarrativeHeat !== null) result.narrativeHeat = summaryNarrativeHeat;

      // Sub-narrative fields from OUTPUT SUMMARY
      const summaryPrimaryNarrative = getStringFromMap(summaryMap, 'primary_narrative');
      if (summaryPrimaryNarrative && summaryPrimaryNarrative.length > 2 && summaryPrimaryNarrative.length < 100) {
        result.primaryNarrative = stripFieldLabelPrefix(summaryPrimaryNarrative);
        console.log(`Parser: Got primary_narrative from OUTPUT SUMMARY: ${result.primaryNarrative}`);
      }

      const summarySubNarrative = getStringFromMap(summaryMap, 'sub_narrative');
      if (summarySubNarrative && summarySubNarrative.length > 2 && summarySubNarrative.length < 150) {
        result.subNarrative = stripFieldLabelPrefix(summarySubNarrative);
        console.log(`Parser: Got sub_narrative from OUTPUT SUMMARY: ${result.subNarrative}`);
      }

      const summarySubNarrativeCeiling = getStringFromMap(summaryMap, 'sub_narrative_ceiling');
      if (summarySubNarrativeCeiling) {
        result.subNarrativeCeiling = stripFieldLabelPrefix(summarySubNarrativeCeiling);
        console.log(`Parser: Got sub_narrative_ceiling from OUTPUT SUMMARY: ${result.subNarrativeCeiling}`);
      }

      const summarySubNarrativeConsensus = getStringFromMap(summaryMap, 'sub_narrative_consensus');
      if (summarySubNarrativeConsensus) {
        result.subNarrativeConsensus = stripFieldLabelPrefix(summarySubNarrativeConsensus);
        console.log(`Parser: Got sub_narrative_consensus from OUTPUT SUMMARY: ${result.subNarrativeConsensus}`);
      }

      const summaryPeakProx = getNumberFromMap(summaryMap, 'peak_proximity_pct');
      if (summaryPeakProx !== null) result.peakProximity = summaryPeakProx;

      // Model scores
      const gptScore = getNumberFromMap(summaryMap, 'gpt_score');
      if (gptScore !== null) result.modelScores.gpt = gptScore;

      const claudeScore = getNumberFromMap(summaryMap, 'claude_score');
      if (claudeScore !== null) result.modelScores.claude = claudeScore;

      const geminiScore = getNumberFromMap(summaryMap, 'gemini_score');
      if (geminiScore !== null) result.modelScores.gemini = geminiScore;

      const grokScore = getNumberFromMap(summaryMap, 'grok_score');
      if (grokScore !== null) result.modelScores.grok = grokScore;
    } else {
      console.log(`Parser: No OUTPUT SUMMARY section found, using fallback parsing`);
    }

    // ==================== FALLBACK: Pattern matching for missing fields ====================
    // Use existing parsers to fill in any fields not found in OUTPUT SUMMARY

    // If final score not found in OUTPUT SUMMARY, try dedicated extraction
    if (!result.finalScore || result.finalScore === 0) {
      const patternScore = extractFinalScoreField(rawText);
      if (patternScore !== null) {
        result.finalScore = patternScore;
        console.log(`Parser: Got final_score from pattern matching: ${patternScore}`);
      }
    }

    // Fill in remaining fields with structured output parser (using sanitized text)
    parseStructuredOutput(sanitizedText, result);

    // Log parsed narrative for debugging
    console.log(`Parser: After parseStructuredOutput - narrative: "${result.narrative || 'undefined'}"`);

    // Then, fill in any missing fields with legacy parsing (using sanitized text)
    parseLegacyFormat(sanitizedText, result);

    // Log after legacy parsing
    console.log(`Parser: After parseLegacyFormat - narrative: "${result.narrative || 'undefined'}"`);
    console.log(`Parser: Final values - score: ${result.finalScore}, tier: ${result.tier}, narrative: "${result.narrative || 'undefined'}"`);
    console.log(`Parser: Model analyses captured: ${Object.keys(result.modelAnalyses).join(', ') || 'none'}`);
    if (Object.keys(result.modelAnalyses).length > 0) {
      for (const [model, analysis] of Object.entries(result.modelAnalyses)) {
        console.log(`Parser: ${model} - score: ${analysis.score}, verdict: ${analysis.verdict ? 'yes' : 'no'}, reasoning: ${analysis.reasoning ? 'yes' : 'no'}, risks: ${analysis.risks?.length || 0}`);
      }
    }

    // Calculate tier from score if not parsed successfully
    if (!result.tier || result.tier === '') {
      result.tier = calculateTierFromScore(result.finalScore);
    }

    // Calculate missing component scores if we have a final score but missing components
    // Component weights: Coordination 20, Schelling 10, Reflexivity 15, Virality 15, Asymmetry 25, Game Theory 15
    if (result.finalScore > 0) {
      const base = result.finalScore;
      if (!result.coordinationScore) result.coordinationScore = Math.round(base * 0.2 * 10) / 10;
      if (!result.schellingRankScore) result.schellingRankScore = Math.round(base * 0.10 * 10) / 10;
      if (!result.reflexivityScore) result.reflexivityScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.viralityScore) result.viralityScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.asymmetryScore) result.asymmetryScore = Math.round(base * 0.25 * 10) / 10;
      if (!result.gameTheoryBonus) result.gameTheoryBonus = Math.round(base * 0.15 * 10) / 10;
    }

    // Use display_summary as-is if present, otherwise try verdict/reasoning
    // Do NOT generate generic fallback text - let UI show "Summary not available"
    if (!result.displaySummary) {
      let summary = result.verdict || result.reasoning || "";
      const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        summary = sentences.slice(0, 3).join(' ').trim();
      }
      summary = summary.replace(/^[:\s\-–—]+/, '').trim();

      // Only use if we have meaningful content (not generic)
      if (summary && summary.length >= 50) {
        result.displaySummary = summary;
      }
      // Otherwise leave displaySummary undefined - UI will show "Summary not available"
    }

    // FINAL FALLBACK: If schellingPosition not set, use narrativeRank
    if (!result.schellingPosition && result.narrativeRank) {
      result.schellingPosition = result.narrativeRank;
      console.log(`Parser: Using narrativeRank "${result.narrativeRank}" as schellingPosition fallback`);
    }

    // NARRATIVE SECTION EXTRACTION: Try to extract from ## NARRATIVE: markdown section
    // This handles Gumloop outputs where primary_narrative and sub_narrative are in a dedicated section
    if (!result.subNarrative || !result.primaryNarrative) {
      const narrativeSectionFields = extractNarrativeSectionFields(rawText);
      if (narrativeSectionFields.primaryNarrative && !result.primaryNarrative) {
        result.primaryNarrative = narrativeSectionFields.primaryNarrative;
        console.log(`Parser: Got primaryNarrative from NARRATIVE section: "${result.primaryNarrative}"`);
      }
      if (narrativeSectionFields.subNarrative && !result.subNarrative) {
        result.subNarrative = narrativeSectionFields.subNarrative;
        console.log(`Parser: Got subNarrative from NARRATIVE section: "${result.subNarrative}"`);
      }
    }

    // SUB-NARRATIVE FALLBACK LOGIC
    // If sub_narrative is missing but we have narrative, use narrative as sub_narrative
    if (!result.subNarrative && result.narrative) {
      result.subNarrative = result.narrative;
      console.log(`Parser: Using narrative "${result.narrative}" as subNarrative fallback`);
    }

    // If primary_narrative is missing, derive from sub_narrative (text before "/" or full value)
    if (!result.primaryNarrative && result.subNarrative) {
      const slashIndex = result.subNarrative.indexOf('/');
      if (slashIndex > 0) {
        result.primaryNarrative = result.subNarrative.substring(0, slashIndex).trim();
        console.log(`Parser: Derived primaryNarrative "${result.primaryNarrative}" from subNarrative`);
      } else {
        result.primaryNarrative = result.subNarrative;
        console.log(`Parser: Using subNarrative "${result.subNarrative}" as primaryNarrative (no "/" found)`);
      }
    }

    // Strip any remaining prefixes from key text fields (final safety net)
    if (result.narrative) {
      result.narrative = stripFieldLabelPrefix(result.narrative);
      // Final check: reject if narrative is actually a field name
      if (isFieldNameAsValue(result.narrative)) {
        console.log(`Parser: Final check - clearing invalid narrative value "${result.narrative}" (it's a field name)`);
        result.narrative = undefined;
      }
    }
    if (result.thesis) {
      result.thesis = stripFieldLabelPrefix(result.thesis);
    }
    if (result.displaySummary) {
      result.displaySummary = stripFieldLabelPrefix(result.displaySummary);
    }
    if (result.primaryNarrative) {
      result.primaryNarrative = stripFieldLabelPrefix(result.primaryNarrative);
    }
    if (result.subNarrative) {
      result.subNarrative = stripFieldLabelPrefix(result.subNarrative);
    }
    if (result.subNarrativeCeiling) {
      result.subNarrativeCeiling = stripFieldLabelPrefix(result.subNarrativeCeiling);
    }
    if (result.subNarrativeConsensus) {
      result.subNarrativeConsensus = stripFieldLabelPrefix(result.subNarrativeConsensus);
    }

    console.log(`Parser: FINAL - narrative: "${result.narrative}", subNarrative: "${result.subNarrative}", primaryNarrative: "${result.primaryNarrative}", thesis: "${result.thesis?.substring(0, 50)}...", schellingPosition: "${result.schellingPosition}"`);

  } catch (error) {
    console.error('Error parsing Gumloop response:', error);
  }

  return result;
}

// Test if the response looks like a valid Gumloop response
export function isValidGumloopResponse(text: string): boolean {
  if (!text || text.length < 100) return false;

  const markers = [
    /final_score|FINAL\s*SCORE/i,
    /final_tier|FINAL\s*TIER/i,
    /consensus/i,
    /phase/i,
    /ChatGPT|GPT|Claude|Gemini|Grok|gpt_score|claude_score/i,
  ];

  const matchCount = markers.filter(marker => marker.test(text)).length;
  return matchCount >= 2;
}

// Check if analysis has component scores (for legacy data handling)
export function hasComponentScores(analysis: { coordinationScore?: string | null; schellingRankScore?: string | null }): boolean {
  const coord = analysis.coordinationScore ? parseFloat(analysis.coordinationScore) : 0;
  const schelling = analysis.schellingRankScore ? parseFloat(analysis.schellingRankScore) : 0;
  return coord > 0 || schelling > 0;
}

// Parse direct Gumloop outputs object (new format with "output fieldname" keys)
// This handles the case where Gumloop returns individual output fields instead of a single text blob
// Also handles nested structure where fields are inside an "analysis_result" object
export function parseGumloopOutputs(outputs: Record<string, any>): ParsedGumloopResponse {
  const result: ParsedGumloopResponse = {
    finalScore: 0,
    tier: '',
    phase: 2,
    phaseName: 'Expansion',
    winningSide: 'AT_RISK',
    consensusLevel: 'MIXED',
    confidence: 'M',
    recommendation: 'HOLD',
    modelScores: {},
    modelAnalyses: {},
  };

  // Check if fields are nested inside analysis_result
  let fieldSource = outputs;

  // Try to extract from analysis_result if it exists
  if (outputs['analysis_result']) {
    const analysisResult = outputs['analysis_result'];
    if (typeof analysisResult === 'object' && analysisResult !== null) {
      // analysis_result is already an object
      fieldSource = analysisResult;
      console.log('parseGumloopOutputs: Using nested analysis_result object');
    } else if (typeof analysisResult === 'string') {
      // analysis_result might be a JSON string - try to parse it
      try {
        const parsed = JSON.parse(analysisResult);
        if (typeof parsed === 'object' && parsed !== null) {
          fieldSource = parsed;
          console.log('parseGumloopOutputs: Parsed analysis_result JSON string');
        }
      } catch {
        // Not JSON, might contain structured text - fall back to text parser
        console.log('parseGumloopOutputs: analysis_result is text, will extract fields from it');
      }
    }
  }

  // Helper to get string value from field source (handles various key formats)
  const getString = (key: string): string | undefined => {
    // Try exact key first, then with "output " prefix, then snake_case variations
    const value = fieldSource[key] || fieldSource[`output ${key}`] || fieldSource[`output_${key}`] || outputs[key] || outputs[`output ${key}`];
    if (typeof value === 'string' && value.trim()) {
      return cleanText(value.trim());
    }
    return undefined;
  };

  // Helper to get numeric value
  const getNumber = (key: string): number | undefined => {
    const value = fieldSource[key] || fieldSource[`output ${key}`] || fieldSource[`output_${key}`] || outputs[key] || outputs[`output ${key}`];
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // If the string contains calculation operators (÷, +, =, /), try to extract the final result
      if (trimmed.includes('÷') || trimmed.includes('=') || (trimmed.includes('+') && trimmed.includes('/'))) {
        // Look for the last "= number" pattern
        const resultMatch = trimmed.match(/=\s*(\d+(?:\.\d+)?)\s*$/);
        if (resultMatch) {
          const num = parseFloat(resultMatch[1]);
          if (!isNaN(num)) {
            console.log(`getNumber('${key}'): Extracted ${num} from calculation text: "${trimmed.substring(0, 60)}..."`);
            return num;
          }
        }
      }
      const num = parseFloat(trimmed);
      if (!isNaN(num)) return num;
    }
    return undefined;
  };

  // Primary scores
  const finalScore = getNumber('final_score');
  if (finalScore !== undefined && finalScore >= 0 && finalScore <= 100) {
    result.finalScore = finalScore;
  }

  const tier = getString('final_tier');
  if (tier) {
    const cleanTier = tier.toUpperCase().replace(/[^A-Z+]/g, '');
    if (['S+', 'S', 'A', 'B', 'C'].includes(cleanTier)) {
      result.tier = cleanTier;
    }
  }

  // Token type - UTILITY or MEMECOIN
  const tokenType = getString('token_type');
  if (tokenType) {
    const cleanType = tokenType.toUpperCase().trim();
    if (cleanType.includes('MEME')) {
      result.tokenType = 'MEMECOIN';
    } else if (cleanType.includes('UTIL')) {
      result.tokenType = 'UTILITY';
    } else {
      result.tokenType = cleanType === 'MEMECOIN' ? 'MEMECOIN' : 'UTILITY';
    }
  }

  // Phase data
  const phase = getNumber('phase');
  if (phase !== undefined && phase >= 1 && phase <= 5) {
    result.phase = phase;
  }

  const phaseName = getString('phase_name');
  if (phaseName) {
    result.phaseName = phaseName;
  }

  // Narrative data
  const narrative = getString('narrative');
  if (narrative && narrative.length > 2) {
    const cleanedNarrative = stripFieldLabelPrefix(narrative);
    // IMPORTANT: Reject if the value is actually a field name (malformed output)
    if (!isFieldNameAsValue(cleanedNarrative)) {
      result.narrative = cleanedNarrative;
    }
  }

  const narrativeHeat = getNumber('narrative_heat');
  if (narrativeHeat !== undefined && narrativeHeat >= 0 && narrativeHeat <= 10) {
    result.narrativeHeat = narrativeHeat;
  }

  const narrativeRank = getString('narrative_rank');
  if (narrativeRank) {
    result.narrativeRank = narrativeRank;
  }

  // Sub-narrative classification fields
  const primaryNarrative = getString('primary_narrative');
  if (primaryNarrative && primaryNarrative.length > 2) {
    result.primaryNarrative = stripFieldLabelPrefix(primaryNarrative);
  }

  const subNarrative = getString('sub_narrative');
  if (subNarrative && subNarrative.length > 2) {
    result.subNarrative = stripFieldLabelPrefix(subNarrative);
  }

  const subNarrativeCeiling = getString('sub_narrative_ceiling');
  if (subNarrativeCeiling) {
    result.subNarrativeCeiling = stripFieldLabelPrefix(subNarrativeCeiling);
  }

  const subNarrativeConsensus = getString('sub_narrative_consensus');
  if (subNarrativeConsensus) {
    result.subNarrativeConsensus = stripFieldLabelPrefix(subNarrativeConsensus);
  }

  // Project context (NEW)
  const thesis = getString('thesis');
  if (thesis) {
    result.thesis = stripFieldLabelPrefix(thesis);
  }

  // Catalysts
  const catalyst1 = getString('catalyst_1');
  if (catalyst1) result.catalyst1 = catalyst1;
  const catalyst2 = getString('catalyst_2');
  if (catalyst2) result.catalyst2 = catalyst2;
  const catalyst3 = getString('catalyst_3');
  if (catalyst3) result.catalyst3 = catalyst3;

  // Build catalysts array from individual fields
  const catalystArray: string[] = [];
  if (catalyst1) catalystArray.push(catalyst1);
  if (catalyst2) catalystArray.push(catalyst2);
  if (catalyst3) catalystArray.push(catalyst3);
  if (catalystArray.length > 0) {
    result.catalysts = catalystArray;
  }

  // Risks
  const risk1 = getString('risk_1');
  if (risk1) result.risk1 = risk1;
  const risk2 = getString('risk_2');
  if (risk2) result.risk2 = risk2;
  const risk3 = getString('risk_3');
  if (risk3) result.risk3 = risk3;

  // Build risks array from individual fields
  const riskArray: string[] = [];
  if (risk1) riskArray.push(risk1);
  if (risk2) riskArray.push(risk2);
  if (risk3) riskArray.push(risk3);
  if (riskArray.length > 0) {
    result.coordinationRisks = riskArray;
  }

  // Social signals (NEW) - with reliable new fields and fallbacks
  const xMentionsTrend = getString('x_mentions_trend');
  if (xMentionsTrend) result.xMentionsTrend = stripFieldLabelPrefix(xMentionsTrend);

  const xSentiment = getString('x_sentiment') || getString('sentiment');
  if (xSentiment) {
    result.xSentiment = stripFieldLabelPrefix(xSentiment);
    console.log(`Parser (outputs): Extracted xSentiment: "${result.xSentiment}"`);
  } else {
    console.log(`Parser (outputs): xSentiment NOT found`);
  }

  // Top KOLs with multiple fallbacks
  const xTopKols = getString('top_kols')
    || getString('x_top_kols')
    || getString('notable_kols');
  // Always normalize KOL value - handles empty, null, and placeholder values
  result.xTopKols = normalizeKolValue(xTopKols ? stripFieldLabelPrefix(xTopKols) : null);
  console.log(`Parser (outputs): Extracted xTopKols: "${result.xTopKols}"`);

  // Community Status - new reliable field with fallback to old long field name
  // Extract just the category if value contains additional text
  const communityStatus = getString('community_status')
    || getString('community_coordination_active_community_status')
    || getString('active_community_status');
  if (communityStatus) {
    result.communityStatus = extractCommunityStatusCategory(stripFieldLabelPrefix(communityStatus));
    console.log(`Parser (outputs): Extracted communityStatus: "${result.communityStatus}"`);
  }

  // Account Quality - new reliable field with fallback to old long field name
  // Extract just the category if value contains additional text
  const accountQuality = getString('account_quality')
    || getString('account_analysis_account_quality_assessment')
    || getString('account_quality_assessment');
  if (accountQuality) {
    result.accountQuality = extractAccountQualityCategory(stripFieldLabelPrefix(accountQuality));
    console.log(`Parser (outputs): Extracted accountQuality: "${result.accountQuality}"`);
  }

  // X Research qualitative fields (NEW - replacing numeric versions)
  const engagementQuality = getString('engagement_quality')
    || getString('attention_metrics_engagement_quality');
  if (engagementQuality) {
    result.engagementQuality = engagementQuality;
    console.log(`Parser (outputs): Extracted engagementQuality: "${result.engagementQuality}"`);
  }

  const overallSentiment = getString('overall_sentiment')
    || getString('sentiment_analysis_overall_sentiment');
  if (overallSentiment) {
    result.overallSentiment = overallSentiment;
    console.log(`Parser (outputs): Extracted overallSentiment: "${result.overallSentiment}"`);
  }

  const cultVsMercenary = getString('cult_vs_mercenary')
    || getString('community_coordination_cult_vs_mercenary');
  if (cultVsMercenary) {
    result.cultVsMercenary = cultVsMercenary;
    console.log(`Parser (outputs): Extracted cultVsMercenary: "${result.cultVsMercenary}"`);
  }

  // X Research flexible format fields (can be numeric OR qualitative)
  // Sentiment ratios
  const sentimentBullishRatio = getString('sentiment_analysis_overall_sentiment_ratio_bullish')
    || getString('sentiment_ratio_bullish')
    || getString('bullish_ratio');
  if (sentimentBullishRatio) {
    result.sentimentBullishRatio = sentimentBullishRatio;
    console.log(`Parser (outputs): Extracted sentimentBullishRatio: "${result.sentimentBullishRatio}"`);
  }

  const sentimentBearishRatio = getString('sentiment_analysis_overall_sentiment_ratio_bearish')
    || getString('sentiment_ratio_bearish')
    || getString('bearish_ratio');
  if (sentimentBearishRatio) {
    result.sentimentBearishRatio = sentimentBearishRatio;
    console.log(`Parser (outputs): Extracted sentimentBearishRatio: "${result.sentimentBearishRatio}"`);
  }

  const sentimentNeutralRatio = getString('sentiment_analysis_overall_sentiment_ratio_neutral')
    || getString('sentiment_ratio_neutral')
    || getString('neutral_ratio');
  if (sentimentNeutralRatio) {
    result.sentimentNeutralRatio = sentimentNeutralRatio;
    console.log(`Parser (outputs): Extracted sentimentNeutralRatio: "${result.sentimentNeutralRatio}"`);
  }

  // Engagement quality details
  const likesPerPostAvg = getString('attention_metrics_engagement_quality_likes_per_post_average')
    || getString('likes_per_post_average')
    || getString('likes_per_post');
  if (likesPerPostAvg) {
    result.likesPerPostAvg = likesPerPostAvg;
    console.log(`Parser (outputs): Extracted likesPerPostAvg: "${result.likesPerPostAvg}"`);
  }

  const retweetsPerPostAvg = getString('attention_metrics_engagement_quality_retweets_per_post_average')
    || getString('retweets_per_post_average')
    || getString('retweets_per_post');
  if (retweetsPerPostAvg) {
    result.retweetsPerPostAvg = retweetsPerPostAvg;
    console.log(`Parser (outputs): Extracted retweetsPerPostAvg: "${result.retweetsPerPostAvg}"`);
  }

  const repliesPerPostAvg = getString('attention_metrics_engagement_quality_replies_per_post_average')
    || getString('replies_per_post_average')
    || getString('replies_per_post');
  if (repliesPerPostAvg) {
    result.repliesPerPostAvg = repliesPerPostAvg;
    console.log(`Parser (outputs): Extracted repliesPerPostAvg: "${result.repliesPerPostAvg}"`);
  }

  // Cult/Mercenary ratio (flexible format)
  const cultMercenaryRatio = getString('community_coordination_cult_vs_mercenary_ratio')
    || getString('cult_mercenary_ratio');
  if (cultMercenaryRatio) {
    result.cultMercenaryRatio = cultMercenaryRatio;
    console.log(`Parser (outputs): Extracted cultMercenaryRatio: "${result.cultMercenaryRatio}"`);
  }

  // Sample size (flexible format)
  const sentimentSampleSize = getString('sentiment_analysis_sample_size_of_posts_analyzed')
    || getString('sample_size_of_posts_analyzed')
    || getString('sample_size');
  if (sentimentSampleSize) {
    result.sentimentSampleSize = sentimentSampleSize;
    console.log(`Parser (outputs): Extracted sentimentSampleSize: "${result.sentimentSampleSize}"`);
  }

  // Team/Project info (NEW)
  const unlockWarning = getString('unlock_warning');
  if (unlockWarning) result.unlockWarning = unlockWarning;

  const teamStatus = getString('team_status');
  if (teamStatus) result.teamStatus = teamStatus;

  const notableBackers = getString('notable_backers');
  if (notableBackers) result.notableBackers = notableBackers;

  // Key metrics
  const peakProximity = getNumber('peak_proximity_pct');
  if (peakProximity !== undefined && peakProximity >= 0 && peakProximity <= 100) {
    result.peakProximity = peakProximity;
  }

  const winningSide = getString('winning_side');
  if (winningSide) {
    const side = winningSide.toUpperCase();
    if (side.includes('USER')) result.winningSide = 'USER';
    else if (side.includes('EXIT') || side.includes('LIQUIDITY')) result.winningSide = 'EXIT_LIQ';
    else result.winningSide = 'AT_RISK';
  }

  const consensusLevel = getString('consensus_level');
  if (consensusLevel) {
    const level = consensusLevel.toUpperCase();
    if (['HIGH', 'MIXED', 'LOW', 'CONFLICTED'].includes(level)) {
      result.consensusLevel = level;
    }
  }

  const confidence = getString('confidence');
  if (confidence) {
    const conf = confidence.toUpperCase().charAt(0);
    if (['H', 'M', 'L'].includes(conf)) {
      result.confidence = conf;
    }
  }

  const equilibriumType = getString('equilibrium_type');
  if (equilibriumType) result.equilibriumType = equilibriumType;

  // Asymmetry floor/ceiling - try multiple field names and extract just the numeric value
  const asymmetryFloor = getString('asymmetry_floor') || getString('asymmetry_floor_score');
  if (asymmetryFloor) {
    result.asymmetryFloor = extractAsymmetryNumeric(asymmetryFloor);
    console.log(`Parser (outputs): Extracted asymmetryFloor: "${result.asymmetryFloor}"`);
  }

  const asymmetryCeiling = getString('asymmetry_ceiling') || getString('asymmetry_ceiling_score');
  if (asymmetryCeiling) {
    result.asymmetryCeiling = extractAsymmetryNumeric(asymmetryCeiling);
    console.log(`Parser (outputs): Extracted asymmetryCeiling: "${result.asymmetryCeiling}"`);
  }

  // Recommendation
  const recommendation = getString('recommendation');
  if (recommendation) {
    const rec = recommendation.toUpperCase();
    if (rec.includes('BUY')) result.recommendation = 'BUY';
    else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
    else result.recommendation = 'HOLD';
  }

  const displaySummary = getString('display_summary');
  if (displaySummary) result.displaySummary = stripFieldLabelPrefix(displaySummary);

  // Component scores
  const coordinationScore = getNumber('coordination_score');
  if (coordinationScore !== undefined) result.coordinationScore = coordinationScore;

  const schellingScore = getNumber('schelling_score');
  if (schellingScore !== undefined) result.schellingRankScore = schellingScore;

  const reflexivityScore = getNumber('reflexivity_score');
  if (reflexivityScore !== undefined) result.reflexivityScore = reflexivityScore;

  const viralityScore = getNumber('virality_score');
  if (viralityScore !== undefined) result.viralityScore = viralityScore;

  const asymmetryScore = getNumber('asymmetry_score');
  if (asymmetryScore !== undefined) result.asymmetryScore = asymmetryScore;

  const gameTheoryScore = getNumber('game_theory_score');
  if (gameTheoryScore !== undefined) result.gameTheoryBonus = gameTheoryScore;

  // Modifiers
  const phaseModifier = getNumber('phase_modifier');
  if (phaseModifier !== undefined) result.phaseModifier = phaseModifier;

  const narrativeModifier = getNumber('narrative_modifier');
  if (narrativeModifier !== undefined) result.narrativeModifier = narrativeModifier;

  const exitLiquidityModifier = getNumber('exit_liquidity_modifier');
  if (exitLiquidityModifier !== undefined) result.exitLiquidityModifier = exitLiquidityModifier;

  const peakProximityModifier = getNumber('peak_proximity_modifier');
  if (peakProximityModifier !== undefined) result.peakProximityModifier = peakProximityModifier;

  const dataQualityModifier = getNumber('data_quality_modifier');
  if (dataQualityModifier !== undefined) result.dataQualityModifier = dataQualityModifier;

  // FDV modifier with fallback to market_cap_modifier for backward compatibility
  const fdvModifier = getNumber('fdv_modifier');
  const marketCapModifier = getNumber('market_cap_modifier');
  if (fdvModifier !== undefined) {
    result.fdvModifier = fdvModifier;
  } else if (marketCapModifier !== undefined) {
    result.fdvModifier = marketCapModifier; // Use market cap as fallback
  }
  if (marketCapModifier !== undefined) result.marketCapModifier = marketCapModifier;

  // Market data from Gumloop (fallback when CoinGecko unavailable)
  const gumloopTicker = getString('ticker');
  if (gumloopTicker) {
    result.gumloopTicker = gumloopTicker;
    console.log(`Parser (outputs): Extracted gumloopTicker: "${result.gumloopTicker}"`);
  }

  const gumloopPrice = getString('price');
  if (gumloopPrice) {
    result.gumloopPrice = gumloopPrice;
    console.log(`Parser (outputs): Extracted gumloopPrice: "${result.gumloopPrice}"`);
  }

  const gumloopMarketCap = getString('market_cap');
  if (gumloopMarketCap) {
    result.gumloopMarketCap = gumloopMarketCap;
    console.log(`Parser (outputs): Extracted gumloopMarketCap: "${result.gumloopMarketCap}"`);
  }

  const gumloopFdv = getString('fdv');
  if (gumloopFdv) {
    result.gumloopFdv = gumloopFdv;
    console.log(`Parser (outputs): Extracted gumloopFdv: "${result.gumloopFdv}"`);
  }

  // Model scores
  const gptScore = getNumber('gpt_score');
  if (gptScore !== undefined) result.modelScores.gpt = gptScore;

  const claudeScore = getNumber('claude_score');
  if (claudeScore !== undefined) result.modelScores.claude = claudeScore;

  const geminiScore = getNumber('gemini_score');
  if (geminiScore !== undefined) result.modelScores.gemini = geminiScore;

  const grokScore = getNumber('grok_score');
  if (grokScore !== undefined) result.modelScores.grok = grokScore;

  // Model divergence metrics (NEW)
  const scoreSpread = getNumber('score_spread');
  if (scoreSpread !== undefined) {
    result.scoreSpread = scoreSpread;
    console.log(`Parser (outputs): Extracted scoreSpread: ${result.scoreSpread}`);
  }

  const divergenceFlag = getString('divergence_flag');
  if (divergenceFlag) {
    const flag = divergenceFlag.toUpperCase();
    if (['HIGH', 'MODERATE', 'LOW'].includes(flag)) {
      result.divergenceFlag = flag;
      console.log(`Parser (outputs): Extracted divergenceFlag: ${result.divergenceFlag}`);
    }
  }

  const divergenceNote = getString('divergence_note');
  if (divergenceNote) {
    result.divergenceNote = divergenceNote;
    console.log(`Parser (outputs): Extracted divergenceNote: "${result.divergenceNote}"`);
  }

  // Model analyses - verdict, reasoning, and risks for each model
  // Helper to parse comma-separated risks
  const parseRisksFromString = (risksStr: string | undefined): string[] | undefined => {
    if (!risksStr) return undefined;
    const risks = risksStr.split(',').map(r => r.trim()).filter(r => r.length > 0);
    return risks.length > 0 ? risks : undefined;
  };

  // GPT Analysis
  const gptVerdict = getString('gpt_verdict');
  const gptReasoning = getString('gpt_reasoning');
  const gptRisksStr = getString('gpt_risks');
  if (gptScore !== undefined || gptVerdict || gptReasoning) {
    result.modelAnalyses.gpt = {
      score: gptScore ?? 0,
      verdict: gptVerdict,
      reasoning: gptReasoning,
      risks: parseRisksFromString(gptRisksStr),
    };
  }

  // Claude Analysis
  const claudeVerdict = getString('claude_verdict');
  const claudeReasoning = getString('claude_reasoning');
  const claudeRisksStr = getString('claude_risks');
  if (claudeScore !== undefined || claudeVerdict || claudeReasoning) {
    result.modelAnalyses.claude = {
      score: claudeScore ?? 0,
      verdict: claudeVerdict,
      reasoning: claudeReasoning,
      risks: parseRisksFromString(claudeRisksStr),
    };
  }

  // Gemini Analysis
  const geminiVerdict = getString('gemini_verdict');
  const geminiReasoning = getString('gemini_reasoning');
  const geminiRisksStr = getString('gemini_risks');
  if (geminiScore !== undefined || geminiVerdict || geminiReasoning) {
    result.modelAnalyses.gemini = {
      score: geminiScore ?? 0,
      verdict: geminiVerdict,
      reasoning: geminiReasoning,
      risks: parseRisksFromString(geminiRisksStr),
    };
  }

  // Grok Analysis
  const grokVerdict = getString('grok_verdict');
  const grokReasoning = getString('grok_reasoning');
  const grokRisksStr = getString('grok_risks');
  if (grokScore !== undefined || grokVerdict || grokReasoning) {
    result.modelAnalyses.grok = {
      score: grokScore ?? 0,
      verdict: grokVerdict,
      reasoning: grokReasoning,
      risks: parseRisksFromString(grokRisksStr),
    };
  }

  // Upside Assessment fields (from Stage 4)
  const currentFdv = getString('current_fdv');
  if (currentFdv) {
    result.currentFdv = cleanFdvValue(currentFdv);
    console.log(`Parser (outputs): Extracted currentFdv: "${result.currentFdv}"`);
  }

  const realisticPeakFdv = getString('realistic_peak_fdv') || getString('peak_fdv');
  if (realisticPeakFdv) {
    result.realisticPeakFdv = cleanFdvValue(realisticPeakFdv);
    console.log(`Parser (outputs): Extracted realisticPeakFdv: "${result.realisticPeakFdv}"`);
  }

  const upsideMultipleVal = getString('upside_multiple') || getString('multiple');
  if (upsideMultipleVal) {
    result.upsideMultiple = cleanUpsideMultiple(upsideMultipleVal);
    console.log(`Parser (outputs): Extracted upsideMultiple: "${result.upsideMultiple}" (raw: "${upsideMultipleVal}")`);
  }

  const upsideTierVal = getString('upside_tier');
  if (upsideTierVal) {
    result.upsideTier = upsideTierVal;
    console.log(`Parser (outputs): Extracted upsideTier: "${result.upsideTier}"`);
  }

  // Score calculation (for debugging/verification)
  const scoreCalculation = getString('score_calculation') || getString('final_score_calculation');
  if (scoreCalculation) {
    result.scoreCalculation = scoreCalculation;
    console.log(`Parser (outputs): Extracted scoreCalculation: "${result.scoreCalculation}"`);
  }

  // Calculate tier from score if not set
  if (!result.tier || result.tier === '') {
    result.tier = calculateTierFromScore(result.finalScore);
  }

  // Calculate missing component scores if we have a final score
  // Component weights: Coordination 20, Schelling 10, Reflexivity 15, Virality 15, Asymmetry 25, Game Theory 15
  if (result.finalScore > 0) {
    const base = result.finalScore;
    if (!result.coordinationScore) result.coordinationScore = Math.round(base * 0.2 * 10) / 10;
    if (!result.schellingRankScore) result.schellingRankScore = Math.round(base * 0.10 * 10) / 10;
    if (!result.reflexivityScore) result.reflexivityScore = Math.round(base * 0.15 * 10) / 10;
    if (!result.viralityScore) result.viralityScore = Math.round(base * 0.15 * 10) / 10;
    if (!result.asymmetryScore) result.asymmetryScore = Math.round(base * 0.25 * 10) / 10;
    if (!result.gameTheoryBonus) result.gameTheoryBonus = Math.round(base * 0.15 * 10) / 10;
  }

  // Do NOT generate generic fallback text for display_summary
  // Let UI show "Summary not available" if no actual summary exists

  // FALLBACK: If narrative wasn't found in direct fields, search all text content in outputs
  if (!result.narrative || !result.subNarrative || !result.primaryNarrative) {
    // Combine all string values from outputs into one text to search
    const allTextContent: string[] = [];
    for (const [key, value] of Object.entries(outputs)) {
      if (typeof value === 'string' && value.length > 10) {
        allTextContent.push(value);
      } else if (typeof value === 'object' && value !== null) {
        // Check nested objects too
        for (const nestedValue of Object.values(value)) {
          if (typeof nestedValue === 'string' && nestedValue.length > 10) {
            allTextContent.push(nestedValue);
          }
        }
      }
    }

    if (allTextContent.length > 0) {
      const combinedText = allTextContent.join('\n');

      // First, try to extract from ## NARRATIVE: section
      if (!result.subNarrative || !result.primaryNarrative) {
        const narrativeSectionFields = extractNarrativeSectionFields(combinedText);
        if (narrativeSectionFields.primaryNarrative && !result.primaryNarrative) {
          result.primaryNarrative = narrativeSectionFields.primaryNarrative;
          console.log(`parseGumloopOutputs: Got primaryNarrative from NARRATIVE section: "${result.primaryNarrative}"`);
        }
        if (narrativeSectionFields.subNarrative && !result.subNarrative) {
          result.subNarrative = narrativeSectionFields.subNarrative;
          console.log(`parseGumloopOutputs: Got subNarrative from NARRATIVE section: "${result.subNarrative}"`);
        }
      }

      // Patterns to extract narrative from text content
      // IMPORTANT: Use negative lookbehind to avoid matching "narrative:" within "primary_narrative:" or "sub_narrative:"
      if (!result.narrative) {
        const narrativePatterns = [
          // **NARRATIVE:** followed by narrative: value on same or next line (not primary_narrative or sub_narrative)
          /\*\*NARRATIVE:\*\*\s*(?!primary_|sub_)(?:narrative:\s*)?([^\n*|]+)/i,
          // narrative: value (simple format) - NOT preceded by primary_ or sub_
          /(?:^|\n)\s*(?<!primary_|sub_)narrative:\s*([^\n|]+)/i,
          // **Narrative**: value (but not Primary Narrative or Sub Narrative)
          /(?<!\bPrimary\s)(?<!\bSub\s)\*\*Narrative\*\*[:\s]+([^\n|*]+)/i,
          // | Narrative | value |
          /\|\s*Narrative\s*\|\s*([^|]+)\|/i,
        ];

        for (const pattern of narrativePatterns) {
          const match = combinedText.match(pattern);
          if (match && match[1]) {
            const narrative = cleanText(match[1].trim());
            const cleanedNarrative = stripFieldLabelPrefix(narrative);
            if (cleanedNarrative.length > 2 && cleanedNarrative.length < 100 &&
                !cleanedNarrative.includes('AT_RISK') && !cleanedNarrative.includes('USER') &&
                !cleanedNarrative.toLowerCase().includes('unknown') &&
                !isFieldNameAsValue(cleanedNarrative)) {
              result.narrative = cleanedNarrative;
              console.log(`parseGumloopOutputs: Found narrative in text content: "${result.narrative}"`);
              break;
            }
          }
        }
      }
    }
  }

  // FINAL FALLBACK: If schellingPosition not set, use narrativeRank
  if (!result.schellingPosition && result.narrativeRank) {
    result.schellingPosition = result.narrativeRank;
    console.log(`parseGumloopOutputs: Using narrativeRank "${result.narrativeRank}" as schellingPosition fallback`);
  }

  // SUB-NARRATIVE FALLBACK LOGIC
  // If sub_narrative is missing but we have narrative, use narrative as sub_narrative
  if (!result.subNarrative && result.narrative) {
    result.subNarrative = result.narrative;
    console.log(`parseGumloopOutputs: Using narrative "${result.narrative}" as subNarrative fallback`);
  }

  // If primary_narrative is missing, derive from sub_narrative (text before "/" or full value)
  if (!result.primaryNarrative && result.subNarrative) {
    const slashIndex = result.subNarrative.indexOf('/');
    if (slashIndex > 0) {
      result.primaryNarrative = result.subNarrative.substring(0, slashIndex).trim();
      console.log(`parseGumloopOutputs: Derived primaryNarrative "${result.primaryNarrative}" from subNarrative`);
    } else {
      result.primaryNarrative = result.subNarrative;
      console.log(`parseGumloopOutputs: Using subNarrative "${result.subNarrative}" as primaryNarrative (no "/" found)`);
    }
  }

  // Strip any remaining prefixes from key text fields (final safety net)
  if (result.narrative) {
    result.narrative = stripFieldLabelPrefix(result.narrative);
    // Final check: reject if narrative is actually a field name
    if (isFieldNameAsValue(result.narrative)) {
      console.log(`parseGumloopOutputs: Final check - clearing invalid narrative value "${result.narrative}" (it's a field name)`);
      result.narrative = undefined;
    }
  }
  if (result.thesis) {
    result.thesis = stripFieldLabelPrefix(result.thesis);
  }
  if (result.displaySummary) {
    result.displaySummary = stripFieldLabelPrefix(result.displaySummary);
  }
  if (result.primaryNarrative) {
    result.primaryNarrative = stripFieldLabelPrefix(result.primaryNarrative);
  }
  if (result.subNarrative) {
    result.subNarrative = stripFieldLabelPrefix(result.subNarrative);
  }
  if (result.subNarrativeCeiling) {
    result.subNarrativeCeiling = stripFieldLabelPrefix(result.subNarrativeCeiling);
  }
  if (result.subNarrativeConsensus) {
    result.subNarrativeConsensus = stripFieldLabelPrefix(result.subNarrativeConsensus);
  }

  console.log(`parseGumloopOutputs: FINAL - narrative: "${result.narrative}", subNarrative: "${result.subNarrative}", primaryNarrative: "${result.primaryNarrative}", thesis: "${result.thesis?.substring(0, 50)}...", schellingPosition: "${result.schellingPosition}"`);

  return result;
}

// Check if outputs object has direct field outputs (new format)
// Also checks inside nested analysis_result object
export function hasDirectOutputFields(outputs: Record<string, any>): boolean {
  // Check if any of the expected field names exist as keys
  const expectedFields = [
    'final_score', 'output final_score',
    'final_tier', 'output final_tier',
    'thesis', 'output thesis',
    'narrative', 'output narrative',
  ];

  // First check top-level outputs
  if (expectedFields.some(field => outputs[field] !== undefined)) {
    return true;
  }

  // Check inside analysis_result if it exists
  if (outputs['analysis_result']) {
    const analysisResult = outputs['analysis_result'];

    // If analysis_result is an object, check for fields inside it
    if (typeof analysisResult === 'object' && analysisResult !== null) {
      if (expectedFields.some(field => analysisResult[field] !== undefined)) {
        return true;
      }
    }

    // If analysis_result is a JSON string, try to parse and check
    if (typeof analysisResult === 'string') {
      try {
        const parsed = JSON.parse(analysisResult);
        if (typeof parsed === 'object' && parsed !== null) {
          if (expectedFields.some(field => parsed[field] !== undefined)) {
            return true;
          }
        }
      } catch {
        // Not valid JSON, ignore
      }
    }
  }

  return false;
}
