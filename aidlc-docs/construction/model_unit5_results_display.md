# Domain Model: Unit 5 - Results Display & Analysis

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Epic**: Epic 5 - Results Display & Analysis
**User Stories**: US-5.1, US-5.2, US-5.3, US-5.4, US-5.5
**Status**: In-Progress

---

## Executive Summary

This domain model defines the frontend and API components required to display comprehensive analysis results to users. The system provides real-time polling, loading states, summary statistics, competitor analysis, coverage gaps identification, and detailed question-by-question results with lead generation CTAs.

### Key Business Requirements
- Poll for results every 3 seconds while processing
- Display loading state with progress indicators
- Show summary statistics (success rate, citation counts, competitors)
- Display top 5 competing domains with citation counts
- Show coverage gaps (questions where article didn't appear)
- Display detailed results for each question tested
- Show error states for failed analyses
- Real-time status updates (pending → processing → completed)

### Related User Stories
- **US-5.1**: Display Summary Statistics
- **US-5.2**: Display Coverage Gaps
- **US-5.3**: Display Detailed Results
- **US-5.4**: Real-time Progress Updates
- **US-5.5**: Error State Display

---

## Component Overview

### 1. ResultsAPIHandler
**Type**: API Route Handler
**Responsibility**: Handles GET /api/results/[id] endpoint for retrieving analysis results

**Attributes**:
- `request`: HTTP Request object
- `submissionId`: UUID from URL parameter

**Behaviors**:
- `getResults(submissionId)`: Response - Main entry point
- `fetchSubmission(id)`: Submission - Gets submission record
- `fetchTestResults(submissionId)`: TestResult[] - Gets all question results
- `calculateSummary(results)`: Summary - Aggregates statistics
- `analyzeCompetitors(results, targetURL)`: Competitors - Identifies top domains
- `identifyCoverageGaps(results)`: CoverageGap[] - Finds missed questions
- `buildResponse(submission, results, summary, competitors, gaps)`: Response

**Response Structure**:
```typescript
{
  submission: {
    id: string
    url: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    articleTitle: string | null
    scrapingError: string | null
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    generatedQuestions: string[]
  }
  results: ProcessedResult[]
  summary: {
    totalQuestions: number
    foundCount: number
    foundInSourcesCount: number
    foundInCitationsCount: number
    successRate: number  // percentage
    avgResponseTime: number  // milliseconds
  }
  competitors: {
    topCompetitors: { domain: string, count: number }[]
    totalUniqueCompetitors: number
  }
  coverageGaps: {
    question: string
    topCitations: CitationInfo[]
  }[]
}
```

**Interactions**:
- Uses `SubmissionRepository` to fetch submission
- Uses `ResultsRepository` to fetch test results
- Uses `SummaryCalculator` for statistics
- Uses `CompetitorAggregator` for competitor analysis
- Called by `ResultsPage` frontend component

---

### 2. ResultsPage
**Type**: Frontend Page Component (Client)
**Responsibility**: Displays analysis results with real-time polling

**Attributes**:
- `submissionId`: string - From URL parameter
- `data`: AnalysisData | null - Fetched results
- `loading`: boolean - Loading state
- `error`: string - Error message
- `pollInterval`: NodeJS.Timeout | null - Polling timer

**Behaviors**:
- `fetchResults()`: void - Calls API to get results
- `startPolling()`: void - Begins 3-second polling cycle
- `stopPolling()`: void - Clears polling interval
- `shouldContinuePolling(status)`: boolean - Checks if still processing
- `handleError(error)`: void - Sets error state

**Polling Logic**:
1. On component mount, call `fetchResults()`
2. If status is 'pending' or 'processing', set 3-second timer
3. Timer fires: call `fetchResults()` again
4. Repeat until status is 'completed' or 'failed'
5. On completion, stop polling and display results

**Conditional Rendering**:
- **Loading/Processing**: Show `LoadingStateComponent`
- **Failed**: Show `FailedStateComponent`
- **Completed**: Show full results layout

**Interactions**:
- Calls `ResultsAPIHandler` for data
- Renders child components based on state
- Uses Next.js useEffect for polling lifecycle

---

### 3. LoadingStateComponent
**Type**: Frontend UI Component
**Responsibility**: Displays loading state with progress indicators

**Attributes**:
- `status`: 'pending' | 'processing'
- `hasQuestions`: boolean - Whether questions are generated

**Behaviors**:
- `renderProgressSteps()`: JSX - Shows progress checklist
- `getStatusMessage(status)`: string - Returns contextual message

**Progress Steps**:
1. Reading your article content (always complete)
2. Generating relevant questions (complete if questions exist)
3. Testing in AI search (in progress during processing)
4. Analyzing competitors (pending until complete)

**UI Elements**:
- Loading spinner
- "Analyzing Your Article..." heading
- Status message
- Progress step checklist with icons
- Estimated time message ("This usually takes 30-60 seconds")

**Interactions**:
- Receives submission data from `ResultsPage`
- Displays progress based on `submission.status` and `submission.generatedQuestions`

---

### 4. SummaryStatsComponent
**Type**: Frontend UI Component
**Responsibility**: Displays key performance metrics

**Attributes**:
- `summary`: Summary object from API

**Behaviors**:
- `getSuccessRateColor(rate)`: string - Returns color class based on rate
- `formatPercentage(rate)`: string - Formats as percentage string

**Success Rate Colors**:
- >= 70%: Green (good performance)
- 40-69%: Yellow (moderate performance)
- < 40%: Red (poor performance)

**Displayed Metrics** (4 cards):
1. **Success Rate**: Percentage with color coding
   - Subtext: "X/10 questions"
2. **In Sources**: Count of questions where URL was in sources list
   - Subtext: "Found in source lists"
3. **In Citations**: Count where URL was actually cited
   - Subtext: "Cited in answers"
4. **Competitors**: Number of unique competing domains
   - Subtext: "Unique domains"

**Interactions**:
- Receives summary data from `ResultsPage`
- Pure presentation component

---

### 5. CompetitorsComponent
**Type**: Frontend UI Component
**Responsibility**: Displays top competing domains

**Attributes**:
- `competitors`: Competitor[] from API
- `totalQuestions`: number - For percentage calculation

**Behaviors**:
- `calculatePercentage(count, total)`: number - Citation percentage
- `renderCompetitorBar(count, total)`: JSX - Visual progress bar

**Displayed Information** (per competitor):
- Domain name (e.g., "nytimes.com")
- Citation count (e.g., "3 citations")
- Visual progress bar showing percentage

**UI Layout**:
- Card with "Top Competing Domains" heading
- List of top 5 competitors
- Each competitor shows domain, count, and percentage bar

**Interactions**:
- Receives competitor data from `ResultsPage`
- Visualizes competitive landscape

---

### 6. CoverageGapsComponent
**Type**: Frontend UI Component
**Responsibility**: Displays questions where article wasn't cited

**Attributes**:
- `gaps`: CoverageGap[] from API

**Behaviors**:
- `renderGapItem(gap)`: JSX - Displays one gap
- `extractDomain(url)`: string - Gets domain from URL

**Displayed Information** (per gap):
- The question that didn't return the article
- "Who ranked instead" subheading
- List of top 3 competing citations (domains)

**UI Styling**:
- Yellow/warning color scheme
- Clear indication these are opportunities
- Actionable framing ("opportunities for optimization")

**Interactions**:
- Receives gap data from `ResultsPage`
- Highlights areas for content improvement

---

### 7. DetailedResultsComponent
**Type**: Frontend UI Component
**Responsibility**: Displays expandable question-by-question results

**Attributes**:
- `results`: ProcessedResult[] from API

**Behaviors**:
- `renderResultItem(result)`: JSX - One question result
- `getResultColor(found)`: string - Green if found, gray if not

**Displayed Information** (per question):
- Question text
- Found status (✓ or ✗)
- Total citations count
- Expandable details:
  - All citations with URLs and titles
  - Click to expand/collapse

**UI Pattern**:
- `<details>` HTML element for expand/collapse
- Color-coded cards (green for success, gray for not found)
- Citations displayed as list with links

**Interactions**:
- Receives processed results from `ResultsPage`
- Provides drill-down detail view

---

## Component Interactions

### Results Display Flow Sequence

1. **User Lands on Results Page**:
   - URL: `/results/{submissionId}`
   - `ResultsPage` component mounts
   - Extract `submissionId` from URL params

2. **Initial Data Fetch**:
   - `ResultsPage.fetchResults()` calls GET `/api/results/{id}`
   - `ResultsAPIHandler` processes request

3. **API Processing**:
   - Fetch submission record
   - Fetch all test results for submission
   - Calculate summary statistics
   - Analyze competitors
   - Identify coverage gaps
   - Return comprehensive response

4. **Check Status**:
   - If status is 'pending' or 'processing':
     - Set 3-second polling timer
     - Render `LoadingStateComponent`
   - If status is 'completed':
     - Render full results
   - If status is 'failed':
     - Render `FailedStateComponent`

5. **Polling Loop** (if processing):
   - Every 3 seconds, call `fetchResults()` again
   - Check status
   - Continue until 'completed' or 'failed'

6. **Display Results** (when completed):
   - Render `SummaryStatsComponent` with summary
   - Render `CompetitorsComponent` with top competitors
   - Render `CoverageGapsComponent` with gaps
   - Render `DetailedResultsComponent` with all questions
   - Render CTAs for lead generation

7. **User Interaction**:
   - User can expand/collapse detailed results
   - User can click CTA buttons
   - User can share results URL

---

## Data Processing

### Summary Calculation Logic
```
totalQuestions = results.length
foundCount = count where targetUrlFound === true
foundInSourcesCount = count where foundInSources === true
foundInCitationsCount = count where foundInCitations === true
successRate = (foundCount / totalQuestions) * 100
avgResponseTime = average of all responseTimeMs values
```

### Competitor Aggregation Logic
```
1. Collect all citations from all results
2. Extract domain from each citation URL
3. Filter out target article domain
4. Count frequency of each domain
5. Sort by frequency (descending)
6. Return top 10
```

### Coverage Gap Identification Logic
```
1. Filter results where targetUrlFound === false
2. For each gap, take top 3 citations
3. Limit to 5 gaps total
4. Return as array
```

---

## Environment Considerations

### Performance Targets
- API response time: < 200ms (data already in database)
- Polling overhead: Minimal (3-second interval)
- Page load: < 1 second

### Caching Strategy
- No caching on API (data changes during processing)
- Client-side polling updates data automatically

---

## Dependencies

### Internal Dependencies
- **Unit 1**: Submission record
- **Unit 4**: Test results stored in database

### Frontend Libraries
- **Next.js 15**: App Router, useEffect, useParams
- **React 19**: Component rendering
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI components
- **Framer Motion**: Animations (optional)

---

## Testing Considerations

### Unit Tests
- `ResultsAPIHandler`: Test summary calculations
- `SummaryCalculator`: Test statistics formulas
- `CompetitorAggregator`: Test domain counting

### Integration Tests
- Full polling flow end-to-end
- Results display for various statuses
- Error state rendering

---

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 7 core components for results display
- Documented polling mechanism
- Specified UI component breakdown
- Mapped to user stories US-5.1 through US-5.5
