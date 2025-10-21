# Article Analyzer Domain Model - Complete Implementation Guide

> **Purpose**: AI-powered article visibility analyzer that shows how content performs in AI search engines (ChatGPT, Perplexity). Lead generation tool for content distribution services.

---

## 🎯 Feature Overview

### What It Does
1. User submits any article URL (public, no authentication required)
2. System scrapes article content (title, headings, body text)
3. GPT-4 generates 10 relevant search queries based on article content
4. Each query is tested through OpenAI Search (GPT-5 with web_search tool)
5. Results show citation performance, competitor analysis, and coverage gaps
6. Multiple CTAs drive users to contact sales for content distribution services

### User Flow
```
/analyze (landing page)
  → Submit URL + validation
  → Redirect to /analyze/results/[id]
  → Poll for results (3-second intervals)
  → Display loading state with progress indicators
  → Show comprehensive results when complete
  → CTA to contact sales
```

### Key Metrics Displayed
- **Success Rate**: % of questions where article was cited
- **Citation Tiers**: Found in Sources vs Actually Cited (three-tier tracking)
- **Top Competitors**: Which domains rank instead, with frequency
- **Coverage Gaps**: Questions where article should rank but doesn't
- **Response Times**: Average speed of AI search responses

---

## 🗄️ Database Schema

### Technology
- **Database**: PostgreSQL (or any SQL database supporting JSONB)
- **ORM**: Your choice (Drizzle, Prisma, or raw SQL)

### Table 1: `content_analysis_submissions`

```sql
CREATE TABLE content_analysis_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  user_ip VARCHAR(45), -- IPv4 or IPv6 for rate limiting
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  generated_questions JSONB DEFAULT '[]',
  scraping_error TEXT,
  article_title TEXT,
  article_content TEXT, -- Store preview (first 5000 chars)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_content_analysis_submissions_status ON content_analysis_submissions(status);
CREATE INDEX idx_content_analysis_submissions_user_ip ON content_analysis_submissions(user_ip);
CREATE INDEX idx_content_analysis_submissions_created_at ON content_analysis_submissions(created_at);

COMMENT ON TABLE content_analysis_submissions IS 'Tracks article URL submissions for AI search visibility analysis';
COMMENT ON COLUMN content_analysis_submissions.status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN content_analysis_submissions.user_ip IS 'IP address for rate limiting (3 per 24 hours)';
```

### Table 2: `content_analysis_results`

```sql
CREATE TABLE content_analysis_results (
  id SERIAL PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES content_analysis_submissions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  target_url_found BOOLEAN DEFAULT false,
  all_citations JSONB DEFAULT '[]', -- Array of {url, title, startIndex, endIndex}
  all_sources JSONB DEFAULT '[]', -- Array of source URLs retrieved
  found_in_sources BOOLEAN DEFAULT false, -- Was URL in sources list?
  found_in_citations BOOLEAN DEFAULT false, -- Was URL actually cited in answer?
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_content_analysis_results_submission_id ON content_analysis_results(submission_id);
CREATE INDEX idx_content_analysis_results_target_found ON content_analysis_results(target_url_found);

COMMENT ON TABLE content_analysis_results IS 'Individual question test results for each submission';
COMMENT ON COLUMN content_analysis_results.all_citations IS 'Citations that appeared in the answer';
COMMENT ON COLUMN content_analysis_results.all_sources IS 'All sources retrieved (may not all be cited)';
COMMENT ON COLUMN content_analysis_results.found_in_sources IS 'Whether target URL was in sources list';
COMMENT ON COLUMN content_analysis_results.found_in_citations IS 'Whether target URL was cited in answer';
```

### TypeScript Types

```typescript
// Submission types
type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ContentAnalysisSubmission {
  id: string;
  url: string;
  user_ip?: string;
  status: SubmissionStatus;
  generated_questions: string[];
  scraping_error?: string;
  article_title?: string;
  article_content?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

// Result types
interface CitationInfo {
  url: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
}

interface ContentAnalysisResult {
  id: number;
  submission_id: string;
  question: string;
  target_url_found: boolean;
  all_citations: CitationInfo[];
  all_sources: string[];
  found_in_sources: boolean;
  found_in_citations: boolean;
  response_time_ms?: number;
  created_at: Date;
}
```

---

## 🔌 API Endpoints

### Next.js App Router Structure

```
app/
  api/
    analyze/
      submit/
        route.ts          # POST /api/analyze/submit
      results/
        [id]/
          route.ts        # GET /api/analyze/results/[id]
```

### POST `/api/analyze/submit`

**Purpose**: Submit article URL for analysis

**Request Body**:
```typescript
{
  url: string;           // Required: Article URL to analyze
  maxQuestions?: number; // Optional: Max questions to generate (default: 10)
}
```

