/**
 * Article Analyzer - Search Testing Types
 *
 * Epic: Epic 4 - AI Search Visibility Testing
 * Stories: US-4.1, US-4.2, US-4.3, US-4.4
 *
 * Types for testing article visibility in AI search results using OpenAI Responses API.
 */

/**
 * Citation information extracted from AI response annotations
 */
export interface CitationInfo {
  url: string
  title?: string
  position: number // 1-indexed position in citations list
}

/**
 * Source information from web_search_call
 */
export interface SourceInfo {
  url: string
  raw?: unknown // Original source object from API
}

/**
 * Result of a single search test
 */
export interface SearchTestResult {
  question: string
  targetUrlFound: boolean
  foundInSources: boolean
  foundInCitations: boolean
  citations: CitationInfo[]
  sources: string[] // All URLs mentioned in sources
  citationPosition?: number // Position if found in citations (1-indexed)
  responseTimeMs?: number
  modelUsed: string
}

/**
 * Input for search testing
 */
export interface SearchTestInput {
  question: string
  targetUrl: string
}

/**
 * Batch search test results
 */
export interface BatchSearchTestResult {
  results: SearchTestResult[]
  totalTests: number
  successCount: number
  citationCount: number
  sourceCount: number
  averagePosition?: number
  averageResponseTimeMs?: number
}

/**
 * OpenAI Responses API types
 */

export interface ResponsesAPIOutput {
  id: string
  model: string
  output_text: string // The full AI answer with inline citations
  output: OutputItem[] // Structured output items
}

export type OutputItem = WebSearchCallItem | MessageItem

export interface WebSearchCallItem {
  type: 'web_search_call'
  action: {
    sources: Array<string | { url: string }> // URLs retrieved by search
  }
}

export interface MessageItem {
  type: 'message'
  content: MessageContent[]
}

export interface MessageContent {
  type: 'text'
  text: string
  annotations?: URLCitation[] // Citations embedded in answer
}

export interface URLCitation {
  type: 'url_citation'
  url: string // The cited URL
  title?: string // Citation title
  start_index?: number // Position in text
  end_index?: number // End position
}
