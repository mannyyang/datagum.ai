/**
 * Queue API Route
 *
 * Example API route for sending messages to Cloudflare Queues
 * Demonstrates different message types and usage patterns
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  EmailMessage,
  ArticleScrapingMessage,
  QuestionGenerationMessage,
  WebhookMessage,
  BatchProcessingMessage,
  generateUUID,
} from '@/lib/shared'

/**
 * Send a message to the queue
 */
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const body = await request.json() as { type?: string; [key: string]: unknown }

    // Validate request
    if (!body.type) {
      return Response.json(
        { error: 'Message type is required' },
        { status: 400 }
      )
    }

    // Create message based on type
    let message:
      | EmailMessage
      | ArticleScrapingMessage
      | QuestionGenerationMessage
      | WebhookMessage
      | BatchProcessingMessage

    switch (body.type) {
      case 'email':
        message = {
          type: 'email',
          payload: {
            to: body.to,
            from: body.from,
            subject: body.subject,
            body: body.body,
            html: body.html,
          },
          timestamp: Date.now(),
          retryCount: 0,
        } as EmailMessage
        break

      case 'scrape-article':
        message = {
          type: 'scrape-article',
          payload: {
            url: body.url,
            jobId: generateUUID(),
            userId: body.userId,
          },
          timestamp: Date.now(),
          retryCount: 0,
        } as ArticleScrapingMessage
        break

      case 'generate-questions':
        message = {
          type: 'generate-questions',
          payload: {
            articleId: body.articleId,
            content: body.content,
            jobId: generateUUID(),
          },
          timestamp: Date.now(),
          retryCount: 0,
        } as QuestionGenerationMessage
        break

      case 'webhook':
        message = {
          type: 'webhook',
          payload: {
            url: body.url,
            method: body.method || 'POST',
            headers: body.headers,
            body: body.webhookBody,
          },
          timestamp: Date.now(),
          retryCount: 0,
        } as WebhookMessage
        break

      case 'batch-process':
        message = {
          type: 'batch-process',
          payload: {
            batchId: generateUUID(),
            items: body.items,
            operation: body.operation,
          },
          timestamp: Date.now(),
          retryCount: 0,
        } as BatchProcessingMessage
        break

      default:
        return Response.json(
          { error: `Unknown message type: ${body.type}` },
          { status: 400 }
        )
    }

    // Send to queue
    await env.ARTICLE_ANALYSIS_QUEUE.send(message)

    return Response.json({
      success: true,
      message: 'Job queued successfully',
      jobId: 'jobId' in message.payload ? message.payload.jobId : undefined,
    })
  } catch (error) {
    console.error('Error queuing job:', error)
    return Response.json(
      {
        error: 'Failed to queue job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Send multiple messages at once (batch)
 */
export async function PUT(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const body = await request.json() as { messages?: unknown[] }

    if (!Array.isArray(body.messages)) {
      return Response.json(
        { error: 'messages array is required' },
        { status: 400 }
      )
    }

    // Send batch
    await env.ARTICLE_ANALYSIS_QUEUE.sendBatch(body.messages as MessageSendRequest<unknown>[])

    return Response.json({
      success: true,
      message: `${body.messages.length} jobs queued successfully`,
    })
  } catch (error) {
    console.error('Error queuing batch:', error)
    return Response.json(
      {
        error: 'Failed to queue batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
