import { NextRequest, NextResponse } from 'next/server'
import { sendEmailDigest, getUsersForEmailDigest, type EmailDigestFrequency } from '@/lib/email-service'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * POST /api/cron/email-digest
 * Scheduled job endpoint for sending email digests
 * Should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * 
 * Query params:
 * - frequency: 'daily' | 'weekly' (default: 'daily')
 * - secret: Optional secret key for authentication
 */
export async function POST(req: NextRequest) {
  // Optional: Verify secret key for security
  const searchParams = req.nextUrl.searchParams
  const secret = searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    console.error('[CRON EMAIL DIGEST] Invalid secret')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const frequency = (searchParams.get('frequency') || 'daily') as EmailDigestFrequency

  if (!['daily', 'weekly'].includes(frequency)) {
    return NextResponse.json(
      { error: 'Invalid frequency. Must be "daily" or "weekly"' },
      { status: 400 }
    )
  }

  try {
    const now = new Date()
    const lookAheadDays = frequency === 'daily' ? 1 : 7
    const lookAhead = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000)

    // Get all users who should receive this frequency
    const users = await getUsersForEmailDigest(frequency)

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users to send emails to',
        sent: 0,
        total: 0
      })
    }

    const results = []

    for (const user of users) {
      try {
        // Get upcoming events
        const { data: events } = await supabaseAdmin
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.user_id)
          .eq('is_completed', false)
          .gte('event_date', now.toISOString().split('T')[0])
          .lte('event_date', lookAhead.toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true })

        // Get upcoming tasks
        const { data: tasks } = await supabaseAdmin
          .from('tasks')
          .select(`
            *,
            task_lists (
              name
            )
          `)
          .eq('user_id', user.user_id)
          .eq('is_completed', false)
          .not('due_date', 'is', null)
          .gte('due_date', now.toISOString().split('T')[0])
          .lte('due_date', lookAhead.toISOString().split('T')[0])
          .order('due_date', { ascending: true })
          .order('due_time', { ascending: true })

        const formattedEvents = (events || []).map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          event_date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          location: e.location,
          category: e.category,
          priority: e.priority
        }))

        const formattedTasks = (tasks || []).map(t => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          due_date: t.due_date,
          due_time: t.due_time,
          priority: t.priority,
          list_name: t.task_lists?.name
        }))

        const result = await sendEmailDigest(
          user.email,
          user.full_name,
          formattedEvents,
          formattedTasks,
          frequency
        )

        results.push({
          userId: user.user_id,
          email: user.email,
          success: result.success,
          error: result.error,
          eventsCount: formattedEvents.length,
          tasksCount: formattedTasks.length
        })
      } catch (error) {
        console.error('[CRON EMAIL DIGEST] Error processing user:', user.user_id, error)
        results.push({
          userId: user.user_id,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      frequency,
      sent: successCount,
      total: results.length,
      results
    })
  } catch (error) {
    console.error('[CRON EMAIL DIGEST] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/email-digest
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Email digest cron endpoint is active',
    frequencies: ['daily', 'weekly']
  })
}
