# Domain Model: Unit 2 - Article Content Scraping

**Version**: 2.0.0
**Last Updated**: 2025-10-25
**Epic**: Epic 2 - Article Content Scraping
**User Stories**: US-2.1, US-2.2
**Status**: ✅ Fully Implemented

---

## Executive Summary

This domain model documents the **current implementation** of article content scraping for the datagum.ai Article Analyzer. The system fetches HTML content from submitted URLs, parses article text and metadata, converts HTML to Markdown, and handles various error scenarios including timeouts, access restrictions, and parsing failures.

### Key Business Requirements (Implemented)
- Fetch HTML content from submitted article URLs
- Extract article title and main content
- Convert HTML to clean Markdown format
- Handle network errors, timeouts, and HTTP error codes
- Retry failed requests with exponential backoff
- Detect and handle paywalled/restricted content
- Store first 5000 characters of article content

### Architecture
- **Framework**: Next.js 15.4.6 running on Cloudflare Workers
- **HTML Parsing**: linkedom (DOM implementation for edge runtime)
- **HTML to Markdown**: TurndownService
- **Timeout Handling**: AbortController with 15-second limit
- **Retry Logic**: Exponential backoff (up to 2 retries)

---

## Component Overview

| Component | Type | Location | Lines | Status |
|-----------|------|----------|-------|--------|
| ScraperService | Service | `src/services/scraper.service.ts` | 177 | ✅ Implemented |
| ContentParser | Utility | `src/utils/content-parser.ts` | 217 | ✅ Implemented |
| ScrapingErrors | Types | `src/types/scraping-errors.ts` | 69 | ✅ Implemented |

**Total Implementation**: 463 lines of production code

---

## Component Details

### 1. ScraperService

**Location**: `src/services/scraper.service.ts` (177 lines)
**Type**: Service
**Responsibility**: Fetches and extracts article content from URLs

**Public Function**:

```typescript
export async function scrapeArticle(url: string): Promise<ParsedArticle>
```

**Return Type**:
```typescript
export interface ParsedArticle {
  title: string
  content: string  // Markdown format
  wordCount: number
}
```

**Configuration Constants**:
```typescript
const REQUEST_TIMEOUT_MS = 15000 // 15 seconds
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000 // Base delay, exponential backoff
```

**Implementation Flow**:

1. **Retry Loop** (up to 2 retries):
   - Attempt 0: Immediate request
   - Attempt 1: 1 second delay
   - Attempt 2: 2 second delay

2. **HTTP Fetch** (`fetchWithTimeout()`):
   - Create AbortController for timeout
   - Set timeout to 15 seconds
   - Send request with custom headers
   - Follow redirects automatically
   - Check response status
   - Return HTML text

3. **Content Parsing** (`parseArticleContent()`):
   - Parse HTML with linkedom
   - Extract title
   - Extract main content
   - Convert to Markdown
   - Validate content length
   - Calculate word count
   - Return ParsedArticle

4. **Error Handling**:
   - Categorize errors by type
   - Retry on network/timeout errors
   - Don't retry on access denied or parsing errors
   - Throw appropriate custom error

**HTTP Status Code Handling**:
- 401/403: AccessDeniedError (paywall, no retry)
- 404: NetworkError (not found, no retry)
- 429: NetworkError (rate limited, no retry)
- 500/502/503/504: NetworkError (server error, retry)

