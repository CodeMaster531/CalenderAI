/**
 * SMS Response Generator
 * Generates human-readable SMS responses based on actions executed
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns'

interface ActionResult {
  action: string
  success: boolean
  result?: any
  error?: string
}

interface GenerateResponseOptions {
  originalMessage: string
  actions: any[]
  results: ActionResult[]
  userId: string
}

/**
 * Generate SMS response message based on actions executed
 */
export function generateSMSResponse(options: GenerateResponseOptions): string {
  const { originalMessage, actions, results } = options

  // Handle query/list commands
  if (actions.length > 0 && (actions[0].type === 'list_tasks' || actions[0].type === 'list_events')) {
    return generateListResponse(results)
  }

  // Handle create/update/delete commands
  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  if (failureCount > 0 && successCount === 0) {
    // All failed
    return `❌ Couldn't process your request. ${results[0]?.error || 'Please try again with a clearer message.'}`
  }

  if (failureCount > 0) {
    // Partial success
    const successMsg = generateSuccessResponse(results.filter(r => r.success))
    return `${successMsg}\n\n⚠️ Some actions failed. ${results.find(r => !r.success)?.error || 'Please check the app.'}`
  }

  // All succeeded
  return generateSuccessResponse(results)
}

/**
 * Generate response for successful actions
 */
function generateSuccessResponse(results: ActionResult[]): string {
  if (results.length === 0) {
    return '✅ Done!'
  }

  const messages: string[] = []

  for (const result of results) {
    if (!result.success) continue

    switch (result.action) {
      case 'create_task':
        messages.push(formatTaskCreated(result.result))
        break
      case 'create_event':
        messages.push(formatEventCreated(result.result))
        break
      case 'update_task':
        messages.push(`✅ Updated task: ${result.result?.title || 'Task updated'}`)
        break
      case 'update_event':
        messages.push(`✅ Updated event: ${result.result?.title || 'Event updated'}`)
        break
      case 'delete_task':
        messages.push('✅ Task deleted')
        break
      case 'delete_event':
        messages.push('✅ Event deleted')
        break
    }
  }

  if (messages.length === 0) {
    return '✅ Done!'
  }

  return messages.join('\n')
}

/**
 * Format task creation response
 */
function formatTaskCreated(task: any): string {
  if (!task) return '✅ Task created'

  let message = `✅ Task: ${task.title || 'Untitled'}`

  if (task.due_date) {
    const dueDate = formatDateForSMS(task.due_date, task.due_time)
    message += `\n📅 Due: ${dueDate}`
  }

  if (task.priority && task.priority !== 'medium') {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      low: '🟢',
    }[task.priority] || ''
    message += `\n${priorityEmoji} Priority: ${task.priority}`
  }

  return message
}

/**
 * Format event creation response
 */
function formatEventCreated(event: any): string {
  if (!event) return '✅ Event created'

  let message = `✅ Event: ${event.title || 'Untitled'}`

  if (event.event_date) {
    const eventDate = formatDateForSMS(event.event_date, event.start_time)
    message += `\n📅 ${eventDate}`
  }

  if (event.location) {
    message += `\n📍 ${event.location}`
  }

  if (event.priority && event.priority !== 'medium') {
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      low: '🟢',
    }[event.priority] || ''
    message += `\n${priorityEmoji} Priority: ${event.priority}`
  }

  return message
}

/**
 * Generate response for list/query commands
 */
function generateListResponse(results: ActionResult[]): string {
  if (results.length === 0 || !results[0].result) {
    return '📋 No items found.'
  }

  const result = results[0].result

  if (result.type === 'tasks') {
    return formatTasksList(result.tasks || [])
  } else if (result.type === 'events') {
    return formatEventsList(result.events || [])
  }

  return '📋 Here are your items (check the app for details).'
}

/**
 * Format tasks list for SMS
 */
function formatTasksList(tasks: any[]): string {
  if (tasks.length === 0) {
    return '📋 You have no tasks.'
  }

  if (tasks.length === 1) {
    const task = tasks[0]
    let message = `📋 Task: ${task.title}`
    if (task.due_date) {
      message += `\n📅 ${formatDateForSMS(task.due_date, task.due_time)}`
    }
    if (task.is_completed) {
      message += '\n✅ Completed'
    }
    return message
  }

  let message = `📋 You have ${tasks.length} tasks:\n\n`
  const displayTasks = tasks.slice(0, 5) // Limit to 5 tasks for SMS

  for (let i = 0; i < displayTasks.length; i++) {
    const task = displayTasks[i]
    const status = task.is_completed ? '✅' : '⏳'
    let line = `${i + 1}. ${status} ${task.title}`
    
    if (task.due_date) {
      line += ` (${formatDateForSMS(task.due_date, task.due_time, true)})`
    }
    
    message += line + '\n'
  }

  if (tasks.length > 5) {
    message += `\n...and ${tasks.length - 5} more (check the app)`
  }

  return message.trim()
}

/**
 * Format events list for SMS
 */
function formatEventsList(events: any[]): string {
  if (events.length === 0) {
    return '📅 You have no upcoming events.'
  }

  if (events.length === 1) {
    const event = events[0]
    let message = `📅 Event: ${event.title}`
    if (event.event_date) {
      message += `\n📅 ${formatDateForSMS(event.event_date, event.start_time)}`
    }
    if (event.location) {
      message += `\n📍 ${event.location}`
    }
    return message
  }

  let message = `📅 You have ${events.length} upcoming events:\n\n`
  const displayEvents = events.slice(0, 5) // Limit to 5 events for SMS

  for (let i = 0; i < displayEvents.length; i++) {
    const event = displayEvents[i]
    let line = `${i + 1}. 📅 ${event.title}`
    
    if (event.event_date) {
      line += ` (${formatDateForSMS(event.event_date, event.start_time, true)})`
    }
    
    if (event.location) {
      line += `\n   📍 ${event.location}`
    }
    
    message += line + '\n'
  }

  if (events.length > 5) {
    message += `\n...and ${events.length - 5} more (check the app)`
  }

  return message.trim()
}

/**
 * Format date for SMS (compact format)
 */
function formatDateForSMS(date: string, time?: string | null, compact: boolean = false): string {
  try {
    const dateStr = time ? `${date}T${time}` : date
    const dateObj = parseISO(dateStr)
    const now = new Date()

    // Check if it's today
    if (dateObj.toDateString() === now.toDateString()) {
      if (time) {
        return compact ? 'Today' : `Today at ${format(dateObj, 'h:mm a')}`
      }
      return 'Today'
    }

    // Check if it's tomorrow
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateObj.toDateString() === tomorrow.toDateString()) {
      if (time) {
        return compact ? 'Tomorrow' : `Tomorrow at ${format(dateObj, 'h:mm a')}`
      }
      return 'Tomorrow'
    }

    // Relative format for dates within 7 days
    const daysDiff = Math.ceil((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 0 && daysDiff <= 7) {
      if (time) {
        return compact 
          ? format(dateObj, 'EEE')
          : `${format(dateObj, 'EEE, MMM d')} at ${format(dateObj, 'h:mm a')}`
      }
      return compact ? format(dateObj, 'EEE') : format(dateObj, 'EEE, MMM d')
    }

    // Full format for dates further out
    if (time) {
      return compact
        ? format(dateObj, 'MMM d')
        : `${format(dateObj, 'MMM d, yyyy')} at ${format(dateObj, 'h:mm a')}`
    }
    return compact ? format(dateObj, 'MMM d') : format(dateObj, 'MMM d, yyyy')
  } catch {
    return date
  }
}
