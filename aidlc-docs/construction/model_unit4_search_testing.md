# Domain Model: Unit 4 - AI Search Visibility Testing

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Epic**: Epic 4 - AI Search Visibility Testing
**User Stories**: US-4.1, US-4.2, US-4.3, US-4.4, US-4.5
**Status**: In-Progress

---

## Executive Summary

This domain model defines the components required to test generated questions through OpenAI's Responses API with web search capabilities. The system executes each question, parses citations and sources, determines if the target article appears, and identifies competing domains. This is the core analysis engine of the Article Analyzer.

### Key Business Requirements
- Execute each question through OpenAI Responses API with web_search tool
- Parse search results to extract sources and citations
- Determine if target URL appears in sources (retrieved but not cited)
- Determine if target URL appears in citations (actually cited in answer)
- Track citation tiers: Found in Sources vs Found in Citations
- Identify competing domains that ranked instead
- Handle OpenAI rate limits and API errors
- Store individual test results for each question

### Related User Stories
- **US-4.1**: Execute Search Queries
- **US-4.2**: Parse Search Results
- **US-4.3**: Track Citation Tiers
- **US-4.4**: Competitor Identification
- **US-4.5**: Rate Limit Handling

---

## Component Overview

### 1. SearchTesterService
**Type**: Service
**Responsibility**: Orchestrates AI search testing for all generated questions

**Attributes**:
- `openAIClient`: OpenAI API client instance
- `delayBetweenRequests`: number - Milliseconds between tests (1000)
- `maxRetries`: number - Retry attempts per question (3)

**Behaviors**:
- `testAllQuestions(questions, targetURL, submissionId)`: TestResults[] - Main entry point
- `testSingleQuestion(question, targetURL)`: TestResult - Tests one question
- `addDelay()`: Promise<void> - Waits between requests
- `retryOnFailure(testFn, maxRetries)`: TestResult - Implements retry logic
- `aggregateResults(results)`: Summary - Calculates summary statistics

**Input**:
- `questions`: string[] - Generated questions from Unit 3
- `targetURL`: string - Article URL to check for
- `submissionId`: UUID - For storing results

**Output Type - TestResult**:
- `question`: string - The tested question
- `targetUrlFound`: boolean - Overall found status
- `foundInSources`: boolean - Found in web search sources
- `foundInCitations`: boolean - Actually cited in answer
- `allCitations`: CitationInfo[] - All citations in response
- `allSources`: SourceInfo[] - All sources retrieved
- `responseTimeMs`: number - Time taken for API call
- `createdAt`: Date - Timestamp

**Interactions**:
- Uses `SearchExecutor` to call OpenAI API
- Uses `ResponseParser` to extract citations/sources
- Uses `URLMatcher` to detect target URL
- Uses `CompetitorAnalyzer` to identify competing domains
- Uses `ResultsRepository` to store individual results
- Called by background job processor (Unit 6)

---

### 2. SearchExecutor
**Type**: API Integration Service
**Responsibility**: Executes search queries through OpenAI Responses API

**Attributes**:
- `apiKey`: string - OpenAI API key
- `model`: string - 'gpt-5'
- `timeout`: number - Request timeout (30000ms)

**Behaviors**:
- `executeSearch(query)`: SearchResponse - Calls Responses API
- `buildSearchConfig(query)`: RequestConfig - Constructs API config
- `measureResponseTime(startTime)`: number - Calculates duration
- `handleAPIError(error)`: SearchResponse - Formats error response

**API Configuration**:
```
{
  model: 'gpt-5',
  input: query,
  tools: [{ type: 'web_search' }],
  reasoning: { effort: 'low' },
  include: ['web_search_call.action.sources']
}
```

**API Components**:
- **model**: 'gpt-5' - Latest model with search capabilities
- **input**: The user's search question
- **tools**: Enables web_search tool for live web results
- **reasoning.effort**: 'low' - Faster responses, less detailed reasoning
- **include**: Specifies which response parts to include

**Response Structure** (OpenAI Responses API):
```
{
  id: string
  model: string
  output: Array<OutputItem> | Object
  // OutputItem can be:
  // - { type: 'web_search_call', action: { sources: [...] } }
  // - { type: 'message', content: [...] }
}
```

**Interactions**:
- Called by `SearchTesterService.testSingleQuestion()`
- Returns raw API response for parsing

