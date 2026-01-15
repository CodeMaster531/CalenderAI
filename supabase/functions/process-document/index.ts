import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractedEvent {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  category: string;
  priority: string;
  confidence: number;
  metadata?: Record<string, any>;
}

type LineContext = {
  line_number: number;
  text: string;
};

type LineExtraction = {
  line_number: number;
  event: string;
  date_text: string;
  normalized_date?: string;
  normalized_end_date?: string;
  day_of_week?: string; // e.g., "Monday", "Tuesday", or "Mon,Wed,Fri"
  recurrence_pattern?: string; // e.g., "weekly", "every", "daily"
  is_range_with_day?: boolean; // true if it's a date range with specific day pattern
};

function cleanOCRText(text: string): string {
  let cleaned = text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2');

  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return cleaned;
}



Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { documentId } = await req.json();
    if (!documentId) {
      throw new Error('Missing documentId');
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    await supabase
      .from('documents')
      .update({ status: 'processing', progress: 10 })
      .eq('id', documentId);

    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file');
    }

    await supabase
      .from('documents')
      .update({ progress: 30 })
      .eq('id', documentId);

    const startTime = Date.now();
    let extractedText = '';

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('service_name', 'openai')
      .maybeSingle();

    const openaiApiKey = apiKeyData?.api_key || Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required for document processing');
    }

    if (document.file_type === 'application/pdf') {
      const arrayBuffer = await fileData.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        if (pageText.trim().length > 50) {
          extractedText += pageText + '\n';
        } else {
          const viewport = page.getViewport({ scale: 2.0 });
          
          if (typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const buffer = await blob.arrayBuffer();

            // Use OpenAI Vision API for OCR fallback when PDF text extraction is poor
            try {
              const base64Image = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              
              const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: JSON.stringify({
                  model: 'gpt-4o',
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: 'Extract all text from this image. Return only the raw text content, nothing else.' },
                        {
                          type: 'image_url',
                          image_url: {
                            url: `data:image/png;base64,${base64Image}`,
                          },
                        },
                      ],
                    },
                  ],
                  max_tokens: 2000,
                }),
              });

              if (visionResponse.ok) {
                const visionData = await visionResponse.json();
                const pageText = visionData.choices?.[0]?.message?.content || '';
                if (pageText.trim().length > 0) {
                  extractedText += pageText + '\n';
                }
              } else {
                console.warn(`OpenAI Vision API failed for PDF page ${i}`);
              }
            } catch (visionError) {
              console.warn(`Failed to use OpenAI Vision for PDF page ${i}:`, visionError);
            }
            }
          } else {
            // Fallback: skip OCR for now or add TODO
            console.warn('OffscreenCanvas not available, skipping OCR for page', i);
          }
        }

        const progress = 30 + Math.floor((i / pdf.numPages) * 40);
        await supabase
          .from('documents')
          .update({ progress })
          .eq('id', documentId);
      }
    } else if (document.file_type.startsWith('image/')) {
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Use OpenAI Vision API to extract text from image (no OCR needed!)
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      await supabase
        .from('documents')
        .update({ progress: 50 })
        .eq('id', documentId);

      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract all text from this image. Return only the raw text content, preserving line breaks and structure. Do not add any explanations or formatting.' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${document.file_type.split('/')[1]};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (!visionResponse.ok) {
        const errorBody = await visionResponse.text();
        throw new Error(`OpenAI Vision API error: ${visionResponse.status} ${errorBody}`);
      }

      const visionData = await visionResponse.json();
      extractedText = visionData.choices?.[0]?.message?.content || '';

      if (!extractedText.trim()) {
        throw new Error('No text could be extracted from the image');
      }

      await supabase
        .from('documents')
        .update({ progress: 70 })
        .eq('id', documentId);
    } else {
      extractedText = await fileData.text();

      await supabase
        .from('documents')
        .update({ progress: 70 })
        .eq('id', documentId);
    }

    extractedText = cleanOCRText(extractedText);

    await supabase
      .from('documents')
      .update({ progress: 75 })
      .eq('id', documentId);

    let events: ExtractedEvent[] = [];

    const lines = splitDocumentIntoLines(extractedText);
    console.log(`Extracted text length: ${extractedText.length}`);
    console.log(`Total non-empty lines: ${lines.length}`);

  const candidateLines = lines.filter(l => dateRegex.test(l.text));
  console.log(`Lines with date patterns: ${candidateLines.length} out of ${lines.length} total lines`);
  
  if (candidateLines.length === 0) {
    console.warn('No lines matched date regex pattern. Sample lines:', lines.slice(0, 5).map(l => l.text.substring(0, 100)));
  }

  if (candidateLines.length > 0) {
    const lineEvents = await extractEventsFromLines(
      candidateLines,
      openaiApiKey,
      supabase,
      documentId,
      document.user_id
    );
    console.log(`OpenAI extracted ${lineEvents.length} line events from ${candidateLines.length} candidate lines`);
    events = convertLineEventsToExtractedEvents(lineEvents);
    console.log(`Converted to ${events.length} structured events (after filtering)`);
    }

    console.log(`Total events extracted: ${events.length}`);

    await supabase
      .from('documents')
      .update({ progress: 85 })
      .eq('id', documentId);

    // Events are already saved incrementally in extractEventsFromLines
    // This final insert is only needed if extractEventsFromLines didn't run
    // or if we need to handle any remaining events that weren't saved

    const processingTime = (Date.now() - startTime) / 1000;

    await supabase
      .from('documents')
      .update({
        status: 'completed',
        progress: 100,
        extracted_text: extractedText.substring(0, 5000),
        processing_time: processingTime,
      })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({
        success: true,
        eventsCount: events.length,
        processingTime,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing document:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function splitDocumentIntoLines(text: string): LineContext[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line_number: index + 1, text: line.trim() }))
    .filter((line) => line.text.length > 0);
}

