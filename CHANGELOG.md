# Changelog

This file tracks changes made during Claude Code sessions. New agents should read this to understand recent modifications and current state.

---

## Session: 2026-01-09 (Latest)

### Summary
Major reliability improvements: fixed database connection issues, improved Gumloop output parsing, and added clickable model analysis modals.

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
