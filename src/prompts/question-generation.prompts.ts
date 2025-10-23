/**
 * Article Analyzer - Question Generation Prompts
 *
 * Epic: Epic 3 - Question Generation
 * Stories: US-3.1, US-3.2
 *
 * Prompt templates for generating questions from article content using GPT-4.1-mini.
 */

/**
 * System prompt for question generation
 */
export const QUESTION_GENERATION_SYSTEM_PROMPT = `You are a helpful assistant that generates diverse, high-quality questions about article content.

Your task is to analyze an article and generate questions that:
1. Cover different aspects of the article (facts, concepts, comparisons, processes, opinions)
2. Are likely to be asked by users searching for information on this topic
3. Would ideally return the target article as a citation in AI search results
4. Are natural, conversational, and varied in complexity

Question categories:
- factual: Direct facts from the article
- conceptual: Concepts and explanations
- comparative: Comparisons and alternatives
- how-to: Process and procedures
- opinion: Analysis and perspectives

Return your response as a JSON array of objects with this structure:
{
  "question": "the question text",
  "category": "factual|conceptual|comparative|how-to|opinion",
  "estimatedDifficulty": "easy|medium|hard"
}

Generate questions that sound natural and diverse. Avoid repetitive phrasing.`

/**
 * Build user prompt for question generation
 */
export function buildQuestionGenerationPrompt(
  articleTitle: string,
  articleContent: string,
  numberOfQuestions: number
): string {
  // Truncate content if too long (GPT-4.1-mini has token limits)
  const maxContentLength = 8000 // ~2000 tokens
  const truncatedContent =
    articleContent.length > maxContentLength
      ? articleContent.substring(0, maxContentLength) + '...'
      : articleContent

  return `Generate ${numberOfQuestions} diverse questions about this article:

**Article Title:**
${articleTitle}

**Article Content:**
${truncatedContent}

Generate exactly ${numberOfQuestions} questions covering different categories and difficulty levels. Return only the JSON array, no additional text.`
}
