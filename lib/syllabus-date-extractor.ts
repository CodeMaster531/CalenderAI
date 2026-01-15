interface ExtractedDate {
  text_span: string
  normalized_date: string
  category: 'exam' | 'quiz' | 'assignment_due' | 'class_session' | 'holiday' | 'other'
  description: string
}

interface ExtractionResult {
  dates: ExtractedDate[]
}

interface ChunkMetadata {
  chunkIndex: number
  startLine: number
  endLine: number
  text: string
}

interface ExtractionConfig {
  chunkSize?: number
  chunkOverlap?: number
  maxRetries?: number
  retryDelay?: number
}

const DEFAULT_CONFIG: Required<ExtractionConfig> = {
  chunkSize: 3000,
  chunkOverlap: 200,
  maxRetries: 3,
  retryDelay: 1000,
}

const JSON_SCHEMA = {
  type: "object",
  properties: {
    dates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text_span: { type: "string" },
          normalized_date: { type: "string", pattern: "^\\d{8}$" },
          category: {
            type: "string",
            enum: ["exam", "quiz", "assignment_due", "class_session", "holiday", "other"]
          },
          description: { type: "string" }
        },
        required: ["text_span", "normalized_date", "category", "description"],
        additionalProperties: false
      }
    }
  },
  required: ["dates"],
  additionalProperties: false
}

function chunkDocument(text: string, config: Required<ExtractionConfig>): ChunkMetadata[] {
  const lines = text.split('\n')
  const chunks: ChunkMetadata[] = []

  const sections = detectSections(text)

  if (sections.length > 1) {
    sections.forEach((section, index) => {
      if (section.text.trim().length > 50) {
        chunks.push({
          chunkIndex: index,
          startLine: section.startLine,
          endLine: section.endLine,
          text: section.text
        })
      }
    })
  } else {
    let currentChunk = ''
    let startLine = 0
    let currentLine = 0
    let chunkIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line

      if (potentialChunk.length > config.chunkSize && currentChunk.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          startLine,
          endLine: currentLine,
          text: currentChunk
        })

        const overlapLines = Math.floor(config.chunkOverlap / 50)
        const overlapStart = Math.max(0, i - overlapLines)
        currentChunk = lines.slice(overlapStart, i + 1).join('\n')
        startLine = overlapStart
        currentLine = i
      } else {
        currentChunk = potentialChunk
        currentLine = i
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        startLine,
        endLine: currentLine,
        text: currentChunk
      })
    }
  }

  return chunks.length > 0 ? chunks : [{
    chunkIndex: 0,
    startLine: 0,
    endLine: lines.length - 1,
    text: text
  }]
}

function detectSections(text: string): Array<{ text: string; startLine: number; endLine: number }> {
  const lines = text.split('\n')
  const sections: Array<{ text: string; startLine: number; endLine: number }> = []

  const sectionPatterns = [
    /^#{1,3}\s+(.+)$/i,
    /^[A-Z][A-Z\s]{3,50}$/,
    /^(Week\s+\d+|Module\s+\d+|Unit\s+\d+|Section\s+\d+)/i,
    /^(Schedule|Calendar|Important Dates|Assignments|Exams|Grading)/i,
  ]

  let currentSection: string[] = []
  let sectionStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isHeader = sectionPatterns.some(pattern => pattern.test(line.trim()))

    if (isHeader && currentSection.length > 0) {
      sections.push({
        text: currentSection.join('\n'),
        startLine: sectionStart,
        endLine: i - 1
      })
      currentSection = [line]
      sectionStart = i
    } else {
      currentSection.push(line)
    }
  }

  if (currentSection.length > 0) {
    sections.push({
      text: currentSection.join('\n'),
      startLine: sectionStart,
      endLine: lines.length - 1
    })
  }

  return sections
}

