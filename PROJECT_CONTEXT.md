# Project Context: Crypto Game Theory Token Analyzer

## What This App Is

A web application that analyzes cryptocurrency tokens using a **4-LLM consensus engine** (ChatGPT, Claude, Gemini, Grok). The app applies game theory principles to evaluate tokens and provide trusted consensus scores, helping users avoid being "exit liquidity" in crypto markets.

### Core Value Proposition
- 4 AI models analyze tokens independently
- Models cross-validate each other's findings to eliminate bias
- Final score (0-100) represents game-theoretic viability
- Tiered scoring: S+ (85+), S (70-84), A (55-69), B (40-54), C (<40)

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for bundling
- **Wouter** for routing
- **TanStack Query** for data fetching/caching (with retry logic)
- **Tailwind CSS** + **shadcn/ui** components
- **Framer Motion** for animations

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL (Neon)
- **Supabase Auth** for authentication
- **Database retry wrapper** for transient connection errors

### External Services
- **Gumloop** - Orchestrates the 4-LLM analysis pipeline
- **CoinGecko API** - Token search and price data
- **Stripe** - Subscription billing and credit purchases

---

## Project Structure

```
/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── scorecard/     # ScoreCard.tsx, ModelAnalysisModal.tsx
│   │   │   ├── leaderboard/   # LeaderboardTable.tsx
│   │   │   ├── search/        # TokenSearch.tsx
│   │   │   └── ui/            # shadcn components
│   │   ├── hooks/             # React Query hooks (with retry logic)
│   │   ├── contexts/          # Auth, AnalysisTracker contexts
│   │   ├── lib/               # API client, utils
│   │   ├── pages/             # Route pages
│   │   └── types/             # TypeScript types
│   └── index.html
├── server/
│   ├── routes.ts              # API endpoints, Gumloop integration
│   ├── gumloop-parser.ts      # OUTPUT SUMMARY parser (critical)
│   ├── storage.ts             # Database operations (with retry)
│   ├── db.ts                  # Connection pool, withRetry() wrapper
│   ├── auth.ts                # Supabase auth middleware
│   ├── stripe.ts              # Stripe billing logic
│   └── index.ts               # Server entry point
├── shared/
│   └── schema.ts              # Drizzle schema + shared types
├── scripts/
│   └── apply-indexes.sql      # Database performance indexes
└── package.json
```

---

## How to Run

```bash
# Install dependencies
npm install

# Start development server (runs both frontend and backend)
npm run dev

# The app runs on port 5000
```

### Required Environment Variables (Replit Secrets)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `GUMLOOP_API_KEY` | Gumloop API authentication |
| `GUMLOOP_PIPELINE_ID` | Gumloop saved pipeline ID |
| `GUMLOOP_USER_ID` | Gumloop user ID |
| `STRIPE_SECRET_KEY` | Stripe secret key (live or test) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (frontend) |

### Stripe Test Mode
To test without real payments, swap ALL Stripe credentials to test mode:
- `STRIPE_SECRET_KEY`: `sk_test_xxx`
- `VITE_STRIPE_PUBLIC_KEY`: `pk_test_xxx`
- `STRIPE_WEBHOOK_SECRET`: Test webhook signing secret
- All price IDs must also be test mode IDs

---

## Key Features & Current State

### Working Features
- Token search via CoinGecko proxy (supports name, symbol, contract address)
- Gumloop pipeline integration (4-LLM analysis)
- Analysis loading screen with 4 phases and time estimates
- Scorecard display with full analysis results
- **Clickable model cards** - Opens modal with verdict, reasoning, risks
- Leaderboard with 7D/30D aggregated scores
- Stripe subscription tiers (Free, Trader, Pro, Whale)
- Credit pack purchases
- User authentication via Supabase
- **Database retry logic** - Handles transient connection errors

