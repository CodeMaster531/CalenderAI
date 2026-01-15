/**
 * AI Bot Processor
 * Processes natural language messages from SMS and converts them into actionable commands
 */

interface AIAction {
  type: 'create_task' | 'create_event' | 'update_task' | 'update_event' | 'delete_task' | 'delete_event' | 'list_tasks' | 'list_events'
  data?: any
  id?: string
  confidence: number
}

interface ParsedDate {
  date: string // YYYY-MM-DD
  time?: string // HH:MM:SS
  isRelative?: boolean // true if "tomorrow", "next week", etc.
}

/**
 * Main function to process AI commands from SMS
 */
export async function processAICommand(userId: string, message: string): Promise<AIAction[]> {
  const normalizedMessage = message.toLowerCase().trim()
  const actions: AIAction[] = []

  // Extract command type
  const commandPattern = /^(add|create|new|remind|schedule|update|change|delete|remove|list|show|get)\s+(.*)$/i
  const match = message.match(commandPattern)
  
  if (!match) {
    // Try to infer intent from keywords
    return inferIntent(userId, normalizedMessage)
  }

  const [, verb, rest] = match

  switch (verb.toLowerCase()) {
    case 'add':
    case 'create':
    case 'new':
    case 'remind':
    case 'schedule':
      actions.push(...parseCreateCommand(rest))
      break
    case 'update':
    case 'change':
      actions.push(...parseUpdateCommand(rest))
      break
    case 'delete':
    case 'remove':
      actions.push(...parseDeleteCommand(rest))
      break
    case 'list':
    case 'show':
    case 'get':
      actions.push(...parseListCommand(rest))
      break
    default:
      return inferIntent(userId, normalizedMessage)
  }

  return actions
}

/**
 * Parse create commands (add task, create event, etc.)
 */
function parseCreateCommand(text: string): AIAction[] {
  const actions: AIAction[] = []
  
  // Detect if it's a task or event
  const isEvent = /(meeting|appointment|call|conference|event|deadline|exam|test)/i.test(text)
  const isTask = /(task|todo|do|remember|remind)/i.test(text)
  
  // Extract title
  const titleMatch = text.match(/(?:to|about|for)\s+(.+?)(?:\s+(?:on|at|due|by|for)\s+|$)/i)
  const title = titleMatch ? titleMatch[1].trim() : text.split(/on|at|due|by|for/i)[0].trim()
  
  // Extract date/time
  const dateInfo = extractDate(text)
  
  // Extract priority
  const priority = extractPriority(text)
  
  // Extract category
  const category = extractCategory(text)
  
  if (isEvent || /calendar|schedule/i.test(text)) {
    actions.push({
      type: 'create_event',
      data: {
        title: title || text,
        event_date: dateInfo.date || new Date().toISOString().split('T')[0],
        start_time: dateInfo.time || null,
        category: category || 'other',
        priority: priority || 'medium',
      },
      confidence: 0.8,
    })
  } else {
    actions.push({
      type: 'create_task',
      data: {
        title: title || text,
        due_date: dateInfo.date || null,
        priority: priority || 'medium',
      },
      confidence: 0.8,
    })
  }
  
  return actions
}

/**
 * Parse update commands
 */
function parseUpdateCommand(text: string): AIAction[] {
  // This would require more complex NLP - simplified for now
  return [{
    type: 'list_tasks',
    confidence: 0.5,
  }]
}

/**
 * Parse delete commands
 */
function parseDeleteCommand(text: string): AIAction[] {
  // Simplified - would need task/event matching
  return []
}

/**
 * Parse list commands
 */
function parseListCommand(text: string): AIAction[] {
  if (/task|todo/i.test(text)) {
    return [{
      type: 'list_tasks',
      confidence: 0.9,
    }]
  } else if (/event|meeting|calendar/i.test(text)) {
    return [{
      type: 'list_events',
      confidence: 0.9,
    }]
  }
  return []
}

/**
 * Infer intent from keywords when no clear command structure
 */
