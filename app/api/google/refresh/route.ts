import { NextResponse } from 'next/server'
import { refreshTokenIfNeeded } from '@/lib/google-oauth'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'

type RefreshRequest = {
  integrationId?: string
  userId?: string
}

/**
 * Proactively refresh Google OAuth tokens before they expire
 * Can refresh a specific integration or all integrations for a user
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefreshRequest
    const supabaseAdmin = getSupabaseAdminClient()

    let integrations

    if (body.integrationId) {
      // Refresh specific integration
      const { data, error } = await supabaseAdmin
        .from('google_integrations')
        .select('*')
        .eq('id', body.integrationId)
        .eq('status', 'connected')
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
      }

      integrations = [data]
    } else if (body.userId) {
      // Refresh all integrations for a user
      const { data, error } = await supabaseAdmin
        .from('google_integrations')
        .select('*')
        .eq('user_id', body.userId)
        .eq('status', 'connected')

      if (error) {
        return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 })
      }

      integrations = data || []
    } else {
      return NextResponse.json({ error: 'integrationId or userId is required' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      integrations.map((integration) => refreshTokenIfNeeded(integration))
    )

    const refreshed = results.filter((r) => r.status === 'fulfilled' && r.value.refreshed).length
    const errors = results
      .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
      .map((r) => {
        if (r.status === 'rejected') return r.reason?.message || 'Unknown error'
        return r.value.error
      })

    return NextResponse.json({
      refreshed,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Failed to refresh tokens', error)
    return NextResponse.json({ error: 'Failed to refresh tokens' }, { status: 500 })
  }
}



