# Database Migration Setup Guide

This guide will help you set up the Supabase database schema for this project.

## Prerequisites

✅ You have created a Supabase project
✅ You have your `.env.local` file set up
✅ You have added `OPENAI_API_KEY` to Edge Function secrets

## Step 1: Create Storage Bucket

Before running migrations, create the storage bucket for documents:

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Bucket name: `documents`
4. **Public bucket**: ✅ **YES** (check this box)
5. Click **"Create bucket"**

**Why public?** The Edge Function needs to read/write files, and the app uses anon key for uploads. (You can restrict this later with RLS policies if needed.)

---

## Step 2: Run SQL Migrations

Go to **Supabase Dashboard** → **SQL Editor** → **New query**

Run these migrations **in order** (copy and paste each one, then click "Run"):

### Migration 1: Documents & Extracted Events Schema
**File:** `supabase/migrations/20251027225025_create_documents_and_events_schema.sql`

This creates:
- `documents` table (for uploaded files)
- `extracted_events` table (for parsed events from documents)
- Indexes and RLS policies

---

### Migration 2: Calendar Events Table
**File:** `supabase/migrations/20251005201220_create_calendar_events_table.sql`

This creates:
- `calendar_events` table (main calendar storage)

---

### Migration 3: Enable Realtime Replication
**File:** `supabase/migrations/20251005224905_enable_realtime_replication.sql`

This enables:
- Real-time subscriptions for `documents` and `extracted_events` tables

---

### Migration 4: Add Task & Office Hours Categories
**File:** `supabase/migrations/20251005230524_add_task_and_office_hours_categories.sql`

This updates:
- Category constraints on `extracted_events` and `calendar_events`

---

### Migration 5: Add Recurring Events Support
**File:** `supabase/migrations/20251005232253_add_recurring_events_support.sql`

This creates:
- `semester_windows` table
- Adds recurring event columns to `extracted_events`

---

### Migration 6: User Preferences Table
**File:** `supabase/migrations/20251008005353_add_user_preferences_table.sql`

This creates:
- `user_preferences` table (for UI settings like dark mode)

---

### Migration 7: Tasks & Lists Schema
**File:** `supabase/migrations/20251008010509_create_tasks_and_lists_schema.sql`

This creates:
- `task_lists` table
- `tasks` table
- Indexes and RLS policies

⚠️ **Note:** This migration uses `auth.users` (UUID) but the app currently uses anonymous text `user_id`. The migration will work, but tasks will require authenticated users. If you're using anonymous users, you may need to modify the migration later.

---

### Migration 8: Event Series & Recurring Detection
**File:** `supabase/migrations/20251012193348_add_event_series_and_recurring_detection.sql`

This creates:
- `event_series` table (for recurring event definitions)
- `event_overrides` table (for per-instance modifications)
- `recurring_candidates` table (for detected patterns)
- Adds series columns to `calendar_events`

---

### Migration 9: API Keys Table
**File:** `supabase/migrations/20251027222736_create_api_keys_table.sql`

This creates:
- `api_keys` table (for storing OpenAI keys per user)

⚠️ **Note:** This migration uses `auth.users` (UUID). If you're not using Supabase Auth, you might want to modify this table to use `text` for `user_id` instead.

---

## Step 3: Verify Tables Were Created

Run this query in SQL Editor to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- `api_keys`
- `calendar_events`
- `documents`
- `event_overrides`
- `event_series`
- `extracted_events`
- `recurring_candidates`
- `semester_windows`
- `task_lists`
- `tasks`
- `user_preferences`

---

## Step 4: Deploy Edge Function (Optional but Recommended)

To deploy the Edge Function for document processing:

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy process-document
```

### Option B: Manual Deployment

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. Name: `process-document`
4. Copy the contents of `supabase/functions/process-document/index.ts`
5. Paste and deploy

---

## Troubleshooting

### Error: "relation already exists"
- Some tables might already exist. The migrations use `IF NOT EXISTS`, so this shouldn't happen, but if it does, you can skip that table or drop it first.

### Error: "permission denied"
- Make sure you're running migrations as a project admin (not with anon key).
- Go to **Settings** → **API** → **Service Role Key** if you need elevated permissions.

### Tasks/Task Lists not showing
- The `tasks` and `task_lists` tables use `uuid` for `user_id` (references `auth.users`).
- The app currently uses anonymous text IDs like `'anonymous-user'`.
- **Quick fix:** You can modify the migrations to use `text` instead of `uuid` for `user_id`, OR set up Supabase Auth and use real user IDs.

### Storage bucket access denied
- Make sure the bucket is **public** OR
- Update bucket policies in **Storage** → **Policies** to allow reads/writes with your anon key.

---

## What's Next?

After migrations are complete:

1. ✅ Start the Next.js app: `npm run dev`
2. ✅ Try uploading a document (PDF/image) in the **Upload** view
3. ✅ Check the **Calendar** view to see extracted events
4. ✅ Try creating tasks in the **Tasks** view

---

## Quick Reference: Migration Order

1. `20251027225025_create_documents_and_events_schema.sql`
2. `20251005201220_create_calendar_events_table.sql`
3. `20251005224905_enable_realtime_replication.sql`
4. `20251005230524_add_task_and_office_hours_categories.sql`
5. `20251005232253_add_recurring_events_support.sql`
6. `20251008005353_add_user_preferences_table.sql`
7. `20251008010509_create_tasks_and_lists_schema.sql`
8. `20251012193348_add_event_series_and_recurring_detection.sql`
9. `20251027222736_create_api_keys_table.sql`

