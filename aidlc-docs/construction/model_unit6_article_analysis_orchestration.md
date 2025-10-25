# Domain Model: Unit 6 - Article Analysis Orchestration

**Version**: 4.0.0
**Last Updated**: 2025-10-25
**Epic**: Epic 6 - Article Analysis Orchestration
**User Stories**: US-6.1, US-6.2, US-6.3
**Status**: ✅ Fully Implemented

---

## Executive Summary

This domain model documents the **current implementation** of article analysis orchestration for the datagum.ai Article Analyzer. The system orchestrates a complete 7-phase synchronous workflow that scrapes articles, generates FAQs, runs control tests, and executes individual FAQ search tests with progressive database saves for real-time UI updates.

### Key Business Requirements (Implemented)
- Orchestrate complete article analysis workflow synchronously
- Execute 7 distinct phases in sequence within HTTP request
- Save results progressively for real-time UI updates
- Handle errors at each phase with appropriate fallbacks
- Update submission status after each phase completion
- Individual FAQ testing (NOT batch) with progressive saves
- NO background queues - all processing synchronous

### Architecture
- **Framework**: Next.js 15.4.6 with App Router
- **Runtime**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Processing Model**: 100% synchronous in HTTP request
- **Background Continuation**: Cloudflare `ctx.waitUntil()` for non-blocking execution
- **Queue Usage**: ❌ NO active queue usage (infrastructure exists but not integrated)

---

## Component Overview

| Component | Type | Location | Lines | Status |
|-----------|------|----------|-------|--------|
| AnalysisService | Service | `src/services/analysis.service.ts` | 320 | ✅ Implemented |
| Submit API Route | API Route | `src/app/api/submit/route.ts` | 148 | ✅ Implemented |
| SubmissionRepository | Repository | `src/repositories/submission.repository.ts` | 219 | ✅ Implemented |
| ResultsRepository | Repository | `src/repositories/results.repository.ts` | 102 | ✅ Implemented |
| Database Schema | Schema | `src/db/schema.ts` | 196 | ✅ Implemented |
| Results API Route | API Route | `src/app/api/results/[id]/route.ts` | 161 | ✅ Implemented |

**Total Implementation**: 1,146 lines of production code

---

## Component Details

### 1. AnalysisService (Orchestration Engine)

**Location**: `src/services/analysis.service.ts` (320 lines)
**Type**: Service
**Responsibility**: Orchestrates complete 7-phase article analysis workflow synchronously

**Public Function**:

```typescript
export async function analyzeArticle(
  submissionId: string,
  url: string
): Promise<AnalysisResult>
```

**Return Type**:
```typescript
export interface AnalysisResult {
  success: boolean
  submissionId: string
  articleTitle?: string
  faqCount?: number
  testsCompleted?: number
  tier1Passed?: boolean    // Control test (accessibility)
  tier2Count?: number      // FAQs found in sources
  tier3Count?: number      // FAQs cited in answers
  duration?: number
  error?: string
}
```

**7-Phase Workflow** (lines 56-181):

