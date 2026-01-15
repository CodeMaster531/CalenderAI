import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Get upcoming events or tasks that need notifications
 * Query params:
 * - userId: User ID
 * - type: 'events' | 'tasks' | 'both'
 * - lookAhead: Minutes to look ahead (default: 15)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') || 'both'
    const lookAheadMinutes = parseInt(searchParams.get('lookAhead') || '15', 10)

    if (!userId) {
      console.error('[NOTIFICATIONS API] Missing userId parameter')
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const now = new Date()
    console.log(now)
    const lookAhead = new Date(now.getTime() + lookAheadMinutes * 60 * 1000)

    const results: { events?: any[], tasks?: any[] } = {}

    // Get upcoming events
    if (type === 'events' || type === 'both') {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .gte('event_date', now.toISOString().split('T')[0])
        .lte('event_date', lookAhead.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (eventsError) {
        console.error('[NOTIFICATIONS API] Error fetching events:', eventsError)
      } else {
        // Filter events that are within the look-ahead window
        const upcomingEvents = (events || []).filter(event => {
          if (!event.start_time) {
            // All-day event - check if it's today or within look-ahead
            const eventDate = new Date(event.event_date)
            return eventDate >= now && eventDate <= lookAhead
          }

          // Event with time - check if it's within look-ahead window
          const eventDateTime = new Date(`${event.event_date}T${event.start_time}`)
          return eventDateTime >= now && eventDateTime <= lookAhead
        })

        results.events = upcomingEvents
      }
    }

    // Get upcoming tasks
    if (type === 'tasks' || type === 'both') {
      const { data: tasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .gte('due_date', now.toISOString().split('T')[0])
        .lte('due_date', lookAhead.toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true })

      if (tasksError) {
        console.error('[NOTIFICATIONS API] Error fetching tasks:', tasksError)
      } else {
        // Filter tasks that are within the look-ahead window
        const upcomingTasks = (tasks || []).filter(task => {
          if (!task.due_time) {
            // Task with only date - check if it's today or within look-ahead
            const taskDate = new Date(task.due_date)
            const taskDateEnd = new Date(taskDate)
            taskDateEnd.setHours(23, 59, 59, 999)
            return taskDateEnd >= now && taskDate <= lookAhead
          }

          // Task with time - check if it's within look-ahead window
          const taskDateTime = new Date(`${task.due_date}T${task.due_time}`)
          return taskDateTime >= now && taskDateTime <= lookAhead
        })

        results.tasks = upcomingTasks
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in upcoming notifications API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
