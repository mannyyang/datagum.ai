# Domain Model: Unit 1 - Article Submission & Validation

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Epic**: Epic 1 - Article Submission & Validation
**User Stories**: US-1.1, US-1.2, US-1.3
**Status**: In-Progress

---

## Executive Summary

This domain model defines the components, attributes, behaviors, and interactions required to implement article URL submission with validation and rate limiting for the datagum.ai Article Analyzer. The model covers URL input capture, validation logic, rate limiting enforcement, and submission creation without including any code implementation or architectural diagrams.

### Key Business Requirements
- Accept article URLs from users via homepage form
- Validate URL format and security constraints
- Enforce 3 submissions per IP per 24-hour rate limit
- Create unique submission record with pending status
- Queue background job for processing
- Redirect user to results page

### Related User Stories
- **US-1.1**: Submit Article URL
- **US-1.2**: Rate Limiting
- **US-1.3**: Input Validation & Security

---

## Component Overview

### 1. SubmissionFormComponent
**Type**: Frontend Client Component
**Responsibility**: Captures user input and handles form submission on the landing page

**Attributes**:
- `url`: string - The article URL entered by user
- `isSubmitting`: boolean - Tracks submission state
- `errorMessage`: string | null - Validation or API error message

**Behaviors**:
- `handleInputChange(value: string)`: Updates URL state as user types
- `validateURLFormat(url: string)`: boolean - Client-side URL validation
- `handleSubmit()`: Submits form and calls API
- `displayError(message: string)`: Shows error message to user
- `redirectToResults(submissionId: string)`: Navigates to results page

**Interactions**:
- Calls `SubmissionAPIHandler` to create submission
- Receives validation errors from API
- Redirects to `ResultsPage` on success

---

### 2. SubmissionAPIHandler
**Type**: API Route Handler
**Responsibility**: Handles POST /api/submit endpoint for article submissions

**Attributes**:
- `request`: HTTP Request object
- `userIP`: string - Extracted from request headers
- `requestBody`: Object containing submitted URL

**Behaviors**:
- `extractUserIP(request)`: string - Gets IP from X-Forwarded-For or connection
- `parseRequestBody(request)`: Object - Parses and validates JSON body
- `validateRequest(body)`: void - Throws error if invalid
- `handleSubmission(url, userIP)`: Response - Orchestrates submission flow
- `sendSuccessResponse(submissionId, url)`: Response - Returns submission details
- `sendErrorResponse(statusCode, message)`: Response - Returns error

**Interactions**:
- Uses `URLValidator` for validation
- Uses `RateLimiter` to check submission limits
- Uses `SubmissionRepository` to create database record
- Uses `JobQueueService` to enqueue processing job

---

### 3. URLValidator
**Type**: Service/Utility
**Responsibility**: Validates URL format and security constraints

**Attributes**:
- `maxLength`: number - Maximum allowed URL length (2000)
- `blockedPatterns`: RegExp[] - Patterns for localhost/private IPs
- `requiredProtocols`: string[] - ['http', 'https']

**Behaviors**:
- `validateFormat(url: string)`: void - Throws if invalid URL syntax
- `validateProtocol(url: URL)`: void - Ensures HTTP/HTTPS only
- `validateLength(url: string)`: void - Checks max length constraint
- `checkSecurityRestrictions(url: URL)`: void - Blocks private IPs, localhost
- `isPrivateIP(hostname: string)`: boolean - Detects private IP addresses
- `sanitizeURL(url: string)`: string - Removes potentially dangerous characters

**Validation Rules**:
- Must be valid HTTP or HTTPS URL
- Cannot exceed 2000 characters
- Cannot be localhost (127.0.0.1, ::1, localhost)
- Cannot be private IP (10.x.x.x, 192.168.x.x, 172.16.x.x-172.31.x.x)
- Cannot be link-local (169.254.x.x)

**Interactions**:
- Called by `SubmissionAPIHandler` before processing
- Throws `ValidationError` on failure

---

### 4. RateLimiter
**Type**: Service
**Responsibility**: Enforces submission rate limits per IP address

**Attributes**:
- `maxSubmissions`: number - Maximum submissions allowed (3)
- `windowHours`: number - Time window in hours (24)
- `isProductionMode`: boolean - Determines if rate limiting is active

**Behaviors**:
- `checkRateLimit(userIP: string)`: void - Throws if limit exceeded
- `getRecentSubmissions(userIP: string)`: number - Counts submissions in window
- `calculateWindowStart()`: Date - Returns 24 hours ago timestamp
- `isRateLimitEnabled()`: boolean - Checks if in production mode

**Business Logic**:
- Query database for submissions from this IP in last 24 hours
- Count returned submissions
- If count >= 3, throw RateLimitExceededError
- If NODE_ENV !== 'production', skip rate limiting

