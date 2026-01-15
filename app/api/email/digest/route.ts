import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailDigest, getUsersForEmailDigest, type EmailDigestFrequency } from '@/lib/email-service'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * POST /api/email/digest
 * Send email digest to a specific user or all users with a specific frequency
 * Query params:
 * - userId: Optional, send to specific user
 * - frequency: 'daily' | 'weekly' (default: 'daily')
 */
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const frequency = (searchParams.get('frequency') || 'daily') as EmailDigestFrequency

    if (!['daily', 'weekly'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be "daily" or "weekly"' },
        { status: 400 }
      )
    }

    const now = new Date()
    const lookAheadDays = frequency === 'daily' ? 1 : 7
    const lookAhead = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000)

    let users: Array<{ user_id: string; email: string; full_name: string | null }> = []

    if (userId) {
      // Send to specific user
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name, email_digest_frequency')
        .eq('user_id', userId)
        .single()

      if (!profile || profile.email_digest_frequency !== frequency) {
        return NextResponse.json(
          { error: 'User not found or email digest not enabled for this frequency' },
          { status: 404 }
        )
      }

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (!authUser?.user?.email) {
        return NextResponse.json(
          { error: 'User email not found' },
          { status: 404 }
        )
      }

      users = [{
        user_id: userId,
        email: authUser.user.email,
        full_name: profile.full_name
      }]
    } else {
      // Send to all users with this frequency
      users = await getUsersForEmailDigest(frequency)
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
          error: result.error
        })
      } catch (error) {
        console.error('[EMAIL DIGEST API] Error processing user:', user.user_id, error)
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
      sent: successCount,
      total: results.length,
      results
    })
  } catch (error) {
    console.error('[EMAIL DIGEST API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
