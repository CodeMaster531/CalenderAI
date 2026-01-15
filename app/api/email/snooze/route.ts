import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * POST /api/email/snooze
 * Snooze a reminder (event or task) by updating its date/time
 * Body: { type: 'event' | 'task', id: string, snoozeMinutes: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, id, snoozeMinutes, userId } = body

    if (!type || !id || !snoozeMinutes || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id, snoozeMinutes, userId' },
        { status: 400 }
      )
    }

    if (!['event', 'task'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "event" or "task"' },
        { status: 400 }
      )
    }

    const snoozeMs = snoozeMinutes * 60 * 1000
    const newTime = new Date(Date.now() + snoozeMs)

    if (type === 'event') {
      // Snooze event by updating start_time
      const { data: event } = await supabaseAdmin
        .from('calendar_events')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        )
      }

      const currentDateTime = event.start_time
        ? new Date(`${event.event_date}T${event.start_time}`)
        : new Date(event.event_date)

      const snoozedDateTime = new Date(currentDateTime.getTime() + snoozeMs)
      const newDate = snoozedDateTime.toISOString().split('T')[0]
      const newTimeStr = snoozedDateTime.toTimeString().split(' ')[0].slice(0, 5) + ':00'

      const { error } = await supabaseAdmin
        .from('calendar_events')
        .update({
          event_date: newDate,
          start_time: newTimeStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        console.error('[SNOOZE API] Error updating event:', error)
        return NextResponse.json(
          { error: 'Failed to snooze event' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        type: 'event',
        id,
        newDate,
        newTime: newTimeStr
      })
    } else {
      // Snooze task by updating due_date and due_time
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }

      const currentDateTime = task.due_time
        ? new Date(`${task.due_date}T${task.due_time}`)
        : new Date(task.due_date + 'T00:00:00')

      const snoozedDateTime = new Date(currentDateTime.getTime() + snoozeMs)
      const newDate = snoozedDateTime.toISOString().split('T')[0]
      const newTimeStr = snoozedDateTime.toTimeString().split(' ')[0].slice(0, 5) + ':00'

      const { error } = await supabaseAdmin
        .from('tasks')
        .update({
          due_date: newDate,
          due_time: newTimeStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        console.error('[SNOOZE API] Error updating task:', error)
        return NextResponse.json(
          { error: 'Failed to snooze task' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        type: 'task',
        id,
        newDate,
        newTime: newTimeStr
      })
    }
  } catch (error) {
    console.error('[SNOOZE API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