**Response**:
```typescript
{
  success: boolean;
  submissionId: string;        // UUID for results lookup
  url: string;
  status: 'pending';
  message: string;
  resultsUrl: string;          // `/analyze/results/${submissionId}`
  estimatedTime: '30-60 seconds';
}
```

**Validation**:
- URL is required and must be valid HTTP/HTTPS
- Rate limit: 3 submissions per IP per 24 hours (skip in development)
- Extract IP from request headers (x-forwarded-for or remoteAddress)

**Error Responses**:
- `400`: Invalid URL format
- `429`: Rate limit exceeded
- `500`: Server error

**Implementation Steps**:
1. Validate URL format (try `new URL(body.url)`)
2. Get user IP address from request
3. Check rate limit (count recent submissions from this IP in last 24 hours)
4. Create submission record in database with status='pending'
5. Queue background job for processing
6. Return submission ID for polling

**Rate Limiting Logic**:
```typescript
// Skip in development
if (process.env.NODE_ENV !== 'production') {
  // No rate limiting in dev
}

// Count submissions from this IP in last 24 hours
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentCount = await db
  .select()
  .from(submissions)
  .where(eq(submissions.user_ip, userIp))
  .where(gte(submissions.created_at, twentyFourHoursAgo));

if (recentCount.length >= 3) {
  throw new Error('Rate limit exceeded');
}
```

---

### GET `/api/analyze/results/[id]`

**Purpose**: Get analysis results for a submission

**URL Parameters**:
- `id`: Submission UUID

**Response**:
```typescript
{
  submission: {
    id: string;
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    articleTitle?: string;
    scrapingError?: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    generatedQuestions: string[];
  };

  results: Array<{
    question: string;
    targetUrlFound: boolean;
    foundInSources: boolean;
    foundInCitations: boolean;
    citationsCount: number;
    sourcesCount: number;
    allCitations: CitationInfo[];
    allSources: string[];
    citationDomains: string[]; // Unique domains from citations
    responseTimeMs?: number;
  }>;

  summary: {
    totalQuestions: number;
    foundCount: number;
    foundInSourcesCount: number;
    foundInCitationsCount: number;
    successRate: number; // Percentage
    avgResponseTime: number; // Milliseconds
  };

  competitors: {
    topCompetitors: Array<{
      domain: string;
      count: number; // How many times they appeared
    }>;
    totalUniqueCompetitors: number;
  };

  coverageGaps: Array<{
    question: string;
    topCitations: CitationInfo[]; // Who ranked instead (top 3)
  }>;
}
```

**Error Responses**:
- `404`: Submission not found
- `500`: Server error

**Processing Logic**:
```typescript
// 1. Fetch submission
const submission = await getSubmission(id);
if (!submission) return 404;

// 2. Fetch all results
const results = await getResults(id);

// 3. Process results for display
const processedResults = results.map(result => {
  // Extract unique domains from citations
  const citationDomains = result.all_citations
    .map(c => new URL(c.url).hostname)
    .filter(Boolean);

  return {
    question: result.question,
    targetUrlFound: result.target_url_found,
    foundInSources: result.found_in_sources,
    foundInCitations: result.found_in_citations,
    citationsCount: result.all_citations.length,
    sourcesCount: result.all_sources.length,
    allCitations: result.all_citations,
    allSources: result.all_sources,
    citationDomains: [...new Set(citationDomains)],
    responseTimeMs: result.response_time_ms,
  };
});

// 4. Calculate summary statistics
const totalQuestions = results.length;
const foundCount = results.filter(r => r.target_url_found).length;
const successRate = (foundCount / totalQuestions) * 100;

// 5. Analyze competitors
const targetDomain = new URL(submission.url).hostname;
const competitorFrequency = {};
processedResults.forEach(result => {
  result.citationDomains.forEach(domain => {
    if (domain !== targetDomain) {
      competitorFrequency[domain] = (competitorFrequency[domain] || 0) + 1;
    }
  });
});

const topCompetitors = Object.entries(competitorFrequency)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([domain, count]) => ({ domain, count }));

// 6. Identify coverage gaps
const coverageGaps = processedResults
  .filter(r => !r.targetUrlFound)
  .map(r => ({
    question: r.question,
    topCitations: r.allCitations.slice(0, 3),
  }))
  .slice(0, 5);

// 7. Return comprehensive response
return { submission, results: processedResults, summary, competitors, coverageGaps };
```

---

## 🛠️ Core Services

### 1. Article Scraper Service

**File**: `lib/services/article-scraper.service.ts`

**Dependencies**:
```bash
npm install cheerio
```

**Purpose**: Scrape article content from any URL

**Interface**:
```typescript
interface ScrapedArticle {
  url: string;
  title: string;
  content: string;
  headings: string[];
  metaDescription?: string;
  author?: string;
  publishedDate?: string;
  error?: string;
}

class ArticleScraperService {
  async scrapeArticle(url: string): Promise<ScrapedArticle>;
}
```

**Implementation Details**:

1. **Fetch HTML**:
```typescript
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; YourBot/1.0)',
    'Accept': 'text/html',
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch: ${response.status}`);
}

const html = await response.text();
```

2. **Extract Title** (priority order):
```typescript
const selectors = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'h1',
  'title',
];

for (const selector of selectors) {
  const element = $(selector).first();
  if (element.length) {
    const content = element.attr('content') || element.text();
    if (content?.trim()) return content.trim();
  }
}
```

3. **Extract Content**:
```typescript
// Remove unwanted elements
$('script, style, nav, header, footer, aside, iframe, .advertisement, .ads').remove();

// Try common article selectors
const articleSelectors = [
  'article',
  '[role="main"]',
  '.article-content',
  '.post-content',
  '.entry-content',
  'main',
];

for (const selector of articleSelectors) {
  const article = $(selector).first();
  if (article.length) {
    const paragraphs = [];
    article.find('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        paragraphs.push(text);
      }
    });

    const content = paragraphs.join('\n\n');
    if (content.length > 100) return content;
  }
}

// Fallback: get all paragraphs
const fallback = [];
$('p').each((_, el) => {
  const text = $(el).text().trim();
  if (text && text.length > 30) {
    fallback.push(text);
  }
});
return fallback.join('\n\n');
```

4. **Extract Headings**:
```typescript
const headings: string[] = [];
$('h1, h2, h3, h4, h5, h6').each((_, element) => {
  const text = $(element).text().trim();
  if (text && text.length > 0 && text.length < 200) {
    headings.push(text);
  }
});
```

5. **Error Handling**:
```typescript
try {
  // scraping logic
} catch (error) {
  return {
    url,
    title: '',
    content: '',
    headings: [],
    error: error.message,
  };
}
```

---

### 2. Question Generator Service

**File**: `lib/services/question-generator.service.ts`

**Dependencies**:
```bash
npm install openai
```

**Environment Variables**:
```
OPENAI_API_KEY=sk-...
```

**Purpose**: Generate relevant search queries from article content using GPT-4

**Interface**:
```typescript
interface GeneratedQuestions {
  questions: string[];
  contentSummary?: string;
  error?: string;
}

class QuestionGeneratorService {
  async generateQuestions(
    article: { title: string; content: string; headings: string[] },
    maxQuestions?: number
  ): Promise<GeneratedQuestions>;
}
```

**Implementation**:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async generateQuestions(article, maxQuestions = 10) {
  // Prepare content (limit to ~3000 words to avoid token limits)
  const contentPreview = article.content.slice(0, 12000);
  const headingsList = article.headings.slice(0, 10).join('\n- ');

  const prompt = `You are an expert at analyzing content and generating natural search queries that users might type into AI search engines like ChatGPT, Perplexity, or Google.

Analyze this article and generate ${maxQuestions} diverse, natural search queries that a user might ask where this article would be a highly relevant answer.

Article Title: ${article.title}

Main Headings:
- ${headingsList}

Article Content Preview:
${contentPreview}

Generate ${maxQuestions} search queries that:
1. Are natural questions users would actually ask (not keyword stuffing)
2. Cover different topics/angles from the article
3. Range from broad to specific
4. Would make this article a valuable source to cite
5. Are phrased as questions or natural search queries

Return ONLY a JSON object in this format:
{
  "questions": ["question 1", "question 2", ...],
  "contentSummary": "brief 1-2 sentence summary of what the article is about"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates natural search queries. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const result = JSON.parse(content);

  // Validate and clean
  const questions = result.questions
    .filter(q => typeof q === 'string' && q.trim().length > 0)
    .slice(0, maxQuestions);

  if (questions.length === 0) {
    throw new Error('No valid questions generated');
  }

  return {
    questions,
    contentSummary: result.contentSummary,
  };
}
```

**Cost Estimate**: ~$0.01-0.03 per article (GPT-4 Turbo pricing)

---

### 3. OpenAI Search Tester Service

**File**: `lib/services/openai-search-tester.service.ts`

**Dependencies**: `openai` (already installed)

**Purpose**: Test queries through OpenAI's Responses API with web_search tool

**Interface**:
```typescript
interface SearchTestResult {
  found: boolean;
  citationUrl?: string;
  responseTimeMs: number;
  searchDepth: number;
  allCitations: CitationInfo[];
  allSources: any[];
  foundInSources: boolean;
  foundInCitations: boolean;
  searchResponse: any;
  model: string;
}

class OpenAISearchTesterService {
  async testQuery(
    query: string,
    targetUrl: string
  ): Promise<SearchTestResult>;
}
```

**Implementation**:

```typescript
import OpenAI from 'openai';

