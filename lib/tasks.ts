import { supabase } from './supabase'
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from './calendar-events'

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export type Task = {
  id: string
  user_id: string
  list_id: string
  title: string
  notes: string
  due_date: string | null
  due_time: string | null
  is_completed: boolean
  is_starred: boolean
  position: number
  priority: TaskPriority
  estimated_hours: number | null
  progress: number
  goal: string | null
  location: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type TaskWithList = Task & {
  task_lists?: {
    name: string
    color: string
  }
}

export async function getTasks(
  userId: string,
  filters?: {
    listId?: string
    isStarred?: boolean
    isCompleted?: boolean
  }
): Promise<TaskWithList[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      task_lists (
        name,
        color
      )
    `)
    .eq('user_id', userId)

  if (filters?.listId) {
    query = query.eq('list_id', filters.listId)
  }

  if (filters?.isStarred !== undefined) {
    query = query.eq('is_starred', filters.isStarred)
  }

  if (filters?.isCompleted !== undefined) {
    query = query.eq('is_completed', filters.isCompleted)
  }

  const { data, error } = await query.order('position', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`)
  }

  return data || []
}

export async function createTask(
  userId: string,
  listId: string,
  title: string,
  options?: {
    notes?: string
    dueDate?: string
    dueTime?: string
    isStarred?: boolean
    priority?: TaskPriority
    goal?: string
    estimatedHours?: number | null
    progress?: number
    location?: string
    metadata?: Record<string, unknown>
    syncToCalendar?: boolean
  }
): Promise<Task> {
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingTasks && existingTasks.length > 0
    ? existingTasks[0].position + 1
    : 0

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      list_id: listId,
      title,
      notes: options?.notes || '',
      due_date: options?.dueDate || null,
      due_time: options?.dueTime || null,
      is_starred: options?.isStarred || false,
      position: nextPosition,
      is_completed: false,
      priority: options?.priority || 'medium',
      estimated_hours: options?.estimatedHours ?? null,
      progress: options?.progress ?? 0,
      goal: options?.goal || null,
      location: options?.location || null,
      metadata: options?.metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`)
  }

  const shouldSyncCalendar = options?.syncToCalendar ?? Boolean(options?.dueDate)

  if (shouldSyncCalendar && options?.dueDate && data) {
    try {
      const eventPriority = options?.priority || (options?.isStarred ? 'high' : 'medium')
      await createCalendarEvent({
        user_id: userId,
        title: `📋 ${title}`,
        description: options?.notes || undefined,
        event_date: options.dueDate,
        start_time: options?.dueTime || undefined,
        end_time: undefined,
        location: options?.location || undefined,
        category: 'other',
        priority: eventPriority,
        source: 'manual',
        source_id: data.id, // Link calendar event to task
        is_completed: false,
      })
    } catch (calendarError) {
      // Log error but don't fail task creation if calendar event creation fails
      console.error('Failed to create calendar event for task:', calendarError)
    }
  }

  return data
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'notes' | 'due_date' | 'due_time' | 'is_completed' | 'is_starred' | 'position' | 'priority' | 'estimated_hours' | 'progress' | 'goal' | 'location' | 'metadata'>>
): Promise<Task> {
  // Get current task to check if it has a calendar event
  const { data: currentTask } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`)
  }

  // Sync calendar event if task has/had a due date
  if (data && (currentTask?.due_date || updates.due_date)) {
    try {
      const starredState = updates.is_starred !== undefined ? updates.is_starred : data.is_starred
      const effectivePriority: TaskPriority =
        (updates.priority as TaskPriority | undefined) ||
        data.priority ||
        (starredState ? 'high' : 'medium')

      // Find calendar event linked to this task
      const { data: calendarEvents } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('source_id', taskId)
        .eq('source', 'manual')
        .limit(1)

      const calendarEventId = calendarEvents?.[0]?.id

      // If task has a due date, create or update calendar event
      if (updates.due_date || data.due_date) {
        const eventData = {
          user_id: data.user_id,
          title: `📋 ${updates.title || data.title}`,
          description: (updates.notes !== undefined ? updates.notes : data.notes) || undefined,
          event_date: updates.due_date || data.due_date!,
          start_time: updates.due_time !== undefined ? updates.due_time || undefined : data.due_time || undefined,
          end_time: undefined,
          location: updates.location !== undefined ? updates.location || undefined : data.location || undefined,
          category: 'other' as const,
          priority: effectivePriority,
          source: 'manual' as const,
          source_id: taskId,
          is_completed: updates.is_completed !== undefined ? updates.is_completed : data.is_completed,
        }

        if (calendarEventId) {
          // Update existing calendar event
          await updateCalendarEvent(calendarEventId, eventData)
        } else {
          // Create new calendar event
          await createCalendarEvent(eventData)
        }
      } else if (calendarEventId && !updates.due_date && !data.due_date) {
        // Task no longer has due date, delete calendar event
        await deleteCalendarEvent(calendarEventId)
      } else if (calendarEventId) {
        // Update existing calendar event with new task data
        await updateCalendarEvent(calendarEventId, {
          title: `📋 ${updates.title || data.title}`,
          description: (updates.notes !== undefined ? updates.notes : data.notes) || undefined,
          is_completed: updates.is_completed !== undefined ? updates.is_completed : data.is_completed,
          priority: effectivePriority,
          start_time: updates.due_time !== undefined ? updates.due_time || undefined : data.due_time || undefined,
          location: updates.location !== undefined ? updates.location || undefined : data.location || undefined,
        })
      }
    } catch (calendarError) {
      // Log error but don't fail task update if calendar event sync fails
      console.error('Failed to sync calendar event for task:', calendarError)
    }
  }

  return data
}

