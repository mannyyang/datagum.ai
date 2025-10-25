# Domain Model: Unit 5 - Results Display

**Version**: 2.0.0
**Last Updated**: 2025-10-25
**Epic**: Epic 5 - Results Display
**User Stories**: US-5.1, US-5.2, US-5.3, US-5.4
**Status**: ✅ Fully Implemented

---

## Executive Summary

This domain model documents the **current implementation** of results display for the datagum.ai Article Analyzer. The system provides real-time progressive loading of analysis results through polling-based updates, featuring a refined v1.3.0 UX that prioritizes FAQ test results with citations/sources as the most valuable insights, while positioning the control test compactly after FAQ results with uniform black text metrics cards.

### Key Business Requirements (Implemented)
- Display analysis results with progressive loading (7-status workflow)
- Poll results API every 3 seconds until status is 'completed' or 'failed'
- Show citation statistics and test metrics
- Display FAQ test results with 3-tier evaluation (Tier 1, Tier 2, Tier 3)
- Progressive FAQ result visibility during testing
- v1.3.0 UX: Control test compact and positioned BEFORE FAQ results
- v1.3.0 UX: Metrics cards with uniform black text (no green/yellow/red)
- v1.3.0 UX: FAQ questions displayed during loading with spinner skeletons
- v1.3.0 UX: LLM responses collapsed by default, positioned under citations/sources

### Architecture
- **Framework**: Next.js 15.4.6 with App Router
- **Runtime**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Polling**: Client-side 3-second interval polling
- **Progressive Loading**: Real-time status and result updates
- **Processing**: 100% synchronous in HTTP request (NO queues)

---

## Component Overview

| Component | Type | Location | Lines | Status |
|-----------|------|----------|-------|--------|
| Results API Route | API Route | `src/app/api/results/[id]/route.ts` | 161 | ✅ Implemented |
| Results Page | Page Component | `src/app/results/[id]/page.tsx` | 21 | ✅ Implemented |
| ResultsView | Client Component | `src/components/results-view.tsx` | 603 | ✅ Implemented |
| ResultsRepository | Repository | `src/repositories/results.repository.ts` | 102 | ✅ Implemented |
| TestResultsFormatter | Utility | `src/utils/test-results-formatter.ts` | 123 | ✅ Implemented |

**Total Implementation**: 988 lines of production code (161+21+603+102+101 utilities)

---

## Component Details

### 1. Results API Route (Data Fetching)

**Location**: `src/app/api/results/[id]/route.ts` (161 lines)
**Type**: Next.js App Router API Route
**Responsibility**: Fetches submission and test results, calculates statistics

