import { supabase } from './supabase'
import { hasRecurringTextCues } from './recurring-detection'

export async function uploadDocument(file: File, userId: string) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, file)

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }

  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: fileName,
      status: 'pending',
      progress: 0,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('documents').remove([fileName])
    throw new Error(`Failed to create document record: ${insertError.message}`)
  }

  return document
}

export async function processDocument(documentId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const apiUrl = `${supabaseUrl}/functions/v1/process-document`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ documentId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to process document')
  }

  return await response.json()
}

export async function getDocuments(userId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`)
  }

  return data
}

export async function getExtractedEvents(documentId: string) {
  const { data, error } = await supabase
    .from('extracted_events')
    .select('*')
    .eq('document_id', documentId)
    .order('event_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`)
  }

  if (data) {
    for (const event of data) {
      const hasRecurringCue = hasRecurringTextCues(event.title + ' ' + (event.description || ''))
      if (hasRecurringCue && !(event as any).is_recurring_tagged) {
        try {
          const currentMetadata = (event.metadata as Record<string, any>) || {}
          const { error } = await supabase
            .from('extracted_events')
            .update({ 
              metadata: { ...currentMetadata, has_recurring_cue: true } 
            })
            .eq('id', event.id)
          
          if (error) {
            console.warn('Failed to update event metadata:', error)
            // Don't throw - this is optional metadata update
          }
        } catch (error) {
          console.warn('Error updating event metadata:', error)
          // Silently continue - this is optional
        }
      }
    }
  }

  return data
}

export async function deleteDocument(documentId: string) {
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch document: ${fetchError.message}`)
  }

  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([document.storage_path])

  if (storageError) {
    console.error('Failed to delete file from storage:', storageError)
  }

  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`)
  }
}

export async function markEventAsImported(eventId: string) {
  const { error } = await supabase
    .from('extracted_events')
    .update({ is_imported: true })
    .eq('id', eventId)

  if (error) {
    throw new Error(`Failed to mark event as imported: ${error.message}`)
  }
}

export async function deleteExtractedEvent(eventId: string) {
  const { error } = await supabase
    .from('extracted_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    throw new Error(`Failed to delete event: ${error.message}`)
  }
}

export async function deleteExtractedEvents(eventIds: string[]) {
  const { error } = await supabase
    .from('extracted_events')
    .delete()
    .in('id', eventIds)

  if (error) {
    throw new Error(`Failed to delete events: ${error.message}`)
  }
}

export async function importEventToCalendar(eventId: string) {
  const { data: extractedEvent, error: fetchError } = await supabase
    .from('extracted_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (fetchError || !extractedEvent) {
    throw new Error('Failed to fetch extracted event')
  }

  const metadata = extractedEvent.metadata || {}
  
  // Check if this is a range with day pattern that needs expansion
  if (metadata.is_range_with_day && metadata.normalized_date && metadata.normalized_end_date && metadata.day_of_week) {
    // Expand into multiple calendar events
    const expandedEvents = expandRangeWithDays(
      extractedEvent,
      metadata.normalized_date,
      metadata.normalized_end_date,
      metadata.day_of_week
    )
    
    // Insert all expanded events
    const eventsToInsert = expandedEvents.map(event => ({
      user_id: extractedEvent.user_id,
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      start_time: extractedEvent.start_time,
      end_time: extractedEvent.end_time,
      location: extractedEvent.location,
      category: extractedEvent.category,
      priority: extractedEvent.priority,
      source: 'extracted',
      source_id: eventId,
      is_completed: false,
    }))

    const { data: calendarEvents, error: insertError } = await supabase
      .from('calendar_events')
      .insert(eventsToInsert)
      .select()

    if (insertError) {
      throw new Error(`Failed to import expanded events to calendar: ${insertError.message}`)
    }

    await markEventAsImported(eventId)

    return calendarEvents
  } else {
    // Normal single event import
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

    await markEventAsImported(eventId)

    return calendarEvent
  }
}

// Helper function to expand date range with day pattern
function expandRangeWithDays(
  extractedEvent: any,
  startDateStr: string,
  endDateStr: string,
  dayOfWeekStr: string
): Array<{ title: string; description: string | null; event_date: string }> {
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  
  // Parse day(s) of week
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  }
  
  const daysOfWeek = dayOfWeekStr
    .toLowerCase()
    .split(',')
    .map(d => d.trim())
    .map(d => dayMap[d])
    .filter(d => d !== undefined)

  if (daysOfWeek.length === 0) {
    return []
  }

  const expandedEvents: Array<{ title: string; description: string | null; event_date: string }> = []
  const currentDate = new Date(startDate)

  // Generate events for each matching day in the range
  while (currentDate <= endDate) {
    if (daysOfWeek.includes(currentDate.getDay())) {
      const eventDate = currentDate.toISOString().split('T')[0]
      expandedEvents.push({
        title: extractedEvent.title,
        description: extractedEvent.description,
        event_date: eventDate,
      })
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return expandedEvents
}
