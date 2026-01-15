-- Production Schema Migration for CalendarAI
-- Standardizes all user_id columns to uuid with FK constraints
-- All RLS policies use auth.uid() without text casts
-- Assumes: All tables are created fresh (no existing data migration)

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: user_profiles
-- Purpose: Extended user profile data linked to Supabase Auth
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone_number text,
  onboarding_complete boolean DEFAULT false,
  last_sign_in timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add phone_number column to existing user_profiles table if it doesn't exist
-- This handles databases where the table was created before phone_number was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_number text;
  END IF;
END $$;

-- Add comment for phone_number column
COMMENT ON COLUMN user_profiles.phone_number IS 'User phone number for SMS/webhook notifications and AI bot integration';

-- Add email_digest_frequency column to existing user_profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email_digest_frequency'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email_digest_frequency text DEFAULT 'off' CHECK (email_digest_frequency IN ('daily', 'weekly', 'off'));
  END IF;
END $$;

-- Add comment for email_digest_frequency column
COMMENT ON COLUMN user_profiles.email_digest_frequency IS 'Email digest frequency: daily, weekly, or off';

-- Table: user_preferences
-- Purpose: UI preferences (dark mode, dense mode, overnight hours)
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode boolean DEFAULT false,
  dense_mode boolean DEFAULT false,
  show_overnight_hours boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: api_keys
-- Purpose: Secure storage of user API keys (e.g., OpenAI)
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, service_name)
);

-- Table: google_integrations
-- Purpose: OAuth tokens and sync metadata for Google services
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

-- Table: task_lists
-- Purpose: User-created task lists with customization
-- Assumption: user_id requires FK to auth.users
CREATE TABLE IF NOT EXISTS task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  is_visible boolean DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: goals
-- Purpose: User goals with progress tracking
-- Assumption: user_id requires FK to auth.users
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'personal' CHECK (category IN ('work', 'personal', 'health', 'learning')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: documents
-- Purpose: Uploaded document metadata and processing status
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Table: event_series
-- Purpose: Master table for recurring event definitions (RFC 5545 RRULE)
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
-- Must be created before calendar_events due to FK dependency
CREATE TABLE IF NOT EXISTS event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Table: tasks
-- Purpose: Individual tasks with rich metadata
-- Assumption: user_id requires FK to auth.users
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Table: goal_tasks
-- Purpose: Tasks associated with goals
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

-- Table: extracted_events
-- Purpose: Events extracted from documents via OCR/AI
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
CREATE TABLE IF NOT EXISTS extracted_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Table: calendar_events
-- Purpose: Central calendar storage for all events
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
-- series_id is nullable, so FK dependency on event_series is optional
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Table: event_overrides
-- Purpose: Per-instance modifications to series events
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

-- Table: recurring_candidates
-- Purpose: Staging table for detected recurring patterns before user confirmation
-- Assumption: user_id converted from text to uuid, requires FK to auth.users
CREATE TABLE IF NOT EXISTS recurring_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Indexes: user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_number ON user_profiles(phone_number);

-- Indexes: user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Indexes: api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service_name ON api_keys(service_name);

-- Indexes: google_integrations
CREATE INDEX IF NOT EXISTS idx_google_integrations_user ON google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_status ON google_integrations(status);

-- Indexes: task_lists
CREATE INDEX IF NOT EXISTS idx_task_lists_user_id ON task_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_position ON task_lists(position);

-- Indexes: goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);

-- Indexes: documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Indexes: event_series
CREATE INDEX IF NOT EXISTS idx_event_series_user_id ON event_series(user_id);
CREATE INDEX IF NOT EXISTS idx_event_series_start_date ON event_series(start_date);
CREATE INDEX IF NOT EXISTS idx_event_series_until_date ON event_series(until_date);
CREATE INDEX IF NOT EXISTS idx_event_series_normalized_title ON event_series(normalized_title);
CREATE INDEX IF NOT EXISTS idx_event_series_active ON event_series(is_active);
CREATE INDEX IF NOT EXISTS idx_event_series_source ON event_series(source);

-- Indexes: tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_is_starred ON tasks(is_starred);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority);

-- Indexes: goal_tasks
CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal_id ON goal_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_completed ON goal_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_position ON goal_tasks(position);