function inferIntent(userId: string, text: string): AIAction[] {
  const actions: AIAction[] = []
  
  // Common patterns
  if (/(?:remind|remember)\s+me\s+(?:to|about)/i.test(text)) {
    const taskText = text.replace(/(?:remind|remember)\s+me\s+(?:to|about)\s+/i, '')
    const dateInfo = extractDate(taskText)
    
    actions.push({
      type: 'create_task',
      data: {
        title: taskText.split(/on|at|due|by/i)[0].trim(),
        due_date: dateInfo.date || null,
        priority: extractPriority(taskText) || 'medium',
      },
      confidence: 0.7,
    })
  } else if (/\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|(?:tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(text)) {
    // Has date information, likely a task or event
    const dateInfo = extractDate(text)
    const title = text.replace(/\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|(?:tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '').trim()
    
    if (title) {
      actions.push({
        type: 'create_task',
        data: {
          title,
          due_date: dateInfo.date || null,
          priority: extractPriority(text) || 'medium',
        },
        confidence: 0.6,
      })
    }
  } else {
    // Default: create task with the entire message as title
    actions.push({
      type: 'create_task',
      data: {
        title: text,
        priority: extractPriority(text) || 'medium',
      },
      confidence: 0.5,
    })
  }
  
  return actions
}

/**
 * Extract date from text using simple patterns
 */
function extractDate(text: string): ParsedDate {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // Relative dates
  if (/\btomorrow\b/i.test(text)) {
    return {
      date: tomorrow.toISOString().split('T')[0],
      isRelative: true,
    }
  }
  
  if (/\btoday\b/i.test(text)) {
    return {
      date: today.toISOString().split('T')[0],
      isRelative: true,
    }
  }
  
  // Day names
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
  }
  
  for (const [day, dayIndex] of Object.entries(dayMap)) {
    if (new RegExp(`\\b${day}\\b`, 'i').test(text)) {
      const daysUntil = (dayIndex - today.getDay() + 7) % 7 || 7
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + daysUntil)
      return {
        date: targetDate.toISOString().split('T')[0],
        isRelative: true,
      }
    }
  }
  
  // MM/DD or MM-DD format
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateMatch) {
    const [, month, day, year] = dateMatch
    const yearValue = year ? (year.length === 2 ? `20${year}` : year) : today.getFullYear().toString()
    const dateStr = `${yearValue}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    
    // Validate date
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return {
        date: dateStr,
        isRelative: false,
      }
    }
  }
  
  // Time extraction (simplified)
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(?:am|pm)?\b/i)
  if (timeMatch) {
    let [, hour, minute] = timeMatch
    let hourNum = parseInt(hour)
    const isPM = /pm/i.test(text)
    
    if (isPM && hourNum !== 12) hourNum += 12
    if (!isPM && hourNum === 12) hourNum = 0
    
    return {
      date: today.toISOString().split('T')[0],
      time: `${hourNum.toString().padStart(2, '0')}:${minute}:00`,
      isRelative: true,
    }
  }
  
  return {
    date: today.toISOString().split('T')[0],
    isRelative: false,
  }
}

/**
 * Extract priority from text
 */
function extractPriority(text: string): 'critical' | 'high' | 'medium' | 'low' {
  if (/\b(urgent|critical|asap|emergency|important!)\b/i.test(text)) {
    return 'critical'
  }
  if (/\b(important|high|priority)\b/i.test(text)) {
    return 'high'
  }
  if (/\b(low|optional|whenever)\b/i.test(text)) {
    return 'low'
  }
  return 'medium'
}

/**
 * Extract category from text
 */
function extractCategory(text: string): 'assignment' | 'exam' | 'meeting' | 'deadline' | 'milestone' | 'other' {
  if (/\b(assignment|homework|project)\b/i.test(text)) {
    return 'assignment'
  }
  if (/\b(exam|test|quiz|midterm|final)\b/i.test(text)) {
    return 'exam'
  }
  if (/\b(meeting|call|conference|appointment)\b/i.test(text)) {
    return 'meeting'
  }
  if (/\b(deadline|due|submit)\b/i.test(text)) {
    return 'deadline'
  }
  if (/\b(milestone|launch|release)\b/i.test(text)) {
    return 'milestone'
  }
  return 'other'
}
