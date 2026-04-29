-- Aggregation v2 fields (Final Aggregation node upgrade, 2026-04-29)
-- Adds nullable columns for new fields produced by the upgraded Gumloop workflow.
-- All columns are nullable because pre-upgrade rows won't have these values; the
-- frontend renders them conditionally and treats absence as "not applicable" rather
-- than "unknown".
--
-- Existing enum-style columns (phase_name, account_quality, token_type,
-- unlock_warning) remain plain TEXT — validation is application-level. No DB
-- migration is needed for the expanded enum sets:
--   * phase_name: 5 -> 7 values (added Early/Late Expansion, Early/Late Mania)
--   * account_quality: slashed -> hyphenated (Builders/Researchers -> Builders-Researchers)
--   * token_type: added HYBRID
--   * unlock_warning: binary -> graded (NONE | MINOR | MODERATE: ... | SEVERE: ...)

ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS vapor_cap_applied text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS team_activity text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS fud_signals text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS consensus_penalty_modifier numeric(5, 2);
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS relative_spread text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS ceiling_confidence text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS ceiling_divergence text;
ALTER TABLE token_analyses ADD COLUMN IF NOT EXISTS bear_case text;
