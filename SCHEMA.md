# Supabase Database Schema - Reverse Engineering Analysis

**Generated from:** Complete codebase analysis  
**Date:** 2025-01-27  
**Target:** Production-ready schema for CalendarAI application

---

## A. Schema Blueprint (Human-Readable)

### Overview

The CalendarAI application uses a multi-tenant architecture with user-scoped data. The schema supports:
- **Task Management**: Lists, tasks with priorities and metadata
- **Calendar Events**: Multi-source event aggregation (manual, extracted, Google Calendar, email)
- **Document Processing**: OCR-based event extraction from PDFs/images
- **Goals Management**: Goals with progress tracking and associated tasks
- **Google Integrations**: OAuth token storage and sync metadata
- **Recurring Events**: Series-based recurring event system
- **User Profiles & Preferences**: User settings and profile data

### Table Relationships

```
auth.users (Supabase Auth)
├── user_profiles (1:1)
├── api_keys (1:N)
├── google_integrations (1:1, unique constraint)
├── task_lists (1:N)
│   └── tasks (1:N)
├── goals (1:N)
│   └── goal_tasks (1:N)
├── documents (1:N)
│   └── extracted_events (1:N)
├── calendar_events (1:N)
│   └── event_series (1:N, optional)
│       └── event_overrides (1:N)
└── user_preferences (1:1, unique constraint)
```

### Critical Schema Notes

⚠️ **USER_ID TYPE INCONSISTENCY**: 
- Tables using `user_id uuid`: `tasks`, `task_lists`, `goals`, `google_integrations`, `api_keys`, `user_profiles`
- Tables using `user_id text`: `documents`, `extracted_events`, `calendar_events`, `user_preferences`, `event_series`, `recurring_candidates`
- **RLS policies** in secure migration use `auth.uid()::text = user_id`, suggesting text is expected
- **Recommendation**: Standardize on `uuid` with proper FK constraints for authenticated tables, or `text` for anonymous support

---

## B. Supabase-Ready SQL Schema Draft

### Helper Functions

```sql
-- Universal updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Core Tables

#### 1. `user_profiles`
**Purpose**: Extended user profile data linked to Supabase Auth  
**RLS**: User-scoped (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  onboarding_complete boolean DEFAULT false,
  last_sign_in timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile"
  ON user_profiles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 2. `user_preferences`
**Purpose**: UI preferences (dark mode, dense mode, overnight hours)  
**RLS**: User-scoped (supports text user_id for anonymous users)

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  dark_mode boolean DEFAULT false,
  dense_mode boolean DEFAULT false,
  show_overnight_hours boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 3. `api_keys`
**Purpose**: Secure storage of user API keys (e.g., OpenAI)  
**RLS**: User-scoped (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service_name ON api_keys(service_name);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own API keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

#### 4. `google_integrations`
**Purpose**: OAuth tokens and sync metadata for Google services  
**RLS**: User-scoped (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS google_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  services text[] NOT NULL DEFAULT ARRAY['calendar']::text[],
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_google_integrations_user ON google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_status ON google_integrations(status);

ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON google_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON google_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON google_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON google_integrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 5. `task_lists`
**Purpose**: User-created task lists with customization  
**RLS**: User-scoped (authenticated only)  
**Note**: user_id type inconsistent - migration shows uuid, but RLS may expect text

```sql
CREATE TABLE IF NOT EXISTS task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,  -- ⚠️ Type inconsistency: may need text
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  is_visible boolean DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_lists_user_id ON task_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_position ON task_lists(position);

ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task lists"
  ON task_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task lists"
  ON task_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task lists"
  ON task_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own task lists"
  ON task_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 6. `tasks`
