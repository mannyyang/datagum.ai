# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

- **ALWAYS use `pnpm`** for all package management tasks
- Never use npm or yarn
- Examples:
  - `pnpm install` (not npm install)
  - `pnpm add <package>` (not npm install)
  - `pnpm run build` (not npm run build)

## Monorepo Structure

This project uses **Turborepo** for managing a monorepo with multiple applications and shared packages:

```
datagum/
├── apps/
│   ├── web/                    # Next.js application (port 4444)
│   └── queue-worker/           # Cloudflare Queue consumer
├── packages/
│   └── shared/                 # Shared types, utilities, queue messages
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── package.json                # Root workspace
```

## Development Commands

### Local Development
```bash
pnpm dev                 # Runs BOTH Next.js (port 4444) + Queue Worker
```

This single command starts:
- **Web App**: Next.js dev server with Turbopack on port 4444
- **Queue Worker**: Wrangler dev server for queue consumer

### Individual App Commands
```bash
# Run only web app
pnpm --filter web dev

# Run only queue worker
pnpm --filter queue-worker dev

# Work in a specific app directory
cd apps/web && pnpm dev
cd apps/queue-worker && pnpm dev
```

### Build & Deploy
```bash
pnpm build               # Build all apps
pnpm deploy              # Deploy all apps to Cloudflare
pnpm deploy:web          # Deploy only web app
pnpm deploy:queue        # Deploy only queue worker
pnpm lint                # Lint all apps
pnpm type-check          # Type check all apps
```

### Queue Setup (One-time) ⚠️ REQUIRED

**IMPORTANT**: Queues must be created in your Cloudflare account before the system will work.

```bash
# Production queues (for deployment)
pnpm wrangler queues create datagum-queue
pnpm wrangler queues create datagum-dlq

# Development queues (for local development with --remote)
pnpm wrangler queues create datagum-queue-dev
pnpm wrangler queues create datagum-dlq-dev

# Check queue status
pnpm wrangler queues list
```

**Expected Output**:
```
┌─────────────────┬───────────┬───────────┐
│ name            │ producers │ consumers │
├─────────────────┼───────────┼───────────┤
│ datagum-queue     │ 0         │ 0         │
│ datagum-dlq       │ 0         │ 0         │
│ datagum-queue-dev │ 0         │ 0         │
│ datagum-dlq-dev   │ 0         │ 0         │
└─────────────────┴───────────┴───────────┘
```

### ✅ Local Queue Development - WORKS!

**Queues now work during local development!** We use OpenNext.js Cloudflare's `experimental_remote` bindings feature.

**Standard Development**:
```bash
pnpm dev
```

**What this does**:
- **Web app**: Runs locally with Next.js dev server (port 4444) - Full HMR, Turbopack ✨
- **Queue worker**: Runs remotely in Cloudflare (consumes `datagum-queue-dev`)
- **Queue**: Web app connects to REMOTE `datagum-queue-dev` via experimental remote bindings
- **Result**: Queue messages WORK! Jobs are processed in background ✅

**Configuration** (Already set up):
- `next.config.ts`: Enabled `remoteBindings: true` in `initOpenNextCloudflareForDev()`
- `wrangler.jsonc`: Added `experimental_remote: true` to queue producer binding
- Default queue: `datagum-queue-dev` (isolated from production)

**Benefits**:
- ✅ Full Next.js DX (HMR, Turbopack, fast refresh)
- ✅ Queue messages processed in real Cloudflare environment
- ✅ Single command - no coordination needed
- ✅ Safe - uses dev queue, isolated from production

**Production Deployment**:
```bash
pnpm deploy
```
Uses production queues: `datagum-queue` and `datagum-dlq`

**How It Works**:
- OpenNext.js Cloudflare's remote bindings feature (beta) connects local Next.js to remote Cloudflare resources
- Web app sends messages to `datagum-queue-dev` in Cloudflare (not local Miniflare)
- Queue worker consumes from the same `datagum-queue-dev` in Cloudflare
- Reference: https://developers.cloudflare.com/changelog/2025-06-18-remote-bindings-beta/

### Database Commands
```bash
pnpm db:push             # Push schema to database (web app only)
pnpm db:generate         # Generate migrations (web app only)
pnpm db:studio           # Open Drizzle Studio (web app only)
```

