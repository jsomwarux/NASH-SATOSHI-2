# Changelog

This file tracks changes made during Claude Code sessions. New agents should read this to understand recent modifications and current state.

---

## Session: 2026-01-09 Part 3 (Latest)

### Summary
Fixed missing Market Cap modifier in Score Modifiers section. Updated Social Signals section with more reliable fields (Community Status, Account Quality) replacing unreliable X Sentiment and X Mentions Trend.

### Changes Made

#### 1. Market Cap Modifier Fix
- **Server-side calculation** - Added logic to calculate `marketCapModifier` when a score is capped
- **Calculation**: `cappedScore - uncappedScore` (e.g., -15 for mega-cap capped from 95 to 80)
- **Fallback**: Uses Gumloop-provided value if available, otherwise calculates server-side
- **Updated both handlers** - Polling handler and webhook handler in routes.ts
- **Adjusted modifier box sizing** - Reduced min-w to 70px and max-w to 110px for 6 modifiers on one row

#### 2. Social Signals Section Overhaul
- **New 4-card layout** - Changed from 3-column to 4-column grid (2x2 on mobile)
- **New fields**:
  - `communityStatus` - Very Active/Active/Moderate/Low/Dead
  - `accountQuality` - Builders/Researchers, Traders/Degens, Mixed Quality, Promoters/Shills
- **Replaced unreliable fields** - X Sentiment and X Mentions Trend often showed "N/A"
- **Color coding for Community Status**:
  - Very Active → green, Active → emerald, Moderate → yellow, Low → orange, Dead → red
- **Color coding for Account Quality**:
  - Builders/Researchers → green, Traders/Degens → cyan, Mixed → yellow, Promoters/Shills → orange, Bots/Spam → red
- **Notable KOLs** - Shows "None identified" instead of "—" when empty
- **Backward compatibility** - Parser falls back to old long field names for existing analyses

#### 3. Gumloop Parser Updates
- Added `communityStatus` and `accountQuality` to ParsedGumloopResponse interface
- Added field aliases with fallbacks:
  - `community_status` → `community_coordination_active_community_status`
  - `account_quality` → `account_analysis_account_quality_assessment`
  - `top_kols` → `x_top_kols`
- Updated both text-based parser and direct outputs parser

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added server-side marketCapModifier calculation in both handlers |
| `server/gumloop-parser.ts` | Added communityStatus, accountQuality fields with fallback aliases |
| `shared/schema.ts` | Added community_status and account_quality columns |
| `client/src/components/scorecard/ScoreCard.tsx` | New 4-card Social Signals layout, adjusted modifier box sizing |

