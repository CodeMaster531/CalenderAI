import { NextRequest, NextResponse } from 'next/server'
import { getGoogleOAuthClient } from '@/lib/google-oauth'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'

function renderCloseWindow(message: string, isSuccess = true) {
  const type = isSuccess ? 'google-integration-success' : 'google-integration-error'
  return `
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: '${type}', message: '${message}' }, '*');
          }
          window.close();
        </script>
        <p>${message}. You can close this window.</p>
      </body>
    </html>
  `
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const code = search.get('code')
  const state = search.get('state')
  const errorParam = search.get('error')

  if (errorParam) {
    return new NextResponse(renderCloseWindow(`Google OAuth error: ${errorParam}`, false), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (!code || !state) {
    return new NextResponse(renderCloseWindow('Missing OAuth parameters', false), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      userId: string
      services: string[]
    }

    if (!parsedState?.userId) {
      return new NextResponse(renderCloseWindow('Invalid OAuth state payload', false), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const oauth2Client = getGoogleOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    const supabaseAdmin = getSupabaseAdminClient()

    await supabaseAdmin
      .from('google_integrations')
      .upsert({
        user_id: parsedState.userId,
        provider: 'google',
        services: parsedState.services,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        status: 'connected',
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        last_synced_at: new Date().toISOString(),
        metadata: {
          token_type: tokens.token_type,
          id_token: tokens.id_token ? 'stored' : null,
        },
      }, { onConflict: 'user_id,provider' })
      .select()
      .single()

    return new NextResponse(renderCloseWindow('Google account connected'), {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Failed to complete Google OAuth callback', error)
    return new NextResponse(renderCloseWindow('Failed to connect Google account', false), {
      headers: { 'Content-Type': 'text/html' },
    })
  }
}


