import { z } from 'zod'

/**
 * Queue Message Types for Cloudflare Queues
 *
 * These types are shared between the producer (Next.js app) and consumer (queue worker).
 * Using Zod for runtime validation ensures type safety across the boundary.
 */

// ============================================================================
// Email Messages
// ============================================================================

export const EmailMessageSchema = z.object({
  type: z.literal('email'),
  payload: z.object({
    to: z.string().email(),
    from: z.string().email().optional(),
    subject: z.string(),
    body: z.string(),
    html: z.string().optional(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type EmailMessage = z.infer<typeof EmailMessageSchema>

// ============================================================================
// Article Scraping Messages
// ============================================================================

export const ArticleScrapingMessageSchema = z.object({
  type: z.literal('scrape-article'),
  payload: z.object({
    url: z.string().url(),
    jobId: z.string().uuid(),
    userId: z.string().optional(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type ArticleScrapingMessage = z.infer<typeof ArticleScrapingMessageSchema>

// ============================================================================
// Question Generation Messages
// ============================================================================

export const QuestionGenerationMessageSchema = z.object({
  type: z.literal('generate-questions'),
  payload: z.object({
    articleId: z.string(),
    content: z.string(),
    jobId: z.string().uuid(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type QuestionGenerationMessage = z.infer<typeof QuestionGenerationMessageSchema>

// ============================================================================
// Webhook Messages
// ============================================================================

export const WebhookMessageSchema = z.object({
  type: z.literal('webhook'),
  payload: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type WebhookMessage = z.infer<typeof WebhookMessageSchema>

// ============================================================================
// Batch Processing Messages
// ============================================================================

export const BatchProcessingMessageSchema = z.object({
  type: z.literal('batch-process'),
  payload: z.object({
    batchId: z.string().uuid(),
    items: z.array(z.any()),
    operation: z.string(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type BatchProcessingMessage = z.infer<typeof BatchProcessingMessageSchema>

// ============================================================================
// Submission Processing Messages (Main Article Analyzer Flow)
// ============================================================================

export const SubmissionJobMessageSchema = z.object({
  type: z.literal('process-submission'),
  payload: z.object({
    submissionId: z.string().uuid(),
    url: z.string().url(),
    userId: z.string().optional(),
  }),
  timestamp: z.number(),
  retryCount: z.number().default(0),
})

export type SubmissionJobMessage = z.infer<typeof SubmissionJobMessageSchema>

// ============================================================================
// Union Type and Helpers
// ============================================================================

export const QueueMessageSchema = z.discriminatedUnion('type', [
  EmailMessageSchema,
  ArticleScrapingMessageSchema,
  QuestionGenerationMessageSchema,
  WebhookMessageSchema,
  BatchProcessingMessageSchema,
  SubmissionJobMessageSchema,
])

export type QueueMessage = z.infer<typeof QueueMessageSchema>

/**
 * Type guard to check if a message is of a specific type
 */
export function isMessageType<T extends QueueMessage['type']>(
  message: QueueMessage,
  type: T
): message is Extract<QueueMessage, { type: T }> {
  return message.type === type
}

/**
 * Validate and parse a queue message
 */
export function parseQueueMessage(data: unknown): QueueMessage {
  return QueueMessageSchema.parse(data)
}

/**
 * Safe parse that returns a result object
 */
export function safeParseQueueMessage(data: unknown) {
  return QueueMessageSchema.safeParse(data)
}