const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/i;

async function extractEventsFromLines(
  lines: LineContext[],
  apiKey: string,
  supabase: any,
  documentId: string,
  userId: string
): Promise<LineExtraction[]> {
  const BATCH_SIZE = 10;
  const batches: LineContext[][] = [];

  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    batches.push(lines.slice(i, i + BATCH_SIZE));
  }

  const allEvents: LineExtraction[] = [];
  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing line batch ${i + 1}/${batches.length}`);
    try {
      const batchEvents = await callOpenAIForLineBatch(batches[i], apiKey);
      allEvents.push(...batchEvents);

      // Save partial results after each successful batch
      if (batchEvents.length > 0) {
        const batchExtractedEvents = convertLineEventsToExtractedEvents(batchEvents);
        const eventsToInsert = batchExtractedEvents.map(event => ({
          ...event,
          document_id: documentId,
          user_id: userId,
        }));

        const { error: eventsError } = await supabase
          .from('extracted_events')
          .insert(eventsToInsert);

        if (eventsError) {
          console.error('Error inserting batch events:', eventsError);
        } else {
          console.log(`Saved ${batchExtractedEvents.length} events from batch ${i + 1}`);
        }
      }
    } catch (error) {
      console.error(`OpenAI batch ${i + 1} failed:`, error);
    }

    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  return allEvents;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  apiKey: string,
  retries = 3
): Promise<Response> {
  const delays = [500, 1000, 2000];
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      // Don't retry 4xx errors (client errors)
      // Only retry 5xx errors (server errors) and network errors
      if (response.status >= 400 && response.status < 500) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      // For 5xx errors, retry if we have attempts left
      if (attempt === retries - 1) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
    }
    
    // Exponential backoff before retry
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
  
  throw new Error('All retry attempts failed');
}

async function callOpenAIForLineBatch(
  batch: LineContext[],
  apiKey: string
): Promise<LineExtraction[]> {
  if (batch.length === 0) {
    return [];
  }

  const instructions = `You are extracting events from document lines. Process EACH line that contains a date.

IMPORTANT: Extract ONE event for EACH line that contains an explicit date. If you receive 10 lines with dates, return 10 events (one per line).

Rules:
- Process every line that contains an explicit calendar date (e.g., "Nov 14, 2025", "11/14/2025", "March 3", "2025-03-03").
- Each line with a date should produce exactly ONE event in the results array.
- Do NOT skip lines that have dates.
- Do NOT infer missing information or guess years.
- Do NOT expand or split date ranges yourself - just mark them.
- date_text must match exactly what appears in the line for the date portion.
- event must be the title/description from that line (text appearing with or after the date).
- For date ranges, set normalized_date (start) and normalized_end_date (end).
- Detect day-of-week patterns (e.g., "every Monday", "Mondays", "Mon/Wed/Fri", "Tuesdays and Thursdays").
- Detect recurrence keywords (e.g., "weekly", "every", "each", "daily", "biweekly").
- If a line has BOTH a date range AND a day-of-week pattern, set is_range_with_day to true.
- Return ALL valid events found in ALL the lines provided.

Response format (return an array of events, one per line with a date):
{
  "events": [
    {
      "line_number": <number>,
      "event": "<event title/description from line>",
      "date_text": "<exact date text as it appears>",
      "normalized_date": "<YYYY-MM-DD or empty if cannot normalize>",
      "normalized_end_date": "<YYYY-MM-DD or empty>",
      "day_of_week": "<day name like 'Monday' or multiple days like 'Mon,Wed,Fri' or empty>",
      "recurrence_pattern": "<'weekly', 'daily', 'biweekly', 'every', or empty>",
      "is_range_with_day": <true if date range + day pattern, false otherwise>
    }
  ]
}

