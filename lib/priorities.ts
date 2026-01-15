import { getTasks, isTaskOverdue, type TaskWithList, type TaskPriority } from './tasks'

export type PriorityFilter = 'all' | TaskPriority

export type PriorityStats = {
  total: number
  completed: number
  overdue: number
  critical: number
  high: number
  medium: number
  low: number
}

export type PriorityTask = TaskWithList & {
  priority: TaskPriority
  estimated_hours: number | null
  progress: number
}

export async function getPrioritySnapshot(userId: string): Promise<{ tasks: PriorityTask[]; stats: PriorityStats }> {
  const tasks = await getTasks(userId)
  const normalizedTasks = tasks.map(normalizePriorityTask)
  return {
    tasks: normalizedTasks,
    stats: computePriorityStats(normalizedTasks),
  }
}

export async function getPriorityTasks(
  userId: string,
  options?: {
    priority?: PriorityFilter
    includeCompleted?: boolean
  }
): Promise<PriorityTask[]> {
  const tasks = (await getTasks(userId)).map(normalizePriorityTask)
  let filtered = tasks

  if (options?.priority && options.priority !== 'all') {
    filtered = filtered.filter(task => task.priority === options.priority)
  }

  if (!options?.includeCompleted) {
    filtered = filtered.filter(task => !task.is_completed)
  }

  return filtered
}

export function computePriorityStats(tasks: PriorityTask[]): PriorityStats {
  const base: PriorityStats = {
    total: tasks.length,
    completed: 0,
    overdue: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  for (const task of tasks) {
    if (task.is_completed) {
      base.completed += 1
    }

    if (isTaskOverdue(task.due_date, task.due_time) && !task.is_completed) {
      base.overdue += 1
    }

    if (!task.is_completed) {
      // Ensure priority is valid before incrementing
      const priority = task.priority || 'medium'
      if (priority in base) {
        base[priority as TaskPriority] += 1
      }
    }
  }

  return base
}

export function sortPriorityTasks(tasks: PriorityTask[]): PriorityTask[] {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }

  return [...tasks].sort((a, b) => {
    // Ensure both priorities are valid before sorting
    const aPriority = a.priority || 'medium'
    const bPriority = b.priority || 'medium'
    
    if (aPriority === bPriority) {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    }
    return priorityOrder[bPriority] - priorityOrder[aPriority]
  })
}

export function normalizePriorityTask(task: TaskWithList): PriorityTask {
  const estimatedRaw = task.estimated_hours
  const estimated =
    typeof estimatedRaw === 'string' ? parseFloat(estimatedRaw) : estimatedRaw

  // Ensure priority is always valid - default to 'medium' if null/undefined/invalid
  const validPriorities: TaskPriority[] = ['critical', 'high', 'medium', 'low']
  const priority: TaskPriority = 
    task.priority && validPriorities.includes(task.priority as TaskPriority)
      ? (task.priority as TaskPriority)
      : 'medium'

  return {
    ...task,
    estimated_hours: Number.isFinite(estimated as number) ? (estimated as number) : null,
    progress: task.progress ?? (task.is_completed ? 100 : 0),
    priority,
  }
}