```typescript
export async function analyzeArticle(
  submissionId: string,
  url: string
): Promise<AnalysisResult> {
  const startTime = Date.now()
  const { env } = await getCloudflareContext()

  console.log(`[Analysis] Starting analysis for submission ${submissionId}`)

  try {
    // ============================================================
    // PHASE 1: Scrape Article Content
    // ============================================================
    await updateSubmissionStatus(submissionId, 'scraping', undefined, env)
    console.log(`[Analysis] Phase 1: Scraping article...`)

    const article = await scrapeArticle(url)
    const scrapedArticle: ScrapedArticle = {
      url,
      title: article.title || 'Untitled Article',
      content: article.content || ''
    }

    await updateArticleData(
      submissionId,
      scrapedArticle.title,
      scrapedArticle.content,
      env
    )
    console.log(`[Analysis] Article scraped: ${scrapedArticle.title}`)

    // ============================================================
    // PHASE 2: Generate FAQ Pairs
    // ============================================================
    await updateSubmissionStatus(submissionId, 'generating_faqs', undefined, env)
    console.log(`[Analysis] Phase 2: Generating FAQs...`)

    const faqs = await generateFAQsPhase(
      submissionId,
      scrapedArticle,
      url,
      env
    )
    console.log(`[Analysis] Generated ${faqs.length} FAQ pairs`)

    // ============================================================
    // PHASE 3: Run Control Test (Tier 1 - Accessibility)
    // ============================================================
    await updateSubmissionStatus(submissionId, 'running_control', undefined, env)
    console.log(`[Analysis] Phase 3: Running control test (Tier 1)...`)

    const isAccessible = await runControlTest(
      url,
      env.OPENAI_API_KEY
    )
    console.log(`[Analysis] Control test: ${isAccessible ? 'PASS ✅' : 'FAIL ❌'}`)

    // Save control test result immediately for progressive display
    await updateTestMetrics(
      submissionId,
      {
        isAccessible,
        inSourcesCount: 0,
        inCitationsCount: 0,
        totalFaqs: faqs.length
      },
      env
    )

    // ============================================================
    // PHASE 4: Test FAQ Search Visibility (Tier 2 & 3)
    // Skip if control test fails
    // ============================================================
    let tier2Count = 0
    let tier3Count = 0

    if (isAccessible) {
      await updateSubmissionStatus(submissionId, 'testing_faqs', undefined, env)
      console.log(`[Analysis] Phase 4: Testing FAQ search visibility...`)

      const testMetrics = await testFAQVisibility(
        submissionId,
        faqs,
        url,
        isAccessible,
        env
      )
      tier2Count = testMetrics.inSourcesCount
      tier3Count = testMetrics.inCitationsCount

      console.log(
        `[Analysis] FAQ tests completed: Tier 2: ${tier2Count}/${faqs.length} in sources, Tier 3: ${tier3Count}/${faqs.length} cited`
      )
    } else {
      console.log(`[Analysis] Skipping FAQ tests - control test failed`)

      // Save empty test metrics
      await updateTestMetrics(
        submissionId,
        {
          isAccessible: false,
          inSourcesCount: 0,
          inCitationsCount: 0,
          totalFaqs: faqs.length
        },
        env
      )
    }

    // ============================================================
    // PHASE 5: Mark as Completed
    // ============================================================
    await updateSubmissionStatus(submissionId, 'completed', undefined, env)

    const duration = Date.now() - startTime
    console.log(`[Analysis] Analysis completed in ${duration}ms`)

    return {
      success: true,
      submissionId,
      articleTitle: scrapedArticle.title,
      faqCount: faqs.length,
      testsCompleted: faqs.length,
      tier1Passed: isAccessible,
      tier2Count,
      tier3Count,
      duration
    }
  } catch (error) {
    console.error(`[Analysis] Analysis failed:`, error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    await updateSubmissionStatus(submissionId, 'failed', errorMessage, env)

    return {
      success: false,
      submissionId,
      error: errorMessage,
      duration: Date.now() - startTime
    }
  }
}
```

**FAQ Generation Phase** (lines 184-224):

```typescript
async function generateFAQsPhase(
  submissionId: string,
  article: ScrapedArticle,
  targetUrl: string,
  env: CloudflareEnv
): Promise<FAQ[]> {
  try {
    const result = await generateFAQs(
      {
        articleTitle: article.title,
        articleContent: article.content,
        targetUrl,
        numberOfFAQs: 5
      },
      env.OPENAI_API_KEY
    )

    // Store FAQs in database
    await updateGeneratedFAQs(submissionId, result.faqs, env)

    return result.faqs
  } catch (error) {
    console.error(`[Analysis] FAQ generation failed:`, error)

    // Fallback to simple FAQ
    const fallbackFAQs: FAQ[] = [
      {
        question: `What is "${article.title}" about?`,
        answer: `This article discusses ${article.title}. For more details, please read the full article.`,
        category: 'what-is',
        numbers: []
      }
    ]
    await updateGeneratedFAQs(submissionId, fallbackFAQs, env)

    return fallbackFAQs
  }
}
```

