import { supabase } from './supabase'

export type TaskList = {
  id: string
  user_id: string
  name: string
  color: string
  is_visible: boolean
  position: number
  created_at: string
  updated_at: string
}

export async function getTaskLists(userId: string): Promise<TaskList[]> {
  const { data, error } = await supabase
    .from('task_lists')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch task lists: ${error.message}`)
  }

  return data || []
}

export async function createTaskList(
  userId: string,
  name: string,
  color: string = '#3b82f6'
): Promise<TaskList> {
  const { data: existingLists } = await supabase
    .from('task_lists')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingLists && existingLists.length > 0
    ? existingLists[0].position + 1
    : 0

  const { data, error } = await supabase
    .from('task_lists')
    .insert({
      user_id: userId,
      name,
      color,
      position: nextPosition,
      is_visible: true
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create task list: ${error.message}`)
  }

  return data
}

export async function updateTaskList(
  listId: string,
  updates: Partial<Pick<TaskList, 'name' | 'color' | 'is_visible' | 'position'>>
): Promise<TaskList> {
  const { data, error } = await supabase
    .from('task_lists')
    .update(updates)
    .eq('id', listId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update task list: ${error.message}`)
  }

  return data
}

export async function deleteTaskList(listId: string): Promise<void> {
  const { error } = await supabase
    .from('task_lists')
    .delete()
    .eq('id', listId)

  if (error) {
    throw new Error(`Failed to delete task list: ${error.message}`)
  }
}

export async function toggleListVisibility(listId: string, isVisible: boolean): Promise<TaskList> {
  return updateTaskList(listId, { is_visible: isVisible })
}

export async function getTaskCountByList(userId: string, listId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('list_id', listId)
    .eq('is_completed', false)

  if (error) {
    throw new Error(`Failed to get task count: ${error.message}`)
  }

  return count || 0
}