export async function deleteTask(taskId: string): Promise<void> {
  // Find and delete associated calendar event
  try {
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('source_id', taskId)
      .eq('source', 'manual')
      .limit(1)

    if (calendarEvents && calendarEvents.length > 0) {
      await deleteCalendarEvent(calendarEvents[0].id)
    }
  } catch (calendarError) {
    // Log error but don't fail task deletion if calendar event deletion fails
    console.error('Failed to delete calendar event for task:', calendarError)
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`)
  }
}

export async function toggleTaskComplete(taskId: string, isCompleted: boolean, progressPercent?: number): Promise<Task> {
  const computedProgress = progressPercent ?? (isCompleted ? 100 : 0)
  return updateTask(taskId, { is_completed: isCompleted, progress: computedProgress })
}

export async function toggleTaskStarred(taskId: string, isStarred: boolean): Promise<Task> {
  return updateTask(taskId, { is_starred: isStarred })
}

export function formatDueDate(dueDate: string | null, dueTime?: string | null): string | null {
  if (!dueDate) return null

  try {
    const isoString = dueTime ? `${dueDate}T${normalizeTime(dueTime)}` : dueDate
    const date = parseISO(isoString)
    const now = new Date()
    const sameDay = now.toDateString() === date.toDateString()
    const isOverdue = isPast(date) && !sameDay

    if (isOverdue) {
      return `Due ${formatDistanceToNow(date)} ago`
    }

    const relative = formatDistanceToNow(date, { addSuffix: true })
    const timeLabel = dueTime ? format(date, 'p') : null
    return timeLabel ? `Due ${relative} • ${timeLabel}` : `Due ${relative}`
  } catch {
    return null
  }
}

export function isTaskOverdue(dueDate: string | null, dueTime?: string | null): boolean {
  if (!dueDate) return false

  try {
    const isoString = dueTime ? `${dueDate}T${normalizeTime(dueTime)}` : dueDate
    const date = parseISO(isoString)
    return isPast(date) && new Date().toDateString() !== date.toDateString()
  } catch {
    return false
  }
}

function normalizeTime(timeValue: string): string {
  if (timeValue.length === 5) {
    return `${timeValue}:00`
  }
  return timeValue
}

export async function reorderTask(
  taskId: string,
  newPosition: number
): Promise<void> {
  await updateTask(taskId, { position: newPosition })
}