---

### 3. ResponseParser
**Type**: Utility Component
**Responsibility**: Parses OpenAI Responses API output to extract citations and sources

**Attributes**:
- `citationType`: string - 'url_citation'
- `webSearchType`: string - 'web_search_call'
- `messageType`: string - 'message'

**Behaviors**:
- `parseSearchResponse(response, targetURL)`: ParsedResult - Main parser
- `extractSources(response)`: SourceInfo[] - Gets all sources from web_search_call
- `extractCitations(response)`: CitationInfo[] - Gets all citations from message annotations
- `normalizeOutputItems(output)`: OutputItem[] - Handles array or object output

**Parse Logic - Sources**:
1. Normalize `response.output` to array (may be object)
2. Find items with `type === 'web_search_call'`
3. Extract `item.action.sources` array
4. Each source may be string or object `{ url: string }`
5. Clean URLs (remove query params and fragments)
6. Return array of SourceInfo objects

**Parse Logic - Citations**:
1. Find items with `type === 'message'`
2. Iterate through `item.content` array
3. Look for `contentItem.annotations`
4. Filter annotations where `type === 'url_citation'`
5. Extract citation URL, title, start/end indexes
6. Clean URLs
7. Return array of CitationInfo objects

**Output Type - ParsedResult**:
- `allSources`: SourceInfo[] - All retrieved sources
- `allCitations`: CitationInfo[] - All citations in answer
- `foundInSources`: boolean - Target found in sources
- `foundInCitations`: boolean - Target found in citations

**Data Structures**:

**SourceInfo**:
- `url`: string - Clean source URL
- `raw`: any - Original source object

**CitationInfo**:
- `url`: string - Clean citation URL
- `title`: string | undefined - Citation title
- `startIndex`: number | undefined - Position in text
- `endIndex`: number | undefined - End position in text

**Interactions**:
- Called by `SearchTesterService` with raw API response
- Uses `URLMatcher` to detect target URL

---

### 4. URLMatcher
**Type**: Utility Component
**Responsibility**: Determines if a citation/source URL matches the target article URL

**Attributes**:
- None (stateless utility)

**Behaviors**:
- `matchesTarget(citationURL, targetURL)`: boolean - Main matching logic
- `cleanURL(url)`: string - Removes query params and fragments
- `extractCreativeID(url)`: string | null - Extracts ID from /creatives/{id} pattern
- `checkExactMatch(url1, url2)`: boolean - Direct comparison
- `checkCreativeMatch(citation, target, creativeId)`: boolean - Pattern matching

**Matching Logic**:

1. **Clean URLs**:
   - Remove query parameters (`?...`)
   - Remove URL fragments (`#...`)
   - Trim whitespace
   - Convert to lowercase for comparison

2. **Exact Match**:
   - Compare cleaned citation URL with cleaned target URL
   - If identical, return true

3. **Creative ID Match** (Special case):
   - Extract creative ID from target URL pattern: `/creatives/{id}`
   - If citation URL contains `/creatives/{same-id}`, return true
   - This handles different base domains pointing to same content

4. **No Match**:
   - Return false if neither match succeeds

**Example Matching**:
- Target: `https://example.com/article?utm_source=fb`
- Citation: `https://example.com/article#section1`
- Cleaned: Both become `https://example.com/article`
- **Result**: Match ✓

- Target: `https://example.com/creatives/12345`
- Citation: `https://cdn.example.com/creatives/12345`
- Creative ID: `12345`
- **Result**: Match ✓ (same creative ID)

**Interactions**:
- Called by `ResponseParser` for each source/citation
- Used to populate `foundInSources` and `foundInCitations` flags

---

### 5. CompetitorAnalyzer
**Type**: Utility Component
**Responsibility**: Identifies competing domains from citation results

**Attributes**:
- None (stateless utility)

**Behaviors**:
- `analyzeCompetitors(citations, targetURL)`: CompetitorInfo[] - Main analyzer
- `extractDomain(url)`: string - Gets hostname from URL
- `aggregateDomainCounts(domains)`: Map<string, number> - Counts frequencies
- `filterTargetDomain(domains, targetDomain)`: string[] - Removes target
- `sortByFrequency(domainCounts)`: CompetitorInfo[] - Orders by count

**Analysis Logic**:

1. **Extract Domains**:
   - For each citation, parse URL to get hostname
   - Example: `https://competitor.com/article` → `competitor.com`

2. **Filter Target**:
   - Extract domain from target URL
   - Remove target domain from competitor list
   - Only count other domains

3. **Aggregate Counts**:
   - Count how many times each domain appears
   - Store as Map: `{ domain → count }`

4. **Sort by Frequency**:
   - Convert to array of `{ domain, count }`
   - Sort descending by count
   - Return top competitors

**Output Type - CompetitorInfo**:
- `domain`: string - Competitor domain (e.g., "nytimes.com")
- `count`: number - How many times cited across all questions
- `percentage`: number - Percentage of total citations

**Interactions**:
- Called after all questions tested
- Used for results summary and UI display

---

### 6. ResultsRepository
**Type**: Data Access Layer
**Responsibility**: Stores individual question test results in database

**Attributes**:
- `db`: DrizzleORM database instance
- `resultsTable`: Database table schema

**Behaviors**:
- `saveResult(result, submissionId)`: void - Inserts single result
- `saveAllResults(results, submissionId)`: void - Batch insert
- `getResultsBySubmission(submissionId)`: TestResult[] - Retrieves all results

**Data Entity: AnalysisResult**:
- `id`: number - Auto-increment primary key
- `submissionId`: UUID - Foreign key to submission
- `question`: string - The tested question
- `targetUrlFound`: boolean - Overall found status
- `foundInSources`: boolean - Found in sources list
- `foundInCitations`: boolean - Found in answer citations
- `allCitations`: JSONB - Array of CitationInfo objects
- `allSources`: JSONB - Array of source URLs
- `responseTimeMs`: number - API call duration
- `createdAt`: timestamp - Auto-set

**Database Constraints**:
- Primary key: id
- Foreign key: submissionId references content_analysis_submissions(id) ON DELETE CASCADE
- Index on: submissionId (for retrieval)
- Index on: targetUrlFound (for analytics)

**Interactions**:
- Called by `SearchTesterService` after each question tested
- Called by Unit 5 (Results Display) to retrieve results

---

## Component Interactions

### Search Testing Flow Sequence

1. **Job Processor Initiates Testing**:
   - Background job processor calls `SearchTesterService.testAllQuestions(questions, targetURL, submissionId)`
   - Receives 10 questions from Unit 3
   - Receives target URL from submission record

2. **Iterate Through Questions**:
   - For each question in array:

3. **Execute Single Question**:
   - Call `SearchTesterService.testSingleQuestion(question, targetURL)`
   - Start timer for response time tracking

4. **Call OpenAI API**:
   - `SearchExecutor.executeSearch(question)`
   - Build API configuration with web_search tool
   - Send request to OpenAI Responses API
   - Wait for response (typically 5-15 seconds)

5. **Parse Response**:
   - `ResponseParser.parseSearchResponse(response, targetURL)`
   - Extract sources from web_search_call items
   - Extract citations from message annotations

6. **Match URLs**:
   - For each source:
     - Call `URLMatcher.matchesTarget(sourceURL, targetURL)`
     - If match found, set `foundInSources = true`
   - For each citation:
     - Call `URLMatcher.matchesTarget(citationURL, targetURL)`
     - If match found, set `foundInCitations = true`

7. **Calculate Response Time**:
   - `SearchExecutor.measureResponseTime(startTime)`
   - Store in result object

8. **Save Individual Result**:
   - `ResultsRepository.saveResult(result, submissionId)`
   - Insert into database

9. **Rate Limit Delay**:
   - `SearchTesterService.addDelay()`
   - Wait 1 second before next question
   - Prevents API rate limiting

10. **Repeat for All Questions**:
    - Continue loop until all 10 questions tested

11. **Analyze Competitors** (After all questions):
    - Collect all citations from all results
    - `CompetitorAnalyzer.analyzeCompetitors(allCitations, targetURL)`
    - Identify top competing domains

12. **Return to Job Processor**:
    - All individual results saved in database
    - Job processor can mark submission as completed

### Error Handling Flow

**API Rate Limit (429)**:
- `SearchExecutor` receives 429 status from OpenAI
- Throw `RateLimitError`
- `SearchTesterService.retryOnFailure()` catches
- Wait with exponential backoff (2s, 4s, 8s)
- Retry up to 3 times
- If still failing, save result with error flag