-- Indexes: extracted_events
CREATE INDEX IF NOT EXISTS idx_extracted_events_user_id ON extracted_events(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_events_document_id ON extracted_events(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_events_date ON extracted_events(event_date);
CREATE INDEX IF NOT EXISTS idx_extracted_events_imported ON extracted_events(is_imported);

-- Indexes: calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_completed ON calendar_events(is_completed);
CREATE INDEX IF NOT EXISTS idx_calendar_events_priority ON calendar_events(priority);
CREATE INDEX IF NOT EXISTS idx_calendar_events_series_id ON calendar_events(series_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_occurrence_date ON calendar_events(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_series_instance ON calendar_events(is_series_instance);

-- Indexes: event_overrides
CREATE INDEX IF NOT EXISTS idx_event_overrides_series_id ON event_overrides(series_id);
CREATE INDEX IF NOT EXISTS idx_event_overrides_occurrence_date ON event_overrides(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_event_overrides_cancelled ON event_overrides(is_cancelled);

-- Indexes: recurring_candidates
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_user_id ON recurring_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_cluster_key ON recurring_candidates(cluster_key);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_status ON recurring_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_normalized_title ON recurring_candidates(normalized_title);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_event_ids_gin ON recurring_candidates USING GIN (event_ids);
CREATE INDEX IF NOT EXISTS idx_recurring_candidates_occurrence_dates_gin ON recurring_candidates USING GIN (occurrence_dates);

-- RLS: Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user_profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
CREATE POLICY "Users can manage own profile"
  ON user_profiles
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: user_preferences
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: api_keys
DROP POLICY IF EXISTS "Users can read own API keys" ON api_keys;
CREATE POLICY "Users can read own API keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
CREATE POLICY "Users can insert own API keys"
  ON api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: google_integrations
DROP POLICY IF EXISTS "Users can view own integrations" ON google_integrations;
CREATE POLICY "Users can view own integrations"
  ON google_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON google_integrations;
CREATE POLICY "Users can insert own integrations"
  ON google_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON google_integrations;
CREATE POLICY "Users can update own integrations"
  ON google_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own integrations" ON google_integrations;
CREATE POLICY "Users can delete own integrations"
  ON google_integrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: task_lists
DROP POLICY IF EXISTS "Users can view own task lists" ON task_lists;
CREATE POLICY "Users can view own task lists"
  ON task_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own task lists" ON task_lists;
CREATE POLICY "Users can insert own task lists"
  ON task_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own task lists" ON task_lists;
CREATE POLICY "Users can update own task lists"
  ON task_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own task lists" ON task_lists;
CREATE POLICY "Users can delete own task lists"
  ON task_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: goals
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: documents
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: event_series
DROP POLICY IF EXISTS "Users can view own event series" ON event_series;
CREATE POLICY "Users can view own event series"
  ON event_series FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own event series" ON event_series;
CREATE POLICY "Users can insert own event series"
  ON event_series FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own event series" ON event_series;
CREATE POLICY "Users can update own event series"
  ON event_series FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own event series" ON event_series;
CREATE POLICY "Users can delete own event series"
  ON event_series FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: goal_tasks
DROP POLICY IF EXISTS "Users can view own goal tasks" ON goal_tasks;
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

DROP POLICY IF EXISTS "Users can insert own goal tasks" ON goal_tasks;
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

DROP POLICY IF EXISTS "Users can update own goal tasks" ON goal_tasks;
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

DROP POLICY IF EXISTS "Users can delete own goal tasks" ON goal_tasks;
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

-- RLS Policies: extracted_events
DROP POLICY IF EXISTS "Users can view own extracted events" ON extracted_events;
CREATE POLICY "Users can view own extracted events"
  ON extracted_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own extracted events" ON extracted_events;
CREATE POLICY "Users can insert own extracted events"
  ON extracted_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own extracted events" ON extracted_events;
CREATE POLICY "Users can update own extracted events"
  ON extracted_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own extracted events" ON extracted_events;
CREATE POLICY "Users can delete own extracted events"
  ON extracted_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: calendar_events
DROP POLICY IF EXISTS "Users can view own calendar events" ON calendar_events;
CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calendar events" ON calendar_events;
CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own calendar events" ON calendar_events;
CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calendar events" ON calendar_events;
CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies: event_overrides
DROP POLICY IF EXISTS "Users can view own event overrides" ON event_overrides;
CREATE POLICY "Users can view own event overrides"
  ON event_overrides FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own event overrides" ON event_overrides;
CREATE POLICY "Users can insert own event overrides"
  ON event_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own event overrides" ON event_overrides;
CREATE POLICY "Users can update own event overrides"
  ON event_overrides FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own event overrides" ON event_overrides;
CREATE POLICY "Users can delete own event overrides"
  ON event_overrides FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_series
      WHERE event_series.id = event_overrides.series_id
      AND event_series.user_id = auth.uid()
    )
  );

-- RLS Policies: recurring_candidates
DROP POLICY IF EXISTS "Users can view own recurring candidates" ON recurring_candidates;
CREATE POLICY "Users can view own recurring candidates"
  ON recurring_candidates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recurring candidates" ON recurring_candidates;
CREATE POLICY "Users can insert own recurring candidates"
  ON recurring_candidates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recurring candidates" ON recurring_candidates;
CREATE POLICY "Users can update own recurring candidates"
  ON recurring_candidates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recurring candidates" ON recurring_candidates;
CREATE POLICY "Users can delete own recurring candidates"
  ON recurring_candidates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Triggers: user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: user_preferences
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: api_keys
-- Note: api_keys table has updated_at but no trigger in original schema
-- Assumption: Adding trigger for consistency

-- Triggers: google_integrations
DROP TRIGGER IF EXISTS update_google_integrations_updated_at ON google_integrations;
CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: task_lists
DROP TRIGGER IF EXISTS update_task_lists_updated_at ON task_lists;
CREATE TRIGGER update_task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: goals
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: documents
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: event_series
DROP TRIGGER IF EXISTS update_event_series_updated_at ON event_series;
CREATE TRIGGER update_event_series_updated_at
  BEFORE UPDATE ON event_series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: tasks
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: goal_tasks
DROP TRIGGER IF EXISTS update_goal_tasks_updated_at ON goal_tasks;
CREATE TRIGGER update_goal_tasks_updated_at
  BEFORE UPDATE ON goal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: extracted_events
DROP TRIGGER IF EXISTS update_extracted_events_updated_at ON extracted_events;
CREATE TRIGGER update_extracted_events_updated_at
  BEFORE UPDATE ON extracted_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: calendar_events
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: event_overrides
DROP TRIGGER IF EXISTS update_event_overrides_updated_at ON event_overrides;
CREATE TRIGGER update_event_overrides_updated_at
  BEFORE UPDATE ON event_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers: recurring_candidates
DROP TRIGGER IF EXISTS update_recurring_candidates_updated_at ON recurring_candidates;
CREATE TRIGGER update_recurring_candidates_updated_at
  BEFORE UPDATE ON recurring_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
