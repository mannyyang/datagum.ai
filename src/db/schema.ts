import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Database Schema
 *
 * Define your database tables here using Drizzle ORM's schema builder.
 * After modifying this file:
 * 1. Generate migrations: pnpm db:generate
 * 2. Apply to database: pnpm db:push
 *
 * Learn more: https://orm.drizzle.team/docs/sql-schema-declaration
 */

/**
 * Example users table
 *
 * Remove or modify this to match your application's needs.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Export types for TypeScript
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
