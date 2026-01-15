# Syllabus Date Extraction System

This document describes the upgraded AI-powered date extraction system for parsing academic syllabi and extracting calendar dates.

## Overview

The date extraction system uses OpenAI's GPT-4.1 model with strict JSON mode to extract dates from syllabus documents. The system automatically chunks long documents, deduplicates results, and returns dates in a standardized format.

## Key Features

- **Strict JSON Output**: Uses OpenAI's JSON mode to enforce consistent response format
- **YYYYMMDD Date Format**: All dates normalized to 8-digit format (e.g., "20250315")
- **Automatic Chunking**: Handles long documents by intelligently splitting into chunks
- **Smart Deduplication**: Removes duplicate dates using exact and fuzzy matching
- **Comprehensive Categories**: Supports exam, quiz, assignment_due, class_session, holiday, other
- **Robust Error Handling**: Graceful fallbacks and retry logic with exponential backoff
- **Section Detection**: Intelligently splits documents by headers and structure

## API Reference

### Main Function

```typescript
extractDatesFromDocument(
  text: string,
  openaiApiKey: string,
  config?: ExtractionConfig
): Promise<ExtractedDate[]>
```

#### Parameters

- `text` (string): Raw text content of the document to parse
- `openaiApiKey` (string): OpenAI API key for GPT-4.1 access
- `config` (optional): Configuration options for extraction behavior

#### Configuration Options

```typescript
interface ExtractionConfig {
  chunkSize?: number        // Max characters per chunk (default: 3000)
  chunkOverlap?: number     // Overlap between chunks (default: 200)
  maxRetries?: number       // Max retry attempts on failure (default: 3)
  retryDelay?: number       // Base delay between retries in ms (default: 1000)
}
```

#### Return Type

```typescript
interface ExtractedDate {
  text_span: string                    // Original text where date was found
  normalized_date: string              // Date in YYYYMMDD format
  category: 'exam' | 'quiz' | 'assignment_due' | 'class_session' | 'holiday' | 'other'
  description: string                  // Human-readable description of the event
}
```

## Usage Examples

### Basic Usage

```typescript
import { extractDatesFromDocument } from '@/lib/syllabus-date-extractor'

const syllabusText = `
CS 101 - Introduction to Computer Science
Spring 2025

EXAM SCHEDULE:
Midterm Exam: March 15, 2025
Final Exam: May 10, 2025
`

const dates = await extractDatesFromDocument(
  syllabusText,
  'sk-your-openai-api-key'
)

console.log(dates)
// Output:
// [
//   {
//     text_span: 'Midterm Exam: March 15, 2025',
//     normalized_date: '20250315',
//     category: 'exam',
//     description: 'Midterm Exam'
//   },
//   {
//     text_span: 'Final Exam: May 10, 2025',
//     normalized_date: '20250510',
//     category: 'exam',
//     description: 'Final Exam'
//   }
// ]
```

### With Custom Configuration

```typescript
const dates = await extractDatesFromDocument(
  syllabusText,
  apiKey,
  {
    chunkSize: 5000,        // Larger chunks
    chunkOverlap: 300,      // More overlap
    maxRetries: 5,          // More retry attempts
    retryDelay: 2000        // Longer delay between retries
  }
)
```

### Converting to Calendar Events

The Supabase Edge Function automatically converts extracted dates to calendar events:

```typescript
function convertDatesToEvents(dates: ExtractedDate[]): ExtractedEvent[]
```

This function:
- Converts YYYYMMDD format to ISO date strings (YYYY-MM-DD)
- Maps categories to event types (quiz → exam, assignment_due → assignment, etc.)
- Assigns priority levels based on category
- Sets confidence scores

## Categories

The system supports six event categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `exam` | Midterms, finals, major tests | "Midterm Exam: March 15" |
| `quiz` | Quizzes and short assessments | "Quiz 1: February 10" |
| `assignment_due` | Homework, projects, deliverables | "Problem Set 3 due January 25" |
| `class_session` | Regular class meetings | "Week 1 - January 15: Introduction" |
| `holiday` | Breaks, holidays, no-class days | "Spring Break: March 15-22" |
| `other` | Miscellaneous events | "Guest Lecture: April 5" |

