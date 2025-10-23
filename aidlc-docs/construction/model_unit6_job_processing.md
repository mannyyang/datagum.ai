# Domain Model: Unit 6 - Background Job Processing

**Version**: 3.0.0
**Last Updated**: 2025-10-21
**Epic**: Epic 6 - Background Job Processing
**User Stories**: US-6.1, US-6.2, US-6.3, US-6.4
**Status**: ✅ Fully Implemented (Cloudflare Queue Infrastructure Complete, Worker Wrapper Pattern, Local Preview Working)

---

## Executive Summary

This domain model defines the background job processing system that orchestrates the entire article analysis workflow. Using **Cloudflare Queues** with **OpenNext.js for Cloudflare**, the system processes submissions asynchronously through scraping, question generation, and search testing phases with retry logic and error handling.

### Architecture (v3.0.0)
- **Producer**: Next.js app sends messages to Cloudflare Queue via `env.ARTICLE_ANALYSIS_QUEUE.send()`
- **Consumer**: Custom worker wrapper (`worker-wrapper.ts`) extends OpenNext worker to add queue handler
- **Shared Types**: Type-safe message definitions in `src/lib/shared/queue-messages.ts`
- **Single App**: Consolidated Next.js app with OpenNext.js for Cloudflare deployment

### ✅ QUEUE PROCESSING VERIFIED WORKING!
**Complete end-to-end queue flow confirmed in local preview!**

**How It Works**:
- **Development** (`pnpm dev` on port 4444): Fast Next.js with Turbopack, queue producer works, consumer doesn't run
- **Testing** (`pnpm preview` on port 8787): OpenNext.js Cloudflare preview with full queue consumer processing
- **Production** (`pnpm deploy`): Deployed to Cloudflare with real queues

**Worker Wrapper Pattern**:
```typescript
// worker-wrapper.ts - Extends OpenNext worker with queue consumer
import { queueHandler } from './src/queue/handler'
import worker from './.open-next/worker.js'

export default {
  ...worker,  // All OpenNext HTTP handlers
  async queue(batch, env, ctx) {  // Custom queue consumer
    return queueHandler(batch, env, ctx)
  },
}
```

**Configuration**:
1. `wrangler.jsonc`: Both producer and consumer bindings
   ```jsonc
   {
     "main": "worker-wrapper.ts",  // Custom wrapper instead of .open-next/worker.js
     "queues": {
       "producers": [{ "binding": "ARTICLE_ANALYSIS_QUEUE", "queue": "datagum-queue" }],
       "consumers": [{ "queue": "datagum-queue", "max_batch_size": 10, ... }]
     }
   }
   ```

2. `next.config.ts`: OpenNext.js Cloudflare initialization
   ```typescript
   import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
   initOpenNextCloudflareForDev()
   ```

**Benefits**:
- ✅ Fast development with `next dev` (HMR, Turbopack, fast refresh)
- ✅ Full queue testing with `opennextjs-cloudflare preview`
- ✅ Single codebase - no monorepo complexity
- ✅ Type-safe queue messages with Zod validation
- ✅ Automatic retry and dead letter queue handling

### Key Business Requirements
- Consume submissions from Cloudflare Queue
- Execute analysis workflow in sequence (scrape → generate → test)
- Update submission status at each phase
- Implement retry logic (up to 3 attempts with exponential backoff)
- Handle errors gracefully without crashing
- Track processing time and success rates
- Mark submission as completed or failed

### Related User Stories
- **US-6.1**: Queue Job Creation
- **US-6.2**: Job Execution Flow
- **US-6.3**: Job Retry Logic
- **US-6.4**: Job Monitoring

---

## Component Overview

### 1. QueueConsumerWorker ✅
**Type**: Cloudflare Queue Consumer
**Location**: `worker-wrapper.ts` (extends OpenNext worker)
**Responsibility**: Listens to Cloudflare Queue and processes submission jobs

**Implementation Status**: ✅ Fully implemented with worker wrapper pattern