### Cloudflare Types
```bash
pnpm cf-typegen          # Generate Cloudflare environment types for all apps
```

**Important**: Run `pnpm cf-typegen` after adding Cloudflare bindings (queues, KV, R2, D1, etc.) to `wrangler.jsonc` in any app.

### Code Quality
- **Pre-commit hooks**: Husky + lint-staged automatically runs ESLint and Prettier on staged files
- Lint staged files: ESLint fix + Prettier write on `.{js,jsx,ts,tsx}` files
- Format staged files: Prettier write on `.{json,md}` files

## Environment Variables

This project uses **Cloudflare environment variables** exclusively. Since we deploy to Cloudflare, all environment variables are managed through Cloudflare's system.

### Local Development Setup

```bash
# Copy the example file (in apps/web)
cd apps/web
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add your environment variables
# These are available in both pnpm dev and pnpm preview
```

**Important**: `.dev.vars` is gitignored. All your local secrets go here. Each app has its own `.dev.vars` file.

### Production Deployment

For production, use Wrangler CLI to securely manage secrets:

```bash
# Set a secret (interactive prompt)
pnpm wrangler secret put API_KEY

# List all secrets
pnpm wrangler secret list

# Delete a secret
pnpm wrangler secret delete API_KEY
```

Secrets are encrypted and never exposed in `wrangler.jsonc` or version control.

### Accessing Environment Variables

All environment variables are accessed via Cloudflare context in your Next.js app:

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET() {
  const { env } = await getCloudflareContext()

  // Access environment variables
  const apiKey = env.API_KEY
  const dbUrl = env.DATABASE_URL

  // Access Cloudflare bindings (KV, R2, D1, etc.)
  const assets = env.ASSETS

  // ...
}
```

### Public Variables (Browser-Accessible)

For variables that need to be exposed to the browser, prefix them with `NEXT_PUBLIC_`:

```typescript
// In .dev.vars or production secrets
NEXT_PUBLIC_API_URL=https://api.example.com

// Access in client components
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

**Note**: Use public variables sparingly - they're visible to users in the browser.

### Why Not .env.local?

Unlike traditional Next.js, this project doesn't use `.env.local` because:
- We deploy exclusively to Cloudflare (not Vercel or Node.js)
- OpenNext integrates Cloudflare's environment system into Next.js
- `.dev.vars` provides a unified approach for local and production environments
- All Cloudflare bindings (KV, R2, D1) are accessed the same way

## Database (Neon + Drizzle ORM)

This project uses **Neon PostgreSQL** with **Drizzle ORM** for database operations. Neon is serverless Postgres optimized for edge environments like Cloudflare Workers.

### Quick Start