**Interactions**:
- Uses `SubmissionRepository` to query recent submissions
- Called by `SubmissionAPIHandler` before creating submission

---

### 5. SubmissionRepository
**Type**: Data Access Layer
**Responsibility**: Manages database operations for submission records

**Attributes**:
- `db`: DrizzleORM database instance
- `submissionsTable`: Database table schema

**Behaviors**:
- `createSubmission(url, userIP)`: Submission - Inserts new record
- `getSubmissionById(id)`: Submission | null - Retrieves by UUID
- `countRecentSubmissionsByIP(ip, since)`: number - Counts submissions
- `updateSubmissionStatus(id, status)`: void - Updates status field

**Data Entity: Submission**:
- `id`: UUID - Primary key, auto-generated
- `url`: string - Article URL submitted
- `userIP`: string | null - IPv4 or IPv6 address
- `status`: enum - 'pending' | 'processing' | 'completed' | 'failed'
- `scrapingError`: string | null - Error message if failed
- `articleTitle`: string | null - Extracted after scraping
- `articleContent`: string | null - First 5000 chars of content
- `generatedQuestions`: string[] - JSON array of questions
- `createdAt`: timestamp - Auto-set on creation
- `updatedAt`: timestamp - Auto-updated
- `completedAt`: timestamp | null - Set when processing completes

**Database Constraints**:
- Primary key: id (UUID)
- Index on: status (for job queries)
- Index on: userIP (for rate limiting)
- Index on: createdAt (for rate limiting window)

**Interactions**:
- Called by `SubmissionAPIHandler` to create records
- Called by `RateLimiter` to count submissions
- Uses Drizzle ORM with Neon PostgreSQL

---

### 6. JobQueueService
**Type**: Queue Integration Service
**Responsibility**: Enqueues background jobs for article processing

**Attributes**:
- `queueClient`: Cloudflare Queue binding
- `queueName`: string - Name of the queue

**Behaviors**:
- `enqueueSubmission(submissionId)`: void - Adds job to queue
- `createJobMessage(submissionId)`: Object - Formats queue message
- `handleQueueError(error)`: void - Logs and handles queue failures

**Job Message Structure**:
- `submissionId`: UUID - Reference to submission record
- `enqueuedAt`: timestamp - When job was queued
- `retryCount`: number - Current retry attempt (starts at 0)

**Interactions**:
- Called by `SubmissionAPIHandler` after submission created
- Sends message to Cloudflare Queue for worker processing
- If enqueue fails, submission remains in 'pending' status

---

## Component Interactions

### Submission Flow Sequence

1. **User Input**:
   - User enters URL in `SubmissionFormComponent`
   - User clicks "Analyze Article" button

2. **Client-Side Validation**:
   - `SubmissionFormComponent.validateURLFormat()` performs basic check
   - If invalid, display error and stop

3. **API Request**:
   - `SubmissionFormComponent.handleSubmit()` sends POST to /api/submit
   - Request includes URL in body

4. **Server-Side Processing** (`SubmissionAPIHandler`):
   - Extract user IP from request headers
   - Parse request body

5. **URL Validation**:
   - Call `URLValidator.validateFormat(url)`
   - Call `URLValidator.validateProtocol(url)`
   - Call `URLValidator.validateLength(url)`
   - Call `URLValidator.checkSecurityRestrictions(url)`
   - If any validation fails, return 400 error

6. **Rate Limit Check**:
   - Call `RateLimiter.checkRateLimit(userIP)`
   - `RateLimiter` calls `SubmissionRepository.countRecentSubmissionsByIP()`
   - If count >= 3, throw error and return 429 response

7. **Create Submission Record**:
   - Call `SubmissionRepository.createSubmission(url, userIP)`
   - Database generates UUID for submission
   - Status set to 'pending'

8. **Enqueue Background Job**:
   - Call `JobQueueService.enqueueSubmission(submissionId)`
   - Job added to Cloudflare Queue

9. **Return Success Response**:
   - API returns 200 with submission details
   - Response includes:
     - `success`: true
     - `submissionId`: UUID
     - `url`: submitted URL
     - `status`: 'pending'
     - `resultsUrl`: '/results/{submissionId}'
     - `estimatedTime`: '30-60 seconds'

10. **Client Redirect**:
    - `SubmissionFormComponent` receives success response
    - Redirects browser to `/results/{submissionId}`

### Error Handling Flow

**Validation Error (400)**:
- `URLValidator` throws `ValidationError`
- `SubmissionAPIHandler` catches and returns 400
- Error message sent to client: "Please enter a valid URL..."

**Rate Limit Error (429)**:
- `RateLimiter` throws `RateLimitExceededError`
- `SubmissionAPIHandler` catches and returns 429
- Error message sent to client: "Rate limit exceeded. You can analyze 3 articles per day."

**Server Error (500)**:
- Any uncaught exception in API handler
- Log error details
- Return generic message: "An error occurred. Please try again."

