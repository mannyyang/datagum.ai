# Domain Model: Unit 2 - Article Content Extraction

**Version**: 1.1.0
**Last Updated**: 2025-10-21
**Epic**: Epic 2 - Article Content Extraction
**User Stories**: US-2.1, US-2.2, US-2.3, US-2.4, US-2.5
**Status**: ⚠️ In-Progress (Turborepo Monorepo - apps/queue-worker)

---

## Executive Summary

This domain model defines the components required to scrape and extract content from submitted article URLs. The scraper fetches HTML, extracts title, main content, and headings, then stores the extracted data in the submission record. This unit is called by the background job processor after a submission is created.

### Key Business Requirements
- Fetch HTML content from article URL
- Extract article title (from meta tags or h1/title)
- Extract main article content (paragraphs and headings)
- Extract structural headings (h1-h6)
- Handle errors gracefully (network issues, paywalls, 404s)
- Store extracted content in submission record

### Related User Stories
- **US-2.1**: HTML Content Fetching
- **US-2.2**: Article Title Extraction
- **US-2.3**: Article Content Extraction
- **US-2.4**: Heading Extraction
- **US-2.5**: Error Handling for Scraping

---

## Component Overview

### 1. ArticleScraperService ⚠️
**Type**: Service
**Location**: `apps/queue-worker/src/services/article-scraper.ts` (to be implemented)
**Responsibility**: Orchestrates article content extraction from URLs

**Implementation Status**: ⚠️ Pending implementation

**Attributes**:
- `userAgent`: string - User agent for HTTP requests
- `timeout`: number - Request timeout in milliseconds (10000)
- `maxContentLength`: number - Maximum content to store (5000 chars)

**Behaviors**:
- `scrapeArticle(url: string)`: ScrapedArticle - Main entry point
- `buildHTTPHeaders()`: Object - Constructs request headers
- `handleScrapingError(error)`: ScrapedArticle - Formats error response

**Return Type - ScrapedArticle**:
- `url`: string - Original URL
- `title`: string - Extracted title
- `content`: string - Main article content
- `headings`: string[] - Array of h1-h6 headings
- `metaDescription`: string | null - Meta description if available
- `author`: string | null - Author if available
- `publishedDate`: string | null - Publish date if available
- `error`: string | null - Error message if scraping failed

**Interactions**:
- Uses `HTMLFetcherService` to get raw HTML
- Uses `HTMLParserService` to parse and extract content
- Called by background job processor (Unit 6)
- Results stored via `SubmissionRepository`

---

### 2. HTMLFetcherService ⚠️
**Type**: Service
**Location**: `apps/queue-worker/src/services/html-fetcher.ts` (to be implemented)
**Responsibility**: Fetches raw HTML content from URLs

**Implementation Status**: ⚠️ Pending implementation

**Attributes**:
- `timeout`: number - Request timeout (10000ms)
- `maxRedirects`: number - Maximum redirects to follow (5)
- `userAgent`: string - Browser-like user agent string

**Behaviors**:
- `fetchHTML(url: string)`: string - Fetches and returns HTML
- `validateResponse(response)`: void - Checks HTTP status
- `handleHTTPError(status, statusText)`: never - Throws descriptive error
- `setRequestHeaders()`: Headers - Creates fetch headers

**Error Scenarios**:
- **Network Error**: Timeout or connection refused
- **HTTP 404**: Page not found
- **HTTP 403/401**: Access denied or paywall
- **HTTP 500**: Server error
- **HTTP 3xx**: Redirect (handled automatically up to maxRedirects)

**Interactions**:
- Called by `ArticleScraperService`
- Returns raw HTML string or throws error
- Uses native `fetch` API (available in Cloudflare Workers)

---

### 3. HTMLParserService ⚠️
**Type**: Service
**Location**: `apps/queue-worker/src/services/html-parser.ts` (to be implemented)
**Responsibility**: Parses HTML and extracts structured content

**Implementation Status**: ⚠️ Pending implementation (will use jsdom for HTML parsing)

**Attributes**:
- `cheerio`: Library instance for HTML parsing
- `unwantedSelectors`: string[] - Elements to remove
- `articleSelectors`: string[] - Priority selectors for article content

**Behaviors**:
- `parseHTML(html: string)`: CheerioInstance - Loads HTML for parsing
- `extractTitle(parsedHTML)`: string - Extracts title
- `extractContent(parsedHTML)`: string - Extracts main content
- `extractHeadings(parsedHTML)`: string[] - Extracts h1-h6
- `extractMetaDescription(parsedHTML)`: string | null - Gets meta description
- `cleanHTML(parsedHTML)`: void - Removes unwanted elements

**Interactions**:
- Called by `ArticleScraperService` with HTML string
- Uses cheerio library for DOM traversal
- Returns extracted content components

---

### 4. TitleExtractor
**Type**: Utility Component
**Responsibility**: Extracts article title using priority selectors

