export type ParsedInput = {
  type: 'task' | 'event' | 'goal'
  title: string
  description?: string
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  endTime?: string // HH:MM
  dueDate?: string // YYYY-MM-DD for tasks
  priority?: 'critical' | 'high' | 'medium' | 'low'
  category?: string
  location?: string
  goal?: string
  estimatedHours?: number
  confidence: number
}

export async function parseNaturalLanguageInput(input: string): Promise<ParsedInput> {
  // Call our API route which handles OpenAI server-side (keeps API key secure)
  const response = await fetch('/api/ai-parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to parse input')
  }

  const parsed: ParsedInput = await response.json()
  return parsed
}

