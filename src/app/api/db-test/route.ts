import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { users } from '@/db/schema'
import { sql } from 'drizzle-orm'

/**
 * Database Test API Route
 *
 * Test your Neon database connection and Drizzle ORM setup.
 *
 * Examples:
 * - GET /api/db-test - Test connection and list users
 * - POST /api/db-test - Create a test user
 */
export async function GET() {
  try {
    const db = await getDb()

    // Test 1: Raw SQL query to verify connection
    const result = await db.execute(sql`SELECT NOW() as current_time`)

    // Test 2: Query users table using Drizzle ORM
    const allUsers = await db.select().from(users)

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      currentTime: result.rows[0],
      usersCount: allUsers.length,
      users: allUsers,
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure DATABASE_URL is set in .dev.vars and the database is accessible',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Insert a new user
    const newUser = await db
      .insert(users)
      .values({ name, email })
      .returning()

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: newUser[0],
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
