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
import { Search, TrendingUp, Target } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Test Your Content in AI Search
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
          See how AI search engines like ChatGPT and Perplexity cite your
          articles. Get insights on citation rankings and discover content gaps.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Free analysis • 3 articles per day • No sign-up required
        </p>
      </section>

      {/* Submit Form */}
      <SubmitForm />

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Feature 1: Citation Rankings */}
          <div className="bg-card border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Citation Rankings</h3>
            <p className="text-sm text-muted-foreground">
              See if your content appears in AI-generated responses and how
              prominently it&apos;s cited.
            </p>
          </div>

          {/* Feature 2: Competitor Analysis */}
          <div className="bg-card border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Competitor Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Discover which competing sources AI engines prefer for similar
              queries.
            </p>
          </div>

          {/* Feature 3: Coverage Opportunities */}
          <div className="bg-card border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Coverage Opportunities
            </h3>
            <p className="text-sm text-muted-foreground">
              Find questions your content doesn&apos;t answer well and identify gaps
              in your coverage.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground border-t">
        <p>
          Article Analyzer helps content creators understand their visibility in
          AI search results.
        </p>
      </footer>
    </main>
  )
}