async function callOpenAIWithRetry(
  chunk: string,
  apiKey: string,
  config: Required<ExtractionConfig>,
  attempt: number = 1
): Promise<ExtractedDate[]> {
  try {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const prompt = `You are an expert at extracting calendar dates from academic syllabus documents. Extract ALL dates that represent scheduled events.

Current context: Today is ${currentMonth} ${today.getDate()}, ${currentYear} (${todayStr}).

CRITICAL RULES:
1. Extract ONLY genuine calendar events with specific dates
2. Each date MUST be normalized to YYYYMMDD format (e.g., "20250315" for March 15, 2025)
3. Category MUST be one of: exam, quiz, assignment_due, class_session, holiday, other
4. Include the original text_span where the date was found
5. Provide a clear description of what the event is

WHAT TO EXTRACT:
- Exam dates (category: "exam")
- Quiz dates (category: "quiz")
- Assignment due dates (category: "assignment_due")
- Class session dates (category: "class_session")
- Holiday/break dates (category: "holiday")
- Other scheduled events (category: "other")

WHAT NOT TO EXTRACT:
- Random dates mentioned without event context
- Document creation dates or metadata
- Historical references
- Vague references without specific dates

For year inference:
- If month is earlier than current month (${new Date().getMonth() + 1}), assume next year (${currentYear + 1})
- If month is current or later, assume current year (${currentYear})
- Always prefer explicitly stated years

TEXT TO ANALYZE:
${chunk}

Return ONLY valid JSON matching this exact schema. No markdown, no code blocks, no explanations:
{"dates":[{"text_span":"...","normalized_date":"YYYYMMDD","category":"exam|quiz|assignment_due|class_session|holiday|other","description":"..."}]}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response content from OpenAI')
    }

    const result: ExtractionResult = JSON.parse(content)

    if (!result.dates || !Array.isArray(result.dates)) {
      throw new Error('Invalid response structure: missing dates array')
    }

    const validatedDates = result.dates.filter(date => {
      if (!date.normalized_date || !/^\d{8}$/.test(date.normalized_date)) {
        console.warn('Invalid normalized_date format:', date.normalized_date)
        return false
      }

      const validCategories = ['exam', 'quiz', 'assignment_due', 'class_session', 'holiday', 'other']
      if (!validCategories.includes(date.category)) {
        console.warn('Invalid category:', date.category)
        return false
      }

      if (!date.text_span || !date.description) {
        console.warn('Missing required fields:', date)
        return false
      }

      return true
    })

    return validatedDates

  } catch (error) {
    if (attempt < config.maxRetries) {
      console.warn(`Extraction attempt ${attempt} failed, retrying...`, error)
      await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt))
      return callOpenAIWithRetry(chunk, apiKey, config, attempt + 1)
    }

    console.error('OpenAI extraction failed after all retries:', error)
    throw error
  }
}

function mergeDatesFromChunks(allDates: ExtractedDate[]): ExtractedDate[] {
  const dateMap = new Map<string, ExtractedDate>()

  for (const date of allDates) {
    const key = `${date.normalized_date}:${date.description.toLowerCase().trim()}`

    if (!dateMap.has(key)) {
      dateMap.set(key, date)
    }
  }

  const uniqueDates = Array.from(dateMap.values())

  const deduplicatedDates = uniqueDates.filter((date, index) => {
    for (let i = 0; i < index; i++) {
      const other = uniqueDates[i]
      if (date.normalized_date === other.normalized_date) {
        const similarity = calculateSimilarity(
          date.description.toLowerCase(),
          other.description.toLowerCase()
        )
        if (similarity > 0.8) {
          return false
        }
      }
    }
    return true
  })

  return deduplicatedDates.sort((a, b) =>
    a.normalized_date.localeCompare(b.normalized_date)
  )
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) {
    return 1.0
  }

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

export async function extractDatesFromDocument(
  text: string,
  openaiApiKey: string,
  config: Partial<ExtractionConfig> = {}
): Promise<ExtractedDate[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (!text || text.trim().length < 50) {
    console.warn('Document text too short for extraction')
    return []
  }

  if (!openaiApiKey) {
    throw new Error('OpenAI API key is required')
  }

  const chunks = chunkDocument(text, finalConfig)

  console.log(`Processing ${chunks.length} chunks...`)

  const allDates: ExtractedDate[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Processing chunk ${i + 1}/${chunks.length} (lines ${chunk.startLine}-${chunk.endLine})`)

    try {
      const dates = await callOpenAIWithRetry(chunk.text, openaiApiKey, finalConfig)
      allDates.push(...dates)
      console.log(`Extracted ${dates.length} dates from chunk ${i + 1}`)
    } catch (error) {
      console.error(`Failed to extract dates from chunk ${i + 1}:`, error)
    }

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const mergedDates = mergeDatesFromChunks(allDates)

  console.log(`Total dates extracted: ${allDates.length}, after deduplication: ${mergedDates.length}`)

  return mergedDates
}

export type { ExtractedDate, ExtractionResult, ExtractionConfig }
