# Domain Model: Unit 1 - Article Submission & Validation

**Version**: 2.0.0
**Last Updated**: 2025-10-25
**Epic**: Epic 1 - Article Submission & Validation
**User Stories**: US-1.1, US-1.2, US-1.3
**Status**: ✅ Fully Implemented

---

## Executive Summary

This domain model documents the **current implementation** of article URL submission with validation and rate limiting for the datagum.ai Article Analyzer. The system is a **single Next.js application** deployed to Cloudflare using OpenNext.js, featuring client-side form submission, server-side validation, rate limiting enforcement, and background job orchestration.

### Key Business Requirements (Implemented)
- Accept article URLs from users via homepage form
- Validate URL format and security constraints
- Enforce 3 submissions per IP per 24-hour rate limit
- Create unique submission record with pending status
- Process article analysis in background using `ctx.waitUntil()`
- Redirect user to results page with progressive loading

### Architecture
- **Framework**: Next.js 15.4.6 with App Router and React 19.1.0
- **Runtime**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Background Processing**: `ctx.waitUntil()` for non-blocking async operations
- **No Monorepo**: Single application structure (NOT Turborepo)

---

## Component Overview

| Component | Type | Location | Lines | Status |
|-----------|------|----------|-------|--------|
| SubmitForm | Client Component | `src/components/submit-form.tsx` | 94 | ✅ Implemented |
| SubmissionAPIHandler | API Route | `src/app/api/submit/route.ts` | 148 | ✅ Implemented |
| URLValidatorService | Service | `src/services/url-validator.service.ts` | 112 | ✅ Implemented |
| RateLimiterService | Service | `src/services/rate-limiter.service.ts` | 57 | ✅ Implemented |
| SubmissionRepository | Repository | `src/repositories/submission.repository.ts` | 219 | ✅ Implemented |
| AnalysisService | Service | `src/services/analysis.service.ts` | 320 | ✅ Implemented |
| Database Schema | Schema | `src/db/schema.ts` | 196 | ✅ Implemented |

---

## Component Details

### 1. SubmitForm (Client Component)

**Location**: `src/components/submit-form.tsx` (94 lines)
**Type**: React Client Component
**Responsibility**: Captures user input and handles form submission on the landing page

**Implementation**:
```typescript
'use client'

export function SubmitForm() {
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message)
        return
      }

      const data = await response.json()
      router.push(`/results/${data.submissionId}`)
    } catch (error) {
      setError('Failed to submit URL')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ... form JSX with shadcn/ui components
  // Inline error display below input field
}
```

**Key Features**:
- Uses `shadcn/ui` components (Input, Button)
- Displays loading state during submission
- Shows inline error messages (NOT toasts)
- Redirects to results page on success
- Real-time validation feedback

**Interactions**:
- Calls `POST /api/submit` endpoint
- Receives submission ID and redirects to `/results/[id]`
- Displays error messages from API

---

### 2. SubmissionAPIHandler (API Route)

**Location**: `src/app/api/submit/route.ts` (148 lines)
**Type**: Next.js App Router API Route
**Responsibility**: Handles POST /api/submit endpoint for article submissions

**Function Signature**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse>
```

**Implementation Flow**:
1. Parse request body and extract URL
2. Sanitize and validate URL format
3. Extract user IP from request headers
4. Check rate limit (3 submissions per 24 hours)
5. Create submission record in database
6. Get Cloudflare context for background processing
7. Return immediate response with submission ID
8. Run article analysis in background via `ctx.waitUntil()`

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

**Background Processing** (lines 61-69):
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

**Error Handling**:
- Rate limit errors: 429 Too Many Requests
- Validation errors: 400 Bad Request
- Server errors: 500 Internal Server Error

**Dependencies**:
- `validateURL()`, `sanitizeURL()` from url-validator.service
- `checkRateLimit()` from rate-limiter.service
- `createSubmission()` from submission.repository
- `analyzeArticle()` from analysis.service
- `getCloudflareContext()` from @opennextjs/cloudflare

---

### 3. URLValidatorService

**Location**: `src/services/url-validator.service.ts` (112 lines)
**Type**: Validation Service
**Responsibility**: Validates URL format and security constraints

**Public Functions**:

```typescript
export function validateURL(url: string): void
export function sanitizeURL(url: string): string
```

**Validation Rules Implemented**:
1. Must be valid HTTP or HTTPS URL
2. Cannot exceed 2000 characters
3. Cannot be localhost (127.0.0.1, ::1, localhost)
4. Cannot be private IP (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
5. Cannot be link-local (169.254.x.x)
6. Must have valid protocol (http/https only)

**Security Features**:
- SSRF protection via private IP blocking
- DoS prevention via length limits
- Protocol restriction prevents non-HTTP protocols
- URL encoding normalization

**Error Handling**:
- Throws generic `Error` objects with descriptive messages
- Errors are caught by API route handler
- Messages are user-friendly and actionable

**Usage**:
```typescript
import { validateURL, sanitizeURL } from '@/services/url-validator.service'