**Purpose**: Individual tasks with rich metadata  
**RLS**: User-scoped (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,  -- ⚠️ Type inconsistency: may need text
  list_id uuid REFERENCES task_lists(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  notes text DEFAULT '',
  due_date date,
  due_time time,
  is_completed boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  estimated_hours numeric(6,2),
  goal text,
  location text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_is_starred ON tasks(is_starred);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 7. `goals`
**Purpose**: User goals with progress tracking  
**RLS**: User-scoped (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'personal' CHECK (category IN ('work', 'personal', 'health', 'learning')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 8. `goal_tasks`
**Purpose**: Tasks associated with goals  
**RLS**: User-scoped via goal ownership (authenticated only)

```sql
CREATE TABLE IF NOT EXISTS goal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  completed boolean DEFAULT false,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  due_date date,
  estimated_hours numeric(6,2),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal_id ON goal_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_completed ON goal_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_position ON goal_tasks(position);

ALTER TABLE goal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal tasks"
  ON goal_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_tasks.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own goal tasks"
  ON goal_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_tasks.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own goal tasks"
  ON goal_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_tasks.goal_id
      AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_tasks.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own goal tasks"
  ON goal_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_tasks.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_goal_tasks_updated_at
  BEFORE UPDATE ON goal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 9. `documents`
**Purpose**: Uploaded document metadata and processing status  
**RLS**: User-scoped (supports text user_id for anonymous/anonymous-compatible)

```sql
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  extracted_text text,
  processing_time numeric,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 10. `extracted_events`
**Purpose**: Events extracted from documents via OCR/AI  
**RLS**: User-scoped (supports text user_id)

```sql
CREATE TABLE IF NOT EXISTS extracted_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('assignment', 'exam', 'meeting', 'deadline', 'milestone', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  confidence integer DEFAULT 85 CHECK (confidence >= 0 AND confidence <= 100),
  is_imported boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_events_user_id ON extracted_events(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_events_document_id ON extracted_events(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_events_date ON extracted_events(event_date);
CREATE INDEX IF NOT EXISTS idx_extracted_events_imported ON extracted_events(is_imported);

ALTER TABLE extracted_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extracted events"
  ON extracted_events FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own extracted events"
  ON extracted_events FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own extracted events"
  ON extracted_events FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own extracted events"
  ON extracted_events FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TRIGGER update_extracted_events_updated_at
  BEFORE UPDATE ON extracted_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 11. `calendar_events`
**Purpose**: Central calendar storage for all events  
**RLS**: User-scoped (supports text user_id)

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('assignment', 'exam', 'meeting', 'deadline', 'milestone', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'extracted', 'google_calendar', 'email')),
  source_id text,
  is_completed boolean DEFAULT false,
  series_id uuid REFERENCES event_series(id) ON DELETE CASCADE,
  occurrence_date date,
  is_series_instance boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_completed ON calendar_events(is_completed);
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);
CREATE INDEX IF NOT EXISTS idx_calendar_events_series_id ON calendar_events(series_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_occurrence_date ON calendar_events(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_series_instance ON calendar_events(is_series_instance);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 12. `event_series`
**Purpose**: Master table for recurring event definitions (RFC 5545 RRULE)  
**RLS**: User-scoped (supports text user_id)

```sql
CREATE TABLE IF NOT EXISTS event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  normalized_title text NOT NULL,
  description text,
  start_date date NOT NULL,
  start_time time,
  end_time time,
  duration_minutes integer,
  location text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('assignment', 'exam', 'meeting', 'deadline', 'milestone', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  rrule text NOT NULL,
  exdates jsonb DEFAULT '[]'::jsonb,
  until_date date,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'extracted', 'detected')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_series_user_id ON event_series(user_id);
CREATE INDEX IF NOT EXISTS idx_event_series_start_date ON event_series(start_date);
CREATE INDEX IF NOT EXISTS idx_event_series_until_date ON event_series(until_date);
CREATE INDEX IF NOT EXISTS idx_event_series_normalized_title ON event_series(normalized_title);
CREATE INDEX IF NOT EXISTS idx_event_series_active ON event_series(is_active);
CREATE INDEX IF NOT EXISTS idx_event_series_source ON event_series(source);

ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;

-- ⚠️ Note: Migration shows public policies, but should be user-scoped in production
CREATE POLICY "Users can view own event series"
  ON event_series FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own event series"
  ON event_series FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own event series"
  ON event_series FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own event series"
  ON event_series FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TRIGGER update_event_series_updated_at
  BEFORE UPDATE ON event_series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 13. `event_overrides`
**Purpose**: Per-instance modifications to series events  
**RLS**: User-scoped via series ownership

```sql
CREATE TABLE IF NOT EXISTS event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES event_series(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  title text,
  start_time time,
  end_time time,
  location text,
  description text,
  is_cancelled boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(series_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_event_overrides_series_id ON event_overrides(series_id);
CREATE INDEX IF NOT EXISTS idx_event_overrides_occurrence_date ON event_overrides(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_event_overrides_cancelled ON event_overrides(is_cancelled);

ALTER TABLE event_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event overrides"
  ON event_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own event overrides"
  ON event_overrides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own event overrides"
  ON event_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own event overrides"
  ON event_overrides FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()::text
    )
  );

CREATE TRIGGER update_event_overrides_updated_at
  BEFORE UPDATE ON event_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 14. `recurring_candidates`
**Purpose**: Staging table for detected recurring patterns before user confirmation  
**RLS**: User-scoped (supports text user_id)

```sql
CREATE TABLE IF NOT EXISTS recurring_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  cluster_key text NOT NULL,
  event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_pattern text,
  confidence_score float DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  title text NOT NULL,
  normalized_title text NOT NULL,
  start_time time,
  location text,
  occurrence_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_rrule text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_candidates_user_id ON recurring_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_cluster_key ON recurring_candidates(cluster_key);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_status ON recurring_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_normalized_title ON recurring_candidates(normalized_title);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_event_ids_gin ON recurring_candidates USING GIN (event_ids);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_occurrence_dates_gin ON recurring_candidates USING GIN (occurrence_dates);

ALTER TABLE recurring_candidates ENABLE ROW LEVEL SECURITY;

-- ⚠️ Note: Migration shows public policies, but should be user-scoped in production
CREATE POLICY "Users can view own recurring candidates"
  ON recurring_candidates FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own recurring candidates"
  ON recurring_candidates FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own recurring candidates"
  ON recurring_candidates FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own recurring candidates"
  ON recurring_candidates FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TRIGGER update_recurring_candidates_updated_at
  BEFORE UPDATE ON recurring_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Storage Buckets

**Required Supabase Storage Bucket:**
- `documents`: For uploaded PDFs, images, and other document files

```sql
-- Note: Storage buckets are created via Supabase Dashboard or API
-- Bucket name: 'documents'
-- Public: false (private)
-- File size limit: 10MB (enforced in application code)
-- Allowed MIME types: application/pdf, image/png, image/jpeg, etc.
```

### Realtime Subscriptions

**Tables with Realtime enabled** (via `supabase_realtime` publication):
- `event_series`
- `event_overrides`
- `recurring_candidates`
- (Other tables may have realtime enabled via migration `20251005224905_enable_realtime_replication.sql`)

---

## C. Indexes Summary

### Performance-Critical Indexes

1. **User-scoped queries**: All tables have `idx_*_user_id` for filtering by user
2. **Date range queries**: `calendar_events.event_date`, `extracted_events.event_date`
3. **Foreign key lookups**: `tasks.list_id`, `goal_tasks.goal_id`, `extracted_events.document_id`
4. **Status/state filtering**: `documents.status`, `google_integrations.status`, `recurring_candidates.status`
5. **Priority sorting**: `tasks.priority`, `goals.priority`, `calendar_events.priority`
6. **JSONB queries**: GIN indexes on `event_ids` and `occurrence_dates` in `recurring_candidates`

---

## D. Known Issues & Recommendations

### ⚠️ Critical Issues

1. **USER_ID Type Inconsistency**
   - **Problem**: Mixed `uuid` and `text` types across tables
   - **Impact**: RLS policies may fail or be inconsistent
   - **Recommendation**: 
     - Option A: Convert all to `uuid` with FK to `auth.users(id)` (more secure, better performance)
     - Option B: Convert all to `text` and use `auth.uid()::text` in RLS (supports anonymous users)
   - **Action Required**: Choose one approach and create migration

2. **RLS Policy Inconsistencies**
   - Some migrations show "public" policies (development mode)
   - Latest secure migration (20251124103000) enforces user-scoped policies
   - **Recommendation**: Audit all tables to ensure user-scoped RLS in production

3. **Missing Foreign Key Constraints**
   - `task_lists.user_id` and `tasks.user_id` use `uuid` but no FK to `auth.users`
   - `goals.user_id` uses `uuid` but no FK to `auth.users`
   - **Recommendation**: Add FK constraints if standardizing on `uuid`

### 🔧 Optimization Recommendations

1. **Composite Indexes**: Add `(user_id, event_date)` on `calendar_events` for date range queries
2. **Partial Indexes**: Consider partial indexes on `is_completed = false` for active tasks/events
3. **JSONB Indexes**: Add GIN indexes on `metadata` columns if querying nested data

### 📝 Schema Evolution Notes

- Multiple migrations show evolution from public → authenticated access
- Recurring events system added later (event_series, event_overrides, recurring_candidates)
- Tasks table extended with priority/metadata in later migration
- Google integrations added as separate table (not embedded in user_profiles)

---

## E. Validation Checklist

Before deploying this schema, verify:

- [ ] All `user_id` types are consistent (uuid OR text, not mixed)
- [ ] RLS policies are enabled on all tables
- [ ] All RLS policies use correct user_id type matching table column
- [ ] Foreign key constraints are properly defined
- [ ] Storage bucket `documents` exists and is configured
- [ ] Realtime is enabled on required tables
- [ ] All indexes are created
- [ ] `update_updated_at_column()` function exists
- [ ] All triggers are created
- [ ] Test RLS policies with authenticated and unauthenticated users

---

**End of Schema Analysis**
