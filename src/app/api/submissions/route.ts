/**
 * Recent Submissions API Route
 *
 * Returns list of recent submissions for the home page table
 */

import { NextResponse } from 'next/server'
import { getRecentSubmissions } from '@/repositories/submission.repository'

export async function GET() {
  try {
    const submissions = await getRecentSubmissions(10)
    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Error fetching recent submissions:', error)
    return NextResponse.json(
      { message: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