**Attributes**:
- `queueBinding`: CloudflareQueue - Queue consumer binding (ARTICLE_ANALYSIS_QUEUE)
- `maxRetries`: number - Maximum retry attempts (3, configured in wrangler.jsonc)
- `maxBatchSize`: number - Maximum messages per batch (10)
- `maxBatchTimeout`: number - Maximum wait time for batch (30 seconds)

**Behaviors**:
- `queue(batch, env, ctx)`: void - Main queue handler (exported from worker-wrapper.ts)
- `queueHandler(batch, env, ctx)`: void - Processes batches of messages (in src/queue/handler.ts)
- `processMessage(message)`: void - Routes to appropriate message handler
- Message automatically acknowledged by Cloudflare on success
- Message automatically retried by Cloudflare on failure (sent to DLQ after max retries)

**Queue Message Structure** (defined in `src/lib/shared/queue-messages.ts`):
```typescript
export const SubmissionJobMessageSchema = z.object({
  type: z.literal('process-submission'),
  payload: z.object({
    submissionId: z.string().uuid(),
    url: z.string().url(),
    userId: z.string().optional(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type SubmissionJobMessage = z.infer<typeof SubmissionJobMessageSchema>
```

**Consumer Configuration** (`wrangler.jsonc`):
```jsonc
{
  "main": "worker-wrapper.ts",
  "queues": {
    "producers": [
      {
        "binding": "ARTICLE_ANALYSIS_QUEUE",
        "queue": "datagum-queue"
      }
    ],
    "consumers": [
      {
        "queue": "datagum-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "datagum-dlq"
      }
    ]
  }
}
```

**Interactions**:
- Receives messages from Cloudflare Queue (sent by Next.js app)
- Routes to appropriate handler based on message type
- Calls `JobOrchestrator` for 'process-submission' messages
- Cloudflare automatically manages message lifecycle (ack/retry)

---

### 2. JobOrchestrator ✅
**Type**: Service
**Location**: `src/queue/services/job-orchestrator.ts`
**Responsibility**: Orchestrates the complete analysis workflow for a submission

**Implementation Status**: ✅ Implemented with placeholder phase logic (actual scraping/generation/testing pending)

**Attributes**:
- `submissionId`: UUID - Current job being processed
- `startTime`: number - Job start timestamp
- `services`: { scraper, questionGen, searchTester } - Service instances
- `db`: Database connection - Neon PostgreSQL via Drizzle ORM

**Behaviors**:
- `execute(submissionId, env)`: Promise<void> - Main entry point
- `validateSubmission()`: Promise<Submission> - Checks submission exists
- `updateStatus(status)`: Promise<void> - Updates submission status
- `runScrapingPhase()`: Promise<ScrapedArticle> - Executes Unit 2
- `runQuestionGenerationPhase(article)`: Promise<Questions> - Executes Unit 3
- `runSearchTestingPhase(questions, url)`: Promise<Results> - Executes Unit 4
- `markCompleted()`: Promise<void> - Finalizes successful job
- `markFailed(error)`: Promise<void> - Handles job failure
- `calculateDuration()`: number - Gets total processing time

**Workflow Sequence**:
```
1. Validate submission exists
2. Update status: 'processing'
3. Run scraping phase (Unit 2)
4. Store article title and content
5. Run question generation phase (Unit 3)
6. Store generated questions
7. Run search testing phase (Unit 4)
8. Store individual test results
9. Update status: 'completed'
10. Set completedAt timestamp
```

**Error Handling at Each Phase**:
- **Scraping fails**: Mark submission as failed, store error
- **Question generation fails**: Mark as failed, store error
- **Search testing fails**: Store partial results, mark as completed with warnings
- **Any exception**: Throw error for retry logic

**Interactions**:
- Called by `QueueConsumerWorker` with submissionId
- Uses `ArticleScraperService` (Unit 2)
- Uses `QuestionGeneratorService` (Unit 3)
- Uses `SearchTesterService` (Unit 4)
- Uses `SubmissionRepository` to update status
- Uses `ResultsRepository` to store test results

