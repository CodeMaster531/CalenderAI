import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhoneNumber } from '@/lib/phone-utils'
import { sendSMS } from '@/lib/sms-service'
import { generateSMSResponse } from '@/lib/sms-response-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Initialize Supabase with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface SMSMessage {
  from: string // Phone number sending the message
  to: string   // Phone number receiving the message
  body: string // Message content
  timestamp?: string
}

/**
 * Parse webhook payload from various sources (SMS providers, BlueBubbles, etc.)
 * Handles different payload formats and normalizes to SMSMessage format
 */
function parseWebhookPayload(rawBody: any): SMSMessage | null {
  // Log raw payload for debugging
  console.log('Raw webhook payload:', JSON.stringify(rawBody, null, 2))

  // Standard format: { from, to, body, timestamp? }
  if (rawBody.from && rawBody.body) {
    return {
      from: String(rawBody.from),
      to: rawBody.to ? String(rawBody.to) : '',
      body: String(rawBody.body),
      timestamp: rawBody.timestamp || rawBody.date || new Date().toISOString(),
    }
  }

  // BlueBubbles format (potential): { event, message: { text, from, to, date } }
  if (rawBody.message && rawBody.message.text) {
    const msg = rawBody.message
    return {
      from: msg.from ? String(msg.from) : msg.sender || '',
      to: msg.to ? String(msg.to) : msg.recipient || '',
      body: String(msg.text || msg.body || msg.content || ''),
      timestamp: msg.date || msg.timestamp || rawBody.timestamp || new Date().toISOString(),
    }
  }

  // Alternative format: { text, sender, recipient, date }
  if (rawBody.text && rawBody.sender) {
    return {
      from: String(rawBody.sender),
      to: rawBody.recipient ? String(rawBody.recipient) : '',
      body: String(rawBody.text),
      timestamp: rawBody.date || rawBody.timestamp || new Date().toISOString(),
    }
  }

  // If no recognized format, return null
  console.warn('Unrecognized webhook payload format:', rawBody)
  return null
}

/**
 * Webhook endpoint to receive SMS/iMessage messages from host server
 * Supports: SMS providers (Twilio, AWS SNS), BlueBubbles, and other webhook sources
 * This endpoint is called by the server at 8.30.153.160 when messages are received
 */