---

## Data Flow

### Input Data
- **Source**: User form input
- **Format**: String (URL)
- **Validation**: Client-side + Server-side
- **Sanitization**: URL encoding, trim whitespace

### Stored Data
- **Destination**: PostgreSQL database (Neon)
- **Table**: `content_analysis_submissions`
- **ORM**: Drizzle ORM
- **Initial Fields Populated**:
  - id (auto-generated UUID)
  - url (user input)
  - userIP (extracted from request)
  - status ('pending')
  - createdAt (auto-set)
  - updatedAt (auto-set)

### Output Data
- **API Response**:
  ```
  {
    success: boolean
    submissionId: string (UUID)
    url: string
    status: 'pending'
    message: string
    resultsUrl: string
    estimatedTime: string
  }
  ```

---

## Environment Considerations

### Cloudflare Workers Constraints
- Request timeout: 30 seconds max
- No long-running processes in request handler
- Database calls must use HTTP-based driver (Neon HTTP)
- Queue integration via Cloudflare Queue bindings

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (Neon)
- `NODE_ENV`: 'development' | 'production' (affects rate limiting)

### Development Mode
- Rate limiting disabled when `NODE_ENV !== 'production'`
- Allows unlimited submissions for testing

### Production Mode
- Rate limiting enforced
- All validations active
- Cloudflare Queue integration required

---

## Security Measures

### Input Security
- URL validation prevents injection attacks
- Private IP blocking prevents SSRF attacks
- Length limits prevent DoS via large inputs
- Protocol restriction to HTTP/HTTPS only

### Rate Limiting Security
- IP-based tracking prevents abuse
- 24-hour rolling window
- Prevents resource exhaustion
- Limits OpenAI API costs

### Database Security
- Parameterized queries via Drizzle ORM (prevents SQL injection)
- Input sanitization before storage
- No sensitive data stored (only public URLs)

---

## Performance Considerations

### API Response Time
- Target: < 200ms for submission endpoint
- Database query for rate check: ~10-20ms
- Database insert: ~10-20ms
- Queue enqueue: ~10-30ms

### Caching Strategy
- No caching needed for submission endpoint
- Each submission is unique
- Rate limit check requires fresh data

### Database Indexing
- Index on `userIP` for fast rate limit queries
- Index on `createdAt` for window-based filtering
- Index on `status` for job processing queries

---

## Error Scenarios

### Invalid URL Format
- **Cause**: User enters non-URL text
- **Detection**: `URLValidator.validateFormat()`
- **Response**: 400 Bad Request
- **Message**: "Please enter a valid URL (e.g., https://example.com/article)"

### Rate Limit Exceeded
- **Cause**: User submits 4th article in 24 hours
- **Detection**: `RateLimiter.checkRateLimit()`
- **Response**: 429 Too Many Requests
- **Message**: "Rate limit exceeded. You can analyze 3 articles per day. Try again in X hours."

### Database Connection Failure
- **Cause**: Neon database unavailable
- **Detection**: Exception from Drizzle ORM
- **Response**: 500 Internal Server Error
- **Message**: "Service temporarily unavailable. Please try again."

### Queue Enqueue Failure
- **Cause**: Cloudflare Queue unavailable
- **Detection**: Exception from queue client
- **Handling**:
  - Submission still created with 'pending' status
  - Return success to user (will retry via cron)
  - Log error for monitoring

---

## Testing Considerations

### Unit Test Scenarios
- **URLValidator**:
  - Valid HTTP/HTTPS URLs pass
  - Invalid URL formats throw error
  - Localhost URLs throw error
  - Private IP URLs throw error
  - URLs > 2000 chars throw error

- **RateLimiter**:
  - 0-2 submissions allow new submission
  - 3+ submissions throw error
  - Development mode bypasses limit
  - 24-hour window calculated correctly

- **SubmissionRepository**:
  - createSubmission() returns valid UUID
  - countRecentSubmissionsByIP() counts correctly
  - Timestamps auto-populate

### Integration Test Scenarios
- End-to-end submission flow succeeds
- Rate limit enforcement across multiple requests
- Database transaction rollback on error
- Queue message format validation

### User Acceptance Test Scenarios
- User can submit valid article URL
- User sees error for invalid URL
- User sees rate limit error on 4th attempt
- User redirected to results page on success

---

## Dependencies

### External Services
- **Neon PostgreSQL**: Database storage
- **Cloudflare Queue**: Background job processing
- **Cloudflare Workers**: Runtime environment

### Internal Dependencies
- None (this is the first unit in the flow)

### Next Unit
- **Unit 6**: Background Job Processing (consumes queued submissions)

---

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 6 core components
- Documented submission flow and interactions
- Added security and performance considerations
- Mapped to user stories US-1.1, US-1.2, US-1.3
