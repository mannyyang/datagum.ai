/**
 * Article Analysis Service
 *
 * Orchestrates the complete article analysis workflow with 3-tier testing:
 * 1. Scrape article content
 * 2. Generate FAQ pairs with AI (following CreativeAdsDirectory methodology)
 * 3. Run control test (Tier 1: Accessibility)
 * 4. Test FAQs through OpenAI web search (Tier 2 & 3)
 * 5. Calculate and save test metrics
 *
 * Reference: /Users/myang/git/CreativeAdsDirectory/docs/faq-llm-indexing-summary.md
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  updateSubmissionStatus,
  updateArticleData,
  updateGeneratedFAQs,
  updateTestMetrics,
} from '@/repositories/submission.repository'
import { saveResult } from '@/repositories/results.repository'
import { scrapeArticle } from '@/services/scraper.service'
import { generateFAQs } from '@/services/faq-generator.service'
import {
  runSearchTest,
  runControlTest,
} from '@/services/search-tester.service'
import {
  calculateTestMetrics,
  formatMetricsForStorage,
} from '@/utils/test-results-formatter'
import type { FAQ } from '@/types/faq-generation'

export interface AnalysisResult {
  success: boolean
  submissionId: string
  articleTitle?: string
  faqCount?: number
  testsCompleted?: number
  tier1Passed?: boolean // Control test (accessibility)
  tier2Count?: number // FAQs found in sources
  tier3Count?: number // FAQs cited in answers
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
    // Phase 1: Scrape article
    await updateSubmissionStatus(submissionId, 'scraping', undefined, env)
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

    // Phase 2: Generate FAQ pairs
    await updateSubmissionStatus(submissionId, 'generating_faqs', undefined, env)
    console.log(`[Analysis] Phase 2: Generating FAQs...`)
    const faqs = await generateFAQsPhase(
      submissionId,
      scrapedArticle,
      url,
      env
    )
    console.log(`[Analysis] Generated ${faqs.length} FAQ pairs`)

    // Phase 3: Run control test (Tier 1)
    await updateSubmissionStatus(submissionId, 'running_control', undefined, env)
    console.log(`[Analysis] Phase 3: Running control test (Tier 1)...`)
    const isAccessible = await runControlTest(
      url,
      env.OPENAI_API_KEY
    )
    console.log(`[Analysis] Control test: ${isAccessible ? 'PASS ✅' : 'FAIL ❌'}`)

    // Save control test result immediately for progressive display
    await updateTestMetrics(
      submissionId,
      {
        isAccessible,
        inSourcesCount: 0,
        inCitationsCount: 0,
        totalFaqs: faqs.length,
      },
      env
    )

    // Phase 4: Test FAQ search visibility (Tier 2 & 3)
    // Skip if control test fails
    let tier2Count = 0
    let tier3Count = 0

    if (isAccessible) {
      await updateSubmissionStatus(submissionId, 'testing_faqs', undefined, env)
      console.log(`[Analysis] Phase 4: Testing FAQ search visibility...`)
      const testMetrics = await testFAQVisibility(
        submissionId,
        faqs,
        url,
        isAccessible,
        env
      )
      tier2Count = testMetrics.inSourcesCount
      tier3Count = testMetrics.inCitationsCount
      console.log(
        `[Analysis] FAQ tests completed: Tier 2: ${tier2Count}/${faqs.length} in sources, Tier 3: ${tier3Count}/${faqs.length} cited`
      )
    } else {
      console.log(`[Analysis] Skipping FAQ tests - control test failed`)
      // Save empty test metrics
      await updateTestMetrics(
        submissionId,
        {
          isAccessible: false,
          inSourcesCount: 0,
          inCitationsCount: 0,
          totalFaqs: faqs.length,
        },
        env
      )
    }

    // Mark as completed
    await updateSubmissionStatus(submissionId, 'completed', undefined, env)

    const duration = Date.now() - startTime
    console.log(`[Analysis] Analysis completed in ${duration}ms`)

    return {
      success: true,
      submissionId,
      articleTitle: scrapedArticle.title,
      faqCount: faqs.length,
      testsCompleted: faqs.length,
      tier1Passed: isAccessible,
      tier2Count,
      tier3Count,
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
 * Generate FAQ pairs phase
 */
async function generateFAQsPhase(
  submissionId: string,
  article: ScrapedArticle,
  targetUrl: string,
  env: CloudflareEnv
): Promise<FAQ[]> {
  try {
    const result = await generateFAQs(
      {
        articleTitle: article.title,
        articleContent: article.content,
        targetUrl,
        numberOfFAQs: 5,
      },
      env.OPENAI_API_KEY
    )

    // Store FAQs in database
    await updateGeneratedFAQs(submissionId, result.faqs, env)

    return result.faqs
  } catch (error) {
    console.error(`[Analysis] FAQ generation failed:`, error)

    // Fallback to simple FAQ
    const fallbackFAQs: FAQ[] = [
      {
        question: `What is "${article.title}" about?`,
        answer: `This article discusses ${article.title}. For more details, please read the full article.`,
        category: 'what-is',
        numbers: [],
      },
    ]
    await updateGeneratedFAQs(submissionId, fallbackFAQs, env)

    return fallbackFAQs
  }
}

/**
 * Test FAQ search visibility phase (Tier 2 & 3)
 */
async function testFAQVisibility(
  submissionId: string,
  faqs: FAQ[],
  targetUrl: string,
  isAccessible: boolean,
  env: CloudflareEnv
): Promise<{
  isAccessible: boolean
  inSourcesCount: number
  inCitationsCount: number
  totalFaqs: number
}> {
  try {
    console.log(
      `[Analysis] Testing ${faqs.length} FAQ questions with OpenAI web search...`
    )

    const allResults = []

    // Test and save each FAQ individually for progressive updates
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i]
      const questionNumber = i + 1

      console.log(
        `[Analysis] Testing FAQ ${questionNumber}/${faqs.length}: "${faq.question}"`
      )

      try {
        const result = await runSearchTest(
          {
            question: faq.question,
            targetUrl,
          },
          env.OPENAI_API_KEY
        )

        // Save result immediately to database for progressive display
        await saveResult(
          submissionId,
          result.question,
          result.targetUrlFound,
          result.foundInSources,
          result.foundInCitations,
          result.citations,
          result.sources,
          result.responseTimeMs,
          result.llmResponse,
          env
        )

        allResults.push(result)

        console.log(
          `[Analysis] ✅ FAQ ${questionNumber}/${faqs.length} completed and saved`
        )
      } catch (error) {
        console.error(
          `[Analysis] ❌ FAQ ${questionNumber}/${faqs.length} failed:`,
          error
        )
        // Continue with next test even if one fails
      }
    }

    console.log(
      `[Analysis] All ${allResults.length} FAQ test results saved to database`
    )

    // Calculate 3-tier metrics
    const metrics = calculateTestMetrics(allResults, isAccessible)
    const metricsForStorage = formatMetricsForStorage(metrics)

    // Store test metrics
    await updateTestMetrics(submissionId, metricsForStorage, env)

    return metricsForStorage
  } catch (error) {
    console.error(`[Analysis] FAQ search testing failed:`, error)

    const emptyMetrics = {
      isAccessible,
      inSourcesCount: 0,
      inCitationsCount: 0,
      totalFaqs: faqs.length,
    }

    await updateTestMetrics(submissionId, emptyMetrics, env)

    return emptyMetrics
  }
}
