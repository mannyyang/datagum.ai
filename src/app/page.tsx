/**
 * Article Analyzer - Landing Page
 *
 * Epic: Epic 1 - Article Submission & Validation
 * Stories: US-1.1
 *
 * Main landing page for the Article Analyzer tool.
 * Features hero section, submit form, and feature highlights.
 */

import { SubmitForm } from '@/components/submit-form'
import { RecentSubmissions } from '@/components/recent-submissions'
import { Search, TrendingUp, Target } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/datagum-logo.png"
              alt="Datagum Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-xl font-semibold">datagum.ai</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Test Your Content in AI Search
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
          See how ChatGPT cites your articles in AI-generated responses.
          Get insights on citation rankings and discover content gaps.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Free analysis • 3 articles per day • No sign-up required
        </p>
      </section>

      {/* Submit Form */}
      <SubmitForm />

      {/* Recent Submissions */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <RecentSubmissions />
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto *:from-primary/5 *:to-card *:bg-gradient-to-t dark:*:bg-card *:shadow-xs">
          {/* Feature 1: Citation Rankings */}
          <Card className="@container/card text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Citation Rankings</CardTitle>
              <CardDescription>
                See if your content appears in AI-generated responses and how
                prominently it&apos;s cited.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-center gap-1.5 text-sm">
              <div className="text-muted-foreground text-xs">
                Track your visibility in AI responses
              </div>
            </CardFooter>
          </Card>

          {/* Feature 2: Competitor Analysis */}
          <Card className="@container/card text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Competitor Analysis</CardTitle>
              <CardDescription>
                Discover which competing sources ChatGPT prefers for similar
                queries.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-center gap-1.5 text-sm">
              <div className="text-muted-foreground text-xs">
                Compare against other sources
              </div>
            </CardFooter>
          </Card>

          {/* Feature 3: Coverage Opportunities */}
          <Card className="@container/card text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">
                Coverage Opportunities
              </CardTitle>
              <CardDescription>
                Find questions your content doesn&apos;t answer well and identify gaps
                in your coverage.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-center gap-1.5 text-sm">
              <div className="text-muted-foreground text-xs">
                Identify content improvement areas
              </div>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground border-t">
        <p>
          Article Analyzer helps content creators understand how ChatGPT cites
          their content in AI-generated responses.
        </p>
      </footer>
    </main>
  )
}