### Subscription Tiers
| Tier | Monthly Analyses | Price |
|------|------------------|-------|
| Free | 1/week (post-trial) | $0 |
| Trader | 25/month | $29 |
| Pro | 100/month | $79 |
| Whale | Unlimited | $199 |

### Analysis Pipeline Phases
1. **Collecting Data** (0-15%, ~7 min) - Market data & social signals
2. **LLM Analysis** (15-55%, ~7 min) - 4 AI models in parallel
3. **Cross-Validation** (55-80%, ~7 min) - Models check each other
4. **Score Aggregation** (80-100%, ~2 min) - Final consensus score

---

## Critical Implementation Details

### Gumloop Integration (server/routes.ts)

```typescript
// API URL format - user_id and saved_item_id are URL params, NOT body
const apiUrl = new URL("https://api.gumloop.com/api/v1/start_pipeline");
apiUrl.searchParams.set("user_id", GUMLOOP_USER_ID);
apiUrl.searchParams.set("saved_item_id", GUMLOOP_PIPELINE_ID);

// Body uses pipeline_inputs array format
const requestPayload = {
  pipeline_inputs: [
    { input_name: "Token Input", value: tokenSymbol }, // NO $ prefix
  ],
};
```

### Gumloop Input Node
- Node name: **"Token Input"** (exact, case-sensitive)
- Value: Token symbol WITHOUT $ prefix (e.g., "DEXTER" not "$DEXTER")
- CoinGecko node handles chain auto-detection internally

### Polling
- Polls `/api/v1/get_pl_run` every 5 seconds with jitter
- Max 540 attempts (45 minutes timeout)
- States: STARTED, RUNNING, DONE, TERMINATED, FAILED

---

## Gumloop Output Format (CRITICAL)

Gumloop returns a **single text response** in `analysis_result`, NOT structured JSON. The format is LLM-generated markdown with a structured **OUTPUT SUMMARY** section at the end.

### OUTPUT SUMMARY Format
```
#OUTPUT SUMMARY
final_score: 72.5
final_tier: A
narrative: AI Infrastructure
token_type: UTILITY
gpt_score: 71
claude_score: 74
gemini_score: 73
grok_score: 72
coordination_score: 8
reflexivity_score: 7
gpt_verdict: Strong fundamentals with active development
gpt_reasoning: The project shows consistent progress...
gpt_risks: Market volatility, Competition from larger players
```

### Parsing Strategy (server/gumloop-parser.ts)

1. **Primary**: Find the OUTPUT SUMMARY section
   - Patterns: `#OUTPUT SUMMARY`, `**OUTPUT SUMMARY**`, `---OUTPUT SUMMARY---`
   - Fallback: Detect block of consecutive `field: value` lines at end of text

2. **Parse line by line** using pattern: `/^([a-z_]+):\s*(.+)$/`

3. **Normalize field names** via `FIELD_ALIASES` mapping

4. **Fallback**: If fields missing from OUTPUT SUMMARY, extract from markdown body

### Field Name Normalization

| Expected Key | Variations Handled |
|--------------|-------------------|
| `final_score` | `final score`, `finalscore`, `score` |
| `final_tier` | `final tier`, `tier` |
| `narrative` | `narrative/meta`, `meta`, `primary_narrative` |
| `peak_proximity_pct` | `peak proximity`, `peak_proximity` |
| `token_type` | `tokentype`, `token type`, `type` |
| `gpt_score` | `gpt score`, `chatgpt_score`, `chatgpt` |
| `gpt_verdict` | `gpt verdict`, `chatgpt_verdict` |
| `gpt_reasoning` | `gpt reasoning`, `chatgpt_reasoning` |
| `gpt_risks` | `gpt risks`, `chatgpt_risks` |

See `FIELD_ALIASES` in `gumloop-parser.ts` for the complete mapping (~50 aliases).

---

## Complete Parsing Instructions for Scorecard & Leaderboard

This section provides exhaustive parsing instructions. Reference this when debugging parsing issues or adding new fields.

### Output Structure

