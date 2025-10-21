/**
 * Article Analyzer - Rate Limiter Service
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.2
 *
 * Enforces rate limiting for article submissions (3 per IP per 24 hours).
 * Rate limiting is bypassed in development mode.
 */

import { countRecentSubmissionsByIP } from '@/repositories/submission.repository'

const MAX_SUBMISSIONS = 3
const WINDOW_HOURS = 24

/**
 * Check if user has exceeded rate limit
 * Throws error if rate limit exceeded
 */
export async function checkRateLimit(userIp: string): Promise<void> {
  // Skip rate limiting in development
  if (!isRateLimitEnabled()) {
    return
  }

  const count = await countRecentSubmissionsByIP(userIp, WINDOW_HOURS)

  if (count >= MAX_SUBMISSIONS) {
    throw new RateLimitError(
      `Rate limit exceeded. You can analyze ${MAX_SUBMISSIONS} articles per day. Try again later.`
    )
  }
}

/**
 * Check if rate limiting is enabled
 * Disabled in development mode
 */
function isRateLimitEnabled(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Custom error class for rate limit exceeded
 */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}
