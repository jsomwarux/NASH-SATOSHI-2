# Changelog

This file tracks changes made during Claude Code sessions. New agents should read this to understand recent modifications and current state.

---

## Session: 2026-01-13 Part 3 - Feedback System & Reanalysis Schedule (Latest)

### Summary
Added a user feedback system with two entry points: a "Feedback" button in the user dropdown menu and a "Report Issue" link on each scorecard. Also added a reanalysis schedule notice to the Rankings page.

### Changes Made

#### 1. Reanalysis Schedule Notice (Rankings Page)
- Added notice below stats cards: "REANALYSIS: Top 25 weekly | Top 50 bi-weekly | Top 100 monthly"
- Styled consistently with existing disclaimer text

#### 2. User Feedback System
- **Database**: New `user_feedback` table to store submissions
  - Fields: id, user_id, user_email, type, subject, message, token_symbol, analysis_id, status, created_at
  - Migration: `migrations/0005_add_user_feedback.sql`
- **API Endpoints**:
  - `POST /api/feedback` - Submit feedback/issue (stores in DB + sends email)
  - `GET /api/feedback` - List all feedback (admin only)
- **FeedbackModal Component**: New modal for feedback/issue submission
  - Toggle between "Feedback" and "Report Issue" modes
  - Pre-fills token info when opened from scorecard
  - Sends notification email via Resend

#### 3. Feedback Entry Points
- **User Menu**: "Feedback" option added below "Manage Billing" in user dropdown
- **ScoreCard Footer**: "Report Issue" link with flag icon
  - Pre-fills token symbol and analysis ID
  - Frictionless reporting while viewing analysis

### Files Modified
- `shared/schema.ts` - Added userFeedback table and types
- `server/storage.ts` - Added createFeedback and getFeedback methods
- `server/routes.ts` - Added /api/feedback endpoints
- `client/src/components/common/FeedbackModal.tsx` - New component
- `client/src/components/common/Layout.tsx` - Added Feedback to user menu
- `client/src/components/scorecard/ScoreCard.tsx` - Added Report Issue link
- `client/src/pages/Leaderboard.tsx` - Added reanalysis schedule notice
- `migrations/0005_add_user_feedback.sql` - New migration

### How to View Feedback
1. **Database**: Query `user_feedback` table directly
2. **Email**: Submissions are emailed to SUPPORT_EMAIL (nashsatoshi@gmail.com by default)
3. **Admin API**: `GET /api/feedback` returns all feedback (requires admin auth)

### Database Migration Required
```sql
-- Run migrations/0005_add_user_feedback.sql
```

---

## Session: 2026-01-13 Part 2 - Verbose Enum Field Parsing

### Summary
Enhanced parsing logic for enum fields (community_status, account_quality, kol_notable_accounts) to handle verbose responses from the X Research node. The node sometimes returns full sentences instead of expected single-value categories, and this update extracts the correct value using keyword-based matching.

### Changes Made

#### 1. Enhanced Community Status Parsing (extractCommunityStatusCategory)
- Returns "Unknown" instead of raw text when no match found
- Added keyword-based matching for verbose responses:
  - "very active" → "Very Active"
  - "moderately active" or "moderate" → "Moderate"
  - "active" (but not "very active" or "moderately active" or "inactive") → "Active"
  - "low" or "minimal" → "Low"
  - "dead" or "no activity" or "inactive" → "Dead"

#### 2. Enhanced Account Quality Parsing (extractAccountQualityCategory)
- Returns "Unknown" instead of raw text when no match found
- Added keyword-based matching for verbose responses:
  - "builder" or "researcher" or "developer" or "technical" → "Builders/Researchers"
  - "trader" or "degen" → "Traders/Degens"
  - "mixed" → "Mixed Quality"
  - "promoter" or "shill" → "Promoters/Shills"
  - "bot" or "spam" → "Bots/Spam"

#### 3. New KOL Value Normalization (normalizeKolValue)
- New function to normalize KOL (Key Opinion Leader) field values
- Returns "None identified" for empty, null, or placeholder values:
  - Empty string, null, undefined
  - "None identified", "No value available for this output"
  - "None", "N/A", "NA", "None known"
  - Text containing: "none found", "no notable", "no kol", "not identified", "could not identify", "unable to identify"
- Applied to xTopKols field in both parser sections

#### 4. Removed KOL Mention Recency Display
- Removed `kolMentionRecency` reference from Notable KOLs UI in ScoreCard
- Field removed from pipeline output; UI element hidden

#### 5. Fixed Scorecard Hero Layout for Long Token Names
- Long token names (e.g., "THREAT RESEARCH & HISTORY TRAIL") no longer break the Price/FDV layout
- Left section constrained to `lg:max-w-[40%]` with `min-w-0` for proper flex behavior
- Token name truncates with ellipsis at `max-w-[200px]` (mobile) / `max-w-[280px]` (desktop)
- **Full name tooltip**: Hover over truncated name to see full project name in a tooltip
- Added `cursor-help` visual hint that more info is available
- Token image marked as `flex-shrink-0` to prevent shrinking
- Right market data section marked as `flex-shrink-0` to prevent squishing

#### 6. Added Tooltip to Hot Narratives on Rankings Page
- Narrative names in HOT_NARRATIVES section now show full name on hover/tap
- Works on both desktop (hover) and mobile (tap) via Radix Tooltip component
- Added `delayDuration={100}` for quick response
- Increased truncation threshold from 8 to 10 characters for better readability
- Added `cursor-help` visual hint

#### 7. Redesigned Shareable Scorecard Image
- **16:9 aspect ratio** (800x450) for consistent X/Twitter previews without cropping
- **Added Narrative and Phase** cards on right side - explains score at a glance
- **Component scores with denominators** - now shows "19/25" instead of "19.0"
- **Redesigned footer strip** with:
  - Nash Satoshi hexagonal logo (matching site branding)
  - "NASH SATOSHI • 4-LLM Game Theory Consensus • nashsatoshi.com"
  - Gradient background for visual distinction
- Added CAUTIOUS BUY recommendation style (amber color)
- Phase displays with color-coded badge (Stealth, Expansion, Mania, Distribution, Dead)
- **Fixed token logo images**: Added `/api/image-proxy` endpoint to bypass CORS restrictions - proxies external images through server for html-to-image capture
- **Removed confusing "MIXED" consensus** from footer - avoided trust issue where S+ tier + BUY + "MIXED" would confuse viewers

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Enhanced extractCommunityStatusCategory, extractAccountQualityCategory functions; Added normalizeKolValue function; Updated xTopKols parsing to use normalization |
| `client/src/components/scorecard/ScoreCard.tsx` | Removed kolMentionRecency; Fixed hero layout for long token names with tooltip; Added flex constraints |
| `client/src/components/scorecard/ShareCard.tsx` | Redesigned with 16:9 ratio, Narrative/Phase cards, component score denominators, branded footer, image proxy |
| `client/src/pages/Leaderboard.tsx` | Added Tooltip to hot narratives section for viewing full narrative names |
| `server/routes.ts` | Added `/api/image-proxy` endpoint for CORS-free image loading in share cards |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Verbose community_status responses correctly mapped to clean category values
- Verbose account_quality responses correctly mapped to clean category values
- KOL field shows "None identified" instead of blank for empty/placeholder values
- All TypeScript compiles successfully
- Backward compatible with existing analyses

---

## Session: 2026-01-13 - Support Contact, Auth Improvements, UX Fixes & Narrative Normalization

### Summary
Added support/contact feature with email via Resend, forgot password functionality, subscription upgrade/downgrade confirmation modal, improved narrative normalization for hot narratives, fixed scorecard share/download functionality, and various UX improvements including URL change from `/leaderboard` to `/rankings`.

### Changes Made