---

### 3. RetryManager ✅
**Type**: Utility Component
**Location**: `src/lib/shared/utils.ts` (`retryWithBackoff` function)
**Responsibility**: Manages retry logic and exponential backoff

**Implementation Status**: ✅ Implemented as reusable utility function

**Attributes**:
- `maxRetries`: number - 3 (configurable)
- `baseDelay`: number - 1000ms (configurable)
- `backoffMultiplier`: number - 2 (exponential)

**Behaviors**:
- `retryWithBackoff<T>(fn, options)`: Promise<T> - Retries async function with exponential backoff
- Automatic retry on failure with configurable delays
- Throws error after max retries exceeded

**Implementation**:
```typescript
// src/lib/shared/utils.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, backoffMultiplier = 2 } = options
  // ... exponential backoff logic
}
```

**Note**: Cloudflare Queues also provides automatic retry at the infrastructure level (configured in `wrangler.jsonc`)

**Exponential Backoff Formula**:
```
delay = baseDelay * (backoffMultiplier ^ retryCount)
Attempt 1: 2000ms * 2^0 = 2 seconds
Attempt 2: 2000ms * 2^1 = 4 seconds
Attempt 3: 2000ms * 2^2 = 8 seconds
```

**Retryable Errors**:
- Network timeouts
- API rate limits (429)
- Temporary service unavailability (503)
- Database connection errors

**Non-Retryable Errors**:
- Invalid URL (validation failed)
- Article not found (404)
- Paywalled content (403)
- Missing API keys (configuration error)

**Interactions**:
- Called by `QueueConsumerWorker` to determine retry behavior
- Used to calculate delays between retries

---

### 4. StatusTracker ⚠️
**Type**: Utility Component
**Location**: `src/queue/services/status-tracker.ts` (to be implemented)
**Responsibility**: Tracks and updates submission status through workflow

**Implementation Status**: ⚠️ Planned - will be integrated into JobOrchestrator

**Attributes**:
- `validStatuses`: enum - ['pending', 'processing', 'completed', 'failed'] (defined in database schema)
- `statusTransitions`: Map - Valid status transitions
- `db`: Database connection - for persisting status updates

**Behaviors**:
- `updateStatus(submissionId, newStatus)`: Promise<void> - Updates database
- `validateTransition(currentStatus, newStatus)`: boolean - Checks if allowed
- `logStatusChange(submissionId, from, to)`: void - Audit logging

**Valid Status Transitions**:
```
pending → processing
processing → completed
processing → failed
failed → processing (retry)
```

**Status Meanings**:
- **pending**: Submission created, waiting for processing
- **processing**: Currently being analyzed
- **completed**: All phases successful
- **failed**: Unrecoverable error occurred

**Interactions**:
- Called by `JobOrchestrator` at each workflow phase
- Updates `SubmissionRepository`
- Provides audit trail

---

### 5. JobMonitor ⚠️
**Type**: Monitoring/Logging Service
**Location**: `src/queue/services/job-monitor.ts` (to be implemented)
**Responsibility**: Tracks job performance metrics and errors

**Implementation Status**: ⚠️ Planned - will use Cloudflare Workers Analytics

**Attributes**:
- `metrics`: Analytics Binding - Cloudflare Workers Analytics
- `logger`: console - Structured logging to Cloudflare Workers logs

**Behaviors**:
- `logJobStart(submissionId)`: void - Records job initiation
- `logJobComplete(submissionId, duration)`: void - Records success
- `logJobFailed(submissionId, error, retryCount)`: void - Records failure
- `trackProcessingTime(phase, duration)`: void - Metrics per phase
- `trackErrorRate(errorType)`: void - Error categorization
- `alertOnHighFailureRate()`: void - Monitoring alerts via Cloudflare Alerts

**Tracked Metrics**:
- Average processing time per submission
- Success rate (completed vs failed)
- Error rates by type (scraping, API, network)
- Retry rates
- Queue depth/backlog

