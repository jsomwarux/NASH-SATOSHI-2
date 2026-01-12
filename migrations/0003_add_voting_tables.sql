-- Migration: Add voting tables for view-only model
-- This migration adds tables to support the voting system where users
-- vote for tokens they want analyzed

-- Token vote requests - tracks tokens users want analyzed
CREATE TABLE "token_vote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"token_symbol" text NOT NULL,
	"token_name" text NOT NULL,
	"token_image" text,
	"vote_count" integer DEFAULT 0,
	"priority_vote_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"analyzed_at" timestamp,
	"analysis_id" integer
);

-- Individual votes - tracks who voted for what
CREATE TABLE "token_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_vote_request_id" integer NOT NULL,
	"is_priority_vote" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Daily vote tracking - enforces daily vote limits per user
CREATE TABLE "user_daily_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"votes_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX "idx_vote_requests_token_id" ON "token_vote_requests" ("token_id");
CREATE INDEX "idx_vote_requests_status" ON "token_vote_requests" ("status");
CREATE INDEX "idx_vote_requests_vote_score" ON "token_vote_requests" (("vote_count" + ("priority_vote_count" * 2)) DESC);
CREATE INDEX "idx_token_votes_user_id" ON "token_votes" ("user_id");
CREATE INDEX "idx_token_votes_request_id" ON "token_votes" ("token_vote_request_id");
CREATE INDEX "idx_user_daily_votes_user_date" ON "user_daily_votes" ("user_id", "date");

-- Unique constraint to prevent duplicate vote requests for same token
CREATE UNIQUE INDEX "idx_vote_requests_unique_token" ON "token_vote_requests" ("token_id");

-- Unique constraint to prevent user voting twice for same request
CREATE UNIQUE INDEX "idx_token_votes_unique_user_request" ON "token_votes" ("user_id", "token_vote_request_id");