**Attributes**:
- `titleSelectors`: SelectorConfig[] - Priority-ordered selectors

**SelectorConfig Structure**:
- `selector`: string - CSS selector
- `attribute`: string | null - Attribute to read (or text content)
- `priority`: number - Higher = checked first

**Priority Order**:
1. `meta[property="og:title"]` (Open Graph)
2. `meta[name="twitter:title"]` (Twitter Card)
3. `h1` (First H1 tag)
4. `title` (HTML title tag)

**Behaviors**:
- `extract(parsedHTML)`: string - Returns first non-empty title found
- `trySelector(parsedHTML, config)`: string | null - Attempts one selector
- `cleanTitle(title)`: string - Trims and normalizes title text

**Interactions**:
- Called by `HTMLParserService.extractTitle()`
- Iterates through selectors until match found

---

### 5. ContentExtractor
**Type**: Utility Component
**Responsibility**: Extracts main article body content

**Attributes**:
- `unwantedTags`: string[] - Tags to remove (script, style, nav, etc.)
- `articleSelectors`: string[] - Selectors for article containers
- `minContentLength`: number - Minimum viable content length (100)

**Article Selector Priority**:
1. `article` tag
2. `[role="main"]` attribute
3. `.article-content` class
4. `.post-content` class
5. `.entry-content` class
6. `main` tag

**Behaviors**:
- `extract(parsedHTML)`: string - Returns article content
- `removeUnwantedElements(parsedHTML)`: void - Cleans HTML
- `tryArticleSelector(parsedHTML, selector)`: string | null - Tries one selector
- `extractParagraphsAndHeadings(element)`: string[] - Gets text content
- `fallbackExtraction(parsedHTML)`: string - Gets all paragraphs if no article tag
- `joinContent(paragraphs)`: string - Joins with double newlines

**Content Extraction Logic**:
- Remove unwanted elements (scripts, styles, ads)
- Try each article selector in priority order
- For matching container, extract p, h1, h2, h3, h4, h5, h6 tags
- Filter out short paragraphs (< 10 chars)
- Join paragraphs with `\n\n` separator
- If content length > 100, return it
- Otherwise, try next selector
- Fallback: extract all `<p>` tags from entire document

**Interactions**:
- Called by `HTMLParserService.extractContent()`
- Returns plain text content string

---

### 6. HeadingExtractor
**Type**: Utility Component
**Responsibility**: Extracts all heading tags for structure analysis

**Attributes**:
- `headingSelectors`: string - 'h1, h2, h3, h4, h5, h6'
- `maxHeadingLength`: number - Maximum chars per heading (200)
- `minHeadingLength`: number - Minimum chars per heading (1)

**Behaviors**:
- `extract(parsedHTML)`: string[] - Returns array of heading texts
- `filterHeading(text)`: boolean - Validates heading text
- `cleanHeading(text)`: string - Trims whitespace

**Extraction Logic**:
- Select all h1-h6 elements
- Extract text content from each
- Trim whitespace
- Filter out empty headings
- Filter out headings > 200 characters (likely errors)
- Return as array of strings

**Interactions**:
- Called by `HTMLParserService.extractHeadings()`
- Used for question generation context

---

## Component Interactions

### Scraping Flow Sequence

1. **Job Processor Calls Scraper**:
   - Background job processor (Unit 6) calls `ArticleScraperService.scrapeArticle(url)`

2. **Fetch HTML**:
   - `ArticleScraperService` calls `HTMLFetcherService.fetchHTML(url)`
   - `HTMLFetcherService` makes HTTP request with timeout
   - Returns raw HTML string or throws error

3. **Parse HTML**:
   - `ArticleScraperService` calls `HTMLParserService.parseHTML(html)`
   - Creates cheerio instance for DOM traversal

4. **Extract Title**:
   - `HTMLParserService` calls `TitleExtractor.extract(parsedHTML)`
   - `TitleExtractor` tries selectors in priority order
   - Returns first non-empty title or empty string

5. **Extract Content**:
   - `HTMLParserService` calls `ContentExtractor.extract(parsedHTML)`
   - `ContentExtractor` removes unwanted elements
   - Tries article selectors in priority order
   - Returns main content text

6. **Extract Headings**:
   - `HTMLParserService` calls `HeadingExtractor.extract(parsedHTML)`
   - Returns array of all h1-h6 text content

7. **Extract Metadata** (Optional):
   - Extract meta description from `meta[name="description"]`
   - Extract author from `meta[name="author"]` or article metadata
   - Extract publish date from `time[datetime]` or meta tags

8. **Return Scraped Article**:
   - `ArticleScraperService` constructs `ScrapedArticle` object
   - Returns to job processor

9. **Store in Database**:
   - Job processor calls `SubmissionRepository.updateSubmission()`
   - Stores `articleTitle`, `articleContent` (first 5000 chars), `scrapingError`

### Error Handling Flow

