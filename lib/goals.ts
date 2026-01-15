import { supabase } from './supabase'

export type GoalCategory = 'work' | 'personal' | 'health' | 'learning'
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low'

export type Goal = {
  id: string
  user_id: string
  title: string
  description: string
  category: GoalCategory
  priority: GoalPriority
  progress: number
  target_date: string | null
  created_at: string
  updated_at: string
}

export type GoalTask = {
  id: string
  goal_id: string
  title: string
  completed: boolean
  priority: GoalPriority
  due_date: string | null
  estimated_hours: number | null
  position: number
  created_at: string
  updated_at: string
}

export type GoalWithTasks = Goal & {
  tasks: GoalTask[]
}

export async function getGoals(userId: string): Promise<GoalWithTasks[]> {
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (goalsError) {
    throw new Error(`Failed to fetch goals: ${goalsError.message}`)
  }

  if (!goals || goals.length === 0) {
    return []
  }

  const goalIds = goals.map((g) => g.id)
  const { data: tasks, error: tasksError } = await supabase
    .from('goal_tasks')
    .select('*')
    .in('goal_id', goalIds)
    .order('position', { ascending: true })

  if (tasksError) {
    throw new Error(`Failed to fetch goal tasks: ${tasksError.message}`)
  }

  const tasksByGoalId = (tasks || []).reduce<Record<string, GoalTask[]>>((acc, task) => {
    if (!acc[task.goal_id]) {
      acc[task.goal_id] = []
    }
    acc[task.goal_id].push(task)
    return acc
  }, {})

  return goals.map((goal) => ({
    ...goal,
    tasks: tasksByGoalId[goal.id] || [],
  }))
}

export async function createGoal(
  userId: string,
  goal: {
    title: string
    description?: string
    category?: GoalCategory
    priority?: GoalPriority
    target_date?: string | null
  }
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      title: goal.title,
      description: goal.description || '',
      category: goal.category || 'personal',
      priority: goal.priority || 'medium',
      progress: 0,
      target_date: goal.target_date || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create goal: ${error.message}`)
  }

  return data
}

export async function updateGoal(
  goalId: string,
  updates: Partial<Pick<Goal, 'title' | 'description' | 'category' | 'priority' | 'progress' | 'target_date'>>
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update goal: ${error.message}`)
  }

  return data
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', goalId)

  if (error) {
    throw new Error(`Failed to delete goal: ${error.message}`)
  }
}

export async function createGoalTask(
  goalId: string,
  task: {
    title: string
    priority?: GoalPriority
    due_date?: string | null
    estimated_hours?: number | null
  }
): Promise<GoalTask> {
  // Get max position for this goal
  const { data: existingTasks } = await supabase
    .from('goal_tasks')
    .select('position')
    .eq('goal_id', goalId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingTasks && existingTasks.length > 0 ? existingTasks[0].position + 1 : 0

  const { data, error } = await supabase
    .from('goal_tasks')
    .insert({
      goal_id: goalId,
      title: task.title,
      completed: false,
      priority: task.priority || 'medium',
      due_date: task.due_date || null,
      estimated_hours: task.estimated_hours || null,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create goal task: ${error.message}`)
  }

  // Update goal progress based on completed tasks
  await updateGoalProgress(goalId)

  return data
}

export async function updateGoalTask(
  taskId: string,
  updates: Partial<Pick<GoalTask, 'title' | 'completed' | 'priority' | 'due_date' | 'estimated_hours'>>
): Promise<GoalTask> {
  const { data, error } = await supabase
    .from('goal_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update goal task: ${error.message}`)
  }

  // Update goal progress if task completion changed
  if (updates.completed !== undefined) {
    const { data: task } = await supabase.from('goal_tasks').select('goal_id').eq('id', taskId).single()
    if (task) {
      await updateGoalProgress(task.goal_id)
    }
  }

  return data
}

export async function deleteGoalTask(taskId: string): Promise<void> {
  // Get goal_id before deleting
  const { data: task } = await supabase.from('goal_tasks').select('goal_id').eq('id', taskId).single()

  const { error } = await supabase.from('goal_tasks').delete().eq('id', taskId)

  if (error) {
    throw new Error(`Failed to delete goal task: ${error.message}`)
  }

  // Update goal progress after task deletion
  if (task) {
    await updateGoalProgress(task.goal_id)
  }
}

async function updateGoalProgress(goalId: string): Promise<void> {
  const { data: tasks } = await supabase.from('goal_tasks').select('completed').eq('goal_id', goalId)

  if (!tasks || tasks.length === 0) {
    await updateGoal(goalId, { progress: 0 })
    return
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const progress = Math.round((completedCount / tasks.length) * 100)

  await updateGoal(goalId, { progress })
}






