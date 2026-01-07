import type { ModelScores } from "@shared/schema";

export interface ParsedGumloopResponse {
  // Primary results
  finalScore: number;
  tier: string;
  phase: number;
  phaseName: string;

  // Narrative
  narrative?: string;
  narrativeHeat?: number;
  narrativeAcceleration?: string;

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
  totalModifiers?: number;
  penalties?: number;

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

// Extract a structured field value from the text
// Handles formats like: field_name: value, | field_name | value |, **field_name**: value
function extractField(text: string, fieldName: string): string | null {
  // Normalize field name for regex (handle underscores and spaces)
  const normalizedName = fieldName.replace(/_/g, '[_\\s]*');

  const patterns = [
    // Table format: | field_name | value |
    new RegExp(`\\|\\s*${normalizedName}\\s*\\|\\s*([^|\\n]+)\\s*\\|`, 'i'),
    // Bold label: **field_name**: value or **field_name** | value
    new RegExp(`\\*\\*${normalizedName}\\*\\*[:\\s|]+([^\\n|]+)`, 'i'),
    // Simple label: field_name: value
    new RegExp(`${normalizedName}[:\\s]+([^\\n|]+)`, 'i'),
    // Markdown table with header
    new RegExp(`${normalizedName}\\s*\\|\\s*([^|\\n]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].replace(/\*\*/g, '').trim();
      if (value && value !== '-' && value !== 'N/A') {
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

// Parse the new structured OUTPUT SUMMARY format
function parseStructuredOutput(text: string, result: ParsedGumloopResponse): void {
  // Core Scores
  const finalScore = extractNumericField(text, 'final_score');
  if (finalScore !== undefined && finalScore >= 0 && finalScore <= 100) {
    result.finalScore = finalScore;
  }

  const tier = extractField(text, 'final_tier');
  if (tier) {
    const cleanTier = tier.toUpperCase().replace(/[^A-Z+]/g, '');
    if (['S+', 'S', 'A', 'B', 'C', 'D', 'F', 'DISQUALIFIED', 'DQ'].includes(cleanTier)) {
      result.tier = cleanTier;
    }
  }

  const consensusLevel = extractField(text, 'consensus_level');
  if (consensusLevel) {
    const level = consensusLevel.toUpperCase();
    if (['HIGH', 'MIXED', 'LOW', 'CONFLICTED'].includes(level)) {
      result.consensusLevel = level;
    }
  }

  const phase = extractNumericField(text, 'phase');
  if (phase !== undefined && phase >= 1 && phase <= 5) {
    result.phase = phase;
  }

  const phaseName = extractField(text, 'phase_name');
  if (phaseName) {
    result.phaseName = cleanText(phaseName);
  }

  const peakProximity = extractNumericField(text, 'peak_proximity_pct');
  if (peakProximity !== undefined && peakProximity >= 0 && peakProximity <= 100) {
    result.peakProximity = peakProximity;
  }

  const winningSide = extractField(text, 'winning_side');
  if (winningSide) {
    const side = winningSide.toUpperCase();
    if (side.includes('USER')) result.winningSide = 'USER';
    else if (side.includes('EXIT') || side.includes('LIQUIDITY')) result.winningSide = 'EXIT_LIQ';
    else result.winningSide = 'AT_RISK';
  }

  const confidence = extractField(text, 'confidence');
  if (confidence) {
    const conf = confidence.toUpperCase().charAt(0);
    if (['H', 'M', 'L'].includes(conf)) {
      result.confidence = conf;
    }
  }

  const recommendation = extractField(text, 'recommendation');
  if (recommendation) {
    const rec = recommendation.toUpperCase();
    if (rec.includes('BUY')) result.recommendation = 'BUY';
    else if (rec.includes('AVOID') || rec.includes('SELL')) result.recommendation = 'AVOID';
    else result.recommendation = 'HOLD';
  }

  // Component Scores
  const coordinationScore = extractNumericField(text, 'coordination_score');
  if (coordinationScore !== undefined) result.coordinationScore = coordinationScore;

  const schellingScore = extractNumericField(text, 'schelling_score');
  if (schellingScore !== undefined) result.schellingRankScore = schellingScore;

  const reflexivityScore = extractNumericField(text, 'reflexivity_score');
  if (reflexivityScore !== undefined) result.reflexivityScore = reflexivityScore;

  const viralityScore = extractNumericField(text, 'virality_score');
  if (viralityScore !== undefined) result.viralityScore = viralityScore;

  const asymmetryScore = extractNumericField(text, 'asymmetry_score');
  if (asymmetryScore !== undefined) result.asymmetryScore = asymmetryScore;

  const gameTheoryScore = extractNumericField(text, 'game_theory_score');
  if (gameTheoryScore !== undefined) result.gameTheoryBonus = gameTheoryScore;

  const baseScore = extractNumericField(text, 'base_score');
  if (baseScore !== undefined) result.baseScore = baseScore;

  // Modifiers
  const phaseModifier = extractNumericField(text, 'phase_modifier');
  if (phaseModifier !== undefined) result.phaseModifier = phaseModifier;

  const narrativeModifier = extractNumericField(text, 'narrative_modifier');
  if (narrativeModifier !== undefined) result.narrativeModifier = narrativeModifier;

  const exitLiquidityModifier = extractNumericField(text, 'exit_liquidity_modifier');
  if (exitLiquidityModifier !== undefined) result.exitLiquidityModifier = exitLiquidityModifier;

  const peakProximityModifier = extractNumericField(text, 'peak_proximity_modifier');
  if (peakProximityModifier !== undefined) result.peakProximityModifier = peakProximityModifier;

  const dataQualityModifier = extractNumericField(text, 'data_quality_modifier');
  if (dataQualityModifier !== undefined) result.dataQualityModifier = dataQualityModifier;

  const totalModifiers = extractNumericField(text, 'total_modifiers');
  if (totalModifiers !== undefined) result.totalModifiers = totalModifiers;

  const penalties = extractNumericField(text, 'penalties');
  if (penalties !== undefined) result.penalties = penalties;

  // Context
  const narrative = extractField(text, 'narrative');
  if (narrative && narrative.length > 2 && narrative.length < 100) {
    result.narrative = cleanText(narrative);
  }

  const narrativeHeat = extractNumericField(text, 'narrative_heat');
  if (narrativeHeat !== undefined && narrativeHeat >= 0 && narrativeHeat <= 10) {
    result.narrativeHeat = narrativeHeat;
  }

  const schellingPosition = extractField(text, 'schelling_position');
  if (schellingPosition) {
    result.schellingPosition = cleanText(schellingPosition);
  }

  const equilibriumType = extractField(text, 'equilibrium_type');
  if (equilibriumType) {
    result.equilibriumType = cleanText(equilibriumType);
  }

  // Model Scores
  const gptScore = extractNumericField(text, 'gpt_score');
  if (gptScore !== undefined) result.modelScores.gpt = gptScore;

  const claudeScore = extractNumericField(text, 'claude_score');
  if (claudeScore !== undefined) result.modelScores.claude = claudeScore;

  const geminiScore = extractNumericField(text, 'gemini_score');
  if (geminiScore !== undefined) result.modelScores.gemini = geminiScore;

  const grokScore = extractNumericField(text, 'grok_score');
  if (grokScore !== undefined) result.modelScores.grok = grokScore;

  const modelAgreement = extractField(text, 'model_agreement');
  if (modelAgreement) {
    result.modelAgreement = cleanText(modelAgreement);
  }

  // Risks
  const risks: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const risk = extractField(text, `risk_${i}`);
    if (risk && risk.length > 3) {
      risks.push(cleanText(risk));
    }
  }
  if (risks.length > 0) {
    result.coordinationRisks = risks;
  }

  // Catalysts
  const catalysts: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const catalyst = extractField(text, `catalyst_${i}`);
    if (catalyst && catalyst.length > 3) {
      catalysts.push(cleanText(catalyst));
    }
  }
  if (catalysts.length > 0) {
    result.catalysts = catalysts;
  }

  // Display Text
  const displaySummary = extractField(text, 'display_summary');
  if (displaySummary) {
    result.displaySummary = cleanText(displaySummary);
  }

  const verdict = extractField(text, 'verdict');
  if (verdict) {
    result.verdict = cleanText(verdict);
  }

  const reasoning = extractField(text, 'reasoning');
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
function parseLegacyFormat(rawText: string, result: ParsedGumloopResponse): void {
  // FINAL SCORE
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

  // TIER
  const tierPatterns = [
    /\*\*FINAL\s*TIER\*\*\s*\|\s*\*\*([A-Z+]+)/i,
    /FINAL\s*TIER[:\s|]+\*?\*?([A-Z+]+)/i,
    /\|\s*TIER\s*\|\s*\*?\*?([A-Z+]+)/i,
  ];
  for (const pattern of tierPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const tier = match[1].replace(/\*/g, '').trim().toUpperCase();
      if (['S+', 'S', 'A', 'B', 'C', 'D', 'F', 'DISQUALIFIED', 'DQ'].includes(tier)) {
        result.tier = tier;
        break;
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

  // GAME THEORY (legacy)
  if (!result.equilibriumType) {
    const eqMatch = rawText.match(/Equilibrium(?:\s*Type)?[:\s]*([^\n|]+)/i);
    if (eqMatch) result.equilibriumType = cleanText(eqMatch[1]);
  }
  if (!result.dominantStrategies) {
    const stratMatch = rawText.match(/Dominant\s*Strateg(?:y|ies)[:\s]*([^\n|]+)/i);
    if (stratMatch) result.dominantStrategies = cleanText(stratMatch[1]);
  }
}

// Calculate tier from final score
function calculateTierFromScore(score: number): string {
  if (score >= 85) return 'S+';
  if (score >= 70) return 'S';
  if (score >= 55) return 'A';
  if (score >= 40) return 'B';
  return 'DISQUALIFIED';
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
    // First, try to parse the new structured format
    parseStructuredOutput(rawText, result);

    // Then, fill in any missing fields with legacy parsing
    parseLegacyFormat(rawText, result);

    // Calculate tier from score if not parsed successfully
    if (!result.tier || result.tier === '') {
      result.tier = calculateTierFromScore(result.finalScore);
    }

    // Calculate missing component scores if we have a final score but missing components
    if (result.finalScore > 0) {
      const base = result.finalScore;
      if (!result.coordinationScore) result.coordinationScore = Math.round(base * 0.2 * 10) / 10;
      if (!result.schellingRankScore) result.schellingRankScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.reflexivityScore) result.reflexivityScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.viralityScore) result.viralityScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.asymmetryScore) result.asymmetryScore = Math.round(base * 0.15 * 10) / 10;
      if (!result.gameTheoryBonus) result.gameTheoryBonus = Math.round(base * 0.2 * 10) / 10;
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