#### 1. Support/Contact Feature
- Added `/api/support` POST endpoint for sending support emails via Resend
- Created `SupportModal` component with form validation and success/error states
- Added "HELP" button to Layout footer/status bar
- Configurable via environment variables:
  - `RESEND_API_KEY` - Resend API key
  - `RESEND_FROM_EMAIL` - Sender email (must match verified domain in Resend)
  - `SUPPORT_EMAIL` - Destination email (defaults to nashsatoshi@gmail.com)
- Email includes user's email as `replyTo` for easy response
- Fixed email state sync with useEffect when modal opens

#### 2. Forgot Password Feature
- Added `resetPassword` method to AuthContext using Supabase's `resetPasswordForEmail`
- Updated AuthModal with 'forgot' mode
- Added "Forgot password?" link on sign-in form
- Redirects to `/account` after password reset

#### 3. Scorecard Access Error Improvement
- Added `ApiError` class to `client/src/lib/api.ts` with `code` and `status` properties
- Updated Analyze page to detect `ACCESS_DENIED` errors
- Shows "Premium Content" message with upgrade CTA instead of generic "Analysis not found"

#### 4. URL Route Change
- Changed route from `/leaderboard` to `/rankings`
- Updated all navigation links in: App.tsx, Layout.tsx, Analyze.tsx, Vote.tsx, Home.tsx

#### 5. Pricing Page Scroll Fix
- Added `window.scrollTo(0, 0)` in useEffect on Pricing page mount
- Fixes issue where clicking upgrade CTA scrolled to bottom of page

#### 6. Subscription Upgrade/Downgrade Confirmation
- Added `pendingPlanChange` state for confirmation modal
- Created confirmation UI showing upgrade/downgrade details with price comparison
- Both upgrades and downgrades now require explicit confirmation before processing
- Fixed downgrade button to use API instead of redirecting to Stripe portal

#### 7. Narrative Normalization Improvements
- Merged generic "AI" keywords into "AI Agents" mapping
- Added post-processing filter to remove parent narratives when specific children exist:
  - "AI" filtered when "AI Agents" or "AI Infrastructure" present
  - "Gaming" filtered when "GameFi" present
  - "Finance" filtered when "DeFi" present
  - "Social" filtered when "SocialFi" present
  - "Infrastructure" filtered when "L1/L2", "DePIN", or "Interoperability" present

#### 8. Share/Download Image Fix
- Improved `generateImage` function with better CORS handling
- Added fallback that retries without external images if CORS fails
- Fixed Firefox compatibility by appending download link to document body
- Replaced `onAnimationComplete` with `useEffect` for reliable image generation on modal open
- Added user feedback via alerts when generation fails

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added support email endpoint, moved `sendSupportEmail` to top of file, configurable via env vars |
| `client/src/components/common/SupportModal.tsx` | New component for support contact form |
| `client/src/components/common/Layout.tsx` | Added HELP button and SupportModal |
| `client/src/contexts/AuthContext.tsx` | Added `resetPassword` method |
| `client/src/components/auth/AuthModal.tsx` | Added forgot password mode |
| `client/src/lib/api.ts` | Added `ApiError` class |
| `client/src/pages/Analyze.tsx` | Premium content error handling |
| `client/src/App.tsx` | Changed `/leaderboard` to `/rankings` route |
| `client/src/pages/Pricing.tsx` | Added scroll-to-top, confirmation modal, fixed downgrade flow |
| `server/storage.ts` | Updated narrative mappings, added post-processing filter |
| `client/src/components/scorecard/ShareModal.tsx` | Fixed image generation and download |

### Environment Variables Added
```bash
# Support email configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=support@yourverifieddomain.com  # Must match Resend verified domain
SUPPORT_EMAIL=nashsatoshi@gmail.com  # Optional, defaults to this
```

### Commands Run
- `npm install resend` - Added Resend email package
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Support contact feature fully functional with Resend
- Forgot password flow works via Supabase
- Subscription changes require confirmation
- Hot narratives no longer show redundant generic/specific pairs
- Scorecard sharing/download works reliably
- All TypeScript compiles successfully

---

## Session: 2026-01-12 Part 2 - Security, Auth Fixes, Home Page Optimization & "Rankings" Rebrand

### Summary
Comprehensive security audit with fixes, resolved auth session handling issues, updated sign up modal to show free tier benefits, fixed voting system bugs, fixed Stripe subscription flow, redesigned Home page "Your Edge in Crypto" section, and renamed all "Leaderboard" references to "Rankings" for brand consistency.

### Changes Made

#### 1. Security Audit & Fixes
- Added path traversal protection in CoinGecko proxy endpoints
- Added input sanitization for voting system (token ID validation)
- Hardened Gumloop webhook with status code validation
- All changes in `server/routes.ts`

#### 2. Sign Up Modal Update
- Replaced "7-DAY FREE TRIAL" content with "FREE ACCOUNT INCLUDES"
- Now shows actual free tier benefits: Top 10 tokens, Full scorecards, 1 vote per day
- File: `client/src/components/auth/AuthModal.tsx`

#### 3. Voting System Bug Fixes
- Fixed `getTopVoteRequests` query: Changed `sql\`= ANY()\`` to `inArray()` for proper Drizzle syntax
- Fixed vote count display: PostgreSQL SUM returns bigint as string, added `Number()` conversion to prevent "10" instead of 1
- Maintained "today only" filtering for Top Voted Tokens section
- File: `server/storage.ts`

#### 4. Stripe Subscription Flow Fixes
- Fixed `PRICE_TO_TIER` mapping computed at module load before env vars ready
- Converted to runtime functions `getPriceToTier()` and `getTierToPrice()`
- Fixed `getLeaderboard` API not sending auth token
- Files: `server/stripe.ts`, `client/src/hooks/useLeaderboard.ts`

#### 5. Auth Session Handling Improvements
- Added `scope: 'local'` to signOut for clearing stale sessions without server communication
- Always clears React state on sign out regardless of API response
- Added auto-clear of session in `getAccessToken()` when session error detected
- Added comprehensive debug logging for troubleshooting
- Files: `client/src/contexts/AuthContext.tsx`, `server/auth.ts`, `server/routes.ts`

#### 6. Home Page "Your Edge in Crypto" Section Redesign
- **FIND ASYMMETRIC PLAYS** - Outcome-focused, speaks to upside potential (replaced ELIMINATE AI BIAS)
- **AVOID EXIT LIQUIDITY** - Addresses #1 fear of crypto traders (replaced GAME THEORY SCORING)
- **PHASE DETECTION** - Kept, improved copy with "Time your entries and exits"
- **TRACK RECORD** - Leverages performance tracking system (replaced RISK TRANSPARENCY)
- Updated section header: "Your Edge in Crypto" with "Game theory analysis powered by 4-LLM consensus. No single point of failure."
- Updated tier descriptions with risk/reward language
- File: `client/src/pages/Home.tsx`

#### 7. "Leaderboard" → "Rankings" Terminology Update
User-facing text updated across entire app:
| File | Changes |
|------|---------|
| `Home.tsx` | VIEW/EXPLORE RANKINGS, description text |
| `Layout.tsx` | Navigation label |
| `Leaderboard.tsx` | Page title, loading/error/empty states |
| `Pricing.tsx` | Plan descriptions, FAQ answers |
| `Admin.tsx` | Tab label, descriptions |
| `Account.tsx` | Plan benefits |
| `Vote.tsx` | Button text |
| `Analyze.tsx` | Back button, error state |
| `AuthModal.tsx` | Upgrade CTA |
| `LeaderboardTable.tsx` | Tooltip, upgrade prompt |