### Database Migration Required
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS community_status TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS account_quality TEXT;
```

### Current State
- Market Cap modifier now displays for capped analyses (mid/large/mega cap tokens)
- Social Signals shows 4 cards: Narrative Heat, Community Status, Account Quality, Notable KOLs
- No more "N/A" values in Social Signals section
- All TypeScript compiles successfully

---

## Session: 2026-01-09 Part 2

### Summary
Score formatting standardization, market cap badge fixes, ScoreCard UI improvements, and critical cancel analysis fix (Gumloop API integration). Also improved error handling in AnalysisTrackerContext.

### Changes Made

#### 1. Score Formatting Utilities
- **Created utility functions** in `client/src/lib/utils.ts`:
  - `formatScore()` - 2 decimal places for final/model/average scores (e.g., "82.00")
  - `formatComponentScore()` - 1 decimal place for component scores (e.g., "8.5")
  - `formatModifier()` - 1 decimal with +/- sign for modifiers (e.g., "+2.5", "-1.0")
- **Updated all score displays** across: ScoreCard.tsx, LeaderboardTable.tsx, ModelAnalysisModal.tsx, ShareCard.tsx, ShareModal.tsx, Analyses.tsx, Leaderboard.tsx

#### 2. Market Cap Badge Fix
- **Updated tier thresholds** in `server/routes.ts` (two locations):
  - Micro: <$10M (was <$100M)
  - Small: $10M-$50M (was $100M-$500M)
  - Mid: $50M-$250M (was $500M-$1B)
  - Large: $250M-$1B (was $1B-$10B)
  - Mega: >$1B (was >$10B)
- **Added all tier colors** to ScoreCard badge display

#### 3. ScoreCard UI Improvements
- **Modifiers layout** - Changed from grid to flexbox (`flex flex-wrap gap-2` with `flex-1 min-w-[80px] max-w-[120px]`)
- **Share/Reanalyze buttons** - Now display text labels instead of icon-only
- **Removed redundant "Latest of X" badge** - Count now integrated into average score section

#### 4. Cancel Analysis Fix (Critical)
- **Extended cancel window** from 30 seconds to 60 seconds
- **Fixed Gumloop API endpoint** - Changed from non-existent `terminate_pl_run` to `/kill_pipeline`
- **Fixed request format** - Parameters sent as JSON body instead of URL query params
- **Backend updated** to allow cancellation even when gumloopRunId is set
- **Added debug logging** throughout cancel flow for troubleshooting

#### 5. AnalysisTrackerContext Error Handling
- **Cancelled status handling** - Silently untrack cancelled analyses
- **404/Not found handling** - Untrack analyses that no longer exist
- **Rate limit handling** - Silently skip rate-limited requests instead of logging errors

### Files Modified
| File | Changes |
|------|---------|
| `client/src/lib/utils.ts` | Added formatScore(), formatComponentScore(), formatModifier() utilities |
| `client/src/components/scorecard/ScoreCard.tsx` | Score formatting, modifiers flexbox layout, button text labels, market cap badge colors, cancel window extended to 60s |
| `client/src/components/leaderboard/LeaderboardTable.tsx` | Updated to use formatScore() |
| `client/src/components/scorecard/ModelAnalysisModal.tsx` | Updated to use formatScore() |
| `client/src/components/share/ShareCard.tsx` | Updated to use formatScore() |
| `client/src/components/share/ShareModal.tsx` | Updated to use formatScore() |
| `client/src/pages/Analyses.tsx` | Updated to use formatScore() |
| `client/src/pages/Leaderboard.tsx` | Updated to use formatScore() |
| `server/routes.ts` | Market cap tier thresholds updated, cancel endpoint fixed with /kill_pipeline API |
| `client/src/contexts/AnalysisTrackerContext.tsx` | Added error handling for cancelled, 404, and rate limit |
| `client/src/hooks/useAnalysis.ts` | Added console logging for cancel debugging |
| `client/src/pages/Analyze.tsx` | Added console logging for handleCancel debugging |

### Commands Run
- `npx tsc --noEmit` - Verified TypeScript compilation
- Replit republish - Deployed changes to production

### Current State
- Scores display with consistent decimal formatting (2 decimals for final/model scores, 1 for components, +/- for modifiers)
- Market cap badges show correct category based on new thresholds
- Cancel analysis works correctly with Gumloop pipeline termination
- Analysis tracker gracefully handles edge cases (cancelled, not found, rate limited)
- All TypeScript compiles successfully

---

## Session: 2026-01-09 Part 1

### Summary
Major reliability improvements: fixed database connection issues, improved Gumloop output parsing, and added clickable model analysis modals. Added scorecard enhancements: average score display, reanalyze button, and cancel analysis capability.

### All Changes Made Today

#### 1. Database Reliability (Transient Error Handling)
- **Added `withRetry()` wrapper** in `server/db.ts` - Exponential backoff with jitter for connection errors
- **Wrapped critical storage operations** - `createAnalysis`, `getAnalysis`, `getAnalysisByToken`, `getAnalysisByRunId`, `updateAnalysis`, `getUserAnalyses`, `getUserSubscription`, `getLeaderboard`
- **Retryable errors**: ECONNRESET, ETIMEDOUT, ECONNREFUSED, connection terminated, too many clients

#### 2. Frontend Retry Logic
- `useAnalysis` hook: 5 retries with 500ms-5s exponential backoff
- `useAnalysisByToken` hook: 3 retries
- `useUserAnalyses` hook: 3 retries
- `analyzeTokenMutation`: 3 retries
- All leaderboard hooks: 3 retries

#### 3. Gumloop Parser Improvements
- **Improved OUTPUT SUMMARY detection** - Added patterns for `---OUTPUT SUMMARY---`, kv-block detection
- **Fallback kv-block detection** - Scans from end of text for consecutive `field: value` lines
- **Improved line parsing** - Handles bullet points, numbered lists, markdown formatting
- **Added fallback extraction** - If model scores/narrative missing from OUTPUT SUMMARY, extracts from markdown body
- **Better logging** - Parser logs field count and which fields were found

#### 4. Clickable Model Analysis Feature
- **New `ModelAnalysisModal` component** - Shows model verdict, reasoning, and risks
- **Made model cards clickable** in 4-Model Consensus section
- **Added `ModelAnalysis` and `ModelAnalyses` types** to schema
- **Added `modelAnalyses` JSONB column** to database
- **Parses new fields**: `gpt_verdict`, `gpt_reasoning`, `gpt_risks` (same for claude, gemini, grok)

#### 5. Removed Global Concurrent Analysis Limit
- **Removed 100 concurrent analysis limit** - Was blocking users unnecessarily
- **Research showed Gumloop queues excess requests** - They scale to 1000x concurrent limit
- **Neon supports 10,000 connections** - Database is not the bottleneck
- **Per-user limit of 2 still prevents abuse** - Individual users can't overwhelm system

#### 6. Graceful Failed Analysis Handling (Major Feature)
- **Credits only deducted on SUCCESS** - Users no longer lose credits/usage when analyses fail
- **Added `chargeType` column** - Stores intended charge type (daily/weekly/monthly/credit) for deferred charging
- **Added error tracking columns** - `errorMessage`, `errorCode`, `retryCount` for detailed failure info
- **Error codes**: TIMEOUT, PIPELINE_ERROR, API_ERROR, RATE_LIMIT, EMPTY_OUTPUT, TERMINATED
- **New retry endpoint** - `POST /api/analyze/:id/retry` with 3-attempt limit
- **Enhanced failure UI** - Shows error type with appropriate icon/color, error message, retry count
- **Retry button** - Users can retry failed analyses (up to 3 times total)
- **All failure paths updated** - Webhook, polling, startup, timeout, empty output now store error details

#### 7. Minor UI Updates
- Updated TokenSearch placeholder to mention contract addresses

#### 8. Scorecard Enhancements (Major Feature)
- **Average Score Display** - For tokens with multiple analyses, shows average score alongside current score
- **"Latest of N" Badge** - Indicates when viewing the most recent of multiple analyses
- **Reanalyze Button** - One-click button to perform a fresh analysis of the current token
- **Cancel Analysis** - Users can cancel analysis within ~30 seconds (before Gumloop starts consuming credits)
- **Cancelled Status UI** - Clean display for cancelled analyses with option to analyze again
- **New token stats endpoint** - `GET /api/token/:tokenId/stats` returns aggregate data
- **New cancel endpoint** - `POST /api/analyze/:id/cancel` allows cancellation before gumloopRunId is set
- **Added 'cancelled' status** - New analysis status for user-cancelled analyses

### Files Modified
| File | Changes |
|------|---------|
| `server/db.ts` | Added `withRetry()` utility with exponential backoff |
| `server/storage.ts` | Wrapped 8 database operations with retry logic |
| `server/routes.ts` | Moved credit deduction to completion, added retry endpoint, error tracking |
| `server/gumloop-parser.ts` | Improved OUTPUT SUMMARY extraction and line parsing |
| `shared/schema.ts` | Added error columns (errorMessage, errorCode, retryCount, chargeType) |
| `client/src/lib/api.ts` | Added `retryAnalysis()` API function |
| `client/src/hooks/useAnalysis.ts` | Added `useRetryAnalysis` hook, improved retry config |
| `client/src/hooks/useAnalyses.ts` | Added retry logic |
| `client/src/hooks/useLeaderboard.ts` | Added retry logic |
| `client/src/components/scorecard/ScoreCard.tsx` | Enhanced failure UI with retry button |
| `client/src/components/scorecard/ModelAnalysisModal.tsx` | New component |
| `client/src/pages/Analyze.tsx` | Wired up retry functionality |
| `client/src/components/search/TokenSearch.tsx` | Updated placeholder text |
| `PROJECT_CONTEXT.md` | Added Gumloop output format documentation |
| `CHANGELOG.md` | This file |
| `server/storage.ts` | Added `getAnalysesByTokenId()` method for aggregate stats |
| `shared/schema.ts` | Added 'cancelled' to analysisStatusSchema, added TokenStats interface |
| `client/src/lib/api.ts` | Added `cancelAnalysis()`, `getTokenStats()` API functions |
| `client/src/hooks/useAnalysis.ts` | Added `useCancelAnalysis`, `useTokenStats` hooks |
| `client/src/pages/Analyze.tsx` | Added cancel, reanalyze, and token stats functionality |
| `client/src/components/scorecard/ScoreCard.tsx` | Added cancel button, reanalyze button, average score display, cancelled state |

### Database Migration Required
Run this SQL in Supabase (Production) if not already done:
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS model_analyses JSONB;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS charge_type TEXT;
```

