import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

/**
 * Drizzle Kit Configuration
 *
 * This configuration is used for:
 * - Generating migrations: pnpm db:generate
 * - Pushing schema changes: pnpm db:push
 * - Opening Drizzle Studio: pnpm db:studio
 *
 * DATABASE_URL is automatically loaded from .dev.vars (local)
 * or from environment variables (CI/CD, production)
 */

// Load environment variables from .dev.vars
config({ path: '.dev.vars' })

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create .dev.vars and add DATABASE_URL or set it as an environment variable.'
  )
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
