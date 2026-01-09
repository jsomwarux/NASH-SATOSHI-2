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
- **TanStack Query** for data fetching/caching
- **Tailwind CSS** + **shadcn/ui** components
- **Framer Motion** for animations

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL (Neon)
- **Supabase Auth** for authentication

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
│   │   │   ├── scorecard/     # ScoreCard.tsx - main analysis display + loading screen
│   │   │   ├── leaderboard/   # LeaderboardTable.tsx
│   │   │   └── ui/            # shadcn components
│   │   ├── hooks/             # React Query hooks
│   │   ├── lib/               # API client, utils
│   │   ├── pages/             # Route pages
│   │   └── types/             # TypeScript types
│   └── index.html
├── server/
│   ├── routes.ts              # API endpoints (CRITICAL - Gumloop integration here)
│   ├── storage.ts             # Database operations
│   ├── auth.ts                # Supabase auth middleware
│   ├── stripe.ts              # Stripe billing logic
│   └── index.ts               # Server entry point
├── shared/
│   └── schema.ts              # Drizzle schema + shared types
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
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (frontend) |

---

## Key Features & Current State

### Working Features
- Token search via CoinGecko proxy
- Gumloop pipeline integration (4-LLM analysis)
- Analysis loading screen with 4 phases and time estimates
- Scorecard display with full analysis results
- Leaderboard with 7D/30D aggregated scores
- Stripe subscription tiers (Free, Trader, Pro, Whale)
- Credit pack purchases
- User authentication via Supabase

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
- Polls `/api/v1/get_pl_run` every 5 seconds
- Max 540 attempts (45 minutes timeout)
- States: STARTED, RUNNING, DONE, TERMINATED, FAILED

### Gumloop Output Format (IMPORTANT)

Gumloop returns a **single text response** in `analysis_result`, NOT structured JSON. The format is LLM-generated markdown with a structured **OUTPUT SUMMARY** section at the end.

#### OUTPUT SUMMARY Format
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
```

#### Parsing Strategy (server/gumloop-parser.ts)
1. **Primary**: Find the OUTPUT SUMMARY section (look for `#OUTPUT SUMMARY`, `**OUTPUT SUMMARY**`, etc.)
2. **Parse line by line** using pattern: `/^([a-z_]+):\s*(.+)$/`
3. **Build key-value map** with normalized field names
4. **Fallback**: If field missing from OUTPUT SUMMARY, extract from markdown body

#### Field Name Normalization
Field names may have spaces OR underscores - the parser handles both:

| Expected Key | Variations Handled |
|--------------|-------------------|
| `final_score` | `final score`, `finalscore`, `score` |
| `final_tier` | `final tier`, `tier` |
| `narrative` | `narrative/meta`, `meta`, `primary_narrative` |
| `peak_proximity_pct` | `peak proximity`, `peak_proximity` |
| `token_type` | `tokentype`, `token type`, `type` |
| `gpt_score` | `gpt score`, `chatgpt_score`, `chatgpt` |

See `FIELD_ALIASES` in `gumloop-parser.ts` for full mapping.

---

## Database Schema Highlights

### Key Tables (shared/schema.ts)
- `analyses` - Token analysis results
- `subscriptions` - User subscription data
- `users` - User profiles

### Analysis Fields
- `finalScore` - 0-100 consensus score
- `tier` - S+, S, A, B, C rating
- `modelScores` - JSON with gpt, claude, gemini, grok scores
- `status` - pending, processing, completed, failed
- `gumloopRunId` - Links to Gumloop run

---

## What's Next / Known Issues

### Priorities
1. Verify Gumloop analysis completes successfully end-to-end
2. Test leaderboard aggregation with real data
3. Ensure price data (currentPrice, marketCap, priceChange) populates correctly

### Potential Issues to Watch
- If Gumloop shows blank Token Input, check exact node name matching
- TERMINATED state from Gumloop indicates pipeline error (check Gumloop UI)
- CoinGecko rate limits (free tier) may cause token search failures

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `server/routes.ts` | All API endpoints, Gumloop integration, polling logic |
| `server/gumloop-parser.ts` | **Parses Gumloop text output** - OUTPUT SUMMARY extraction, field normalization |
| `server/storage.ts` | Database operations, leaderboard calculation |
| `server/db.ts` | Database connection, retry wrapper for transient errors |
| `client/src/components/scorecard/ScoreCard.tsx` | Analysis display + loading screen |
| `client/src/pages/Home.tsx` | Main page with token search |
| `client/src/pages/Analyze.tsx` | Analysis results page |
| `shared/schema.ts` | Database schema, TypeScript types |