**Network/Fetch Error**:
- `HTMLFetcherService` throws error
- `ArticleScraperService.handleScrapingError()` catches
- Returns `ScrapedArticle` with empty fields and error message
- Job processor stores error in `scrapingError` field
- Submission status set to 'failed'

**Parsing Error** (No Content Found):
- `ContentExtractor` returns empty string or short content
- `ArticleScraperService` checks content length
- If < 100 chars, treat as error
- Return `ScrapedArticle` with error: "Could not extract article content"

**Paywall/Access Denied (403/401)**:
- `HTMLFetcherService` detects HTTP 403/401
- Throw specific error: "Article is behind paywall or requires authentication"
- User sees clear message about access restrictions

---

## Data Flow

### Input
- **Source**: Submission record URL
- **Format**: String (validated HTTP/HTTPS URL)
- **Provided by**: Background job processor

### Processing
- HTTP fetch with 10-second timeout
- HTML parsing with cheerio
- Content extraction with priority selectors
- Text normalization and cleanup

### Output
- **Destination**: Submission record in database
- **Fields Updated**:
  - `articleTitle`: string
  - `articleContent`: string (first 5000 chars)
  - `scrapingError`: string | null

### Success Criteria
- Title extracted (non-empty)
- Content extracted (>= 100 characters)
- At least 1 heading extracted

### Failure Scenarios
- HTTP error (404, 403, 500, timeout)
- No parseable content found
- Content too short (< 100 chars)

---

## Dependencies

### External Libraries
- **cheerio**: HTML parsing and DOM traversal
  - Lightweight jQuery-like library for Node.js
  - Enables CSS selector-based extraction
  - Works in Cloudflare Workers environment

### External Services
- **Target Article Website**: Must be publicly accessible

### Internal Dependencies
- **Unit 1**: Submission record must exist with valid URL
- **Unit 6**: Called by background job processor

### Next Unit
- **Unit 3**: AI Question Generation (consumes extracted content)

---

## Environment Considerations

### Cloudflare Workers
- Uses native `fetch` API (available in Workers)
- Cheerio library must be compatible with Workers runtime
- No filesystem access (all processing in-memory)
- 10-second timeout for fetch operations
- CPU time limits apply to parsing

### Performance
- Target scraping time: < 5 seconds per article
- HTML parsing: < 1 second
- Memory usage: < 50MB per scrape

### Error Rate Expectations
- ~5-10% of URLs may fail (paywalls, 404s, malformed HTML)
- Failures should not crash job processor
- Failed scrapes stored with error message for user feedback

---

## Security Considerations

### SSRF Prevention
- URL validation performed in Unit 1 before scraping
- Private IPs and localhost blocked at submission
- No additional SSRF protection needed here

### Content Safety
- Extract only text content (no scripts, iframes)
- Remove potentially malicious elements
- No JavaScript execution during parsing
- Limit content storage (5000 chars prevents storage abuse)

### Rate Limiting
- No rate limiting within scraper (handled at submission level)
- Consider implementing request caching for repeated URLs (future enhancement)

---

## Error Messages

### User-Facing Errors
- **Network timeout**: "Could not fetch article. The website may be down or took too long to respond."
- **404 Not Found**: "Article not found. Please check the URL and try again."
- **403/401 Paywall**: "This article appears to be behind a paywall or requires authentication."
- **No content**: "Could not extract article content. The page may not be a standard article format."
- **Generic error**: "An error occurred while fetching the article. Please try a different URL."

### Internal Error Logging
- Log full error stack trace
- Log URL that failed
- Log HTTP status code if applicable
- Track error types for monitoring

---

## Testing Considerations

### Unit Tests
- **TitleExtractor**: Test all priority selectors
- **ContentExtractor**: Test with various HTML structures
- **HeadingExtractor**: Test heading extraction and filtering
- **HTMLFetcherService**: Mock HTTP responses (success, errors)

### Integration Tests
- Test with real article URLs from major publishers
- Test with paywalled content
- Test with malformed HTML
- Test with non-article pages (e.g., homepage)

### Test URLs for Validation
- Standard blog post (Medium, WordPress)
- News article (CNN, NYTimes)
- Technical documentation
- Paywalled content
- 404 page
- Redirect chain

---

## Changelog

### Version 1.1.0 (2025-10-21)
**Turborepo Monorepo Migration**

- **UPDATED**: Migrated to Turborepo monorepo structure (`apps/queue-worker`)
- **UPDATED**: All components now specify location in `apps/queue-worker/src/services/`
- **UPDATED**: Status indicators added (⚠️ all pending implementation)
- **CLARIFIED**: Services will run in queue worker context (called by JobOrchestrator)
- **NOTE**: Will use jsdom for HTML parsing instead of cheerio (better Cloudflare Workers compatibility)
- Implementation status: Pending - queue infrastructure ready to call these services

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 6 core components for content extraction
- Documented scraping flow and error handling
- Mapped to user stories US-2.1 through US-2.5
- Specified cheerio as parsing library
- Defined priority-based extraction strategies
