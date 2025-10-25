/**
 * Article Analyzer - Submission Repository
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1, US-1.2, US-1.3
 *
 * Data access layer for content analysis submissions.
 * Handles all database operations related to article submissions.
 */

import { eq, gte, and, desc } from 'drizzle-orm'
import { getDb, getDbFromEnv } from '@/lib/db'
import {
  contentAnalysisSubmissions,
  type Submission,
  type SubmissionStatus,
} from '@/db/schema'

/**
 * Create a new article submission
 */
export async function createSubmission(
  url: string,
  userIp?: string
): Promise<Submission> {
  const db = await getDb()

  const [submission] = await db
    .insert(contentAnalysisSubmissions)
    .values({
      url,
      userIp,
      status: 'pending',
    })
    .returning()

  return submission
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(
  id: string
): Promise<Submission | null> {
  const db = await getDb()

  const [submission] = await db
    .select()
    .from(contentAnalysisSubmissions)
    .where(eq(contentAnalysisSubmissions.id, id))
    .limit(1)

  return submission || null
}

/**
 * Update submission fields
 */
export async function updateSubmission(
  id: string,
  updates: Partial<Submission>
): Promise<Submission> {
  const db = await getDb()

  const [updated] = await db
    .update(contentAnalysisSubmissions)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(contentAnalysisSubmissions.id, id))
    .returning()

  return updated
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  error?: string,
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  const updates: Partial<Submission> = {
    status,
    updatedAt: new Date(),
  }

  if (status === 'completed') {
    updates.completedAt = new Date()
  }

  if (error) {
    updates.scrapingError = error
  }

  await db
    .update(contentAnalysisSubmissions)
    .set(updates)
    .where(eq(contentAnalysisSubmissions.id, id))
}

/**
 * Count recent submissions by IP address
 * Used for rate limiting (3 submissions per 24 hours)
 */
export async function countRecentSubmissionsByIP(
  userIp: string,
  hoursAgo: number = 24
): Promise<number> {
  const db = await getDb()

  const windowStart = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

  const submissions = await db
    .select()
    .from(contentAnalysisSubmissions)
    .where(
      and(
        eq(contentAnalysisSubmissions.userIp, userIp),
        gte(contentAnalysisSubmissions.createdAt, windowStart)
      )
    )

  return submissions.length
}

/**
 * Store scraped article data
 */
export async function updateArticleData(
  id: string,
  title: string,
  content: string,
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      articleTitle: title,
      articleContent: content.slice(0, 5000), // Store first 5000 chars
      updatedAt: new Date(),
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}

/**
 * Store generated questions (legacy - use updateGeneratedFAQs instead)
 */
export async function updateGeneratedQuestions(
  id: string,
  questions: string[],
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      generatedFaqs: questions,
      updatedAt: new Date(),
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}

/**
 * Store generated FAQ pairs
 */
export async function updateGeneratedFAQs(
  id: string,
  faqs: Array<{
    question: string
    answer: string
    category: string
    numbers: string[]
  }>,
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      generatedFaqs: faqs,
      updatedAt: new Date(),
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}

/**
 * Get recent submissions (for home page table)
 */
export async function getRecentSubmissions(
  limit: number = 10,
  env?: CloudflareEnv
) {
  const db = env ? getDbFromEnv(env) : await getDb()

  return await db
    .select({
      id: contentAnalysisSubmissions.id,
      url: contentAnalysisSubmissions.url,
      status: contentAnalysisSubmissions.status,
      articleTitle: contentAnalysisSubmissions.articleTitle,
      createdAt: contentAnalysisSubmissions.createdAt,
      completedAt: contentAnalysisSubmissions.completedAt,
    })
    .from(contentAnalysisSubmissions)
    .orderBy(desc(contentAnalysisSubmissions.createdAt))
    .limit(limit)
}

/**
 * Store test metrics (3-tier results)
 */
export async function updateTestMetrics(
  id: string,
  metrics: {
    isAccessible: boolean
    inSourcesCount: number
    inCitationsCount: number
    totalFaqs: number
  },
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      testMetrics: metrics,
      updatedAt: new Date(),
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}
