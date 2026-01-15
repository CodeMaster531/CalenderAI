import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isBrowser = typeof window !== 'undefined'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: true,
    detectSessionInUrl: isBrowser,
  },
})

export type Document = {
  id: string
  user_id: string
  name: string
  file_type: string
  file_size: number
  storage_path: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  extracted_text?: string
  processing_time?: number
  error_message?: string
  created_at: string
  updated_at: string
}

export type ExtractedEvent = {
  id: string
  document_id: string
  user_id: string
  title: string
  description?: string
  event_date: string
  start_time?: string
  end_time?: string
  location?: string
  category: 'assignment' | 'exam' | 'meeting' | 'deadline' | 'milestone' | 'other'
  priority: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  is_imported: boolean
  metadata?: {
    date_text?: string
    normalized_date?: string
    normalized_end_date?: string
    line_number?: number
    day_of_week?: string
    recurrence_pattern?: string
    is_range_with_day?: boolean
    is_expanded_from_range?: boolean
    [key: string]: any
  }
  created_at: string
  updated_at: string
}
