# Epics and User Stories - Article Analyzer

**Project**: datagum.ai - AI-Powered Article Visibility Analyzer
**Created**: 2025-10-20
**Last Updated**: 2025-10-20

---

## Epic 1: Article Submission & Validation
**Status**: In-Progress
**Priority**: High
**Description**: Enable users to submit article URLs for AI visibility analysis with proper validation and rate limiting.

### User Stories

#### US-1.1: Submit Article URL
**Status**: In-Progress
**Priority**: High
**Story**: As a content creator, I want to submit my article URL so that I can analyze its visibility in AI search engines.

**Acceptance Criteria**:
- User can enter any valid HTTP/HTTPS URL
- URL validation occurs before submission
- User receives immediate feedback on invalid URLs
- System redirects to results page after successful submission
- Submission creates a unique ID for tracking

#### US-1.2: Rate Limiting
**Status**: In-Progress
**Priority**: High
**Story**: As a system administrator, I want to limit submissions to 3 per IP per 24 hours so that we prevent abuse and manage costs.

**Acceptance Criteria**:
- System tracks submissions by IP address
- Users are limited to 3 submissions per 24-hour period
- Clear error message shown when rate limit exceeded
- Rate limiting bypassed in development mode
- Rate limit counter resets after 24 hours

#### US-1.3: Input Validation & Security
**Status**: In-Progress
**Priority**: High
**Story**: As a security engineer, I want strict input validation so that the system is protected from malicious inputs.

**Acceptance Criteria**:
- Block localhost and private IP addresses
- Maximum URL length of 2000 characters
- Sanitize all user inputs
- Prevent SQL injection attempts
- Log suspicious activity

---

## Epic 2: Article Content Extraction
**Status**: In-Progress
**Priority**: High
**Description**: Scrape and extract relevant content from submitted article URLs.

### User Stories

#### US-2.1: HTML Content Fetching
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to fetch HTML content from submitted URLs so that I can extract article information.

**Acceptance Criteria**:
- System fetches HTML using proper user agent
- Handles HTTP redirects appropriately
- Timeout after 10 seconds to prevent hanging
- Return appropriate error for failed fetches
- Support HTTPS URLs

#### US-2.2: Article Title Extraction
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to extract the article title so that I can identify the content being analyzed.

**Acceptance Criteria**:
- Extract from Open Graph meta tags (priority)
- Fallback to Twitter meta tags
- Fallback to H1 tag
- Final fallback to title tag
- Return empty string if no title found

#### US-2.3: Article Content Extraction
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to extract the main article content so that I can generate relevant questions.

**Acceptance Criteria**:
- Remove scripts, styles, navigation, headers, footers
- Extract content from article/main tags first
- Extract all paragraphs and headings
- Minimum content length of 100 characters
- Store first 5000 characters in database

#### US-2.4: Heading Extraction
**Status**: In-Progress
**Priority**: Medium
**Story**: As a system, I want to extract article headings so that I can understand content structure.

**Acceptance Criteria**:
- Extract H1-H6 tags
- Filter out empty headings
- Maximum heading length of 200 characters
- Return as array of strings

#### US-2.5: Error Handling for Scraping
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want clear error messages when article scraping fails so that I understand what went wrong.

**Acceptance Criteria**:
- Handle network errors gracefully
- Handle paywalled content
- Handle 404 and other HTTP errors
- Store error message in database
- Display user-friendly error in UI

---

## Epic 3: AI Question Generation
**Status**: In-Progress
**Priority**: High
**Description**: Use GPT-4 to generate relevant search queries based on article content.

### User Stories

#### US-3.1: Generate Search Questions
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to generate 10 relevant search questions so that I can test article visibility.

**Acceptance Criteria**:
- Use GPT-4 Turbo for question generation
- Generate exactly 10 questions (configurable)
- Questions are natural user queries
- Questions cover different aspects of the article
- Questions range from broad to specific

#### US-3.2: Question Quality Validation
**Status**: In-Progress
**Priority**: Medium
**Story**: As a system, I want to validate generated questions so that only quality questions are tested.

**Acceptance Criteria**:
- Filter out empty or invalid questions
- Minimum question length requirement
- Questions must be relevant to article content
- Remove duplicate questions

#### US-3.3: Content Summary Generation
**Status**: In-Progress
**Priority**: Low
**Story**: As a user, I want to see a brief summary of my article so that I can confirm the right content was analyzed.

**Acceptance Criteria**:
- Generate 1-2 sentence summary
- Summary accurately reflects article content
- Display summary on results page

---

## Epic 4: AI Search Visibility Testing
**Status**: In-Progress
**Priority**: High
**Description**: Test generated questions through OpenAI Search API to determine article visibility.

### User Stories

#### US-4.1: Execute Search Queries
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to execute each question through OpenAI Search so that I can determine citation visibility.

**Acceptance Criteria**:
- Use OpenAI Responses API with web_search tool
- Use GPT-5 model
- Set reasoning effort to "low" for faster responses
- Track response time for each query
- Handle API errors gracefully

#### US-4.2: Parse Search Results
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to parse search results so that I can identify citations and sources.

**Acceptance Criteria**:
- Extract all sources from web_search_call
- Extract all citations from response annotations
- Identify if target URL appears in sources
- Identify if target URL appears in citations
- Support flexible URL matching (with/without query params)

#### US-4.3: Track Citation Tiers
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want to see different citation tiers so that I understand my visibility level.