The Gumloop response is a single text blob. The parseable data is in the OUTPUT SUMMARY section at the end, which uses this format:
```
field_name: value
another_field: another value
```

The section starts after "=== REQUIRED: OUTPUT SUMMARY ===" or after the "{TICKER} ANALYSIS" header.

### Parsing Strategy

1. Locate the OUTPUT SUMMARY section in the response text
2. Parse line by line, extracting field name and value pairs
3. Clean values by stripping any accidental field label prefixes
4. Convert types appropriately (numbers, arrays, etc.)

### Field Cleaning Function

The `stripFieldLabelPrefix()` utility in `gumloop-parser.ts` removes field label prefixes from values. Sometimes the LLM accidentally includes the label in the value (e.g., "thesis: RADR is building..." instead of just "RADR is building...").

Labels to strip (case-insensitive, with colon and optional space):
- narrative:, thesis:, display_summary:, recommendation:, confidence:
- phase_name:, winning_side:, equilibrium_type:
- team_status:, notable_backers:, unlock_warning:
- x_sentiment:, x_top_kols:, x_mentions_trend:
- catalyst_1:, catalyst_2:, catalyst_3:
- risk_1:, risk_2:, risk_3:
- gpt_verdict:, gpt_reasoning:, gpt_risks:
- claude_verdict:, claude_reasoning:, claude_risks:
- gemini_verdict:, gemini_reasoning:, gemini_risks:
- grok_verdict:, grok_reasoning:, grok_risks:

Apply this cleaning to all text fields during parsing.

### Complete Field Mapping

#### VERDICT Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| final_score | number | Scorecard hero, Leaderboard | Parse as float, should have 2 decimal places |
| final_tier | string | Scorecard hero, Leaderboard | Values: S+, S, A, B, C |
| recommendation | string | Scorecard hero, Leaderboard | Values: BUY, HOLD, AVOID |
| confidence | string | Scorecard hero | Values: H, M, L — display as "High Confidence", etc. |
| consensus_level | string | Scorecard hero | Values: HIGH, MIXED, LOW, CONFLICTED |
| token_type | string | Scorecard hero badge | Values: UTILITY, MEMECOIN — display as "UTIL" or "MEME" |

#### GAME STATE Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| phase | number | Key metrics row | Values: 1-5 |
| phase_name | string | Key metrics row | Values: Stealth, Expansion, Mania, Distribution, Dead |
| peak_proximity_pct | number | Key metrics row | Display as "XX%" with label |
| winning_side | string | Key metrics row | Values: USER, AT_RISK, EXIT_LIQUIDITY |
| equilibrium_type | string | Game Theory Context | Values: Fragile, Robust, Anti-fragile |

#### NARRATIVE Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| narrative | string | Key metrics row | Display clean name without prefix |
| narrative_heat | number | Key metrics row, Social Signals | Values: 1-10 |
| narrative_rank | string | Game Theory Context | Values: 1st, 2nd, 3rd, lower |

#### THESIS Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| thesis | string | Investment Thesis section | Strip "thesis:" prefix if present |

#### CATALYSTS & RISKS Sections

| Field Name | Type | Used In |
|------------|------|---------|
| catalyst_1, catalyst_2, catalyst_3 | string | Catalysts card |
| risk_1, risk_2, risk_3 | string | Key Risks card |

#### SOCIAL PULSE Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| x_mentions_trend | string | Social Signals | e.g., "up 42% over 7d" |
| x_sentiment | string | Social Signals | e.g., "80% bullish / 0% bearish" |
| x_top_kols | string | Social Signals | Comma-separated list or "None identified" |

#### TEAM & BACKERS Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| team_status | string | Team section | Values: Doxxed, Anon, Partial |
| notable_backers | string | Team section | List or "None known" |
| unlock_warning | string | Token Unlock section | "NONE" or warning text |

#### COMPONENT SCORES Section