async testQuery(query: string, targetUrl: string): Promise<SearchTestResult> {
  const startTime = Date.now();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Use Responses API with web_search tool
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: query,
      tools: [{ type: 'web_search' }],
      reasoning: { effort: 'low' }, // Faster responses
      include: ['web_search_call.action.sources'],
    });

    const responseTimeMs = Date.now() - startTime;

    // Extract sources and citations
    const { allSources, allCitations, foundInSources, foundInCitations } =
      this.parseSearchResponse(response, targetUrl);

    return {
      found: foundInSources || foundInCitations,
      citationUrl: foundInCitations ? targetUrl : undefined,
      responseTimeMs,
      searchDepth: allSources.length,
      allCitations,
      allSources,
      foundInSources,
      foundInCitations,
      searchResponse: response,
      model: response.model || 'gpt-5',
    };
  } catch (error) {
    return {
      found: false,
      responseTimeMs: Date.now() - startTime,
      searchDepth: 0,
      allCitations: [],
      allSources: [],
      foundInSources: false,
      foundInCitations: false,
      model: 'gpt-5',
      searchResponse: { error: error.message },
    };
  }
}

private parseSearchResponse(response: any, targetUrl: string) {
  const allCitations: CitationInfo[] = [];
  const allSources: any[] = [];
  let foundInSources = false;
  let foundInCitations = false;

  // Handle response.output (can be array or object)
  const outputItems = Array.isArray(response.output)
    ? response.output
    : Object.values(response.output || {});

  // Extract creative ID from target URL for flexible matching
  const targetCreativeMatch = targetUrl.match(/\/creatives\/(\d+)/);
  const targetCreativeId = targetCreativeMatch?.[1];

  for (const item of outputItems) {
    // Check web search calls for sources
    if (item.type === 'web_search_call') {
      if (item.action?.sources && Array.isArray(item.action.sources)) {
        for (const source of item.action.sources) {
          allSources.push(source);

          const sourceUrl = typeof source === 'string' ? source : source?.url || '';
          const cleanSourceUrl = this.cleanUrl(sourceUrl);

          if (cleanSourceUrl && this.checkUrlMatch(cleanSourceUrl, targetUrl, targetCreativeId)) {
            foundInSources = true;
          }
        }
      }
    }

    // Process message content for citations
    if (item.type === 'message' && item.content) {
      for (const contentItem of item.content) {
        if (contentItem.text) {
          // Could extract text here if needed
        }

        // Process annotations (citations)
        if (contentItem.annotations?.length) {
          for (const annotation of contentItem.annotations) {
            if (annotation.type === 'url_citation' && annotation.url) {
              const cleanUrl = this.cleanUrl(annotation.url);
              const citationInfo: CitationInfo = {
                url: cleanUrl,
                title: annotation.title,
                startIndex: annotation.start_index,
                endIndex: annotation.end_index,
              };
              allCitations.push(citationInfo);

              if (this.checkUrlMatch(cleanUrl, targetUrl, targetCreativeId)) {
                foundInCitations = true;
              }
            }
          }
        }
      }
    }
  }

  return { allCitations, allSources, foundInSources, foundInCitations };
}

private cleanUrl(url: string): string {
  return url.split('?')[0].split('#')[0];
}

private checkUrlMatch(
  citationUrl: string,
  targetUrl: string,
  targetCreativeId?: string
): boolean {
  const cleanCitationUrl = this.cleanUrl(citationUrl);
  const cleanTargetUrl = this.cleanUrl(targetUrl);

  // Exact match
  if (cleanCitationUrl === cleanTargetUrl) return true;

  // Creative ID match (if URL contains /creatives/{id})
  if (targetCreativeId) {
    const expectedPattern = `/creatives/${targetCreativeId}`;
    if (citationUrl.includes(expectedPattern)) return true;
  }

  return false;
}
```

**Cost Estimate**: ~$0.02-0.05 per query (GPT-5 with search pricing)

**Total Cost Per Analysis**: 10 questions × $0.03 = ~$0.30 per article

---

## ⚙️ Background Job Processing

### Architecture Choice

**Option 1: Simple Queue (Recommended for MVP)**
- Use database table as queue
- Poll with `setInterval` in Next.js
- Works with serverless (Vercel, Cloudflare)

**Option 2: Bull/BullMQ with Redis**
- More robust for high volume
- Requires Redis instance
- Better for dedicated server deployment

**Option 3: Serverless Queue (AWS SQS, Cloudflare Queues)**
- Best for Cloudflare Workers deployment
- Native integration with `@opennextjs/cloudflare`

### Implementation: Database Queue (Simple)

**Job Table**:
```sql
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES content_analysis_submissions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_submission_id ON analysis_jobs(submission_id);
```

**Job Processor**:

```typescript
// lib/jobs/job-processor.ts

