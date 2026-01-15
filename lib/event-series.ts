import { supabase } from './supabase'
import { CalendarEvent } from './calendar-events'

export interface EventSeries {
  id: string
  user_id: string
  title: string
  normalized_title: string
  description?: string
  start_date: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  location?: string
  category: string
  priority: string
  rrule: string
  exdates: string[]
  until_date?: string
  source: 'manual' | 'extracted' | 'detected'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EventOverride {
  id: string
  series_id: string
  occurrence_date: string
  title?: string
  start_time?: string
  end_time?: string
  location?: string
  description?: string
  is_cancelled: boolean
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface SeriesOccurrence {
  date: string
  start_time?: string
  end_time?: string
  title: string
  location?: string
  description?: string
  is_cancelled: boolean
  is_completed: boolean
  override?: EventOverride
}

function parseRRule(rrule: string): { freq: string, interval: number, byDay?: string[], until?: string } {
  const parts = rrule.split(';')
  const result: any = { interval: 1 }

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 'FREQ') result.freq = value
    else if (key === 'INTERVAL') result.interval = parseInt(value)
    else if (key === 'BYDAY') result.byDay = value.split(',')
    else if (key === 'UNTIL') result.until = value
  }

  return result
}

function parseDateFromRRuleFormat(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))
  return new Date(year, month, day)
}

export function generateSeriesOccurrences(series: EventSeries, overrides: EventOverride[]): SeriesOccurrence[] {
  const occurrences: SeriesOccurrence[] = []
  const rule = parseRRule(series.rrule)
  const startDate = new Date(series.start_date)
  const untilDate = rule.until ? parseDateFromRRuleFormat(rule.until) : new Date(series.until_date || startDate)

  const overrideMap = new Map<string, EventOverride>()
  for (const override of overrides) {
    overrideMap.set(override.occurrence_date, override)
  }

  const exdatesSet = new Set(series.exdates)

  const dayMap: Record<string, number> = {
    'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
  }

  if (rule.freq === 'WEEKLY' || rule.freq === 'BIWEEKLY') {
    const targetDays = rule.byDay ? rule.byDay.map(d => dayMap[d]) : [startDate.getDay()]
    const interval = rule.freq === 'BIWEEKLY' ? 2 : rule.interval || 1

    let currentDate = new Date(startDate)
    let weekCount = 0

    while (currentDate <= untilDate) {
      for (const targetDay of targetDays) {
        const occurrenceDate = new Date(currentDate)
        const daysUntilTarget = (targetDay - currentDate.getDay() + 7) % 7
        occurrenceDate.setDate(currentDate.getDate() + daysUntilTarget)

        if (occurrenceDate >= startDate && occurrenceDate <= untilDate) {
          const dateStr = occurrenceDate.toISOString().split('T')[0]

          if (!exdatesSet.has(dateStr)) {
            const override = overrideMap.get(dateStr)

            occurrences.push({
              date: dateStr,
              start_time: override?.start_time || series.start_time,
              end_time: override?.end_time || series.end_time,
              title: override?.title || series.title,
              location: override?.location || series.location,
              description: override?.description || series.description,
              is_cancelled: override?.is_cancelled || false,
              is_completed: override?.is_completed || false,
              override
            })
          }
        }
      }

      weekCount++
      currentDate.setDate(startDate.getDate() + weekCount * 7 * interval)
    }
  } else if (rule.freq === 'DAILY') {
    let currentDate = new Date(startDate)

    while (currentDate <= untilDate) {
      const dateStr = currentDate.toISOString().split('T')[0]

      if (!exdatesSet.has(dateStr)) {
        const override = overrideMap.get(dateStr)

        occurrences.push({
          date: dateStr,
          start_time: override?.start_time || series.start_time,
          end_time: override?.end_time || series.end_time,
          title: override?.title || series.title,
          location: override?.location || series.location,
          description: override?.description || series.description,
          is_cancelled: override?.is_cancelled || false,
          is_completed: override?.is_completed || false,
          override
        })
      }

      currentDate.setDate(currentDate.getDate() + (rule.interval || 1))
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getEventSeries(userId: string): Promise<EventSeries[]> {
  const { data, error } = await supabase
    .from('event_series')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('start_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch event series: ${error.message}`)
  }

  return data || []
}

export async function getEventSeriesById(seriesId: string): Promise<EventSeries | null> {
  const { data, error } = await supabase
    .from('event_series')
    .select('*')
    .eq('id', seriesId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch event series: ${error.message}`)
  }

  return data
}

export async function getSeriesOverrides(seriesId: string): Promise<EventOverride[]> {
  const { data, error } = await supabase
    .from('event_overrides')
    .select('*')
    .eq('series_id', seriesId)
    .order('occurrence_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch series overrides: ${error.message}`)
  }

  return data || []
}

export async function createEventOverride(
  seriesId: string,
  occurrenceDate: string,
  overrideData: Partial<EventOverride>
): Promise<EventOverride> {
  const { data, error } = await supabase
    .from('event_overrides')
    .upsert({
      series_id: seriesId,
      occurrence_date: occurrenceDate,
      ...overrideData
    }, {
      onConflict: 'series_id,occurrence_date'
    })
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to create event override: ${error.message}`)
  }

  return data!
}

export async function deleteEventSeries(seriesId: string): Promise<void> {
  const { error } = await supabase
    .from('event_series')
    .delete()
    .eq('id', seriesId)

  if (error) {
    throw new Error(`Failed to delete event series: ${error.message}`)
  }
}

export async function updateEventSeries(seriesId: string, updates: Partial<EventSeries>): Promise<EventSeries> {
  const { data, error } = await supabase
    .from('event_series')
    .update(updates)
    .eq('id', seriesId)
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update event series: ${error.message}`)
  }

  return data!
}
