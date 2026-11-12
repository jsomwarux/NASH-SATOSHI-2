# APP BRIEF: Nash Satoshi

Written 2026-11-12 by Claude Code. This is the public copy: security details and local machine paths are left out, and JT holds the full version. The code was read from a read-only clone of this repo, and nashsatoshi.com's public GET endpoints were queried. Lines checked that way say VERIFIED with the source. Nothing was installed, committed, deployed or sent.

## 1. What it is
- Nash Satoshi ("4-LLM Game Theory Consensus"): crypto token rankings. GPT, Claude, Gemini and Grok each score a token on a game-theory framework, and the scores merge into a 0–100 score and a tier (S+ to C).
- For: crypto traders, mostly small-cap and AI-agent token speculators. Problem: avoid being "exit liquidity" by cross-checking four models instead of trusting one take. CLAIMED (PROJECT_CONTEXT.md)
- Live: https://nashsatoshi.com returns 200. VERIFIED (curl). www.nashsatoshi.com fails TLS. VERIFIED (curl exit 35)
- No App Store presence; web only. VERIFIED (repo contents)
- Repo: https://github.com/jsomwarux/NASH-SATOSHI-2 (public). Default branch main, the only branch. Replit workspace: replit.com/@jsomwaru/NASH-SATOSHI. VERIFIED (gh api, git branch -a)
- Not the app:
  - An older private repo shares this repo's first commit but became Formula Verdict (skincare) on 2026-01-25. VERIFIED (git log)
  - JT's other crypto repos are separate projects. JT's local Nash Satoshi folder holds only media (scorecards, avatars, promo video). VERIFIED

## 2. Current state
Works
- /api/leaderboard returned 341 tokens on 2026-11-12. VERIFIED (curl)
- Beta mode is on in production: full access for all, pricing hidden. VERIFIED (API isBeta=true; server/routes.ts:27)
- Daily price snapshots and performance metrics still run (metricDate 2026-11-12). VERIFIED (curl /api/performance/summary)
- /methodology (2026-05-07) is deployed. VERIFIED (live sitemap.xml)
- Analysis flow: an admin or a job starts the Gumloop pipeline (inputs Source, Contract Address, Chain). A webhook or polling returns the text, server/gumloop-parser.ts turns it into fields, and the result goes to Postgres. VERIFIED by reading server/routes.ts ~1040–1075; not run
- Users can't start analyses (POST /api/analyze returns 410). VERIFIED (server/routes.ts:2420)

