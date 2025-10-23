/**
 * Article Analyzer - Database Schema
 *
 * Epic: Database Foundation
 * Stories: All user stories (supports entire application)
 *
 * This schema defines the database structure for the Article Analyzer feature.
 * It includes tables for tracking article submissions and their analysis results.
 *
 * After modifying this file:
 * 1. Apply to database: pnpm db:push
 * 2. Verify in Drizzle Studio: pnpm db:studio
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  serial,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * Content Analysis Submissions Table
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1, US-1.2, US-1.3
 *
 * Tracks article URL submissions for AI search visibility analysis.
 * Each submission goes through: pending → processing → completed/failed
 */
export const contentAnalysisSubmissions = pgTable(
  'content_analysis_submissions',
  {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Submission data
    url: text('url').notNull(),
    userIp: varchar('user_ip', { length: 45 }), // IPv4 or IPv6

    // Status tracking
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    // Status values: 'pending' | 'processing' | 'completed' | 'failed'

    // Generated questions (stored as JSON array)
    generatedQuestions: jsonb('generated_questions').default([]).notNull(),

    // Error handling
    scrapingError: text('scraping_error'),

    // Scraped article data
    articleTitle: text('article_title'),
    articleContent: text('article_content'), // First 5000 chars

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    // Indexes for query performance
    statusIdx: index('content_analysis_submissions_status_idx').on(
      table.status
    ),
    userIpIdx: index('content_analysis_submissions_user_ip_idx').on(
      table.userIp
    ),
    createdAtIdx: index('content_analysis_submissions_created_at_idx').on(
      table.createdAt
    ),
  })
)

/**
 * Content Analysis Results Table
 *
 * Epic: Epic 4 - AI Search Visibility Testing
 * Stories: US-4.1, US-4.2, US-4.3, US-4.4
 *
 * Individual question test results for each submission.
 * Each row represents one question tested through OpenAI search.
 */
export const contentAnalysisResults = pgTable(
  'content_analysis_results',
  {
    // Primary key
    id: serial('id').primaryKey(),

    // Foreign key to submission
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => contentAnalysisSubmissions.id, {
        onDelete: 'cascade',
      }),

    // Question tested
    question: text('question').notNull(),

    // Overall result
    targetUrlFound: boolean('target_url_found').default(false).notNull(),

    // Detailed citation tracking (three-tier)
    foundInSources: boolean('found_in_sources').default(false).notNull(),
    foundInCitations: boolean('found_in_citations').default(false).notNull(),

    // Citation and source data (stored as JSON)
    allCitations: jsonb('all_citations').default([]).notNull(),
    // Structure: Array<{ url: string, title?: string, position: number }>

    allSources: jsonb('all_sources').default([]).notNull(),
    // Structure: Array<string> (source URLs)

    // Performance metrics
    responseTimeMs: integer('response_time_ms'),

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for query performance
    submissionIdIdx: index('content_analysis_results_submission_id_idx').on(
      table.submissionId
    ),
    targetFoundIdx: index('content_analysis_results_target_found_idx').on(
      table.targetUrlFound
    ),
  })
)

// ============================================================================
// TypeScript Types
// ============================================================================

// Submission types
export type Submission = typeof contentAnalysisSubmissions.$inferSelect
export type NewSubmission = typeof contentAnalysisSubmissions.$inferInsert

// Result types
export type AnalysisResult = typeof contentAnalysisResults.$inferSelect
export type NewAnalysisResult = typeof contentAnalysisResults.$inferInsert

// Status type
export type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'failed'

// Citation type (for JSON fields)
export interface CitationInfo {
  url: string
  title?: string
  position: number // Citation position (1-indexed)
}
