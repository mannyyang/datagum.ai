/**
 * Job Monitor - Tracks job performance metrics and errors
 *
 * Epic: Epic 6 - Background Job Processing
 * Story: US-6.4 - Job Monitoring
 *
 * Provides logging and metrics tracking for job processing.
 */

export type JobPhase = 'scraping' | 'question-generation' | 'search-testing'

export interface JobMetrics {
  submissionId: string
  startTime: number
  endTime?: number
  duration?: number
  phase?: JobPhase
  phaseDuration?: number
  success: boolean
  error?: string
  retryCount?: number
}

export class JobMonitor {
  /**
   * Log job start
   */
  static logJobStart(submissionId: string, url: string): void {
    console.log(`[JobMonitor] ✓ Job started for submission ${submissionId}`)
    console.log(`[JobMonitor]   URL: ${url}`)
    console.log(`[JobMonitor]   Started at: ${new Date().toISOString()}`)
  }

  /**
   * Log job completion
   */
  static logJobComplete(submissionId: string, duration: number): void {
    const durationSeconds = (duration / 1000).toFixed(2)
    console.log(`[JobMonitor] ✓ Job completed for submission ${submissionId}`)
    console.log(`[JobMonitor]   Duration: ${durationSeconds}s`)
    console.log(`[JobMonitor]   Completed at: ${new Date().toISOString()}`)

    // TODO: Send to Cloudflare Analytics
    // ctx.waitUntil(
    //   analytics.writeDataPoint({
    //     blobs: [submissionId],
    //     doubles: [duration],
    //     indexes: ['job_completed'],
    //   })
    // )
  }

  /**
   * Log job failure
   */
  static logJobFailed(submissionId: string, error: unknown, retryCount: number = 0): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`[JobMonitor] ✗ Job failed for submission ${submissionId}`)
    console.error(`[JobMonitor]   Error: ${errorMessage}`)
    console.error(`[JobMonitor]   Retry count: ${retryCount}`)
    console.error(`[JobMonitor]   Failed at: ${new Date().toISOString()}`)

    if (errorStack) {
      console.error(`[JobMonitor]   Stack trace:\n${errorStack}`)
    }

    // TODO: Send to error tracking service
    // TODO: Alert on high failure rate
  }

  /**
   * Track processing time for a specific phase
   */
  static trackProcessingTime(
    submissionId: string,
    phase: JobPhase,
    duration: number
  ): void {
    const durationSeconds = (duration / 1000).toFixed(2)
    console.log(`[JobMonitor] Phase "${phase}" completed in ${durationSeconds}s`)

    // TODO: Send to analytics
    // Track average processing time per phase
    // Identify slow phases for optimization
  }

  /**
   * Track error rate by type
   */
  static trackErrorRate(errorType: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`[JobMonitor] Error tracked: ${errorType}`)
    console.warn(`[JobMonitor]   Message: ${errorMessage}`)

    // TODO: Categorize errors
    // - Network errors (timeout, connection refused)
    // - API errors (rate limits, invalid responses)
    // - Parsing errors (malformed HTML, missing data)
    // - Database errors (connection, query failures)
  }

  /**
   * Alert on high failure rate
   */
  static async alertOnHighFailureRate(
    failureCount: number,
    totalCount: number,
    threshold: number = 0.1
  ): Promise<void> {
    const failureRate = failureCount / totalCount

    if (failureRate > threshold) {
      console.error(`[JobMonitor] ⚠️  HIGH FAILURE RATE DETECTED`)
      console.error(`[JobMonitor]   Failure rate: ${(failureRate * 100).toFixed(2)}%`)
      console.error(`[JobMonitor]   Failed: ${failureCount} / ${totalCount}`)
      console.error(`[JobMonitor]   Threshold: ${(threshold * 100).toFixed(2)}%`)

      // TODO: Send alert to monitoring service
      // - Email notification
      // - Slack webhook
      // - PagerDuty alert
    }
  }

  /**
   * Log retry attempt
   */
  static logRetry(submissionId: string, error: unknown, retryCount: number): void {
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.warn(`[JobMonitor] Retrying job for submission ${submissionId}`)
    console.warn(`[JobMonitor]   Retry attempt: ${retryCount}`)
    console.warn(`[JobMonitor]   Previous error: ${errorMessage}`)
    console.warn(`[JobMonitor]   Retrying at: ${new Date().toISOString()}`)
  }

  /**
   * Get job metrics summary
   */
  static getMetricsSummary(metrics: JobMetrics): string {
    const duration = metrics.duration ? `${(metrics.duration / 1000).toFixed(2)}s` : 'N/A'
    const status = metrics.success ? '✓ SUCCESS' : '✗ FAILED'

    return [
      `[JobMonitor] Metrics Summary for ${metrics.submissionId}:`,
      `  Status: ${status}`,
      `  Duration: ${duration}`,
      metrics.phase && `  Last Phase: ${metrics.phase}`,
      metrics.error && `  Error: ${metrics.error}`,
      metrics.retryCount && `  Retries: ${metrics.retryCount}`,
    ]
      .filter(Boolean)
      .join('\n')
  }
}
