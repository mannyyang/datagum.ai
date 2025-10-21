/**
 * Article Analyzer - Queue Utility
 *
 * Epic: Epic 6 - Background Job Processing
 * Stories: US-6.1
 *
 * Utility functions for enqueueing article analysis jobs to Cloudflare Queue.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { ArticleAnalysisJobMessage } from '@/types/job-processing'

/**
 * Enqueue an article analysis job
 * Sends a message to Cloudflare Queue for background processing
 */
export async function enqueueArticleAnalysisJob(
  submissionId: string,
  url: string
): Promise<void> {
  try {
    const { env } = await getCloudflareContext()

    // Check if queue is configured
    if (!env.ARTICLE_ANALYSIS_QUEUE) {
      console.warn(
        'Cloudflare Queue not configured. Job will not be processed in background.'
      )
      // In development, you might want to process synchronously
      // Or return and handle this differently
      return
    }

    const message: ArticleAnalysisJobMessage = {
      submissionId,
      url,
      createdAt: new Date().toISOString(),
    }

    // Send message to queue
    await env.ARTICLE_ANALYSIS_QUEUE.send(message)

    console.log(
      `Enqueued article analysis job for submission: ${submissionId}`
    )
  } catch (error) {
    console.error('Failed to enqueue article analysis job:', error)
    throw new Error(
      `Failed to enqueue job: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
