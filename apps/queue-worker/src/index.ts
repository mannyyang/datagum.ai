/**
 * Queue Worker - Processes background jobs from Cloudflare Queues
 *
 * This worker handles:
 * - Email sending
 * - Article scraping and processing
 * - Question generation
 * - Webhooks
 * - Batch processing
 */

import {
  QueueMessage,
  parseQueueMessage,
  isMessageType,
  retryWithBackoff,
} from '@datagum/shared'

export interface Env {
  // Cloudflare bindings
  // DB?: D1Database
  // KV?: KVNamespace

  // Secrets (set via: pnpm wrangler secret put <KEY>)
  OPENAI_API_KEY?: string
  DATABASE_URL?: string
}

export default {
  /**
   * Queue consumer handler
   * Processes batches of messages from the queue
   */
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`)

    for (const message of batch.messages) {
      try {
        // Validate and parse the message
        const parsedMessage = parseQueueMessage(message.body)

        // Process based on message type
        await processMessage(parsedMessage, env, ctx)

        // Message is automatically acknowledged on success
        console.log(`Successfully processed ${parsedMessage.type} message`)
      } catch (error) {
        console.error('Error processing message:', error)
        console.error('Message body:', message.body)

        // Retry the message (will go to DLQ after max retries)
        message.retry()
      }
    }
  },
}

/**
 * Route messages to appropriate handlers based on type
 */
async function processMessage(
  message: QueueMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  if (isMessageType(message, 'process-submission')) {
    await handleSubmissionProcessingMessage(message, env)
  } else if (isMessageType(message, 'email')) {
    await handleEmailMessage(message, env)
  } else if (isMessageType(message, 'scrape-article')) {
    await handleArticleScrapingMessage(message, env)
  } else if (isMessageType(message, 'generate-questions')) {
    await handleQuestionGenerationMessage(message, env)
  } else if (isMessageType(message, 'webhook')) {
    await handleWebhookMessage(message, env)
  } else if (isMessageType(message, 'batch-process')) {
    await handleBatchProcessingMessage(message, env)
  } else {
    throw new Error(`Unknown message type: ${(message as any).type}`)
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle submission processing messages (Main Article Analyzer Workflow)
 */
async function handleSubmissionProcessingMessage(
  message: Extract<QueueMessage, { type: 'process-submission' }>,
  env: Env
): Promise<void> {
  const { submissionId, url } = message.payload

  console.log(`Processing submission ${submissionId}: ${url}`)

  // Import JobOrchestrator
  const { JobOrchestrator } = await import('./services/job-orchestrator')

  // Create and execute the orchestrator
  const orchestrator = new JobOrchestrator({
    submissionId,
    url,
    env,
  })

  await orchestrator.execute()

  console.log(`Submission ${submissionId} processed successfully`)
}

/**
 * Handle email messages
 */
async function handleEmailMessage(
  message: Extract<QueueMessage, { type: 'email' }>,
  env: Env
): Promise<void> {
  const { to, subject, body, html } = message.payload

  console.log(`Sending email to ${to}: ${subject}`)

  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  await retryWithBackoff(async () => {
    // Example: await sendEmail({ to, subject, body, html })
    console.log('Email sent successfully')
  })
}

/**
 * Handle article scraping messages
 */
async function handleArticleScrapingMessage(
  message: Extract<QueueMessage, { type: 'scrape-article' }>,
  env: Env
): Promise<void> {
  const { url, jobId, userId } = message.payload

  console.log(`Scraping article: ${url} (Job ID: ${jobId})`)

  await retryWithBackoff(async () => {
    // Fetch the article
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }

    const html = await response.text()

    // TODO: Parse HTML and extract article content
    // TODO: Save to database
    // TODO: Trigger question generation

    console.log(`Article scraped successfully: ${url}`)
  })
}

/**
 * Handle question generation messages
 */
async function handleQuestionGenerationMessage(
  message: Extract<QueueMessage, { type: 'generate-questions' }>,
  env: Env
): Promise<void> {
  const { articleId, content, jobId } = message.payload

  console.log(`Generating questions for article ${articleId}`)

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  await retryWithBackoff(async () => {
    // TODO: Call OpenAI API to generate questions
    // TODO: Save questions to database

    console.log(`Questions generated for article ${articleId}`)
  })
}

/**
 * Handle webhook messages
 */
async function handleWebhookMessage(
  message: Extract<QueueMessage, { type: 'webhook' }>,
  env: Env
): Promise<void> {
  const { url, method, headers, body } = message.payload

  console.log(`Calling webhook: ${method} ${url}`)

  await retryWithBackoff(async () => {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`)
    }

    console.log(`Webhook completed: ${url}`)
  })
}

/**
 * Handle batch processing messages
 */
async function handleBatchProcessingMessage(
  message: Extract<QueueMessage, { type: 'batch-process' }>,
  env: Env
): Promise<void> {
  const { batchId, items, operation } = message.payload

  console.log(`Processing batch ${batchId}: ${operation} (${items.length} items)`)

  await retryWithBackoff(async () => {
    // TODO: Implement batch processing logic

    console.log(`Batch ${batchId} processed successfully`)
  })
}
