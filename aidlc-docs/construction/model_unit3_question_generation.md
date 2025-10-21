# Domain Model: Unit 3 - AI Question Generation

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Epic**: Epic 3 - AI Question Generation
**User Stories**: US-3.1, US-3.2, US-3.3
**Status**: In-Progress

---

## Executive Summary

This domain model defines the components required to generate natural search queries from article content using OpenAI's GPT-4. The system analyzes article title, headings, and content to create 10 diverse questions that users might ask in AI search engines where the article would be a relevant answer.

### Key Business Requirements
- Generate 10 natural, user-like search questions
- Questions must be diverse (different angles/topics from article)
- Questions range from broad to specific
- Use GPT-4 Turbo for generation
- Validate question quality
- Store generated questions with submission
- Generate content summary for user confirmation

### Related User Stories
- **US-3.1**: Generate Search Questions
- **US-3.2**: Question Quality Validation
- **US-3.3**: Content Summary Generation

---

## Component Overview

### 1. QuestionGeneratorService
**Type**: Service
**Responsibility**: Orchestrates AI-powered question generation from article content

**Attributes**:
- `openAIClient`: OpenAI API client instance
- `model`: string - 'gpt-4-turbo'
- `defaultMaxQuestions`: number - 10
- `temperature`: number - 0.7 (creativity level)
- `maxTokens`: number - 1500 (response length limit)

**Behaviors**:
- `generateQuestions(article, maxQuestions)`: GeneratedQuestionsResult - Main entry point
- `prepareArticleContext(article)`: PreparedContext - Formats article for prompt
- `buildPrompt(context, maxQuestions)`: string - Constructs GPT prompt
- `callOpenAI(prompt)`: OpenAIResponse - Makes API call
- `parseResponse(response)`: GeneratedQuestions - Extracts questions from JSON
- `validateQuestions(questions)`: string[] - Filters invalid questions

**Input Type - Article**:
- `title`: string - Article title
- `content`: string - Main article content
- `headings`: string[] - Article headings (h1-h6)

**Output Type - GeneratedQuestionsResult**:
- `questions`: string[] - Array of 10 questions
- `contentSummary`: string | null - 1-2 sentence summary
- `error`: string | null - Error message if generation failed

**Interactions**:
- Uses `PromptBuilder` to construct AI prompt
- Uses `OpenAIClient` to make API calls
- Uses `QuestionValidator` to validate generated questions
- Called by background job processor (Unit 6)
- Results stored via `SubmissionRepository`

---

### 2. PromptBuilder
**Type**: Utility Component
**Responsibility**: Constructs effective prompts for question generation

**Attributes**:
- `systemPrompt`: string - Base system instructions
- `maxContentChars`: number - Maximum article content to send (12000)
- `maxHeadings`: number - Maximum headings to include (10)

**Behaviors**:
- `buildQuestionPrompt(article, maxQuestions)`: string - Creates full prompt
- `truncateContent(content)`: string - Limits content length
- `formatHeadings(headings)`: string - Formats as bulleted list
- `buildSystemMessage()`: string - Returns system role instructions
- `buildUserMessage(context)`: string - Returns user request

**Prompt Structure**:

**System Message**:
```
You are an expert at analyzing content and generating natural search queries
that users might type into AI search engines like ChatGPT, Perplexity, or Google.
Always respond with valid JSON only.
```

**User Message Template**:
```
Analyze this article and generate {maxQuestions} diverse, natural search queries
that a user might ask where this article would be a highly relevant answer.

Article Title: {title}

Main Headings:
- {heading1}
- {heading2}
...

Article Content Preview:
{contentPreview}

Generate {maxQuestions} search queries that:
1. Are natural questions users would actually ask (not keyword stuffing)
2. Cover different topics/angles from the article
3. Range from broad to specific
4. Would make this article a valuable source to cite
5. Are phrased as questions or natural search queries

Return ONLY a JSON object in this format:
{
  "questions": ["question 1", "question 2", ...],
  "contentSummary": "brief 1-2 sentence summary of what the article is about"
}
```

**Content Preparation Logic**:
- Truncate article content to first 12,000 characters (~3000 words)
- Include up to 10 headings
- Preserve article title in full
- Format headings as bulleted list

**Interactions**:
- Called by `QuestionGeneratorService.buildPrompt()`
- Returns formatted prompt string

---

### 3. OpenAIClient
**Type**: API Integration Service
**Responsibility**: Manages OpenAI API communication

**Attributes**:
- `apiKey`: string - OpenAI API key from environment
- `baseURL`: string - OpenAI API base URL
- `client`: OpenAI SDK instance

**Behaviors**:
- `initialize()`: void - Creates OpenAI client with API key
- `createChatCompletion(config)`: APIResponse - Calls chat completions endpoint
- `handleAPIError(error)`: never - Throws formatted error
- `validateAPIKey()`: boolean - Checks if API key is set

