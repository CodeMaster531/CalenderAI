import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getRefreshedOAuthClient } from '@/lib/google-oauth'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'

type SyncRequest = {
  integrationId: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncRequest
    if (!body?.integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { data: integration, error } = await supabaseAdmin
      .from('google_integrations')
      .select('*')
      .eq('id', body.integrationId)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // This will automatically refresh the token if it's expired or expiring soon
    const oauth2Client = await getRefreshedOAuthClient(integration)

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: thirtyDaysAgo.toISOString(),
    })

    const googleEvents = eventsResponse.data.items ?? []
    let imported = 0

    for (const event of googleEvents) {
      const start = event.start?.dateTime || event.start?.date
      if (!start) continue
      const startDate = new Date(start)

      const payload = {
        user_id: integration.user_id,
        title: event.summary || 'Google Calendar Event',
        description: event.description || null,
        event_date: startDate.toISOString().slice(0, 10),
        start_time: event.start?.dateTime ? startDate.toISOString().slice(11, 19) : null,
        end_time: event.end?.dateTime ? new Date(event.end.dateTime!).toISOString().slice(11, 19) : null,
        location: event.location || null,
        category: 'meeting',
        priority: 'medium',
        source: 'google_calendar',
        source_id: event.id || null,
        is_completed: false,
      }

      const { data: existing } = await supabaseAdmin
        .from('calendar_events')
        .select('id')
        .eq('user_id', integration.user_id)
        .eq('source', 'google_calendar')
        .eq('source_id', payload.source_id)
        .maybeSingle()

      if (existing?.id) {
        await supabaseAdmin
          .from('calendar_events')
          .update(payload)
          .eq('id', existing.id)
      } else {
        await supabaseAdmin.from('calendar_events').insert(payload)
      }

      imported += 1
    }

    // Update last synced timestamp
    await supabaseAdmin
      .from('google_integrations')
      .update({
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    return NextResponse.json({ imported })
  } catch (error) {
    console.error('Failed to sync Google events', error)
    return NextResponse.json({ error: 'Failed to sync Google events' }, { status: 500 })
  }
}