1. **Get your Neon connection string**:
   - Sign up at [console.neon.tech](https://console.neon.tech)
   - Create a new project
   - Copy your connection string

2. **Configure locally**:
   ```bash
   # Copy .dev.vars.example to .dev.vars
   cp .dev.vars.example .dev.vars

   # Edit .dev.vars and add your DATABASE_URL
   # DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb
   ```

3. **Push schema to database**:
   ```bash
   pnpm db:push
   ```

4. **Test the connection**:
   ```bash
   pnpm dev
   # Visit http://localhost:4444/api/db-test
   ```

### Database Commands

```bash
pnpm db:push        # Push schema directly to database (no migrations)
pnpm db:generate    # Generate migration files from schema changes
pnpm db:studio      # Open Drizzle Studio (database GUI)
```

**When to use what**:
- Development: Use `pnpm db:push` for rapid iteration
- Production: Use `pnpm db:generate` + `pnpm db:migrate` for controlled migrations

**Note**: DATABASE_URL is automatically loaded from `.dev.vars` using dotenv when running drizzle-kit commands.

### Schema Definition

Define your database tables in `src/db/schema.ts`:

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

After modifying the schema:
1. Run `pnpm db:push` to update the database
2. Types are automatically inferred by TypeScript

### Using the Database in API Routes

```typescript
import { getDb } from '@/lib/db'
import { users } from '@/db/schema'

export async function GET() {
  const db = await getDb()

  // Query all users
  const allUsers = await db.select().from(users)

  // Insert a user
  const newUser = await db.insert(users)
    .values({ name: 'John', email: 'john@example.com' })
    .returning()

  return Response.json({ users: allUsers })
}
```

### Production Setup

Set `DATABASE_URL` as a Cloudflare secret:

```bash
pnpm wrangler secret put DATABASE_URL
# Paste your Neon connection string when prompted
```

### Architecture Notes

- **Connection**: Uses `@neondatabase/serverless` with HTTP driver (`neon-http`)
- **Edge-optimized**: Queries over HTTP instead of WebSockets for better performance
- **Serverless**: No connection pooling needed - Neon handles this automatically
- **Type-safe**: Full TypeScript support with inferred types from schema

Learn more:
- [Neon Documentation](https://neon.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Neon + Cloudflare Workers Guide](https://neon.com/blog/api-cf-drizzle-neon)

## Architecture Overview

This is a **Next.js 15** application configured to deploy on **Cloudflare** using **OpenNext for Cloudflare**. The stack:

- **Framework**: Next.js 15.4.6 with App Router
- **Runtime**: React 19.1.0
- **Deployment**: Cloudflare via `@opennextjs/cloudflare`
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS v4 with shadcn/ui components (New York style)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **TypeScript**: Strict mode enabled

### Project Structure

```
apps/
├── web/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── api/          # API routes
│   │   │   │   └── queue/    # Queue API for sending messages
│   │   │   ├── dashboard/    # Dashboard page
│   │   │   ├── layout.tsx    # Root layout with Geist fonts
│   │   │   ├── page.tsx      # Home page
│   │   │   └── globals.css   # Global styles
│   │   ├── components/       # UI components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── db/
│   │   │   └── schema.ts     # Database schema (Drizzle ORM)
│   │   ├── hooks/            # React hooks
│   │   └── lib/
│   │       ├── db.ts         # Database connection utility
│   │       └── utils.ts      # Utility functions
│   ├── wrangler.jsonc        # Cloudflare config (queue producer)
│   └── package.json
└── queue-worker/
    ├── src/
    │   └── index.ts          # Queue consumer handlers
    ├── wrangler.jsonc        # Cloudflare config (queue consumer)
    └── package.json

packages/
└── shared/
    └── src/
        ├── queue-messages.ts  # Queue message type definitions
        ├── utils.ts           # Shared utilities
        └── index.ts           # Exports
```

### Key Configuration Files

- **next.config.ts**: Initialized with OpenNext Cloudflare dev mode via `initOpenNextCloudflareForDev()`
- **open-next.config.ts**: Cloudflare-specific OpenNext configuration (R2 cache commented out)
- **wrangler.jsonc**: Cloudflare Workers configuration with comprehensive inline documentation
- **drizzle.config.ts**: Drizzle Kit configuration for migrations and schema management
- **components.json**: shadcn/ui config - use `@/` path aliases for imports
- **tsconfig.json**: Path alias `@/*` maps to `./src/*`, includes Cloudflare env types

### Cloudflare Integration

- Development mode calls `getCloudflareContext()` for local Cloudflare bindings
- Use `pnpm cf-typegen` to regenerate `cloudflare-env.d.ts` when adding Cloudflare bindings (KV, R2, D1, etc.)
- OpenNext handles Next.js → Cloudflare Workers adapter automatically

### UI Components

- **shadcn/ui** configured with:
  - Style: "new-york"
  - Base color: zinc
  - CSS variables: enabled
  - Icon library: lucide
  - Components path: `@/components/ui`

### Fonts

- **Geist Sans**: Primary sans-serif font (variable: `--font-geist-sans`)
- **Geist Mono**: Monospace font (variable: `--font-geist-mono`)

## Adding Components

Use the shadcn CLI to add new UI components:
```bash
cd apps/web
pnpx shadcn@latest add <component-name>
```

Components will be added to `apps/web/src/components/ui/` with proper path aliases.

## Cloudflare Queues (Background Jobs)

This project uses **Cloudflare Queues** for background job processing with a clean producer/consumer architecture.

### Architecture

- **Producer** (`apps/web`): Next.js app sends messages to the queue
- **Consumer** (`apps/queue-worker`): Dedicated Worker processes messages
- **Shared Types** (`packages/shared`): Type-safe message definitions used by both

### Queue Message Types

All queue messages are defined in `packages/shared/src/queue-messages.ts`:

- `email` - Send emails asynchronously
- `scrape-article` - Scrape and process articles
- `generate-questions` - Generate questions with AI
- `webhook` - Call external webhooks
- `batch-process` - Process items in batches

### Sending Messages to Queue

From any API route in the web app:

```typescript
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ArticleScrapingMessage, generateUUID } from '@datagum/shared'

export async function POST(request: Request) {
  const { env } = await getCloudflareContext()

  const message: ArticleScrapingMessage = {
    type: 'scrape-article',
    payload: {
      url: 'https://example.com/article',
      jobId: generateUUID(),
      userId: 'user123'
    },
    timestamp: Date.now(),
    retryCount: 0
  }

  // Send to queue
  await env.QUEUE.send(message)

  return Response.json({ success: true })
}
```

### Example: Queue API Route

The project includes a complete queue API at `apps/web/src/app/api/queue/route.ts`:

```bash
# Send an email
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "to": "user@example.com", "subject": "Test", "body": "Hello!"}'

# Scrape an article
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{"type": "scrape-article", "url": "https://example.com/article"}'
```

See `apps/web/src/app/api/queue/README.md` for more examples.

### Processing Messages (Queue Worker)

The queue worker (`apps/queue-worker/src/index.ts`) automatically processes messages:

```typescript
import { QueueMessage, isMessageType, retryWithBackoff } from '@datagum/shared'

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const parsedMessage = parseQueueMessage(message.body)

      if (isMessageType(parsedMessage, 'scrape-article')) {
        await handleArticleScraping(parsedMessage, env)
      }
      // ... handle other message types
    }
  }
}
```

### Queue Configuration

#### Local Development - Remote Bindings

**QUEUES WORK IN LOCAL DEVELOPMENT!** We use OpenNext.js Cloudflare's `experimental_remote` bindings feature:

- **Web App** (`next dev`): Runs locally with full Next.js DX (HMR, Turbopack)
- **Queue Binding**: Connects to REMOTE `datagum-queue-dev` in Cloudflare
- **Queue Worker**: Runs remotely in Cloudflare, consumes from same `datagum-queue-dev`
- **Result**: Single `pnpm dev` command enables full queue testing!

**Producer** (`apps/web/wrangler.jsonc`):
```jsonc
{
  "queues": {
    "producers": [
      {
        "binding": "ARTICLE_ANALYSIS_QUEUE",
        "queue": "datagum-queue-dev",
        "experimental_remote": true  // Connects to remote queue in dev
      }
    ]
  },
  "env": {
    "production": {
      "queues": {
        "producers": [
          {
            "binding": "ARTICLE_ANALYSIS_QUEUE",
            "queue": "datagum-queue"  // Production queue
          }
        ]
      }
    }
  }
}
```

**Remote bindings enabled** (`apps/web/next.config.ts`):
```typescript
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev({
  experimental: {
    remoteBindings: true,  // Enable remote Cloudflare resources in dev
  },
});
```

**Consumer** (`apps/queue-worker/wrangler.jsonc`):
```jsonc
{
  "queues": {
    "consumers": [
      {
        "queue": "datagum-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "datagum-dlq"
      }
    ]
  },
  "env": {
    "dev": {
      "name": "datagum-queue-worker-dev",
      "queues": {
        "consumers": [
          {
            "queue": "datagum-queue-dev",  // Dev queue
            "max_retries": 3,
            "dead_letter_queue": "datagum-dlq-dev"
          }
        ]
      }
    }
  }
}
```

**Queue Worker Dev Script** (`apps/queue-worker/package.json`):
```json
{
  "scripts": {
    "dev": "wrangler dev --remote --env dev"
  }
}
```

### Monitoring Queues

```bash
# View queue status
pnpm wrangler queues list

# Tail queue worker logs
pnpm --filter queue-worker tail

# Check dead letter queue
pnpm wrangler queues consumer <consumer-name> --dead-letter-queue
```

### Adding New Message Types

1. Define the message type in `packages/shared/src/queue-messages.ts`
2. Add to the discriminated union
3. Add handler in `apps/queue-worker/src/index.ts`
4. Send from web app using `env.QUEUE.send()`

### Best Practices

- **Type Safety**: Always use types from `@datagum/shared` for queue messages
- **Idempotency**: Design handlers to be idempotent (safe to retry)
- **Error Handling**: Use `message.retry()` for transient errors
- **Batch Processing**: Queue worker processes up to 10 messages at once
- **Dead Letter Queue**: Failed messages (after 3 retries) go to DLQ for investigation
