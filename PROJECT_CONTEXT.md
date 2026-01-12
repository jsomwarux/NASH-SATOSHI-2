# Project Context: Crypto Game Theory Token Analyzer

## What This App Is

A **view-only** web application that displays cryptocurrency token analyses using a **4-LLM consensus engine** (ChatGPT, Claude, Gemini, Grok). The app applies game theory principles to evaluate tokens and provide trusted consensus scores, helping users avoid being "exit liquidity" in crypto markets.

### Core Value Proposition
- 4 AI models analyze tokens independently
- Models cross-validate each other's findings to eliminate bias
- Final score (0-100) represents game-theoretic viability
- Tiered scoring: S+ (85+), S (70-84), A (55-69), B (40-54), C (<40)

### Business Model (View-Only + Voting)
- **Users cannot run analyses directly** - analyses are curated by the platform
- **Free users**: View top 10 ranked tokens + their scorecards
- **Paid users**: Full leaderboard access + all scorecards
- **Voting system**: Users vote for tokens they want analyzed; top voted get priority

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
- **View-only Rankings** - Browse curated token analyses (URL: `/leaderboard`, UI: "Rankings")
- **Access gating** - Free users see top 10, paid users see all
- **Voting system** - Vote for tokens you want analyzed
- Token search via CoinGecko proxy (supports name, symbol, contract address)
- Scorecard display with full analysis results
- **Clickable model cards** - Opens modal with verdict, reasoning, risks
- Rankings with 7D/30D aggregated scores
- **Performance tracking** - Historical price snapshots and return calculations
- Stripe subscription tiers (Free, Pro, Premium)
- User authentication via Supabase
- **Database retry logic** - Handles transient connection errors

### Terminology Note
- **Internal code**: Uses "leaderboard" (API routes, file names, variables)
- **User-facing UI**: Shows "Rankings" (navigation, page titles, buttons)
- Example: Route is `/leaderboard` but nav shows "RANKINGS"

### Subscription Tiers (Access-Based)
| Tier | Price | Leaderboard | Scorecards | Votes/Day | Priority |
|------|-------|-------------|------------|-----------|----------|
| Free | $0 | Top 10 only | Top 10 only | 1 | No |
| Pro | $19/mo | Unlimited | Unlimited | 5 | No |
| Premium | $49/mo | Unlimited | Unlimited | 15 | Yes (2x) |

### Voting System
- Users search for any token and vote for it to be analyzed
- Votes reset daily at midnight UTC
- Premium users get **priority votes** that count 2x
- Top voted tokens are analyzed by the platform periodically
- Vote page shows: pending requests ranked by votes, recently analyzed

### Analysis Pipeline Phases (Internal/Admin Only)
1. **Collecting Data** (0-15%, ~7 min) - Market data & social signals
2. **LLM Analysis** (15-55%, ~7 min) - 4 AI models in parallel
3. **Cross-Validation** (55-80%, ~7 min) - Models check each other
4. **Score Aggregation** (80-100%, ~2 min) - Final consensus score

### Performance Tracking System

The app tracks historical performance to measure how well the scoring system predicts returns.

**Components:**
- `price_snapshots` table - Daily price captures for all leaderboard tokens
- `performance_metrics` table - Cached aggregate performance statistics
- Background job runs daily at midnight EST to collect prices
- Performance metrics calculated after price collection

**Metrics Tracked:**
- Top 10 average 7-day and 30-day returns
- Hit rate (% of BUY recommendations that are profitable)
- Per-tier performance breakdown (S+, S, A, B, C)
- Return since first analysis for individual tokens

**Display:**
- Leaderboard header shows aggregate performance stats
- ScoreCard shows individual token performance since analysis

---

## API Endpoints

### Public Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/token/search` | GET | Search tokens via CoinGecko |
| `/api/token/:id` | GET | Get token details |
| `/api/leaderboard` | GET | Get leaderboard (gated by tier) |
| `/api/leaderboard/stats` | GET | Leaderboard statistics |
| `/api/filters` | GET | Filter options |

### Analysis Endpoints (Access-Gated)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze/:id` | GET | Get analysis by ID (checks tier access) |
| `/api/analyze/token/:tokenId` | GET | Get analysis by token (checks tier access) |
| `/api/analyze/:id/status` | GET | Get analysis status |