**FAQ Visibility Testing Phase (Individual Sequential Tests)** (lines 227-320):

```typescript
async function testFAQVisibility(
  submissionId: string,
  faqs: FAQ[],
  targetUrl: string,
  isAccessible: boolean,
  env: CloudflareEnv
): Promise<{
  isAccessible: boolean
  inSourcesCount: number
  inCitationsCount: number
  totalFaqs: number
}> {
  try {
    console.log(
      `[Analysis] Testing ${faqs.length} FAQ questions with OpenAI web search...`
    )

    const allResults = []

    // ============================================================
    // INDIVIDUAL SEQUENTIAL TEST EXECUTION (NOT BATCH)
    // ============================================================
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i]
      const questionNumber = i + 1

      console.log(
        `[Analysis] Testing FAQ ${questionNumber}/${faqs.length}: "${faq.question}"`
      )

      try {
        // Run individual search test
        const result = await runSearchTest(
          {
            question: faq.question,
            targetUrl
          },
          env.OPENAI_API_KEY
        )

        // ============================================================
        // PROGRESSIVE SAVE - Save result immediately for real-time UI updates
        // ============================================================
        await saveResult(
          submissionId,
          result.question,
          result.targetUrlFound,
          result.foundInSources,
          result.foundInCitations,
          result.citations,
          result.sources,
          result.responseTimeMs,
          result.llmResponse,
          env
        )

        allResults.push(result)

        console.log(
          `[Analysis] ✅ FAQ ${questionNumber}/${faqs.length} completed and saved`
        )
      } catch (error) {
        console.error(
          `[Analysis] ❌ FAQ ${questionNumber}/${faqs.length} failed:`,
          error
        )
        // Continue with next test even if one fails
      }
    }

    console.log(
      `[Analysis] All ${allResults.length} FAQ test results saved to database`
    )

    // Calculate 3-tier metrics
    const metrics = calculateTestMetrics(allResults, isAccessible)
    const metricsForStorage = formatMetricsForStorage(metrics)

    // Store test metrics
    await updateTestMetrics(submissionId, metricsForStorage, env)

    return metricsForStorage
  } catch (error) {
    console.error(`[Analysis] FAQ search testing failed:`, error)

    const emptyMetrics = {
      isAccessible,
      inSourcesCount: 0,
      inCitationsCount: 0,
      totalFaqs: faqs.length
    }

    await updateTestMetrics(submissionId, emptyMetrics, env)

    return emptyMetrics
  }
}
```

**Key Orchestration Features**:
1. **Sequential Phases**: Each phase completes before next begins
2. **Progressive Saves**: Results saved immediately for real-time UI
3. **Individual FAQ Tests**: One at a time, NOT batch processing
4. **Error Handling**: Graceful fallbacks at each phase
5. **Status Updates**: Database updated after each phase
6. **Logging**: Comprehensive console logs for debugging

**Dependencies**:
- `scrapeArticle()` from scraper.service
- `generateFAQs()` from faq-generator.service
- `runControlTest()`, `runSearchTest()` from search-tester.service
- `updateSubmissionStatus()`, `updateArticleData()`, `updateGeneratedFAQs()`, `updateTestMetrics()` from submission.repository
- `saveResult()` from results.repository
- `calculateTestMetrics()`, `formatMetricsForStorage()` from test-results-formatter

---

### 2. Submit API Route (Entry Point)

**Location**: `src/app/api/submit/route.ts` (148 lines)
**Type**: Next.js App Router API Route
**Responsibility**: Handles article submission and triggers background analysis