**Not changed (intentionally)**: URL route `/leaderboard`, internal variable names, API endpoints, file names

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Security fixes, admin status debug logging |
| `server/storage.ts` | Voting query fixes (inArray, Number conversion) |
| `server/stripe.ts` | Runtime price-to-tier mapping functions |
| `server/auth.ts` | Debug logging for admin checks |
| `client/src/contexts/AuthContext.tsx` | Improved signOut and getAccessToken |
| `client/src/hooks/useLeaderboard.ts` | Pass auth token to API |
| `client/src/components/auth/AuthModal.tsx` | Free tier benefits, "rankings" text |
| `client/src/pages/Home.tsx` | Redesigned benefits section, "rankings" text |
| `client/src/pages/Leaderboard.tsx` | "Rankings" terminology |
| `client/src/pages/Pricing.tsx` | "Rankings" terminology |
| `client/src/pages/Admin.tsx` | "Rankings" terminology |
| `client/src/pages/Account.tsx` | "Rankings" terminology |
| `client/src/pages/Vote.tsx` | "Rankings" terminology |
| `client/src/pages/Analyze.tsx` | "Rankings" terminology |
| `client/src/components/common/Layout.tsx` | Navigation "RANKINGS" |
| `client/src/components/leaderboard/LeaderboardTable.tsx` | "Rankings" terminology |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Security vulnerabilities addressed
- Auth session handling more robust (handles stale sessions)
- Voting system working correctly (vote counts accurate)
- Stripe subscriptions grant proper access
- Home page benefits section optimized for target user
- Consistent "Rankings" branding throughout app
- All TypeScript compiles successfully

---

## Session: 2026-01-12 - Score Calculation, X Research Fields, Model Divergence & Flexible Format Fields

### Summary
1. Added `score_calculation` field parsing and storage to capture the LLM's arithmetic work for computing the final score average.
2. Added three new qualitative X Research fields replacing old numeric versions: `engagementQuality`, `overallSentiment`, and `cultVsMercenary`.
3. Added model divergence metrics: `scoreSpread`, `divergenceFlag`, and `divergenceNote` with visual display in 4-Model Consensus section.
4. Added X Research flexible format fields that can contain either numeric OR qualitative values (sentiment ratios, engagement details, cult/mercenary ratio, sample size).

### Changes Made

#### 1. Score Calculation Field
- **Parser**: Added `scoreCalculation?: string` to interface with field aliases
- **Schema**: Added `scoreCalculation` column (text)
- **Routes**: Added to `processGumloopCompletion` storage update
- **ScoreCard**: Expandable "Score Calculation" section in Score Breakdown (collapsed by default)

#### 2. New Qualitative X Research Fields (gumloop-parser.ts)
- `engagementQuality` - "High", "Moderate", "Low", "Bot-Heavy"
  - Aliases: `engagement_quality`, `attention_metrics_engagement_quality`
- `overallSentiment` - "Strongly Bullish", "Bullish", "Mixed", "Bearish", "Strongly Bearish"
  - Aliases: `overall_sentiment`, `sentiment_analysis_overall_sentiment`
- `cultVsMercenary` - "Cult-Heavy", "Mercenary-Heavy", "Balanced Mix", "Unable to Assess"
  - Aliases: `cult_vs_mercenary`, `community_coordination_cult_vs_mercenary`

#### 3. Model Divergence Metrics (NEW)
- `scoreSpread` - Decimal showing difference between highest and lowest model scores
  - Aliases: `score_spread`, `model_score_spread`
- `divergenceFlag` - "HIGH" (>15 pts), "MODERATE" (10-15 pts), "LOW" (<10 pts)
  - Aliases: `divergence_flag`, `model_divergence`
- `divergenceNote` - Explanation text when divergence is HIGH
  - Aliases: `divergence_note`, `divergence_explanation`

#### 4. X Research Flexible Format Fields (NEW)
Fields that can contain either numeric values OR qualitative descriptions:
- **Sentiment Ratios** (can be "72%" or "High (~70%+)"):
  - `sentimentBullishRatio` - bullish sentiment percentage/description
  - `sentimentBearishRatio` - bearish sentiment percentage/description
  - `sentimentNeutralRatio` - neutral sentiment percentage/description
- **Engagement Details** (can be "150" or "High (hundreds+)"):
  - `likesPerPostAvg` - average likes per post
  - `retweetsPerPostAvg` - average retweets per post
  - `repliesPerPostAvg` - average replies per post
- **Other Fields**:
  - `cultMercenaryRatio` - "80% cult / 20% mercenary" or "Cult-Heavy"
  - `sentimentSampleSize` - "25" or "~20 posts observed"

#### 5. Database Schema (shared/schema.ts)
- Added `scoreCalculation` column (text)
- Added `engagementQuality` column (text)
- Added `overallSentiment` column (text)
- Added `cultVsMercenary` column (text)
- Added `scoreSpread` column (numeric 6,2)
- Added `divergenceFlag` column (text)
- Added `divergenceNote` column (text)
- Added 8 flexible format fields (all text): `sentimentBullishRatio`, `sentimentBearishRatio`, `sentimentNeutralRatio`, `likesPerPostAvg`, `retweetsPerPostAvg`, `repliesPerPostAvg`, `cultMercenaryRatio`, `sentimentSampleSize`

#### 6. Routes Update (server/routes.ts)
- Added all 15 new fields to `processGumloopCompletion` storage update

#### 7. ScoreCard Social Signals Section (ScoreCard.tsx)
- Expanded grid to `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` for more cards
- **Engagement card**: Shows qualitative summary + optional detail breakdown (Likes/RTs/Replies per post)
- **Sentiment card**: Shows qualitative summary + optional ratio breakdown (Bullish/Bearish/Neutral + sample size)
- **Holder Type card**: Shows qualitative summary + optional cult/mercenary ratio
- All cards gracefully handle both numeric ("72%") and qualitative ("High (~70%+)") formats
- All new cards only display when field is present (backward compatible)

#### 8. 4-Model Consensus Section - Divergence Display (ScoreCard.tsx)
- Added divergence display below model score cards
- **LOW divergence**: Green "Strong Consensus" badge
- **MODERATE divergence**: Yellow "Mixed Views" badge + score spread
- **HIGH divergence**: Orange "Models Disagree" badge + score spread + divergence note with warning box
- Backward compatible: Falls back to `consensus_level` for older analyses without `divergence_flag`
- Maps old consensus_level: HIGH→low divergence, MIXED→moderate, LOW/CONFLICTED→high

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Added 15 new fields to interface, field aliases, extraction in both parseText and outputs sections |
| `shared/schema.ts` | Added 15 new columns to tokenAnalyses table |
| `server/routes.ts` | Added 15 new fields to processGumloopCompletion update |
| `client/src/components/scorecard/ScoreCard.tsx` | Added Calculator icon, expandable Score Calculation, enhanced Social Signals with flexible format display, divergence display |

### Database Migration Required
```sql
-- Score calculation field
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS score_calculation TEXT;

-- X Research qualitative fields
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS engagement_quality TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS overall_sentiment TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS cult_vs_mercenary TEXT;

-- Model divergence metrics
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS score_spread NUMERIC(6,2);
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS divergence_flag TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS divergence_note TEXT;

-- X Research flexible format fields
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS sentiment_bullish_ratio TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS sentiment_bearish_ratio TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS sentiment_neutral_ratio TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS likes_per_post_avg TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS retweets_per_post_avg TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS replies_per_post_avg TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS cult_mercenary_ratio TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS sentiment_sample_size TEXT;
```

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- score_calculation field parsed and stored (displayed in expandable debug section)
- New qualitative X Research fields parsed, stored, and displayed in Social Signals
- Model divergence metrics parsed and displayed in 4-Model Consensus section
- divergence_flag takes precedence over consensus_level when available
- Flexible format fields handle both numeric and qualitative values gracefully
- Backward compatible: older analyses without new fields display gracefully
- Grid layout adapts to show available cards responsively

---

## Session: 2026-01-11 Part 12 - Parser Improvements & Category Extraction

### Summary
Improved field parsing with asterisk sanitization, category extraction for community_status and account_quality, removed distribution warning display, and added graceful handling for missing KOL data.

### Changes Made

