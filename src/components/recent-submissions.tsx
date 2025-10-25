/**
 * Recent Submissions Table
 *
 * Displays recent article analysis submissions on the home page
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Submission {
  id: string
  url: string
  status: string
  articleTitle?: string | null
  createdAt: string | Date
  completedAt?: string | Date | null
}

export function RecentSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const response = await fetch('/api/submissions')
        if (response.ok) {
          const data = (await response.json()) as { submissions: Submission[] }
          setSubmissions(data.submissions)
        }
      } catch (error) {
        console.error('Failed to fetch submissions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [])

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        )
    }
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Card className="@container/card from-primary/5 to-card bg-gradient-to-t dark:bg-card shadow-xs">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Analyses</h2>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (submissions.length === 0) {
    return (
      <Card className="@container/card from-primary/5 to-card bg-gradient-to-t dark:bg-card shadow-xs">
        <div className="p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Recent Analyses</h2>
          <p className="text-muted-foreground text-sm">
            No submissions yet. Be the first to analyze an article!
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="@container/card from-primary/5 to-card bg-gradient-to-t dark:bg-card shadow-xs overflow-hidden">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Analyses</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <Link
                      href={`/results/${submission.id}`}
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      <span className="truncate max-w-[300px]">
                        {submission.articleTitle || submission.url}
                      </span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </Link>
                  </TableCell>
                  <TableCell>{getStatusBadge(submission.status)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatDate(submission.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  )
}
