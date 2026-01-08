import type { ModelScores } from "@shared/schema";

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

  // Project context (NEW)
  thesis?: string;
  catalyst1?: string;
  catalyst2?: string;
  catalyst3?: string;
  risk1?: string;
  risk2?: string;
  risk3?: string;

  // Social signals (NEW)
  xMentionsTrend?: string; // ↑/↓/→
  xSentiment?: string; // positive/mixed/negative
  xTopKols?: string;

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
  marketCapModifier?: number; // -15 to +5, large caps penalized
  totalModifiers?: number;
  penalties?: number;

  // Market cap scaling
  marketCapTier?: string; // mega, large, mid, small
  scoreCapped?: boolean;
  uncappedScore?: number;

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
  modelAgreement?: string;
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
  'primary_narrative': 'narrative',
  'primary narrative': 'narrative',

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

  'narrative_heat': 'narrative_heat',
  'narrative heat': 'narrative_heat',

  'exit_liquidity_modifier': 'exit_liquidity_modifier',
  'exit liquidity modifier': 'exit_liquidity_modifier',

  'peak_proximity_modifier': 'peak_proximity_modifier',
  'peak proximity modifier': 'peak_proximity_modifier',

  'data_quality_modifier': 'data_quality_modifier',
  'data quality modifier': 'data_quality_modifier',

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
};

// Normalize a field name to its canonical form
function normalizeFieldName(name: string): string {
  const normalized = name.toLowerCase().trim();
  return FIELD_ALIASES[normalized] || normalized.replace(/\s+/g, '_');
}

// Extract the OUTPUT SUMMARY section from text
function extractOutputSummarySection(text: string): string | null {
  // Look for OUTPUT SUMMARY markers
  const patterns = [
    // ════ bordered section
    /═{3,}[^\n]*OUTPUT\s*SUMMARY[^\n]*═*\s*\n([\s\S]*?)(?=═{3,}|$)/i,
    // ## OUTPUT SUMMARY or # OUTPUT SUMMARY
    /#{1,3}\s*OUTPUT\s*SUMMARY\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/i,
    // **OUTPUT SUMMARY**
    /\*\*OUTPUT\s*SUMMARY\*\*\s*\n([\s\S]*?)(?=\n\*\*[A-Z]|\n#{1,3}|$)/i,
    // OUTPUT SUMMARY: or OUTPUT SUMMARY (plain)
    /OUTPUT\s*SUMMARY[:\s]*\n([\s\S]*?)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 20) {
      return match[1].trim();
    }
  }

  return null;
}

// Parse OUTPUT SUMMARY section into key-value pairs
function parseOutputSummaryToMap(summaryText: string): Map<string, string> {
  const result = new Map<string, string>();

  // Split into lines and parse each as key: value
  const lines = summaryText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('-')) {
      continue;
    }

    // Match pattern: field_name: value (with optional ** around field name)
    const match = trimmed.match(/^\*?\*?([a-z_\s/]+)\*?\*?\s*:\s*(.+)$/i);
    if (match && match[1] && match[2]) {
      const rawKey = match[1].trim();
      const rawValue = match[2].trim();

      // Skip if value looks like a markdown header or empty
      if (!rawValue || rawValue === '-' || rawValue === 'N/A' || rawValue.startsWith('#')) {
        continue;
      }

      const canonicalKey = normalizeFieldName(rawKey);
      // Clean the value (remove trailing markdown, extra quotes)
      const cleanedValue = rawValue
        .replace(/\*\*/g, '')
        .replace(/^\s*["']|["']\s*$/g, '')
        .trim();

      if (cleanedValue) {
        result.set(canonicalKey, cleanedValue);
      }
    }
  }

  return result;
}