**API Timeout**:
- Request exceeds 30-second timeout
- `SearchExecutor` throws `TimeoutError`
- Save result with zero citations/sources
- Mark as failed but continue with other questions
- Don't retry (timeouts usually persist)

**Invalid Response Structure**:
- `ResponseParser` receives unexpected format
- Log warning with response structure
- Return empty sources/citations
- Save result as "no match found"
- Continue processing

**Network Error**:
- Connection to OpenAI fails
- `SearchExecutor` throws `NetworkError`
- Retry up to 3 times
- If still failing, save error result
- Continue with remaining questions

**Partial Success**:
- Some questions succeed, others fail
- Save all successful results
- Save failed results with error flag
- Submission still marked as "completed"
- User sees partial results

---

## Data Flow

### Input Data
- **Source**: Generated questions from Unit 3
- **Format**: Array of strings (10 questions)
- **Target URL**: From submission record

### API Request Data
- **Per Question**:
  - Model: 'gpt-5'
  - Input: One question string
  - Tools: web_search enabled
  - Estimated tokens: 50-200 input, 500-2000 output

### API Response Data
- **Structure**: OpenAI Responses API format
- **Contains**:
  - Web search sources (URLs retrieved)
  - Message content (AI-generated answer)
  - URL citations (annotated sources in answer)

### Stored Data
- **Destination**: `content_analysis_results` table
- **Per Question**: One row with:
  - Question text
  - Found flags (sources, citations)
  - All citations (JSONB)
  - All sources (JSONB)
  - Response time

### Output Data
- **For Job Processor**:
  - Array of TestResult objects
  - Competitor analysis summary
- **For Results Display** (Unit 5):
  - Retrieved from database by submissionId

---

## Environment Considerations

### Cloudflare Workers Constraints
- Request timeout: 30 seconds (must complete API call within this)
- CPU time limits: API calls are I/O, don't count against CPU
- Memory: Response objects typically < 10MB

### OpenAI API Limits
- **Rate Limits**: Varies by tier (typically 500 requests/min)
- **Timeout**: Set to 30 seconds to match Workers limit
- **Concurrent Requests**: Process sequentially (1 at a time)

### Environment Variables
- **OPENAI_API_KEY**: Required for API access

### Performance Targets
- Per question API call: 5-15 seconds
- Total for 10 questions: 60-180 seconds (including delays)
- Database writes: < 100ms per result

### Cost Estimates
- **Per Question**: ~$0.02-0.05 (GPT-5 + search)
- **Per Article** (10 questions): ~$0.20-0.50
- **Monthly** (1000 articles): ~$200-500

---

## Dependencies

### External Services
- **OpenAI Responses API**: GPT-5 with web_search tool
- **Internet Connection**: Required for API calls

### External Libraries
- **openai** (npm package): Official SDK

### Internal Dependencies
- **Unit 3**: Requires generated questions
- **Unit 6**: Called by background job processor

### Next Unit
- **Unit 5**: Results Display (consumes stored test results)

---

## Security Considerations

### API Key Management
- Never expose API key client-side
- Store in environment variables only
- Use Cloudflare secrets in production

### Query Content Security
- Questions generated by GPT-4 (trusted source)
- No user-generated query content
- No injection risk

### Response Data Security
- Responses contain public web URLs
- No sensitive data expected
- Store as-is in database (JSONB)

---

## Testing Considerations

### Unit Tests
- **URLMatcher**: Test various URL formats and matching logic
- **ResponseParser**: Test with mock API responses
- **CompetitorAnalyzer**: Test domain extraction and counting

### Integration Tests
- **Search Execution**: Test with real OpenAI API
- **End-to-End**: Test full flow with sample article
- **Error Handling**: Test retry logic and error scenarios

### Test Scenarios
- Target URL found in sources only
- Target URL found in citations only
- Target URL found in both
- Target URL not found at all
- Competing domains identified correctly
- Rate limit handling
- API timeout handling

---

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 6 core components for search testing
- Documented OpenAI Responses API integration
- Specified GPT-5 model with web_search tool
- Defined URL matching logic (exact + creative ID)
- Mapped to user stories US-4.1 through US-4.5
- Included cost estimates and rate limit handling
- Defined three-tier citation tracking (sources vs citations)
