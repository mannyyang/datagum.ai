/**
 * Article Analyzer - Search Tester Service
 *
 * Epic: Epic 4 - AI Search Visibility Testing
 * Stories: US-4.1, US-4.2, US-4.3, US-4.4
 *
 * Performs REAL web searches using OpenAI Responses API with web_search tool.
 * Tests if target article appears in AI-generated search results.
 */

import { getOpenAIClient } from '@/lib/openai-client'
import {
  extractCitations,
  extractAllSources,
  isTargetInCitations,
  isTargetInSources,
} from '@/utils/citation-parser'
import type {
  SearchTestResult,
  SearchTestInput,
  BatchSearchTestResult,
  ResponsesAPIOutput,
} from '@/types/search-testing'

const MODEL = 'gpt-5' // As specified in domain model
const REASONING_EFFORT = 'low' // Faster responses
const MAX_RETRIES = 2

/**
 * Run a single search test using OpenAI Responses API with web_search
 */
export async function runSearchTest(
  input: SearchTestInput,
  apiKey?: string
): Promise<SearchTestResult> {
  const startTime = Date.now()
  let lastError: Error | null = null

  // Retry logic for API failures
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const openai = getOpenAIClient(apiKey)

      // Generate AI search response using REAL web search
      const response = (await openai.responses.create({
        model: MODEL,
        reasoning: { effort: REASONING_EFFORT },
        tools: [
          {
            type: 'web_search',
            // Optional: Can filter to specific domains if needed
            // filters: {
            //   allowed_domains: ["example.com"]
            // }
          },
        ],
        tool_choice: 'required', // Force web search for all tests
        include: ['web_search_call.action.sources'], // Include source URLs
        input: input.question,
      })) as unknown as ResponsesAPIOutput

      // Log raw response for debugging
      console.log(`[SearchTester] FAQ Test - Raw response for question: "${input.question}"`)
      console.log(JSON.stringify(response, null, 2))

      if (!response.output) {
        throw new Error('Empty response from OpenAI Responses API')
      }

      // Parse citations and sources from structured response
      const citations = extractCitations(response)
      const sources = extractAllSources(response)

      // Check if target URL is found
      const { found: foundInCitations, position: citationPosition } =
        isTargetInCitations(input.targetUrl, citations)
      const foundInSources = isTargetInSources(input.targetUrl, sources)
      const targetUrlFound = foundInCitations || foundInSources

      const responseTimeMs = Date.now() - startTime

      return {
        question: input.question,
        llmResponse: response.output_text || undefined,
        targetUrlFound,
        foundInSources,
        foundInCitations,
        citations,
        sources,
        citationPosition,
        responseTimeMs,
        modelUsed: MODEL,
      }
    } catch (error) {
      lastError = error as Error
      console.error(`Search test attempt ${attempt + 1} failed:`, error)

      // Retry on API errors
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1))
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Failed to run search test')
}

/**
 * Run multiple search tests in sequence
 */
