-- Add job_runs table to track scheduled job execution
-- This enables detection of missed runs after server restarts

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" serial PRIMARY KEY,
  "job_name" text NOT NULL UNIQUE,
  "last_run_at" timestamp,
  "last_scheduled_date" text,
  "last_run_metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Index for quick lookup by job name
CREATE INDEX IF NOT EXISTS "idx_job_runs_job_name" ON "job_runs" ("job_name");
