/**
 * Article Analyzer - OpenAI Client
 *
 * Epic: Epic 3 - Question Generation & Epic 4 - Search Testing
 * Stories: US-3.1, US-4.1
 *
 * Centralized OpenAI client configuration.
 * Used for both question generation (gpt-4.1-mini) and search testing (gpt-5 with web_search).
 */

import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

/**
 * Get OpenAI client instance
 * Uses singleton pattern to reuse client across requests
 */
export function getOpenAIClient(apiKey?: string): OpenAI {
  if (openaiClient) {
    return openaiClient
  }

  const key = apiKey || process.env.OPENAI_API_KEY

  if (!key) {
    throw new Error(
      'OpenAI API key not found. Set OPENAI_API_KEY environment variable.'
    )
  }

  openaiClient = new OpenAI({
    apiKey: key,
  })

  return openaiClient
}

/**
 * Reset client (useful for testing or key rotation)
 */
export function resetOpenAIClient(): void {
  openaiClient = null
}
