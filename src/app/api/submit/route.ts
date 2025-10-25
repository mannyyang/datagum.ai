/**
 * Article Analyzer - Submit API Route
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1, US-1.2, US-1.3
 *
 * Handles article URL submissions with validation and rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
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

    // Get Cloudflare context for background processing
    const { ctx } = await getCloudflareContext()

    // Return immediately with submission ID
    const response = NextResponse.json(
      {
        submissionId: submission.id,
        url: submission.url,
        status: 'pending',
        message: 'Analysis started',
        resultsUrl: `/results/${submission.id}`,
      },
      { status: 200 }
    )

    // Run analysis in background (continues after response sent)
    ctx.waitUntil(
      analyzeArticle(submission.id, submission.url).catch((error) => {
        console.error(
          `[Submit API] Background analysis failed for ${submission.id}:`,
          error
        )
      })
    )

    return response
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
 * Check if IP is localhost
 */
function isLocalhostIP(ip: string): boolean {
  const localhostPatterns = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
  ]
  return localhostPatterns.includes(ip)
}

/**
 * Extract user IP address from request
 */
function extractUserIP(request: NextRequest): string | undefined {
  let ip: string | undefined

  // Cloudflare-specific header (most reliable on Cloudflare)
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp && !isLocalhostIP(cfConnectingIp)) {
    return cfConnectingIp
  }

  // Try X-Forwarded-For header (proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take first IP if multiple
    ip = forwardedFor.split(',')[0].trim()
    if (ip && !isLocalhostIP(ip)) {
      return ip
    }
  }

  // Try X-Real-IP header
  const realIp = request.headers.get('x-real-ip')
  if (realIp && !isLocalhostIP(realIp)) {
    return realIp
  }

  // Try to access IP from request object (if available)
  const requestWithIp = request as NextRequest & { ip?: string }
  if (requestWithIp.ip && !isLocalhostIP(requestWithIp.ip)) {
    return requestWithIp.ip
  }

  // Return undefined for localhost (no rate limiting during local dev)
  return undefined
}
