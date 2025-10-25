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
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ResultsViewProps {
  submissionId: string
}

interface FAQ {
  question: string
  answer: string
  category: string
  numbers: string[]
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
    generatedFaqs?: FAQ[]
    testMetrics?: {
      isAccessible: boolean
      inSourcesCount: number
      inCitationsCount: number
      totalFaqs: number
    }
  }
  results: TestResult[]
  statistics: {
    totalTests: number
    citedCount: number
    mentionedCount: number
    notFoundCount: number
    citationRate: number
    averagePosition?: number
    totalSources?: number
    totalCitations?: number
  }
}

interface TestResult {
  id: number
  question: string
  llmResponse?: string
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
              {submission.status === 'scraping' && '📄 Scraping article...'}
              {submission.status === 'generating_faqs' && '🤔 Generating FAQ questions...'}
              {submission.status === 'running_control' && '🔍 Running control test (Tier 1)...'}
              {submission.status === 'testing_faqs' && `🧪 Testing FAQs... (${results.length} of 5 completed)`}
              {!submission.status && 'Analyzing your article...'}
            </p>
          )}
        </div>

        {/* Statistics Cards - with skeleton support */}
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 *:from-primary/5 *:to-card *:bg-gradient-to-t dark:*:bg-card *:shadow-xs">
          {/* Citation Rate Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Citation Rate</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.citationRate.toFixed(0)}%
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-16" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">
                  {statistics.citedCount} of {statistics.totalTests} tests
                </div>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
            </CardFooter>
          </Card>

          {/* Cited Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Cited</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.citedCount}
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-12" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">In citations</div>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </CardFooter>
          </Card>

          {/* Mentioned Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Mentioned</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.mentionedCount}
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-12" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">In sources only</div>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
            </CardFooter>
          </Card>

          {/* Not Found Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Not Found</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.notFoundCount}
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-12" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">No mentions</div>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </CardFooter>
          </Card>

          {/* Total Sources Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Sources</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.totalSources || 0}
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-12" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">Retrieved</div>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </CardFooter>
          </Card>

          {/* Total Citations Card */}
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Citations</CardDescription>
              {statistics ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {statistics.totalCitations || 0}
                </CardTitle>
              ) : (
                <Skeleton className="h-10 w-12" />
              )}
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {statistics ? (
                <div className="text-muted-foreground text-xs">In answers</div>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Average Position (if available) */}
        {statistics?.averagePosition && (
          <Card className="@container/card mb-8 from-primary/5 to-card bg-gradient-to-t dark:bg-card shadow-xs">
            <CardHeader>
              <CardDescription>Average Citation Position</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                #{statistics.averagePosition.toFixed(1)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="text-muted-foreground text-xs">
                Position in cited responses
              </div>
            </CardFooter>
          </Card>
        )}

        {/* Test Results - with progressive loading */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold">Test Results</h2>
            {submission?.status === 'testing_faqs' && submission.generatedFaqs && (
              <span className="text-sm font-medium text-blue-600">
                {results.length} of {submission.generatedFaqs.length} tests completed
              </span>
            )}
            {(submission?.status === 'scraping' ||
              submission?.status === 'generating_faqs' ||
              submission?.status === 'running_control') && (
              <span className="text-sm text-muted-foreground">
                Preparing tests...
              </span>
            )}
          </div>

          {/* Control Test Card - Tier 1 (first test, at top) */}
          {(submission?.status === 'running_control' ||
            submission?.status === 'testing_faqs' ||
            submission?.status === 'completed' ||
            data?.submission?.testMetrics) && (
            <div className="bg-muted/30 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Control Test (Tier 1)
                  </h3>
                  {submission?.status === 'running_control' && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {submission?.status === 'running_control' ? (
                  <span className="text-xs text-muted-foreground">Testing...</span>
                ) : data?.submission?.testMetrics ? (
                  <div className="flex items-center gap-1.5">
                    {data.submission.testMetrics.isAccessible ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Accessible</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Not Accessible</span>
                      </>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-4 w-24" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Verifies if OpenAI can access the article directly
              </p>
            </div>
          )}

          {/* Show generated questions with progressive results loading */}
          {submission?.generatedFaqs && submission.generatedFaqs.length > 0 ? (
            // We have generated questions - show all of them with results or skeletons
            submission.generatedFaqs.map((faq, index) => {
              const result = results.find(r => r.question === faq.question)

              if (result) {
                // Question has completed results - show full result card
                return (
                  <div
                    key={result.id}
                    className="bg-card border rounded-lg p-6 animate-in fade-in duration-300"
                  >
                    <div className="flex items-start gap-3">
                      {result.foundInCitations ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : result.foundInSources ? (
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold mb-3">{result.question}</h3>

                        {/* Primary Insight: Citation vs Sources Status */}
                        <div className="mb-4 flex flex-wrap gap-2">
                          {result.foundInCitations && (
                            <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              Found in Citations (Tier 3)
                            </Badge>
                          )}

                          {result.foundInSources && !result.foundInCitations && (
                            <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
                              <AlertCircle className="h-3 w-3 text-yellow-600" />
                              In Sources Only (Tier 2)
                            </Badge>
                          )}

                          {!result.targetUrlFound && (
                            <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                              <XCircle className="h-3 w-3 text-red-600" />
                              Not Found
                            </Badge>
                          )}
                        </div>

                        {/* Citations - collapsed by default */}
                        {result.citations.length > 0 && (
                          <details className="mb-3">
                            <summary className="text-sm font-medium cursor-pointer hover:text-foreground flex items-center gap-2">
                              <span>Citations ({result.citations.length})</span>
                              {result.foundInCitations && (
                                <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 text-xs px-1.5 py-0">
                                  <CheckCircle className="h-2.5 w-2.5" />
                                  Your article
                                </Badge>
                              )}
                            </summary>
                            <ul className="mt-2 space-y-1 text-sm pl-4 border-l-2 border-muted">
                              {result.citations.map((citation, idx) => (
                                <li key={idx} className="flex items-start gap-2 py-1">
                                  <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                                    [{citation.position}]
                                  </span>
                                  <a
                                    href={citation.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 break-all"
                                  >
                                    {citation.title || citation.url}
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {/* Sources - collapsed by default */}
                        {result.sources.length > 0 && (
                          <details className="mb-3">
                            <summary className="text-sm font-medium cursor-pointer hover:text-foreground flex items-center gap-2">
                              <span>Sources ({result.sources.length})</span>
                              {result.foundInSources && (
                                <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20 text-xs px-1.5 py-0">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  Your article
                                </Badge>
                              )}
                            </summary>
                            <ul className="mt-2 space-y-1 text-sm pl-4 border-l-2 border-muted">
                              {result.sources.map((source, idx) => (
                                <li key={idx} className="flex items-start gap-2 py-1">
                                  <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                                    [{idx + 1}]
                                  </span>
                                  <a
                                    href={source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 break-all"
                                  >
                                    {source}
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {/* LLM Response - collapsed, under citations/sources */}
                        {result.llmResponse && (
                          <details className="mt-3">
                            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                              View full AI response
                            </summary>
                            <div className="mt-2 p-3 bg-muted/30 rounded border border-border">
                              <p className="text-sm text-muted-foreground">{result.llmResponse}</p>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )
              } else {
                // Question hasn't been tested yet - show question with skeleton loaders
                return (
                  <div
                    key={`pending-${index}`}
                    className="bg-card border rounded-lg p-6"
                  >
                    <div className="flex items-start gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-3">{faq.question}</h3>
                        <div className="space-y-3">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
            })
          ) : (
            // No generated questions yet - show generic skeleton placeholders
            Array.from({ length: 5 }).map((_, i) => (
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
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-12 text-center">
          <Button onClick={() => (window.location.href = '/')}>
            Analyze Another Article
          </Button>
        </div>
      </div>
    </main>
  )
}