class JobProcessor {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Poll every 5 seconds
    this.pollInterval = setInterval(() => this.processJobs(), 5000);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
  }

  async processJobs() {
    // Get next pending job
    const job = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.status, 'pending'))
      .orderBy(analysisJobs.created_at)
      .limit(1);

    if (!job[0]) return;

    try {
      // Mark as processing
      await db
        .update(analysisJobs)
        .set({
          status: 'processing',
          started_at: new Date(),
          attempts: job[0].attempts + 1,
        })
        .where(eq(analysisJobs.id, job[0].id));

      // Process the job
      await this.executeJob(job[0]);

      // Mark as completed
      await db
        .update(analysisJobs)
        .set({
          status: 'completed',
          completed_at: new Date(),
        })
        .where(eq(analysisJobs.id, job[0].id));

    } catch (error) {
      // Check if should retry
      if (job[0].attempts < job[0].max_attempts) {
        await db
          .update(analysisJobs)
          .set({
            status: 'pending',
            error_message: error.message,
          })
          .where(eq(analysisJobs.id, job[0].id));
      } else {
        // Max attempts reached - mark as failed
        await db
          .update(analysisJobs)
          .set({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date(),
          })
          .where(eq(analysisJobs.id, job[0].id));

        // Mark submission as failed
        await db
          .update(contentAnalysisSubmissions)
          .set({ status: 'failed', scraping_error: error.message })
          .where(eq(contentAnalysisSubmissions.id, job[0].submission_id));
      }
    }
  }

  async executeJob(job: AnalysisJob) {
    const submission = await getSubmission(job.submission_id);
    if (!submission) throw new Error('Submission not found');

    // Update submission status to processing
    await db
      .update(contentAnalysisSubmissions)
      .set({ status: 'processing', updated_at: new Date() })
      .where(eq(contentAnalysisSubmissions.id, submission.id));

    // Step 1: Scrape article
    const scraper = new ArticleScraperService();
    const scrapedArticle = await scraper.scrapeArticle(submission.url);

    if (scrapedArticle.error || !scrapedArticle.content) {
      throw new Error(scrapedArticle.error || 'Failed to scrape article');
    }

    // Step 2: Generate questions
    const questionGen = new QuestionGeneratorService();
    const generated = await questionGen.generateQuestions(scrapedArticle, 10);

    if (generated.error || !generated.questions.length) {
      throw new Error(generated.error || 'Failed to generate questions');
    }

    // Update submission with questions and article data
    await db
      .update(contentAnalysisSubmissions)
      .set({
        generated_questions: generated.questions,
        article_title: scrapedArticle.title,
        article_content: scrapedArticle.content.slice(0, 5000),
        updated_at: new Date(),
      })
      .where(eq(contentAnalysisSubmissions.id, submission.id));

    // Step 3: Test each question
    const searchTester = new OpenAISearchTesterService();
    const results: NewContentAnalysisResult[] = [];

    for (const question of generated.questions) {
      try {
        const testResult = await searchTester.testQuery(question, submission.url);

        results.push({
          submission_id: submission.id,
          question,
          target_url_found: testResult.foundInSources || testResult.foundInCitations,
          all_citations: testResult.allCitations,
          all_sources: testResult.allSources,
          found_in_sources: testResult.foundInSources,
          found_in_citations: testResult.foundInCitations,
          response_time_ms: testResult.responseTimeMs,
        });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Log error but continue with other questions
        console.error('Failed to test question:', question, error);

        // Store failed result
        results.push({
          submission_id: submission.id,
          question,
          target_url_found: false,
          all_citations: [],
          all_sources: [],
          found_in_sources: false,
          found_in_citations: false,
          response_time_ms: 0,
        });
      }
    }

    // Step 4: Save results
    await db.insert(contentAnalysisResults).values(results);

    // Step 5: Mark submission as completed
    await db
      .update(contentAnalysisSubmissions)
      .set({
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(contentAnalysisSubmissions.id, submission.id));
  }
}

// Export singleton
export const jobProcessor = new JobProcessor();
```

**Start Job Processor**:

```typescript
// app/api/cron/process-jobs/route.ts
// Or use this in a separate Node.js process

import { jobProcessor } from '@/lib/jobs/job-processor';

// Start when server starts
if (process.env.NODE_ENV === 'production') {
  jobProcessor.start();
}

export async function GET() {
  // Manual trigger endpoint (for cron jobs)
  await jobProcessor.processJobs();
  return Response.json({ success: true });
}
```

---

## 🎨 Frontend Pages

### Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI + shadcn/ui
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Page 1: Landing Page

**Route**: `app/analyze/page.tsx`

**Purpose**: Entry point where users submit article URLs

**Layout**:
```tsx
export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <HeroSection />

      {/* URL Input Form */}
      <SubmitForm />

      {/* Features Grid */}
      <FeaturesSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}
```

**Components**:

1. **HeroSection**:
```tsx
<div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
  <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900">
    How Visible Is Your
    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
      {' '}Content?
    </span>
  </h1>

  <p className="text-xl md:text-2xl text-gray-600 mt-6 max-w-3xl mx-auto">
    Test your article's visibility in AI-powered search. See which questions
    drive citations and discover how you stack up against competitors.
  </p>