### Voting Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/vote/status` | GET | Optional | User's vote status (remaining, limits) |
| `/api/vote/requests` | GET | No | List pending vote requests |
| `/api/vote/top` | GET | No | Top voted pending tokens |
| `/api/vote/recently-analyzed` | GET | No | Recently analyzed from votes |
| `/api/vote` | POST | Required | Submit vote for a token |

### Subscription Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/subscription/status` | GET | Optional | User's subscription status |
| `/api/subscription/tiers` | GET | No | Available tiers |
| `/api/subscription/checkout` | POST | Required | Create Stripe checkout |
| `/api/subscription/portal` | POST | Required | Open billing portal |

### Performance Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/performance/summary` | GET | Latest cached performance metrics |
| `/api/performance/token/:tokenId` | GET | Individual token performance data |
| `/api/performance/history` | GET | Historical performance metrics (accepts `days` param) |

### Discontinued Endpoints (Return 410)
- `POST /api/analyze` - User-triggered analysis removed
- `POST /api/analyze/:id/retry` - Retry removed
- `POST /api/analyze/:id/cancel` - Cancel removed

---

## Critical Implementation Details

### Gumloop Integration (server/routes.ts - Internal Use Only)

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
- `user_subscriptions` - User subscription data (tier, Stripe IDs)
- `token_vote_requests` - Tokens users want analyzed
- `token_votes` - Individual user votes
- `user_daily_votes` - Daily vote tracking per user
- `price_snapshots` - Daily price snapshots for performance tracking
- `performance_metrics` - Cached aggregate performance statistics

### Voting Tables

#### token_vote_requests
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `token_id` | text | CoinGecko token ID |
| `token_symbol` | text | Token symbol |
| `token_name` | text | Token name |
| `token_image` | text | Token image URL |
| `vote_count` | integer | Regular votes |
| `priority_vote_count` | integer | Premium votes (count 2x) |
| `status` | text | pending, analyzed |
| `analyzed_at` | timestamp | When analysis completed |
| `analysis_id` | integer | FK to token_analyses |

#### token_votes
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | text | Supabase user ID |
| `token_vote_request_id` | integer | FK to vote request |
| `is_priority_vote` | boolean | Premium user vote |

#### user_daily_votes
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | text | Supabase user ID |
| `date` | text | YYYY-MM-DD format |
| `votes_used` | integer | Votes used today |

### Performance Tracking Tables

#### price_snapshots
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `token_id` | text | CoinGecko token ID |
| `price_usd` | numeric | Price at snapshot time |
| `market_cap` | numeric | Market cap at snapshot |
| `fdv` | numeric | Fully diluted valuation |
| `volume_24h` | numeric | 24h trading volume |
| `snapshot_date` | text | YYYY-MM-DD format |

#### performance_metrics
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `metric_date` | text | YYYY-MM-DD format (unique) |
| `top10_avg_7d_return` | numeric | Average 7-day return of top 10 |
| `top10_avg_30d_return` | numeric | Average 30-day return of top 10 |
| `hit_rate_7d` | numeric | % of BUY recs profitable at 7d |
| `hit_rate_30d` | numeric | % of BUY recs profitable at 30d |
| `tier_metrics` | jsonb | Per-tier performance breakdown |

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
| `server/routes.ts` | All API endpoints, Gumloop integration, voting, access gating |
| `server/gumloop-parser.ts` | **Parses Gumloop text output** - OUTPUT SUMMARY, field normalization |
| `server/storage.ts` | Database operations with retry wrapper, voting methods |
| `server/db.ts` | Connection pool, `withRetry()` utility |
| `server/stripe.ts` | Subscription billing (Pro/Premium tiers) |
| `server/jobs/priceSnapshots.ts` | Daily price collection and performance metric calculation |
| `shared/schema.ts` | Drizzle schema, TypeScript interfaces, subscription tiers |
| `client/src/pages/Vote.tsx` | **Voting page** - search, vote, view top requests |
| `client/src/pages/Leaderboard.tsx` | Rankings page with access gating |
| `client/src/pages/Pricing.tsx` | Subscription tiers (Free/Pro/Premium) |
| `client/src/pages/Home.tsx` | Landing page with value proposition |
| `client/src/components/scorecard/ScoreCard.tsx` | Main analysis display |
| `client/src/components/scorecard/ModelAnalysisModal.tsx` | Per-model details modal |
| `client/src/lib/api.ts` | API client including voting functions |
| `client/src/hooks/useAnalysis.ts` | Analysis fetching |
| `client/src/hooks/useLeaderboard.ts` | Leaderboard data hooks |
| `client/src/hooks/usePerformance.ts` | Performance metrics hooks |
| `migrations/0003_add_voting_tables.sql` | Voting tables migration |
| `migrations/0004_add_performance_tracking.sql` | Performance tracking tables migration |
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

