/**
 * Article Analyzer - Question Generation Types
 *
 * Epic: Epic 3 - Question Generation
 * Stories: US-3.1, US-3.2
 *
 * Types for AI-generated question generation from article content.
 */

/**
 * A single generated question about the article
 */
export interface GeneratedQuestion {
  question: string
  category: QuestionCategory
  estimatedDifficulty: 'easy' | 'medium' | 'hard'
}

/**
 * Question categories based on article content
 */
export type QuestionCategory =
  | 'factual' // Direct facts from the article
  | 'conceptual' // Concepts and explanations
  | 'comparative' // Comparisons and alternatives
  | 'how-to' // Process and procedures
  | 'opinion' // Analysis and perspectives

/**
 * Result of question generation process
 */
export interface QuestionGenerationResult {
  questions: GeneratedQuestion[]
  totalGenerated: number
  modelUsed: string
  generationTimeMs?: number
}

/**
 * Input for question generation
 */
export interface QuestionGenerationInput {
  articleTitle: string
  articleContent: string
  targetUrl: string
  numberOfQuestions?: number // Default: 5
}
