/**
 * Email Service for Sending Reminders and Digests
 * Uses Resend for email delivery
 */

import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resendApiKey = process.env.RESEND_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const resend = resendApiKey ? new Resend(resendApiKey) : null
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export type EmailDigestFrequency = 'daily' | 'weekly' | 'off'

export interface UpcomingEvent {
  id: string
  title: string
  description?: string | null
  event_date: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  category: string
  priority: string
}

export interface UpcomingTask {
  id: string
  title: string
  notes?: string | null
  due_date: string
  due_time?: string | null
  priority: string
  list_name?: string
}

/**
 * Send email digest to user
 */
export async function sendEmailDigest(
  userEmail: string,
  userName: string | null,
  events: UpcomingEvent[],
  tasks: UpcomingTask[],
  frequency: EmailDigestFrequency
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.error('[EMAIL SERVICE] Resend API key not configured')
    return { success: false, error: 'Email service not configured' }
  }

  const greeting = userName || 'there'
  const frequencyText = frequency === 'daily' ? 'Daily' : 'Weekly'
  
  // Format events
  const eventsHtml = events.length > 0
    ? events.map(event => {
        const date = new Date(event.event_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const time = event.start_time
          ? new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            })
          : 'All day'
        const location = event.location ? `📍 ${event.location}` : ''
        
        return `
          <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #3b82f6;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${event.title}</div>
            <div style="font-size: 14px; color: #6b7280;">
              📅 ${date} at ${time} ${location}
            </div>
            ${event.description ? `<div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">${event.description}</div>` : ''}
          </div>
        `
      }).join('')
    : '<p style="color: #9ca3af;">No upcoming events</p>'

  // Format tasks
  const tasksHtml = tasks.length > 0
    ? tasks.map(task => {
        const date = new Date(task.due_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        const time = task.due_time
          ? new Date(`2000-01-01T${task.due_time}`).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            })
          : ''
        const dueText = time ? `${date} at ${time}` : date
        
        return `
          <div style="margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #10b981;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${task.title}</div>
            <div style="font-size: 14px; color: #6b7280;">
              ⏰ Due: ${dueText}
            </div>
            ${task.notes ? `<div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">${task.notes}</div>` : ''}
          </div>
        `
      }).join('')
    : '<p style="color: #9ca3af;">No upcoming tasks</p>'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📅 ${frequencyText} Calendar Digest</h1>
        </div>
        
        <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 24px;">Hi ${greeting},</p>
          <p style="color: #6b7280; margin-bottom: 32px;">Here's what's coming up in your calendar:</p>
          
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 18px; color: #111827; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
              📆 Upcoming Events (${events.length})
            </h2>
            ${eventsHtml}
          </div>
          
          <div style="margin-bottom: 32px;">
            <h2 style="font-size: 18px; color: #111827; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
              ✅ Upcoming Tasks (${tasks.length})
            </h2>
            ${tasksHtml}
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Open Calendar
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px;">
          <p>You're receiving this because you have email reminders enabled.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" style="color: #667eea;">Manage preferences</a></p>
        </div>
      </body>
    </html>
  `

  const text = `
${frequencyText} Calendar Digest

Hi ${greeting},

Here's what's coming up in your calendar:

Upcoming Events (${events.length}):
${events.map(e => `- ${e.title} on ${new Date(e.event_date).toLocaleDateString()}${e.start_time ? ` at ${e.start_time}` : ''}`).join('\n')}

Upcoming Tasks (${tasks.length}):
${tasks.map(t => `- ${t.title} due ${new Date(t.due_date).toLocaleDateString()}${t.due_time ? ` at ${t.due_time}` : ''}`).join('\n')}

Open your calendar: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
  `.trim()

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev'
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `${frequencyText} Digest: ${events.length} events, ${tasks.length} tasks`,
      html,
      text,
    })

    if (error) {
      console.error('[EMAIL SERVICE] Failed to send email:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get users who should receive email digests
 */
export async function getUsersForEmailDigest(
  frequency: EmailDigestFrequency
): Promise<Array<{ user_id: string; email: string; full_name: string | null }>> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id, full_name, email_digest_frequency')
    .eq('email_digest_frequency', frequency)

  if (error) {
    console.error('[EMAIL SERVICE] Failed to fetch users:', error)
    return []
  }

  // Get email addresses from auth.users
  const userIds = data?.map(u => u.user_id) || []
  if (userIds.length === 0) return []

  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

  if (authError) {
    console.error('[EMAIL SERVICE] Failed to fetch auth users:', authError)
    return []
  }

  return authUsers.users
    .filter(u => userIds.includes(u.id))
    .map(u => ({
      user_id: u.id,
      email: u.email!,
      full_name: data.find(p => p.user_id === u.id)?.full_name || null
    }))
}
