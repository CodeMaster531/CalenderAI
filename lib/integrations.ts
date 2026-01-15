import { supabase } from './supabase'

export type GoogleIntegrationRecord = {
  id: string
  user_id: string
  provider: string
  services: string[]
  scopes: string[]
  status: 'pending' | 'connected' | 'error' | 'disconnected'
  last_synced_at: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export async function getGoogleIntegrations(): Promise<GoogleIntegrationRecord[]> {
  const { data, error } = await supabase
    .from('google_integrations')
    .select('*')
    .eq('provider', 'google')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load integrations: ${error.message}`)
  }

  return data || []
}

export async function deleteIntegration(id: string): Promise<void> {
  const { error } = await supabase.from('google_integrations').delete().eq('id', id)
  if (error) {
    throw new Error(`Failed to disconnect integration: ${error.message}`)
  }
}


