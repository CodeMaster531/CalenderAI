# OCR-Based Document Processing Integration

## Overview
The upload module now includes full OCR-based parsing that extracts date/time entities and task metadata from PDFs, documents, and images. Extracted events can be imported to the calendar with one click.

## Features Implemented

### 1. Document Upload & Processing
- Drag-and-drop interface for uploading documents
- Supported formats: PDF, DOCX, XLSX, TXT, PNG, JPG, JPEG (max 10MB)
- Real-time progress tracking during OCR processing
- Automatic text extraction using:
  - PDF.js for PDF files
  - Tesseract.js for image OCR
  - Plain text parsing for other formats

### 2. Intelligent Event Extraction
- Uses Chrono.js for advanced date/time parsing
- Extracts multiple event details:
  - Title and description
  - Date and time (start/end)
  - Location information
  - Event category (assignment, exam, meeting, deadline, milestone)
  - Priority level (critical, high, medium, low)
  - Confidence score (70-98%)

### 3. One-Click Calendar Import
- Import individual events or bulk import all events
- Automatic deduplication (tracks imported status)
- Events stored in Supabase `calendar_events` table
- Real-time updates via Supabase subscriptions

### 4. Database Schema

#### `documents` table
Stores uploaded document metadata and processing status
- Tracks upload, processing, and completion
- Stores extracted text (up to 5000 chars)
- Records processing time and errors

#### `extracted_events` table
Stores events parsed from documents
- Full event metadata (title, date, time, location, etc.)
- Confidence scores for each extraction
- Import status tracking

#### `calendar_events` table
Central calendar storage for all events
- Supports multiple sources (manual, extracted, Google Calendar, email)
- Tracks completion status
- Links back to source via `source_id`

### 5. Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Authentication required for uploads
- Secure file storage in Supabase Storage

## Architecture

### Frontend
- `components/document-upload.tsx` - Main upload UI component
- Real-time status updates via Supabase realtime
- Toast notifications for user feedback

### Backend
- `supabase/functions/process-document` - Edge function for OCR processing
- Handles PDF parsing, image OCR, and text extraction
- Runs NLP analysis for event detection
- Updates database with extracted events

### Libraries
- `lib/supabase.ts` - Supabase client and type definitions
- `lib/document-processor.ts` - Document upload and processing utilities
- `lib/calendar-events.ts` - Calendar event management
- `lib/nlp.ts` - Natural language processing for event extraction
- `lib/textify.ts` - Text extraction utilities

## Usage Flow

1. User uploads a document (PDF, image, etc.)
2. File is stored in Supabase Storage
3. Edge function processes the document:
   - Extracts text using OCR/PDF parsing
   - Analyzes text for date/time entities
   - Identifies event metadata (title, location, category)
   - Calculates confidence scores
4. Extracted events appear in the UI
5. User reviews events and imports desired ones
6. Events are added to the main calendar

## Event Extraction Intelligence

The system uses keyword matching and context analysis to determine:

### Categories
- **Assignment**: homework, project, essay, paper
- **Exam**: test, quiz, midterm, final
- **Meeting**: conference, call, discussion
- **Deadline**: due date, submission
- **Milestone**: release, launch, delivery

### Priority Levels
- **Critical**: urgent, asap, emergency, final
- **High**: important, priority
- **Medium**: moderate (default)
- **Low**: optional, nice to have

### Confidence Scoring
- Base: 70%
- +10% for category match
- +5% for priority keyword
- +10% for certain date
- Max: 98%

## Future Enhancements
- Support for more document formats (PPT, Excel)
- ML-based entity recognition for better accuracy
- Custom extraction rules per user
- Batch processing for multiple documents
- Integration with external calendar services
