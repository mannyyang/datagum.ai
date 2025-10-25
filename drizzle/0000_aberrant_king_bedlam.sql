CREATE TABLE "content_analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" uuid NOT NULL,
	"question" text NOT NULL,
	"target_url_found" boolean DEFAULT false NOT NULL,
	"found_in_sources" boolean DEFAULT false NOT NULL,
	"found_in_citations" boolean DEFAULT false NOT NULL,
	"all_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"all_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_analysis_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"user_ip" varchar(45),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"generated_faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"test_metrics" jsonb,
	"scraping_error" text,
	"article_title" text,
	"article_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_analysis_results" ADD CONSTRAINT "content_analysis_results_submission_id_content_analysis_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."content_analysis_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_analysis_results_submission_id_idx" ON "content_analysis_results" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "content_analysis_results_target_found_idx" ON "content_analysis_results" USING btree ("target_url_found");--> statement-breakpoint
CREATE INDEX "content_analysis_submissions_status_idx" ON "content_analysis_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_analysis_submissions_user_ip_idx" ON "content_analysis_submissions" USING btree ("user_ip");--> statement-breakpoint
CREATE INDEX "content_analysis_submissions_created_at_idx" ON "content_analysis_submissions" USING btree ("created_at");