**Logging Levels**:
- **INFO**: Job start, completion, status changes
- **WARN**: Retries, partial failures
- **ERROR**: Fatal errors, max retries exceeded

**Interactions**:
- Called throughout `JobOrchestrator` workflow
- Sends metrics to monitoring service (Cloudflare Analytics)
- Logs to Cloudflare Workers logs

---

## Component Interactions

### Job Processing Flow Sequence

1. **Submission Enqueued** (from Unit 1 in Next.js app):
   - User submits article URL via web app
   - Submission record created in database with status 'pending'
   - API route calls `env.ARTICLE_ANALYSIS_QUEUE.send(message)` to enqueue job
   - Message structure (from `src/lib/shared/queue-messages.ts`):
   ```typescript
   {
     type: 'process-submission',
     payload: {
       submissionId: UUID,
       url: string,
       userId?: string
     },
     timestamp: number,
     retryCount: 0
   }
   ```

2. **Queue Consumer Receives Message** (in `worker-wrapper.ts`):
   - `queue(batch, env, ctx)` handler triggered by Cloudflare
   - Delegates to `queueHandler` in `src/queue/handler.ts`
   - Parse and validate message using Zod schema
   - Route to appropriate handler based on message type
   - Extract `submissionId` from message payload for 'process-submission' messages

3. **Job Start**:
   - `JobMonitor.logJobStart(submissionId)`
   - `JobOrchestrator.execute(submissionId)`
   - Record start time

4. **Validate Submission**:
   - Fetch submission record from database
   - If not found, throw error (non-retryable)

5. **Update Status to Processing**:
   - `StatusTracker.updateStatus(submissionId, 'processing')`
   - Update `updatedAt` timestamp

6. **Phase 1: Article Scraping**:
   - Call `ArticleScraperService.scrapeArticle(url)`
   - If successful:
     - Store `articleTitle`, `articleContent` in submission
     - Update `updatedAt`
   - If failed:
     - Store error in `scrapingError`
     - Throw error for retry logic

7. **Phase 2: Question Generation**:
   - Call `QuestionGeneratorService.generateQuestions(article, 10)`
   - Uses gpt-4.1-mini model
   - If successful:
     - Store `generatedQuestions` array in submission
     - Update `updatedAt`
   - If failed:
     - Throw error for retry logic

8. **Phase 3: Search Testing**:
   - Call `SearchTesterService.testAllQuestions(questions, url, submissionId)`
   - For each question (10 total):
     - Execute search query
     - Parse results
     - Save individual result to database
     - Wait 1 second (rate limiting)
   - If partial failures:
     - Continue with other questions
     - Still mark as completed
   - If total failure:
     - Throw error for retry logic

9. **Mark Completed**:
   - `StatusTracker.updateStatus(submissionId, 'completed')`
   - Set `completedAt` timestamp
   - Calculate total duration
   - `JobMonitor.logJobComplete(submissionId, duration)`

10. **Acknowledge Message**:
    - `QueueConsumerWorker.acknowledgeMessage(message)`
    - Remove from queue (job successful)

### Error Handling and Retry Flow

**Transient Error Occurs** (e.g., API timeout):
1. `JobOrchestrator` throws error
2. `QueueConsumerWorker` catches error
3. Check `message.retryCount < maxRetries`
4. If under limit:
   - `RetryManager.shouldRetry()` returns true
   - `RetryManager.calculateDelay(retryCount)` → 2s, 4s, or 8s
   - Increment `retryCount` in message
   - Requeue message with delay
   - `JobMonitor.logRetry(submissionId, error, retryCount)`
5. If over limit:
   - `StatusTracker.updateStatus(submissionId, 'failed')`
   - Store final error message
   - `JobMonitor.logJobFailed(submissionId, error, maxRetries)`
   - Acknowledge message (remove from queue)

