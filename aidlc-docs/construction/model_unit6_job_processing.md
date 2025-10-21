# Domain Model: Unit 6 - Background Job Processing

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Epic**: Epic 6 - Background Job Processing
**User Stories**: US-6.1, US-6.2, US-6.3, US-6.4
**Status**: In-Progress

---

## Executive Summary

This domain model defines the background job processing system that orchestrates the entire article analysis workflow. Using Cloudflare Queues, the system processes submissions asynchronously through scraping, question generation, and search testing phases with retry logic and error handling.

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

### 1. QueueConsumerWorker
**Type**: Cloudflare Queue Consumer
**Responsibility**: Listens to Cloudflare Queue and processes submission jobs

**Attributes**:
- `queueBinding`: CloudflareQueue - Queue consumer binding
- `maxRetries`: number - Maximum retry attempts (3)
- `retryDelayBase`: number - Base delay for exponential backoff (2000ms)

**Behaviors**:
- `consumeMessages(batch)`: void - Processes batch of queue messages
- `processMessage(message)`: void - Handles single submission job
- `acknowledgeMessage(message)`: void - Removes message from queue
- `retryMessage(message, error)`: void - Requeues with retry count

**Queue Message Structure**:
```typescript
{
  submissionId: UUID
  enqueuedAt: timestamp
  retryCount: number
  previousError?: string
}
```

**Consumer Configuration**:
- **Batch Size**: 1 (process one submission at a time)
- **Max Retries**: 3
- **Retry Delay**: Exponential backoff (2s, 4s, 8s)
- **Dead Letter Queue**: Jobs failing after 3 retries

**Interactions**:
- Receives messages from Cloudflare Queue (populated by Unit 1)
- Calls `JobOrchestrator` to execute analysis workflow
- Manages message lifecycle (ack/retry)

---

### 2. JobOrchestrator
**Type**: Service
**Responsibility**: Orchestrates the complete analysis workflow for a submission

**Attributes**:
- `submissionId`: UUID - Current job being processed
- `startTime`: number - Job start timestamp
- `services`: { scraper, questionGen, searchTester } - Service instances

**Behaviors**:
- `execute(submissionId)`: void - Main entry point
- `validateSubmission()`: Submission - Checks submission exists
- `updateStatus(status)`: void - Updates submission status
- `runScrapingPhase()`: ScrapedArticle - Executes Unit 2
- `runQuestionGenerationPhase(article)`: Questions - Executes Unit 3
- `runSearchTestingPhase(questions, url)`: Results - Executes Unit 4
- `markCompleted()`: void - Finalizes successful job
- `markFailed(error)`: void - Handles job failure
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

### 3. RetryManager
**Type**: Utility Component
**Responsibility**: Manages retry logic and exponential backoff

**Attributes**:
- `maxRetries`: number - 3
- `baseDelay`: number - 2000ms
- `backoffMultiplier`: number - 2

**Behaviors**:
- `shouldRetry(retryCount)`: boolean - Checks if under max retries
- `calculateDelay(retryCount)`: number - Exponential backoff calculation
- `incrementRetryCount(message)`: Message - Updates retry counter
- `isRetryableError(error)`: boolean - Determines if error is transient

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

### 4. StatusTracker
**Type**: Utility Component
**Responsibility**: Tracks and updates submission status through workflow

**Attributes**:
- `validStatuses`: string[] - ['pending', 'processing', 'completed', 'failed']
- `statusTransitions`: Map - Valid status transitions

**Behaviors**:
- `updateStatus(submissionId, newStatus)`: void - Updates database
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

### 5. JobMonitor
**Type**: Monitoring/Logging Service
**Responsibility**: Tracks job performance metrics and errors

**Attributes**:
- `metrics`: MetricsCollector - Performance tracking
- `logger`: Logger - Error and info logging

**Behaviors**:
- `logJobStart(submissionId)`: void - Records job initiation
- `logJobComplete(submissionId, duration)`: void - Records success
- `logJobFailed(submissionId, error, retryCount)`: void - Records failure
- `trackProcessingTime(phase, duration)`: void - Metrics per phase
- `trackErrorRate(errorType)`: void - Error categorization
- `alertOnHighFailureRate()`: void - Monitoring alerts

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

1. **Submission Enqueued** (from Unit 1):
   - User submits article URL
   - Submission record created with status 'pending'
   - Message sent to Cloudflare Queue
   - Message contains: `{ submissionId, enqueuedAt, retryCount: 0 }`

2. **Queue Consumer Receives Message**:
   - `QueueConsumerWorker.consumeMessages()` triggered
   - Extract `submissionId` from message

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

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 5 core components for job processing
- Documented Cloudflare Queues integration
- Specified retry logic with exponential backoff
- Mapped to user stories US-6.1 through US-6.4
- Defined monitoring and alerting strategy
- Orchestrates Units 2, 3, and 4 in sequence
