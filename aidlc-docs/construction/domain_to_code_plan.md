# Domain-to-Code Implementation Plan
## Article Analyzer - Cloudflare Workers Deployment

**Created**: 2025-10-20
**Status**: Planning Complete - Ready for Implementation
**Deployment Target**: Cloudflare Workers (via @opennextjs/cloudflare)
**Database**: Neon PostgreSQL with Drizzle ORM

---

## Executive Summary

This plan outlines the complete implementation of the Article Analyzer feature based on 6 verified domain models. The implementation will create production-quality code for deployment on Cloudflare Workers with Neon PostgreSQL backend.

**Domain Models**:
- Unit 1: Submission & Validation (6 components)
- Unit 2: Article Scraping (6 components)
- Unit 3: Question Generation (5 components)
- Unit 4: Search Testing (6 components)
- Unit 5: Results Display (7 components)
- Unit 6: Background Job Processing (5 components)

**Total Components**: 35 components to implement

---

## Clarifying Questions

### [Question 1] OpenAI API Access
Do you have an OpenAI API key with access to:
- GPT-4 Turbo (for question generation)
- GPT-5 with Responses API (for search testing)
- Sufficient credits for testing (~$5-10 for development/testing)

**[Answer]**
yes, we should be using gpt-4.1-mini for question generation and gpt-5 for search testing.  I have sufficient credits for testing.

### [Question 2] Neon Database Setup
Is your Neon PostgreSQL database already configured in `.dev.vars` with DATABASE_URL?

**[Answer]**
yes

### [Question 3] Cloudflare Account
Do you have a Cloudflare account with:
- Workers enabled
- Queues enabled (may require paid plan)
- Ability to create queue bindings

**[Answer]**
yes, we'll need to it add it to wrangler.jsonc when we get to that step.

### [Question 4] Testing Scope
For testing, should I:
- A) Create comprehensive unit + integration tests for all components
- B) Focus on critical path testing only
- C) Implement tests as we go, prioritizing core functionality

**[Answer]**
c

### [Question 5] Frontend Styling
For the frontend components, should I:
- A) Use existing shadcn/ui components with Tailwind
- B) Create custom components following the design from domain models
- C) Implement basic functional UI first, enhance later

**[Answer]**
Using shadcn/ui components with Tailwind is preferred for consistency and speed.
I've added some UI components from the dashboard install from shadcn (see @/app/dashboard/page.tsx) that can be referenced for styles and patterns.
But create custom components as needed to meet the requirements. Install shadcn
components as needed if so.
---

## Implementation Order & Dependencies

### Dependency Graph
```
Database Schema (foundational)
    ↓
Unit 1: Submission & Validation
    ↓
Unit 6: Job Processing (orchestrator)
    ├→ Unit 2: Article Scraping
    ├→ Unit 3: Question Generation
    └→ Unit 4: Search Testing
    ↓
Unit 5: Results Display
```

### Build Order
1. Database Schema
2. Unit 1 (creates queue messages)
3. Unit 2, 3, 4 (can be built in parallel, called by Unit 6)
4. Unit 6 (orchestrates 2, 3, 4)
5. Unit 5 (displays results)

---

## Phase 1: Foundation & Setup

### Step 1.1: Create UX Specification Document
- [ ] Create `aidlc-docs/construction/ux_spec.md`
- [ ] Document landing page (/) requirements
- [ ] Document results page (/results/[id]) requirements
- [ ] Specify API contracts for frontend
- [ ] Define component hierarchy
- [ ] Include wireframes/layout descriptions

### Step 1.2: Setup Project Structure
- [ ] Create `src/services/` directory for backend services
- [ ] Create `src/repositories/` for data access layer
- [ ] Create `src/utils/` for utility functions
- [ ] Create `src/types/` for shared TypeScript types
- [ ] Create `src/components/` for frontend components (already exists)
- [ ] Update `.gitignore` if needed