Half built or stalled
- No new analysis since 2026-06-22. The weekly reanalysis and daily top-vote jobs exist but have produced nothing in about 5 months. Cause unknown. VERIFIED (newest live latestAnalysisDate; server/jobs/*.ts)
- /receipts/weekly generator: code exists. VERIFIED (client/src/pages/WeeklyReceipt.tsx). Build passed, no screenshot test: CLAIMED (CHANGELOG.md). Deployed: unknown.
- Aggregation v2 fields: code and migration are merged. VERIFIED (migrations/0010_add_aggregation_v2_fields.sql). Whether it ran on prod: unknown.
- Paid tiers are defined but off during beta: Pro $19/mo, Premium $49/mo, and 10/25/60 credit packs. VERIFIED (shared/schema.ts:9–95)
- Five product questions from 2026-04-29 are still open. CLAIMED (CHANGELOG.md)
- The switch to n8n on 2026-03-20 was rolled back the same day; the code uses Gumloop. VERIFIED (git log -S n8n; commit 8bbb72b)

Broken or risky
- Webhook authentication needs hardening (section 10; details held privately). VERIFIED
- No automated tests. VERIFIED (no test files or test script)
- Live performance: top-10 average 30-day return is -27.4%, 30-day hit rate 4.8%. VERIFIED (/api/performance/summary)

## 3. Stack
VERIFIED (package.json, .replit)
- TypeScript 5.6.3, Node 20, npm with package-lock.json.
- Front end: React 18.3, Vite 7.3, Wouter, TanStack Query 5, Tailwind 3.4 + shadcn/ui, Framer Motion.
- Back end: Express 4.21, Drizzle ORM 0.39, PostgreSQL (Neon per docs).
- Services: Supabase Auth, Stripe 20, Resend, optional Upstash Redis.
- AI: a Gumloop pipeline outside the repo. The UI labels say GPT-5.5 and Claude Opus 4.7 (commit 853bf29); the real model IDs are unknown.
- Hosting: Replit Autoscale (`npm run build`, then `node ./dist/index.cjs`, port 5000).

## 4. Map
1. CLAUDE.md: agent rules (read PROJECT_CONTEXT, then CHANGELOG; minimal diffs; update CHANGELOG each session).
2. PROJECT_CONTEXT.md: architecture, tiers, beta mode, endpoints, Gumloop output format. Partly stale.
3. CHANGELOG.md: per-session history. The top three entries are current.
4. server/routes.ts (4,161 lines): all API routes, Gumloop start/webhook/polling, beta gating, admin and cron endpoints.
5. server/gumloop-parser.ts (3,675 lines): turns free-text LLM output into fields. The most fragile file.
6. server/storage.ts (3,222 lines): all DB reads and writes, with retry.
7. shared/schema.ts: Drizzle tables, tiers and prices, shared types.
8. server/jobs/: reanalysisQueue.ts (weekly), autoAnalyzeTopVote.ts and priceSnapshots.ts (daily). Started in server/index.ts:207–222.
9. client/src/components/scorecard/ScoreCard.tsx: the per-token scorecard UI.
10. client/src/App.tsx and client/src/pages/: the router and pages (Leaderboard, Vote, Admin, Methodology, WeeklyReceipt, Pricing).

## 5. Run, test and build
- `npm ci`: not run (no installs allowed; the clone has no node_modules).
- `npm run check` (tsc): not run. Passed 2026-05-19, CLAIMED (CHANGELOG.md).
- `npm run build`: not run. Passes with a large-chunk warning, CLAIMED (CHANGELOG.md). Needs no secrets. VERIFIED by reading vite.config.ts and script/build.ts
- `npm run dev`: starts without Supabase or Stripe. Every data route needs DATABASE_URL. VERIFIED (server/db.ts:12, server/auth.ts:68)
- Tests: none.
- `npm run db:push` writes to whatever DATABASE_URL points at. Never run it against prod.
- What I ran: git status, log, remote and branch on the clone; gh api; GET-only curl on public endpoints; a regex secret scan.
- No phone, simulator or Xcode needed. Browser logins: Replit, Gumloop, Supabase, Stripe, Neon. Paid: Gumloop credits per run, Stripe live.

## 6. Data, APIs and services
Env names come from the code. Terms and limits are unchecked.
- Gumloop: runs the 4-LLM pipeline. Paid by credits. GUMLOOP_API_KEY, GUMLOOP_PIPELINE_ID, GUMLOOP_USER_ID. Prompts live only in Gumloop.
- OpenAI, Anthropic, Google, xAI: called inside Gumloop. Billing unknown.
- Postgres/Neon: DATABASE_URL, DB_POOL_MAX.
- Supabase Auth: VITE_SUPABASE_URL / VITE_SUPABASE_PROJECT_URL / SUPABASE_PROJECT_URL; VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLIC_KEY; SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.
- Stripe: subscriptions and credit packs. STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID, STRIPE_PREMIUM_PRICE_ID.
- CoinGecko: search, prices, contract platforms. COINGECKO_API_KEY, COINGECKO_API_TYPE (demo or pro).
- DexScreener: DEX market data. Free, no key.
- Resend: support and feedback email. RESEND_API_KEY, RESEND_FROM_EMAIL, SUPPORT_EMAIL.
- Upstash Redis (optional): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
- Google Analytics: allowed in the CSP (server/index.ts:57–61).
- Replit: hosting, secrets, deploys. Paid.
- App config: BETA_MODE, ADMIN_EMAILS, CRON_SECRET, CORS_ORIGIN, REANALYSIS_SKIP_DATES, PORT, NODE_ENV.

## 7. Release
- Ships by publishing from Replit to Autoscale. The last "Published your App" commit is 2026-04-29, yet the 2026-05-07 change is live, so not every deploy leaves a commit. VERIFIED (git log; live sitemap). Source of truth (GitHub or Replit): unknown.
- Never without JT:
  - deploys
  - prod migrations or db:push
  - flipping BETA_MODE
  - Stripe prices, price IDs, webhooks or keys (CLAUDE.md: "Don't modify pricing logic without explicit request")
  - Gumloop runs or pipeline edits (they cost money)
  - Replit secrets
  - posting scorecards or receipts publicly
  - repo visibility

## 8. Cloud night readiness
- One repo? Mostly. All web code is in NASH-SATOSHI-2. The analysis brain (prompts, model calls, the "Final Aggregation" node) lives only in Gumloop. Ignore the old Nash-Satoshi repo.
- A fresh clone should run `npm ci` from the registry (lockfile present; unverified). Check and build should need no secrets.
- Nothing past typecheck and build can be checked: there is no seed data, no fixtures, no test runner, and no reach to Neon.
- Blockers:
  1. No tests.
  2. No sample Gumloop outputs for parser tests (hand-build them from PROJECT_CONTEXT.md, or JT adds anonymized ones).
  3. Deploys and env changes need JT.
  4. Docs disagree with the code (section 9).
- Verdict: ready for typecheck, build and unit-test work. Not ready for anything needing the DB, Gumloop or a browser.

## 9. Decisions already made
- View-only: the platform curates analyses and users vote (PROJECT_CONTEXT.md "Business Model").
- Code says "leaderboard"; the UI says "Rankings" (PROJECT_CONTEXT.md).
- Tiers: S+ ≥85, S 70–84, A 55–69, B 40–54, C <40. The server recomputes the tier from the score (PROJECT_CONTEXT.md; CHANGELOG 2026-04-20).
- Ending beta: run migrations/0006, then set BETA_MODE=false (PROJECT_CONTEXT.md).
- No price targets, trade instructions or performance promises in copy (CHANGELOG 2026-05-07, 2026-05-19).
- Enums stay plain TEXT. The parser must accept both old and v2 output (CHANGELOG 2026-04-29).
- Keep the analysis in Gumloop and build the web layer in Claude Code (GSD_Analysis_JT.docx, local folder).
- n8n was reverted on 2026-03-20; the reason is not recorded (git 1369f22 → 8bbb72b).
- Minimal diffs and a CHANGELOG entry every session (CLAUDE.md).

Disagreements (code wins):
1. CLAUDE.md and PROJECT_CONTEXT.md say Gumloop takes one "Token Input". The code sends Source, Contract Address and Chain (server/routes.ts ~1045).
2. The PROJECT_CONTEXT.md env table (SUPABASE_URL, SUPABASE_ANON_KEY, VITE_STRIPE_PUBLIC_KEY) doesn't match the names the code reads.
3. .env.example lists STARTER/TRADER/PRO/DESK price IDs and some vars the code never reads. The code reads only the PRO and PREMIUM price IDs. .env.example also leaves out RESEND_*, CRON_SECRET, ADMIN_EMAILS, BETA_MODE, SUPPORT_EMAIL and REANALYSIS_SKIP_DATES.
4. A comment in shared/schema.ts lists tiers "free, starter, trader, pro, desk". The code defines free, beta_free, pro and premium.
5. The docs list Gumloop, CoinGecko and Stripe as the services. The code also uses DexScreener, Resend, Upstash and GA.
6. The docs say analyses run daily and weekly. Live data shows none since 2026-06-22.
7. CHANGELOG.md marks two older entries "(Latest)". The real latest is 2026-05-19.
8. GSD_Analysis_JT.docx calls Nash "Gumloop-native" with "ancillary UI". It is a full web app with auth, voting and billing.
9. package.json is named "rest-express" (a Replit template leftover).

## 10. Risks
- Security (high): an issue in webhook authentication and public API responses. JT holds the details privately until it is fixed; see task 1.
- Security (low): .claude/settings.local.json, with broad allow rules, is committed to the public repo.
- Secret scan: no matches in the NASH-SATOSHI-2 tree or full git history. VERIFIED (regex scan; not exhaustive)
- Legal: scorecards show BUY, HOLD and AVOID labels, while /methodology says they are not buy/sell signals. With paid tiers, this may raise investment-advice questions. Unreviewed.
- Reputation: the public performance panel shows losses.
- Licensing (unchecked): CoinGecko and DexScreener API terms (attribution, commercial use), token logos, and OpenAI logos in local promo assets.
- Tech debt:
  - three files over 3,000 lines
  - a parser fed free-text LLM output, with repeated fixes
  - setTimeout schedulers on Autoscale (reliability unknown)
  - the large-chunk warning
  - the www TLS failure
  - stale docs

## 11. Next five night-sized tasks
1. Harden webhook auth.
   - Goal: JT supplies the exact scope at planning time. Put the auth check in a small pure function with unit tests.
   - Files: server/routes.ts, new server/webhook-auth.ts, new server/__tests__/webhook-auth.test.ts.
   - Done: `npm ci && npm run check && npm run build && node --import tsx --test server/__tests__/webhook-auth.test.ts` passes.
   - Why: security (details held privately).
2. Add a test runner and parser tests.
   - Goal: an `npm test` script using node:test via tsx (no new deps). Hand-built fixtures for the old and v2 OUTPUT SUMMARY formats, covering known bugs: math text in final_score and upside_multiple, tier recompute, HYBRID, graded unlock_warning, `**field:**` keys.
   - Files: package.json, server/__tests__/gumloop-parser.test.ts, server/__tests__/fixtures/.
   - Done: `npm test` passes with at least 15 cases, and `npm run check` passes.
   - Why: the parser is the most bug-prone file, and later cards need a test command.
3. Add CI.
   - Goal: .github/workflows/ci.yml runs npm ci, check, build and test on push and PR.
   - Done: those four commands pass in the container, and the workflow runs exactly them.
   - Why: catches breakage from Replit-side edits.
4. Make the env docs match the code.
   - Goal: rewrite .env.example to match section 6, and fix the Gumloop, env and services sections of CLAUDE.md and PROJECT_CONTEXT.md. Add scripts/check-env-example.ts, which fails when any `process.env.X` or `import.meta.env.X` is missing from .env.example, and wire it into `npm test`.
   - Done: `npm test` passes, including the env check.
   - Why: stale docs mislead future cards.
5. Split the client bundle.
   - Goal: lazy-load the Admin, Methodology, WeeklyReceipt, Pricing and Account pages in client/src/App.tsx with React.lazy.
   - Done: `npm run build` passes with no ">500 kB chunk" warning, or the main chunk is at least 30% smaller (list dist/public/assets sizes before and after).
   - Why: faster first load of the public rankings page; self-contained.

## 12. Questions only JT can answer
1. Why have analyses stopped since 2026-06-22 (paused for cost, REANALYSIS_SKIP_DATES, or broken)? Should they restart?
2. Is Nash active or in maintenance? Does beta stay on, or are paid tiers coming?
3. Which is the source of truth, GitHub or Replit? How do GitHub commits reach production?
4. Why was n8n rolled back? Is leaving Gumloop still the plan?
5. Can you export the Gumloop prompts or a few anonymized raw outputs into the repo as fixtures?
6. OK to enforce a webhook secret? You'd set it in Replit and in the Gumloop webhook URL.
7. Should the repo stay public?
8. Has anyone reviewed BUY/AVOID labels plus paid tiers for legal risk?
9. Is there a staging DB or a Stripe/Supabase test setup?
10. Should www.nashsatoshi.com work?