| Field Name | Type | Max | Used In |
|------------|------|-----|---------|
| coordination_score | number | 20 | Score Breakdown |
| schelling_score | number | 10 | Score Breakdown |
| reflexivity_score | number | 15 | Score Breakdown |
| virality_score | number | 15 | Score Breakdown |
| asymmetry_score | number | 25 | Score Breakdown |
| game_theory_score | number | 15 | Score Breakdown |
| base_score | number | 100 | Score Breakdown header |

#### MODIFIERS Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| phase_modifier | number | Score Modifiers | +/- value |
| narrative_modifier | number | Score Modifiers | +/- value |
| exit_liquidity_modifier | number | Score Modifiers | +/- value |
| peak_proximity_modifier | number | Score Modifiers | +/- value |
| market_cap_modifier | number | Score Modifiers | +/- value |
| data_quality_modifier | number | Score Modifiers | +/- value |
| total_modifiers | number | Score Modifiers | Sum of all |

Display all modifiers with non-zero values. Green for positive, red for negative.

#### MODEL SCORES Section

| Field Name | Type | Used In |
|------------|------|---------|
| gpt_score | number | 4-Model Consensus |
| claude_score | number | 4-Model Consensus |
| gemini_score | number | 4-Model Consensus |
| grok_score | number | 4-Model Consensus |

#### MODEL ANALYSES Section (for click-to-view modal)

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| gpt_verdict | string | Model modal | GPT's verdict statement |
| gpt_reasoning | string | Model modal | GPT's full reasoning |
| gpt_risks | string | Model modal | Comma-separated, split into array |
| claude_verdict | string | Model modal | Claude's verdict |
| claude_reasoning | string | Model modal | Claude's reasoning |
| claude_risks | string | Model modal | Comma-separated risks |
| gemini_verdict | string | Model modal | Gemini's verdict |
| gemini_reasoning | string | Model modal | Gemini's reasoning |
| gemini_risks | string | Model modal | Comma-separated risks |
| grok_verdict | string | Model modal | Grok's verdict |
| grok_reasoning | string | Model modal | Grok's reasoning |
| grok_risks | string | Model modal | Comma-separated risks |

#### SUMMARY Section

| Field Name | Type | Used In | Notes |
|------------|------|---------|-------|
| display_summary | string | Hero section | **DO NOT generate fallback** - use actual value or show "Summary not available" |

### Scorecard Section Layout (Render Order)

1. **Hero Section** - Token info, tier badge, recommendation, score, confidence, consensus
2. **Display Summary** - Full text from display_summary field (no generic fallback)
3. **Key Metrics Row** - Phase, Narrative, Peak Proximity, Position (4 cards)
4. **4-Model Consensus** - 4 clickable model cards with scores
5. **Score Breakdown** - 6 component scores with progress bars
6. **Score Modifiers** - Non-zero modifiers with total
7. **Investment Thesis** - Full thesis text
8. **Game Theory Context** - Schelling Position, Equilibrium, Risk/Reward
9. **Team Section** - team_status
10. **Token Unlock** - unlock_warning
11. **Catalysts & Risks** - Side by side cards
12. **Social Signals** - Narrative heat, X sentiment, KOLs

### Model Analysis Modal

When user clicks a model card:
- **Header**: Model name (e.g., "ChatGPT-5.2 Analysis")
- **Score**: Large display of model's score
- **Verdict**: {model}_verdict value
- **Reasoning**: {model}_reasoning value
- **Key Risks**: {model}_risks split by comma into numbered list

### Leaderboard Fields

| Column | Field | Notes |
|--------|-------|-------|
| Rank | Calculated | Based on final_score |
| Token | Token data | Name, logo, ticker |
| Score | final_score | Color-coded by tier |
| Tier | final_tier | Badge with color |
| Phase | phase + phase_name | e.g., "2 - Expansion" |
| Narrative | narrative | Clean name |
| Heat | narrative_heat | /10 with color |
| Recommendation | recommendation | BUY/HOLD/AVOID badge |

### Error Handling & Fallbacks

