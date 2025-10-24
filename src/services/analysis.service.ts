/**
 * Article Analysis Service
 *
 * Orchestrates the complete article analysis workflow synchronously:
 * 1. Scrape article content
 * 2. Generate search questions with AI
 * 3. Test questions through OpenAI web search
 * 4. Save results to database
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
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

export interface AnalysisResult {
  success: boolean
  submissionId: string
  articleTitle?: string
  questionCount?: number
  testsCompleted?: number
  testsFound?: number
  duration?: number
  error?: string
}

interface ScrapedArticle {
  url: string
  title: string
  content: string
}

/**
 * Run complete article analysis workflow
 */
export async function analyzeArticle(
  submissionId: string,
  url: string
): Promise<AnalysisResult> {
  const startTime = Date.now()
  const { env } = await getCloudflareContext()

  console.log(`[Analysis] Starting analysis for submission ${submissionId}`)

  try {
    // Phase 1: Update status to processing
    await updateSubmissionStatus(submissionId, 'processing', undefined, env)

    // Phase 2: Scrape article
    console.log(`[Analysis] Phase 1: Scraping article...`)
    const article = await scrapeArticle(url)

    const scrapedArticle: ScrapedArticle = {
      url,
      title: article.title || 'Untitled Article',
      content: article.content || '',
    }

    await updateArticleData(
      submissionId,
      scrapedArticle.title,
      scrapedArticle.content,
      env
    )
    console.log(`[Analysis] Article scraped: ${scrapedArticle.title}`)

    // Phase 3: Generate questions
    console.log(`[Analysis] Phase 2: Generating questions...`)
    const questions = await generateQuestionsPhase(
      submissionId,
      scrapedArticle,
      url,
      env
    )
    console.log(`[Analysis] Generated ${questions.length} questions`)

    // Phase 4: Test search visibility
    console.log(`[Analysis] Phase 3: Testing search visibility...`)
    const testResults = await testSearchVisibility(
      submissionId,
      questions,
      url,
      env
    )
    console.log(
      `[Analysis] Search tests completed: ${testResults.successCount}/${testResults.totalTests} found`
    )

    // Mark as completed
    await updateSubmissionStatus(submissionId, 'completed', undefined, env)

    const duration = Date.now() - startTime
    console.log(`[Analysis] Analysis completed in ${duration}ms`)

    return {
      success: true,
      submissionId,
      articleTitle: scrapedArticle.title,
      questionCount: questions.length,
      testsCompleted: testResults.totalTests,
      testsFound: testResults.successCount,
      duration,
    }
  } catch (error) {
    console.error(`[Analysis] Analysis failed:`, error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    await updateSubmissionStatus(submissionId, 'failed', errorMessage, env)

    return {
      success: false,
      submissionId,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Generate search questions phase
 */
async function generateQuestionsPhase(
  submissionId: string,
  article: ScrapedArticle,
  targetUrl: string,
  env: CloudflareEnv
): Promise<string[]> {
  try {
    const result = await generateQuestions(
      {
        articleTitle: article.title,
        articleContent: article.content,
        targetUrl,
        numberOfQuestions: 5,
      },
      env.OPENAI_API_KEY
    )

    const questionStrings = result.questions.map(
      (q: GeneratedQuestion) => q.question
    )
    await updateGeneratedQuestions(submissionId, questionStrings, env)

    return questionStrings
  } catch (error) {
    console.error(`[Analysis] Question generation failed:`, error)

    // Fallback to simple question
    const fallbackQuestions = [`What is "${article.title}" about?`]
    await updateGeneratedQuestions(submissionId, fallbackQuestions, env)

    return fallbackQuestions
  }
}

/**
 * Test search visibility phase
 */
async function testSearchVisibility(
  submissionId: string,
  questions: string[],
  targetUrl: string,
  env: CloudflareEnv
): Promise<{ totalTests: number; successCount: number }> {
  try {
    console.log(
      `[Analysis] Testing ${questions.length} questions with OpenAI web search...`
    )

    const inputs = questions.map((q) => ({
      question: q,
      targetUrl,
    }))

    const batchResult = await runBatchSearchTests(inputs, env.OPENAI_API_KEY)

    // Save each test result
    for (const result of batchResult.results) {
      await saveResult(
        submissionId,
        result.question,
        result.targetUrlFound,
        result.foundInSources,
        result.foundInCitations,
        result.citations,
        result.sources,
        result.responseTimeMs,
        env
      )
    }

    console.log(
      `[Analysis] Saved ${batchResult.results.length} test results to database`
    )

    return {
      totalTests: batchResult.totalTests,
      successCount: batchResult.successCount,
    }
  } catch (error) {
    console.error(`[Analysis] Search testing failed:`, error)

    return {
      totalTests: 0,
      successCount: 0,
    }
  }
}
