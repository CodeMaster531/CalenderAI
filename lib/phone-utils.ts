/**
 * Phone Number Utilities
 * Normalize and format phone numbers consistently
 */

/**
 * Normalize phone number for storage/comparison
 * Removes spaces, dashes, parentheses, dots, and leading +
 * Example: "+1 (555) 123-4567" -> "15551234567"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[\s\-().+]/g, '')
}

/**
 * Format phone number for display
 * Example: "15551234567" -> "+1 (555) 123-4567"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  const normalized = normalizePhoneNumber(phone)
  
  // US/Canada format: +1 (XXX) XXX-XXXX
  if (normalized.length === 11 && normalized.startsWith('1')) {
    const country = normalized.substring(0, 1)
    const area = normalized.substring(1, 4)
    const part1 = normalized.substring(4, 7)
    const part2 = normalized.substring(7, 11)
    return `+${country} (${area}) ${part1}-${part2}`
  }
  
  // International format (10-15 digits)
  if (normalized.length >= 10 && normalized.length <= 15) {
    return `+${normalized}`
  }
  
  // Return as-is if format is unclear
  return phone
}

/**
 * Validate phone number format
 * Returns true if phone number looks valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false
  
  const normalized = normalizePhoneNumber(phone)
  
  // Phone numbers should be 10-15 digits
  return /^\d{10,15}$/.test(normalized)
}

/**
 * Extract country code from phone number
 * Returns country code or null
 */
export function extractCountryCode(phone: string): string | null {
  if (!phone) return null
  
  const normalized = normalizePhoneNumber(phone)
  
  // Common country codes (1-3 digits)
  if (normalized.startsWith('1') && normalized.length === 11) {
    return '1' // US/Canada
  }
  
  if (normalized.startsWith('44') && normalized.length === 12) {
    return '44' // UK
  }
  
  if (normalized.startsWith('91') && normalized.length === 12) {
    return '91' // India
  }
  
  // Try to detect 2-digit country code
  if (normalized.length >= 12) {
    return normalized.substring(0, 2)
  }
  
  // Try to detect 3-digit country code
  if (normalized.length >= 13) {
    return normalized.substring(0, 3)
  }
  
  return null
}
