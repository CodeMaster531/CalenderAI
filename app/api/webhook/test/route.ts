import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Test endpoint to verify webhook connectivity
 * GET /api/webhook/test - Returns connection status
 * POST /api/webhook/test - Tests webhook with sample data
 */
export async function GET(req: NextRequest) {
  try {
    // Test database connection
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message,
      }, { status: 500 })
    }
    
    // Get phone numbers for testing
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, phone_number, full_name')
      .not('phone_number', 'is', null)
    
    return NextResponse.json({
      status: 'success',
      message: 'Webhook endpoint is operational',
      database: 'connected',      
      registeredPhones: profiles?.length || 0,
      profiles: profiles?.map(p => ({
        user_id: p.user_id,
        phone_number: p.phone_number,
        name: p.full_name,
      })) || [],
      serverInfo: {
        host: req.headers.get('host'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Test failed',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Simulate SMS webhook call
    const testPayload = {
      from: body.from || '+15551234567',
      to: body.to || '+15559876543',
      body: body.body || 'Test message: Remind me to call John tomorrow at 2pm',
      timestamp: new Date().toISOString(),
    }
    
    // Call the actual SMS webhook endpoint internally
    const webhookUrl = new URL('/api/webhook/sms', req.url)
    
    // Forward to SMS webhook handler
    const response = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })
    
    const result = await response.json()
    
    return NextResponse.json({
      status: 'success',
      message: 'Test webhook executed',
      testPayload,
      webhookResponse: result,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Test webhook failed',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
