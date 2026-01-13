-- User Feedback Table
-- Stores feedback submissions and issue reports from users

CREATE TABLE IF NOT EXISTS "user_feedback" (
  "id" serial PRIMARY KEY,
  "user_id" text,
  "user_email" text,
  "type" text NOT NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "token_symbol" text,
  "analysis_id" integer,
  "status" text DEFAULT 'new',
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for querying feedback
CREATE INDEX IF NOT EXISTS "idx_user_feedback_status" ON "user_feedback" ("status");
CREATE INDEX IF NOT EXISTS "idx_user_feedback_type" ON "user_feedback" ("type");
CREATE INDEX IF NOT EXISTS "idx_user_feedback_created" ON "user_feedback" ("created_at" DESC);