</div>
```

2. **SubmitForm**:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SubmitForm() {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate URL
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/article)');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/analyze/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit');
      }

      const data = await response.json();
      router.push(`/analyze/results/${data.submissionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit your article. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 mt-12">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/your-article"
            className="flex-1 px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-xl hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting ? 'Analyzing...' : 'Analyze Article'}
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}
      </form>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Free analysis • 3 articles per day • No sign-up required
      </p>
    </div>
  );
}
```

3. **FeaturesSection**:
```tsx
<div className="max-w-6xl mx-auto px-6 py-16">
  <div className="grid md:grid-cols-3 gap-8">
    <FeatureCard
      icon={<BarChart3Icon />}
      title="Citation Rankings"
      description="See exactly where your article appears when AI answers questions related to your content."
    />
    <FeatureCard
      icon={<UsersIcon />}
      title="Competitor Analysis"
      description="Discover which competing domains are ranking for your topic and identify gaps in coverage."
    />
    <FeatureCard
      icon={<ZapIcon />}
      title="Coverage Opportunities"
      description="Find questions your article should answer but doesn't currently rank for."
    />
  </div>
</div>
```

4. **HowItWorksSection**: (3 numbered steps with descriptions)

5. **CTASection**:
```tsx
<div className="max-w-4xl mx-auto px-6 py-16">
  <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white">
    <h2 className="text-3xl md:text-4xl font-bold mb-4">
      Want Better Distribution?
    </h2>
    <p className="text-xl mb-8 opacity-90">
      See how [Your Company] can get your content in front of millions.
    </p>
    <a
      href="https://yourcompany.com/contact"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:shadow-xl transform hover:scale-105 transition-all"
    >
      Learn More
    </a>
  </div>
</div>
```

---

### Page 2: Results Page

**Route**: `app/analyze/results/[id]/page.tsx`

**Purpose**: Display analysis results with real-time polling

**Key Features**:
- Poll every 3 seconds while status is pending/processing
- Show loading state with progress indicators
- Display comprehensive results when complete
- Error states for failed analyses

**Implementation**:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AnalysisData {
  submission: any;
  results: any[];
  summary: any;
  competitors: any;
  coverageGaps: any[];
}

export default function ResultsPage() {
  const params = useParams();
  const submissionId = params.id as string;

  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResults();
  }, [submissionId]);

  async function fetchResults() {
    try {
      const response = await fetch(`/api/analyze/results/${submissionId}`);

      if (!response.ok) {
        throw new Error('Failed to load results');
      }

      const data = await response.json();
      setData(data);

      // If still processing, poll again in 3 seconds
      if (data.submission.status === 'pending' || data.submission.status === 'processing') {
        setTimeout(fetchResults, 3000);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Loading/Processing State
  if (loading || !data || data.submission.status !== 'completed') {
    return <LoadingState data={data} />;
  }

  // Error State
  if (data.submission.status === 'failed') {
    return <FailedState error={data.submission.scrapingError} />;
  }

  // Results State
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <Header submission={data.submission} />

        {/* Summary Stats */}
        <SummaryStats summary={data.summary} />

        {/* Top Competitors */}
        <CompetitorsSection competitors={data.competitors} />

        {/* Coverage Gaps */}
        <CoverageGapsSection gaps={data.coverageGaps} />

        {/* Detailed Results */}
        <DetailedResults results={data.results} />

        {/* CTA */}
        <CTASection />
      </div>
    </div>
  );
}
```

**LoadingState Component**:
```tsx
function LoadingState({ data }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-6" />

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Analyzing Your Article...
        </h2>

        <p className="text-lg text-gray-600 mb-8">
          {data?.submission?.status === 'processing'
            ? 'Testing questions through AI search'
            : 'Preparing your analysis'}
        </p>

        <div className="max-w-md mx-auto bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-4">This usually takes 30-60 seconds. We're:</p>
          <ul className="space-y-2 text-left text-sm text-gray-600">
            <ProgressItem done text="Reading your article content" />
            <ProgressItem
              done={data?.submission?.generated_questions?.length > 0}
              text="Generating relevant questions"
            />
            <ProgressItem
              done={false}
              text="Testing in AI search"
            />
            <ProgressItem
              done={false}
              text="Analyzing competitors"
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function ProgressItem({ done, text }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        className={`w-5 h-5 ${done ? 'text-green-500' : 'text-gray-400'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      {text}
    </li>
  );
}
```

**SummaryStats Component**:
```tsx
function SummaryStats({ summary }) {
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid md:grid-cols-4 gap-6">
      <StatCard
        label="Success Rate"
        value={`${summary.successRate}%`}
        subtext={`${summary.foundCount}/${summary.totalQuestions} questions`}
        valueClassName={getSuccessRateColor(summary.successRate)}
      />
      <StatCard
        label="In Sources"
        value={summary.foundInSourcesCount}
        subtext="Found in source lists"
        valueClassName="text-blue-600"
      />
      <StatCard
        label="In Citations"
        value={summary.foundInCitationsCount}
        subtext="Cited in answers"
        valueClassName="text-purple-600"
      />
      <StatCard
        label="Competitors"
        value={summary.totalUniqueCompetitors}
        subtext="Unique domains"
        valueClassName="text-gray-900"
      />
    </div>
  );
}

