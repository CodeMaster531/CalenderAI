import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input text is required' },
        { status: 400 }
      )
    }

    // Get OpenAI API key from Supabase or environment
    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('service_name', 'openai')
      .maybeSingle()

    const openaiApiKey = apiKeyData?.api_key || process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please add it to your environment variables or api_keys table.' },
        { status: 500 }
      )
    }

    const prompt = `Parse the following natural language input for creating a task, event, or goal. Return a JSON object with the extracted information.

Rules:
- Identify if this is a task (to-do item), event (calendar appointment), or goal (long-term objective)
- Extract title, description, dates, due time, priority, location, goal, category, and any effort estimate mentioned
- For dates: use YYYY-MM-DD format. Interpret relative dates like "tomorrow", "next Monday", "in 2 days"
- For times: use 24-hour HH:MM format. Extract start and end times if mentioned
- Priority: critical, high, medium, or low based on urgency words
- Goal: concise text capturing the desired outcome if mentioned (e.g., "Finish onboarding deck")
- Estimated hours: numeric hours if the user references time needed (e.g., "2h" or "90 minutes")
- Category: work, personal, health, learning, etc. based on context
- Set confidence 0-100 based on how clear the input is

Current date/time context: ${new Date().toISOString()}

User input: "${input}"

Response format:
{
  "type": "task|event|goal",
  "title": "short descriptive title",
  "description": "longer description if provided",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "endTime": "HH:MM or null",
  "dueDate": "YYYY-MM-DD or null (for tasks)",
  "time": "HH:MM or null (due time for tasks, start time for events)",
  "priority": "critical|high|medium|low or null",
  "category": "category name or null",
  "location": "location if mentioned or null",
  "goal": "goal text or null",
  "estimatedHours": 2.5,
  "confidence": 85
}

Return ONLY valid JSON, no markdown or explanations.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a smart assistant that parses natural language into structured task/event data. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    const parsed = JSON.parse(content)
    
    // Validate required fields
    if (!parsed.title) {
      return NextResponse.json(
        { error: 'Could not extract a title from the input' },
        { status: 400 }
      )
    }

    if (!parsed.type) {
      parsed.type = 'task' // Default to task if unclear
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error in AI parse:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse input' },
      { status: 500 }
    )
  }
}

