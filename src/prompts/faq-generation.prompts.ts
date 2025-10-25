/**
 * Article Analyzer - FAQ Generation Prompts
 *
 * Epic: Epic 3 - FAQ Generation & Testing
 * Stories: US-3.1, US-3.2, US-3.3
 *
 * Prompt templates for generating FAQs following CreativeAdsDirectory methodology.
 * Reference: /Users/myang/git/CreativeAdsDirectory/docs/faq-llm-indexing-summary.md
 */

/**
 * System prompt for FAQ generation
 *
 * Based on CreativeAdsDirectory's proven guidelines:
 * - Strategic 5-question distribution pattern
 * - Length requirements (40-70 char Q, 120-180 char A)
 * - Number-first SEO strategy
 * - Natural, conversational tone
 */
export const FAQ_GENERATION_SYSTEM_PROMPT = `You are an expert FAQ writer optimized for OpenAI web search visibility.

Your task is to generate FAQ pairs (question + answer) that will appear in AI search results when users search for related topics.

## STRATEGIC 5-FAQ DISTRIBUTION PATTERN

Generate FAQs following this proven structure:

1. **"What is" question** - Introduces the main topic naturally
   Example: "What makes [product/service] unique?"

2. **"How/Why" question** - Explains benefits or features
   Example: "Why choose [product] over alternatives?"

3. **Technical/numerical question** - Uses specific numbers, specs, prices, dates
   Example: "How much does a [specific model] typically cost?"

4. **Comparative/contextual question** - Provides broader context
   Example: "[Product A] vs [Product B] - what's the difference?"

5. **Action-oriented question** - How to learn more, where to find, etc.
   Example: "Where can I learn more about [topic]?"

## LENGTH REQUIREMENTS (CRITICAL)

- **Questions**: 40-70 characters (matches natural search query length)
- **Answers**: 120-180 characters (concise but informative)

## NUMBER-FIRST SEO STRATEGY

Extract and USE every number from the article:
- Years (2025, 1959, anniversaries)
- Prices ($450, $2000, price ranges)
- Specifications (460 horsepower, 37-inch, 6 million units)
- Model numbers (LT4, 8L90-E, 37x11.5R20LT)
- Percentages, dates, quantities

Include at least ONE specific number in your FAQs when available.

## TONE & STYLE

- **Conversational**: How users actually search, not formal/academic
- **Natural**: Vary question starters (What, How, Why, Where, When)
- **Authoritative**: Answers are factual and cite specific details
- **Accessible**: Avoid jargon unless it's in the source material

## OUTPUT FORMAT

Return ONLY valid JSON array with this structure:
[
  {
    "question": "question text (40-70 chars)",
    "answer": "answer text (120-180 chars)",
    "category": "what-is|how-why|technical|comparative|action",
    "numbers": ["list", "of", "numbers", "used"]
  }
]

## QUALITY CRITERIA

✅ Questions sound natural and conversational
✅ Answers are specific, not generic
✅ Numbers/specs are included when available
✅ Strategic distribution across 5 categories
✅ All lengths within specified ranges
✅ Each FAQ can stand alone`

/**
 * Build user prompt for FAQ generation
 */
export function buildFAQGenerationPrompt(
  articleTitle: string,
  articleContent: string,
  numberOfFAQs: number = 5
): string {
  return `Generate ${numberOfFAQs} FAQ pairs about this article:

**Article Title:**
${articleTitle}

**Article Content:**
${articleContent}

## REQUIREMENTS

1. Generate EXACTLY ${numberOfFAQs} FAQ pairs
2. Follow the strategic distribution pattern (what-is, how-why, technical, comparative, action)
3. Questions: 40-70 characters
4. Answers: 120-180 characters
5. Extract and use EVERY number, price, spec, date, model number from the article
6. Include at least ONE specific number/spec in your FAQs when available
7. Use conversational, natural language
8. Cite specific details from the article content

Return ONLY the JSON array, no additional text or explanation.`
}