## Document Chunking

The system uses intelligent chunking strategies:

### Section-Based Chunking

Detects document structure using patterns like:
- Markdown headers (`### Week 1`)
- All-caps headers (`EXAM SCHEDULE`)
- Week/Module labels (`Week 1`, `Module 2`)
- Topic headers (`Schedule`, `Calendar`, `Important Dates`)

### Line-Based Chunking

When no clear sections are detected:
- Splits document into chunks of `chunkSize` characters
- Maintains `chunkOverlap` characters between chunks
- Preserves line boundaries to avoid splitting mid-sentence
- Ensures no dates are lost at chunk boundaries

## Deduplication

The system removes duplicate dates using two strategies:

### Exact Deduplication

Removes dates with identical:
- `normalized_date` (same date)
- `description` (same description, case-insensitive)

### Fuzzy Deduplication

Uses Levenshtein distance to detect similar descriptions:
- Calculates similarity score between 0 and 1
- Removes duplicates with similarity > 0.8
- Only compares dates on the same day

Example:
- "Programming Assignment 1" and "Programming Assignment One"
- Would be detected as duplicates with high similarity score

## Error Handling

### Retry Logic

Failed API calls are automatically retried:
- Up to `maxRetries` attempts (default: 3)
- Exponential backoff: delay × attempt number
- Logs each retry attempt for debugging

### Validation

Each extracted date is validated:
- `normalized_date` must match `^\d{8}$` pattern
- `category` must be one of the six allowed values
- `text_span` and `description` must be non-empty
- Invalid dates are filtered out with warnings

### Graceful Fallbacks

- Empty/short documents return empty array (no API call)
- API failures throw errors (caught by Edge Function)
- Edge Function falls back to chrono-node parser on failure

## Testing

The system includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

Test categories:
- Date format validation (YYYYMMDD)
- Category validation
- Exam/quiz/assignment extraction
- Deduplication logic
- Chronological sorting
- Edge cases and error handling
- Document chunking

## Integration with Supabase Edge Function

The extraction system is integrated into the `process-document` Edge Function:

```typescript
// In supabase/functions/process-document/index.ts
const extractedDates = await extractDatesFromDocument(extractedText, openaiApiKey)
const events = convertDatesToEvents(extractedDates)

// Store events in database
await supabase
  .from('extracted_events')
  .insert(events.map(event => ({
    ...event,
    document_id: documentId,
    user_id: document.user_id,
  })))
```

## Performance Considerations

- **Token Usage**: Approximately 500-1000 tokens per chunk
- **Chunk Processing**: 500ms delay between chunks to respect rate limits
- **Large Documents**: Documents > 3000 characters automatically chunked
- **Deduplication**: O(n²) for fuzzy matching, optimized for typical syllabus sizes

## Best Practices

1. **Provide Clean Text**: OCR and text extraction should be performed first
2. **Use Appropriate Chunk Size**: Default 3000 chars works for most syllabi
3. **Monitor API Usage**: Track token consumption for cost management
4. **Handle Errors**: Always wrap calls in try-catch blocks
5. **Validate Results**: Check normalized_date format in downstream code

## Troubleshooting

### No Dates Extracted

- Check if document text is long enough (>50 characters)
- Verify OpenAI API key is valid
- Check console logs for validation warnings
- Ensure dates have clear event context

### Duplicate Dates

- Increase similarity threshold (default 0.8)
- Check if dates have distinct descriptions
- Review fuzzy matching logic in `calculateSimilarity()`

### Wrong Categories

- Review prompt in `callOpenAIForDates()`
- Check if category keywords are present near dates
- Verify category mapping in `convertDatesToEvents()`

### API Errors

- Check API key validity
- Verify rate limits not exceeded
- Review retry configuration
- Check network connectivity

## Future Enhancements

Potential improvements:
- Support for recurring events (e.g., "Every Monday")
- Time zone detection and normalization
- Multi-language support
- Confidence scoring for each date
- Support for date ranges
- Better handling of ambiguous dates