| Field | If Missing |
|-------|------------|
| final_score | Show 0 or "N/A" |
| final_tier | Show "?" |
| display_summary | Show "Summary not available" — **DO NOT generate generic text** |
| thesis | Show "Thesis not available" |
| narrative | Show "Unknown" |
| model scores | Show 0 or hide the model card |
| model analyses | Show "Analysis not available" in modal |
| catalysts/risks | Show "No catalysts/risks identified" |
| x_sentiment | Show "N/A" |
| x_top_kols | Show "None identified" |

---

## Database Schema Highlights

### Key Tables (shared/schema.ts)
- `token_analyses` - Token analysis results
- `user_subscriptions` - User subscription data
- `daily_usage` - Free tier usage tracking
- `credit_purchases` - Credit pack purchases

### Analysis Fields
| Field | Type | Purpose |
|-------|------|---------|
| `finalScore` | number | 0-100 consensus score |
| `tier` | string | S+, S, A, B, C rating |
| `modelScores` | JSONB | `{ gpt, claude, gemini, grok }` scores |
| `modelAnalyses` | JSONB | Per-model verdict, reasoning, risks |
| `narrative` | string | Token category (AI, DeFi, Meme, etc.) |
| `status` | string | pending, processing, completed, failed |
| `gumloopRunId` | string | Links to Gumloop run |

### Database Resilience
- `withRetry()` wrapper in `server/db.ts` handles transient errors
- Exponential backoff with jitter prevents thundering herd
- Retries: ECONNRESET, ETIMEDOUT, connection terminated, pool exhaustion

---

## Error Handling & Retry Logic

### Backend (server/db.ts)
```typescript
// Wraps database operations with automatic retry
await withRetry(async () => {
  // database operation
}, { maxRetries: 3, initialDelayMs: 100 });
```

### Frontend (hooks)
All TanStack Query hooks have retry configuration:
- `useAnalysis`: 5 retries (critical path)
- `useLeaderboard`, `useUserAnalyses`: 3 retries
- Exponential backoff: 500ms → 1s → 2s → 4s → 5s

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `server/routes.ts` | All API endpoints, Gumloop integration, polling |
| `server/gumloop-parser.ts` | **Parses Gumloop text output** - OUTPUT SUMMARY, field normalization |
| `server/storage.ts` | Database operations with retry wrapper |
| `server/db.ts` | Connection pool, `withRetry()` utility |
| `server/stripe.ts` | Subscription & credit billing logic |
| `shared/schema.ts` | Drizzle schema, TypeScript interfaces |
| `client/src/components/scorecard/ScoreCard.tsx` | Main analysis display + loading |
| `client/src/components/scorecard/ModelAnalysisModal.tsx` | Per-model details modal |
| `client/src/hooks/useAnalysis.ts` | Analysis fetching with polling |
| `client/src/hooks/useLeaderboard.ts` | Leaderboard data hooks |
| `scripts/apply-indexes.sql` | Database performance indexes |

---

## Debugging Tips

### Parser Issues
Check server logs for:
```
Parser: Found OUTPUT SUMMARY section (1234 chars, 15 kv lines)
Parser: Parsed 12 fields from OUTPUT SUMMARY
Parser: OUTPUT SUMMARY fields: final_score, final_tier, narrative...
```

### Database Connection Issues
Look for retry messages:
```
Database operation failed (attempt 1/3), retrying in 150ms: connection terminated
```

### Gumloop Issues
- TERMINATED state = pipeline error (check Gumloop UI)
- Blank Token Input = node name mismatch (must be exactly "Token Input")
- Logs show: `Analysis ${id}: Gumloop DONE. Output keys: [...]`

---

## Pending Database Migrations

If deploying fresh or updating production, run:
```sql
-- Add model analyses column (added 2026-01-09)
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS model_analyses JSONB;

-- Apply performance indexes (scripts/apply-indexes.sql)
-- Run the full script for optimal query performance
```
