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
        tool_choice: 'auto', // Let model decide when to use search
        include: ['web_search_call.action.sources'], // Include source URLs
        input: input.question,
      })) as unknown as ResponsesAPIOutput

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

  for (const input of inputs) {
    try {
      const result = await runSearchTest(input, apiKey)
      results.push(result)

      // Add delay between requests to avoid rate limiting
      if (results.length < inputs.length) {
        await sleep(1000) // 1 second delay
      }
    } catch {
      console.error(`Failed to run search test for question: ${input.question}`)
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
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