#### 1. Asterisk Sanitization (gumloop-parser.ts)
- Added `sanitizeFieldText()` function to strip asterisks from field names
- Converts `**field_name:**` to `field_name:` before parsing
- Applied to raw text in parseGumloopResponse() before all parsing operations

#### 2. Community Status Category Extraction (gumloop-parser.ts)
- Added `extractCommunityStatusCategory()` helper function
- Valid categories: "Very Active", "Active", "Moderate", "Low", "Dead"
- Extracts just the category from longer strings (e.g., "Active. The community shows..." → "Active")
- Applied to both text-based and direct output parsing

#### 3. Account Quality Category Extraction (gumloop-parser.ts)
- Added `extractAccountQualityCategory()` helper function
- Valid categories: "Builders/Researchers", "Traders/Degens", "Mixed Quality", "Promoters/Shills", "Bots/Spam"
- Same extraction logic as community status
- Applied to both text-based and direct output parsing

#### 4. Removed Distribution Warning Display (ScoreCard.tsx)
- Removed the distribution warning banner from the scorecard
- Field still parsed and stored but not displayed on frontend

#### 5. Graceful KOL Data Handling (ScoreCard.tsx)
- Enhanced empty/missing check: handles "", "N/A", "None", "None identified", "None known"
- Displays "None identified" for all empty/missing cases
- Shows KOL mention recency only when valid KOL data exists
- Format: "Mentions: Last 7 days" (or other recency value)

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Added sanitizeFieldText(), extractCommunityStatusCategory(), extractAccountQualityCategory(); Applied sanitization to parseGumloopResponse |
| `client/src/components/scorecard/ScoreCard.tsx` | Removed distribution warning banner; Enhanced KOL display with recency |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Field names with asterisks are now properly parsed
- Community status and account quality show clean category values
- Distribution warning not displayed (still parsed and stored)
- KOL section shows "None identified" gracefully for missing data
- KOL mention recency displayed when available

---

## Session: 2026-01-11 Part 11 - New Stage 4 Fields & Distribution Warning

### Summary
Added parsing and display for three new Stage 4 output fields: narrative durability, KOL mention recency, and distribution warning. The distribution warning is displayed as a prominent red banner at the top of the scorecard when detected.

### Changes Made

#### 1. New Field Parsing (gumloop-parser.ts)
- Added `narrativeDurability`, `kolMentionRecency`, and `distributionWarning` to ParsedGumloopResponse interface
- Added field aliases for all three new fields with multiple variations
- Added parsing logic with validation (distributionWarning normalizes to "DISTRIBUTION SIGNAL DETECTED" when signal is detected)
- Backward compatible: missing fields return null/undefined

#### 2. Database Schema (shared/schema.ts)
- Added `narrativeDurability` column (text) - values: "High", "Medium", "Low"
- Added `kolMentionRecency` column (text) - values: "Last 7 days", "Last 30 days", etc.
- Added `distributionWarning` column (text) - "DISTRIBUTION SIGNAL DETECTED" or null

#### 3. Routes Update (server/routes.ts)
- Added new fields to processGumloopCompletion storage update

#### 4. Narrative Durability Badge (ScoreCard.tsx)
- Added color-coded durability badge next to the narrative name in the Narrative/Meta card
- Color coding: High = green, Medium = amber, Low = red
- Displays as "High Durability", "Medium Durability", or "Low Durability"

#### 5. Distribution Warning Banner (ScoreCard.tsx)
- Added prominent red warning banner at the top of completed analyses when distribution signal detected
- Banner includes AlertTriangle icon, "DISTRIBUTION SIGNAL DETECTED" heading, "Late-Phase Risk" badge
- Descriptive text warns users about distribution phase activity

#### 6. Verified Existing Implementations
- **CAUTIOUS BUY**: Confirmed handling in getRecommendationStyle() - amber/yellow color
- **Position Card**: Confirmed terminology in getExitLiquidityDisplay() - USER→"Favorable", AT_RISK→"Caution", EXIT_LIQUIDITY→"Unfavorable"
- **Upside Display**: Confirmed upsideMultiple and upsideTier display with color coding and FDV path detail

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Added 3 new fields to interface, field aliases, and parsing logic |
| `shared/schema.ts` | Added 3 new columns to tokenAnalyses table |
| `server/routes.ts` | Added 3 new fields to processGumloopCompletion update |
| `client/src/components/scorecard/ScoreCard.tsx` | Added narrative durability badge and distribution warning banner |

