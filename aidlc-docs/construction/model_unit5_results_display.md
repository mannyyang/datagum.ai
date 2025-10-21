# Domain Model: Unit 5 - Results Display & Analysis

**Version**: 1.2.0
**Last Updated**: 2025-10-21
**Epic**: Epic 5 - Results Display & Analysis
**User Stories**: US-5.1, US-5.2, US-5.3, US-5.4, US-5.5
**Status**: ⚠️ In-Progress (Turborepo Monorepo - apps/web)

---

## Executive Summary

This domain model defines the frontend and API components required to display comprehensive analysis results to users. The system provides **progressive loading with skeleton states**, real-time polling, summary statistics that update as data arrives, competitor analysis, coverage gaps identification, and detailed question-by-question results with lead generation CTAs.

### Key Business Requirements
- Poll for results every 3 seconds while processing
- **Progressive Loading**: Show actual results page layout immediately with skeleton loaders
- **Skeleton-to-Data Transitions**: Replace skeletons with real data as it becomes available
- **Live Statistics Updates**: Update summary cards in real-time as questions complete
- Show summary statistics (success rate, citation counts, competitors)
- Display top 5 competing domains with citation counts
- Show coverage gaps (questions where article didn't appear)
- Display detailed results for each question tested
- Show error states for failed analyses
- Real-time status updates (pending → processing → completed)
- **No separate loading screen**: Results page renders immediately with progressive disclosure

### Related User Stories
- **US-5.1**: Display Summary Statistics
- **US-5.2**: Display Coverage Gaps
- **US-5.3**: Display Detailed Results
- **US-5.4**: Real-time Progress Updates
- **US-5.5**: Error State Display

---

## Component Overview

### 1. ResultsAPIHandler ⚠️
**Type**: API Route Handler
**Location**: `apps/web/src/app/api/results/[id]/route.ts` (to be implemented)
**Responsibility**: Handles GET /api/results/[id] endpoint for retrieving analysis results

**Implementation Status**: ⚠️ Pending implementation

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

### 2. ResultsPage ✨ ENHANCED
**Type**: Frontend Page Component (Client)
**Location**: `apps/web/src/app/results/[id]/page.tsx` and `apps/web/src/components/results-view.tsx`
**Responsibility**: Displays analysis results with progressive loading and real-time polling

**Implementation Status**: ⚠️ Needs update for progressive loading pattern

**Attributes**:
- `submissionId`: string - From URL parameter
- `data`: AnalysisData | null - Fetched results (can be partial)
- `isPolling`: boolean - Whether actively polling
- `error`: string - Error message
- `pollInterval`: NodeJS.Timeout | null - Polling timer

**Behaviors**:
- `fetchResults()`: void - Calls API to get results (partial or complete)
- `startPolling()`: void - Begins 3-second polling cycle
- `stopPolling()`: void - Clears polling interval
- `shouldContinuePolling(status)`: boolean - Checks if still processing
- `handleError(error)`: void - Sets error state
- `mergePartialResults(newData)`: void - Updates state with new/partial data

**Progressive Loading Strategy**:
1. On component mount, immediately render page layout with skeletons
2. Call `fetchResults()` to get initial data (may be empty or partial)
3. Render real data for any completed sections
4. Show skeletons for sections without data yet
5. If status is 'pending' or 'processing', continue polling every 3 seconds
6. On each poll, merge new data and replace skeletons with real content
7. Stop polling when status is 'completed' or 'failed'

**Rendering Strategy** (Progressive Disclosure):
- **Initial Load**: Show full page layout with all skeleton placeholders
- **Article Title Available**: Replace header skeleton with actual title
- **Statistics Updating**: Show live-updating counters as questions complete
- **Results Streaming**: Show completed test results, skeletons for pending ones
- **Competitors/Gaps Available**: Replace those section skeletons when data ready
- **Final State**: All skeletons replaced with real data, polling stopped

**No Separate Loading Screen**: The results page itself IS the loading screen with progressive enhancements

**Interactions**:
- Calls `ResultsAPIHandler` for data (may return partial results)
- Renders all components immediately (with skeleton states where needed)
- Uses Next.js useEffect for polling lifecycle
- Uses shadcn/ui Skeleton component for loading states

---

### 3. ~~LoadingStateComponent~~ DEPRECATED ❌
**Status**: REMOVED - No longer needed with progressive loading pattern

**Previous Responsibility**: Displayed separate loading screen with progress indicators

**Why Removed**:
- Progressive loading eliminates need for separate loading screen
- Results page now shows immediately with skeletons
- Better UX - users see the page structure and data populates in real-time
- Follows modern web app patterns (similar to Twitter, LinkedIn feeds)

**Replaced By**:
- Skeleton states within each component (SummaryStatsComponent, DetailedResultsComponent, etc.)
- In-place loading indicators using shadcn/ui Skeleton component
- Progressive data population as API returns partial/complete results

---

### 4. SummaryStatsComponent ✨ ENHANCED
**Type**: Frontend UI Component
**Location**: `apps/web/src/components/summary-stats.tsx` (to be created)
**Responsibility**: Displays key performance metrics with progressive loading support

**Implementation Status**: ⚠️ Needs creation with skeleton support

**Attributes**:
- `summary`: Summary object from API (optional - can be undefined during loading)
- `isLoading`: boolean - Whether data is still loading
- `showSkeleton`: boolean - Whether to show skeleton placeholders

**Behaviors**:
- `getSuccessRateColor(rate)`: string - Returns color class based on rate
- `formatPercentage(rate)`: string - Formats as percentage string
- `renderSkeletonCard()`: JSX - Returns skeleton placeholder for loading state
- `renderDataCard(metric)`: JSX - Returns card with actual data

**Success Rate Colors**:
- >= 70%: Green (good performance)
- 40-69%: Yellow (moderate performance)
- < 40%: Red (poor performance)

**Displayed Metrics** (4 cards):
1. **Success Rate**: Percentage with color coding
   - Subtext: "X/10 questions"
   - Skeleton: Animated rectangle for percentage value
2. **In Sources**: Count of questions where URL was in sources list
   - Subtext: "Found in source lists"
   - Skeleton: Animated number placeholder
3. **In Citations**: Count where URL was actually cited
   - Subtext: "Cited in answers"
   - Skeleton: Animated number placeholder
4. **Competitors**: Number of unique competing domains
   - Subtext: "Unique domains"
   - Skeleton: Animated number placeholder

**Progressive Loading Behavior**:
- When `summary` is null/undefined: Show 4 skeleton cards
- When `summary` is partial: Show real data for available metrics, skeletons for missing
- When `summary` is complete: Show all real data
- Smooth fade-in transition when data loads

**Skeleton Pattern**:
```tsx
{summary ? (
  <div className="bg-card border rounded-lg p-6">
    <p className="text-sm text-muted-foreground mb-1">Citation Rate</p>
    <p className="text-3xl font-bold">{summary.citationRate}%</p>
  </div>
) : (
  <div className="bg-card border rounded-lg p-6">
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-10 w-16 mb-1" />
  </div>
)}
```

**Interactions**:
- Receives optional summary data from `ResultsPage`
- Handles null/undefined states gracefully with skeletons
- Uses shadcn/ui Skeleton component for loading states
- Automatically transitions from skeleton to data when available

---

### 5. CompetitorsComponent ✨ ENHANCED
**Type**: Frontend UI Component
**Location**: `apps/web/src/components/competitors.tsx` (to be created)
**Responsibility**: Displays top competing domains with skeleton loading support

**Implementation Status**: ⚠️ Needs creation with skeleton support

**Attributes**:
- `competitors`: Competitor[] from API (optional - can be undefined/empty during loading)
- `totalQuestions`: number - For percentage calculation
- `isLoading`: boolean - Whether data is still loading

**Behaviors**:
- `calculatePercentage(count, total)`: number - Citation percentage
- `renderCompetitorBar(count, total)`: JSX - Visual progress bar
- `renderSkeletonRow()`: JSX - Skeleton placeholder for competitor row

**Displayed Information** (per competitor):
- Domain name (e.g., "nytimes.com")
- Citation count (e.g., "3 citations")
- Visual progress bar showing percentage

**UI Layout**:
- Card with "Top Competing Domains" heading
- List of top 5 competitors (or skeleton rows if loading)
- Each competitor shows domain, count, and percentage bar

**Progressive Loading Behavior**:
- When `competitors` is null/undefined: Show 5 skeleton rows
- When `competitors` is partial (< 5): Show real data + skeleton rows for remaining
- When `competitors` is complete: Show all real data
- Fade-in animation as each competitor appears

**Skeleton Pattern**:
- Show skeleton rectangles for domain names
- Show skeleton rectangles for citation counts
- Show skeleton progress bars (animated shimmer)

**Interactions**:
- Receives optional competitor data from `ResultsPage`
- Handles loading states gracefully with skeletons
- Uses shadcn/ui Skeleton component
- Visualizes competitive landscape progressively

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

### Version 1.1.0 (2025-10-21)
**Turborepo Monorepo Migration**

- **UPDATED**: Migrated to Turborepo monorepo structure (`apps/web`)
- **UPDATED**: Components now specify locations in `apps/web/src/`
- **UPDATED**: ResultsAPIHandler location specified as `apps/web/src/app/api/results/[id]/route.ts`
- **UPDATED**: Frontend components in `apps/web/src/app/results/[id]/` and `apps/web/src/components/`
- **UPDATED**: Status indicators added (⚠️ all pending implementation)
- Implementation status: Pending - results page and API routes to be implemented

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 7 core components for results display
- Documented polling mechanism
- Specified UI component breakdown
- Mapped to user stories US-5.1 through US-5.5
