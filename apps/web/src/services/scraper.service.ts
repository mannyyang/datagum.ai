/**
 * Article Analyzer - Scraper Service
 *
 * Epic: Epic 2 - Article Content Scraping
 * Stories: US-2.1, US-2.2
 *
 * Fetches and extracts article content from URLs.
 * Handles network errors, timeouts, and content parsing.
 */

import { parseArticleContent, type ParsedArticle } from '@/utils/content-parser'
import {
  NetworkError,
  TimeoutError,
  AccessDeniedError,
  ScrapingError,
} from '@/types/scraping-errors'

const REQUEST_TIMEOUT_MS = 15000 // 15 seconds
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

/**
 * Scrape article content from a URL
 */
export async function scrapeArticle(url: string): Promise<ParsedArticle> {
  let lastError: Error | null = null

  // Retry logic
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add delay before retries
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt)
      }

      // Fetch HTML content
      const html = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS)

      // Parse and extract article content
      const parsed = parseArticleContent(html)

      return parsed
    } catch (error) {
      lastError = error as Error

      // Don't retry on certain errors
      if (
        error instanceof AccessDeniedError ||
        error instanceof ScrapingError
      ) {
        throw error
      }

      // Retry on network/timeout errors
      if (attempt < MAX_RETRIES) {
        console.log(
          `Scraping attempt ${attempt + 1} failed for ${url}, retrying...`
        )
        continue
      }

      // Max retries exceeded
      throw error
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new ScrapingError('Failed to scrape article')
}

/**
 * Fetch URL with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArticleAnalyzerBot/1.0; +https://datagum.ai)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    // Check response status
    if (!response.ok) {
      throw createHttpError(response.status, response.statusText, url)
    }

    // Get response body
    const html = await response.text()

    if (!html || html.length === 0) {
      throw new NetworkError('Empty response received')
    }

    return html
  } catch (error) {
    clearTimeout(timeoutId)

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`)
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new NetworkError(`Network error: ${error.message}`)
    }

    // Re-throw custom errors
    if (error instanceof ScrapingError) {
      throw error
    }

    // Unknown error
    throw new NetworkError(
      `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Create appropriate error based on HTTP status code
 */
function createHttpError(
  status: number,
  statusText: string,
  url: string
): Error {
  switch (status) {
    case 401:
    case 403:
      return new AccessDeniedError(
        `Access denied (${status}). The article may be behind a paywall or login.`
      )

    case 404:
      return new NetworkError(`Article not found (404): ${url}`, 404)

    case 429:
      return new NetworkError(
        'Rate limited by the website. Please try again later.',
        429
      )

    case 500:
    case 502:
    case 503:
    case 504:
      return new NetworkError(
        `Server error (${status}). The website may be temporarily unavailable.`,
        status
      )

    default:
      return new NetworkError(`HTTP ${status}: ${statusText}`, status)
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