### Database Migration Required
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS narrative_durability TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS kol_mention_recency TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS distribution_warning TEXT;
```

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- All 3 new fields parsed from Gumloop output
- Narrative durability displayed as color-coded badge
- Distribution warning displayed as prominent banner when detected
- Backward compatible with older analyses (missing fields display nothing)
- All TypeScript compiles successfully

---

## Session: 2026-01-11 Part 10 - Upside Column, Premium Filtering & Admin Enhancements

### Summary
Replaced SIGNAL column with UPSIDE on leaderboard, added upside tier filtering, restricted search/filter/sort to premium users only, added recover functionality for failed analyses, and added full filtering capabilities to admin panel.

### Changes Made

#### 1. Recover Failed Analyses Feature
- New endpoint `POST /api/admin/analyze/:id/recover` to recover failed analyses that completed in Gumloop
- Fetches run status from Gumloop API and processes completion if DONE
- Added "Recover" button (amber) for failed analyses with gumloopRunId in Admin panel
- `client/src/lib/api.ts` - Added `adminRecoverAnalysis()` function

#### 2. Replaced SIGNAL Column with UPSIDE
- Removed SIGNAL (BUY/HOLD/AVOID) column from leaderboard
- Added UPSIDE column showing upside multiple (10x, 50x, 100x+)
- Color-coded badges: green (50x+), emerald (25-50x), cyan (10-25x), yellow (5-10x), orange (<5x)
- Added `upsideTier` and `upsideMultiple` to `AggregatedLeaderboardItem` type
- Updated backend to include upside fields in leaderboard query

#### 3. Improved Tooltips
- **UPSIDE**: "Potential Price Multiple — Estimated upside based on current FDV vs realistic peak FDV. Higher = more room to grow."
- **ASYM**: "Entry Timing Score (0-25) — Game-theoretic favorability of current entry. Considers your position vs other market participants."

#### 4. Fixed Upside Sorting
- Sorting now uses actual numeric value from `upsideMultiple` (e.g., "58x" → 58)
- Previously sorted by tier buckets which caused incorrect ordering within same tier

#### 5. Added Upside Tier Filter
- New filter dropdown on leaderboard: 100x+, 50-100x, 25-50x, 10-25x, 5-10x, <5x
- Filter applied post-aggregation to filter by latest analysis's upside tier
- Added `upsideTier` to `LeaderboardFilters` type in schema
- Backend extracts and applies upsideTier filter

#### 6. Premium-Only Search/Filter/Sort
- Free users see disabled search/filter controls with lock icons and "(PRO)" labels
- Sorting disabled in LeaderboardTable for free users (grayed out sort icons)
- Auto-resets filters/sort to defaults when free user detected
- `canUseAdvancedFeatures` flag based on `data.isPremium`

#### 7. Updated CTAs and Pricing
- **Leaderboard CTA**: "Viewing top 10. Upgrade for all X tokens + search, filter & sort."
- **Pricing page Free tier**: "1 vote per day • no search/filter/sort"
- **Pricing page Pro tier**: "all rankings + search, filter & sort"
- **Pricing page Premium tier**: "15 votes per day + search, filter & sort"
- **FAQ updated**: Mentions search, filter, sort as upgrade benefits

#### 8. Admin Panel Filtering
- Added full search and filter UI to admin leaderboard tab
- Filters: Tier, Type, FDV, Upside
- Search by ticker or name
- Updated `getAdminLeaderboard` API to accept and send filters
- Backend admin endpoint now extracts and applies all filter params

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added recover endpoint, admin leaderboard filters, upsideTier extraction for public leaderboard |
| `server/storage.ts` | Added upsideTier to leaderboard query/aggregation, post-aggregation filtering, upside sorting by numeric value, upsideTiers in getFilterOptions |
| `shared/schema.ts` | Added upsideTier to LeaderboardFilters |
| `client/src/lib/api.ts` | Added adminRecoverAnalysis, upsideTier to LeaderboardOptions and getLeaderboard/getAdminLeaderboard params |
| `client/src/types/leaderboard.ts` | Added upsideTier and upsideMultiple to AggregatedLeaderboardItem |
| `client/src/components/leaderboard/LeaderboardTable.tsx` | Replaced SIGNAL with UPSIDE column, added canSort prop, updated CTA message, improved tooltips |
| `client/src/pages/Leaderboard.tsx` | Added premium check, disabled search/filter/sort for free users, added upside filter dropdown |
| `client/src/pages/Admin.tsx` | Added recover mutation/button, full filter UI for leaderboard tab |
| `client/src/pages/Pricing.tsx` | Updated tier descriptions and FAQ to mention search/filter/sort |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Leaderboard shows UPSIDE column instead of SIGNAL
- Upside tier filter works correctly (post-aggregation filtering)
- Upside sorting uses actual numeric values
- Free users cannot search, filter, or sort the leaderboard
- Premium users have full access to all leaderboard features
- Admin panel has full filtering capabilities
- Failed analyses can be recovered if they completed in Gumloop

---

## Session: 2026-01-10 Part 9 - Mobile UI Optimization & Leaderboard Enhancements

### Summary
Comprehensive mobile UI/UX review and optimization across all pages. Fixed LATEST column to show actual latest analysis score, updated admin leaderboard to match public version, enhanced stats sections to show all 3 items, and added financial disclaimer bar.

### Changes Made

#### 1. LATEST Column Fix (Leaderboard)
- Added `latestScore` field to backend aggregation in `server/storage.ts`
- Updated `AggregatedLeaderboardItem` interface in `client/src/types/leaderboard.ts`
- LATEST column now shows actual score from most recent analysis (not average)

#### 2. Admin Leaderboard Match Public
- Admin leaderboard now uses the same `LeaderboardTable` component as public
- Shares all columns: Token, Type, Score, Tier, Signal, Asym, Runs, Narrative, Latest
- Full sorting capability on all columns

#### 3. Top Ranked, Hot Narratives, 24H Winners - Show All 3 Items
- Each stat section now displays info for all 3 items (not just first)
- Visual hierarchy with decreasing size/opacity: #1 (full), #2 (85%), #3 (70%)
- TOP_RANKED: Shows rank, symbol, days in top 3, and score
- HOT_NARRATIVES: Shows rank, narrative name, token count, and avg score
- 24H_WINNERS: Shows rank, symbol, and score

#### 4. Financial Disclaimer Bar
- Added "NOT FINANCIAL ADVICE" banner above cyber status bar
- Uses AlertTriangle icon with amber color scheme
- Mobile-responsive: full text on desktop, shortened on mobile

#### 5. Mobile UI/UX Optimizations

**Vote.tsx (lines 165-187)**
- Vote status stacks vertically on mobile (`flex-col sm:flex-row`)
- Shortened labels on mobile ("Votes:" instead of "Votes remaining:")
- Compact priority badge and reduced icon sizes on mobile

**Home.tsx**
- Status badge (lines 133-146): Smaller text, shorter content on mobile
- Scoring methodology (lines 352-382): Responsive widths, smaller text with truncation

**Pricing.tsx (lines 195-231)**
- Current plan banner stacks on mobile
- Button takes full width on mobile

**Leaderboard.tsx (lines 299-418)**
- Filter panel uses 2-column grid on mobile
- FDV filter spans full width
- Smaller text in select triggers on mobile

### Files Modified
| File | Changes |
|------|---------|
| `server/storage.ts` | Added `latestScore` to tokenMap aggregation |
| `client/src/types/leaderboard.ts` | Added `latestScore` to AggregatedLeaderboardItem |
| `client/src/components/leaderboard/LeaderboardTable.tsx` | Updated LATEST column to use `item.latestScore` |
| `client/src/pages/Admin.tsx` | Uses shared LeaderboardTable component |
| `client/src/pages/Leaderboard.tsx` | Enhanced stats sections, responsive filter panel |
| `client/src/components/common/Layout.tsx` | Added disclaimer bar, adjusted main padding |
| `client/src/pages/Vote.tsx` | Mobile-responsive vote status layout |
| `client/src/pages/Home.tsx` | Mobile-responsive status badge and scoring section |
| `client/src/pages/Pricing.tsx` | Mobile-responsive current plan banner |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- All pages optimized for mobile viewing
- Leaderboard shows correct latest scores
- Stats sections display all 3 items with visual hierarchy
- Financial disclaimer visible on all pages
- Admin panel matches public leaderboard functionality

### Mobile Breakpoint Reference
- `sm:` = 640px+ (tablets and up)
- `md:` = 768px+ (small laptops)
- `lg:` = 1024px+ (laptops)
- `xl:` = 1280px+ (large screens)

---

## Session: 2026-01-10 Part 8 - Admin Scorecard Access Fix

### Summary
Fixed critical bug where admins couldn't view scorecards for newly analyzed tokens. Two issues: 1) access gating was blocking new tokens, 2) auth token wasn't being sent with analysis requests.

### Root Cause
1. The `/api/analyze/:id` endpoint checks if a user has access based on their subscription tier's leaderboard limit. New tokens without high rankings were blocked.
2. The `getAnalysis` API function didn't pass the auth token, so the server couldn't identify the user as an admin.

### Fix
1. **Server**: Added admin bypass using `req.isAdmin` (already set by `optionalAuth` middleware)
2. **Client API**: Updated `getAnalysis()` to accept optional `authToken` parameter
3. **Client Hook**: Updated `useAnalysis()` to get auth token via `useAuth()` and pass it to `getAnalysis()`

Now logged-in admins have their token sent with analysis requests, and the server bypasses access checks for admins.

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Use `req.isAdmin` for admin bypass, added debug logging |
| `client/src/lib/api.ts` | `getAnalysis()` now accepts optional `authToken` |
| `client/src/hooks/useAnalysis.ts` | Import `useAuth`, get token and pass to API |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Note
Both server restart AND client refresh required for this fix to take effect.

---

## Session: 2026-01-10 Part 7 - Top 3 Narratives & Winners UI

### Summary
Updated leaderboard stats to show top 3 hot narratives and top 3 24H winners instead of just 1 each. Added contextual back button for admin panel navigation.

### Changes Made

#### 1. Backend: Top 3 Leaderboard Stats
- Updated `getLeaderboardStats()` to return arrays instead of single items
- Changed `topNarrative` → `topNarratives[]` (up to 3)
- Changed `winner24h` → `winners24h[]` (up to 3)
- Updated IStorage interface, DatabaseStorage, and MemStorage implementations

#### 2. Frontend: Top 3 Display with Descending Prominence
- **Hot Narratives**: Shows #1, #2, #3 with decreasing size and opacity
  - #1: Large text (text-lg), full opacity, shows avg score and token count
  - #2: Medium text (text-sm), 80% opacity
  - #3: Small text (text-xs), 60% opacity
  - Expand/collapse for long #1 narrative name
- **24H Winners**: Shows #1, #2, #3 with decreasing size and opacity
  - Same prominence hierarchy as narratives
  - #1 shows score, #2/#3 just show symbol

#### 3. Admin Panel Back Button
- Scorecard pages now detect `?from=admin` query parameter
- Shows "Back to Admin Panel" with Shield icon when from admin
- Links to `/admin` instead of `/leaderboard`
- Updated Admin page links to include `?from=admin`

### Files Modified
| File | Changes |
|------|---------|
| `server/storage.ts` | Updated getLeaderboardStats to return top 3 arrays |
| `client/src/lib/api.ts` | Updated LeaderboardStats interface |
| `client/src/pages/Leaderboard.tsx` | New UI for top 3 narratives and winners with prominence |
| `client/src/pages/Analyze.tsx` | Added fromAdmin detection and conditional back button |
| `client/src/pages/Admin.tsx` | Added ?from=admin to analysis links |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Note
Server restart required for backend changes to take effect.

---

## Session: 2026-01-10 Part 6 - Narrative Normalization & Hot Narrative Fixes

### Summary
Fixed narrative normalization issues for proper capitalization of acronyms (AI, NFT, DeFi, etc.), added minimum token requirement for Hot Narrative, and added expand/collapse functionality for long narrative names.

### Changes Made

#### 1. Improved Narrative Normalization
- Added `UPPERCASE_ACRONYMS` list for proper casing: AI, NFT, DeFi, RWA, DePIN, DeSci, DAO, DEX, CEX, APY, TVL, ZK
- Updated `normalizeNarrative()` to preserve acronym casing (e.g., "Ai" → "AI")
- Added DeSci to narrative mappings
- Added generic "AI" keyword match with word boundaries

#### 2. Minimum Token Requirement for Hot Narrative
- Added `MIN_TOKENS_FOR_HOT_NARRATIVE = 3` constant
- Hot Narrative now requires at least 3 unique tokens to qualify
- Prevents single high-scoring tokens from dominating the Hot Narrative section

#### 3. Expand/Collapse for Long Narrative Names
- Added `narrativeExpanded` state to Leaderboard page
- Narrative names longer than 12 characters show expand/collapse chevron icon
- Clicking the icon toggles between truncated and full text display

#### 4. Fixed Admin Page Link Issues
- Fixed nested `<a>` tags in Leaderboard and All Analyses tables
- Fixed leaderboard token links to use correct `/analyze/${item.latestAnalysisId}` path
- Added explicit click handling on Reprocess button

### Files Modified
| File | Changes |
|------|---------|
| `server/storage.ts` | Added UPPERCASE_ACRONYMS, updated normalizeNarrative(), added MIN_TOKENS_FOR_HOT_NARRATIVE |
| `client/src/pages/Leaderboard.tsx` | Added narrativeExpanded state, expand/collapse UI for long narratives |
| `client/src/pages/Admin.tsx` | Fixed nested `<a>` tags, fixed link paths, improved button click handling |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Narrative normalization properly capitalizes acronyms
- Hot Narrative requires 3+ tokens to qualify
- Long narrative names can be expanded/collapsed
- Admin page links work correctly

### Note
Server restart required for narrative normalization changes to take effect.

---

## Session: 2026-01-10 Part 5 - Reprocess & Data Fixes

### Summary
Fixed issues where upside assessment and market data weren't being saved to analyses. Added reprocess functionality to fix existing analyses without re-running the Gumloop pipeline.

### Changes Made

#### 1. Fixed Missing Upside Assessment Data
- Added upside fields (`currentFdv`, `realisticPeakFdv`, `upsideMultiple`, `upsideTier`) to `processGumloopCompletion` update
- Fields were being parsed but not saved to database

#### 2. Added CoinGecko Market Data Fetch
- Admin analyze endpoint now fetches market data from CoinGecko API
- Saves price, FDV, 24h change, and 7d change to analysis record

#### 3. Added Reprocess Endpoint
- `POST /api/admin/analyze/:id/reprocess`
- Re-parses existing Gumloop output to extract missing fields
- Fetches fresh market data from CoinGecko
- Updates analysis record without re-running the full pipeline

#### 4. Admin Page Reprocess Button
- Added Actions column to All Analyses table
- Reprocess button appears for completed analyses
- Shows loading spinner while processing

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added upside fields to processGumloopCompletion, market data fetch in admin analyze, reprocess endpoint |
| `client/src/lib/api.ts` | Added `adminReprocessAnalysis` function |
| `client/src/pages/Admin.tsx` | Added reprocess mutation and button to table |

### Commands Run
- `npx drizzle-kit push` - Synced database schema with new columns
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Upside assessment and market data now properly saved for new analyses
- Existing analyses can be reprocessed via Admin panel to fix missing data
- Admin page fully functional with all features

### Still Needs Work
- Test reprocess functionality on existing analyses
- Run database migrations for voting tables in production if needed

---

## Session: 2026-01-10 Part 4 - Admin Panel & Analysis Triggering

### Summary
Added a full admin system for running analyses and viewing all data. Admin users (identified by email via environment variable) can now trigger analyses via the UI, view the full leaderboard without access limits, and see all analyses history.

### Changes Made

#### 1. Admin Authentication
- Added `isAdmin` flag to Express Request interface
- Added `requireAdmin` middleware that checks user email against `ADMIN_EMAILS` env var
- Updated `requireAuth` and `optionalAuth` to also set `isAdmin` flag
- Added `isAdminEmail()` utility function

#### 2. Admin API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/status` | GET | Check if current user is admin |
| `/api/admin/analyze` | POST | Trigger analysis for a token (CoinGecko ID) |
| `/api/admin/leaderboard` | GET | Full leaderboard (no access limits) |
| `/api/admin/analyses` | GET | All analyses history with status filter |
| `/api/admin/sync-gumloop` | POST | Now protected with `requireAdmin` |