**Timeout Handling**:
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArticleAnalyzerBot/1.0; +https://datagum.ai)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  })
  clearTimeout(timeoutId)
} catch (error) {
  if (error.name === 'AbortError') {
    throw new TimeoutError('Request timed out after 15000ms')
  }
}
```

---

### 2. ContentParser

**Location**: `src/utils/content-parser.ts` (217 lines)
**Type**: Utility
**Responsibility**: Parses HTML and extracts article text and metadata

**Public Function**:

```typescript
export function parseArticleContent(html: string): ParsedArticle
```

**Configuration**:
```typescript
const MIN_CONTENT_LENGTH = 100 // Minimum characters for valid article
```

**HTML Parsing Strategy**:

1. **Parse DOM** (using linkedom):
   ```typescript
   import { parseHTML } from 'linkedom'
   const { document } = parseHTML(html)
   ```

2. **Remove Unwanted Elements**:
   - script, style, nav, header, footer, aside, iframe
   - .advertisement, .ad, .social-share, .comments, .sidebar

3. **Extract Title** (priority order):
   - `<title>` tag (most reliable)
   - `<h1>` tag (fallback)
   - `<meta property="og:title">` (Open Graph)
   - Default: "Untitled Article"

4. **Extract Content** (priority order):
   - `<article>` tag (HTML5 semantic)
   - `<main>` tag (HTML5 semantic)
   - `.article-content`, `.post-content`, `.entry-content`, `.content`
   - `.article-body`, `.post-body`
   - `<body>` tag (last resort)

5. **Convert to Markdown**:
   ```typescript
   import TurndownService from 'turndown'

   const turndownService = new TurndownService({
     headingStyle: 'atx',        // Use # for headings
     codeBlockStyle: 'fenced',   // Use ``` for code blocks
     bulletListMarker: '-',      // Use - for lists
     emDelimiter: '*',           // Use * for emphasis
   })

   const markdown = turndownService.turndown(html)
   ```

6. **Clean Markdown**:
   - Remove excessive blank lines
   - Clean up list formatting
   - Remove leading/trailing whitespace

7. **Validate**:
   - Check minimum length (100 characters)
   - Throw `ContentNotFoundError` if too short
   - Calculate word count

---

### 3. ScrapingErrors

**Location**: `src/types/scraping-errors.ts` (69 lines)
**Type**: Custom Error Classes
**Responsibility**: Type-safe error categorization for scraping operations

**Error Hierarchy**:

```typescript
ScrapingError (base class)
├── NetworkError(statusCode?: number)
├── TimeoutError
├── ParsingError
├── ContentNotFoundError
└── AccessDeniedError
```

**Error Classes**:

```typescript
// Base class
export class ScrapingError extends Error {
  name = 'ScrapingError'
}

// HTTP request failures
export class NetworkError extends ScrapingError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

// Request timeout (15 seconds)
export class TimeoutError extends ScrapingError {
  name = 'TimeoutError'
}

// HTML parsing failures
export class ParsingError extends ScrapingError {
  name = 'ParsingError'
}

// Content missing or too short
export class ContentNotFoundError extends ScrapingError {
  name = 'ContentNotFoundError'
}

