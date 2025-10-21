# UX Specification - Article Analyzer

**Version**: 1.0.0
**Created**: 2025-10-20
**Last Updated**: 2025-10-20
**Epic**: Epic 5 - Results Display & Analysis, Epic 7 - Lead Generation CTAs
**User Stories**: US-5.1 through US-5.5, US-7.1, US-7.2

---

## Overview

This document specifies the frontend implementation requirements for the Article Analyzer feature. It defines two main pages (Landing Page and Results Page), all UI components, API integration contracts, and styling guidelines using shadcn/ui and Tailwind CSS.

**Design System**:
- shadcn/ui components (New York style)
- Tailwind CSS v4
- Existing pattern reference: `src/app/dashboard/page.tsx`
- Icons: Tabler Icons (`@tabler/icons-react`)

---

## Page 1: Landing Page (Homepage)

### Route
**Path**: `/` (root/homepage)
**File**: `src/app/page.tsx`

### Purpose
Primary entry point where users submit article URLs for AI visibility analysis. Serves as both landing page and lead generation funnel.

### Layout Structure

```
┌─────────────────────────────────────────────┐
│          Hero Section                       │
│   - Headline                                │
│   - Subheadline                             │
│   - Value Proposition                       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│          URL Submission Form                │
│   - URL Input                               │
│   - Submit Button                           │
│   - Rate Limit Notice                       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│          Features Grid (3 columns)          │
│   - Citation Rankings                       │
│   - Competitor Analysis                     │
│   - Coverage Opportunities                  │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│          How It Works (3 steps)             │
│   - Step 1: Submit URL                      │
│   - Step 2: AI Analysis                     │
│   - Step 3: View Results                    │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│          CTA Section                        │
│   - Lead Generation CTA                     │
│   - Contact Sales Link                      │
└─────────────────────────────────────────────┘
```

### Components to Implement

#### 1. Hero Section
**Location**: `src/components/hero-section.tsx`
**Epic/Story**: Epic 7 (US-7.1)

**Content**:
```
Headline: "How Visible Is Your Content in AI Search?"
Subheadline: "Test your article's visibility in AI-powered search. See which questions drive citations and discover how you stack up against competitors."
```

**Styling**:
- Max width: `max-w-4xl mx-auto`
- Padding: `px-6 pt-16 pb-12`
- Text alignment: `text-center`
- Headline: `text-5xl md:text-6xl font-bold tracking-tight`
- Gradient text: Use Tailwind gradient utilities

**Example**:
```tsx
<div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
  <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
    How Visible Is Your{' '}
    <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
      Content?
    </span>
  </h1>
  <p className="text-xl md:text-2xl text-muted-foreground mt-6 max-w-3xl mx-auto">
    Test your article's visibility in AI-powered search...
  </p>
</div>
```

#### 2. Submit Form Component
**Location**: `src/components/submit-form.tsx`
**Epic/Story**: Epic 1 (US-1.1)
**Type**: Client Component (`'use client'`)

**State Management**:
```tsx
const [url, setUrl] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)
const [error, setError] = useState('')
```

**Validation**:
- Client-side URL format validation
- Required field validation
- Display errors below input field

**API Integration**:
```tsx
// POST /api/submit
const response = await fetch('/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: url.trim() }),
})

if (!response.ok) {
  const data = await response.json()
  throw new Error(data.message || 'Failed to submit')
}

const data = await response.json()
router.push(`/results/${data.submissionId}`)
```

**UI Components**:
- Use shadcn/ui `Input` component
- Use shadcn/ui `Button` component
- Use shadcn/ui `Label` component (optional)

**Layout**:
```tsx
<form className="max-w-2xl mx-auto px-6 mt-12">
  <div className="flex flex-col sm:flex-row gap-3">
    <Input
      type="url"
      value={url}
      onChange={(e) => setUrl(e.target.value)}
      placeholder="https://example.com/your-article"
      className="flex-1"
      disabled={isSubmitting}
    />
    <Button
      type="submit"
      disabled={isSubmitting || !url.trim()}
      className="px-8"
    >
      {isSubmitting ? 'Analyzing...' : 'Analyze Article'}
    </Button>
  </div>
  {error && <p className="text-destructive text-sm mt-2">{error}</p>}
  <p className="text-sm text-muted-foreground mt-4 text-center">
    Free analysis • 3 articles per day • No sign-up required
  </p>
</form>
```