export async function runBatchSearchTests(
  inputs: SearchTestInput[],
  apiKey?: string
): Promise<BatchSearchTestResult> {
  const results: SearchTestResult[] = []

  console.log(`[SearchTester] Starting batch of ${inputs.length} question tests`)

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const questionNumber = i + 1

    try {
      console.log(
        `[SearchTester] Testing question ${questionNumber}/${inputs.length}: "${input.question}"`
      )

      const result = await runSearchTest(input, apiKey)
      results.push(result)

      // Log detailed result for this question
      console.log(
        `[SearchTester] ✅ Question ${questionNumber} result:`,
        {
          targetFound: result.targetUrlFound,
          foundInCitations: result.foundInCitations,
          foundInSources: result.foundInSources,
          citationPosition: result.citationPosition,
          responseTimeMs: result.responseTimeMs,
          totalCitations: result.citations.length,
          totalSources: result.sources.length,
        }
      )

      // Add delay between requests to avoid rate limiting
      if (results.length < inputs.length) {
        await sleep(1000) // 1 second delay
      }
    } catch (error) {
      console.error(
        `[SearchTester] ❌ Failed question ${questionNumber}/${inputs.length}: "${input.question}"`,
        error
      )
      // Continue with next test even if one fails
      // Could also choose to fail the entire batch
    }
  }

  // Calculate statistics
  const totalTests = results.length
  const successCount = results.filter((r) => r.targetUrlFound).length
  const citationCount = results.filter((r) => r.foundInCitations).length
  const sourceCount = results.filter((r) => r.foundInSources).length

  const citationPositions = results
    .filter((r) => r.citationPosition !== undefined)
    .map((r) => r.citationPosition!)

  const averagePosition =
    citationPositions.length > 0
      ? citationPositions.reduce((sum, pos) => sum + pos, 0) /
        citationPositions.length
      : undefined

  const responseTimes = results
    .filter((r) => r.responseTimeMs !== undefined)
    .map((r) => r.responseTimeMs!)

  const averageResponseTimeMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : undefined

  // Log final summary
  console.log(`[SearchTester] 📊 Batch complete - Summary:`, {
    totalTests,
    successCount,
    citationCount,
    sourceCount,
    averagePosition,
    averageResponseTimeMs: averageResponseTimeMs
      ? `${Math.round(averageResponseTimeMs)}ms`
      : 'N/A',
  })

  return {
    results,
    totalTests,
    successCount,
    citationCount,
    sourceCount,
    averagePosition,
    averageResponseTimeMs,
  }
}

/**
 * Run control test to verify article accessibility (token-efficient)
 *
 * Tests if OpenAI can directly access the target URL using web_search tool.
 * This is Tier 1 testing per CreativeAdsDirectory methodology.
 *
 * Uses a minimal query to just check URL accessibility without generating
 * a full response, saving tokens.
 *
 * Reference: /Users/myang/git/CreativeAdsDirectory/server/services/job-queue/strategies/control-test.strategy.ts
 */
export async function runControlTest(
  targetUrl: string,
  apiKey?: string
): Promise<boolean> {
  console.log(`[SearchTester] Running control test for ${targetUrl}`)

  try {
    const openai = getOpenAIClient(apiKey)

    // Minimal query to check accessibility - just asks to visit URL
    const controlTestQuestion = `What's in this article: ${targetUrl}`

    console.log(`[SearchTester] Control test query: ${controlTestQuestion}`)

    // Use minimal reasoning effort and require web_search tool
    const response = (await openai.responses.create({
      model: MODEL,
      reasoning: { effort: 'low' }, // Minimal reasoning for speed
      tools: [{ type: 'web_search' }],
      tool_choice: 'required', // Force web search (don't let model skip it)
      include: ['web_search_call.action.sources'], // Only need sources
      input: controlTestQuestion,
    })) as unknown as ResponsesAPIOutput

    // Log raw response for debugging
    console.log('[SearchTester] Control test - Raw response:')
    console.log(JSON.stringify(response, null, 2))

    if (!response.output) {
      console.log('[SearchTester] Control test: No response output')
      return false
    }

    // Extract sources and citations for debugging
    const sources = extractAllSources(response)
    const citations = extractCitations(response)

    // Debug logging
    console.log(`[SearchTester] Control test - Sources found:`, sources.length)
    sources.forEach((source, i) => {
      console.log(`  Source ${i + 1}:`, source)
    })

    console.log(`[SearchTester] Control test - Citations found:`, citations.length)
    citations.forEach((citation, i) => {
      console.log(`  Citation ${i + 1}:`, citation)
    })

    // Check accessibility in both sources and citations
    const foundInSources = isTargetInSources(targetUrl, sources)
    const { found: foundInCitations } = isTargetInCitations(targetUrl, citations)
    const isAccessible = foundInSources || foundInCitations

    console.log(
      `[SearchTester] Control test result: ${isAccessible ? '✅ PASS' : '❌ FAIL'} (foundInSources: ${foundInSources}, foundInCitations: ${foundInCitations})`
    )

    return isAccessible
  } catch (error) {
    console.error(`[SearchTester] Control test failed:`, error)
    return false
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
