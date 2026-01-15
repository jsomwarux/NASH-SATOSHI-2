-- Sub-Narrative Support Migration
-- Adds primary/sub narrative classification and ceiling FDV fields

-- ============================================================
-- ADD SUB-NARRATIVE COLUMNS TO TOKEN_ANALYSES
-- ============================================================

ALTER TABLE "token_analyses"
  ADD COLUMN IF NOT EXISTS "primary_narrative" text;

ALTER TABLE "token_analyses"
  ADD COLUMN IF NOT EXISTS "sub_narrative" text;

ALTER TABLE "token_analyses"
  ADD COLUMN IF NOT EXISTS "sub_narrative_ceiling" text;

ALTER TABLE "token_analyses"
  ADD COLUMN IF NOT EXISTS "sub_narrative_consensus" text;

-- ============================================================
-- BACKFILL: Copy existing narrative to sub_narrative
-- For existing analyses, use narrative as sub_narrative
-- ============================================================

UPDATE "token_analyses"
SET "sub_narrative" = "narrative"
WHERE "narrative" IS NOT NULL
  AND "sub_narrative" IS NULL;

-- ============================================================
-- INDEXES FOR NARRATIVE FILTERING
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_token_analyses_primary_narrative"
  ON "token_analyses" ("primary_narrative")
  WHERE "status" = 'completed';

CREATE INDEX IF NOT EXISTS "idx_token_analyses_sub_narrative"
  ON "token_analyses" ("sub_narrative")
  WHERE "status" = 'completed';
