# Changelog

This file tracks changes made during Claude Code sessions. New agents should read this to understand recent modifications and current state.

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
