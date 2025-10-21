/**
 * Article Analyzer - Results View Component
 *
 * Epic: Epic 5 - Results Display
 * Stories: US-5.1, US-5.2, US-5.3, US-5.4
 *
 * Client component that fetches and displays analysis results.
 */

'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadResults() {
      if (!isMounted) return
      await fetchResults()
    }

    loadResults()

    // Poll for updates if status is pending/processing
    const interval = setInterval(() => {
      if (
        isMounted &&
        data?.submission.status &&
        !['completed', 'failed'].includes(data.submission.status)
      ) {
        loadResults()
      }
    }, 5000) // Poll every 5 seconds

    return () => {
      isMounted = false
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, data?.submission.status])

  async function fetchResults() {
    try {
      const response = await fetch(`/api/results/${submissionId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Results not found')
        } else {
          setError('Failed to load results')
        }
        setLoading(false)
        return
      }

      const results = (await response.json()) as AnalysisResults
      setData(results)
      setLoading(false)
    } catch {
      setError('Failed to load results')
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.href = '/'}
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { submission, results, statistics } = data

  // Still processing
  if (!['completed', 'failed'].includes(submission.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-6 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Analyzing Your Article</h2>
          <p className="text-muted-foreground mb-4">
            We&apos;re scraping the content, generating questions, and testing AI search visibility.
            This usually takes 30-60 seconds.
          </p>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium">{submission.status.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </div>
    )
  }

  // Failed
  if (submission.status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-4">
            {submission.scrapingError || 'An error occurred during analysis'}
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Try Another Article
          </Button>
        </div>
      </div>
    )
  }

  // Completed - show results
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analysis Results</h1>
          <a
            href={submission.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            {submission.articleTitle || submission.url}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Statistics Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Citation Rate</p>
            <p className="text-3xl font-bold">
              {statistics.citationRate.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {statistics.citedCount} of {statistics.totalTests} tests
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Cited</p>
            <p className="text-3xl font-bold text-green-600">
              {statistics.citedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              In citations
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Mentioned</p>
            <p className="text-3xl font-bold text-yellow-600">
              {statistics.mentionedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              In sources only
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Not Found</p>
            <p className="text-3xl font-bold text-red-600">
              {statistics.notFoundCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No mentions
            </p>
          </div>
        </div>

        {statistics.averagePosition && (
          <div className="bg-card border rounded-lg p-6 mb-8">
            <p className="text-sm text-muted-foreground mb-1">
              Average Citation Position
            </p>
            <p className="text-2xl font-bold">
              #{statistics.averagePosition.toFixed(1)}
            </p>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Test Results</h2>

          {results.map((result) => (
            <div key={result.id} className="bg-card border rounded-lg p-6">
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