**Function Signature**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse>
```

**Implementation Flow** (lines 20-95):

```typescript
export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // PHASE 1: Parse and Validate Input
    // ============================================================
    const { url } = await request.json()
    const cleanUrl = sanitizeURL(url)
    validateURL(cleanUrl)

    // ============================================================
    // PHASE 2: Rate Limiting
    // ============================================================
    const userIp = extractUserIP(request)
    if (userIp) {
      await checkRateLimit(userIp)
    }

    // ============================================================
    // PHASE 3: Create Submission Record
    // ============================================================
    const submission = await createSubmission(cleanUrl, userIp)

    // ============================================================
    // PHASE 4: Get Cloudflare Context for Background Processing
    // ============================================================
    const { ctx } = await getCloudflareContext()

    // ============================================================
    // PHASE 5: Return Immediate Response
    // ============================================================
    const response = NextResponse.json(
      {
        submissionId: submission.id,
        url: submission.url,
        status: 'pending',
        message: 'Analysis started',
        resultsUrl: `/results/${submission.id}`
      },
      { status: 200 }
    )

    // ============================================================
    // PHASE 6: Run Analysis in Background (continues after response sent)
    // Uses Cloudflare ctx.waitUntil() - NOT queues
    // ============================================================
    ctx.waitUntil(
      analyzeArticle(submission.id, submission.url).catch((error) => {
        console.error(`Background analysis failed:`, error)
      })
    )

    return response
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { message: error.message },
        { status: 429 }
      )
    }

    if (error instanceof URLValidationError) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
```

**IP Extraction Logic** (lines 100-148):
```typescript
function extractUserIP(request: NextRequest): string | undefined {
  // Priority 1: Cloudflare-specific header (most reliable)
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp && !isLocalhostIP(cfConnectingIp)) {
    return cfConnectingIp
  }

  // Priority 2: X-Forwarded-For (proxy support)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim()
    if (ip && !isLocalhostIP(ip)) return ip
  }

  // Priority 3: X-Real-IP (alternative proxy header)
  const realIp = request.headers.get('x-real-ip')
  if (realIp && !isLocalhostIP(realIp)) return realIp

  // Priority 4: request.ip (Next.js built-in)
  const requestWithIp = request as NextRequest & { ip?: string }
  if (requestWithIp.ip && !isLocalhostIP(requestWithIp.ip)) {
    return requestWithIp.ip
  }

  return undefined // No rate limiting for localhost
}
```

**Background Processing via ctx.waitUntil()** (lines 61-69):
```typescript
// Get Cloudflare context for background processing
const { ctx } = await getCloudflareContext()

// Return immediately with submission ID
const response = NextResponse.json({
  submissionId: submission.id,
  url: submission.url,
  status: 'pending',
  message: 'Analysis started',
  resultsUrl: `/results/${submission.id}`
}, { status: 200 })

// Run analysis in background (continues after response sent)
ctx.waitUntil(
  analyzeArticle(submission.id, submission.url).catch((error) => {
    console.error(`Background analysis failed:`, error)
  })
)

return response
```

**Key Features**:
1. **Immediate Response**: Returns submission ID immediately
2. **Background Processing**: Uses `ctx.waitUntil()` for non-blocking execution
3. **NO Queues**: All processing synchronous in HTTP request continuation
4. **Error Handling**: Different status codes for different error types
5. **Rate Limiting**: IP-based with graceful localhost handling

**Dependencies**:
- `validateURL()`, `sanitizeURL()` from url-validator.service
- `checkRateLimit()` from rate-limiter.service
- `createSubmission()` from submission.repository
- `analyzeArticle()` from analysis.service
- `getCloudflareContext()` from @opennextjs/cloudflare

---

### 3. SubmissionRepository (Database Operations)

**Location**: `src/repositories/submission.repository.ts` (219 lines)
**Type**: Data Access Layer
**Responsibility**: Manages database operations for submission records

**Public Functions**:

```typescript
export async function createSubmission(
  url: string,
  userIp?: string
): Promise<Submission>

