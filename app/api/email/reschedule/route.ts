import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * POST /api/email/reschedule
 * Reschedule a reminder (event or task) to a new date/time
 * Body: { type: 'event' | 'task', id: string, newDate: string, newTime?: string, userId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, id, newDate, newTime, userId } = body

    if (!type || !id || !newDate || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id, newDate, userId' },
        { status: 400 }
      )
    }

    if (!['event', 'task'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "event" or "task"' },
        { status: 400 }
      )
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (type === 'event') {
      const updateData: any = {
        event_date: newDate,
        updated_at: new Date().toISOString()
      }

      if (newTime) {
        // Validate time format
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(newTime)) {
          return NextResponse.json(
            { error: 'Invalid time format. Use HH:MM or HH:MM:SS' },
            { status: 400 }
          )
        }
        updateData.start_time = newTime.includes(':') && newTime.split(':').length === 2
          ? `${newTime}:00`
          : newTime
      }

      const { error } = await supabaseAdmin
        .from('calendar_events')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        console.error('[RESCHEDULE API] Error updating event:', error)
        return NextResponse.json(
          { error: 'Failed to reschedule event' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        type: 'event',
        id,
        newDate,
        newTime: updateData.start_time || null
      })
    } else {
      const updateData: any = {
        due_date: newDate,
        updated_at: new Date().toISOString()
      }

      if (newTime) {
        // Validate time format
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(newTime)) {
          return NextResponse.json(
            { error: 'Invalid time format. Use HH:MM or HH:MM:SS' },
            { status: 400 }
          )
        }
        updateData.due_time = newTime.includes(':') && newTime.split(':').length === 2
          ? `${newTime}:00`
          : newTime
      }

      const { error } = await supabaseAdmin
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        console.error('[RESCHEDULE API] Error updating task:', error)
        return NextResponse.json(
          { error: 'Failed to reschedule task' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        type: 'task',
        id,
        newDate,
        newTime: updateData.due_time || null
      })
    }
  } catch (error) {
    console.error('[RESCHEDULE API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
