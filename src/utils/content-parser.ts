/**
 * Article Analyzer - Content Parser Utility
 *
 * Epic: Epic 2 - Article Content Scraping
 * Stories: US-2.1, US-2.2
 *
 * Parses HTML content to extract article text and metadata.
 * Uses heuristics to identify main content and filter noise.
 */

import { parseHTML } from 'linkedom'
import { ParsingError, ContentNotFoundError } from '@/types/scraping-errors'

const MIN_CONTENT_LENGTH = 100 // Minimum characters for valid article

/**
 * Parsed article data
 */
export interface ParsedArticle {
  title: string
  content: string
  wordCount: number
}

/**
 * Parse HTML and extract article content
 */
export function parseArticleContent(html: string): ParsedArticle {
  try {
    // Use linkedom for Cloudflare Workers compatibility
    const { document } = parseHTML(html)

    // Extract title
    const title = extractTitle(document)

    // Extract main content
    const content = extractMainContent(document)

    // Validate content length
    if (content.length < MIN_CONTENT_LENGTH) {
      throw new ContentNotFoundError(
        `Article content too short (${content.length} characters). Minimum ${MIN_CONTENT_LENGTH} required.`
      )
    }

    // Calculate word count
    const wordCount = content.split(/\s+/).filter((word) => word.length > 0)
      .length

    return {
      title,
      content,
      wordCount,
    }
  } catch (error) {
    if (
      error instanceof ContentNotFoundError ||
      error instanceof ParsingError
    ) {
      throw error
    }
    throw new ParsingError(
      `Failed to parse article content: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Extract article title from document
 */
function extractTitle(document: Document): string {
  // Try <title> tag first
  const titleTag = document.querySelector('title')
  if (titleTag?.textContent?.trim()) {
    return titleTag.textContent.trim()
  }

  // Try <h1> as fallback
  const h1 = document.querySelector('h1')
  if (h1?.textContent?.trim()) {
    return h1.textContent.trim()
  }

  // Try Open Graph title
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle?.getAttribute('content')?.trim()) {
    return ogTitle.getAttribute('content')!.trim()
  }

  return 'Untitled Article'
}

/**
 * Extract main article content from document
 */
function extractMainContent(document: Document): string {
  // Remove unwanted elements
  removeUnwantedElements(document)

  // Try semantic HTML5 tags first
  const article =
    document.querySelector('article') || document.querySelector('main')

  if (article) {
    return cleanText(article.textContent || '')
  }

  // Try common content class names
  const contentSelectors = [
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#content',
    '.article-body',
    '.post-body',
  ]

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      const text = cleanText(element.textContent || '')
      if (text.length >= MIN_CONTENT_LENGTH) {
        return text
      }
    }
  }

  // Fallback: get all paragraphs
  const paragraphs = Array.from(document.querySelectorAll('p'))
  const combinedText = paragraphs
    .map((p) => cleanText(p.textContent || ''))
    .filter((text) => text.length > 0)
    .join('\n\n')

  return combinedText
}

/**
 * Remove unwanted elements from document
 */
function removeUnwantedElements(document: Document): void {
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'iframe',
    '.advertisement',
    '.ad',
    '.social-share',
    '.comments',
    '.sidebar',
  ]

  unwantedSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.remove())
  })
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Remove multiple newlines
      .replace(/\n{3,}/g, '\n\n')
  )
}
