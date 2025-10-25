/**
 * Article Analyzer - FAQ Generation Types
 *
 * Epic: Epic 3 - FAQ Generation & Testing
 * Stories: US-3.1, US-3.2, US-3.3
 *
 * Types for AI-generated FAQ pairs following CreativeAdsDirectory methodology.
 * Reference: /Users/myang/git/CreativeAdsDirectory/docs/faq-llm-indexing-summary.md
 */

/**
 * Strategic FAQ categories based on 5-question distribution pattern
 *
 * Reference: CreativeAdsDirectory docs lines 127-148
 */
export type FAQCategory =
  | 'what-is' // Introduces main topic (e.g., "What is Nitto Ridge Grappler?")
  | 'how-why' // Explains benefits/features (e.g., "Why choose Ridge Grapplers?")
  | 'technical' // Uses specific numbers/specs (e.g., "How much do 37-inch Ridge Grapplers cost?")
  | 'comparative' // Provides broader context (e.g., "Ridge Grapplers vs all-terrain tires")
  | 'action' // How to learn more/where to find (e.g., "Where to buy Ridge Grapplers?")

/**
 * A single FAQ pair (question + answer)
 *
 * Length requirements per CreativeAdsDirectory guidelines:
 * - Question: 40-70 characters (matches natural search query length)
 * - Answer: 120-180 characters (concise but informative)
 */
export interface FAQ {
  /** Question text (40-70 characters, conversational tone) */
  question: string

  /** Answer text (120-180 characters, authoritative, number-rich) */
  answer: string

  /** Strategic category for distribution validation */
  category: FAQCategory

  /** Extracted numbers/specs used in this FAQ */
  numbers: string[]
}

/**
 * Result of FAQ generation process
 */
export interface FAQGenerationResult {
  /** Generated FAQ pairs */
  faqs: FAQ[]

  /** Total FAQs generated */
  totalGenerated: number

  /** OpenAI model used */
  modelUsed: string

  /** Generation time in milliseconds */
  generationTimeMs?: number

  /** Validation results */
  validation: {
    hasStrategicDistribution: boolean // One FAQ per category
    allQuestionsInRange: boolean // 40-70 chars
    allAnswersInRange: boolean // 120-180 chars
    hasNumbers: boolean // At least one FAQ uses numbers
  }
}

/**
 * Input for FAQ generation
 */
export interface FAQGenerationInput {
  /** Article title */
  articleTitle: string

  /** Article content (will be truncated to 8000 chars) */
  articleContent: string

  /** Target URL being analyzed */
  targetUrl: string

  /** Number of FAQs to generate (default: 5) */
  numberOfFAQs?: number
}

/**
 * 3-Tier test results for a single FAQ
 *
 * Based on CreativeAdsDirectory's tier system:
 * - Tier 1: Accessibility (page is reachable)
 * - Tier 2: Source Inclusion (appears in sources list)
 * - Tier 3: Answer Citation (cited in GPT response)
 */
export interface FAQTestResult {
  /** The FAQ that was tested */
  faq: FAQ

  /** Tier 1: Control test passed (page accessible) */
  isAccessible: boolean

  /** Tier 2: URL found in sources list */
  foundInSources: boolean

  /** Tier 3: URL cited in answer */
  foundInCitations: boolean

  /** Position in citations (if cited) */
  citationPosition?: number

  /** All sources returned by OpenAI */
  allSources: any[]

  /** All citations in the response */
  allCitations: any[]

  /** Response time in milliseconds */
  responseTimeMs: number
}

/**
 * Aggregated test metrics for a submission
 *
 * Success rate targets per CreativeAdsDirectory:
 * - Tier 1 (Accessibility): 95%+
 * - Tier 2 (Sources): 60-70%
 * - Tier 3 (Citations): 20-30%
 *
 * Success rates calculated as:
 * - tier2SuccessRate = (inSourcesCount / totalFaqs) * 100
 * - tier3SuccessRate = (inCitationsCount / totalFaqs) * 100
 */
export interface FAQTestMetrics {
  /** Tier 1: Control test passed */
  isAccessible: boolean

  /** Tier 2: Number of FAQs found in sources */
  inSourcesCount: number

  /** Tier 3: Number of FAQs cited in answers */
  inCitationsCount: number

  /** Total FAQs tested */
  totalFaqs: number

  /** Individual test results */
  results: FAQTestResult[]
}