function StatCard({ label, value, subtext, valueClassName }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${valueClassName}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtext}</div>
    </div>
  );
}
```

**CompetitorsSection**:
```tsx
function CompetitorsSection({ competitors }) {
  if (competitors.topCompetitors.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Top Competing Domains
      </h2>

      <div className="space-y-3">
        {competitors.topCompetitors.slice(0, 5).map((competitor) => (
          <div
            key={competitor.domain}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-900">{competitor.domain}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {competitor.count} citations
              </div>

              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${(competitor.count / data.summary.totalQuestions) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**CoverageGapsSection**:
```tsx
function CoverageGapsSection({ gaps }) {
  if (gaps.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Coverage Opportunities
      </h2>

      <p className="text-gray-600 mb-6">
        Questions where your article didn't appear - potential opportunities
        for optimization or additional content.
      </p>

      <div className="space-y-4">
        {gaps.map((gap, idx) => (
          <div
            key={idx}
            className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <div className="font-medium text-gray-900 mb-2">
              {gap.question}
            </div>

            {gap.topCitations?.length > 0 && (
              <div className="text-sm text-gray-600">
                <div className="font-medium mb-1">Who ranked instead:</div>
                <ul className="list-disc list-inside space-y-1">
                  {gap.topCitations.slice(0, 3).map((citation, cidx) => (
                    <li key={cidx}>
                      {new URL(citation.url).hostname}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**DetailedResults**:
```tsx
function DetailedResults({ results }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Detailed Results
      </h2>

      <div className="space-y-4">
        {results.map((result, idx) => (
          <details
            key={idx}
            className={`p-6 rounded-lg border-2 ${
              result.targetUrlFound
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <summary className="cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-2">
                    {result.question}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className={
                      result.targetUrlFound
                        ? 'text-green-600 font-medium'
                        : 'text-gray-500'
                    }>
                      {result.targetUrlFound
                        ? '✓ Your article appeared'
                        : '✗ Not found'}
                    </span>

                    <span className="text-gray-400">•</span>

                    <span className="text-gray-600">
                      {result.citationsCount} total citations
                    </span>
                  </div>
                </div>
              </div>
            </summary>

            {result.citationsCount > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  All Citations:
                </div>
                {result.allCitations.map((citation, cidx) => (
                  <div
                    key={cidx}
                    className="text-sm p-3 bg-white rounded border border-gray-200"
                  >
                    <div className="font-medium text-gray-900">
                      {citation.title || new URL(citation.url).hostname}
                    </div>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener"
                      className="text-blue-600 hover:underline text-xs"
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
    </div>
  );
}
```

---

## 📦 Dependencies

### Required NPM Packages

```bash
# Core
npm install openai cheerio

# If using Drizzle ORM
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# If using Prisma
npm install @prisma/client
npm install -D prisma

# UI (already in your package.json)
# @radix-ui/react-slot
# lucide-react
# framer-motion
```

### Environment Variables

Create `.env.local`:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-...

# Database Connection
DATABASE_URL=postgresql://user:password@host:5432/database

# Or individual credentials
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=datagum

# Optional: Rate Limiting
RATE_LIMIT_MAX=3
RATE_LIMIT_WINDOW_HOURS=24

# Optional: Job Processing
ENABLE_JOB_PROCESSOR=true
JOB_POLL_INTERVAL_MS=5000
```

---

## 🚀 Deployment Considerations

### Cloudflare Workers (via @opennextjs/cloudflare)

**Challenges**:
1. No long-running processes (job processor won't work)
2. 30-second execution timeout

**Solutions**:
- Use Cloudflare Queues for background jobs
- Use Cloudflare D1 for database (or external Postgres)
- Use Cloudflare Cron Triggers to process jobs

**Alternative**: Use Vercel + Vercel Postgres + Vercel Cron

### Vercel Deployment

**Recommended Setup**:
1. Database: Vercel Postgres or external PostgreSQL
2. Background Jobs: Vercel Cron (trigger `/api/cron/process-jobs` every minute)
3. Environment: Set all env vars in Vercel dashboard

---

## 📊 Cost Estimates

### Per Article Analysis
- Scraping: Free (HTTP requests)
- Question Generation (GPT-4 Turbo): ~$0.01-0.03
- 10 Search Tests (GPT-5 + search): ~$0.20-0.50
- **Total**: ~$0.25-0.55 per article

### Monthly Estimates
- 100 articles/day = $25-55/day = $750-1,650/month
- 1,000 articles/day = $250-550/day = $7,500-16,500/month

### Ways to Reduce Costs
1. Cache question generation results (reuse for similar content)
2. Reduce number of questions (5 instead of 10)
3. Use GPT-4-mini for question generation
4. Implement smart throttling

---

## 🎯 Success Metrics to Track

### User Engagement
- Submissions per day
- Completion rate (submitted → viewed results)
- Time on results page
- Repeat usage rate

### Lead Generation
- Click-through rate on CTAs
- Contact form submissions
- Revenue attribution

### Performance
- Average processing time
- Job success/failure rates
- API error rates
- Database query performance

### Cost
- OpenAI API spend per article
- Total monthly API costs
- Cost per lead generated

---

## 🔒 Security Considerations

### Rate Limiting
- Implement IP-based rate limiting (3 per 24 hours)
- Consider honeypot field to catch bots
- Add reCAPTCHA if spam becomes an issue

### Input Validation
- Validate URL format strictly
- Block localhost/private IPs
- Set max URL length (2000 chars)
- Sanitize all user inputs

### API Security
- Never expose OpenAI API keys client-side
- Use environment variables for all secrets
- Implement request timeout limits
- Add request size limits

### Database Security
- Use parameterized queries (ORM handles this)
- Limit stored content length
- Regular backups
- Monitor for SQL injection attempts

---

## 🧪 Testing Strategy

### Unit Tests
- Article scraper with various HTML structures
- Question generator output validation
- URL matching logic (cleanUrl, checkUrlMatch)

### Integration Tests
- Full flow: submit → process → results
- Database operations
- API endpoints

### Manual Testing Checklist
- [ ] Submit valid article URL
- [ ] Submit invalid URL (should error)
- [ ] Hit rate limit (submit 4 times quickly)
- [ ] Poll results while processing
- [ ] View completed results
- [ ] Check all competitor analysis
- [ ] Verify coverage gaps display
- [ ] Test mobile responsive design
- [ ] Test with paywalled content (should fail gracefully)

---

## 📝 Additional Features to Consider

### Phase 2 Enhancements
1. **Email Results**: Capture email and send results when complete
2. **Historical Tracking**: Track same URL over time
3. **Bulk Analysis**: Upload CSV of URLs
4. **Custom Questions**: Let users provide their own questions to test
5. **PDF Export**: Download results as PDF report
6. **White Label**: Customize branding/CTAs per client
7. **API Access**: Offer programmatic access for publishers
8. **Slack/Discord Integration**: Post results to team channels

---

## 🎨 Brand Customization Points

Replace these placeholders with your brand:

1. **Company Name**: Throughout CTAs and copy
2. **Contact URL**: Update CTA links
3. **Brand Colors**: Adjust Tailwind gradient colors
4. **Logo**: Add logo to header/footer
5. **Domain**: Update all references to your domain
6. **Social Proof**: Add testimonials, case studies
7. **Pricing Page**: Link to pricing if offering paid tiers

---

## 📚 Additional Resources

### OpenAI Documentation
- Responses API: https://platform.openai.com/docs/api-reference/responses
- Web Search Tool: https://platform.openai.com/docs/guides/function-calling
- Pricing: https://openai.com/pricing

### Next.js Documentation
- App Router: https://nextjs.org/docs/app
- API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

### Database Options
- Drizzle ORM: https://orm.drizzle.team/
- Prisma: https://www.prisma.io/
- Vercel Postgres: https://vercel.com/docs/storage/vercel-postgres

---

## 🎯 Summary: What You're Building

A **lead generation tool** that:
1. Takes any article URL
2. Analyzes it through AI search engines
3. Shows users they're losing to competitors
4. Drives them to contact you for better distribution

**Tech Stack**: Next.js 15 + PostgreSQL + OpenAI API

**Cost**: ~$0.30 per article tested

**Time to Build**: 2-3 days for MVP with basic UI

**Key Differentiator**: Shows the invisible problem (AI search invisibility) that publishers don't know they have.

---

## 🚦 Getting Started Checklist

- [ ] Set up Next.js project
- [ ] Install dependencies (openai, cheerio, database ORM)
- [ ] Set up PostgreSQL database
- [ ] Run migrations to create tables
- [ ] Add environment variables (.env.local)
- [ ] Implement ArticleScraperService
- [ ] Implement QuestionGeneratorService
- [ ] Implement OpenAISearchTesterService
- [ ] Create database repositories/queries
- [ ] Implement job processor
- [ ] Build POST /api/analyze/submit endpoint
- [ ] Build GET /api/analyze/results/[id] endpoint
- [ ] Create landing page (/analyze)
- [ ] Create results page (/analyze/results/[id])
- [ ] Test full flow end-to-end
- [ ] Add rate limiting
- [ ] Deploy to production
- [ ] Monitor costs and usage

---

**This document contains everything needed to rebuild the Article Analyzer feature from scratch in your Next.js repository. Copy relevant sections into your project as needed!**
