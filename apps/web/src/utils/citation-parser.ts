/**
 * Article Analyzer - Citation Parser
 *
 * Epic: Epic 4 - AI Search Visibility Testing
 * Stories: US-4.2, US-4.3
 *
 * Parses OpenAI Responses API output to extract citations and sources.
 * Detects if target URL appears in citations or sources.
 */

import type {
  CitationInfo,
  SourceInfo,
  ResponsesAPIOutput,
  WebSearchCallItem,
  MessageItem,
} from '@/types/search-testing'

/**
 * Extract sources from web_search_call items in response.output
 */
export function extractSources(response: ResponsesAPIOutput): SourceInfo[] {
  const sources: SourceInfo[] = []

  for (const item of response.output) {
    if (item.type === 'web_search_call') {
      const webSearchItem = item as WebSearchCallItem
      const rawSources = webSearchItem.action?.sources || []

      for (const source of rawSources) {
        const url = typeof source === 'string' ? source : source.url
        if (url) {
          sources.push({
            url: cleanUrl(url),
            raw: source,
          })
        }
      }
    }
  }

  return sources
}

/**
 * Extract citations from message content annotations
 */
export function extractCitations(response: ResponsesAPIOutput): CitationInfo[] {
  const citations: CitationInfo[] = []
  let position = 1 // 1-indexed position

  for (const item of response.output) {
    if (item.type === 'message') {
      const messageItem = item as MessageItem

      for (const content of messageItem.content) {
        if (content.annotations) {
          for (const annotation of content.annotations) {
            if (annotation.type === 'url_citation') {
              citations.push({
                url: cleanUrl(annotation.url),
                title: annotation.title,
                position: position++,
              })
            }
          }
        }
      }
    }
  }

  return citations
}

/**
 * Extract all source URLs as simple string array
 */
export function extractAllSources(response: ResponsesAPIOutput): string[] {
  const sources = extractSources(response)
  return sources.map((s) => s.url)
}

/**
 * Check if target URL is found in citations
 */
export function isTargetInCitations(
  targetUrl: string,
  citations: CitationInfo[]
): { found: boolean; position?: number } {
  const normalizedTarget = normalizeUrl(targetUrl)

  for (const citation of citations) {
    const normalizedCitation = normalizeUrl(citation.url)

    if (normalizedCitation === normalizedTarget) {
      return { found: true, position: citation.position }
    }
  }

  return { found: false }
}

/**
 * Check if target URL is found in sources
 */
export function isTargetInSources(
  targetUrl: string,
  sources: string[]
): boolean {
  const normalizedTarget = normalizeUrl(targetUrl)

  return sources.some((source) => {
    const normalizedSource = normalizeUrl(source)
    return normalizedSource === normalizedTarget
  })
}

/**
 * Normalize URL for comparison
 * Removes trailing slashes, www prefix, query params, fragments
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Remove www prefix
    let hostname = parsed.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }

    // Remove trailing slash from pathname
    let pathname = parsed.pathname
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    // Return normalized URL without query/fragment
    return `${parsed.protocol}//${hostname}${pathname}`
  } catch {
    // If URL parsing fails, just return lowercase cleaned version
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

/**
 * Clean URL by removing trailing punctuation and whitespace
 */
function cleanUrl(url: string): string {
  return url.replace(/[,\.\)\]\>]+$/, '').trim()
}
