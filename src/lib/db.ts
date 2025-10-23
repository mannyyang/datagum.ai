import { drizzle } from 'drizzle-orm/neon-http'
import { neon, neonConfig } from '@neondatabase/serverless'
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
  return getDbFromEnv(env)
}

/**
 * Get database connection for Cloudflare Workers (queue workers, etc.)
 *
 * Use this variant when you already have access to the env object
 * (e.g., in queue workers) instead of needing to call getCloudflareContext().
 *
 * Usage in queue workers:
 * ```typescript
 * const db = getDbFromEnv(env)
 * const results = await db.select().from(schema.users)
 * ```
 */
export function getDbFromEnv(env: CloudflareEnv) {
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
  return drizzle(sql, { schema })
}

