# Changelog

This file tracks changes made during Claude Code sessions. New agents should read this to understand recent modifications and current state.

---

## Session: 2026-01-09 (Update 3)

### Summary
Improved OUTPUT SUMMARY parser to better handle Gumloop's text-based markdown output format. Added comprehensive documentation.

### Changes Made
1. **Improved OUTPUT SUMMARY section detection** - Added more regex patterns including `---OUTPUT SUMMARY---`, kv-block detection as last resort
2. **Added fallback kv-block detection** - If no header found, scans from end of text for consecutive `field: value` lines
3. **Improved line parsing** - Now handles bullet points (`- field: value`), numbered lists (`1. field: value`), and various markdown formatting
4. **Added logging** - Parser now logs how many fields were extracted and which fields were found
5. **Updated PROJECT_CONTEXT.md** - Added comprehensive documentation on Gumloop output format and parsing strategy

### Files Modified
- `server/gumloop-parser.ts` - Rewrote `extractOutputSummarySection()` and `parseOutputSummaryToMap()` for better robustness
- `PROJECT_CONTEXT.md` - Added "Gumloop Output Format" section explaining the text-based format and field aliases

### Key Understanding
Gumloop returns a **single text string** (not JSON) containing:
- LLM-generated markdown analysis
- An OUTPUT SUMMARY section at the end with `field_name: value` pairs

The parser prioritizes the OUTPUT SUMMARY section, then falls back to extracting from markdown body.

---

## Session: 2026-01-09 (Update 2)

### Summary
Fixed missing 4-Model Consensus section and narrative defaulting to "Utility/Infrastructure" by adding fallback parsing logic.

### Changes Made
1. **Added fallback model score extraction** - If direct field parser returns empty model scores, now falls back to text-based extraction from the raw output
2. **Added fallback narrative extraction** - If narrative is missing, extracts it from analysis_result text using regex patterns
3. **Added fallback model analyses extraction** - Recovers per-model verdict/reasoning/risks from text if missing

### Files Modified
- `server/routes.ts` - Added fallback parsing in both polling locations (lines ~1414-1455 and ~1740-1781)

### Root Cause
The Gumloop output format may vary - sometimes fields are in structured format, sometimes embedded in text. The parser was only trying one method. Now it tries direct field parsing first, then falls back to text extraction.

---

## Session: 2026-01-09

### Summary
Fixed intermittent "Analysis failed" and "Analysis not found" errors by adding database connection retry logic and improving frontend retry configuration.

### Changes Made
1. **Added database retry wrapper** - Created `withRetry()` function in `db.ts` with exponential backoff and jitter for handling transient connection errors (ECONNRESET, ETIMEDOUT, connection terminated, etc.)
2. **Wrapped critical storage operations** - Applied retry wrapper to: `createAnalysis`, `getAnalysis`, `getAnalysisByToken`, `getAnalysisByRunId`, `updateAnalysis`, `getUserAnalyses`, `getUserSubscription`, `getLeaderboard`
3. **Improved frontend retry logic** - Increased retry attempts and added exponential backoff delays to:
   - `useAnalysis` hook: 5 retries with 500ms-5s exponential backoff
   - `useAnalysisByToken` hook: 3 retries
   - `analyzeTokenMutation`: 3 retries for starting analyses
   - All leaderboard hooks: 3 retries
4. **Root cause analysis** - Identified issues as transient database connection failures causing intermittent 404s and failed operations

### Files Modified
- `server/db.ts` - Added `withRetry()` utility function with exponential backoff
- `server/storage.ts` - Wrapped 8 critical database operations with retry logic
- `client/src/hooks/useAnalysis.ts` - Improved retry config for analysis fetching and creation
- `client/src/hooks/useLeaderboard.ts` - Added retry logic to all leaderboard hooks

### Commands Run
- `npx tsc --noEmit` - TypeScript compilation check passed

### Current State
- Database operations now automatically retry on transient connection errors
- Frontend fetches have better retry behavior with exponential backoff
- Both analysis creation and viewing should be more reliable

### Notes
- Retry logic uses exponential backoff with jitter to prevent thundering herd
- Maximum 3 retries on backend, 3-5 on frontend depending on operation criticality
- Retryable errors include: ECONNRESET, ETIMEDOUT, connection terminated, too many clients

---

## Session: 2026-01-08

### Summary
Added clickable model cards in the 4-Model Consensus section. Clicking a model now opens a modal showing that model's verdict, reasoning, and key risks.

