import { CalendarEvent } from './calendar-events'

export interface RecurringCandidate {
  id: string
  user_id: string
  cluster_key: string
  event_ids: string[]
  detected_pattern: string
  confidence_score: number
  title: string
  normalized_title: string
  start_time: string | null
  location: string | null
  occurrence_dates: string[]
  suggested_rrule: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface EventCluster {
  normalized_title: string
  start_time: string | null
  location: string | null
  events: CalendarEvent[]
  dates: Date[]
}

export interface PeriodicityPattern {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  interval: number
  byDay?: string[]
  confidence: number
}

const STOPWORDS = new Set([
  'with', 'prof', 'professor', 'dr', 'mr', 'ms', 'mrs', 'the', 'a', 'an', 'and', 'or', 'but',
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'from'
])

const RECURRING_TEXT_CUES = [
  'every', 'weekly', 'biweekly', 'daily', 'monthly',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'office hours', 'office hour', 'lecture', 'lab', 'seminar', 'discussion',
  'until', 'through', 'recurring', 'repeating', 'regular'
]

const DAY_MAP: Record<string, string> = {
  'monday': 'MO',
  'tuesday': 'TU',
  'wednesday': 'WE',
  'thursday': 'TH',
  'friday': 'FR',
  'saturday': 'SA',
  'sunday': 'SU',
  'mon': 'MO',
  'tue': 'TU',
  'wed': 'WE',
  'thu': 'TH',
  'fri': 'FR',
  'sat': 'SA',
  'sun': 'SU'
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOPWORDS.has(word))
    .join(' ')
    .trim()
}

export function hasRecurringTextCues(text: string): boolean {
  const lowerText = text.toLowerCase()
  return RECURRING_TEXT_CUES.some(cue => lowerText.includes(cue))
}

export function extractDaysFromText(text: string): string[] {
  const lowerText = text.toLowerCase()
  const days: string[] = []

  for (const [day, code] of Object.entries(DAY_MAP)) {
    if (lowerText.includes(day)) {
      days.push(code)
    }
  }

  return Array.from(new Set(days))
}

export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1.0

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true
        s2Matches[j] = true
        matches++
        break
      }
    }
  }

  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3

  let prefix = 0
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

export function clusterEvents(events: CalendarEvent[], threshold = 0.9): EventCluster[] {
  const clusters: EventCluster[] = []

  for (const event of events) {
    const normalized = normalizeTitle(event.title)
    const startTime = event.start_time?.substring(0, 5) || null
    const location = event.location || null

    let foundCluster = false
    for (const cluster of clusters) {
      const titleSimilarity = jaroWinklerSimilarity(normalized, cluster.normalized_title)
      const timeMatch = startTime === cluster.start_time
      const locationMatch = location === cluster.location || (!location && !cluster.location)

      if (titleSimilarity >= threshold && timeMatch && locationMatch) {
        cluster.events.push(event)
        cluster.dates.push(new Date(event.event_date))
        foundCluster = true
        break
      }
    }

    if (!foundCluster) {
      clusters.push({
        normalized_title: normalized,
        start_time: startTime,
        location: location,
        events: [event],
        dates: [new Date(event.event_date)]
      })
    }
  }

  return clusters.filter(cluster => cluster.events.length >= 2)
}

export function detectPeriodicity(dates: Date[]): PeriodicityPattern | null {
  if (dates.length < 2) return null

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const deltas: number[] = []

  for (let i = 1; i < sortedDates.length; i++) {
    const delta = Math.round((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24))
    deltas.push(delta)
  }

  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length
  const variance = deltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / deltas.length
  const stdDev = Math.sqrt(variance)

  const consistency = Math.max(0, 1 - stdDev / avgDelta)

  if (consistency < 0.7) return null

  const dayOfWeekCounts: Record<number, number> = {}
  for (const date of sortedDates) {
    const dow = date.getDay()
    dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + 1
  }

  const byDay: string[] = []
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  for (const [dow, count] of Object.entries(dayOfWeekCounts)) {
    if (count >= 2) {
      byDay.push(dayNames[parseInt(dow)])
    }
  }

  if (Math.abs(avgDelta - 7) < 2) {
    return {
      frequency: 'WEEKLY',
      interval: 1,
      byDay: byDay.length > 0 ? byDay : undefined,
      confidence: consistency
    }
  } else if (Math.abs(avgDelta - 14) < 2) {
    return {
      frequency: 'BIWEEKLY',
      interval: 2,
      byDay: byDay.length > 0 ? byDay : undefined,
      confidence: consistency
    }
  } else if (Math.abs(avgDelta - 1) < 0.5) {
    return {
      frequency: 'DAILY',
      interval: 1,
      confidence: consistency
    }
  } else if (avgDelta >= 28 && avgDelta <= 31) {
    return {
      frequency: 'MONTHLY',
      interval: 1,
      confidence: consistency
    }
  }

  return null
}

export function buildRRule(
  pattern: PeriodicityPattern,
  startDate: Date,
  untilDate: Date,
  textCueDays?: string[]
): string {
  const parts = [`FREQ=${pattern.frequency}`]

  if (pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`)
  }

  if (pattern.byDay && pattern.byDay.length > 0) {
    parts.push(`BYDAY=${pattern.byDay.join(',')}`)
  } else if (textCueDays && textCueDays.length > 0) {
    parts.push(`BYDAY=${textCueDays.join(',')}`)
  }

  const untilStr = untilDate.toISOString().split('T')[0].replace(/-/g, '')
  parts.push(`UNTIL=${untilStr}`)

  return parts.join(';')
}

export function generateRecurringCandidates(events: CalendarEvent[], userId: string): RecurringCandidate[] {
  const candidatesWithTextCues = events.filter(event =>
    hasRecurringTextCues(event.title) ||
    (event.description && hasRecurringTextCues(event.description))
  )

  const clusters = clusterEvents(events)
  const candidates: RecurringCandidate[] = []

  for (const cluster of clusters) {
    if (cluster.events.length < 2) continue

    const periodicity = detectPeriodicity(cluster.dates)
    if (!periodicity) continue

    const sortedDates = [...cluster.dates].sort((a, b) => a.getTime() - b.getTime())
    const firstEvent = cluster.events[0]
    const textCueDays = extractDaysFromText(firstEvent.title + ' ' + (firstEvent.description || ''))

    const startDate = sortedDates[0]
    const untilDate = sortedDates[sortedDates.length - 1]
    const rrule = buildRRule(periodicity, startDate, untilDate, textCueDays.length > 0 ? textCueDays : undefined)

    const hasTextCue = cluster.events.some(e =>
      hasRecurringTextCues(e.title) || (e.description && hasRecurringTextCues(e.description))
    )
    const confidenceBoost = hasTextCue ? 0.15 : 0

    candidates.push({
      id: crypto.randomUUID(),
      user_id: userId,
      cluster_key: `${cluster.normalized_title}_${cluster.start_time}_${cluster.location}`,
      event_ids: cluster.events.map(e => e.id),
      detected_pattern: periodicity.frequency,
      confidence_score: Math.min(1.0, periodicity.confidence + confidenceBoost),
      title: cluster.events[0].title,
      normalized_title: cluster.normalized_title,
      start_time: cluster.start_time,
      location: cluster.location,
      occurrence_dates: sortedDates.map(d => d.toISOString().split('T')[0]),
      suggested_rrule: rrule,
      status: 'pending'
    })
  }

  return candidates.sort((a, b) => b.confidence_score - a.confidence_score)
}