**Acceptance Criteria**:
- Track "Found in Sources" (retrieved but not cited)
- Track "Found in Citations" (actually cited in answer)
- Display both metrics separately
- Calculate overall success rate

#### US-4.4: Competitor Identification
**Status**: In-Progress
**Priority**: Medium
**Story**: As a user, I want to see which domains are cited instead of mine so that I can identify competitors.

**Acceptance Criteria**:
- Extract all competing domains from citations
- Count frequency of each competitor
- Display top 10 competitors
- Show competitor citation count
- Calculate competitor percentage

#### US-4.5: Rate Limit Handling
**Status**: In-Progress
**Priority**: Medium
**Story**: As a system, I want to handle OpenAI rate limits so that analysis doesn't fail.

**Acceptance Criteria**:
- Add 1-second delay between requests
- Retry failed requests (max 3 attempts)
- Store partial results if some queries fail
- Continue processing remaining queries after failures

---

## Epic 5: Results Display & Analysis
**Status**: In-Progress
**Priority**: High
**Description**: Present comprehensive analysis results to users with actionable insights.

### User Stories

#### US-5.1: Display Summary Statistics
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want to see summary statistics so that I can quickly understand my article's performance.

**Acceptance Criteria**:
- Show success rate percentage
- Show count of questions where article was found
- Show "Found in Sources" count
- Show "Found in Citations" count
- Show number of unique competitors
- Color-code success rate (green/yellow/red)

#### US-5.2: Display Coverage Gaps
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want to see questions where my article didn't appear so that I can identify content gaps.

**Acceptance Criteria**:
- Show top 5 questions where article wasn't cited
- For each gap, show top 3 competitors who ranked instead
- Display competitor domains clearly
- Highlight as opportunities for optimization

#### US-5.3: Display Detailed Results
**Status**: In-Progress
**Priority**: Medium
**Story**: As a user, I want to see detailed results for each question so that I can understand specific performance.

**Acceptance Criteria**:
- Show all 10 questions tested
- Indicate which questions resulted in citations
- Show all citations for each question
- Display citation URLs and titles
- Show response time for each query
- Use expandable/collapsible sections

#### US-5.4: Real-time Progress Updates
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want to see progress updates while analysis runs so that I know the system is working.

**Acceptance Criteria**:
- Poll results API every 3 seconds
- Display loading state with spinner
- Show progress indicators (scraping, generating questions, testing)
- Update progress based on submission status
- Automatically refresh until complete

#### US-5.5: Error State Display
**Status**: In-Progress
**Priority**: High
**Story**: As a user, I want to see clear error messages if analysis fails so that I understand what happened.

**Acceptance Criteria**:
- Display user-friendly error messages
- Show specific error reason (scraping failed, API error, etc.)
- Provide actionable next steps
- Option to try again with different URL

---

## Epic 6: Background Job Processing
**Status**: In-Progress
**Priority**: High
**Description**: Process article analysis asynchronously using Cloudflare Queues.

### User Stories

#### US-6.1: Queue Job Creation
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to create queue jobs for submissions so that processing happens asynchronously.

**Acceptance Criteria**:
- Create Cloudflare Queue consumer
- Enqueue job on article submission
- Include submission ID in job message
- Set appropriate job timeout
- Handle queue failures

#### US-6.2: Job Execution Flow
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to execute jobs in sequence so that all analysis steps complete successfully.

**Acceptance Criteria**:
- Step 1: Fetch and scrape article
- Step 2: Generate questions with GPT-4
- Step 3: Test each question with OpenAI Search
- Step 4: Aggregate and save results
- Step 5: Mark submission as completed
- Update submission status at each step

#### US-6.3: Job Retry Logic
**Status**: In-Progress
**Priority**: High
**Story**: As a system, I want to retry failed jobs so that transient errors don't cause permanent failures.

**Acceptance Criteria**:
- Retry up to 3 times on failure
- Use exponential backoff for retries
- Store error messages for each attempt
- Mark job as permanently failed after max retries
- Update submission status to "failed" when retries exhausted

#### US-6.4: Job Monitoring
**Status**: In-Progress
**Priority**: Medium
**Story**: As a system administrator, I want to monitor job execution so that I can identify issues.

**Acceptance Criteria**:
- Log job start and completion
- Log errors and retries
- Track average processing time
- Track success/failure rates
- Alert on high failure rates

---

## Epic 7: Lead Generation CTAs
**Status**: In-Progress
**Priority**: Medium
**Description**: Convert users to leads through strategic calls-to-action.

### User Stories

#### US-7.1: Display CTA on Landing Page
**Status**: In-Progress
**Priority**: Medium
**Story**: As a business, I want to display CTAs on the landing page so that users know about our services.

**Acceptance Criteria**:
- Prominent CTA section below hero
- Clear value proposition
- Link to contact/sales page
- Professional design matching brand

#### US-7.2: Display CTA on Results Page
**Status**: In-Progress
**Priority**: High
**Story**: As a business, I want to display CTAs on results page so that users seeing poor performance contact us.

**Acceptance Criteria**:
- CTA after results display
- Emphasize distribution services
- Highlight improvement potential
- Track CTA click-through rate

---

## Status Legend
- **Not Started**: Story has been defined but work hasn't begun
- **In-Progress**: Story is currently being worked on
- **Complete**: Story has been fully implemented and tested

---

## Notes
- All stories extracted from `DOMAIN_MODEL_ARTICLE_ANALYZER.md`
- Stories organized into logical units for modular development
- Priority based on core functionality and user value
- Acceptance criteria define testable outcomes
