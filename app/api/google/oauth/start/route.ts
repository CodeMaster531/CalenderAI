import { NextResponse } from 'next/server'
import { getGoogleOAuthClient, buildScopesFromServices } from '@/lib/google-oauth'

type StartRequest = {
  userId: string
  services?: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartRequest
    if (!body?.userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const services = body.services?.length ? body.services : ['calendar']
    const scopes = buildScopesFromServices(services)
    if (!scopes.length) {
      return NextResponse.json({ error: 'Unable to determine scopes for requested services.' }, { status: 400 })
    }

    const oauth2Client = getGoogleOAuthClient()
    const statePayload = {
      userId: body.userId,
      services,
    }
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url')

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    })

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Failed to create Google auth URL', error)
    return NextResponse.json({ error: 'Failed to start Google OAuth flow' }, { status: 500 })
  }
}


