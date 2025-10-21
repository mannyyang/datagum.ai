/**
 * Article Analyzer - Job Processing Types
 *
 * Epic: Epic 6 - Background Job Processing
 * Stories: US-6.1, US-6.2, US-6.3
 *
 * Types for background job processing using Cloudflare Queues.
 */

/**
 * Job message sent to Cloudflare Queue
 */
export interface ArticleAnalysisJobMessage {
  submissionId: string
  url: string
  createdAt: string
}

/**
 * Job processing result
 */
export interface JobProcessingResult {
  submissionId: string
  success: boolean
  status: 'completed' | 'failed'
  questionsGenerated: number
  testsRun: number
  citationsFound: number
  error?: string
  processingTimeMs: number
}

/**
 * Job processing error
 */
export class JobProcessingError extends Error {
  constructor(
    message: string,
    public readonly submissionId: string,
    public readonly phase: string
  ) {
    super(message)
    this.name = 'JobProcessingError'
  }
}