**Error Messages**:
- Empty URL: "Please enter a URL"
- Invalid format: "Please enter a valid URL (e.g., https://example.com/article)"
- Rate limit: "Rate limit exceeded. You can analyze 3 articles per day."
- Server error: "An error occurred. Please try again."

#### 3. Features Grid
**Location**: `src/components/features-grid.tsx`
**Epic/Story**: Epic 7 (US-7.1)

**Structure**: 3-column grid (responsive)
**Styling Pattern**: Reference `src/components/section-cards.tsx`

**Features**:
1. **Citation Rankings**
   - Icon: Chart/Analytics icon (Tabler Icons)
   - Title: "Citation Rankings"
   - Description: "See exactly where your article appears when AI answers questions related to your content."

2. **Competitor Analysis**
   - Icon: Users/Competition icon
   - Title: "Competitor Analysis"
   - Description: "Discover which competing domains are ranking for your topic and identify gaps in coverage."

3. **Coverage Opportunities**
   - Icon: Target/Opportunity icon
   - Title: "Coverage Opportunities"
   - Description: "Find questions your article should answer but doesn't currently rank for."

**Component Example**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6 py-16">
  <Card>
    <CardHeader>
      <div className="mb-4">
        <IconChartBar className="h-12 w-12 text-primary" />
      </div>
      <CardTitle>Citation Rankings</CardTitle>
      <CardDescription>
        See exactly where your article appears when AI answers questions related to your content.
      </CardDescription>
    </CardHeader>
  </Card>
  {/* ... more cards */}
</div>
```

#### 4. How It Works Section
**Location**: `src/components/how-it-works.tsx`

**Structure**: 3 numbered steps

**Steps**:
1. **Submit Your URL**
   - Description: "Paste any article URL to begin the analysis"
2. **AI Analysis**
   - Description: "Our system tests your article through AI search engines with relevant questions"
3. **View Results**
   - Description: "Get comprehensive insights on your article's visibility and competitors"

**Styling**: Use timeline/step design pattern with numbers/icons

#### 5. CTA Section
**Location**: `src/components/cta-section.tsx`
**Epic/Story**: Epic 7 (US-7.1, US-7.2)

**Content**:
```
Headline: "Want Better Distribution?"
Subheadline: "See how datagum.ai can get your content in front of millions."
CTA Button: "Learn More" (links to contact page or external URL)
```

**Styling**: Gradient background card (reference dashboard patterns)

---

## Page 2: Results Page

### Route
**Path**: `/results/[id]`
**File**: `src/app/results/[id]/page.tsx`

### Purpose
Displays analysis results with real-time polling while processing, then comprehensive results when complete.

### Layout Structure

```
┌─────────────────────────────────────────────┐
│          Header Section                     │
│   - Back to Home link                       │
│   - Article Title                           │
│   - Article URL                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          Summary Statistics (4 cards)       │
│   - Success Rate                            │
│   - Found in Sources                        │
│   - Found in Citations                      │
│   - Unique Competitors                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          Top Competitors Section            │
│   - List of top 5 competing domains         │
│   - Citation counts                         │
│   - Percentage bars                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          Coverage Gaps Section              │
│   - Questions where article didn't appear   │
│   - Competing domains for each gap          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          Detailed Results                   │
│   - Expandable list of all questions        │
│   - Citations for each question             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          CTA Section                        │
│   - Lead generation CTA                     │
└─────────────────────────────────────────────┘
```

### State Management

**Main Page State**:
```tsx
const [data, setData] = useState<AnalysisData | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')
```

**Polling Logic**:
```tsx
useEffect(() => {
  fetchResults()
}, [submissionId])