**API Configuration**:
- **Model**: `gpt-4-turbo`
- **Temperature**: 0.7 (balance creativity and consistency)
- **Max Tokens**: 1500 (enough for 10 questions + summary)
- **Response Format**: `{ type: 'json_object' }` (ensures JSON output)

**Messages Array**:
```typescript
[
  {
    role: 'system',
    content: systemPrompt
  },
  {
    role: 'user',
    content: userPrompt
  }
]
```

**Error Scenarios**:
- **API Key Missing**: Throw configuration error
- **Rate Limit**: Throw rate limit error (retry in job processor)
- **Invalid Response**: Throw parsing error
- **Network Error**: Throw connection error

**Interactions**:
- Called by `QuestionGeneratorService.callOpenAI()`
- Uses OpenAI SDK (npm package `openai`)
- Returns raw API response

---

### 4. ResponseParser
**Type**: Utility Component
**Responsibility**: Parses and validates OpenAI API responses

**Attributes**:
- `expectedKeys`: string[] - ['questions', 'contentSummary']

**Behaviors**:
- `parseJSON(responseContent)`: Object - Parses JSON string
- `validateStructure(parsed)`: void - Checks required fields
- `extractQuestions(parsed)`: string[] - Gets questions array
- `extractSummary(parsed)`: string | null - Gets content summary

**Parsing Logic**:
- Extract `choices[0].message.content` from API response
- Parse as JSON
- Validate presence of `questions` array
- Validate `contentSummary` (optional field)
- Throw error if structure invalid

**Validation Checks**:
- Response must contain `questions` field
- `questions` must be an array
- Array must contain at least 1 element
- Each question must be a string
- `contentSummary` should be a string if present

**Interactions**:
- Called by `QuestionGeneratorService.parseResponse()`
- Throws `ParsingError` on invalid structure

---

### 5. QuestionValidator
**Type**: Utility Component
**Responsibility**: Validates and filters generated questions

**Attributes**:
- `minQuestionLength`: number - Minimum chars per question (10)
- `maxQuestionLength`: number - Maximum chars per question (500)
- `minQuestions`: number - Minimum questions required (1)

**Behaviors**:
- `validateAll(questions, requiredCount)`: string[] - Validates full set
- `isValidQuestion(question)`: boolean - Checks single question
- `filterDuplicates(questions)`: string[] - Removes duplicates
- `cleanQuestion(question)`: string - Trims whitespace

**Validation Rules**:
- Question must be a non-empty string
- Question must be >= 10 characters
- Question must be <= 500 characters
- No duplicate questions (case-insensitive comparison)
- Must have at least 1 valid question

**Filtering Logic**:
1. Filter out null/undefined values
2. Convert all to strings
3. Trim whitespace
4. Filter by length constraints
5. Remove duplicates (case-insensitive)
6. Take first N questions if > maxQuestions

**Error Handling**:
- If no valid questions after filtering, throw error
- If < requested number, return available valid questions
- Log warning if duplicates found

**Interactions**:
- Called by `QuestionGeneratorService.validateQuestions()`
- Returns filtered array of valid questions

---

## Component Interactions

### Question Generation Flow Sequence

1. **Job Processor Calls Generator**:
   - Background job processor (Unit 6) calls `QuestionGeneratorService.generateQuestions(article, 10)`
   - Article object contains title, content, headings from Unit 2

2. **Prepare Context**:
   - `QuestionGeneratorService` calls `prepareArticleContext(article)`
   - Truncate content to 12,000 chars
   - Limit headings to 10

3. **Build Prompt**:
   - Call `PromptBuilder.buildQuestionPrompt(context, 10)`
   - `PromptBuilder` constructs system and user messages
   - Returns complete prompt structure

4. **Initialize OpenAI Client**:
   - `OpenAIClient.initialize()` checks for API key
   - Creates OpenAI SDK client instance

5. **Call OpenAI API**:
   - `OpenAIClient.createChatCompletion(promptConfig)`
   - Sends request to GPT-4 Turbo
   - Waits for response (typically 3-10 seconds)

6. **Parse Response**:
   - `ResponseParser.parseJSON(response.choices[0].message.content)`
   - Validates JSON structure
   - Extracts `questions` array and `contentSummary`

7. **Validate Questions**:
   - `QuestionValidator.validateAll(questions, 10)`
   - Filters invalid/duplicate questions
   - Returns cleaned array

8. **Return Result**:
   - `QuestionGeneratorService` constructs `GeneratedQuestionsResult`
   - Returns questions and summary to job processor

9. **Store in Database**:
   - Job processor calls `SubmissionRepository.updateSubmission()`
   - Stores `generatedQuestions` as JSON array

### Error Handling Flow

**API Key Missing**:
- `OpenAIClient.initialize()` throws error
- Job processor catches and marks submission as failed
- Error message: "OpenAI API configuration error"

