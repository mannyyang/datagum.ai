/**
 * Article Analyzer - Results API Route
 *
 * Epic: Epic 5 - Results Display
 * Stories: US-5.1, US-5.2, US-5.3
 *
 * Fetches analysis results for a submission.
 * Returns submission details and all test results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSubmissionById } from '@/repositories/submission.repository'
import { getResultsBySubmission } from '@/repositories/results.repository'
import type { CitationInfo } from '@/db/schema'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get submission
    const submission = await getSubmissionById(id)

    if (!submission) {
      return NextResponse.json(
        { message: 'Submission not found' },
        { status: 404 }
      )
    }

    // Get test results
    const results = await getResultsBySubmission(id)

    // Calculate statistics
    const totalTests = results.length
    const citedCount = results.filter((r) => r.foundInCitations).length
    const mentionedCount = results.filter((r) => r.foundInSources).length
    const notFoundCount = results.filter((r) => !r.targetUrlFound).length

    const citationPositions = results
      .filter((r) => {
        const citations = r.allCitations as CitationInfo[]
        return r.foundInCitations && citations.length > 0
      })
      .map((r) => {
        const citations = r.allCitations as CitationInfo[]
        const targetCitation = citations.find((c) =>
          normalizeUrl(c.url) === normalizeUrl(submission.url)
        )
        return targetCitation?.position ?? 999
      })

    const averagePosition =
      citationPositions.length > 0
        ? citationPositions.reduce((sum, pos) => sum + pos, 0) /
          citationPositions.length
        : undefined

    // Return combined data
    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          url: submission.url,
          status: submission.status,
          articleTitle: submission.articleTitle,
          scrapingError: submission.scrapingError,
          createdAt: submission.createdAt,
          completedAt: submission.completedAt,
        },
        results: results.map((r) => ({
          id: r.id,
          question: r.question,
          targetUrlFound: r.targetUrlFound,
          foundInSources: r.foundInSources,
          foundInCitations: r.foundInCitations,
          citations: r.allCitations,
          sources: r.allSources,
        })),
        statistics: {
          totalTests,
          citedCount,
          mentionedCount,
          notFoundCount,
          citationRate:
            totalTests > 0 ? (citedCount / totalTests) * 100 : 0,
          averagePosition,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Results API error:', error)

    return NextResponse.json(
      { message: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let hostname = parsed.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    let pathname = parsed.pathname
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    return `${parsed.protocol}//${hostname}${pathname}`
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}
