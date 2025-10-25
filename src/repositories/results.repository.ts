/**
 * Article Analyzer - Results Repository
 *
 * Epic: Epic 4 - AI Search Visibility Testing
 * Stories: US-4.1, US-4.2, US-4.3, US-4.4
 *
 * Data access layer for content analysis results.
 * Handles all database operations related to test results.
 */

import { eq } from 'drizzle-orm'
import { getDb, getDbFromEnv } from '@/lib/db'
import {
  contentAnalysisResults,
  type AnalysisResult,
  type NewAnalysisResult,
  type CitationInfo,
} from '@/db/schema'

/**
 * Save a single test result
 */
export async function saveResult(
  submissionId: string,
  question: string,
  targetUrlFound: boolean,
  foundInSources: boolean,
  foundInCitations: boolean,
  allCitations: CitationInfo[],
  allSources: string[],
  responseTimeMs?: number,
  llmResponse?: string,
  env?: CloudflareEnv
): Promise<AnalysisResult> {
  const db = env ? getDbFromEnv(env) : await getDb()

  const [result] = await db
    .insert(contentAnalysisResults)
    .values({
      submissionId,
      question,
      llmResponse,
      targetUrlFound,
      foundInSources,
      foundInCitations,
      allCitations,
      allSources,
      responseTimeMs,
    })
    .returning()

  return result
}

/**
 * Save multiple test results at once
 */
export async function saveResults(
  results: NewAnalysisResult[],
  env?: CloudflareEnv
): Promise<AnalysisResult[]> {
  const db = env ? getDbFromEnv(env) : await getDb()

  const saved = await db
    .insert(contentAnalysisResults)
    .values(results)
    .returning()

  return saved
}

/**
 * Get all results for a submission
 */
export async function getResultsBySubmission(
  submissionId: string
): Promise<AnalysisResult[]> {
  const db = await getDb()

  const results = await db
    .select()
    .from(contentAnalysisResults)
    .where(eq(contentAnalysisResults.submissionId, submissionId))
    .orderBy(contentAnalysisResults.id)

  return results
}

/**
 * Get result by ID
 */
export async function getResultById(id: number): Promise<AnalysisResult | null> {
  const db = await getDb()

  const [result] = await db
    .select()
    .from(contentAnalysisResults)
    .where(eq(contentAnalysisResults.id, id))
    .limit(1)

  return result || null
}
