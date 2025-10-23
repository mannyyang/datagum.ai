/**
 * Status Tracker - Manages submission status transitions
 *
 * Epic: Epic 6 - Background Job Processing
 * Story: US-6.2 - Job Execution Flow
 *
 * Validates and tracks status changes through the workflow.
 */

export type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface StatusTransition {
  from: SubmissionStatus
  to: SubmissionStatus
  timestamp: Date
}

/**
 * Valid status transitions map
 */
const VALID_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  pending: ['processing'],
  processing: ['completed', 'failed'],
  completed: [], // Terminal state
  failed: ['processing'], // Can retry failed jobs
}

export class StatusTracker {
  /**
   * Validate if a status transition is allowed
   */
  static validateTransition(currentStatus: SubmissionStatus, newStatus: SubmissionStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus]
    return allowedTransitions.includes(newStatus)
  }

  /**
   * Log status change (can be extended to store in database)
   */
  static logStatusChange(
    submissionId: string,
    from: SubmissionStatus,
    to: SubmissionStatus
  ): void {
    const transition: StatusTransition = {
      from,
      to,
      timestamp: new Date(),
    }

    console.log(
      `[StatusTracker] Submission ${submissionId}: ${from} → ${to} at ${transition.timestamp.toISOString()}`
    )

    // TODO: Store in database for audit trail
    // await db.insert(statusHistory).values({
    //   submissionId,
    //   fromStatus: from,
    //   toStatus: to,
    //   timestamp: transition.timestamp,
    // })
  }

  /**
   * Update status with validation
   */
  static async updateStatus(
    submissionId: string,
    currentStatus: SubmissionStatus,
    newStatus: SubmissionStatus
  ): Promise<void> {
    // Validate transition
    if (!this.validateTransition(currentStatus, newStatus)) {
      throw new Error(
        `Invalid status transition for submission ${submissionId}: ${currentStatus} → ${newStatus}`
      )
    }

    // Log the change
    this.logStatusChange(submissionId, currentStatus, newStatus)

    // TODO: Update in database
    // const db = await getDb(env)
    // await db.update(submissions)
    //   .set({ status: newStatus, updatedAt: new Date() })
    //   .where(eq(submissions.id, submissionId))
  }

  /**
   * Check if a status is terminal (no further transitions allowed)
   */
  static isTerminal(status: SubmissionStatus): boolean {
    return VALID_TRANSITIONS[status].length === 0 && status !== 'failed'
  }

  /**
   * Get all allowed transitions for a status
   */
  static getAllowedTransitions(status: SubmissionStatus): SubmissionStatus[] {
    return VALID_TRANSITIONS[status]
  }
}