### Step 1.3: Configure Testing Infrastructure
- [ ] Install Vitest: `pnpm add -D vitest @vitest/ui`
- [ ] Create `vitest.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Create `src/__tests__/` directory structure
- [ ] Setup test utilities and mocks

### Step 1.4: Install Required Dependencies
- [ ] Install cheerio: `pnpm add cheerio`
- [ ] Install openai: `pnpm add openai` (may already be installed)
- [ ] Verify all dependencies from domain models
- [ ] Run `pnpm install` to ensure clean state

---

## Phase 2: Database Schema Implementation

**References**: All domain models (data entities)
**Epic**: Database Foundation
**Stories**: Supports all user stories

### Step 2.1: Create Drizzle Schema
- [ ] Update `src/db/schema.ts` with `contentAnalysisSubmissions` table
- [ ] Add `contentAnalysisResults` table
- [ ] Define all columns per domain model specifications
- [ ] Add indexes (status, userIP, createdAt, submissionId)
- [ ] Add foreign key constraints
- [ ] Export TypeScript types

**Schema Checklist**:
- [ ] `content_analysis_submissions`:
  - [ ] id (UUID, primary key)
  - [ ] url (TEXT)
  - [ ] userIP (VARCHAR(45), nullable)
  - [ ] status (VARCHAR(20), default 'pending')
  - [ ] generatedQuestions (JSONB, default '[]')
  - [ ] scrapingError (TEXT, nullable)
  - [ ] articleTitle (TEXT, nullable)
  - [ ] articleContent (TEXT, nullable)
  - [ ] createdAt (TIMESTAMP)
  - [ ] updatedAt (TIMESTAMP)
  - [ ] completedAt (TIMESTAMP, nullable)
- [ ] `content_analysis_results`:
  - [ ] id (SERIAL, primary key)
  - [ ] submissionId (UUID, foreign key)
  - [ ] question (TEXT)
  - [ ] targetUrlFound (BOOLEAN)
  - [ ] allCitations (JSONB)
  - [ ] allSources (JSONB)
  - [ ] foundInSources (BOOLEAN)
  - [ ] foundInCitations (BOOLEAN)
  - [ ] responseTimeMs (INTEGER)
  - [ ] createdAt (TIMESTAMP)

### Step 2.2: Push Schema to Database
- [ ] Run `pnpm db:push` to create tables
- [ ] Open Drizzle Studio: `pnpm db:studio`
- [ ] Verify tables exist
- [ ] Verify indexes created
- [ ] Test insert/select operations

### Step 2.3: Create Repository Layer
- [ ] Create `src/repositories/submission.repository.ts`
- [ ] Implement `createSubmission()`
- [ ] Implement `getSubmissionById()`
- [ ] Implement `updateSubmission()`
- [ ] Implement `countRecentSubmissionsByIP()`
- [ ] Create `src/repositories/results.repository.ts`
- [ ] Implement `saveResult()`
- [ ] Implement `getResultsBySubmission()`

### Step 2.4: Test Database Layer
- [ ] Write unit tests for repository functions
- [ ] Test CRUD operations
- [ ] Test query filters (by IP, by date range)
- [ ] Verify JSONB fields work correctly

---

## Phase 3: Unit 1 - Submission & Validation

**References**: `model_unit1_submission_validation.md`
**Epic**: Epic 1 - Article Submission & Validation
**Stories**: US-1.1, US-1.2, US-1.3

### Step 3.1: Create Utility Services
- [ ] Create `src/services/url-validator.service.ts`
  - [ ] Implement `validateFormat()`
  - [ ] Implement `validateProtocol()`
  - [ ] Implement `validateLength()`
  - [ ] Implement `checkSecurityRestrictions()`
  - [ ] Implement `isPrivateIP()`
  - [ ] Implement `sanitizeURL()`
- [ ] Create `src/services/rate-limiter.service.ts`
  - [ ] Implement `checkRateLimit()`
  - [ ] Implement `getRecentSubmissions()`
  - [ ] Implement `isRateLimitEnabled()`

### Step 3.2: Create API Route Handler
- [ ] Create `src/app/api/submit/route.ts`
- [ ] Implement POST handler
- [ ] Extract user IP from headers
- [ ] Validate URL using URLValidator
- [ ] Check rate limit using RateLimiter
- [ ] Create submission record
- [ ] Enqueue job to Cloudflare Queue
- [ ] Return success response
- [ ] Add error handling for all scenarios

### Step 3.3: Create Queue Integration
- [ ] Create `src/services/queue.service.ts`
- [ ] Implement `enqueueSubmission()`
- [ ] Define queue message format
- [ ] Handle queue errors

**Note**: Queue binding configuration deferred to Phase 7 (need wrangler.jsonc update)

### Step 3.4: Create Frontend Form Component
- [ ] Create `src/components/submit-form.tsx`
- [ ] Implement form state management
- [ ] Add URL input validation
- [ ] Handle form submission
- [ ] Display error messages
- [ ] Redirect to results page on success

### Step 3.5: Update Homepage
- [ ] Update `src/app/page.tsx`
- [ ] Add hero section
- [ ] Integrate SubmitForm component
- [ ] Add features section
- [ ] Add CTA sections
- [ ] Style with Tailwind CSS

### Step 3.6: Testing Unit 1
- [ ] Unit tests for URLValidator (valid/invalid URLs, private IPs)
- [ ] Unit tests for RateLimiter (under/over limit)
- [ ] Integration test for `/api/submit` endpoint
- [ ] Test rate limiting enforcement
- [ ] Test error responses (400, 429, 500)

---

## Phase 4: Unit 2 - Article Scraping

**References**: `model_unit2_article_scraping.md`
**Epic**: Epic 2 - Article Content Extraction
**Stories**: US-2.1, US-2.2, US-2.3, US-2.4, US-2.5

### Step 4.1: Create Core Scraper Service
- [ ] Create `src/services/article-scraper.service.ts`
  - [ ] Implement `scrapeArticle()`
  - [ ] Implement `buildHTTPHeaders()`
  - [ ] Implement `handleScrapingError()`
  - [ ] Define ScrapedArticle return type

### Step 4.2: Create HTML Fetcher
- [ ] Create `src/services/html-fetcher.service.ts`
  - [ ] Implement `fetchHTML()`
  - [ ] Implement timeout handling
  - [ ] Implement `validateResponse()`
  - [ ] Implement `handleHTTPError()`

### Step 4.3: Create HTML Parser
- [ ] Create `src/services/html-parser.service.ts`
  - [ ] Implement `parseHTML()` with cheerio
  - [ ] Implement `extractTitle()`
  - [ ] Implement `extractContent()`
  - [ ] Implement `extractHeadings()`
  - [ ] Implement `extractMetaDescription()`
  - [ ] Implement `cleanHTML()`

### Step 4.4: Create Content Extractors
- [ ] Create `src/utils/title-extractor.ts`
  - [ ] Define priority selectors
  - [ ] Implement `extract()`
  - [ ] Implement `trySelector()`
  - [ ] Implement `cleanTitle()`
- [ ] Create `src/utils/content-extractor.ts`
  - [ ] Define article selectors
  - [ ] Implement `extract()`
  - [ ] Implement `removeUnwantedElements()`
  - [ ] Implement `extractParagraphsAndHeadings()`
  - [ ] Implement `fallbackExtraction()`
- [ ] Create `src/utils/heading-extractor.ts`
  - [ ] Implement `extract()`
  - [ ] Implement `filterHeading()`

### Step 4.5: Testing Unit 2
- [ ] Unit tests for each extractor
- [ ] Integration test with real article URLs
- [ ] Test with various HTML structures (blog, news, docs)
- [ ] Test error scenarios (404, paywall, timeout)
- [ ] Verify content quality meets requirements

---

## Phase 5: Unit 3 - Question Generation

**References**: `model_unit3_question_generation.md`
**Epic**: Epic 3 - AI Question Generation
**Stories**: US-3.1, US-3.2, US-3.3

### Step 5.1: Create Question Generator Service
- [ ] Create `src/services/question-generator.service.ts`
  - [ ] Implement `generateQuestions()`
  - [ ] Implement `prepareArticleContext()`
  - [ ] Implement `buildPrompt()`
  - [ ] Implement `callOpenAI()`
  - [ ] Implement `parseResponse()`
  - [ ] Implement `validateQuestions()`

### Step 5.2: Create Prompt Builder
- [ ] Create `src/utils/prompt-builder.ts`
  - [ ] Implement `buildQuestionPrompt()`
  - [ ] Implement `truncateContent()`
  - [ ] Implement `formatHeadings()`
  - [ ] Define system and user message templates

### Step 5.3: Create OpenAI Client Wrapper
- [ ] Create `src/services/openai-client.service.ts`
  - [ ] Implement `initialize()`
  - [ ] Implement `createChatCompletion()`
  - [ ] Implement `handleAPIError()`
  - [ ] Implement `validateAPIKey()`

### Step 5.4: Create Response Parser
- [ ] Create `src/utils/response-parser.ts`
  - [ ] Implement `parseJSON()`
  - [ ] Implement `validateStructure()`
  - [ ] Implement `extractQuestions()`
  - [ ] Implement `extractSummary()`

### Step 5.5: Create Question Validator
- [ ] Create `src/utils/question-validator.ts`
  - [ ] Implement `validateAll()`
  - [ ] Implement `isValidQuestion()`
  - [ ] Implement `filterDuplicates()`
  - [ ] Implement `cleanQuestion()`

### Step 5.6: Testing Unit 3
- [ ] Unit tests for PromptBuilder
- [ ] Unit tests for ResponseParser
- [ ] Unit tests for QuestionValidator
- [ ] Integration test with real OpenAI API
- [ ] Verify question quality and relevance
- [ ] Test error handling (API errors, invalid responses)

---

## Phase 6: Unit 4 - Search Testing

**References**: `model_unit4_search_testing.md`
**Epic**: Epic 4 - AI Search Visibility Testing
**Stories**: US-4.1, US-4.2, US-4.3, US-4.4, US-4.5

### Step 6.1: Create Search Tester Service
- [ ] Create `src/services/search-tester.service.ts`
  - [ ] Implement `testAllQuestions()`
  - [ ] Implement `testSingleQuestion()`
  - [ ] Implement `addDelay()`
  - [ ] Implement `retryOnFailure()`
  - [ ] Implement `aggregateResults()`

### Step 6.2: Create Search Executor
- [ ] Create `src/services/search-executor.service.ts`
  - [ ] Implement `executeSearch()`
  - [ ] Implement `buildSearchConfig()`
  - [ ] Implement `measureResponseTime()`
  - [ ] Implement `handleAPIError()`

### Step 6.3: Create Response Parser (Search)
- [ ] Create `src/utils/search-response-parser.ts`
  - [ ] Implement `parseSearchResponse()`
  - [ ] Implement `extractSources()`
  - [ ] Implement `extractCitations()`
  - [ ] Implement `normalizeOutputItems()`

### Step 6.4: Create URL Matcher
- [ ] Create `src/utils/url-matcher.ts`
  - [ ] Implement `matchesTarget()`
  - [ ] Implement `cleanURL()`
  - [ ] Implement `extractCreativeID()`
  - [ ] Implement `checkExactMatch()`
  - [ ] Implement `checkCreativeMatch()`

### Step 6.5: Create Competitor Analyzer
- [ ] Create `src/utils/competitor-analyzer.ts`
  - [ ] Implement `analyzeCompetitors()`
  - [ ] Implement `extractDomain()`
  - [ ] Implement `aggregateDomainCounts()`
  - [ ] Implement `filterTargetDomain()`
  - [ ] Implement `sortByFrequency()`

### Step 6.6: Testing Unit 4
- [ ] Unit tests for URLMatcher (various URL formats)
- [ ] Unit tests for CompetitorAnalyzer
- [ ] Integration test with real OpenAI Responses API
- [ ] Test citation tracking accuracy
- [ ] Test rate limit handling
- [ ] Verify competitor identification

---

## Phase 7: Unit 6 - Background Job Processing

**References**: `model_unit6_job_processing.md`
**Epic**: Epic 6 - Background Job Processing
**Stories**: US-6.1, US-6.2, US-6.3, US-6.4

### Step 7.1: Create Job Orchestrator
- [ ] Create `src/services/job-orchestrator.service.ts`
  - [ ] Implement `execute()`
  - [ ] Implement `validateSubmission()`
  - [ ] Implement `updateStatus()`
  - [ ] Implement `runScrapingPhase()`
  - [ ] Implement `runQuestionGenerationPhase()`
  - [ ] Implement `runSearchTestingPhase()`
  - [ ] Implement `markCompleted()`
  - [ ] Implement `markFailed()`

### Step 7.2: Create Queue Consumer Worker
- [ ] Create `src/queue/consumer.ts` (Cloudflare Queue consumer)
  - [ ] Implement `queue()` handler function
  - [ ] Implement `consumeMessages()`
  - [ ] Implement `processMessage()`
  - [ ] Implement `acknowledgeMessage()`
  - [ ] Implement `retryMessage()`

### Step 7.3: Create Retry Manager
- [ ] Create `src/utils/retry-manager.ts`
  - [ ] Implement `shouldRetry()`
  - [ ] Implement `calculateDelay()`
  - [ ] Implement `incrementRetryCount()`
  - [ ] Implement `isRetryableError()`

### Step 7.4: Create Status Tracker
- [ ] Create `src/utils/status-tracker.ts`
  - [ ] Implement `updateStatus()`
  - [ ] Implement `validateTransition()`
  - [ ] Implement `logStatusChange()`

### Step 7.5: Create Job Monitor
- [ ] Create `src/utils/job-monitor.ts`
  - [ ] Implement `logJobStart()`
  - [ ] Implement `logJobComplete()`
  - [ ] Implement `logJobFailed()`
  - [ ] Implement `trackProcessingTime()`
  - [ ] Implement `trackErrorRate()`

### Step 7.6: Configure Cloudflare Queue
- [ ] Update `wrangler.jsonc`:
  - [ ] Add queue producer binding for `/api/submit`
  - [ ] Add queue consumer binding for worker
  - [ ] Configure retry settings
  - [ ] Configure dead letter queue
- [ ] Run `pnpm cf-typegen` to update types
- [ ] Test queue locally with `pnpm preview`

### Step 7.7: Testing Unit 6
- [ ] Unit tests for RetryManager
- [ ] Unit tests for StatusTracker
- [ ] Integration test: full job workflow
- [ ] Test retry logic with simulated failures
- [ ] Test error handling for each phase
- [ ] Verify queue message handling

---

## Phase 8: Unit 5 - Results Display

**References**: `model_unit5_results_display.md`
**Epic**: Epic 5 - Results Display & Analysis
**Stories**: US-5.1, US-5.2, US-5.3, US-5.4, US-5.5

### Step 8.1: Create Results API
- [ ] Create `src/app/api/results/[id]/route.ts`
  - [ ] Implement GET handler
  - [ ] Fetch submission by ID
  - [ ] Fetch all test results
  - [ ] Calculate summary statistics
  - [ ] Analyze competitors
  - [ ] Identify coverage gaps
  - [ ] Build comprehensive response

### Step 8.2: Create Summary Calculator
- [ ] Create `src/utils/summary-calculator.ts`
  - [ ] Implement `calculateSummary()`
  - [ ] Calculate success rate
  - [ ] Calculate average response time
  - [ ] Count found in sources/citations

### Step 8.3: Create Results Page
- [ ] Create `src/app/results/[id]/page.tsx`
  - [ ] Implement polling logic (useEffect)
  - [ ] Fetch results every 3 seconds
  - [ ] Handle loading/processing/completed states
  - [ ] Render appropriate component based on status

### Step 8.4: Create Loading Component
- [ ] Create `src/components/loading-state.tsx`
  - [ ] Display spinner
  - [ ] Show progress steps
  - [ ] Display status message
  - [ ] Show estimated time

### Step 8.5: Create Summary Stats Component
- [ ] Create `src/components/summary-stats.tsx`
  - [ ] Display 4 metric cards
  - [ ] Color-code success rate
  - [ ] Format percentages and counts

### Step 8.6: Create Competitors Component
- [ ] Create `src/components/competitors.tsx`
  - [ ] Display top 5 competitors
  - [ ] Show citation counts
  - [ ] Display percentage bars

### Step 8.7: Create Coverage Gaps Component
- [ ] Create `src/components/coverage-gaps.tsx`
  - [ ] Display missed questions
  - [ ] Show who ranked instead
  - [ ] Highlight as opportunities

### Step 8.8: Create Detailed Results Component
- [ ] Create `src/components/detailed-results.tsx`
  - [ ] Display all questions
  - [ ] Expandable details for citations
  - [ ] Color-code results

### Step 8.9: Testing Unit 5
- [ ] Unit tests for SummaryCalculator
- [ ] Integration test for `/api/results/[id]`
- [ ] Test polling behavior
- [ ] Test all UI states (loading, success, error, failed)
- [ ] Test with real data

---

## Phase 9: Integration & Testing

### Step 9.1: End-to-End Testing
- [ ] Test complete user flow:
  - [ ] Submit URL on homepage
  - [ ] Verify queue message created
  - [ ] Job processor runs all phases
  - [ ] Results display correctly
- [ ] Test with multiple article types
- [ ] Test concurrent submissions
- [ ] Test all error scenarios

### Step 9.2: Performance Testing
- [ ] Measure average processing time
- [ ] Verify rate limiting works
- [ ] Test under load (10 concurrent submissions)
- [ ] Monitor OpenAI API costs

### Step 9.3: Environment Configuration
- [ ] Update `.dev.vars.example` with all required vars
- [ ] Document Cloudflare secrets setup
- [ ] Create deployment checklist
- [ ] Document troubleshooting steps

---

## Phase 10: Deployment

### Step 10.1: Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] All environment variables documented
- [ ] Cloudflare Queue created in dashboard
- [ ] Neon database accessible from Cloudflare
- [ ] OpenAI API key has sufficient credits

### Step 10.2: Deploy to Cloudflare
- [ ] Run `pnpm build` - verify success
- [ ] Run `pnpm cf-typegen` - update types
- [ ] Set Cloudflare secrets:
  - [ ] `pnpm wrangler secret put DATABASE_URL`
  - [ ] `pnpm wrangler secret put OPENAI_API_KEY`
- [ ] Deploy: `pnpm run deploy`
- [ ] Verify deployment URL

### Step 10.3: Post-Deployment Verification
- [ ] Test submission on production URL
- [ ] Verify queue processing works
- [ ] Check Cloudflare Workers logs
- [ ] Monitor for errors
- [ ] Test results display

### Step 10.4: Documentation
- [ ] Update `.claude/CLAUDE.md` with deployment notes
- [ ] Document monitoring strategy
- [ ] Create troubleshooting guide
- [ ] Add cost tracking notes

---

## Epic/Story Reference Mapping

### Code Comments Convention
All code files must include epic/story references in header comments:

```typescript
/**
 * Article Analyzer - [Component Name]
 *
 * Epic: Epic [Number] - [Epic Name]
 * Stories: US-[X.Y], US-[X.Z]
 *
 * [Component Description]
 */