**Non-Retryable Error Occurs** (e.g., invalid URL):
1. `RetryManager.isRetryableError(error)` returns false
2. Immediately mark submission as failed
3. Acknowledge message (don't retry)
4. Log error for analysis

---

## Data Flow

### Input
- **Source**: Cloudflare Queue message
- **Format**: `{ submissionId: UUID, retryCount: number }`

### Processing Phases
1. **Scraping**: Fetch and parse HTML (5-10 seconds)
2. **Question Generation**: Call GPT-4 API (3-10 seconds)
3. **Search Testing**: 10 queries × 5-15 seconds = 50-150 seconds

### Total Processing Time
- **Typical**: 60-180 seconds (1-3 minutes)
- **With Delays**: +10 seconds (rate limiting between searches)
- **With Retries**: Can add 2-14 seconds per retry

### API Costs per Job
- **Scraping**: Free (HTTP request)
- **Question Generation (gpt-4.1-mini)**: ~$0.001-0.005
- **Search Testing (gpt-5, 10 queries)**: ~$0.20-0.50
- **Total**: ~$0.20-0.51 per article

### Output
- **Submission Record**: Updated with all extracted data
- **Test Results**: 10 rows in results table
- **Status**: 'completed' or 'failed'

---

## Environment Considerations

### Cloudflare Workers Constraints
- **CPU Time**: No limit for queue consumers (I/O waits don't count)
- **Wall Clock Time**: Jobs can run for hours if needed
- **Memory**: Must fit in worker memory (typically not an issue)

### Cloudflare Queue Configuration
- **Message Retention**: 4 days
- **Max Retries**: 3 (after which, sent to dead letter queue)
- **Batch Size**: 1 (sequential processing)
- **Concurrency**: Can be increased to process multiple submissions simultaneously

### Environment Variables
- **OPENAI_API_KEY**: Required for Units 3 & 4
- **DATABASE_URL**: Required for database operations

### Performance
- Target: 95% of jobs complete within 3 minutes
- Allow: Up to 5 minutes for slower articles
- Timeout: 10 minutes absolute maximum

### Cost per Job
- Scraping: Free (HTTP request)
- Question Generation: ~$0.02
- Search Testing: ~$0.30 (10 questions)
- **Total**: ~$0.32 per article

---

## Dependencies

### Internal Dependencies
- **Unit 1**: Submission record created and enqueued
- **Unit 2**: Article scraping service
- **Unit 3**: Question generation service
- **Unit 4**: Search testing service
- **Unit 5**: Results display (consumes completed data)

### External Services
- **Cloudflare Queues**: Job queue system
- **Neon PostgreSQL**: Data storage
- **OpenAI API**: AI services

### Cloudflare Bindings Required
- Queue binding for message consumption
- DATABASE_URL for Neon connection
- Environment variables for API keys

---

## Error Scenarios

### Scraping Failures
- **Cause**: Network timeout, 404, paywall
- **Action**: Retry up to 3 times
- **Final**: Mark as failed with error message
- **User Impact**: Clear error shown in UI

### API Rate Limits
- **Cause**: Too many requests to OpenAI
- **Action**: Exponential backoff and retry
- **Final**: Usually succeeds on retry
- **User Impact**: Slight delay, transparent to user

### Database Errors
- **Cause**: Connection loss to Neon
- **Action**: Retry immediately (transient errors)
- **Final**: Most resolve quickly
- **User Impact**: None if retry succeeds

### Queue Failures
- **Cause**: Cloudflare Queue unavailable
- **Action**: Message automatically retried by Cloudflare
- **Final**: Job eventually processes
- **User Impact**: Longer wait time

---

## Monitoring and Alerts

### Key Metrics to Track
- **Processing Time**: Average and P95
- **Success Rate**: Percentage completing without errors
- **Error Rate**: By error type
- **Retry Rate**: How often jobs retry
- **Queue Depth**: Backlog of pending jobs

### Alert Thresholds
- **High Failure Rate**: >10% in 1 hour
- **Long Processing Time**: >5 minutes average
- **Queue Backup**: >100 jobs pending
- **API Errors**: >5% rate limit errors

### Dashboards
- Real-time job status
- Processing time trends
- Error breakdown by category
- Cost tracking per article

---

## Testing Considerations

### Unit Tests
- `JobOrchestrator`: Test workflow sequence
- `RetryManager`: Test exponential backoff calculation
- `StatusTracker`: Test status transition validation

### Integration Tests
- End-to-end job processing
- Retry logic with simulated failures
- Error handling for each phase

### Load Testing
- Process 100 submissions concurrently
- Measure queue throughput
- Test under API rate limits

---

## Queue Setup Requirements

### One-Time Cloudflare Setup ✅ COMPLETED

**IMPORTANT**: Queues must be created in your Cloudflare account before the system will work.

```bash
# Production queues (for deployment)
pnpm wrangler queues create datagum-queue
pnpm wrangler queues create datagum-dlq

# Development queues (for local development with --remote)
pnpm wrangler queues create datagum-queue-dev
pnpm wrangler queues create datagum-dlq-dev

# Verify queues were created
pnpm wrangler queues list
```

**Expected Output**:
```
┌─────────────────┬─────────────────────────────┬───────────┬───────────┐
│ name            │ created_on                  │ producers │ consumers │
├─────────────────┼─────────────────────────────┼───────────┼───────────┤
│ datagum-queue     │ 2025-10-21...             │ 1         │ 1         │
│ datagum-dlq       │ 2025-10-21...             │ 0         │ 0         │
│ datagum-queue-dev │ 2025-10-21T21:00:11...    │ 0         │ 0         │
│ datagum-dlq-dev   │ 2025-10-21T21:00:25...    │ 0         │ 0         │
└─────────────────┴─────────────────────────────┴───────────┴───────────┘
```

**Queue Purpose**:
- `datagum-queue`: Production queue - used by deployed app
- `datagum-dlq`: Production dead letter queue - failed messages

### Development Workflow

**Option 1: Fast Development (No Queue Consumer)** - Default
```bash
pnpm dev
```

**What this runs**:
- Next.js dev server on port 4444 with Turbopack

**What works**:
- ✅ Full Next.js DX (HMR, Turbopack, fast refresh)
- ✅ UI development, forms, pages, components
- ✅ Database operations
- ✅ Queue producer (can send messages via `env.ARTICLE_ANALYSIS_QUEUE.send()`)
- ⚠️ Queue consumer does NOT run (messages are enqueued but not processed)

**Why queue consumer doesn't work**:
- `next dev` runs Next.js development server (not Cloudflare Worker runtime)
- Queue consumer only runs in Cloudflare Worker environment

**When to use**: 95% of development (UI, forms, pages, components, APIs)

---

**Option 2: Full Queue Testing** ✅
```bash
pnpm preview
```

**What this runs**:
- Builds Next.js app with OpenNext.js for Cloudflare
- Runs Wrangler preview server on port 8787

**What works**:
- ✅ Full end-to-end queue testing
- ✅ Queue consumer processes messages from `datagum-queue`
- ✅ Complete Cloudflare Worker environment (bindings, env vars, etc.)
- ✅ Both producer and consumer work correctly
- ⚠️ No HMR - need to rebuild for changes (`pnpm preview` runs build automatically)

**When to use**: Testing queue processing, background jobs, complete end-to-end workflows

**Verified Working**: Complete submission → queue → processing flow confirmed in logs ✅

---

**Option 3: Production Deployment**
```bash
pnpm deploy
```

**What this deploys**:
- Next.js app: Deployed to Cloudflare as a Worker
- Queue consumer: Included in same worker deployment (via worker-wrapper.ts)
- Queues: Uses production queues (`datagum-queue`, `datagum-dlq`)

### Verifying Queue is Working

1. **Check Producer Logs**:
   - Web app should log: `Enqueued article analysis job for submission: {id}`
   - No error messages about queue not configured

2. **Check Consumer Logs**:
   - Queue worker should log: `Processing batch of X messages`
   - Queue worker should log: `Processing submission {id}: {url}`

3. **Check Queue Stats**:
   ```bash
   pnpm wrangler queues list
   # Should show producers: 1, consumers: 1
   ```

---

## Changelog

### Version 3.0.0 (2025-10-21) ✅ MAJOR RELEASE
**Removed Monorepo - Consolidated to Single Next.js App with OpenNext.js for Cloudflare**

- **BREAKING**: Removed Turborepo monorepo architecture
- **BREAKING**: Consolidated `apps/web` and `apps/queue-worker` into single Next.js app
- **BREAKING**: Moved `packages/shared` types to `src/lib/shared/`
- **NEW**: Worker wrapper pattern - `worker-wrapper.ts` extends OpenNext worker with queue consumer
- **NEW**: Queue consumer handler in `src/queue/handler.ts` (routes messages to appropriate handlers)
- **NEW**: Job Orchestrator implemented with placeholder phase logic in `src/queue/services/job-orchestrator.ts`
- **UPDATED**: All file paths from monorepo structure to single app:
  - `apps/web/wrangler.jsonc` → `wrangler.jsonc`
  - `packages/shared/src/queue-messages.ts` → `src/lib/shared/queue-messages.ts`
  - `packages/shared/src/utils.ts` → `src/lib/shared/utils.ts`
  - `apps/queue-worker/src/services/job-orchestrator.ts` → `src/queue/services/job-orchestrator.ts`
- **SIMPLIFIED**: Development workflow:
  - `pnpm dev` (port 4444): Fast Next.js development, queue producer works, consumer doesn't run
  - `pnpm preview` (port 8787): Full OpenNext.js build with working queue consumer
  - `pnpm deploy`: Deploys single worker with both HTTP and queue handlers
- **REMOVED**: All monorepo files (`turbo.json`, `pnpm-workspace.yaml`, `apps/`, `packages/`)
- **REMOVED**: Separate queue worker deployment
- **VERIFIED**: End-to-end queue flow confirmed working in preview mode ✅
- **CONFIGURATION**: Single `wrangler.jsonc` with both producer and consumer bindings
- **CONFIGURATION**: `worker-wrapper.ts` as main entry point (extends `.open-next/worker.js`)
- **STATUS**: Queue infrastructure fully implemented and verified working

**Architecture Benefits**:
- Simpler codebase - no monorepo complexity
- Single deployment - worker handles both HTTP requests and queue messages
- Faster builds - no separate apps to coordinate
- Better type sharing - direct imports instead of package dependencies

**Migration Notes**:
- Queue binding changed from `QUEUE` to `ARTICLE_ANALYSIS_QUEUE` (for clarity)
- All Cloudflare types generated via `pnpm cf-typegen` into single `cloudflare-env.d.ts`
- Rate limiting automatically disabled for local development (no separate config needed)

### Version 2.1.0 (2025-10-21) ✅ DEV QUEUE SETUP (DEPRECATED - Monorepo Removed in v3.0.0)
**Development Queues Implemented**

- **ADDED**: Created dev queues in Cloudflare (`datagum-queue-dev`, `datagum-dlq-dev`)
- **ADDED**: Environment-specific queue configuration in wrangler.jsonc files
  - Production: `datagum-queue` (default)
  - Development: `datagum-queue-dev` (when using `--env dev`)
- **UPDATED**: Queue worker dev script to use remote mode with dev environment
  - Changed from `wrangler dev` to `wrangler dev --remote --env dev`
  - Now `pnpm dev` automatically uses dev queues for queue worker
- **UPDATED**: Web app with preview:dev script for remote testing
- **SIMPLIFIED**: Development workflow - single `pnpm dev` command runs both apps
  - Web app: Local Next.js with full HMR (port 4444)
  - Queue worker: Remote Cloudflare with dev queues
- **DOCUMENTED**: Clear separation between dev and prod queues
- **DOCUMENTED**: Benefits and limitations of hybrid local/remote development
- **STATUS CHANGE**: ⚠️ Partially Implemented → ✅ Fully Implemented

**Setup Commands**:
```bash
# One-time setup (already completed)
pnpm wrangler queues create datagum-queue-dev
pnpm wrangler queues create datagum-dlq-dev
```

**New Development Workflow**:
```bash
pnpm dev  # Web (local) + Queue worker (remote dev queue)
```

### Version 2.0.1 (2025-10-21) ⚠️ DOCUMENTATION UPDATE
**Critical Local Development Limitation Documented (Corrected)**

- **CORRECTED**: Cloudflare Queues DO support local development, but only when producer and consumer run in the SAME wrangler dev session
- **ROOT CAUSE**: Our Next.js app runs with `next dev` (not wrangler), queue worker runs with `wrangler dev` separately
- **ADDED**: "Queue Setup Requirements" section with setup instructions
- **ADDED**: "⚠️ CRITICAL LIMITATION - Local Development" warning in Executive Summary
- **ADDED**: Four workarounds for local development:
  1. Remote development mode (`wrangler dev --remote`) - **Recommended**
  2. Single wrangler session (both apps) - loses Next.js DX
  3. Full deployment to Cloudflare
  4. Mock queue (future implementation)
- **ADDED**: "Verifying Queue is Working" troubleshooting section
- **ADDED**: Commands to create `datagum-queue` and `datagum-dlq` in Cloudflare
- **UPDATED**: Status from "✅ Implemented" to "⚠️ Partially Implemented (Queue Infrastructure Ready, Local Development Limitation)"
- **ISSUE IDENTIFIED**: Queues must be created in Cloudflare account via `wrangler queues create`
- **ISSUE IDENTIFIED**: Local queue consumer does not receive messages when web app and queue worker run in separate processes

**Root Cause (Corrected)**: Cloudflare Queues DO have local emulation via Miniflare, but it only works when both producer and consumer run in the SAME `wrangler dev` process. Our architecture uses `next dev` for the web app (better DX) and `wrangler dev` for the queue worker (separate processes), so they cannot share the local queue instance.

**Recommendation**: Use `pnpm --filter queue-worker wrangler dev --remote` for queue worker development while keeping Next.js dev server's excellent DX, or deploy to staging environment for full integration testing.

**Reference**: https://developers.cloudflare.com/queues/configuration/local-development/

### Version 2.0.0 (2025-10-21) ✅ MAJOR RELEASE
**Migration to Turborepo Monorepo Architecture**

- **BREAKING**: Migrated from single-app to Turborepo monorepo structure
- **NEW**: Separated concerns - `apps/web` (producer) + `apps/queue-worker` (consumer)
- **NEW**: Shared types package (`packages/shared`) with Zod schemas for queue messages
- **NEW**: Type-safe queue message definitions in `packages/shared/src/queue-messages.ts`
- **ENHANCED**: Producer configuration in `apps/web/wrangler.jsonc` with queue binding
- **ENHANCED**: Consumer configuration in `apps/queue-worker/wrangler.jsonc` with retry/DLQ settings
- **ENHANCED**: Single development command (`pnpm dev`) runs both apps simultaneously
- **ENHANCED**: Shared `.dev.vars` file accessible to both apps
- **ADDED**: `retryWithBackoff` utility in `packages/shared/src/utils.ts`
- **ADDED**: Example queue API route at `apps/web/src/app/api/queue/route.ts`
- **UPDATED**: All file paths to reflect monorepo structure
- **UPDATED**: Component statuses: QueueConsumerWorker ✅, RetryManager ✅, others ⚠️ pending
- **DOCUMENTED**: Complete monorepo setup in `.claude/CLAUDE.md`
- Implementation status: Queue infrastructure fully implemented, orchestrator pending

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 5 core components for job processing
- Documented Cloudflare Queues integration
- Specified retry logic with exponential backoff
- Mapped to user stories US-6.1 through US-6.4
- Defined monitoring and alerting strategy
- Orchestrates Units 2, 3, and 4 in sequence
- Uses gpt-4.1-mini for question generation (Unit 3)
- Uses gpt-5 with low reasoning for search testing (Unit 4)
- Includes cost breakdown per job
