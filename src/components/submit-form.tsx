/**
 * Article Analyzer - Submit Form Component
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1
 *
 * Client component that handles article URL submission.
 * Validates input, calls submit API, and redirects to results page.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SubmitForm() {
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    // Basic URL format check
    try {
      new URL(url.trim())
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/article)')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { message?: string }
        throw new Error(data.message || 'Failed to submit')
      }

      const data = (await response.json()) as { submissionId: string }

      // Redirect to results page
      router.push(`/results/${data.submissionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your article. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 mt-12">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/your-article"
          className="flex-1 px-6 py-6 text-lg"
          disabled={isSubmitting}
        />
        <Button
          type="submit"
          disabled={isSubmitting || !url.trim()}
          className="px-8 py-6 text-lg"
        >
          {isSubmitting ? 'Analyzing...' : 'Analyze Article'}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm mt-2">{error}</p>}

      <p className="text-sm text-muted-foreground mt-4 text-center">
        Free analysis • 3 articles per day • No sign-up required
      </p>
    </form>
  )
}