export async function getSubmissionById(
  id: string
): Promise<Submission | null>

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  error?: string,
  env?: CloudflareEnv
): Promise<void>

export async function updateArticleData(
  id: string,
  title: string,
  content: string,
  env?: CloudflareEnv
): Promise<void>

export async function updateGeneratedFAQs(
  id: string,
  faqs: Array<{
    question: string
    answer: string
    category: string
    numbers: string[]
  }>,
  env?: CloudflareEnv
): Promise<void>

export async function updateTestMetrics(
  id: string,
  metrics: {
    isAccessible: boolean
    inSourcesCount: number
    inCitationsCount: number
    totalFaqs: number
  },
  env?: CloudflareEnv
): Promise<void>

export async function countRecentSubmissionsByIP(
  userIp: string,
  hoursAgo: number = 24
): Promise<number>
```

**Create Submission** (lines 20-45):
```typescript
export async function createSubmission(
  url: string,
  userIp?: string
): Promise<Submission> {
  const db = await getDb()

  const [submission] = await db
    .insert(contentAnalysisSubmissions)
    .values({
      url,
      userIp,
      status: 'pending'
    })
    .returning()

  return submission
}
```

**Update Submission Status** (lines 60-85):
```typescript
export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  error?: string,
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      status,
      scrapingError: error,
      updatedAt: new Date(),
      completedAt: status === 'completed' || status === 'failed'
        ? new Date()
        : undefined
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}
```

**Update Test Metrics** (lines 150-175):
```typescript
export async function updateTestMetrics(
  id: string,
  metrics: {
    isAccessible: boolean
    inSourcesCount: number
    inCitationsCount: number
    totalFaqs: number
  },
  env?: CloudflareEnv
): Promise<void> {
  const db = env ? getDbFromEnv(env) : await getDb()

  await db
    .update(contentAnalysisSubmissions)
    .set({
      testMetrics: metrics,
      updatedAt: new Date()
    })
    .where(eq(contentAnalysisSubmissions.id, id))
}
```

**Database Access Patterns**:
- Uses `getDb()` for API routes (standard access)
- Uses `getDbFromEnv(env)` for background processing
- All queries use Drizzle ORM with type safety
- Automatic timestamp management

---

### 4. ResultsRepository (Test Results Storage)

**Location**: `src/repositories/results.repository.ts` (102 lines)
**Type**: Data Access Layer
**Responsibility**: Manages database operations for test results

**Public Functions**:

```typescript
export async function saveResult(
  submissionId: string,
  question: string,
  targetUrlFound: boolean,
  foundInSources: boolean,
  foundInCitations: boolean,
  allCitations: CitationInfo[],
  allSources: string[],
  responseTimeMs?: number,
  llmResponse?: string,
  env?: CloudflareEnv
): Promise<AnalysisResult>

