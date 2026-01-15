import * as chrono from 'chrono-node'
import type { EventSuggestion } from './types'

export function extractEventSuggestions(text: string): EventSuggestion[] {
  const suggestions: EventSuggestion[] = []
  const parsedDates = chrono.parse(text, new Date(), { forwardDate: true })

  for (const parsed of parsedDates) {
    const startIndex = Math.max(0, parsed.index - 100)
    const endIndex = Math.min(text.length, parsed.index + parsed.text.length + 100)
    const context = text.substring(startIndex, endIndex)

    const contextLines = context.split('\n').map(l => l.trim()).filter(l => l)
    let title = contextLines[0] || parsed.text

    if (title.length > 100) {
      title = title.substring(0, 97) + '...'
    }

    const startDate = parsed.start.date()

    suggestions.push({
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: contextLines.slice(1, 3).join(' ') || undefined,
      time: {
        start: startDate,
        end: parsed.end ? parsed.end.date() : undefined,
        allDay: !parsed.start.isCertain('hour'),
      },
      labels: [],
      source: 'extracted',
    })
  }

  return suggestions
}
