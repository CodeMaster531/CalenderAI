import { supabase } from './supabase'

export type UserPreferences = {
  id: string
  user_id: string
  dark_mode: boolean
  dense_mode: boolean
  show_overnight_hours: boolean
  created_at: string
  updated_at: string
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user preferences:', error)
    return null
  }

  return data
}

export async function saveUserPreferences(
  userId: string,
  preferences: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserPreferences | null> {
  const existingPrefs = await getUserPreferences(userId)

  if (existingPrefs) {
    const { data, error } = await supabase
      .from('user_preferences')
      .update(preferences)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user preferences:', error)
      return null
    }

    return data
  } else {
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        ...preferences
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating user preferences:', error)
      return null
    }

    return data
  }
}