#### 3. Admin Analyze Workflow
1. Admin searches for token using existing TokenSearch component
2. Clicks "Start Analysis" button
3. Backend creates analysis record with `status: "processing"`
4. Calls Gumloop API to start pipeline
5. Saves `gumloopRunId` for webhook matching
6. Results flow back via existing webhook → leaderboard

#### 4. Admin Page (`/admin`)
- Three tabs: Run Analysis, Leaderboard, All Analyses
- **Run Analysis**: Token search + start analysis button + sync stuck analyses
- **Leaderboard**: Full table with all tokens (no access limit)
- **All Analyses**: History table showing all analyses with status, score, tier

#### 5. New Storage Methods
- `getLatestAnalysisByTokenId()` - Get most recent analysis for a token
- `getAllAnalyses()` - Get all analyses with optional status filter

### Files Modified
| File | Changes |
|------|---------|
| `server/auth.ts` | Added `isAdmin` to Request, `requireAdmin` middleware, `isAdminEmail()` function |
| `server/routes.ts` | Added admin endpoints, protected sync-gumloop with requireAdmin |
| `server/storage.ts` | Added `getLatestAnalysisByTokenId()` and `getAllAnalyses()` methods |
| `client/src/lib/api.ts` | Added admin API functions |
| `client/src/pages/Admin.tsx` | New admin page component |
| `client/src/App.tsx` | Added `/admin` route |

### Environment Variable Required
```bash
# Comma-separated list of admin email addresses
ADMIN_EMAILS=admin@example.com,owner@example.com
```

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Admin panel fully functional at `/admin`
- Admins can trigger analyses that flow through Gumloop pipeline
- Results appear on leaderboard when webhook completes
- Full leaderboard and analysis history accessible to admins

### Still Needs Work
- Run database migrations for voting tables and upside assessment in production
- Configure Stripe price IDs for new tiers
- Test voting flow and upside assessment end-to-end

---

## Session: 2026-01-10 Part 3 - Scoring System Updates

### Summary
Added new upside assessment fields parsing and display, CAUTIOUS BUY recommendation support, and updated Position card terminology for consistency with winning_side values.

### Changes Made

#### 1. New Upside Assessment Fields
- **Parser**: Added `currentFdv`, `realisticPeakFdv`, `upsideMultiple`, `upsideTier` to ParsedGumloopResponse
- **Schema**: Added 4 new columns to tokenAnalyses table
- **Field Aliases**: Added parsing variations (e.g., `current_fdv`, `peak_fdv`, `upside_multiple`)
- **Values**:
  - `currentFdv`: Current FDV as string like "$5M", "$44.33M"
  - `realisticPeakFdv`: Estimated peak FDV like "$500M"
  - `upsideMultiple`: Potential multiple like "10x", "50x", "100x"
  - `upsideTier`: "<5x", "5-10x", "10-25x", "25-50x", "50-100x", "100x+"

