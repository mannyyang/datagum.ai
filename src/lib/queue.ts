/**
 * Article Analyzer - Queue Utility
 *
 * Epic: Epic 6 - Background Job Processing
 * Stories: US-6.1
 *
 * Utility functions for enqueueing article analysis jobs to Cloudflare Queue.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { SubmissionJobMessage } from '@/lib/shared'

/**
 * Enqueue an article analysis job
 * Sends a message to Cloudflare Queue for background processing
 */
export async function enqueueArticleAnalysisJob(
  submissionId: string,
  url: string
): Promise<void> {
  try {
    console.log(`[QUEUE] Attempting to enqueue job for submission: ${submissionId}`)

    const { env } = await getCloudflareContext()

    console.log(`[QUEUE] Got Cloudflare context, checking queue binding...`)
    console.log(`[QUEUE] ARTICLE_ANALYSIS_QUEUE exists: ${!!env.ARTICLE_ANALYSIS_QUEUE}`)

    // Check if queue is configured
    if (!env.ARTICLE_ANALYSIS_QUEUE) {
      console.warn(
        '[QUEUE] Cloudflare Queue not configured. Job will not be processed in background.'
      )
      return
    }

    const message: SubmissionJobMessage = {
      type: 'process-submission',
      payload: {
        submissionId,
        url,
      },
      timestamp: Date.now(),
      retryCount: 0,
    }

    console.log(`[QUEUE] Sending message to queue:`, JSON.stringify(message, null, 2))

    // Send message to queue
    await env.ARTICLE_ANALYSIS_QUEUE.send(message)

    console.log(
      `[QUEUE] ✅ Successfully enqueued article analysis job for submission: ${submissionId}`
    )
  } catch (error) {
    console.error('[QUEUE] ❌ Failed to enqueue article analysis job:', error)
    throw new Error(
      `Failed to enqueue job: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