-- Voting tables (added 2026-01-10) - Run migrations/0003_add_voting_tables.sql
CREATE TABLE IF NOT EXISTS "token_vote_requests" (
  "id" serial PRIMARY KEY,
  "token_id" text NOT NULL,
  "token_symbol" text NOT NULL,
  "token_name" text NOT NULL,
  "token_image" text,
  "vote_count" integer DEFAULT 0,
  "priority_vote_count" integer DEFAULT 0,
  "status" text DEFAULT 'pending',
  "created_at" timestamp DEFAULT now(),
  "analyzed_at" timestamp,
  "analysis_id" integer
);

CREATE TABLE IF NOT EXISTS "token_votes" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "token_vote_request_id" integer NOT NULL,
  "is_priority_vote" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_daily_votes" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "votes_used" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

-- Voting indexes
CREATE INDEX IF NOT EXISTS "idx_vote_requests_token_id" ON "token_vote_requests" ("token_id");
CREATE INDEX IF NOT EXISTS "idx_vote_requests_status" ON "token_vote_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_token_votes_user_id" ON "token_votes" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_daily_votes_user_date" ON "user_daily_votes" ("user_id", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vote_requests_unique_token" ON "token_vote_requests" ("token_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_token_votes_unique_user_request" ON "token_votes" ("user_id", "token_vote_request_id");

-- Apply performance indexes (scripts/apply-indexes.sql)
-- Run the full script for optimal query performance

-- Performance tracking tables (added 2026-01-12) - Run migrations/0004_add_performance_tracking.sql
CREATE TABLE IF NOT EXISTS "price_snapshots" (
  "id" serial PRIMARY KEY,
  "token_id" text NOT NULL,
  "price_usd" numeric(20, 10) NOT NULL,
  "market_cap" numeric(20, 2),
  "fdv" numeric(20, 2),
  "volume_24h" numeric(20, 2),
  "snapshot_date" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "performance_metrics" (
  "id" serial PRIMARY KEY,
  "metric_date" text NOT NULL UNIQUE,
  "top10_avg_7d_return" numeric(10, 4),
  "top10_avg_30d_return" numeric(10, 4),
  "hit_rate_7d" numeric(5, 2),
  "hit_rate_30d" numeric(5, 2),
  "tier_metrics" jsonb,
  "created_at" timestamp DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "idx_price_snapshots_token_date" ON "price_snapshots" ("token_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "idx_price_snapshots_date" ON "price_snapshots" ("snapshot_date");

-- Add price at analysis column to token_analyses
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS price_at_analysis numeric(20, 10);
```

## Stripe Configuration

For the new subscription tiers, ensure these environment variables are set:
```
STRIPE_PRO_PRICE_ID=price_xxx      # $19/month Pro tier
STRIPE_PREMIUM_PRICE_ID=price_xxx  # $49/month Premium tier
```

---

## Recent Architecture Decisions (2026-01-12)

### Leaderboard Data Aggregation

The leaderboard aggregates multiple analyses per token into a single row:

```typescript
// From server/storage.ts getLeaderboard()
interface AggregatedLeaderboardItem {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage: string | null;
  chain: string | null;
  score7d: number;        // Average score over 7 days
  score30d: number;       // Average score over 30 days
  latestScore: number;    // Score from most recent analysis (NOT average)
  latestTier: string;     // Tier from most recent analysis
  latestNarrative: string | null;
  latestRecommendation: string | null;
  latestAnalysisId: number;
  latestAnalysisDate: Date;
  runs7d: number;         // Number of analyses in last 7 days
  runs30d: number;        // Number of analyses in last 30 days
  confidence: 'high' | 'medium' | 'low';  // Based on run count
  tokenType: string;
  asymmetryScore: number | null;
}
```

### Authentication Session Handling

**Stale Session Recovery:**
- Sign out uses `scope: 'local'` to clear local session without server communication
- React state (`user`, `session`) is always cleared regardless of API response
- `getAccessToken()` auto-clears sessions that fail server verification
- Prevents "zombie sessions" where local state differs from server

**Auth Flow:**
```typescript
// Sign out always clears local state first
const signOut = async () => {
  await supabase.auth.signOut({ scope: 'local' });
  setUser(null);
  setSession(null);
};

// Token retrieval auto-recovers from invalid sessions
const getAccessToken = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    await supabase.auth.signOut(); // Clear invalid session
    return null;
  }
  return session?.access_token ?? null;
};
```

### Admin System

**Admin Detection:**
- `ADMIN_EMAILS` environment variable contains comma-separated admin emails
- `isAdminEmail()` in `server/auth.ts` checks against this list
- `requireAdmin` middleware protects admin-only endpoints
- `optionalAuth` sets `req.isAdmin` for conditional access

**Admin Capabilities:**
- Run analyses for any token (bypasses subscription limits)
- View full leaderboard without access limits
- View all analyses history
- Reprocess existing analyses to fix missing fields
- Sync stuck analyses with Gumloop

**Admin Page (`/admin`):**
- Three tabs: Run Analysis, Leaderboard, All Analyses
- Uses same `LeaderboardTable` component as public leaderboard
- Links include `?from=admin` for contextual navigation

### Home Page Value Proposition

The home page (`/`) communicates four key benefits:

1. **FIND ASYMMETRIC PLAYS** - Identify tokens with favorable risk/reward before the crowd
2. **AVOID EXIT LIQUIDITY** - Know if buying into strength or holding bags
3. **PHASE DETECTION** - Token lifecycle stages (Stealth, Expansion, Mania, Distribution, Dead)
4. **TRACK RECORD** - Real performance data for system verification

**Key messaging:**
- Header: "Your Edge in Crypto"
- Subtitle: "Game theory analysis powered by 4-LLM consensus. No single point of failure."
- Target user: Crypto traders who want to identify opportunities and avoid being exit liquidity

### Mobile Responsiveness Patterns

**Tailwind Breakpoints Used:**
- `sm:` = 640px+ (most common for mobile→tablet transition)
- `md:` = 768px+ (for column layouts)
- `lg:` = 1024px+ (for sidebar visibility)
- `xl:` = 1280px+ (for extra decorations)

**Common Mobile Patterns:**
```tsx
// Stacking layout
className="flex flex-col sm:flex-row"

// Hide on mobile
className="hidden sm:inline"

// Full width on mobile
className="w-full sm:w-auto"

// Responsive grid
className="grid grid-cols-2 sm:flex sm:flex-wrap"

// Responsive text
className="text-xs sm:text-sm"

// Responsive spacing
className="gap-2 sm:gap-4 px-3 sm:px-4"
```

**LeaderboardTable Column Visibility:**
- Always visible: Rank, Token, Score, Tier
- `hidden sm:table-cell`: Type, Signal, Latest
- `hidden md:table-cell`: Runs
- `hidden lg:table-cell`: Asymmetry
- `hidden xl:table-cell`: Narrative

### Fixed UI Elements (Bottom of Screen)

Two fixed bars at bottom:
1. **Disclaimer Bar** (bottom-10): "NOT FINANCIAL ADVICE" warning
2. **Cyber Status Bar** (bottom-0): System status, LLM indicators, usage

Main content has `pb-24` padding to account for these.

---

## Component Architecture

### Key Components & Their Responsibilities

| Component | Location | Purpose |
|-----------|----------|---------|
| `Layout` | `client/src/components/common/Layout.tsx` | Global nav, status bars, auth modal |
| `LeaderboardTable` | `client/src/components/leaderboard/LeaderboardTable.tsx` | Sortable token table with access gating |
| `ScoreCard` | `client/src/components/scorecard/ScoreCard.tsx` | Full analysis display |
| `ModelAnalysisModal` | `client/src/components/scorecard/ModelAnalysisModal.tsx` | Per-model verdict/reasoning popup |
| `TokenSearch` | `client/src/components/search/TokenSearch.tsx` | CoinGecko-powered token search |
| `AuthModal` | `client/src/components/auth/AuthModal.tsx` | Sign in/sign up modal |

### Context Providers

| Context | Location | Purpose |
|---------|----------|---------|
| `AuthContext` | `client/src/contexts/AuthContext.tsx` | Supabase auth state |
| `AnalysisTrackerContext` | `client/src/contexts/AnalysisTrackerContext.tsx` | Track running analyses |

### Custom Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useAnalysis` | `client/src/hooks/useAnalysis.ts` | Fetch single analysis with polling |
| `useTokenStats` | `client/src/hooks/useAnalysis.ts` | Aggregate stats for a token |
| `useLeaderboard` | `client/src/hooks/useLeaderboard.ts` | Leaderboard data with filters |
| `useSubscriptionStatus` | `client/src/hooks/useSubscription.ts` | User's current tier and limits |
| `usePerformanceMetrics` | `client/src/hooks/usePerformance.ts` | Aggregate performance statistics |
| `useTokenPerformance` | `client/src/hooks/usePerformance.ts` | Individual token performance data |

---

## Common Tasks for New Agent

### Adding a New Field to Analysis

1. **Parser** (`server/gumloop-parser.ts`):
   - Add field to `ParsedGumloopResponse` interface
   - Add field aliases to `FIELD_ALIASES` map
   - Field will be auto-extracted from OUTPUT SUMMARY

2. **Schema** (`shared/schema.ts`):
   - Add column to `tokenAnalyses` table definition
   - Add field to `TokenAnalysis` type if needed

3. **Routes** (`server/routes.ts`):
   - Add field to `processGumloopCompletion()` update object

4. **ScoreCard** (`client/src/components/scorecard/ScoreCard.tsx`):
   - Add display logic for the new field

5. **Migration**:
   - Run `ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS field_name TYPE;`

### Adding a New Page

1. Create page component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add navigation link in `Layout.tsx` if needed

### Modifying Leaderboard Display

- Columns: Edit `LeaderboardTable.tsx`
- Filters: Edit `Leaderboard.tsx` filter section
- Aggregation: Edit `storage.ts` `getLeaderboard()` method
- Stats: Edit `storage.ts` `getLeaderboardStats()` method

### Testing Changes

```bash
# TypeScript check
npx tsc --noEmit

# Development server
npm run dev

# Production build
npm run build
```

---

## Known Issues & Workarounds

### Gumloop OUTPUT SUMMARY Variations
The LLM sometimes formats the OUTPUT SUMMARY differently. The parser handles:
- `#OUTPUT SUMMARY`
- `**OUTPUT SUMMARY**`
- `---OUTPUT SUMMARY---`
- Block of consecutive `field: value` lines at end of text

### Database Connection Drops
Neon/Postgres occasionally drops connections. The `withRetry()` wrapper in `db.ts` handles this with exponential backoff.

### CoinGecko Rate Limits
Token search and details endpoints proxy through our server to avoid CORS and manage rate limits. Heavy usage may hit CoinGecko limits.

### Stripe Webhook Reliability
Webhooks occasionally fail. The Gumloop sync polling (`syncStuckAnalysesWithGumloop`) runs every 2 minutes as a fallback.

---

## Environment Variable Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `GUMLOOP_API_KEY` | Yes | Gumloop authentication |
| `GUMLOOP_PIPELINE_ID` | Yes | Saved pipeline ID |
| `GUMLOOP_USER_ID` | Yes | Gumloop user ID |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signature verification |
| `VITE_STRIPE_PUBLIC_KEY` | Yes | Stripe publishable key (frontend) |
| `STRIPE_PRO_PRICE_ID` | Yes | Pro tier price ID |
| `STRIPE_PREMIUM_PRICE_ID` | Yes | Premium tier price ID |
| `ADMIN_EMAILS` | No | Comma-separated admin emails |
| `REDIS_URL` | No | Redis for rate limiting (optional) |