### Current State
- Database operations retry on transient errors
- Frontend has robust retry behavior
- Parser prioritizes OUTPUT SUMMARY, falls back to markdown extraction
- Model cards are clickable with detailed modal
- **Failed analyses don't charge users** - Credits deducted only on success
- **Retry functionality** - Users can retry failed analyses up to 3 times
- **Detailed error display** - Shows error type, message, and retry count
- **Average score display** - Tokens with multiple analyses show average alongside current score
- **Reanalyze button** - One-click reanalysis on completed scorecards
- **Cancel analysis** - Users can cancel before Gumloop starts (~30 second window)
- All TypeScript compiles successfully

---

## Session: 2026-01-08

### Summary
Added clickable model cards in the 4-Model Consensus section. Clicking a model opens a modal showing verdict, reasoning, and key risks.

### Changes Made
1. Created `ModelAnalysis` and `ModelAnalyses` types in `shared/schema.ts`
2. Added `modelAnalyses` JSONB column to `tokenAnalyses` table
3. Updated Gumloop parser with field aliases for model verdict/reasoning/risks
4. Created `ModelAnalysisModal.tsx` component
5. Made model cards clickable with hover effects and "Click for details" hint
6. Added fallback UI for legacy analyses without model data

---

## Session: 2026-01-07

### Summary
Fixed Gumloop integration to properly send token input to the analysis pipeline.

### Changes Made
1. Fixed Gumloop API call format - `user_id` and `saved_item_id` as URL params
2. Switched to `pipeline_inputs` array format
3. Removed $ prefix from token input
4. Removed Chain input (CoinGecko handles auto-detection)
5. Updated loading screen phase times (total ~23 min)

---

## Template for Future Sessions

```markdown
## Session: YYYY-MM-DD

### Summary
[Brief 1-2 sentence description]

### Changes Made
1. [Change 1]
2. [Change 2]

### Files Modified
- `path/to/file.ts` - [what changed]

### Commands Run
- `command` - [purpose]

### Current State
[What's working now]

### Still Needs Work
- [Issue 1]
```
