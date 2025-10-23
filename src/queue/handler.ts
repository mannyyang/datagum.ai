/**
 * Queue Consumer Handler - Processes background jobs from Cloudflare Queues
 *
 * This handler is exported from the Next.js worker and processes:
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
} from '@/lib/shared'

/**
 * Queue consumer handler
 * Processes batches of messages from the queue
 */
export async function queueHandler(
  batch: MessageBatch<QueueMessage>,
  env: CloudflareEnv,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[QUEUE] 🔔 Processing batch of ${batch.messages.length} messages`)

  for (const message of batch.messages) {
    try {
      console.log(`[QUEUE] 📨 Raw message body:`, JSON.stringify(message.body, null, 2))

      // Validate and parse the message
      const parsedMessage = parseQueueMessage(message.body)

      console.log(`[QUEUE] ✅ Message parsed successfully, type: ${parsedMessage.type}`)

      // Process based on message type
      await processMessage(parsedMessage, env, ctx)

      // Message is automatically acknowledged on success
      console.log(`[QUEUE] ✅ Successfully processed ${parsedMessage.type} message`)
    } catch (error) {
      console.error('[QUEUE] ❌ Error processing message:', error)
      console.error('[QUEUE] Message body:', message.body)

      // Retry the message (will go to DLQ after max retries)
      message.retry()
    }
  }
}

/**
 * Route messages to appropriate handlers based on type
 */
async function processMessage(
  message: QueueMessage,
  env: CloudflareEnv,
  _ctx: ExecutionContext // eslint-disable-line @typescript-eslint/no-unused-vars
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
    const unknownMessage = message as { type: string }
    throw new Error(`Unknown message type: ${unknownMessage.type}`)
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
  env: CloudflareEnv
): Promise<void> {
  const { submissionId, url } = message.payload

  console.log(`[QUEUE] 🔄 Processing submission ${submissionId}: ${url}`)

  // Import JobOrchestrator
  const { JobOrchestrator } = await import('./services/job-orchestrator')

  console.log(`[QUEUE] 🏗️  Creating JobOrchestrator...`)

  // Create and execute the orchestrator
  const orchestrator = new JobOrchestrator({
    submissionId,
    url,
    env,
  })

  await orchestrator.execute()

  console.log(`[QUEUE] ✅ Submission ${submissionId} processed successfully`)
}

/**
 * Handle email messages
 */
async function handleEmailMessage(
  message: Extract<QueueMessage, { type: 'email' }>,
  _env: CloudflareEnv // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { to, subject, body: _body, html: _html } = message.payload

  console.log(`Sending email to ${to}: ${subject}`)

  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  await retryWithBackoff(async () => {
    // Example: await sendEmail({ to, subject, body: _body, html: _html })
    console.log('Email sent successfully')
  })
}

/**
 * Handle article scraping messages
 */
async function handleArticleScrapingMessage(
  message: Extract<QueueMessage, { type: 'scrape-article' }>,
  _env: CloudflareEnv // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url, jobId, userId: _userId } = message.payload

  console.log(`Scraping article: ${url} (Job ID: ${jobId})`)

  await retryWithBackoff(async () => {
    // Fetch the article
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _html = await response.text()

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
  env: CloudflareEnv
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { articleId, content: _content, jobId: _jobId } = message.payload

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
  _env: CloudflareEnv // eslint-disable-line @typescript-eslint/no-unused-vars
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
  _env: CloudflareEnv // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<void> {
  const { batchId, items, operation } = message.payload

  console.log(`Processing batch ${batchId}: ${operation} (${items.length} items)`)

  await retryWithBackoff(async () => {
    // TODO: Implement batch processing logic

    console.log(`Batch ${batchId} processed successfully`)
  })
}