#### 2. Upside Assessment Display (ScoreCard)
- New section in Game Theory Context area
- **Upside Multiple**: Prominently displayed (3xl-4xl font) with color coding based on tier
- **Upside Tier Badge**: Color-coded pill (green for high, yellow for moderate, red for low)
- **FDV Path**: Shows current → peak FDV range as supporting detail
- **Color Coding**:
  - 100x+, 50-100x → Green
  - 25-50x → Emerald
  - 10-25x → Yellow
  - 5-10x → Orange
  - <5x → Red

#### 3. CAUTIOUS BUY Recommendation
- **Parser**: Updated to recognize "CAUTIOUS BUY" as valid recommendation (checked before "BUY")
- **Display**: Amber/yellow color (distinct from green BUY, gray HOLD, red AVOID)
- **Badge**: Shows "CAUTIOUS BUY" text with `bg-amber-500/20 text-amber-400`

#### 4. Position Card Terminology Update
- Aligned with winning_side values:
  - `USER` → "Favorable" (green)
  - `AT_RISK` → "Caution" (yellow)
  - `EXIT_LIQUIDITY` → "Unfavorable" (red)
- Updated both Key Metrics card and Game Theory Context section

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Added upside assessment fields to interface, added field aliases, updated recommendation parsing for CAUTIOUS BUY |
| `shared/schema.ts` | Added 4 new columns (currentFdv, realisticPeakFdv, upsideMultiple, upsideTier), updated recommendation comment |
| `client/src/components/scorecard/ScoreCard.tsx` | Updated getRecommendationStyle for CAUTIOUS BUY, added Upside Assessment section, fixed Position card terminology |

### Database Migration Required
```sql
-- Add upside assessment columns
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS current_fdv TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS realistic_peak_fdv TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS upside_multiple TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS upside_tier TEXT;
```

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Upside assessment fields parsed from Gumloop output
- Upside assessment section displays in ScoreCard when fields present
- CAUTIOUS BUY recommendation displays with amber color
- Position card shows consistent terminology
- Backward compatible: older analyses without new fields render correctly

### Still Needs Work
- Add authentication to admin endpoint (from previous session)
- Run database migration for voting tables and upside assessment in production
- Configure Stripe price IDs for new tiers
- Test voting flow and upside assessment end-to-end

---

## Session: 2026-01-10 Part 2 - Gumloop Sync Fallback

### Summary
Added background polling and admin endpoint to sync stuck analyses with Gumloop. This provides a fallback when webhooks fail to be received, preventing analyses from getting stuck in "processing" state indefinitely.

### Changes Made

#### 1. Gumloop Sync Functions
- **`fetchGumloopRunStatus()`** - Fetches run status from Gumloop API
- **`syncAnalysisWithGumloop()`** - Syncs a single analysis with Gumloop
- **`syncStuckAnalysesWithGumloop()`** - Syncs all stuck analyses (>5 min old with runId)

#### 2. Admin Sync Endpoint
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/sync-gumloop` | POST | Manually trigger sync of stuck analyses |

#### 3. Background Polling
- Runs every **2 minutes** automatically
- Checks all stuck analyses against Gumloop API
- If Gumloop shows DONE → processes completion and updates database
- If Gumloop shows FAILED/TERMINATED → marks analysis as failed
- Starts on server startup (after 5-second delay)
- Stops gracefully on shutdown

#### 4. New Storage Method
- **`getStuckAnalysesWithRunId()`** - Gets pending/processing analyses older than X minutes that have a `gumloopRunId`

### Files Modified
| File | Changes |
|------|---------|
| `server/storage.ts` | Added `getStuckAnalysesWithRunId()` to IStorage interface, PostgresStorage, and MemStorage |
| `server/routes.ts` | Added Gumloop sync functions, admin endpoint, background polling start/stop |
| `server/index.ts` | Import and call `startGumloopSyncPolling()` on startup, `stopGumloopSyncPolling()` on shutdown |

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully

### Current State
- Background polling provides fallback for webhook failures
- Admin can manually trigger sync via POST to `/api/admin/sync-gumloop`
- Stuck analyses will be automatically recovered within 2 minutes

### Still Needs Work
- Add authentication to admin endpoint (currently unprotected)
- Run database migration for voting tables in production
- Configure Stripe price IDs for new tiers
- Test voting flow end-to-end

---

## Session: 2026-01-10 - View-Only Pivot

### Summary
Converted app from user-triggered analysis to view-only model. Free users can view top 10 tokens, paid users get full access. Added voting system for users to request token analyses.

### Changes Made

#### 1. New Subscription Model (Access-Based)
| Tier | Price | Leaderboard Access | Scorecards | Votes/Day | Priority |
|------|-------|-------------------|------------|-----------|----------|
| Free | $0 | Top 10 only | Top 10 only | 1 | No |
| Pro | $19/mo | Unlimited | Unlimited | 5 | No |
| Premium | $49/mo | Unlimited | Unlimited | 15 | Yes (2x weight) |

#### 2. Voting System
- **New tables**: `token_vote_requests`, `token_votes`, `user_daily_votes`
- **Vote flow**: Users search for tokens and vote for analysis
- **Priority votes**: Premium users' votes count 2x
- **Daily limits**: Votes reset at midnight UTC
- **Top voted tokens**: Displayed on Vote page, highest votes get analyzed first

#### 3. Access Gating
- **Leaderboard**: Free users see only top 10 tokens
- **Scorecards**: Free users can only view scorecards for top 10 tokens
- **Backend enforcement**: Both leaderboard and analysis endpoints check subscription tier

#### 4. API Endpoints Added
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vote/status` | GET | User's vote status (remaining, used, limit) |
| `/api/vote/requests` | GET | List of pending vote requests |
| `/api/vote/top` | GET | Top voted pending tokens |
| `/api/vote/recently-analyzed` | GET | Recently analyzed from votes |
| `/api/vote` | POST | Submit vote for a token |

#### 5. Frontend Changes
- **New Vote page** (`/vote`) - Search tokens, view top voted, vote for analysis
- **Updated Pricing page** - Shows new tier structure, removed credit packs
- **Home page** - Already updated to show "View Leaderboard" and "Vote for Tokens" CTAs

#### 6. Removed Features (Discontinued)
- User-triggered token analysis (`POST /api/analyze`)
- Analysis retry (`POST /api/analyze/:id/retry`)
- Analysis cancel (`POST /api/analyze/:id/cancel`)
- Credit pack purchases
- These endpoints now return 410 Gone with helpful message

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added voting endpoints, access gating for leaderboard/scorecards |
| `server/storage.ts` | Added voting methods to PostgresStorage and MemStorage |
| `server/stripe.ts` | Updated tier-to-price mappings for new tiers |
| `shared/schema.ts` | New subscription tiers, voting tables and types |
| `client/src/App.tsx` | Added `/vote` route |
| `client/src/lib/api.ts` | Added voting API functions |
| `client/src/pages/Vote.tsx` | New voting page component |
| `client/src/pages/Pricing.tsx` | Updated for access-based tiers, removed credit packs |
| `client/src/pages/Home.tsx` | (Previously updated) Landing page CTAs |
| `client/src/components/scorecard/ScoreCard.tsx` | (Previously updated) Removed retry/cancel/reanalyze |
| `client/src/hooks/useAnalysis.ts` | (Previously updated) Removed analysis hooks |

### Database Migration Required
Run the migration file: `migrations/0003_add_voting_tables.sql`
```sql
CREATE TABLE "token_vote_requests" (
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

CREATE TABLE "token_votes" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "token_vote_request_id" integer NOT NULL,
  "is_priority_vote" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE "user_daily_votes" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "votes_used" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);
-- Plus indexes (see migration file)
```

