import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type UserProfile = {
  user_id: string
  full_name?: string | null
  avatar_url?: string | null
  phone_number?: string | null
  email_digest_frequency?: 'daily' | 'weekly' | 'off' | null
  onboarding_complete: boolean
  last_sign_in?: string | null
  created_at: string
  updated_at: string
}

export async function upsertUserProfile(user: User) {
  // Check if profile already exists to preserve existing values
  const existingProfile = await getUserProfile(user.id).catch(() => null)
  
  if (existingProfile) {
    // Profile exists - only update last_sign_in to preserve existing data
    const { error } = await supabase
      .from('user_profiles')
      .update({ last_sign_in: new Date().toISOString() })
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to update user profile last_sign_in', error)
      throw error
    }
  } else {
    // Profile doesn't exist - create new profile with defaults
  const payload = {
    user_id: user.id,
    full_name: (user.user_metadata as Record<string, any>)?.full_name ?? user.email,
    avatar_url: (user.user_metadata as Record<string, any>)?.avatar_url ?? null,
      phone_number: (user.user_metadata as Record<string, any>)?.phone_number ?? null,
    onboarding_complete: false,
    last_sign_in: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_profiles')
      .insert(payload)

    if (error) {
      console.error('Failed to create user profile', error)
      throw error
    }
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to get user profile', error)
    throw error
  }

  return data
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url' | 'phone_number' | 'email_digest_frequency' | 'onboarding_complete'>>
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update user profile', error)
    throw error
  }

  return data
}

export async function getUserByPhoneNumber(phoneNumber: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('phone_number', phoneNumber)
    .maybeSingle()

  if (error) {
    console.error('Failed to get user by phone number', error)
    throw error
  }

  return data
}