**Function Signature**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse>
```

**Implementation Flow** (lines 16-141):
```typescript
export async function GET(request: NextRequest, { params }) {
  const { id } = await params

  // Get submission record
  const submission = await getSubmissionById(id)
  if (!submission) {
    return NextResponse.json({ message: 'Submission not found' }, { status: 404 })
  }

  // Get test results
  const results = await getResultsBySubmission(id)

  // Calculate statistics
  const totalTests = results.length
  const citedCount = results.filter(r => r.foundInCitations).length
  const mentionedCount = results.filter(r => r.foundInSources).length
  const notFoundCount = results.filter(r => !r.targetUrlFound).length

  // Calculate total sources and citations
  const totalSources = results.reduce((sum, r) => {
    const sources = r.allSources as any[]
    return sum + (sources?.length || 0)
  }, 0)

  const totalCitations = results.reduce((sum, r) => {
    const citations = r.allCitations as CitationInfo[]
    return sum + (citations?.length || 0)
  }, 0)

  // Calculate average citation position
  const citationPositions = results
    .filter(r => r.foundInCitations && r.allCitations.length > 0)
    .map(r => {
      const citations = r.allCitations as CitationInfo[]
      const targetCitation = citations.find(c =>
        normalizeUrl(c.url) === normalizeUrl(submission.url)
      )
      return targetCitation?.position ?? 999
    })

  const averagePosition = citationPositions.length > 0
    ? citationPositions.reduce((sum, pos) => sum + pos, 0) / citationPositions.length
    : undefined

  // Calculate tier success rates
  const testMetrics = submission.testMetrics as any
  const tier2SuccessRate = testMetrics && testMetrics.totalFaqs > 0
    ? (testMetrics.inSourcesCount / testMetrics.totalFaqs) * 100
    : undefined
  const tier3SuccessRate = testMetrics && testMetrics.totalFaqs > 0
    ? (testMetrics.inCitationsCount / testMetrics.totalFaqs) * 100
    : undefined

  // Return combined data
  return NextResponse.json({
    submission: {
      id: submission.id,
      url: submission.url,
      status: submission.status,
      articleTitle: submission.articleTitle,
      scrapingError: submission.scrapingError,
      createdAt: submission.createdAt,
      completedAt: submission.completedAt,
      generatedFaqs: submission.generatedFaqs,
      testMetrics: testMetrics ? {
        ...testMetrics,
        tier2SuccessRate,
        tier3SuccessRate
      } : null
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
      citationRate: totalTests > 0 ? (citedCount / totalTests) * 100 : 0,
      averagePosition,
      totalSources,
      totalCitations
    }
  })
}
```

**URL Normalization** (lines 146-161):
```typescript
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let hostname = parsed.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    let pathname = parsed.pathname
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    return `${parsed.protocol}//${hostname}${pathname}`
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}
```

**Dependencies**:
- `getSubmissionById()` from submission.repository
- `getResultsBySubmission()` from results.repository

---

### 2. Results Page (Entry Point)

**Location**: `src/app/results/[id]/page.tsx` (21 lines)
**Type**: Next.js Server Component
**Responsibility**: Results page wrapper that renders ResultsView client component

**Implementation** (lines 13-21):
```typescript
interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params

  return <ResultsView submissionId={id} />
}
```

**Features**:
- Async params handling (Next.js 15 pattern)
- Minimal wrapper for client component
- Server-side rendering for SEO

---

### 3. ResultsView (Client Component with Progressive Loading)

**Location**: `src/components/results-view.tsx` (603 lines)
**Type**: React Client Component
**Responsibility**: Displays analysis results with progressive loading and polling

**Polling Logic** (lines 80-134):
```typescript
export function ResultsView({ submissionId }: ResultsViewProps) {
  const [data, setData] = useState<AnalysisResults | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null

    async function fetchResults() {
      if (!isMounted) return

      try {
        const response = await fetch(`/api/results/${submissionId}`)
        const results = await response.json() as AnalysisResults
        setData(results)

        // Continue polling if still processing
        if (
          isMounted &&
          results.submission.status &&
          !['completed', 'failed'].includes(results.submission.status)
        ) {
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              fetchResults()
            }, 3000) // Poll every 3 seconds
          }
        } else {
          // Stop polling when completed or failed
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
        }
      } catch {
        setError('Failed to load results')
      }
    }

    // Initial fetch
    fetchResults()

    return () => {
      isMounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [submissionId])
}
```

**7-Status Progressive Messages** (lines 203-211):
```typescript
{isProcessing && (
  <p className="text-sm text-muted-foreground mt-2">
    {submission.status === 'scraping' && '📄 Scraping article...'}
    {submission.status === 'generating_faqs' && '🤔 Generating FAQ questions...'}
    {submission.status === 'running_control' && '🔍 Running control test (Tier 1)...'}
    {submission.status === 'testing_faqs' && `🧪 Testing FAQs... (${results.length} of 5 completed)`}
    {!submission.status && 'Analyzing your article...'}
  </p>
)}
```

**v1.3.0 UX: Metrics Cards with Uniform Black Text** (lines 215-325):
```typescript
<div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
  {/* Citation Rate Card - BLACK TEXT */}
  <div className="bg-card border rounded-lg p-6">
    <p className="text-sm text-muted-foreground mb-1">Citation Rate</p>
    {statistics ? (
      <>
        <p className="text-3xl font-bold">
          {statistics.citationRate.toFixed(0)}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {statistics.citedCount} of {statistics.totalTests} tests
        </p>
      </>
    ) : (
      <>
        <Skeleton className="h-10 w-16 mb-1" />
        <Skeleton className="h-4 w-24" />
      </>
    )}
  </div>

  {/* Cited, Mentioned, Not Found, Total Sources, Total Citations cards follow same pattern */}