export async function getResultsBySubmission(
  submissionId: string
): Promise<AnalysisResult[]>
```

**Progressive Save for Real-Time UI** (lines 23-53):
```typescript
export async function saveResult(
  submissionId: string,
  question: string,
  targetUrlFound: boolean,
  foundInSources: boolean,
  foundInCitations: boolean,
  allCitations: CitationInfo[],
  allSources: string[],
  responseTimeMs?: number,
  llmResponse?: string,
  env?: CloudflareEnv
): Promise<AnalysisResult> {
  const db = env ? getDbFromEnv(env) : await getDb()

  const [result] = await db
    .insert(contentAnalysisResults)
    .values({
      submissionId,
      question,
      llmResponse,
      targetUrlFound,
      foundInSources,
      foundInCitations,
      allCitations,
      allSources,
      responseTimeMs
    })
    .returning()

  return result
}
```

---

### 5. Database Schema (Data Model)

**Location**: `src/db/schema.ts` (196 lines)
**Type**: Drizzle ORM Schema Definition

**Main Table**: `content_analysis_submissions`

```typescript
export const contentAnalysisSubmissions = pgTable(
  'content_analysis_submissions',
  {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Submission data
    url: text('url').notNull(),
    userIp: varchar('user_ip', { length: 45 }), // IPv4 or IPv6

    // Status tracking (7-status workflow)
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    // Values: 'pending' | 'scraping' | 'generating_faqs' |
    //         'running_control' | 'testing_faqs' | 'completed' | 'failed'

    // Generated FAQs (JSONB array)
    generatedFaqs: jsonb('generated_faqs').default([]).notNull(),

    // Test metrics (3-tier results)
    testMetrics: jsonb('test_metrics'),

    // Error handling
    scrapingError: text('scraping_error'),

    // Scraped article data
    articleTitle: text('article_title'),
    articleContent: text('article_content'), // First 5000 chars

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
  },
  (table) => ({
    // Indexes for query performance
    statusIdx: index('content_analysis_submissions_status_idx')
      .on(table.status),
    userIpIdx: index('content_analysis_submissions_user_ip_idx')
      .on(table.userIp),
    createdAtIdx: index('content_analysis_submissions_created_at_idx')
      .on(table.createdAt)
  })
)
```

**Results Table**: `content_analysis_results`

```typescript
export const contentAnalysisResults = pgTable(
  'content_analysis_results',
  {
    id: serial('id').primaryKey(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => contentAnalysisSubmissions.id),

    question: text('question').notNull(),
    llmResponse: text('llm_response'),

    // Test results
    targetUrlFound: boolean('target_url_found').notNull(),
    foundInSources: boolean('found_in_sources').notNull(),
    foundInCitations: boolean('found_in_citations').notNull(),

    // Citations and sources (JSONB)
    allCitations: jsonb('all_citations').notNull().default([]),
    allSources: jsonb('all_sources').notNull().default([]),

    responseTimeMs: integer('response_time_ms'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  }
)
```

**Status Workflow**:
```
pending → scraping → generating_faqs → running_control → testing_faqs → completed
                                                                       ↘ failed
```

---

### 6. Results API Route (Progressive Loading Support)

**Location**: `src/app/api/results/[id]/route.ts` (161 lines)
**Type**: Next.js App Router API Route
**Responsibility**: Fetches submission and test results for progressive loading UI

**Function Signature**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse>
```

**Implementation** (lines 16-141):
```typescript
export async function GET(request: NextRequest, { params }) {
  const { id } = await params

  // Get submission record
  const submission = await getSubmissionById(id)
  if (!submission) {
    return NextResponse.json({ message: 'Submission not found' }, { status: 404 })
  }

  // Get test results (progressively available as tests complete)
  const results = await getResultsBySubmission(id)

  // Calculate statistics
  const totalTests = results.length
  const citedCount = results.filter(r => r.foundInCitations).length
  const mentionedCount = results.filter(r => r.foundInSources).length
  const notFoundCount = results.filter(r => !r.targetUrlFound).length

  // Return combined data
  return NextResponse.json({
    submission: {
      id: submission.id,
      url: submission.url,
      status: submission.status, // Real-time status updates
      articleTitle: submission.articleTitle,
      scrapingError: submission.scrapingError,
      createdAt: submission.createdAt,
      completedAt: submission.completedAt,
      generatedFaqs: submission.generatedFaqs, // Available after phase 2
      testMetrics: submission.testMetrics // Updated progressively
    },
    results: results.map(r => ({
      id: r.id,
      question: r.question,
      llmResponse: r.llmResponse,
      targetUrlFound: r.targetUrlFound,
      foundInSources: r.foundInSources,
      foundInCitations: r.foundInCitations,
      citations: r.allCitations,
      sources: r.allSources
    })),
    statistics: {
      totalTests,
      citedCount,
      mentionedCount,
      notFoundCount,
      citationRate: totalTests > 0 ? (citedCount / totalTests) * 100 : 0
    }
  })
}
```

**Progressive Data Availability**:
- **After Phase 1 (scraping)**: articleTitle, articleContent available
- **After Phase 2 (generating_faqs)**: generatedFaqs available
- **After Phase 3 (running_control)**: testMetrics.isAccessible available
- **During Phase 4 (testing_faqs)**: results array grows as each test completes
- **After Phase 5 (completed)**: All data fully available

---

## Data Flow

### Complete Workflow Sequence

1. **Submission** (Submit API):
   ```
   User submits URL
   ↓
   Validate URL and check rate limit
   ↓
   Create submission record (status: 'pending')
   ↓
   Return immediate response with submission ID
   ↓
   Start background analysis via ctx.waitUntil()
   ```

2. **Phase 1 - Scraping**:
   ```
   Update status: 'scraping'
   ↓
   Scrape article content
   ↓
   Save articleTitle and articleContent
   ↓
   Update updatedAt timestamp
   ```

3. **Phase 2 - FAQ Generation**:
   ```
   Update status: 'generating_faqs'
   ↓
   Generate 5 FAQ pairs with GPT-4o-mini
   ↓
   Save generatedFaqs (JSONB array)
   ↓
   Update updatedAt timestamp
   ```

4. **Phase 3 - Control Test**:
   ```
   Update status: 'running_control'
   ↓
   Run control test via OpenAI web search
   ↓
   Save testMetrics.isAccessible
   ↓
   Update updatedAt timestamp
   ```

5. **Phase 4 - FAQ Testing** (if accessible):
   ```
   Update status: 'testing_faqs'
   ↓
   FOR EACH FAQ (individual sequential tests):
     ↓
     Run search test via OpenAI web search
     ↓
     PROGRESSIVE SAVE: Insert into content_analysis_results
     ↓
     Update updatedAt timestamp
   ↓
   Calculate final testMetrics
   ↓
   Save testMetrics.inSourcesCount and inCitationsCount
   ```

6. **Phase 5 - Completion**:
   ```
   Update status: 'completed'
   ↓
   Set completedAt timestamp
   ↓
   Final updatedAt timestamp
   ```

7. **Progressive Loading** (Results UI):
   ```
   Poll /api/results/[id] every 3 seconds
   ↓
   Display current status
   ↓
   Show available data (title, FAQs, results)
   ↓
   Stop polling when status is 'completed' or 'failed'
   ```

---

## Integration Points

### Submit API to Analysis Service
- **Trigger**: `ctx.waitUntil(analyzeArticle(...))`
- **Method**: Cloudflare Workers waitUntil API
- **Non-blocking**: Response sent before analysis completes
- **Status Updates**: Progressive database updates

### Analysis Service to Database
- **Pattern**: Progressive saves after each phase
- **API Routes**: Use `getDb()` for standard access
- **Background Jobs**: Use `getDbFromEnv(env)` from Cloudflare context
- **Type Safety**: Full TypeScript inference from schema

### Results API to Database
- **Polling**: Results UI polls every 3 seconds
- **Real-Time**: Shows latest data as analysis progresses
- **Completion**: Stops polling when status is 'completed' or 'failed'

---

## Current Status

### Implementation Progress: 100%

All components are fully implemented and deployed:

✅ **AnalysisService** - 320 lines of orchestration logic
✅ **Submit API Route** - 148 lines of entry point and background trigger
✅ **SubmissionRepository** - 219 lines of database operations
✅ **ResultsRepository** - 102 lines of results storage
✅ **Database Schema** - 196 lines of data model
✅ **Results API Route** - 161 lines of progressive loading support

### Production Deployment

- **Platform**: Cloudflare Workers
- **Framework**: Next.js 15 with OpenNext.js
- **Database**: Neon PostgreSQL
- **Status**: Live and operational

---

## Queue Usage Clarification

### CRITICAL: NO Active Queue Usage

**Queue Infrastructure**: ❌ NOT INTEGRATED
- Queue-related files exist in codebase (`queue-messages.ts`, `job-processing.ts`)
- NO queue bindings in `wrangler.jsonc`
- NO queue consumer worker
- NO queue producer calls in production code

**Actual Processing**: ✅ 100% SYNCHRONOUS
- All processing happens in HTTP request via `ctx.waitUntil()`
- Cloudflare Workers `waitUntil()` allows execution to continue after response sent
- NOT background queues - just non-blocking HTTP request continuation
- Progressive saves enable real-time UI updates

**Architecture Notes**:
- Can mention "queue infrastructure defined for future use but not currently active"
- Processing is synchronous and blocking (within HTTP request lifecycle)
- Uses Cloudflare Workers runtime features, not Cloudflare Queues product

---

## Dependencies

### External Services
- **Neon PostgreSQL**: Database storage
- **Cloudflare Workers**: Runtime environment
- **OpenAI API**: FAQ generation and search testing

### Framework Libraries
- **Next.js 15.4.6**: App Router, API Routes
- **Drizzle ORM**: Database queries
- **@opennextjs/cloudflare**: Cloudflare Workers adapter

### Internal Services
- **ScraperService**: Article content extraction
- **FAQGeneratorService**: AI-powered FAQ generation
- **SearchTesterService**: OpenAI web search testing
- **URLValidatorService**: URL validation
- **RateLimiterService**: IP-based rate limiting

---

## Changelog

### Version 4.0.0 (2025-10-25) 🎉 COMPLETE REWRITE
**Comprehensive Implementation Documentation with Queue Clarification**

**MAJOR CHANGES**:
- **Architecture Update**: Removed monorepo references, single Next.js app
- **Title Change**: "Background Job Processing" → "Article Analysis Orchestration"
- **Component Status**: All components marked as ✅ Fully Implemented
  - AnalysisService: 320 lines
  - Submit API Route: 148 lines
  - SubmissionRepository: 219 lines
  - ResultsRepository: 102 lines
  - Database Schema: 196 lines
  - Results API Route: 161 lines
- **Processing Model**: Documented synchronous execution
  - 100% synchronous processing in HTTP request
  - Uses `ctx.waitUntil()` for non-blocking execution
  - NO Cloudflare Queues usage (infrastructure exists but not integrated)
- **7-Phase Workflow**: Documented complete orchestration flow
  - Scraping → FAQ Generation → Control Test → FAQ Testing → Completion
  - Progressive database saves for real-time UI updates
  - Individual sequential FAQ testing (NOT batch)
- **Queue Clarification**: CRITICAL updates
  - ❌ NO active queue usage in production
  - ⚠️ Queue infrastructure files exist but are NOT integrated
  - ✅ Processing is synchronous via `ctx.waitUntil()`

**DOCUMENTATION IMPROVEMENTS**:
- Added Component Overview table with line counts
- Expanded Component Details with actual implementations
- Added Integration Points section
- Added Queue Usage Clarification section
- Updated all code examples to match production code
- Removed aspirational features

**FILES DOCUMENTED**:
- `src/services/analysis.service.ts` (320 lines)
- `src/app/api/submit/route.ts` (148 lines)
- `src/repositories/submission.repository.ts` (219 lines)
- `src/repositories/results.repository.ts` (102 lines)
- `src/db/schema.ts` (196 lines)
- `src/app/api/results/[id]/route.ts` (161 lines)

**TOTAL IMPLEMENTATION**: 1,146 lines of production code documented

---

## Summary

The Article Analysis Orchestration subsystem orchestrates a complete 7-phase synchronous workflow that scrapes articles, generates FAQs, runs control tests, and executes individual FAQ search tests with progressive database saves for real-time UI updates. All processing is synchronous within the HTTP request lifecycle using Cloudflare Workers `ctx.waitUntil()` for non-blocking execution. Queue infrastructure files exist in the codebase but are NOT integrated or used in production. The system achieves real-time UI updates through progressive database saves after each phase and individual test completion. All components are fully implemented and operational in production.
