import { supabase } from './supabase'
import { RecurringCandidate, generateRecurringCandidates } from './recurring-detection'
import { CalendarEvent, getCalendarEvents, deleteCalendarEvent } from './calendar-events'

export async function detectAndSaveRecurringCandidates(userId: string): Promise<RecurringCandidate[]> {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 2)
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + 6)

  const events = await getCalendarEvents(
    userId,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  )

  const standaloneEvents = events.filter(e => !e.is_series_instance && !e.series_id)

  const candidates = generateRecurringCandidates(standaloneEvents, userId)

  for (const candidate of candidates) {
    const { error } = await supabase
      .from('recurring_candidates')
      .upsert({
        user_id: candidate.user_id,
        cluster_key: candidate.cluster_key,
        event_ids: candidate.event_ids,
        detected_pattern: candidate.detected_pattern,
        confidence_score: candidate.confidence_score,
        title: candidate.title,
        normalized_title: candidate.normalized_title,
        start_time: candidate.start_time,
        location: candidate.location,
        occurrence_dates: candidate.occurrence_dates,
        suggested_rrule: candidate.suggested_rrule,
        status: 'pending'
      }, {
        onConflict: 'cluster_key'
      })

    if (error) {
      console.error('Error saving recurring candidate:', error)
    }
  }

  return candidates
}

export async function getRecurringCandidates(userId: string, status?: string): Promise<RecurringCandidate[]> {
  let query = supabase
    .from('recurring_candidates')
    .select('*')
    .eq('user_id', userId)
    .order('confidence_score', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch recurring candidates: ${error.message}`)
  }

  return data || []
}

export async function acceptRecurringCandidate(candidateId: string): Promise<string> {
  const { data: candidate, error: fetchError } = await supabase
    .from('recurring_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle()

  if (fetchError || !candidate) {
    throw new Error('Failed to fetch recurring candidate')
  }

  const eventIds = candidate.event_ids as string[]
  if (eventIds.length === 0) {
    throw new Error('No events in candidate')
  }

  const { data: firstEvent, error: eventError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventIds[0])
    .maybeSingle()

  if (eventError || !firstEvent) {
    throw new Error('Failed to fetch first event')
  }

  const occurrenceDates = candidate.occurrence_dates as string[]
  const startDate = occurrenceDates[0]
  const untilDate = occurrenceDates[occurrenceDates.length - 1]

  const { data: series, error: seriesError } = await supabase
    .from('event_series')
    .insert({
      user_id: candidate.user_id,
      title: candidate.title,
      normalized_title: candidate.normalized_title,
      description: firstEvent.description,
      start_date: startDate,
      start_time: candidate.start_time,
      end_time: firstEvent.end_time,
      location: candidate.location,
      category: firstEvent.category,
      priority: firstEvent.priority,
      rrule: candidate.suggested_rrule,
      exdates: [],
      until_date: untilDate,
      source: 'detected',
      is_active: true
    })
    .select()
    .maybeSingle()

  if (seriesError || !series) {
    throw new Error(`Failed to create event series: ${seriesError?.message}`)
  }

  for (const eventId of eventIds) {
    await deleteCalendarEvent(eventId)
  }

  const { error: updateError } = await supabase
    .from('recurring_candidates')
    .update({ status: 'accepted' })
    .eq('id', candidateId)

  if (updateError) {
    console.error('Error updating candidate status:', updateError)
  }

  return series.id
}

export async function rejectRecurringCandidate(candidateId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_candidates')
    .update({ status: 'rejected' })
    .eq('id', candidateId)

  if (error) {
    throw new Error(`Failed to reject recurring candidate: ${error.message}`)
  }
}

export async function deleteRecurringCandidate(candidateId: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_candidates')
    .delete()
    .eq('id', candidateId)

  if (error) {
    throw new Error(`Failed to delete recurring candidate: ${error.message}`)
  }
}
