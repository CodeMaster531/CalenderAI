import { supabase } from './supabase'

export type CalendarEvent = {
  id: string
  user_id: string
  title: string
  description?: string
  event_date: string
  start_time?: string
  end_time?: string
  location?: string
  category: 'assignment' | 'exam' | 'meeting' | 'deadline' | 'milestone' | 'other'
  priority: 'critical' | 'high' | 'medium' | 'low'
  source: 'manual' | 'extracted' | 'google_calendar' | 'email'
  source_id?: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export async function importExtractedEventToCalendar(eventId: string) {
  const { data: extractedEvent, error: fetchError } = await supabase
    .from('extracted_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (fetchError || !extractedEvent) {
    throw new Error('Failed to fetch extracted event')
  }

  const { data: calendarEvent, error: insertError } = await supabase
    .from('calendar_events')
    .insert({
      user_id: extractedEvent.user_id,
      title: extractedEvent.title,
      description: extractedEvent.description,
      event_date: extractedEvent.event_date,
      start_time: extractedEvent.start_time,
      end_time: extractedEvent.end_time,
      location: extractedEvent.location,
      category: extractedEvent.category,
      priority: extractedEvent.priority,
      source: 'extracted',
      source_id: eventId,
      is_completed: false,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to import event to calendar: ${insertError.message}`)
  }

  const { error: updateError } = await supabase
    .from('extracted_events')
    .update({ is_imported: true })
    .eq('id', eventId)

  if (updateError) {
    console.error('Failed to mark event as imported:', updateError)
  }

  return calendarEvent
}

export async function getCalendarEvents(userId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)

  if (startDate) {
    query = query.gte('event_date', startDate)
  }

  if (endDate) {
    query = query.lte('event_date', endDate)
  }

  const { data, error } = await query.order('event_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch calendar events: ${error.message}`)
  }

  return data
}

export async function createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(event)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create calendar event: ${error.message}`)
  }

  return data
}

export async function updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>) {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update calendar event: ${error.message}`)
  }

  return data
}

export async function deleteCalendarEvent(eventId: string) {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    throw new Error(`Failed to delete calendar event: ${error.message}`)
  }
}
