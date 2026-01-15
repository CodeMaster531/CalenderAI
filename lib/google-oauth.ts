import { google } from 'googleapis'
import { getSupabaseAdminClient } from './supabase-admin'

const DEFAULT_REDIRECT = 'http://localhost:3000/api/google/oauth/callback'
const DEFAULT_CLIENT_ID = '752510863554-jbhevu9n9smqun98q0nse06ls23cpe8a.apps.googleusercontent.com'
const DEFAULT_CLIENT_SECRET = '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'

// Refresh token if it expires within this many minutes
const TOKEN_REFRESH_THRESHOLD_MINUTES = 5

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export const GOOGLE_SERVICE_SCOPES = {
  calendar: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  meet: [
    'https://www.googleapis.com/auth/calendar.events',
  ],
}

export function buildScopesFromServices(services: string[]): string[] {
  const scopeSet = new Set<string>()
  services.forEach((service) => {
    const scopes = GOOGLE_SERVICE_SCOPES[service as keyof typeof GOOGLE_SERVICE_SCOPES]
    if (scopes) {
      scopes.forEach((scope) => scopeSet.add(scope))
    }
  })
  return Array.from(scopeSet)
}

/**
 * Check if a token is expired or will expire soon
 */
export function isTokenExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const thresholdTime = new Date(now.getTime() + TOKEN_REFRESH_THRESHOLD_MINUTES * 60 * 1000)
  
  return expiryDate <= thresholdTime
}

/**
 * Refresh an access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expiry_date: number
}> {
  const oauth2Client = getGoogleOAuthClient()
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  
  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh access token: missing credentials')
  }

  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date,
  }
}

/**
 * Get a refreshed OAuth client for an integration, automatically refreshing the token if needed
 */
export async function getRefreshedOAuthClient(integration: {
  id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}): Promise<google.auth.OAuth2Client> {
  if (!integration.refresh_token) {
    throw new Error('Integration missing refresh token. Please reconnect.')
  }

  const oauth2Client = getGoogleOAuthClient()

  // Check if token needs refresh
  if (!integration.access_token || isTokenExpiringSoon(integration.token_expires_at)) {
    console.log(`Token expiring soon or missing for integration ${integration.id}, refreshing...`)
    
    try {
      const { access_token, expiry_date } = await refreshAccessToken(integration.refresh_token)
      
      // Update the database with new token
      const supabaseAdmin = getSupabaseAdminClient()
      await supabaseAdmin
        .from('google_integrations')
        .update({
          access_token: access_token,
          token_expires_at: new Date(expiry_date).toISOString(),
        })
        .eq('id', integration.id)

      // Set credentials with new token
      oauth2Client.setCredentials({
        access_token: access_token,
        refresh_token: integration.refresh_token,
        expiry_date: expiry_date,
      })
      
      console.log(`Token refreshed successfully for integration ${integration.id}`)
    } catch (error) {
      console.error('Failed to refresh token:', error)
      
      // Try to use existing token as fallback
      if (integration.access_token) {
        oauth2Client.setCredentials({
          access_token: integration.access_token,
          refresh_token: integration.refresh_token,
          expiry_date: integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : undefined,
        })
        console.log('Using existing token as fallback')
      } else {
        throw error
      }
    }
  } else {
    // Token is still valid, use existing credentials
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : undefined,
    })
  }

  return oauth2Client
}

/**
 * Proactively refresh a token for an integration if it's expiring soon
 * This can be called without making an API call to keep tokens fresh
 */
export async function refreshTokenIfNeeded(integration: {
  id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}): Promise<{ refreshed: boolean; error?: string }> {
  if (!integration.refresh_token) {
    return { refreshed: false, error: 'Integration missing refresh token' }
  }

  // Only refresh if token is expiring soon or missing
  if (!integration.access_token || isTokenExpiringSoon(integration.token_expires_at)) {
    try {
      const { access_token, expiry_date } = await refreshAccessToken(integration.refresh_token)
      
      // Update the database with new token
      const supabaseAdmin = getSupabaseAdminClient()
      await supabaseAdmin
        .from('google_integrations')
        .update({
          access_token: access_token,
          token_expires_at: new Date(expiry_date).toISOString(),
        })
        .eq('id', integration.id)

      console.log(`Token proactively refreshed for integration ${integration.id}`)
      return { refreshed: true }
    } catch (error) {
      console.error('Failed to proactively refresh token:', error)
      return { refreshed: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  return { refreshed: false } // Token is still valid, no refresh needed
}


