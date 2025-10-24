/**
 * Article Analyzer - Submit API Route
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1, US-1.2, US-1.3
 *
 * Handles article URL submissions with validation and rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateURL, sanitizeURL } from '@/services/url-validator.service'
import { checkRateLimit, RateLimitError } from '@/services/rate-limiter.service'
import { createSubmission } from '@/repositories/submission.repository'
import { analyzeArticle } from '@/services/analysis.service'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as { url?: string }
    const { url } = body

    // Validate URL format
    if (!url) {
      return NextResponse.json(
        { message: 'URL is required' },
        { status: 400 }
      )
    }

    // Sanitize and validate URL
    const cleanUrl = sanitizeURL(url)
    validateURL(cleanUrl)

    // Get user IP for rate limiting
    const userIp = extractUserIP(request)

    // Check rate limit
    if (userIp) {
      await checkRateLimit(userIp)
    }

    // Create submission record
    const submission = await createSubmission(cleanUrl, userIp)

    // Run analysis synchronously
    console.log(`[Submit API] Starting analysis for ${submission.id}`)
    const analysisResult = await analyzeArticle(submission.id, submission.url)

    // Return success response with analysis results
    return NextResponse.json(
      {
        success: analysisResult.success,
        submissionId: submission.id,
        url: submission.url,
        status: analysisResult.success ? 'completed' : 'failed',
        message: analysisResult.success
          ? 'Article analysis completed'
          : 'Article analysis failed',
        resultsUrl: `/results/${submission.id}`,
        analysis: {
          articleTitle: analysisResult.articleTitle,
          questionCount: analysisResult.questionCount,
          testsCompleted: analysisResult.testsCompleted,
          testsFound: analysisResult.testsFound,
          duration: analysisResult.duration,
        },
        error: analysisResult.error,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Submit API error:', error)

    // Handle rate limit errors
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { message: error.message },
        { status: 429 }
      )
    }

    // Handle validation errors
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      )
    }

    // Handle unexpected errors
    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * Extract user IP address from request
 */
function extractUserIP(request: NextRequest): string | undefined {
  // Cloudflare-specific header (most reliable on Cloudflare)
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Try X-Forwarded-For header (proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take first IP if multiple
    return forwardedFor.split(',')[0].trim()
  }

  // Try X-Real-IP header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Try to access IP from request object (if available)
  const requestWithIp = request as NextRequest & { ip?: string }
  if (requestWithIp.ip) {
    return requestWithIp.ip
  }

  return undefined
}