async function fetchResults() {
  const response = await fetch(`/api/results/${submissionId}`)
  const data = await response.json()
  setData(data)

  // Continue polling if still processing
  if (data.submission.status === 'pending' || data.submission.status === 'processing') {
    setTimeout(fetchResults, 3000) // Poll every 3 seconds
  } else {
    setLoading(false)
  }
}
```

### Components to Implement

#### 1. Loading State Component
**Location**: `src/components/loading-state.tsx`
**Epic/Story**: Epic 5 (US-5.4)

**Purpose**: Show while analysis is in progress

**UI Elements**:
- Animated spinner (use shadcn/ui Skeleton or custom spinner)
- "Analyzing Your Article..." heading
- Progress steps checklist
- Status message based on submission status
- Estimated time message

**Progress Steps**:
```tsx
const steps = [
  { label: 'Reading your article content', done: true },
  { label: 'Generating relevant questions', done: hasQuestions },
  { label: 'Testing in AI search', done: false },
  { label: 'Analyzing competitors', done: false },
]
```

**Component Structure**:
```tsx
<div className="min-h-screen flex items-center justify-center">
  <div className="text-center py-16 max-w-md">
    {/* Spinner */}
    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary mb-6" />

    {/* Heading */}
    <h2 className="text-3xl font-bold mb-4">Analyzing Your Article...</h2>

    {/* Status */}
    <p className="text-lg text-muted-foreground mb-8">
      {status === 'processing' ? 'Testing questions through AI search' : 'Preparing your analysis'}
    </p>

    {/* Progress Card */}
    <Card className="text-left">
      <CardHeader>
        <CardDescription className="mb-4">This usually takes 30-60 seconds. We're:</CardDescription>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <ProgressStep key={i} done={step.done} text={step.label} />
          ))}
        </div>
      </CardHeader>
    </Card>
  </div>
</div>
```

#### 2. Summary Stats Component
**Location**: `src/components/summary-stats.tsx`
**Epic/Story**: Epic 5 (US-5.1)
**Pattern**: Reference `src/components/section-cards.tsx`

**Props**:
```tsx
interface SummaryStatsProps {
  summary: {
    totalQuestions: number
    foundCount: number
    foundInSourcesCount: number
    foundInCitationsCount: number
    successRate: number
    avgResponseTime: number
  }
}
```

**Layout**: 4-column grid (responsive: 1 col mobile, 2 col tablet, 4 col desktop)

**Cards**:
1. **Success Rate**
   - Value: `${summary.successRate}%`
   - Color: Green (>=70%), Yellow (40-69%), Red (<40%)
   - Subtext: `${summary.foundCount}/${summary.totalQuestions} questions`
   - Badge: Success indicator

2. **In Sources**
   - Value: `summary.foundInSourcesCount`
   - Subtext: "Found in source lists"
   - Icon: List icon

3. **In Citations**
   - Value: `summary.foundInCitationsCount`
   - Subtext: "Cited in answers"
   - Icon: Quote icon

4. **Competitors**
   - Value: Number of unique competitors
   - Subtext: "Unique domains"
   - Icon: Competition icon

**Success Rate Color Logic**:
```tsx
function getSuccessRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-600'
  if (rate >= 40) return 'text-yellow-600'
  return 'text-red-600'
}
```

**Component Structure**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <Card>
    <CardHeader>
      <CardDescription>Success Rate</CardDescription>
      <CardTitle className={`text-3xl font-bold ${getSuccessRateColor(summary.successRate)}`}>
        {summary.successRate}%
      </CardTitle>
      <CardAction>
        <Badge variant={summary.successRate >= 70 ? 'default' : 'secondary'}>
          {summary.foundCount}/{summary.totalQuestions} questions
        </Badge>
      </CardAction>
    </CardHeader>
  </Card>
  {/* ... more cards */}
</div>
```

#### 3. Competitors Component
**Location**: `src/components/competitors.tsx`
**Epic/Story**: Epic 5 (US-5.1), Epic 4 (US-4.4)

**Props**:
```tsx
interface CompetitorsProps {
  competitors: {
    topCompetitors: Array<{ domain: string; count: number }>
    totalUniqueCompetitors: number
  }
  totalQuestions: number
}
```

**Layout**: Card with list of competitors