### Changes Made
1. **Added new TypeScript interfaces** - Created `ModelAnalysis` and `ModelAnalyses` types in `shared/schema.ts` to hold per-model verdict, reasoning, and risks
2. **Added database field** - Added `modelAnalyses` JSONB column to `tokenAnalyses` table
3. **Updated Gumloop parser** - Added field aliases and parsing logic for new fields (`gpt_verdict`, `gpt_reasoning`, `gpt_risks`, etc.) in both `parseStructuredOutput` and `parseGumloopOutputs` functions
4. **Created ModelAnalysisModal component** - New modal component that displays model name, score, verdict, reasoning, and risks with appropriate styling
5. **Made model cards clickable** - Updated 4-Model Consensus section in ScoreCard to use buttons with hover effects and "Click for details" hint
6. **Added fallback UI** - Modal shows "Analysis details not available" message for legacy analyses without detailed model data
7. **Updated routes.ts** - Added `modelAnalyses` to database saves when storing analysis results

### Files Modified
- `shared/schema.ts` - Added `ModelAnalysis`, `ModelAnalyses` interfaces and `modelAnalyses` DB field
- `server/gumloop-parser.ts` - Added field aliases and parsing for model verdict/reasoning/risks
- `server/routes.ts` - Added `modelAnalyses` to analysis save operations
- `client/src/components/scorecard/ModelAnalysisModal.tsx` - New file for model detail modal
- `client/src/components/scorecard/ScoreCard.tsx` - Made model cards clickable, added modal integration

### Commands Run
- `npx tsc --noEmit` - TypeScript compilation check passed

### Current State
- Model cards in 4-Model Consensus section are now clickable
- Clicking opens a modal with model's detailed analysis (verdict, reasoning, risks)
- Backward compatible: legacy analyses show "Analysis details not available" fallback
- New Gumloop fields will be parsed from: `gpt_verdict`, `gpt_reasoning`, `gpt_risks`, `claude_verdict`, `claude_reasoning`, `claude_risks`, `gemini_verdict`, `gemini_reasoning`, `gemini_risks`, `grok_verdict`, `grok_reasoning`, `grok_risks`

### Still Needs Testing/Verification
- Verify Gumloop pipeline actually outputs the new model analysis fields
- Test end-to-end with real analysis to confirm modal displays data correctly
- Previous uncommitted retry logic in routes.ts is still present

---

## Session: 2026-01-07

### Summary
Fixed Gumloop integration to properly send token input to the analysis pipeline. Updated loading screen with accurate phase timing.

### Changes Made
1. **Fixed Gumloop API call format** - Moved `user_id` and `saved_item_id` from request body to URL query parameters per Gumloop docs
2. **Switched to `pipeline_inputs` array format** - Using `{ input_name: "Token Input", value: tokenSymbol }` structure
3. **Removed $ prefix from token input** - CoinGecko expects raw symbol (e.g., "DEXTER" not "$DEXTER")
4. **Removed Chain input** - CoinGecko node handles chain auto-detection internally
5. **Updated loading screen phase times**:
   - Collecting Data: 0-15% (~7 min)
   - LLM Analysis: 15-55% (~7 min)
   - Cross-Validation: 55-80% (~7 min)
   - Score Aggregation: 80-100% (~2 min)
6. **Added time estimates to phase UI** - Each phase now shows "~X min" next to label
7. **Updated total estimated time to 23 minutes**

### Files Modified
- `server/routes.ts` - Gumloop integration (lines ~838-920)
- `client/src/components/scorecard/ScoreCard.tsx` - Loading screen phases

### Commands Run
- `npx tsc --noEmit` - TypeScript compilation checks

### Current State
- Gumloop integration should now receive token input correctly
- Awaiting user test to confirm end-to-end analysis works
- Loading screen displays accurate phase timing

### Still Needs Testing/Verification
- Full analysis pipeline completion
- Price data population on scorecard
- Leaderboard aggregation with real data

---

## Template for Future Sessions

```markdown
## Session: YYYY-MM-DD

### Summary
[Brief 1-2 sentence description of what was accomplished]

### Changes Made
1. [Change 1]
2. [Change 2]
...

### Files Modified
- `path/to/file.ts` - [what was changed]

### Commands Run
- `command` - [purpose]

### Current State
[What's working now]

### Still Broken / Needs Work
- [Issue 1]
- [Issue 2]
```