Examples:
- "Every Monday from Nov 1 to Dec 15: Team Meeting" → normalized_date: "2025-11-01", normalized_end_date: "2025-12-15", day_of_week: "Monday", recurrence_pattern: "weekly", is_range_with_day: true
- "Tuesdays and Thursdays Jan 10-20: Office Hours" → normalized_date: "2026-01-10", normalized_end_date: "2026-01-20", day_of_week: "Tuesday,Thursday", is_range_with_day: true
- "Nov 14, 2025: Midterm Exam" → normalized_date: "2025-11-14", day_of_week: "", is_range_with_day: false`;

  const payload = batch.map((line) => `${line.line_number}: ${line.text}`).join("\n");
  
  console.log(`Sending ${batch.length} lines to OpenAI for batch processing`);

  const requestBody = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You extract dated events from documents. Always return valid JSON." },
      { role: "user", content: `${instructions}\nLines:\n${payload}` },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };

  let response: Response;
  try {
    response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      apiKey
    );
  } catch (error) {
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.warn("No content in OpenAI response");
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
    console.log(`Parsed OpenAI response: ${parsed.events?.length || 0} events extracted from ${batch.length} lines`);
  } catch (error) {
    console.error("Failed to parse OpenAI response:", content.substring(0, 500));
    
    // Retry once with temperature: 0 (already set, but explicitly retry the parsing attempt)
    try {
      // Make one more attempt with same request
      const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryContent = retryData.choices?.[0]?.message?.content;
        if (retryContent) {
          try {
            parsed = JSON.parse(retryContent);
          } catch (retryError) {
            console.error("Retry parse also failed:", retryContent);
            return [];
          }
        } else {
          return [];
        }
      } else {
        return [];
      }
    } catch (retryError) {
      console.error("Retry request failed:", retryError);
      return [];
    }
  }

  return Array.isArray(parsed.events) ? parsed.events : [];
}

function expandDateRangeWithDays(
  event: LineExtraction
): ExtractedEvent[] {
  if (!event.is_range_with_day || !event.normalized_date || !event.normalized_end_date || !event.day_of_week) {
    return [];
  }

  const startDate = new Date(event.normalized_date);
  const endDate = new Date(event.normalized_end_date);
  
  // Parse day(s) of week
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };
  
  const daysOfWeek = event.day_of_week
    .toLowerCase()
    .split(',')
    .map(d => d.trim())
    .map(d => dayMap[d])
    .filter(d => d !== undefined);

  if (daysOfWeek.length === 0) {
    return [];
  }

  const expandedEvents: ExtractedEvent[] = [];
  const currentDate = new Date(startDate);

  // Generate events for each matching day in the range
  while (currentDate <= endDate) {
    if (daysOfWeek.includes(currentDate.getDay())) {
      const eventDate = currentDate.toISOString().split('T')[0];
      expandedEvents.push({
        title: event.event || event.date_text,
        description: event.event || event.date_text,
        event_date: eventDate,
        category: "other",
        priority: "medium",
        confidence: 85,
        metadata: {
          date_text: event.date_text,
          line_number: event.line_number,
          is_expanded_from_range: true,
          original_range_start: event.normalized_date,
          original_range_end: event.normalized_end_date,
          day_of_week: event.day_of_week,
          recurrence_pattern: event.recurrence_pattern || null,
        },
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return expandedEvents;
}

function convertLineEventsToExtractedEvents(
  lineEvents: LineExtraction[]
): ExtractedEvent[] {
  const allEvents: ExtractedEvent[] = [];

  for (const event of lineEvents) {
    // Skip if no date information
    if (!event.normalized_date && !event.date_text) {
      continue;
    }

    // If it's a range with day pattern, store as-is (don't expand during extraction)
    // Expansion will happen during import
    if (event.is_range_with_day && event.normalized_date && event.normalized_end_date && event.day_of_week) {
      // Store the range event with full metadata for later expansion
      allEvents.push({
        title: event.event || event.date_text,
        description: event.event || event.date_text,
        event_date: event.normalized_date, // Use start date as the event_date
        category: "other",
        priority: "medium",
        confidence: 85,
        metadata: {
          date_text: event.date_text,
          normalized_date: event.normalized_date,
          normalized_end_date: event.normalized_end_date,
          line_number: event.line_number,
          day_of_week: event.day_of_week,
          recurrence_pattern: event.recurrence_pattern || null,
          is_range_with_day: true, // Flag to expand during import
          is_expanded_from_range: false,
        },
      });
      console.log(`Stored range event "${event.event}" from ${event.normalized_date} to ${event.normalized_end_date} on ${event.day_of_week} (will expand on import)`);
      continue;
    }

    // Create single event (normal case or fallback)
    const event_date = event.normalized_date || event.date_text;
    const confidence = event.normalized_date ? 90 : 70;

    allEvents.push({
      title: event.event || event.date_text,
      description: event.event || event.date_text,
      event_date,
      category: "other",
      priority: "medium",
      confidence,
      metadata: {
        date_text: event.date_text,
        normalized_end_date: event.normalized_end_date || null,
        line_number: event.line_number,
        day_of_week: event.day_of_week || null,
        recurrence_pattern: event.recurrence_pattern || null,
        is_range_with_day: false,
        is_expanded_from_range: false,
      },
    });
  }

  return allEvents;
}