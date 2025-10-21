/**
 * Article Analyzer - Scraping Error Types
 *
 * Epic: Epic 2 - Article Content Scraping
 * Stories: US-2.1, US-2.2
 *
 * Custom error classes for web scraping operations.
 * Helps categorize and handle different failure scenarios.
 */

/**
 * Base class for all scraping-related errors
 */
export class ScrapingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScrapingError'
  }
}

/**
 * Error when HTTP request fails (network, DNS, etc.)
 */
export class NetworkError extends ScrapingError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Error when request times out
 */
export class TimeoutError extends ScrapingError {
  constructor(message: string = 'Request timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Error when content parsing fails
 */
export class ParsingError extends ScrapingError {
  constructor(message: string) {
    super(message)
    this.name = 'ParsingError'
  }
}

/**
 * Error when required content is missing or insufficient
 */
export class ContentNotFoundError extends ScrapingError {
  constructor(message: string = 'Article content not found or too short') {
    super(message)
    this.name = 'ContentNotFoundError'
  }
}

/**
 * Error when access is blocked (paywall, 403, 401, etc.)
 */
export class AccessDeniedError extends ScrapingError {
  constructor(message: string) {
    super(message)
    this.name = 'AccessDeniedError'
  }
}