export async function POST(req: NextRequest) {
  try {
    // Verify request is from authorized server (optional but recommended)
    const serverIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''    
    // In production, you'd want stronger authentication (API key, etc.)
    // For now, we'll log and accept all requests
    
    const rawBody = await req.json()
    
    // Parse payload (handles different formats)
    const body = parseWebhookPayload(rawBody)
    
    if (!body) {
      console.error('Failed to parse webhook payload:', rawBody)
      return NextResponse.json(
        { 
          error: 'Invalid payload format',
          message: 'Expected format: { from, to, body, timestamp? } or BlueBubbles format',
          received: rawBody,
        },
        { status: 400 }
      )
    }
    
    console.log('Parsed webhook payload:', {
      from: body.from,
      to: body.to,
      body: body.body,
      timestamp: body.timestamp,
      serverIP,
    })

    // Normalize phone number for comparison
    const normalizedFrom = normalizePhoneNumber(body.from)
    
    // Find user by phone number (normalize database phone numbers for comparison)
    // Note: We fetch all profiles and compare normalized numbers because Supabase
    // doesn't support custom normalization in queries. For better performance with
    // many users, consider creating a database function.
    
    // Query all profiles (service role key should bypass RLS)
    // We'll filter for non-null phone numbers in JavaScript
    const { data: allProfiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, phone_number, full_name')
    
    console.log('Debug: Query result:', {
      count: allProfiles?.length || 0,
      error: profileError,
      hasServiceKey: !!supabaseServiceKey && supabaseServiceKey.length > 0,
      profiles: allProfiles,
    })
    
    if (profileError) {
      console.error('Error finding users by phone number:', profileError)
      console.error('Error details:', JSON.stringify(profileError, null, 2))
      return NextResponse.json(
        { error: 'Database error', details: profileError.message },
        { status: 500 }
      )
    }
    
    // Filter for profiles with phone numbers (in case query filter didn't work)
    const profiles = allProfiles?.filter(p => p.phone_number != null && p.phone_number.trim() !== '') || []
    
    console.log('Phone number query result:', {
      count: profiles?.length || 0,
      error: profileError,
      profiles: profiles,
    })
    
    if (profileError) {
      console.error('Error finding users by phone number:', profileError)
      console.error('Error details:', JSON.stringify(profileError, null, 2))
      return NextResponse.json(
        { error: 'Database error', details: profileError.message },
        { status: 500 }
      )
    }
    
    // Find matching profile by normalized phone number
    const profile = profiles?.find(p => 
      p.phone_number && normalizePhoneNumber(p.phone_number) === normalizedFrom
    )
    
    if (!profile) {
      console.log(`No user found for phone number: ${normalizedFrom} (original: ${body.from})`)
      console.log('Registered phone numbers:', profiles?.map(p => p.phone_number))
      console.log('Normalized registered numbers:', profiles?.map(p => p.phone_number ? normalizePhoneNumber(p.phone_number) : null))
      return NextResponse.json(
        { 
          error: 'User not found',
          message: 'Phone number not registered. Please add your phone number in Profile Settings.',
          received: body.from,
          normalized: normalizedFrom,
        },
        { status: 404 }
      )
    }

    // Process the message with AI bot
    const result = await processMessageWithAI(profile.user_id, body.body, body.from, body.to)

    // Send SMS response to user
    try {
      const responseMessage = generateSMSResponse({
        originalMessage: body.body,
        actions: result.actions,
        results: result.results,
        userId: profile.user_id,
      })

      // Send SMS reply (use 'to' from webhook as recipient, 'from' as sender)
      const smsResult = await sendSMS({
        to: body.from, // Reply to the sender
        message: responseMessage,
      })

      if (!smsResult.success) {
        console.warn('Failed to send SMS response:', smsResult.error)
        // Don't fail the webhook if SMS sending fails - log and continue
      }
    } catch (smsError) {
      console.error('Error sending SMS response:', smsError)
      // Don't fail the webhook if SMS sending fails - log and continue
    }

    return NextResponse.json({
      success: true,
      message: 'Message processed',
      userId: profile.user_id,
      result,
    })

  } catch (error) {
    console.error('Error processing SMS webhook:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Process message with AI bot and execute actions on the website
 */
async function processMessageWithAI(userId: string, message: string, phoneNumber: string, receivingNumber?: string) {
  try {
    // Import AI processing function
    const { processAICommand } = await import('@/lib/ai-bot-processor')
    
    // Process the message and get actions to execute
    const actions = await processAICommand(userId, message)
    
    // Execute actions (create tasks, events, update calendar, etc.)
    const results = await executeActions(userId, actions)
    
    // Log the interaction
    await logInteraction(userId, phoneNumber, message, actions, results)
    
    return {
      actionsExecuted: actions.length,
      actions,
      results,
    }
  } catch (error) {
    console.error('Error processing AI command:', error)
    throw error
  }
}

/**
 * Execute actions returned by AI bot
 */
async function executeActions(userId: string, actions: any[]) {
  const results = []
  
  for (const action of actions) {
    try {
      let result
      
      switch (action.type) {
        case 'create_task':
          result = await createTask(userId, action.data)
          break
        case 'create_event':
          result = await createCalendarEvent(userId, action.data)
          break
        case 'update_task':
          result = await updateTask(userId, action.id, action.data)
          break
        case 'update_event':
          result = await updateCalendarEvent(userId, action.id, action.data)
          break
        case 'delete_task':
          result = await deleteTask(userId, action.id)
          break
        case 'delete_event':
          result = await deleteCalendarEvent(userId, action.id)
          break
        case 'list_tasks':
          result = await listTasks(userId)
          break
        case 'list_events':
          result = await listEvents(userId)
          break
        default:
          result = { error: `Unknown action type: ${action.type}` }
      }
      
      results.push({
        action: action.type,
        success: !result.error,
        result,
      })
    } catch (error) {
      results.push({
        action: action.type,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  
  return results
}

/**
 * List tasks for user (using admin client)
 */
async function listTasks(userId: string) {
  try {
    // Get incomplete tasks using admin client
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsLast: true })
      .order('position', { ascending: true })
      .limit(10)

    if (error) throw error

    return {
      type: 'tasks',
      tasks: tasks || [],
      count: tasks?.length || 0,
    }
  } catch (error) {
    throw error
  }
}

/**
 * List upcoming events for user (using admin client)
 */
async function listEvents(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const endDate = nextMonth.toISOString().split('T')[0]

    const { data: events, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .gte('event_date', today)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsLast: true })
      .limit(10)

    if (error) throw error

    return {
      type: 'events',
      events: events || [],
      count: events?.length || 0,
    }
  } catch (error) {
    throw error
  }
}

// Helper functions for database operations
async function createTask(userId: string, taskData: any) {
  // Get or create default task list
  const { data: lists } = await supabaseAdmin
    .from('task_lists')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  
  const listId = lists?.[0]?.id
  if (!listId) {
    throw new Error('No task list found. Please create a task list first.')
  }

  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      list_id: listId,
      title: taskData.title,
      notes: taskData.notes || '',
      due_date: taskData.due_date || null,
      priority: taskData.priority || 'medium',
      ...taskData,
    })
    .select()
    .single()

  if (error) throw error
  return task
}

async function createCalendarEvent(userId: string, eventData: any) {
  const { data: event, error } = await supabaseAdmin
    .from('calendar_events')
    .insert({
      user_id: userId,
      title: eventData.title,
      description: eventData.description || '',
      event_date: eventData.event_date,
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      location: eventData.location || null,
      category: eventData.category || 'other',
      priority: eventData.priority || 'medium',
      source: 'sms', // Mark as from SMS/webhook
    })
    .select()
    .single()

  if (error) throw error
  return event
}

async function updateTask(userId: string, taskId: string, data: any) {
  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .update(data)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return task
}

async function updateCalendarEvent(userId: string, eventId: string, data: any) {
  const { data: event, error } = await supabaseAdmin
    .from('calendar_events')
    .update(data)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return event
}

async function deleteTask(userId: string, taskId: string) {
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) throw error
  return { deleted: true }
}

async function deleteCalendarEvent(userId: string, eventId: string) {
  const { error } = await supabaseAdmin
    .from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId)

  if (error) throw error
  return { deleted: true }
}

async function logInteraction(
  userId: string,
  phoneNumber: string,
  message: string,
  actions: any[],
  results: any[]
) {
  // Store interaction log (you might want to create a table for this)
  console.log('AI Bot Interaction:', {
    userId,
    phoneNumber,
    message,
    actionsCount: actions.length,
    results,
    timestamp: new Date().toISOString(),
  })
  
  // Optionally store in database for audit trail
  // await supabaseAdmin.from('ai_interactions').insert({...})
}
