import { drizzle } from 'drizzle-orm/neon-http'
import { neon, neonConfig, Pool } from '@neondatabase/serverless'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import * as schema from '@/db/schema'

/**
 * Get database connection for Cloudflare Workers
 *
 * This function creates a Drizzle client configured for Neon's HTTP driver,
 * which is optimized for serverless/edge environments like Cloudflare Workers.
 *
 * Usage in API routes:
 * ```typescript
 * const db = await getDb()
 * const results = await db.select().from(schema.users)
 * ```
 */
export async function getDb() {
  // Get DATABASE_URL from Cloudflare environment
  const { env } = await getCloudflareContext()
  const databaseUrl = env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Add it to .dev.vars (local) or use `pnpm wrangler secret put DATABASE_URL` (production)'
    )
  }

  // Configure Neon for edge runtime (Cloudflare Workers)
  // poolQueryViaFetch uses HTTP for queries instead of WebSockets
  // This is faster for single, non-interactive transactions
  neonConfig.poolQueryViaFetch = true

  // Create Neon SQL client
  const sql = neon(databaseUrl)

  // Return Drizzle ORM client with schema
  return drizzle({ client: sql, schema })
}

/**
 * Alternative: Get database connection with connection pooling
 *
 * Use this if you need session or interactive transaction support.
 * Note: Requires WebSockets, which may have different performance
 * characteristics in edge environments.
 */
export async function getDbWithPool() {
  const { env } = await getCloudflareContext()
  const databaseUrl = env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  return drizzle({ client: pool, schema })
}
