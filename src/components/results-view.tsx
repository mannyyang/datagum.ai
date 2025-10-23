/**
 * Article Analyzer - Results View Component
 *
 * Epic: Epic 5 - Results Display
 * Stories: US-5.1, US-5.2, US-5.3, US-5.4
 *
 * Client component that fetches and displays analysis results with progressive loading.
 * Uses skeleton states for instant page render and progressive data population.
 */

'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ResultsViewProps {
  submissionId: string
}

interface AnalysisResults {
  submission: {
    id: string
    url: string
    status: string
    articleTitle?: string
    scrapingError?: string
    createdAt: string
    completedAt?: string
  }
  results: TestResult[]
  statistics: {
    totalTests: number
    citedCount: number
    mentionedCount: number
    notFoundCount: number
    citationRate: number
    averagePosition?: number
  }
}

interface TestResult {
  id: number
  question: string
  targetUrlFound: boolean
  foundInSources: boolean
  foundInCitations: boolean
  citations: Citation[]
  sources: string[]
}

interface Citation {
  url: string
  title?: string
  position: number
}

export function ResultsView({ submissionId }: ResultsViewProps) {
  const [data, setData] = useState<AnalysisResults | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null

    async function fetchResults() {
      if (!isMounted) return

      try {
        const response = await fetch(`/api/results/${submissionId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Results not found')
          } else {
            setError('Failed to load results')
          }
          return
        }

        const results = (await response.json()) as AnalysisResults
        setData(results)

        // Continue polling if still processing
        if (
          isMounted &&
          results.submission.status &&
          !['completed', 'failed'].includes(results.submission.status)
        ) {
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              fetchResults()
            }, 3000) // Poll every 3 seconds
          }
        } else {
          // Stop polling when completed or failed
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
        }
      } catch {
        setError('Failed to load results')
      }
    }

    // Initial fetch
    fetchResults()

    return () => {
      isMounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [submissionId])

  // Error state - full page replacement
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => (window.location.href = '/')}
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const submission = data?.submission
  const results = data?.results || []
  const statistics = data?.statistics
  const isProcessing = submission?.status && !['completed', 'failed'].includes(submission.status)

  // Failed state - full page replacement
  if (submission?.status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-4">
            {submission.scrapingError || 'An error occurred during analysis'}
          </p>
          <Button onClick={() => (window.location.href = '/')}>
            Try Another Article
          </Button>
        </div>
      </div>
    )
  }

  // Progressive loading - always show page layout
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-6 py-12">
        {/* Header - with skeleton support */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Analysis Results</h1>
            {isProcessing && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          {submission?.url ? (
            <a
              href={submission.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
            >
              {submission.articleTitle || submission.url}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <Skeleton className="h-6 w-96 max-w-full" />
          )}
          {isProcessing && (
            <p className="text-sm text-muted-foreground mt-2">
              Analyzing your article... ({results.length} of 10 questions tested)
            </p>
          )}
        </div>

        {/* Statistics Cards - with skeleton support */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {/* Citation Rate Card */}
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Citation Rate</p>
            {statistics ? (
              <>
                <p className="text-3xl font-bold">
                  {statistics.citationRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statistics.citedCount} of {statistics.totalTests} tests
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </>
            )}
          </div>

          {/* Cited Card */}
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Cited</p>
            {statistics ? (
              <>
                <p className="text-3xl font-bold text-green-600">
                  {statistics.citedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">In citations</p>
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-12 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            )}
          </div>

          {/* Mentioned Card */}
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Mentioned</p>
            {statistics ? (
              <>
                <p className="text-3xl font-bold text-yellow-600">
                  {statistics.mentionedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">In sources only</p>
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-12 mb-1" />
                <Skeleton className="h-4 w-24" />
              </>
            )}
          </div>

          {/* Not Found Card */}
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Not Found</p>
            {statistics ? (
              <>
                <p className="text-3xl font-bold text-red-600">
                  {statistics.notFoundCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">No mentions</p>
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-12 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            )}
          </div>
        </div>

        {/* Average Position (if available) */}
        {statistics?.averagePosition && (
          <div className="bg-card border rounded-lg p-6 mb-8">
            <p className="text-sm text-muted-foreground mb-1">
              Average Citation Position
            </p>
            <p className="text-2xl font-bold">
              #{statistics.averagePosition.toFixed(1)}
            </p>
          </div>
        )}

        {/* Test Results - with progressive loading */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold">Test Results</h2>
            {isProcessing && (
              <span className="text-sm text-muted-foreground">
                {results.length} of 10 completed
              </span>
            )}
          </div>

          {/* Real results */}
          {results.map((result) => (
            <div
              key={result.id}
              className="bg-card border rounded-lg p-6 animate-in fade-in duration-300"
            >
              <div className="flex items-start gap-3 mb-4">
                {result.foundInCitations ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : result.foundInSources ? (
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">{result.question}</h3>

                  {result.foundInCitations && (
                    <p className="text-sm text-green-600 mb-2">
                      ✓ Found in citations
                    </p>
                  )}

                  {result.foundInSources && !result.foundInCitations && (
                    <p className="text-sm text-yellow-600 mb-2">
                      ⚠ Mentioned in sources but not cited
                    </p>
                  )}

                  {!result.targetUrlFound && (
                    <p className="text-sm text-red-600 mb-2">
                      ✗ Not found in response
                    </p>
                  )}

                  {result.citations.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                        View {result.citations.length} citation(s)
                      </summary>
                      <ul className="mt-2 space-y-1 text-sm">
                        {result.citations.map((citation, idx) => (
                          <li key={idx} className="truncate">
                            {citation.position}. {citation.url}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Skeleton placeholders for pending results */}
          {Array.from({ length: Math.max(0, 10 - results.length) }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="bg-card border rounded-lg p-6"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-12 text-center">
          <Button onClick={() => window.location.href = '/'}>
            Analyze Another Article
          </Button>
        </div>
      </div>
    </main>
  )
}
