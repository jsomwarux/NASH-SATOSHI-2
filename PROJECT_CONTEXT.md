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