const cleanUrl = sanitizeURL(userInput)
validateURL(cleanUrl) // Throws URLValidationError if invalid
```

---

### 4. RateLimiterService

**Location**: `src/services/rate-limiter.service.ts` (57 lines)
**Type**: Service
**Responsibility**: Enforces submission rate limits per IP address

**Public Functions**:

```typescript
export async function checkRateLimit(userIp: string): Promise<void>
```

**Business Logic**:
- Maximum: 3 submissions per IP per 24 hours
- Throws `RateLimitError` if limit exceeded
- Queries database for recent submissions
- Rolling 24-hour window

**Implementation**:
```typescript
const MAX_SUBMISSIONS = 3
const WINDOW_HOURS = 24

export async function checkRateLimit(userIp: string): Promise<void> {
  const count = await countRecentSubmissionsByIP(
    userIp,
    WINDOW_HOURS
  )

  if (count >= MAX_SUBMISSIONS) {
    throw new RateLimitError(
      `Rate limit exceeded. You can analyze ${MAX_SUBMISSIONS} articles per day. Please try again later.`
    )
  }
}
```

**Error Class**:
```typescript
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

**Dependencies**:
- `countRecentSubmissionsByIP()` from submission.repository

---

### 5. SubmissionRepository

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

export async function countRecentSubmissionsByIP(
  userIp: string,
  hoursAgo: number = 24
): Promise<number>

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
```

**Database Access**:
- Uses `getDb()` for API routes
- Uses `getDbFromEnv(env)` for background jobs
- All queries use Drizzle ORM with type safety
- Automatic timestamp management

**Key Features**:
- UUID primary keys
- Timestamp tracking (createdAt, updatedAt, completedAt)
- JSON storage for FAQs and test metrics
- Indexed queries for performance

---

### 6. AnalysisService (Background Processing)

**Location**: `src/services/analysis.service.ts` (320 lines)
**Type**: Orchestration Service
**Responsibility**: Manages complete article analysis workflow in background

**Public Function**:

```typescript
export async function analyzeArticle(
  submissionId: string,
  url: string
): Promise<AnalysisResult>
```

**Workflow Phases**:
1. **Scraping** (status: 'scraping'): Fetch and parse article content
2. **FAQ Generation** (status: 'generating_faqs'): Create 5 FAQ pairs with AI
3. **Control Test** (status: 'running_control'): Verify article accessibility (Tier 1)
4. **FAQ Testing** (status: 'testing_faqs'): Test FAQs through OpenAI search (Tier 2 & 3)
5. **Completion** (status: 'completed' or 'failed')

**Progressive Updates**:
- Updates submission status after each phase
- Saves FAQs immediately after generation
- Saves control test result before FAQ testing
- Saves individual FAQ test results as they complete
- Updates test metrics after all tests complete

**Error Handling**:
- Catches errors at each phase
- Updates status to 'failed' with error message
- Continues with fallback FAQs if generation fails
- Returns detailed error information

**Dependencies**:
- `scrapeArticle()` from scraper.service
- `generateFAQs()` from faq-generator.service
- `runControlTest()`, `runSearchTest()` from search-tester.service
- Database repository functions for status updates

---

### 7. Database Schema

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
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    // Indexes for query performance
    statusIdx: index('content_analysis_submissions_status_idx')
      .on(table.status),
    userIpIdx: index('content_analysis_submissions_user_ip_idx')
      .on(table.userIp),
    createdAtIdx: index('content_analysis_submissions_created_at_idx')
      .on(table.createdAt),
  })
)
```

**Status Workflow**:
```
pending → scraping → generating_faqs → running_control → testing_faqs → completed
                                                                       ↘ failed
```

**JSONB Field Structures**:

**generatedFaqs**:
```typescript
Array<{
  question: string      // 40-70 characters
  answer: string        // 120-180 characters
  category: 'what-is' | 'how-why' | 'technical' | 'comparative' | 'action'
  numbers: string[]     // Extracted numbers used in FAQ
}>
```

**testMetrics**:
```typescript
{
  isAccessible: boolean        // Tier 1: Control test passed
  inSourcesCount: number       // Tier 2: Count of FAQs found in sources
  inCitationsCount: number     // Tier 3: Count of FAQs cited
  totalFaqs: number           // Total FAQs tested
}
```

**Indexes**:
- `status`: For querying pending/processing submissions
- `userIp`: For rate limiting queries
- `createdAt`: For time-based filtering

**Type Exports**:
```typescript
export type Submission = typeof contentAnalysisSubmissions.$inferSelect
export type NewSubmission = typeof contentAnalysisSubmissions.$inferInsert
export type SubmissionStatus =
  | 'pending' | 'scraping' | 'generating_faqs'
  | 'running_control' | 'testing_faqs' | 'completed' | 'failed'
```

---

## Data Flow

### Submission Flow Sequence

1. **User Input** (SubmitForm):
   - User enters URL in form
   - Client-side validation on input
   - User clicks "Analyze Article" button

2. **API Request**:
   - POST /api/submit with URL in body
   - Headers include IP address information

3. **Server-Side Processing** (SubmissionAPIHandler):
   ```
   Parse request body
   ↓
   Sanitize URL (url-validator.service)
   ↓
   Validate URL format (url-validator.service)
   ↓
   Extract user IP from headers
   ↓
   Check rate limit (rate-limiter.service)
   ↓
   Create submission record (submission.repository)
   ↓
   Get Cloudflare context
   ↓
   Return response immediately (200 OK)
   ↓
   Start background analysis via ctx.waitUntil()
   ```

4. **Immediate Response**:
   ```json
   {
     "submissionId": "uuid-here",
     "url": "https://example.com/article",
     "status": "pending",
     "message": "Analysis started",
     "resultsUrl": "/results/uuid-here"
   }
   ```

5. **Client Redirect**:
   - SubmitForm redirects to `/results/[id]`
   - Results page begins polling for updates

6. **Background Analysis** (analysis.service):
   ```
   Status: scraping
   → Scrape article content
   → Save article title and content

   Status: generating_faqs
   → Generate 5 FAQ pairs with AI
   → Save FAQs to database

   Status: running_control
   → Test article accessibility
   → Save control test result

   Status: testing_faqs (if accessible)
   → Test each FAQ through OpenAI search
   → Save individual results progressively
   → Calculate and save test metrics

   Status: completed
   → Final metrics saved
   → completedAt timestamp set
   ```

7. **Progressive Updates**:
   - Results page polls `/api/results/[id]` every 3 seconds
   - Displays status updates and generated FAQs
   - Shows test results as they complete
   - Stops polling when status is 'completed' or 'failed'

### Error Handling Flow

**Validation Error (400)**:
```
URLValidator.validateURL() throws Error
↓
SubmissionAPIHandler catches error
↓
Returns 400 Bad Request with error message
↓
SubmitForm displays inline error message
```

**Rate Limit Error (429)**:
```
RateLimiter.checkRateLimit() throws RateLimitError
↓
SubmissionAPIHandler catches error
↓
Returns 429 Too Many Requests with error message
↓
SubmitForm displays inline error message
```

**Background Analysis Error**:
```
analyzeArticle() catches error in any phase
↓
Updates status to 'failed'
↓
Saves error message to scrapingError field
↓
Results page displays error state
```

---

## Integration Points

### Frontend to Backend
- **Endpoint**: POST /api/submit
- **Request**: `{ url: string }`
- **Response**: Submission details with UUID
- **Error Codes**: 400 (validation), 429 (rate limit), 500 (server error)

### Background Processing
- **Trigger**: `ctx.waitUntil(analyzeArticle(...))`
- **Method**: Cloudflare Workers waitUntil API
- **Non-blocking**: Response sent before analysis completes
- **Status Updates**: Progressive database updates

### Database Layer
- **ORM**: Drizzle ORM
- **Connection**: Neon PostgreSQL via HTTP driver
- **Access Pattern**: Direct queries (no connection pooling needed)
- **Type Safety**: Full TypeScript inference from schema