**API Rate Limit**:
- OpenAI API returns 429 status
- `OpenAIClient.handleAPIError()` throws `RateLimitError`
- Job processor retries with exponential backoff
- After 3 retries, mark submission as failed

**Invalid JSON Response**:
- `ResponseParser.parseJSON()` fails
- Throw `ParsingError` with details
- Job processor marks submission as failed
- Error message: "Failed to generate questions"

**No Valid Questions**:
- `QuestionValidator.validateAll()` returns empty array
- Throw `ValidationError`
- Job processor marks submission as failed
- Error message: "No valid questions generated"

**Network Error**:
- OpenAI API call times out or fails
- `OpenAIClient` throws `NetworkError`
- Job processor retries up to 3 times
- Error message: "Failed to connect to AI service"

---

## Data Flow

### Input Data
- **Source**: Scraped article from Unit 2
- **Format**: ScrapedArticle object
- **Required Fields**:
  - `title`: string
  - `content`: string (minimum 100 chars)
  - `headings`: string[]

### Processing Data
- **Article Context**:
  - Title (full)
  - Content (first 12,000 chars)
  - Headings (first 10)
- **Prompt**: ~500-1000 tokens
- **API Response**: ~300-800 tokens
- **Cost**: ~$0.01-0.03 per article

### Output Data
- **Destination**: Submission record `generatedQuestions` field
- **Format**: JSON array of strings
- **Example**:
```json
{
  "generatedQuestions": [
    "How do AI search engines rank content?",
    "What factors affect article visibility in ChatGPT?",
    ...
  ],
  "contentSummary": "This article explains how AI search engines..."
}
```

---

## Environment Considerations

### Cloudflare Workers
- OpenAI SDK must be compatible with Workers runtime
- Network calls subject to Workers timeout limits
- CPU time limits apply (typically sufficient for API call)

### Environment Variables
- **OPENAI_API_KEY**: Required, stored in `.dev.vars` locally
- **Production**: Set via `pnpm wrangler secret put OPENAI_API_KEY`

### Performance Targets
- API call time: 3-10 seconds (GPT-4 Turbo)
- Total processing time: < 15 seconds
- Timeout: 30 seconds (Cloudflare Workers limit)

### Cost Management
- GPT-4 Turbo pricing: ~$0.01-0.03 per request
- Input tokens: ~800-1200 per article
- Output tokens: ~300-800 per response
- Monthly estimate: 1000 articles = $10-30

---

## Dependencies

### External Services
- **OpenAI API**: GPT-4 Turbo model
- **Internet Connection**: Required for API calls

### External Libraries
- **openai** (npm package): Official OpenAI Node.js SDK

### Internal Dependencies
- **Unit 2**: Requires scraped article content
- **Unit 6**: Called by background job processor

### Next Unit
- **Unit 4**: AI Search Testing (uses generated questions)

---

## Security Considerations

### API Key Management
- Never expose API key client-side
- Store in environment variables only
- Use Cloudflare secrets in production
- Rotate keys periodically

### Content Security
- Article content sent to OpenAI (third-party)
- No personally identifiable information in articles
- OpenAI may use data for training (per API terms)
- Consider privacy implications for sensitive content

### Rate Limiting
- OpenAI enforces rate limits (requests per minute)
- Handle 429 errors gracefully
- Implement exponential backoff for retries
- Monitor usage to avoid unexpected costs

---

## Cost Optimization Strategies

### Current Approach
- Generate 10 questions per article
- Use GPT-4 Turbo (balanced cost/quality)
- Send up to 12,000 chars of content

### Future Optimizations
1. **Reduce Questions**: Generate 5 instead of 10 (-50% cost)
2. **Use GPT-4-mini**: Lower cost model (-60% cost, slightly lower quality)
3. **Content Caching**: Reuse questions for similar content
4. **Smart Truncation**: Extract only most relevant paragraphs (<12k chars)

---

## Testing Considerations

### Unit Tests
- **PromptBuilder**: Verify prompt structure and content truncation
- **ResponseParser**: Test JSON parsing with various response formats
- **QuestionValidator**: Test filtering and duplicate detection
- **Mock OpenAI**: Test without real API calls

### Integration Tests
- Test with real OpenAI API (development key)
- Verify questions match article content
- Test error handling (invalid responses)
- Measure API response times

### Quality Metrics
- **Relevance**: Questions should relate to article topic
- **Diversity**: Questions should cover different aspects
- **Naturalness**: Questions should sound like real user queries
- **Specificity**: Mix of broad and specific questions

### Sample Test Articles
- Technical blog post
- News article
- Product review
- How-to guide
- Opinion piece

---

## Changelog

### Version 1.0.0 (2025-10-20)
- Initial domain model creation
- Defined 5 core components for AI question generation
- Documented OpenAI API integration approach
- Specified GPT-4 Turbo as model choice
- Mapped to user stories US-3.1, US-3.2, US-3.3
- Included cost estimates and optimization strategies
- Defined validation rules and error handling
