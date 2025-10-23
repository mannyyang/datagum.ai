/**
 * Job Orchestrator - Orchestrates the complete article analysis workflow
 *
 * Epic: Epic 6 - Background Job Processing
 * Stories: US-6.1, US-6.2
 *
 * This service coordinates the entire analysis process:
 * 1. Validate submission exists
 * 2. Update status to 'processing'
 * 3. Run scraping phase (Unit 2)
 * 4. Run question generation phase (Unit 3)
 * 5. Run search testing phase (Unit 4)
 * 6. Mark as completed or failed
 */

import {
  updateSubmissionStatus,
  updateArticleData,
  updateGeneratedQuestions,
} from '@/repositories/submission.repository'
import { saveResult } from '@/repositories/results.repository'
import { scrapeArticle } from '@/services/scraper.service'
import { generateQuestions } from '@/services/question-generator.service'
import { runBatchSearchTests } from '@/services/search-tester.service'
import type { GeneratedQuestion } from '@/types/question-generation'

export interface JobOrchestratorOptions {
  submissionId: string
  url: string
  env: CloudflareEnv
}

export class JobOrchestrator {
  private submissionId: string
  private url: string
  private env: CloudflareEnv
  private startTime: number

  constructor(options: JobOrchestratorOptions) {
    this.submissionId = options.submissionId
    this.url = options.url
    this.env = options.env
    this.startTime = Date.now()
  }

  /**
   * Main entry point - executes the complete workflow
   */
  async execute(): Promise<void> {
    console.log(`[JobOrchestrator] Starting job for submission ${this.submissionId}`)

    try {
      // Phase 1: Update status to processing
      await this.updateStatus('processing')

      // Phase 2: Article Scraping (Unit 2)
      console.log(`[JobOrchestrator] Phase 1: Scraping article...`)
      const scrapedArticle = await this.runScrapingPhase()
      console.log(`[JobOrchestrator] Article scraped: ${scrapedArticle.title}`)

      // Phase 3: Question Generation (Unit 3)
      console.log(`[JobOrchestrator] Phase 2: Generating questions...`)
      const questions = await this.runQuestionGenerationPhase(scrapedArticle)
      console.log(`[JobOrchestrator] Generated ${questions.length} questions`)

      // Phase 4: Search Testing (Unit 4)
      console.log(`[JobOrchestrator] Phase 3: Testing search visibility...`)
      await this.runSearchTestingPhase(questions)
      console.log(`[JobOrchestrator] Search testing completed`)

      // Mark as completed
      await this.markCompleted()

      const duration = this.calculateDuration()
      console.log(
        `[JobOrchestrator] Job completed in ${duration}ms for submission ${this.submissionId}`
      )
    } catch (error) {
      console.error(`[JobOrchestrator] Job failed for submission ${this.submissionId}:`, error)
      await this.markFailed(error)
      throw error // Re-throw for queue retry logic
    }
  }

  /**
   * Update submission status
   */
  private async updateStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    console.log(`[JobOrchestrator] Updating status to: ${status}`)
    await updateSubmissionStatus(this.submissionId, status, undefined, this.env)
  }

  /**
   * Phase 1: Scrape article content
   */
  private async runScrapingPhase(): Promise<ScrapedArticle> {
    try {
      // Scrape article using real scraper service
      const parsed = await scrapeArticle(this.url)

      const article: ScrapedArticle = {
        url: this.url,
        title: parsed.title || 'Untitled Article',
        content: parsed.content || '',
        headings: [], // TODO: Extract from parsed content if needed
        metaDescription: null,
        author: null,
        publishedDate: null,
        error: null,
      }

      // Store article data in database
      await updateArticleData(
        this.submissionId,
        article.title,
        article.content,
        this.env
      )

      return article
    } catch (error) {
      // Handle scraping errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[JobOrchestrator] Scraping failed: ${errorMessage}`)

      // Store error in database
      await updateSubmissionStatus(this.submissionId, 'failed', errorMessage, this.env)

      // Re-throw to stop the workflow
      throw error
    }
  }

  /**
   * Phase 2: Generate search questions
   */
  private async runQuestionGenerationPhase(article: ScrapedArticle): Promise<string[]> {
    try {
      // Generate questions using OpenAI
      const result = await generateQuestions(
        {
          articleTitle: article.title,
          articleContent: article.content,
          targetUrl: this.url,
          numberOfQuestions: 10, // Generate 10 questions as per domain model
        },
        this.env.OPENAI_API_KEY
      )

      // Extract question strings from GeneratedQuestion objects
      const questionStrings = result.questions.map((q: GeneratedQuestion) => q.question)

      // Store generated questions in database
      await updateGeneratedQuestions(this.submissionId, questionStrings, this.env)

      return questionStrings
    } catch (error) {
      console.error(`[JobOrchestrator] Question generation failed:`, error)

      // Store fallback questions so the workflow can continue
      const fallbackQuestions = [`What is "${article.title}" about?`]
      await updateGeneratedQuestions(this.submissionId, fallbackQuestions, this.env)

      return fallbackQuestions
    }
  }

  /**
   * Phase 3: Test questions through AI search
   */
  private async runSearchTestingPhase(questions: string[]): Promise<void> {
    try {
      console.log(`[JobOrchestrator] Testing ${questions.length} questions with OpenAI web search...`)

      // Build search test inputs
      const inputs = questions.map((q) => ({
        question: q,
        targetUrl: this.url,
      }))

      // Run batch search tests with OpenAI Responses API
      const batchResult = await runBatchSearchTests(inputs, this.env.OPENAI_API_KEY)

      console.log(
        `[JobOrchestrator] Search tests completed: ${batchResult.successCount}/${batchResult.totalTests} found`
      )

      // Save each test result to database
      for (const result of batchResult.results) {
        await saveResult(
          this.submissionId,
          result.question,
          result.targetUrlFound,
          result.foundInSources,
          result.foundInCitations,
          result.citations,
          result.sources,
          result.responseTimeMs,
          this.env
        )
      }

      console.log(`[JobOrchestrator] Saved ${batchResult.results.length} test results to database`)
    } catch (error) {
      console.error(`[JobOrchestrator] Search testing failed:`, error)
      // Don't throw - allow the job to complete even if search testing partially fails
      // The results that were saved will still be available
    }
  }

  /**
   * Mark job as completed
   */
  private async markCompleted(): Promise<void> {
    // updateStatus('completed') automatically sets completedAt timestamp
    await this.updateStatus('completed')
  }

  /**
   * Mark job as failed
   */
  private async markFailed(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Pass error message to updateStatus to store in scrapingError field
    await updateSubmissionStatus(this.submissionId, 'failed', errorMessage, this.env)
  }

  /**
   * Calculate job duration
   */
  private calculateDuration(): number {
    return Date.now() - this.startTime
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ScrapedArticle {
  url: string
  title: string
  content: string
  headings: string[]
  metaDescription: string | null
  author: string | null
  publishedDate: string | null
  error: string | null
}