### Results Polling
- **Endpoint**: GET /api/results/[id]
- **Interval**: 3 seconds
- **Until**: status === 'completed' || status === 'failed'
- **Data**: Submission, test results, statistics

---

## Type System

### Core Types

```typescript
// Submission entity
export type Submission = {
  id: string
  url: string
  userIp: string | null
  status: SubmissionStatus
  generatedFaqs: StoredFAQ[]
  testMetrics: TestMetricsData | null
  scrapingError: string | null
  articleTitle: string | null
  articleContent: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

// Status type
export type SubmissionStatus =
  | 'pending'
  | 'scraping'
  | 'generating_faqs'
  | 'running_control'
  | 'testing_faqs'
  | 'completed'
  | 'failed'

// FAQ structure
export interface StoredFAQ {
  question: string
  answer: string
  category: 'what-is' | 'how-why' | 'technical' | 'comparative' | 'action'
  numbers: string[]
}

// Test metrics
export interface TestMetricsData {
  isAccessible: boolean
  inSourcesCount: number
  inCitationsCount: number
  totalFaqs: number
}

// API response
export interface SubmitResponse {
  submissionId: string
  url: string
  status: 'pending'
  message: string
  resultsUrl: string
}
```

---

## Configuration

### Constants

**Rate Limiting** (rate-limiter.service.ts):
```typescript
const MAX_SUBMISSIONS = 3
const WINDOW_HOURS = 24
```

**URL Validation** (url-validator.service.ts):
```typescript
const MAX_URL_LENGTH = 2000
const ALLOWED_PROTOCOLS = ['http:', 'https:']
```

**Background Processing** (analysis.service.ts):
```typescript
const DEFAULT_FAQ_COUNT = 5
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/db

# OpenAI (for background analysis)
OPENAI_API_KEY=sk-...
```

---

## Error Handling

### Custom Error Classes

```typescript
// Rate Limiting
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

**Note**: URL validation errors use generic `Error` class rather than a custom error type.

### API Error Responses

**400 Bad Request**:
```json
{
  "message": "Invalid URL format. Please enter a valid HTTP or HTTPS URL."
}
```

**429 Too Many Requests**:
```json
{
  "message": "Rate limit exceeded. You can analyze 3 articles per day. Please try again later."
}
```

**500 Internal Server Error**:
```json
{
  "message": "An error occurred. Please try again."
}
```

---

## Current Status

### Implementation Progress: 100%

All components are fully implemented and deployed:

✅ **SubmitForm** - Client component with form validation and submission
✅ **SubmissionAPIHandler** - API route with background processing
✅ **URLValidatorService** - Full validation and sanitization
✅ **RateLimiterService** - IP-based rate limiting
✅ **SubmissionRepository** - Complete database operations
✅ **AnalysisService** - Background job orchestration
✅ **Database Schema** - 7-status workflow with JSONB fields

### Production Deployment

- **Platform**: Cloudflare Workers
- **Framework**: Next.js 15 with OpenNext.js
- **Database**: Neon PostgreSQL
- **Status**: Live and operational

---

## Dependencies

### External Services
- **Neon PostgreSQL**: Database storage
- **Cloudflare Workers**: Runtime environment
- **OpenAI API**: Background analysis (via analysis.service)

### Framework Libraries
- **Next.js 15.4.6**: App Router, API Routes
- **React 19.1.0**: Client components
- **Drizzle ORM**: Database queries
- **@opennextjs/cloudflare**: Cloudflare Workers adapter

### UI Libraries
- **shadcn/ui**: Form components (Input, Button)
- **Tailwind CSS v4**: Styling
- **lucide-react**: Icons

### Type Safety
- **TypeScript**: Strict mode enabled
- **Zod**: Runtime validation (not used in this unit, but available)

---

## Code Examples

### Submitting an Article (Client)

```typescript
// In SubmitForm component
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      const errorData = await response.json()
      setError(errorData.message)
      return
    }

    const data = await response.json()
    router.push(`/results/${data.submissionId}`)
  } catch (error) {
    setError('Failed to submit URL')
  } finally {
    setIsSubmitting(false)
  }
}
```

### API Route Handler (Server)

```typescript
// In src/app/api/submit/route.ts
export async function POST(request: NextRequest) {
  try {
    // Parse and validate
    const { url } = await request.json()
    const cleanUrl = sanitizeURL(url)
    validateURL(cleanUrl)

    // Rate limiting
    const userIp = extractUserIP(request)
    if (userIp) {
      await checkRateLimit(userIp)
    }

    // Create submission
    const submission = await createSubmission(cleanUrl, userIp)

    // Background processing
    const { ctx } = await getCloudflareContext()
    const response = NextResponse.json({
      submissionId: submission.id,
      url: submission.url,
      status: 'pending',
      message: 'Analysis started',
      resultsUrl: `/results/${submission.id}`
    })

    ctx.waitUntil(
      analyzeArticle(submission.id, submission.url).catch(console.error)
    )

    return response
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { message: error.message },
        { status: 429 }
      )
    }
    // ... other error handling
  }
}
```

### Database Query (Repository)

```typescript
// In submission.repository.ts
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