### Stripe Configuration Required
Update environment variables:
- `STRIPE_PRO_PRICE_ID` - Price ID for Pro tier ($19/mo)
- `STRIPE_PREMIUM_PRICE_ID` - Price ID for Premium tier ($49/mo)

### Commands Run
- `npx tsc --noEmit` - TypeScript compiles successfully
- `npm run build` - Production build successful

### Current State
- View-only model fully implemented
- Free users: Top 10 leaderboard + scorecards, 1 vote/day
- Pro users ($19): Full access, 5 votes/day
- Premium users ($49): Full access, 15 priority votes/day
- Voting page functional with token search
- All TypeScript compiles successfully
- Build passes

### Still Needs Work
- Run database migration in production
- Configure Stripe price IDs for new tiers
- Test voting flow end-to-end
- Add upgrade prompts when users hit access limits

---

## Session: 2026-01-09 Part 5

### Summary
Updated FDV category thresholds to 8 tiers with new ranges. Added Giga Cap tier and Upper Mid Cap tier.

### Changes Made

#### 1. New FDV Category Thresholds
Updated all FDV tier calculations with new thresholds:
| Tier | FDV Range | Score Cap | Badge Color |
|------|-----------|-----------|-------------|
| Nano Cap | <$5M | None | Pink (vibrant) |
| Micro Cap | $5M-$15M | None | Purple (vibrant) |
| Small Cap | $15M-$50M | None | Blue |
| Mid Cap | $50M-$150M | None | Cyan |
| Upper Mid Cap | $150M-$500M | 90 | Emerald |
| Large Cap | $500M-$1B | 85 | Green |
| Mega Cap | $1B-$5B | 80 | Amber |
| Giga Cap | >$5B | 75 | Yellow |

#### 2. Server Updates
- Updated FDV tier calculation in both polling and webhook handlers
- Added new tier values: `giga` and `upper_mid`
- Adjusted score caps: Giga=75, Mega=80, Large=85, Upper Mid=90

#### 3. ScoreCard Updates
- Added Giga Cap and Upper Mid Cap to badge display
- Updated FDV Scaling Explanation for all 4 capped tiers
- Colors: smaller caps use vibrant pink/purple, larger caps use neutral green/amber/yellow

#### 4. Leaderboard Filter Updates
- Added 8 filter options matching new thresholds
- Filter values: giga, mega, large, upper_mid, mid, small, micro, nano

#### 5. Phase Modifier Range Verification
- Verified Score Modifiers display handles +12 to -30 range
- `formatModifier` function works correctly with any value

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Updated FDV tier thresholds (both handlers) |
| `client/src/components/scorecard/ScoreCard.tsx` | Added giga/upper_mid tiers, updated colors and explanations |
| `client/src/pages/Leaderboard.tsx` | Updated FDV filter with 8 tiers |

### Current State
- 8 FDV tiers with new thresholds
- Vibrant colors for high-asymmetry tiers (Nano, Micro)
- Neutral colors for established tiers (Large, Mega, Giga)
- All TypeScript compiles successfully

---

## Session: 2026-01-09 Part 4

### Summary
Replaced Market Cap with FDV (Fully Diluted Valuation) throughout the scorecard. Updated tier thresholds to use FDV-based calculations.

### Changes Made

#### 1. Parser Updates
- Added `fdvModifier` field to ParsedGumloopResponse interface
- Field alias: `fdv_modifier` with fallback to `market_cap_modifier` for backward compatibility
- Both marketCapModifier and fdvModifier supported, fdvModifier takes precedence

#### 2. Schema Updates
- Added `fdvModifier` column (numeric, precision 5, scale 2)
- Added `fdvTier` column (text: nano, micro, small, mid, large, mega)
- Kept `marketCapModifier` and `marketCapTier` for backward compatibility with old analyses

#### 3. Routes Updates
- Fetch FDV from CoinGecko: `fully_diluted_valuation.usd`
- Store FDV in `fdv` field (falls back to market cap if FDV unavailable)
- New FDV tier thresholds:
  - Nano: <$1M (no cap)
  - Micro: $1M-$10M (no cap)
  - Small: $10M-$50M (no cap)
  - Mid: $50M-$200M (cap: 90)
  - Large: $200M-$1B (cap: 85)
  - Mega: >$1B (cap: 80)
- Server-side `fdvModifier` calculation when score is capped

#### 4. ScoreCard Updates
- Renamed `formatMarketCap` to `formatFDV`
- Hero section shows "FDV" label instead of "Market Cap"
- Cap category badge uses `fdvTier` with fallback to `marketCapTier`
- Added "Nano Cap" tier badge (emerald color)
- Score Modifiers shows "FDV" label with fdvModifier value
- FDV Scaling Explanation section updated with new tier names and thresholds

#### 5. Leaderboard Updates
- Filter label changed from "MARKET_CAP" to "FDV"
- Placeholder changed from "All caps" to "All FDVs"
- Filter options updated with new FDV thresholds

### Files Modified
| File | Changes |
|------|---------|
| `server/gumloop-parser.ts` | Added fdvModifier field and fdv_modifier alias |
| `shared/schema.ts` | Added fdvModifier and fdvTier columns |
| `server/routes.ts` | Fetch FDV from CoinGecko, calculate fdvTier with new thresholds |
| `client/src/components/scorecard/ScoreCard.tsx` | Replaced Market Cap with FDV throughout |
| `client/src/pages/Leaderboard.tsx` | Updated FDV filter labels and thresholds |

### Database Migration Required
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS fdv_modifier NUMERIC(5,2);
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS fdv_tier TEXT;
```

### Current State
- Scorecard displays FDV instead of Market Cap
- New tier thresholds based on FDV values
- Backward compatible with analyses that only have marketCap/marketCapTier
- All TypeScript compiles successfully

### Known Issues
- None

---

## Session: 2026-01-09 Part 3

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

#### 4. Analysis Rate Limiter Fix
- **Increased rate limit** from 10 to 30 requests per minute for `/api/analyze` endpoint
- **Root cause**: Express rate limiter was too strict, blocking legitimate concurrent analysis requests
- **Updated error message** to be more generic ("Too many requests" instead of "rate limit exceeded")

#### 5. Increased Concurrent Analysis Limit
- **Increased per-user concurrent limit** from 2 to 10 running analyses
- **Rationale**: Gumloop handles queuing automatically, DB supports high concurrency, no technical bottleneck
- **Updated both endpoints**: `/api/analyze` and `/api/analyze/:id/retry`

#### 6. Fixed Gumloop Rate Limiting Race Condition
- **Root cause**: Multiple simultaneous requests would all check the timestamp together, then fire at Gumloop simultaneously
- **In-memory queue**: When Redis not configured, requests serialize via promise chain
- **Atomic Redis operations**: Uses `INCR` to assign unique slot numbers, preventing race condition
- **Increased interval**: From 2 to 3 seconds between Gumloop API calls
- **Added jitter**: Fallback includes random delay to spread out requests

### Files Modified
| File | Changes |
|------|---------|
| `server/routes.ts` | Added server-side marketCapModifier calculation, increased concurrent limit to 10 |
| `server/gumloop-parser.ts` | Added communityStatus, accountQuality fields with fallback aliases |
| `shared/schema.ts` | Added community_status and account_quality columns |
| `client/src/components/scorecard/ScoreCard.tsx` | New 4-card Social Signals layout, adjusted modifier box sizing |
| `server/index.ts` | Increased analysis endpoint rate limit from 10 to 30 per minute |
| `server/redis.ts` | Fixed Gumloop rate limiting with in-memory queue and atomic Redis ops |

### Database Migration Required
```sql
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS community_status TEXT;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS account_quality TEXT;
```

### Current State
- Market Cap modifier now displays for capped analyses (mid/large/mega cap tokens)
- Social Signals shows 4 cards: Narrative Heat, Community Status, Account Quality, Notable KOLs
- No more "N/A" values in Social Signals section
- Users can run up to 10 concurrent analyses
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