```

### Reference Table
- Epic 1 (US-1.1, US-1.2, US-1.3) → Unit 1 files
- Epic 2 (US-2.1 through US-2.5) → Unit 2 files
- Epic 3 (US-3.1, US-3.2, US-3.3) → Unit 3 files
- Epic 4 (US-4.1 through US-4.5) → Unit 4 files
- Epic 5 (US-5.1 through US-5.5) → Unit 5 files
- Epic 6 (US-6.1 through US-6.4) → Unit 6 files

---

## Success Criteria

### Functional Requirements
- ✅ User can submit article URL from homepage
- ✅ System validates URL and enforces rate limiting
- ✅ Article content is scraped and extracted
- ✅ 10 relevant questions are generated
- ✅ Each question is tested through AI search
- ✅ Results display citation performance and competitors
- ✅ User sees real-time progress updates
- ✅ All error scenarios handled gracefully

### Technical Requirements
- ✅ Production-quality TypeScript code
- ✅ Comprehensive test coverage
- ✅ No mock data in production
- ✅ All domain model components implemented
- ✅ Cloudflare Workers deployment successful
- ✅ Database schema matches specification
- ✅ Queue processing reliable and retryable

### Quality Requirements
- ✅ All tests passing
- ✅ No TypeScript errors
- ✅ Code follows project conventions
- ✅ Epic/story references in all files
- ✅ Error handling comprehensive
- ✅ Logging and monitoring in place

---

## Notes

- This plan follows AI DLC Domain-to-Code pattern adapted for Cloudflare
- No AWS/Terraform needed - using Cloudflare native services
- All domain models remain unchanged (verified by humans)
- Frontend and backend clearly separated
- Testing at each phase before proceeding
- Real production code - no placeholders or TODO comments

---

## Next Steps

1. Get answers to clarifying questions
2. Create UX Specification document
3. Begin Phase 1 implementation
4. Progress through phases sequentially
5. Test thoroughly at each step
6. Deploy to production