---

## Changelog

### Version 2.0.0 (2025-10-25) 🎉 COMPLETE REWRITE
**Comprehensive Implementation Documentation**

This version represents a complete rewrite of the domain model to accurately reflect the current production implementation.

**MAJOR CHANGES**:
- **Architecture Update**: Removed all monorepo/Turborepo references
  - Changed from `apps/web` to single Next.js application structure
  - Updated all file paths to actual locations (e.g., `src/components/submit-form.tsx`)
  - Removed queue-worker references (uses `ctx.waitUntil()` instead)
- **Component Status**: All components marked as ✅ Fully Implemented
  - SubmitForm: 94 lines (inline error display, no toasts)
  - SubmissionAPIHandler: 148 lines (updated with actual implementation)
  - URLValidatorService: 112 lines (throws generic Error, not custom class)
  - RateLimiterService: 57 lines (uses MAX_SUBMISSIONS and WINDOW_HOURS constants)
  - SubmissionRepository: 219 lines (complete database operations)
  - AnalysisService: 320 lines (orchestrates background processing)
- **Background Processing**: Updated to use Cloudflare `ctx.waitUntil()`
  - Removed Cloudflare Queue references
  - Documented actual implementation with `analyzeArticle()` service
  - Non-blocking async processing after immediate response
- **Status Workflow**: Updated to 7-status workflow
  - Added: scraping, generating_faqs, running_control, testing_faqs
  - Previous: pending → processing → completed/failed
  - Current: pending → scraping → generating_faqs → running_control → testing_faqs → completed/failed
- **Database Schema**: Updated with actual JSONB structures
  - generatedFaqs: Array of FAQ objects (not just questions)
  - testMetrics: 3-tier test results object
  - Removed generatedQuestions field (replaced by generatedFaqs)
- **Data Flow**: Completely rewritten to reflect progressive updates
  - Documented polling mechanism (3-second intervals)
  - Progressive result saving during background processing
  - Real-time status updates to database
- **Type System**: Added comprehensive TypeScript types
  - StoredFAQ interface for FAQ structure
  - TestMetricsData interface for metrics
  - SubmitResponse interface for API response
- **Code Examples**: All examples now use actual production code
  - Real function signatures from implementation
  - Actual file paths and line numbers
  - Working code snippets that match codebase

**DOCUMENTATION IMPROVEMENTS**:
- Added Component Overview table with line counts
- Expanded Component Details with actual implementations
- Added Integration Points section
- Added Type System section with all interfaces
- Added Configuration section with actual constants
- Updated all code examples to match production code
- Removed aspirational features and TODOs

**FILES DOCUMENTED**:
- `src/components/submit-form.tsx` (94 lines)
- `src/app/api/submit/route.ts` (148 lines)
- `src/services/url-validator.service.ts` (112 lines)
- `src/services/rate-limiter.service.ts` (57 lines)
- `src/repositories/submission.repository.ts` (219 lines)
- `src/services/analysis.service.ts` (320 lines)
- `src/db/schema.ts` (196 lines)

**TOTAL IMPLEMENTATION**: 1,146 lines of production code documented

### Version 1.1.2 (2025-10-23)
- Fixed IP extraction priority for Cloudflare Workers
- Documented `extractUserIP()` multi-tier extraction logic

### Version 1.1.1 (2025-10-21)
- Updated UI theme from Zinc to Slate colors
- Added OKLCH color space documentation

### Version 1.1.0 (2025-10-21)
- Migrated to Turborepo monorepo structure
- Added Cloudflare Queue integration

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
