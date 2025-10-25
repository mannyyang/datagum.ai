/**
 * Test Results Formatter
 *
 * Formats 3-tier FAQ test results for storage and API responses.
 * Based on CreativeAdsDirectory's SearchResultsFormatter.
 *
 * Reference: /Users/myang/git/CreativeAdsDirectory/server/services/job-queue/formatters/search-results.formatter.ts
 */

import type { SearchTestResult } from '@/types/search-testing'
import type { FAQ, FAQTestMetrics } from '@/types/faq-generation'
import type { TestMetricsData } from '@/db/schema'

/**
 * Calculate 3-tier metrics from individual FAQ test results
 */
export function calculateTestMetrics(
  results: SearchTestResult[],
  isAccessible: boolean
): FAQTestMetrics {
  const totalFaqs = results.length
  const inSourcesCount = results.filter((r) => r.foundInSources).length
  const inCitationsCount = results.filter((r) => r.foundInCitations).length

  return {
    isAccessible,
    inSourcesCount,
    inCitationsCount,
    totalFaqs,
    results: results.map((result) => ({
      faq: {
        question: result.question,
        answer: '', // Not available in test results
        category: 'what-is' as const, // Placeholder
        numbers: [],
      },
      isAccessible,
      foundInSources: result.foundInSources,
      foundInCitations: result.foundInCitations,
      citationPosition: result.citationPosition,
      allSources: result.sources,
      allCitations: result.citations,
      responseTimeMs: result.responseTimeMs || 0,
    })),
  }
}

/**
 * Format test metrics for database storage
 */
export function formatMetricsForStorage(
  metrics: FAQTestMetrics
): TestMetricsData {
  return {
    isAccessible: metrics.isAccessible,
    inSourcesCount: metrics.inSourcesCount,
    inCitationsCount: metrics.inCitationsCount,
    totalFaqs: metrics.totalFaqs,
  }
}

/**
 * Calculate success rates from metrics
 */
export function calculateSuccessRates(metrics: {
  inSourcesCount: number
  inCitationsCount: number
  totalFaqs: number
}): {
  tier2SuccessRate: number
  tier3SuccessRate: number
} {
  const tier2SuccessRate =
    metrics.totalFaqs > 0
      ? (metrics.inSourcesCount / metrics.totalFaqs) * 100
      : 0

  const tier3SuccessRate =
    metrics.totalFaqs > 0
      ? (metrics.inCitationsCount / metrics.totalFaqs) * 100
      : 0

  return {
    tier2SuccessRate: Math.round(tier2SuccessRate * 10) / 10, // Round to 1 decimal
    tier3SuccessRate: Math.round(tier3SuccessRate * 10) / 10,
  }
}

/**
 * Format metrics for API response (includes calculated success rates)
 */
export function formatMetricsForAPI(metrics: TestMetricsData) {
  const successRates = calculateSuccessRates(metrics)

  return {
    ...metrics,
    ...successRates,
    // Add performance indicators
    meetsTargets: {
      tier1: metrics.isAccessible, // Target: 95%+ (binary for single submission)
      tier2: successRates.tier2SuccessRate >= 60, // Target: 60-70%
      tier3: successRates.tier3SuccessRate >= 20, // Target: 20-30%
    },
  }
}

/**
 * Get performance summary text
 */
export function getPerformanceSummary(metrics: TestMetricsData): string {
  const rates = calculateSuccessRates(metrics)

  const tier1Status = metrics.isAccessible ? '✅ PASS' : '❌ FAIL'
  const tier2Status = rates.tier2SuccessRate >= 60 ? '✅ GOOD' : '⚠️  LOW'
  const tier3Status = rates.tier3SuccessRate >= 20 ? '✅ GOOD' : '⚠️  LOW'

  return `
Tier 1 (Accessibility): ${tier1Status}
Tier 2 (In Sources): ${tier2Status} (${rates.tier2SuccessRate}% - Target: 60-70%)
Tier 3 (In Citations): ${tier3Status} (${rates.tier3SuccessRate}% - Target: 20-30%)
  `.trim()
}
