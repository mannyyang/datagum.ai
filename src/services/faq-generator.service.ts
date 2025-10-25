/**
 * Article Analyzer - FAQ Generator Service
 *
 * Epic: Epic 3 - FAQ Generation & Testing
 * Stories: US-3.1, US-3.2, US-3.3
 *
 * Generates FAQ pairs from article content following CreativeAdsDirectory methodology.
 * Reference: /Users/myang/git/CreativeAdsDirectory/docs/faq-llm-indexing-summary.md
 */

import { getOpenAIClient } from '@/lib/openai-client'
import {
  FAQ_GENERATION_SYSTEM_PROMPT,
  buildFAQGenerationPrompt,
} from '@/prompts/faq-generation.prompts'
import type {
  FAQ,
  FAQGenerationResult,
  FAQGenerationInput,
} from '@/types/faq-generation'

const MODEL = 'gpt-4.1-mini' // Keeping current model as specified
const DEFAULT_FAQ_COUNT = 5
const MAX_RETRIES = 2
const TEMPERATURE = 0.7 // Slightly lower for more consistent length adherence

// Length validation constants per CreativeAdsDirectory guidelines
const QUESTION_MIN_LENGTH = 40
const QUESTION_MAX_LENGTH = 70
const ANSWER_MIN_LENGTH = 120
const ANSWER_MAX_LENGTH = 180

/**
 * Generate FAQ pairs from article content
 */
export async function generateFAQs(
  input: FAQGenerationInput,
  apiKey?: string
): Promise<FAQGenerationResult> {
  const startTime = Date.now()
  const numberOfFAQs = input.numberOfFAQs || DEFAULT_FAQ_COUNT

  console.log(`[FAQ Generator] Starting FAQ generation for: ${input.articleTitle}`)

  let lastError: Error | null = null

  // Retry logic for API failures
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const openai = getOpenAIClient(apiKey)

      // Build prompt - AI will handle number extraction
      const userPrompt = buildFAQGenerationPrompt(
        input.articleTitle,
        input.articleContent,
        numberOfFAQs
      )

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: FAQ_GENERATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' },
      })

      const responseContent = completion.choices[0]?.message?.content

      if (!responseContent) {
        throw new Error('Empty response from OpenAI')
      }

      // Parse JSON response
      const parsed = JSON.parse(responseContent)

      console.log('[FAQ Generator] Parsed response type:', typeof parsed, 'isArray:', Array.isArray(parsed))
      console.log('[FAQ Generator] Response keys:', Object.keys(parsed || {}))

      // Handle both array and object with FAQs array
      let faqs: FAQ[] = []
      if (Array.isArray(parsed)) {
        faqs = parsed
      } else if (parsed.result && Array.isArray(parsed.result)) {
        // OpenAI returns FAQs in 'result' key
        faqs = parsed.result
      } else if (parsed.faqs && Array.isArray(parsed.faqs)) {
        faqs = parsed.faqs
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        // Handle if AI returns 'questions' instead of 'faqs'
        faqs = parsed.questions
      } else {
        // Log the actual response for debugging
        console.error('[FAQ Generator] Unexpected response structure:', JSON.stringify(parsed, null, 2))
        throw new Error('Invalid response format from OpenAI')
      }

      // Validate FAQs
      const validation = validateFAQs(faqs)

      const generationTimeMs = Date.now() - startTime

      console.log(`[FAQ Generator] Generated ${faqs.length} FAQs in ${generationTimeMs}ms`)
      console.log(`[FAQ Generator] Validation:`, validation)

      return {
        faqs,
        totalGenerated: faqs.length,
        modelUsed: MODEL,
        generationTimeMs,
        validation,
      }
    } catch (error) {
      lastError = error as Error
      console.error(
        `[FAQ Generator] Attempt ${attempt + 1} failed:`,
        error
      )

      // Don't retry on validation/parsing errors
      if (
        error instanceof SyntaxError ||
        (error instanceof Error && error.message.includes('Invalid response'))
      ) {
        throw error
      }

      // Retry on API errors
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1))
        continue
      }

      throw error
    }
  }

  throw lastError || new Error('Failed to generate FAQs')
}

/**
 * Validate generated FAQs
 *
 * Returns validation object instead of throwing to allow partial success
 */
function validateFAQs(faqs: FAQ[]): {
  hasStrategicDistribution: boolean
  allQuestionsInRange: boolean
  allAnswersInRange: boolean
  hasNumbers: boolean
} {
  if (!faqs || faqs.length === 0) {
    throw new Error('No FAQs generated')
  }

  const validCategories = ['what-is', 'how-why', 'technical', 'comparative', 'action']

  // Check basic structure
  for (const faq of faqs) {
    if (!faq.question || typeof faq.question !== 'string') {
      throw new Error('Invalid FAQ format: missing question text')
    }

    if (!faq.answer || typeof faq.answer !== 'string') {
      throw new Error('Invalid FAQ format: missing answer text')
    }

    if (!validCategories.includes(faq.category)) {
      console.warn(`[FAQ Generator] Invalid category: ${faq.category}, using 'what-is' as fallback`)
      faq.category = 'what-is'
    }

    if (!Array.isArray(faq.numbers)) {
      faq.numbers = []
    }
  }

  // Check strategic distribution (at least 4 unique categories)
  const categories = new Set(faqs.map((faq) => faq.category))
  const hasStrategicDistribution = categories.size >= 4

  // Check question lengths
  const allQuestionsInRange = faqs.every(
    (faq) =>
      faq.question.length >= QUESTION_MIN_LENGTH &&
      faq.question.length <= QUESTION_MAX_LENGTH
  )

  // Check answer lengths
  const allAnswersInRange = faqs.every(
    (faq) =>
      faq.answer.length >= ANSWER_MIN_LENGTH &&
      faq.answer.length <= ANSWER_MAX_LENGTH
  )

  // Check if at least one FAQ uses numbers
  const usesNumbers = faqs.some((faq) => faq.numbers.length > 0)

  // Log length violations for debugging
  if (!allQuestionsInRange) {
    faqs.forEach((faq, i) => {
      const len = faq.question.length
      if (len < QUESTION_MIN_LENGTH || len > QUESTION_MAX_LENGTH) {
        console.warn(
          `[FAQ Generator] Question ${i + 1} length out of range (${len} chars): "${faq.question}"`
        )
      }
    })
  }

  if (!allAnswersInRange) {
    faqs.forEach((faq, i) => {
      const len = faq.answer.length
      if (len < ANSWER_MIN_LENGTH || len > ANSWER_MAX_LENGTH) {
        console.warn(
          `[FAQ Generator] Answer ${i + 1} length out of range (${len} chars): "${faq.answer}"`
        )
      }
    })
  }

  return {
    hasStrategicDistribution,
    allQuestionsInRange,
    allAnswersInRange,
    hasNumbers: usesNumbers,
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
