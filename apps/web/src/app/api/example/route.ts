import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

/**
 * Example API Route demonstrating Cloudflare environment variable access
 *
 * All environment variables are accessed via getCloudflareContext()
 * Local: defined in .dev.vars
 * Production: set via `pnpm wrangler secret put <KEY_NAME>`
 */
export async function GET() {
  try {
    // Access Cloudflare environment
    const { env } = await getCloudflareContext()

    // Access environment variables from .dev.vars (local) or Cloudflare secrets (production)
    // const apiKey = env.API_KEY
    // const dbUrl = env.DATABASE_URL

    // Access Cloudflare bindings (KV, R2, D1, etc.)
    const hasAssets = !!env.ASSETS

    // Public variables (NEXT_PUBLIC_*) are also available via process.env
    const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'not set'

    return NextResponse.json({
      message: 'Environment variables example',
      cloudflare: {
        // Uncomment to show your env vars (don't expose secrets!)
        // apiKey: env.API_KEY ? 'configured' : 'not set',
        hasAssets,
      },
      public: {
        apiUrl: publicApiUrl,
      },
    })
  } catch (error) {
    console.error('Failed to access environment:', error)
    return NextResponse.json(
      { error: 'Failed to access environment' },
      { status: 500 }
    )
  }
}
