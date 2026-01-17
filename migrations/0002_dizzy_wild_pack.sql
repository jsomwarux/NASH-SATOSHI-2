CREATE TABLE "performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_date" text NOT NULL,
	"top10_avg_7d_return" numeric(10, 4),
	"top10_avg_30d_return" numeric(10, 4),
	"hit_rate_7d" numeric(5, 2),
	"hit_rate_30d" numeric(5, 2),
	"tier_metrics" jsonb,
	"total_tokens" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"price_usd" numeric(20, 10) NOT NULL,
	"market_cap" numeric(20, 2),
	"fdv" numeric(20, 2),
	"volume_24h" numeric(20, 2),
	"snapshot_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_sharers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verified_share_count" integer DEFAULT 0,
	"priority_granted_at" timestamp DEFAULT now() NOT NULL,
	"priority_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priority_sharers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "reanalysis_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"token_symbol" text NOT NULL,
	"token_name" text NOT NULL,
	"token_image" text,
	"chain" text,
	"contract_address" text,
	"source" text,
	"priority" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"batch_id" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"gumloop_run_id" text,
	"analysis_id" integer,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_code" text NOT NULL,
	"visitor_id" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"landing_page" text,
	"converted_user_id" text,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "token_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_vote_request_id" integer NOT NULL,
	"is_priority_vote" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_daily_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"votes_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "user_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"share_type" text NOT NULL,
	"share_url" text,
	"token_symbol" text,
	"analysis_id" integer,
	"verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "token_type" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "narrative_rank" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "primary_narrative" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sub_narrative" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sub_narrative_ceiling" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sub_narrative_consensus" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "thesis" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "catalyst_1" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "catalyst_2" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "catalyst_3" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "risk_1" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "risk_2" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "risk_3" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "x_mentions_trend" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "x_sentiment" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "x_top_kols" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "community_status" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "account_quality" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "engagement_quality" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "overall_sentiment" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "cult_vs_mercenary" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sentiment_bullish_ratio" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sentiment_bearish_ratio" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sentiment_neutral_ratio" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "likes_per_post_avg" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "retweets_per_post_avg" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "replies_per_post_avg" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "cult_mercenary_ratio" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "sentiment_sample_size" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "unlock_warning" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "team_status" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "notable_backers" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "market_cap_modifier" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "fdv_modifier" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "fdv_tier" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "market_cap_tier" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "score_capped" boolean;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "uncapped_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "current_fdv" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "realistic_peak_fdv" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "upside_multiple" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "upside_tier" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "narrative_durability" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "kol_mention_recency" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "distribution_warning" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "score_calculation" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "model_analyses" jsonb;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "score_spread" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "divergence_flag" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "divergence_note" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "price_at_analysis" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "token_analyses" ADD COLUMN "charge_type" text;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "referred_by" text;