/**
 * Article Analyzer - Question Generator Service
 *
 * Epic: Epic 3 - Question Generation
 * Stories: US-3.1, US-3.2
 *
 * Generates search questions from article content using OpenAI GPT-4.1-mini.
 * These questions are used to test article visibility in AI search results.
 */

import { getOpenAIClient } from '@/lib/openai-client'
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
} from '@/prompts/question-generation.prompts'
import type {
  GeneratedQuestion,
  QuestionGenerationResult,
  QuestionGenerationInput,
} from '@/types/question-generation'

const MODEL = 'gpt-4.1-mini' // As specified in domain model
const DEFAULT_QUESTION_COUNT = 5
const MAX_RETRIES = 2
const TEMPERATURE = 0.8 // Higher for more diverse questions

/**
 * Generate questions from article content
 */
export async function generateQuestions(
  input: QuestionGenerationInput,
  apiKey?: string
): Promise<QuestionGenerationResult> {
  const startTime = Date.now()
  const numberOfQuestions = input.numberOfQuestions || DEFAULT_QUESTION_COUNT

  let lastError: Error | null = null

  // Retry logic for API failures
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const openai = getOpenAIClient(apiKey)

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: QUESTION_GENERATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildQuestionGenerationPrompt(
              input.articleTitle,
              input.articleContent,
              numberOfQuestions
            ),
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

      // Handle both array and object with questions array
      let questions: GeneratedQuestion[] = []
      if (Array.isArray(parsed)) {
        questions = parsed
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions
      } else {
        throw new Error('Invalid response format from OpenAI')
      }

      // Validate questions
      validateQuestions(questions)

      const generationTimeMs = Date.now() - startTime

      return {
        questions,
        totalGenerated: questions.length,
        modelUsed: MODEL,
        generationTimeMs,
      }
    } catch (error) {
      lastError = error as Error
      console.error(
        `Question generation attempt ${attempt + 1} failed:`,
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

  throw lastError || new Error('Failed to generate questions')
}

/**
 * Validate generated questions
 */
function validateQuestions(questions: GeneratedQuestion[]): void {
  if (!questions || questions.length === 0) {
    throw new Error('No questions generated')
  }

  const validCategories = [
    'factual',
    'conceptual',
    'comparative',
    'how-to',
    'opinion',
  ]
  const validDifficulties = ['easy', 'medium', 'hard']

  for (const q of questions) {
    if (!q.question || typeof q.question !== 'string') {
      throw new Error('Invalid question format: missing question text')
    }

    if (!validCategories.includes(q.category)) {
      throw new Error(`Invalid question category: ${q.category}`)
    }

    if (!validDifficulties.includes(q.estimatedDifficulty)) {
      throw new Error(`Invalid question difficulty: ${q.estimatedDifficulty}`)
    }
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
