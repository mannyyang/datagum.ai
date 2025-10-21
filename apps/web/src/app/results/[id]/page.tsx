/**
 * Article Analyzer - Results Page
 *
 * Epic: Epic 5 - Results Display
 * Stories: US-5.1, US-5.2, US-5.3, US-5.4
 *
 * Displays analysis results for a submitted article.
 * Shows citation statistics, test results, and insights.
 */

import { ResultsView } from '@/components/results-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params

  return <ResultsView submissionId={id} />
}