// Get a string value from the parsed map
function getStringFromMap(map: Map<string, string>, key: string): string | null {
  const canonicalKey = normalizeFieldName(key);
  const value = map.get(canonicalKey);
  if (value && value !== 'N/A' && value !== 'undefined' && value !== 'null') {
    return cleanText(value);
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
  const patterns = [
    // **NARRATIVE:** followed by narrative: value (Gumloop format)
    /\*\*NARRATIVE:\*\*\s*\n?\s*narrative:\s*([^\n]+)/i,
    // narrative: value on its own line (not in a table)
    /(?:^|\n)\s*narrative:\s*([A-Za-z][^\n|]+)/im,
    // **Narrative**: value or **Narrative:** value
    /\*\*Narrative\*\*[:\s]+([A-Za-z][^\n*|]+)/i,
    // Primary Narrative: value
    /Primary\s*Narrative[:\s]+["']?([A-Za-z][^"'\n|]+)/i,
    // narrative in quotes: "value" or 'value'
    /narrative[:\s]+["']([^"']+)["']/i,
    // thesis as fallback
    /thesis[:\s]+["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = cleanText(match[1].trim());
      if (isValidNarrative(value)) {
        console.log(`extractNarrativeField: Found valid narrative: "${value}"`);
        return value;
      }
    }
  }

  return null;
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
    if (rec.includes('BUY')) result.recommendation = 'BUY';
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

  const marketCapModifier = extractNumericField(parseText, 'market_cap_modifier');
  if (marketCapModifier !== undefined) result.marketCapModifier = marketCapModifier;

  const totalModifiers = extractNumericField(parseText, 'total_modifiers');
  if (totalModifiers !== undefined) result.totalModifiers = totalModifiers;

  const penalties = extractNumericField(parseText, 'penalties');
  if (penalties !== undefined) result.penalties = penalties;

  // Narrative - use dedicated extraction with multiple patterns
  const narrative = extractNarrativeField(parseText);
  if (narrative) {
    result.narrative = narrative;
  }

  const narrativeHeat = extractNumericField(parseText, 'narrative_heat');
  if (narrativeHeat !== undefined && narrativeHeat >= 0 && narrativeHeat <= 10) {
    result.narrativeHeat = narrativeHeat;
  }

  const narrativeRank = extractField(parseText, 'narrative_rank');
  if (narrativeRank) {
    result.narrativeRank = cleanText(narrativeRank);
  }

  const schellingPosition = extractField(parseText, 'schelling_position');
  if (schellingPosition) {
    result.schellingPosition = cleanText(schellingPosition);
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

  const asymmetryFloor = extractField(parseText, 'asymmetry_floor') || extractField(parseText, 'downside_risk');
  if (asymmetryFloor && asymmetryFloor.length > 1) {
    result.asymmetryFloor = cleanText(asymmetryFloor);
  }

  const asymmetryCeiling = extractField(parseText, 'asymmetry_ceiling') || extractField(parseText, 'upside_potential');
  if (asymmetryCeiling && asymmetryCeiling.length > 1) {
    result.asymmetryCeiling = cleanText(asymmetryCeiling);
  }

  // Project Context (NEW fields)
  const thesis = extractField(parseText, 'thesis');
  if (thesis && thesis.length > 3) {
    result.thesis = cleanText(thesis);
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

  // Social Signals (NEW)
  const xMentionsTrend = extractField(parseText, 'x_mentions_trend');
  if (xMentionsTrend) {
    result.xMentionsTrend = cleanText(xMentionsTrend);
  }

  const xSentiment = extractField(parseText, 'x_sentiment');
  if (xSentiment) {
    result.xSentiment = cleanText(xSentiment);
  }

  const xTopKols = extractField(parseText, 'x_top_kols');
  if (xTopKols) {
    result.xTopKols = cleanText(xTopKols);
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
    result.displaySummary = cleanText(displaySummary);
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
        const narrative = cleanText(match[1]);
        if (narrative.length > 3 && narrative.length < 60 &&
            !narrative.includes('AT_RISK') && !narrative.includes('USER')) {
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
    if (schellingMatch) result.schellingPosition = cleanText(schellingMatch[1]);
  }
  if (!result.asymmetryFloor) {
    const floorMatch = rawText.match(/(?:Downside|Floor|Risk)[:\s]*(-?\d+%?(?:\s*to\s*-?\d+%?)?)/i);
    if (floorMatch) result.asymmetryFloor = cleanText(floorMatch[1]);
  }
  if (!result.asymmetryCeiling) {
    const ceilingMatch = rawText.match(/(?:Upside|Ceiling|Potential)[:\s]*(\+?\d+%?(?:\s*to\s*\+?\d+%?)?)/i);
    if (ceilingMatch) result.asymmetryCeiling = cleanText(ceilingMatch[1]);
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
  };

  if (!rawText || rawText.length < 100) {
    // Calculate tier from default score
    result.tier = calculateTierFromScore(result.finalScore);
    return result;
  }

  try {
    // ==================== PRIMARY STRATEGY: Parse OUTPUT SUMMARY section ====================
    // The OUTPUT SUMMARY section uses a consistent field_name: value format
    const summarySection = extractOutputSummarySection(rawText);
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
        result.narrative = summaryNarrative;
        console.log(`Parser: Got narrative from OUTPUT SUMMARY: ${summaryNarrative}`);
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
      if (summaryThesis) result.thesis = summaryThesis;

      const summaryVerdict = getStringFromMap(summaryMap, 'verdict');
      if (summaryVerdict) result.verdict = summaryVerdict;

      const summaryReasoning = getStringFromMap(summaryMap, 'reasoning');
      if (summaryReasoning) result.reasoning = summaryReasoning;

      const summaryNarrativeHeat = getNumberFromMap(summaryMap, 'narrative_heat');
      if (summaryNarrativeHeat !== null) result.narrativeHeat = summaryNarrativeHeat;

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

    // Fill in remaining fields with structured output parser
    parseStructuredOutput(rawText, result);

    // Log parsed narrative for debugging
    console.log(`Parser: After parseStructuredOutput - narrative: "${result.narrative || 'undefined'}"`);

    // Then, fill in any missing fields with legacy parsing
    parseLegacyFormat(rawText, result);

    // Log after legacy parsing
    console.log(`Parser: After parseLegacyFormat - narrative: "${result.narrative || 'undefined'}"`);
    console.log(`Parser: Final values - score: ${result.finalScore}, tier: ${result.tier}, narrative: "${result.narrative || 'undefined'}"`);

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

    // Build display summary if not present
    if (!result.displaySummary) {
      let summary = result.verdict || result.reasoning || "";
      const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        summary = sentences.slice(0, 3).join(' ').trim();
      }
      summary = summary.replace(/^[:\s\-–—]+/, '').trim();

      if (!summary || summary.length < 20) {
        summary = `${result.tier}-tier token with ${result.consensusLevel.toLowerCase()} model consensus scoring ${result.finalScore.toFixed(1)}/100. ${
          result.recommendation === 'BUY' ? 'Favorable risk/reward profile.' :
          result.recommendation === 'AVOID' ? 'Elevated risk factors detected.' :
          'Moderate opportunity requiring careful position sizing.'
        }`;
      }
      result.displaySummary = summary;
    }

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
      const num = parseFloat(value);
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
    result.narrative = narrative;
  }

  const narrativeHeat = getNumber('narrative_heat');
  if (narrativeHeat !== undefined && narrativeHeat >= 0 && narrativeHeat <= 10) {
    result.narrativeHeat = narrativeHeat;
  }

  const narrativeRank = getString('narrative_rank');
  if (narrativeRank) {
    result.narrativeRank = narrativeRank;
  }

  // Project context (NEW)
  const thesis = getString('thesis');
  if (thesis) {
    result.thesis = thesis;
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

  // Social signals (NEW)
  const xMentionsTrend = getString('x_mentions_trend');
  if (xMentionsTrend) result.xMentionsTrend = xMentionsTrend;

  const xSentiment = getString('x_sentiment');
  if (xSentiment) result.xSentiment = xSentiment;

  const xTopKols = getString('x_top_kols');
  if (xTopKols) result.xTopKols = xTopKols;

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

  // Recommendation
  const recommendation = getString('recommendation');
  if (recommendation) {
    const rec = recommendation.toUpperCase();
    if (rec.includes('BUY')) result.recommendation = 'BUY';
    else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
    else result.recommendation = 'HOLD';
  }

  const displaySummary = getString('display_summary');
  if (displaySummary) result.displaySummary = displaySummary;

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

  const marketCapModifier = getNumber('market_cap_modifier');
  if (marketCapModifier !== undefined) result.marketCapModifier = marketCapModifier;

  // Model scores
  const gptScore = getNumber('gpt_score');
  if (gptScore !== undefined) result.modelScores.gpt = gptScore;

  const claudeScore = getNumber('claude_score');
  if (claudeScore !== undefined) result.modelScores.claude = claudeScore;

  const geminiScore = getNumber('gemini_score');
  if (geminiScore !== undefined) result.modelScores.gemini = geminiScore;

  const grokScore = getNumber('grok_score');
  if (grokScore !== undefined) result.modelScores.grok = grokScore;

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

  // Build display summary if not present
  if (!result.displaySummary && result.finalScore > 0) {
    result.displaySummary = `${result.tier}-tier token with ${result.consensusLevel.toLowerCase()} model consensus scoring ${result.finalScore.toFixed(1)}/100. ${
      result.recommendation === 'BUY' ? 'Favorable risk/reward profile.' :
      result.recommendation === 'AVOID' ? 'Elevated risk factors detected.' :
      'Moderate opportunity requiring careful position sizing.'
    }`;
  }

  // FALLBACK: If narrative wasn't found in direct fields, search all text content in outputs
  if (!result.narrative) {
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

      // Patterns to extract narrative from text content
      const narrativePatterns = [
        // **NARRATIVE:** followed by narrative: value on same or next line
        /\*\*NARRATIVE:\*\*\s*(?:narrative:\s*)?([^\n*|]+)/i,
        // narrative: value (simple format)
        /(?:^|\n)\s*narrative:\s*([^\n|]+)/i,
        // **Narrative**: value
        /\*\*Narrative\*\*[:\s]+([^\n|*]+)/i,
        // | Narrative | value |
        /\|\s*Narrative\s*\|\s*([^|]+)\|/i,
      ];

      for (const pattern of narrativePatterns) {
        const match = combinedText.match(pattern);
        if (match && match[1]) {
          const narrative = cleanText(match[1].trim());
          if (narrative.length > 2 && narrative.length < 100 &&
              !narrative.includes('AT_RISK') && !narrative.includes('USER') &&
              !narrative.toLowerCase().includes('unknown')) {
            result.narrative = narrative;
            console.log(`parseGumloopOutputs: Found narrative in text content: "${narrative}"`);
            break;
          }
        }
      }
    }
  }

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
