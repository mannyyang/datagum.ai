/**
 * Custom Worker Wrapper
 *
 * This file wraps the OpenNext.js generated worker and adds
 * our custom Cloudflare Queue consumer handler.
 */

import { queueHandler } from './src/queue/handler'
import type { QueueMessage } from './src/lib/shared'

// This will be the generated OpenNext worker
// @ts-ignore - generated file
import worker from './.open-next/worker.js'

export default {
  ...worker,

  // Add our custom queue consumer handler
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    return queueHandler(batch, env, ctx)
  },
}