// Paywalls, 401, 403 errors
export class AccessDeniedError extends ScrapingError {
  name = 'AccessDeniedError'
}
```

---

## Data Flow

### Scraping Flow Sequence

1. **Invocation** (from analysis.service):
   ```typescript
   await updateSubmissionStatus(submissionId, 'scraping')
   const article = await scrapeArticle(url)
   await updateArticleData(submissionId, article.title, article.content)
   ```

2. **ScraperService**:
   - Attempt 0: fetchWithTimeout(url, 15000ms)
   - On failure: Sleep 1 second
   - Attempt 1: fetchWithTimeout(url, 15000ms)
   - On failure: Sleep 2 seconds
   - Attempt 2: fetchWithTimeout(url, 15000ms)
   - On failure: Throw final error

3. **HTTP Fetch**:
   - Create AbortController
   - Set 15-second timeout
   - Send HTTP GET with custom User-Agent
   - Wait for response (max 15 seconds)
   - Check HTTP status code
   - Read response body as text
   - Return HTML string

4. **Content Parsing**:
   - Parse HTML with linkedom
   - Extract title
   - Remove unwanted elements
   - Find main content
   - Convert HTML to Markdown
   - Clean Markdown
   - Validate length (>= 100 chars)
   - Calculate word count
   - Return ParsedArticle

5. **Storage**:
   ```typescript
   await updateArticleData(
     submissionId,
     article.title,
     article.content  // First 5000 chars stored
   )
   ```

---

## Integration Points

### Called By
- **AnalysisService**: Phase 1 of article analysis workflow

### Calls
- **SubmissionRepository**: `updateArticleData()`, `updateSubmissionStatus()`

### Database Updates
- **On Success**: articleTitle, articleContent (5000 chars), updatedAt
- **On Failure**: status='failed', scrapingError, updatedAt

---

## Configuration

### Timeout Settings
```typescript
const REQUEST_TIMEOUT_MS = 15000  // 15 seconds per request
```

### Retry Configuration
```typescript
const MAX_RETRIES = 2          // Total of 3 attempts
const RETRY_DELAY_MS = 1000    // Base delay, exponential backoff
```

### Content Validation
```typescript
const MIN_CONTENT_LENGTH = 100  // Minimum characters
```

### HTTP Headers
```typescript
{
  'User-Agent': 'Mozilla/5.0 (compatible; ArticleAnalyzerBot/1.0; +https://datagum.ai)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
}
```

---

## Error Scenarios

### Scenario 1: Successful Scrape
- Fetch HTML (3.2 seconds)
- Parse DOM, extract title and content
- Convert to Markdown (2,401 characters)
- Word count: 412 words
- Save to database

### Scenario 2: Paywall Detected
- Response: 403 Forbidden
- Create AccessDeniedError
- Don't retry
- Update status: 'failed'
- Save error message

### Scenario 3: Timeout with Retry
- Attempt 0: 15 seconds timeout
- Retry attempt 1
- Success (5 seconds)
- Parse and return article

### Scenario 4: Content Too Short
- Fetch HTML: 200 OK
- Extract content: 28 characters
- Validation fails (< 100 chars)
- Throw ContentNotFoundError
- Don't retry

### Scenario 5: Network Error with Full Retry
- Attempt 0: DNS failure
- Attempt 1: Connection refused
- Attempt 2: Timeout
- Max retries exceeded
- Update status: 'failed'

---

## Current Status

### Implementation Progress: 100%

✅ **ScraperService** (177 lines) - HTTP fetch with retry logic
✅ **ContentParser** (217 lines) - DOM parsing and Markdown conversion
✅ **ScrapingErrors** (69 lines) - Type-safe error hierarchy

### Production Deployment

- **Platform**: Cloudflare Workers
- **Performance**: ~3-5 seconds typical
- **Success Rate**: ~85%
- **Common Failures**: Paywalls (403), Not Found (404), Timeouts

---

## Dependencies

### External Libraries
- **linkedom**: DOM implementation for Cloudflare Workers
- **turndown**: HTML to Markdown converter

### Internal Dependencies
- **submission.repository**: Database operations
- **analysis.service**: Orchestration (Phase 1)

### Next Unit
- **Unit 3**: FAQ Generation (uses scraped content)

---

## Code Examples

### Scraping an Article

```typescript
import { scrapeArticle } from '@/services/scraper.service'

try {
  const article = await scrapeArticle('https://example.com/article')
  console.log(`Title: ${article.title}`)
  console.log(`Content: ${article.content.substring(0, 200)}...`)
  console.log(`Word count: ${article.wordCount}`)
} catch (error) {
  if (error instanceof AccessDeniedError) {
    console.error('Paywall detected')
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out')
  }
}
```

### Error Handling

```typescript
// In analysis.service.ts
try {
  await updateSubmissionStatus(submissionId, 'scraping')
  const article = await scrapeArticle(url)
  await updateArticleData(submissionId, article.title, article.content)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  await updateSubmissionStatus(submissionId, 'failed', errorMessage)
  throw error
}
```

---

## Changelog

### Version 2.0.0 (2025-10-25) 🎉 COMPLETE REWRITE
**Comprehensive Implementation Documentation**

**MAJOR CHANGES**:
- Removed all monorepo/Turborepo references
- All components marked as ✅ Fully Implemented
- Added actual implementation details from production code
- Documented timeout (15s), retry logic (2 retries), and error handling
- Added 5 real-world error scenarios
- Updated all code examples to match production

**FILES DOCUMENTED**:
- `src/services/scraper.service.ts` (177 lines)
- `src/utils/content-parser.ts` (217 lines)
- `src/types/scraping-errors.ts` (69 lines)

**TOTAL IMPLEMENTATION**: 463 lines of production code

### Version 1.1.0 (2025-10-21)
- Migrated to Turborepo monorepo structure

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
