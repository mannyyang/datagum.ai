/**
 * Article Analyzer - Job Processor Service
 *
 * Epic: Epic 6 - Background Job Processing
 * Stories: US-6.1, US-6.2, US-6.3
 *
 * Orchestrates the complete article analysis workflow:
 * 1. Scrape article content (Unit 2)
 * 2. Generate questions (Unit 3)
 * 3. Run search tests (Unit 4)
 * 4. Save results to database
 * 5. Update submission status
 */

import { scrapeArticle } from '@/services/scraper.service'
import { generateQuestions } from '@/services/question-generator.service'
import { runBatchSearchTests } from '@/services/search-tester.service'
import {
  getSubmissionById,
  updateSubmission,
} from '@/repositories/submission.repository'
import { saveResults } from '@/repositories/results.repository'
import type { SearchTestInput } from '@/types/search-testing'
import type { NewAnalysisResult } from '@/db/schema'
import {
  JobProcessingError,
  type JobProcessingResult,
} from '@/types/job-processing'

/**
 * Process a complete article analysis job
 */
export async function processArticleAnalysisJob(
  submissionId: string,
  apiKey?: string
): Promise<JobProcessingResult> {
  const startTime = Date.now()

  try {
    console.log(`[Job ${submissionId}] Starting article analysis`)

    // 1. Get submission details
    const submission = await getSubmissionById(submissionId)
    if (!submission) {
      throw new JobProcessingError(
        'Submission not found',
        submissionId,
        'fetch'
      )
    }

    const targetUrl = submission.url

    // 2. Scrape article content
    console.log(`[Job ${submissionId}] Phase 1: Scraping article`)
    let articleTitle: string
    let articleContent: string

    try {
      const scraped = await scrapeArticle(targetUrl)
      articleTitle = scraped.title
      articleContent = scraped.content

      // Update submission with scraped content
      await updateSubmission(submissionId, {
        status: 'scraping_complete',
        articleTitle,
        articleContent,
      })
    } catch (error) {
      console.error(`[Job ${submissionId}] Scraping failed:`, error)

      // Save error and mark as failed
      await updateSubmission(submissionId, {
        status: 'failed',
        scrapingError:
          error instanceof Error ? error.message : 'Unknown scraping error',
        completedAt: new Date(),
      })

      throw new JobProcessingError(
        `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        submissionId,
        'scraping'
      )
    }

    // 3. Generate questions
    console.log(`[Job ${submissionId}] Phase 2: Generating questions`)
    let questions: string[]

    try {
      const questionResult = await generateQuestions(
        {
          articleTitle,
          articleContent,
          targetUrl,
          numberOfQuestions: 5,
        },
        apiKey
      )

      questions = questionResult.questions.map((q) => q.question)

      // Update submission with generated questions
      await updateSubmission(submissionId, {
        status: 'questions_generated',
        generatedQuestions: questions,
      })
    } catch (error) {
      console.error(`[Job ${submissionId}] Question generation failed:`, error)

      await updateSubmission(submissionId, {
        status: 'failed',
        scrapingError: `Question generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        completedAt: new Date(),
      })

      throw new JobProcessingError(
        `Question generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        submissionId,
        'question_generation'
      )
    }

    // 4. Run search tests
    console.log(`[Job ${submissionId}] Phase 3: Running search tests`)
    let testsRun = 0
    let citationsFound = 0

    try {
      const searchInputs: SearchTestInput[] = questions.map((q) => ({
        question: q,
        targetUrl,
      }))

      const batchResult = await runBatchSearchTests(searchInputs, apiKey)

      testsRun = batchResult.totalTests
      citationsFound = batchResult.citationCount

      // 5. Save results to database
      console.log(`[Job ${submissionId}] Phase 4: Saving results`)

      const resultsToSave: NewAnalysisResult[] = batchResult.results.map(
        (result) => ({
          submissionId,
          question: result.question,
          targetUrlFound: result.targetUrlFound,
          foundInSources: result.foundInSources,
          foundInCitations: result.foundInCitations,
          allCitations: result.citations,
          allSources: result.sources,
          responseTimeMs: result.responseTimeMs,
        })
      )

      await saveResults(resultsToSave)

      // 6. Mark submission as completed
      await updateSubmission(submissionId, {
        status: 'completed',
        completedAt: new Date(),
      })

      const processingTimeMs = Date.now() - startTime

      console.log(
        `[Job ${submissionId}] Completed successfully in ${processingTimeMs}ms`
      )

      return {
        submissionId,
        success: true,
        status: 'completed',
        questionsGenerated: questions.length,
        testsRun,
        citationsFound,
        processingTimeMs,
      }
    } catch (error) {
      console.error(`[Job ${submissionId}] Search testing failed:`, error)

      await updateSubmission(submissionId, {
        status: 'failed',
        scrapingError: `Search testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        completedAt: new Date(),
      })

      throw new JobProcessingError(
        `Search testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        submissionId,
        'search_testing'
      )
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime

    if (error instanceof JobProcessingError) {
      return {
        submissionId,
        success: false,
        status: 'failed',
        questionsGenerated: 0,
        testsRun: 0,
        citationsFound: 0,
        error: error.message,
        processingTimeMs,
      }
    }

    throw error
  }
}
