CREATE TABLE "credit_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_paid" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"analyses_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"monthly_analyses_used" integer DEFAULT 0,
	"monthly_reset_date" date,
	"credit_balance" integer DEFAULT 0,
	"trial_start_date" date,
	"weekly_analyses_used" integer DEFAULT 0,
	"weekly_reset_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id")
);
