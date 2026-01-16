/**
 * SMS/iMessage Service
 * Handles sending SMS/iMessage messages via various providers (BlueBubbles, Twilio, HTTP endpoint, etc.)
 */

interface SendSMSOptions {
  to: string
  message: string
  from?: string // Optional "from" number (Twilio format)
}

interface SendSMSResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send SMS/iMessage message using configured provider
 * Supports BlueBubbles (iMessage), Twilio (SMS), and generic HTTP endpoint
 */
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
  const { to, message, from } = options

  // Try BlueBubbles API first if configured (for iMessage)
if (process.env.BLUEBUBBLES_API_URL && process.env.BLUEBUBBLES_PASSWORD) {
    return sendViaBlueBubbles(to, message)
  }

  // Try Twilio if configured (for SMS)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    // return sendViaTwilio(to, message, from || process.env.TWILIO_PHONE_NUMBER)
  }

  // Try generic HTTP endpoint (for custom SMS providers or server forwarding)
  if (process.env.SMS_API_URL) {
    // return sendViaHTTP(to, message, process.env.SMS_API_URL)
  }

  // No SMS/iMessage provider configured - log and return error
  console.warn('No SMS/iMessage provider configured. Set BLUEBUBBLES_*, TWILIO_*, or SMS_API_URL environment variables.')
  return {
    success: false,
    error: 'SMS/iMessage provider not configured',
  }
}

/**
 * Send iMessage via BlueBubbles API
 */
async function sendViaBlueBubbles(to: string, message: string): Promise<SendSMSResult> {
  const apiUrl = process.env.BLUEBUBBLES_API_URL!
  const password = process.env.BLUEBUBBLES_PASSWORD!
  try {
    // BlueBubbles API endpoints - try different formats
    // The base URL might already include /api/v1/ or just be the server root
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
    
    // Try different endpoint formats
    const endpoints = [
      // `${baseUrl}/api/v1/message/text`,  // If baseUrl is just server root      
      `${baseUrl}/api/v1/message/text`,  // If baseUrl is just server root      
    ]

    const payload = {
      // address: 'Shivamkumartandon1@gmail.com',
      address: to, // Recipient phone number or email
      message: message,
    }

    // BlueBubbles typically uses Basic Auth with the server password
    const apikey = Buffer.from(`:${password}`).toString('base64')
    
    console.log(`[BlueBubbles] Sending message to: ${to}`)
    console.log(`[BlueBubbles] Base URL: ${baseUrl}`)
    
    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`[BlueBubbles] Trying endpoint: ${endpoint}`)
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-server-password':apikey, 
            'User-Agent': 'BlueBubbles-Node/1.0'         
          },
          body: JSON.stringify(payload),
        })

        const data = await response.json().catch(() => ({}))
        
        if (response.ok) {
          console.log(`[BlueBubbles] ✅ Success! Used endpoint: ${endpoint}`)
          return {
            success: true,
            messageId: data.id || data.messageId || data.guid || data.success || undefined,
          }
        }
        
        // If 404, try next endpoint
        if (response.status === 404) {
          console.log(`[BlueBubbles] ❌ 404 on ${endpoint}, trying next...`)
          continue
        }
        
        // Other errors, return immediately
        console.log(payload)
        console.log(response)
        console.error(`[BlueBubbles] ❌ Error ${response.status} on ${endpoint}:`, data)
        return {
          success: false,
          error: data.error || data.message || `BlueBubbles API error: ${response.status}`,
        }
      } catch (fetchError) {
        // Network error, try next endpoint
        console.warn(`[BlueBubbles] ⚠️ Network error on ${endpoint}:`, fetchError)
        continue
      }
    }
    
    // All endpoints failed
    console.error(`[BlueBubbles] ❌ All endpoints failed. Base URL was: ${baseUrl}`)
    return {
      success: false,
      error: `All BlueBubbles API endpoints returned 404. Please check your BLUEBUBBLES_API_URL. Current: ${apiUrl}. `,
    }
  } catch (error) {
    console.error('Error sending iMessage via BlueBubbles:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send SMS via Twilio
//  */
// async function sendViaTwilio(to: string, message: string, fromNumber?: string): Promise<SendSMSResult> {
//   if (!fromNumber) {
//     return {
//       success: false,
//       error: 'Twilio "from" number not configured',
//     }
//   }

//   const accountSid = process.env.TWILIO_ACCOUNT_SID!
//   const authToken = process.env.TWILIO_AUTH_TOKEN!
//   const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

//   try {
//     const formData = new URLSearchParams()
//     formData.append('To', to)
//     formData.append('From', fromNumber)
//     formData.append('Body', message)

//     const response = await fetch(url, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: formData.toString(),
//     })

//     const data = await response.json()

//     if (!response.ok) {
//       return {
//         success: false,
//         error: data.message || `Twilio API error: ${response.status}`,
//       }
//     }

//     return {
//       success: true,
//       messageId: data.sid,
//     }
//   } catch (error) {
//     console.error('Error sending SMS via Twilio:', error)
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error',
//     }
//   }
// }

// /**
//  * Send SMS via generic HTTP endpoint
//  * For custom SMS providers or server forwarding (e.g., BlueBubbles server)
//  */
// async function sendViaHTTP(to: string, message: string, apiUrl: string): Promise<SendSMSResult> {
//   try {
//     const payload = {
//       to,
//       message,
//       body: message, // Alternative field name
//       text: message, // Alternative field name
//       timestamp: new Date().toISOString(),
//     }

//     // Add API key if configured
//     const headers: Record<string, string> = {
//       'Content-Type': 'application/json',
//     }

//     if (process.env.SMS_API_KEY) {
//       headers['Authorization'] = `Bearer ${process.env.SMS_API_KEY}`
//       headers['X-API-Key'] = process.env.SMS_API_KEY
//     }

//     const response = await fetch(apiUrl, {
//       method: 'POST',
//       headers,
//       body: JSON.stringify(payload),
//     })

//     const data = await response.json().catch(() => ({}))

//     if (!response.ok) {
//       return {
//         success: false,
//         error: data.error || data.message || `HTTP error: ${response.status}`,
//       }
//     }

//     return {
//       success: true,
//       messageId: data.messageId || data.id || data.sid || undefined,
//     }
//   } catch (error) {
//     console.error('Error sending SMS via HTTP:', error)
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error',
//     }
//   }
// }