</div>
```

**v1.3.0 UX: Control Test (Compact, Positioned BEFORE FAQ Results)** (lines 358-396):
```typescript
{/* Control Test Card - Tier 1 (positioned before FAQ results, at line 382: "first test, at top") */}
{(submission?.status === 'running_control' ||
  submission?.status === 'testing_faqs' ||
  submission?.status === 'completed' ||
  data?.submission?.testMetrics) && (
  <div className="bg-muted/30 border rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Control Test (Tier 1)
        </h3>
        {submission.status === 'running_control' && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
      {data?.submission?.testMetrics ? (
        <div className="flex items-center gap-1.5">
          {data.submission.testMetrics.isAccessible ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Accessible</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Not Accessible</span>
            </>
          )}
        </div>
      ) : (
        <Skeleton className="h-4 w-24" />
      )}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      Verifies if OpenAI can access the article directly
    </p>
  </div>
)}
```

**v1.3.0 UX: FAQ Questions During Loading with Spinner Skeletons** (lines 398-549):
```typescript
{/* Show generated questions with progressive results loading */}
{submission?.generatedFaqs && submission.generatedFaqs.length > 0 ? (
  // We have generated questions - show all of them with results or skeletons
  submission.generatedFaqs.map((faq, index) => {
    const result = results.find(r => r.question === faq.question)

    if (result) {
      // Question has completed results - show full result card
      return (
        <div key={result.id} className="bg-card border rounded-lg p-6">
          {/* Full result card with citations/sources/LLM response */}
        </div>
      )
    } else {
      // Question hasn't been tested yet - show question with spinner skeleton
      return (
        <div key={`pending-${index}`} className="bg-card border rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-3">{faq.question}</h3>
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </div>
      )
    }
  })
) : (
  // No generated questions yet - show generic skeleton placeholders
  Array.from({ length: 5 }).map((_, i) => (
    <div key={`skeleton-${i}`} className="bg-card border rounded-lg p-6">
      {/* Generic skeleton */}
    </div>
  ))
)}
```

**v1.3.0 UX: Visual Hierarchy - Citations/Sources Primary, LLM Response Collapsed** (lines 423-522):
```typescript
{/* PRIMARY INSIGHT: Citation vs Sources Status */}
<div className="mb-4 space-y-2">
  {result.foundInCitations && (
    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <span className="text-sm font-medium text-green-700">
        ✓ Found in Citations (Tier 3) - Highest Value
      </span>
    </div>
  )}

  {/* Citations - collapsed by default */}
  <details className="mb-3">
    <summary className="text-sm font-medium cursor-pointer">
      <span>Citations ({result.citations.length})</span>
    </summary>
    <ul className="mt-2 space-y-1">
      {/* Citation list */}
    </ul>
  </details>

  {/* Sources - collapsed by default */}
  <details className="mb-3">
    <summary className="text-sm font-medium cursor-pointer">
      <span>Sources ({result.sources.length})</span>
    </summary>
    <ul className="mt-2 space-y-1">
      {/* Source list */}
    </ul>
  </details>

  {/* LLM Response - COLLAPSED, POSITIONED UNDER citations/sources */}
  {result.llmResponse && (
    <details className="mt-3">
      <summary className="text-sm text-muted-foreground cursor-pointer">
        View full AI response
      </summary>
      <div className="mt-2 p-3 bg-muted/30 rounded border">
        <p className="text-sm text-muted-foreground">{result.llmResponse}</p>
      </div>
    </details>
  )}