**Component Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Top Competing Domains</CardTitle>
    <CardDescription>
      Domains that were cited instead of your article
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {competitors.topCompetitors.slice(0, 5).map((competitor) => (
        <div key={competitor.domain} className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div className="flex-1">
            <p className="font-medium">{competitor.domain}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {competitor.count} citations
            </span>
            {/* Progress bar */}
            <div className="w-32 bg-muted-foreground/20 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${(competitor.count / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

#### 4. Coverage Gaps Component
**Location**: `src/components/coverage-gaps.tsx`
**Epic/Story**: Epic 5 (US-5.2)

**Props**:
```tsx
interface CoverageGapsProps {
  gaps: Array<{
    question: string
    topCitations: Array<{
      url: string
      title?: string
    }>
  }>
}
```

**Layout**: Card with list of gaps (warning/opportunity styling)

**Component Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Coverage Opportunities</CardTitle>
    <CardDescription>
      Questions where your article didn't appear - potential opportunities for optimization
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {gaps.map((gap, idx) => (
        <div key={idx} className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
          <p className="font-medium mb-2">{gap.question}</p>
          {gap.topCitations?.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Who ranked instead:</p>
              <ul className="list-disc list-inside space-y-1">
                {gap.topCitations.slice(0, 3).map((citation, cidx) => (
                  <li key={cidx}>{new URL(citation.url).hostname}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

#### 5. Detailed Results Component
**Location**: `src/components/detailed-results.tsx`
**Epic/Story**: Epic 5 (US-5.3)

**Props**:
```tsx
interface DetailedResultsProps {
  results: Array<{
    question: string
    targetUrlFound: boolean
    foundInSources: boolean
    foundInCitations: boolean
    citationsCount: number
    sourcesCount: number
    allCitations: Array<{ url: string; title?: string }>
    responseTimeMs?: number
  }>
}
```

**Layout**: Expandable list using HTML `<details>` element or shadcn/ui Collapsible

**Component Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Detailed Results</CardTitle>
    <CardDescription>
      Question-by-question breakdown of AI search performance
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {results.map((result, idx) => (
        <details
          key={idx}
          className={`group p-6 rounded-lg border-2 ${
            result.targetUrlFound
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
              : 'bg-muted border-border'
          }`}
        >
          <summary className="cursor-pointer list-none">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium mb-2">{result.question}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className={result.targetUrlFound ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {result.targetUrlFound ? '✓ Your article appeared' : '✗ Not found'}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {result.citationsCount} total citations
                  </span>
                </div>
              </div>
            </div>
          </summary>

          {/* Expanded content */}
          {result.citationsCount > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">All Citations:</p>
              {result.allCitations.map((citation, cidx) => (
                <div key={cidx} className="text-sm p-3 bg-background rounded border">
                  <p className="font-medium">{citation.title || new URL(citation.url).hostname}</p>
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener"
                    className="text-primary hover:underline text-xs break-all"
                  >
                    {citation.url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  </CardContent>
</Card>
```

#### 6. Failed State Component
**Location**: `src/components/failed-state.tsx`
**Epic/Story**: Epic 5 (US-5.5)

**Purpose**: Display when analysis fails

**Props**:
```tsx
interface FailedStateProps {
  error?: string
}
```

**Component Structure**:
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Card className="max-w-md">
    <CardHeader>
      <div className="mb-4 text-center">
        <IconAlertCircle className="h-16 w-16 text-destructive mx-auto" />
      </div>
      <CardTitle className="text-center">Analysis Failed</CardTitle>
      <CardDescription className="text-center">
        {error || 'We encountered an error while analyzing your article.'}
      </CardDescription>
    </CardHeader>
    <CardFooter className="flex-col gap-2">
      <Button asChild className="w-full">
        <Link href="/">Try Another Article</Link>
      </Button>
      <Button variant="outline" asChild className="w-full">
        <Link href="/contact">Contact Support</Link>
      </Button>
    </CardFooter>
  </Card>
</div>
```

---

## API Integration Contracts

### POST /api/submit

**Request**:
```typescript
{
  url: string  // Required: Article URL to analyze
}
```

**Success Response** (200):
```typescript
{
  success: true
  submissionId: string        // UUID for results lookup
  url: string
  status: 'pending'
  message: string
  resultsUrl: string          // `/results/${submissionId}`
  estimatedTime: string       // "30-60 seconds"
}
```

**Error Responses**:
- **400 Bad Request**: Invalid URL
  ```json
  { "message": "Please enter a valid URL" }
  ```
- **429 Too Many Requests**: Rate limit exceeded
  ```json
  { "message": "Rate limit exceeded. You can analyze 3 articles per day." }
  ```
- **500 Internal Server Error**: Server error
  ```json
  { "message": "An error occurred. Please try again." }
  ```

### GET /api/results/[id]

**Response**:
```typescript
{
  submission: {
    id: string
    url: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    articleTitle: string | null
    scrapingError: string | null
    createdAt: string  // ISO timestamp
    updatedAt: string
    completedAt: string | null
    generatedQuestions: string[]
  }

  results: Array<{
    question: string
    targetUrlFound: boolean
    foundInSources: boolean
    foundInCitations: boolean
    citationsCount: number
    sourcesCount: number
    allCitations: Array<{
      url: string
      title?: string
      startIndex?: number
      endIndex?: number
    }>
    allSources: string[]
    citationDomains: string[]
    responseTimeMs?: number
  }>

  summary: {
    totalQuestions: number
    foundCount: number
    foundInSourcesCount: number
    foundInCitationsCount: number
    successRate: number  // Percentage (0-100)
    avgResponseTime: number  // Milliseconds
  }

  competitors: {
    topCompetitors: Array<{
      domain: string
      count: number
    }>
    totalUniqueCompetitors: number
  }

  coverageGaps: Array<{
    question: string
    topCitations: Array<{
      url: string
      title?: string
    }>
  }>
}
```

**Error Response** (404):
```json
{
  "message": "Submission not found"
}
```

---

## Styling Guidelines

### Color Palette
- **Primary**: Default theme primary color
- **Success**: `green-600` (>=70% success rate)
- **Warning**: `yellow-600` (40-69% success rate)
- **Error/Destructive**: `red-600` (<40% success rate)
- **Muted**: Default theme muted colors

### Typography
- **Headlines**: `text-5xl md:text-6xl font-bold tracking-tight`
- **Subheadings**: `text-xl md:text-2xl`
- **Card Titles**: `text-2xl font-semibold` or `text-3xl font-bold`
- **Body**: Default font size with `text-muted-foreground` for secondary text

### Spacing
- **Page Padding**: `px-6 py-12` or `px-4 lg:px-6`
- **Section Spacing**: `py-16` for major sections
- **Component Spacing**: `gap-4` or `gap-6` for grids
- **Card Spacing**: Follow shadcn/ui Card default spacing

### Responsive Breakpoints
- **Mobile**: Default (1 column)
- **Tablet**: `md:` breakpoint (2 columns for stats, single column for lists)
- **Desktop**: `lg:` breakpoint (4 columns for stats, wider layouts)

### Container Widths
- **Hero/Forms**: `max-w-2xl` to `max-w-4xl mx-auto`
- **Content Sections**: `max-w-6xl mx-auto`
- **Full Width**: Cards and grids can be full width with appropriate padding

---

## shadcn/ui Components to Install

**Already Installed**:
- button, card, input, label, badge, skeleton, table, tabs

**Need to Install**:
```bash
# For loading states
pnpx shadcn@latest add progress

# For collapsible sections (alternative to <details>)
pnpx shadcn@latest add collapsible

# For alerts/notifications (optional)
pnpx shadcn@latest add alert
```

---

## Icons (Tabler Icons)

**Already Available**: `@tabler/icons-react`

**Icons to Use**:
- `IconTrendingUp`, `IconTrendingDown` - For metrics
- `IconChartBar`, `IconChartArea` - For analytics features
- `IconUsers`, `IconUser` - For competitors
- `IconTarget` - For opportunities
- `IconAlertCircle` - For errors
- `IconLoader` or `IconLoader2` - For loading spinners
- `IconCheck`, `IconX` - For success/failure indicators
- `IconExternalLink` - For external links

**Usage**:
```tsx
import { IconChartBar, IconLoader2 } from '@tabler/icons-react'

<IconChartBar className="h-12 w-12 text-primary" />
<IconLoader2 className="h-6 w-6 animate-spin" />
```

---

## Accessibility Requirements

- **Keyboard Navigation**: All interactive elements keyboard accessible
- **ARIA Labels**: Add appropriate labels to icons and buttons
- **Focus States**: Visible focus indicators on all interactive elements
- **Color Contrast**: Follow WCAG AA standards
- **Loading States**: Use `aria-busy` and `aria-live` for dynamic content
- **Form Labels**: Associate labels with inputs
- **Error Announcements**: Screen reader friendly error messages

---

## Performance Considerations

- **Client Components**: Mark as `'use client'` only when needed (forms, polling)
- **Server Components**: Use Server Components for static content
- **Images**: Use Next.js `Image` component with proper sizing
- **Code Splitting**: Import large components dynamically if needed
- **Polling**: Clean up intervals on component unmount

---

## Testing Checklist

### Visual Testing
- [ ] Landing page renders correctly
- [ ] Form submission works
- [ ] Error states display properly
- [ ] Results page polls correctly
- [ ] Loading state shows progress
- [ ] Summary stats display with correct colors
- [ ] Competitors list renders
- [ ] Coverage gaps show correctly
- [ ] Detailed results expand/collapse
- [ ] Failed state displays
- [ ] All responsive breakpoints work
- [ ] Dark mode works (if applicable)

### Functional Testing
- [ ] URL validation works
- [ ] Form submission redirects to results
- [ ] Polling stops when status is 'completed' or 'failed'
- [ ] All API error scenarios handled
- [ ] Rate limit error displays
- [ ] External links open in new tab
- [ ] Navigation works (back to home)

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Focus states visible
- [ ] Color contrast meets standards

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                          # Landing page (homepage)
│   ├── results/
│   │   └── [id]/
│   │       └── page.tsx                  # Results page with polling
│   └── api/
│       ├── submit/
│       │   └── route.ts                  # POST /api/submit
│       └── results/
│           └── [id]/
│               └── route.ts              # GET /api/results/[id]
├── components/
│   ├── hero-section.tsx                  # Landing page hero
│   ├── submit-form.tsx                   # URL submission form (client)
│   ├── features-grid.tsx                 # Features section
│   ├── how-it-works.tsx                  # How it works section
│   ├── cta-section.tsx                   # Lead gen CTA
│   ├── loading-state.tsx                 # Analysis in progress
│   ├── summary-stats.tsx                 # 4 metric cards
│   ├── competitors.tsx                   # Top competitors list
│   ├── coverage-gaps.tsx                 # Opportunity list
│   ├── detailed-results.tsx              # Question-by-question results
│   └── failed-state.tsx                  # Error state
└── types/
    └── analysis.ts                       # Shared TypeScript types
```

---

## Implementation Priority

### Phase 1: Critical Path
1. Landing page (hero + form)
2. Submit form component with API integration
3. Results page with polling logic
4. Loading state component
5. Basic results display (summary stats)

### Phase 2: Enhanced Results
6. Detailed results component
7. Competitors component
8. Coverage gaps component
9. Failed state component

### Phase 3: Polish
10. Features grid on landing page
11. How it works section
12. CTA sections
13. Styling refinements
14. Accessibility improvements

---

## Notes for Frontend Developers

- **Reuse Patterns**: Reference `src/app/dashboard/page.tsx` for card layouts and styling patterns
- **shadcn/ui**: Install additional components as needed with `pnpx shadcn@latest add <component>`
- **Type Safety**: Define all API response types in `src/types/analysis.ts`
- **Error Handling**: Always handle API errors gracefully with user-friendly messages
- **Polling**: Remember to clean up polling intervals on component unmount
- **Responsive**: Test all breakpoints (mobile, tablet, desktop)
- **Dark Mode**: Ensure components work in both light and dark themes

---

## Epic/Story References

All frontend components must include epic/story references in comments:

```tsx
/**
 * Article Analyzer - Submit Form Component
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1 - Submit Article URL
 *
 * Client component that handles article URL submission
 */
```