</div>
```

**Key UX Features (v1.3.0)**:
1. **Control Test Position**: Compact card positioned BEFORE FAQ results (first test, at top)
2. **Metrics Cards**: All use uniform black text (no green/yellow/red coloring)
3. **FAQ Questions**: Displayed during loading phase with spinner skeletons
4. **LLM Responses**: Collapsed by default, positioned under citations/sources
5. **Visual Hierarchy**: Top (header) → Metrics cards → Control test (compact) → FAQ tests (PRIMARY FOCUS) → Footer
6. **Design Rationale**: Citations and sources are the most valuable insights, not LLM responses

**Dependencies**:
- `shadcn/ui` components: Button, Skeleton
- `lucide-react` icons: Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink

---

### 4. ResultsRepository (Database Access)

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

**Save Result Implementation** (lines 23-53):
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

### 5. TestResultsFormatter (Metrics Calculation)

**Location**: `src/utils/test-results-formatter.ts` (123 lines)
**Type**: Utility
**Responsibility**: Formats 3-tier test results for storage and API responses

**Calculate Test Metrics** (lines 17-46):
```typescript
export function calculateTestMetrics(
  results: SearchTestResult[],
  isAccessible: boolean
): FAQTestMetrics {
  const totalFaqs = results.length
  const inSourcesCount = results.filter(r => r.foundInSources).length
  const inCitationsCount = results.filter(r => r.foundInCitations).length

  return {
    isAccessible,
    inSourcesCount,
    inCitationsCount,
    totalFaqs,
    results: results.map(result => ({
      faq: { question: result.question, answer: '', category: 'what-is', numbers: [] },
      isAccessible,
      foundInSources: result.foundInSources,
      foundInCitations: result.foundInCitations,
      citationPosition: result.citationPosition,
      allSources: result.sources,
      allCitations: result.citations,
      responseTimeMs: result.responseTimeMs || 0
    }))
  }
}
```

---

## Data Flow

### Progressive Loading Flow Sequence

1. **Initial Page Load**:
   ```
   User navigates to /results/[id]
   ↓
   ResultsPage server component renders
   ↓
   ResultsView client component mounts
   ↓
   Immediate first fetch to /api/results/[id]
   ```

2. **Polling Loop** (3-second interval):
   ```
   Fetch /api/results/[id]
   ↓
   Check submission.status
   ↓
   If status in ['completed', 'failed']:
     → Stop polling
     → Display final results
   ↓
   If status in ['pending', 'scraping', 'generating_faqs', 'running_control', 'testing_faqs']:
     → Continue polling every 3 seconds
     → Update UI with current status
     → Show progressive results
   ```

3. **v1.3.0 Visual Hierarchy** (Top to Bottom):
   ```
   1. Header with article title and status
   2. 6 Metrics cards (uniform black text)
   3. Average Position (if available)
   4. Control Test (BEFORE FAQ results, compact card - first test at top)
   5. FAQ Test Results (PRIMARY FOCUS)
   6. Footer actions
   ```

---

## Current Status

### Implementation Progress: 100%

All components are fully implemented and deployed:

✅ **Results API Route** - 161 lines of data fetching and statistics
✅ **Results Page** - 21 lines of server component wrapper
✅ **ResultsView** - 603 lines of progressive loading UI
✅ **ResultsRepository** - 102 lines of database operations
✅ **TestResultsFormatter** - 123 lines of metrics calculation

### Production Deployment

- **Platform**: Cloudflare Workers
- **Framework**: Next.js 15 with OpenNext.js
- **Database**: Neon PostgreSQL
- **Status**: Live and operational with v1.3.0 UX refinements

---

## Changelog

### Version 2.0.0 (2025-10-25) 🎉 COMPLETE REWRITE
**Comprehensive Implementation Documentation with v1.3.0 UX Refinements**

**MAJOR CHANGES**:
- **Architecture Update**: Removed monorepo references, single Next.js app
- **Component Status**: All components marked as ✅ Fully Implemented
- **v1.3.0 UX Refinements**: Documented comprehensive UI improvements
  - Control test: Compact card positioned BEFORE FAQ results (first test, at top)
  - Metrics cards: Uniform black text (no color-coding)
  - FAQ questions: Displayed during loading with spinner skeletons
  - LLM responses: Collapsed by default, positioned under citations/sources
  - Visual hierarchy: Citations/sources are PRIMARY INSIGHTS
- **Progressive Loading**: Documented 7-status workflow with polling
- **Processing Clarification**: 100% synchronous (NO queue usage)
  - Queue infrastructure files exist but are NOT integrated
  - All processing happens in HTTP request
  - Progressive saves enable real-time UI updates

**FILES DOCUMENTED**:
- `src/app/api/results/[id]/route.ts` (161 lines)
- `src/app/results/[id]/page.tsx` (21 lines)
- `src/components/results-view.tsx` (603 lines)
- `src/repositories/results.repository.ts` (102 lines)
- `src/utils/test-results-formatter.ts` (123 lines)

**TOTAL IMPLEMENTATION**: 1,010 lines of production code documented

---

## Summary

The Results Display subsystem provides a sophisticated progressive loading experience with real-time polling updates every 3 seconds. The v1.3.0 UX refinements prioritize FAQ test results (citations/sources) as the most valuable insights, with the control test positioned compactly before FAQ results (first test, at top). Metrics cards use uniform black text for clarity. The system displays FAQ questions immediately during the loading phase with spinner skeletons, and collapses LLM responses by default under citations/sources. All processing is synchronous with progressive database saves enabling real-time UI updates. All components are fully implemented and operational in production.
