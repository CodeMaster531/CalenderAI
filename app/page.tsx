"use client"

import { useState } from "react"
import { CalendarView } from "@/components/calendar-view"
import { GoalManager } from "@/components/goal-manager"
import { PriorityDashboard } from "@/components/priority-dashboard"
import { GoogleIntegrations } from "@/components/google-integrations"
import { DocumentUpload } from "@/components/document-upload"
import { TasksView } from "@/components/tasks-view"
import { FocusModeView } from "@/components/focus-mode-view"
import { Sidebar } from "@/components/sidebar"
import { ProfileSettings } from "@/components/profile-settings"
import { DataBackupView } from "@/components/data-backup-view"
import { useAuth } from "@/components/auth/auth-provider"
import { EmailAuthForm } from "@/components/auth/email-auth-form"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const [activeView, setActiveView] = useState("tasks")
  const [refreshKey, setRefreshKey] = useState(0)
  const { user, loading, signOut } = useAuth()

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="max-w-6xl w-full grid gap-12 md:grid-cols-2 items-center">
          <div className="space-y-6 text-white">
            <p className="inline-flex items-center text-sm uppercase tracking-[0.3em] text-primary/80">
              AI calendar workspace
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Stay in flow with automated scheduling, focus, and planning.
            </h1>
            <p className="text-lg text-white/70">
              Create an account with your email to start syncing tasks, events, and documents securely through Supabase.
            </p>
            <ul className="space-y-3 text-white/80">
              <li>• Secure email/password authentication powered by Supabase Auth</li>
              <li>• Personal calendar, task lists, and AI document parsing</li>
              <li>• Data stored per-user with row level security</li>
            </ul>
          </div>
          <EmailAuthForm />
        </div>
      </div>
    )
  }

  const userId = user.id

  const renderView = () => {
    switch (activeView) {
      case "tasks":
        return <TasksView key={refreshKey} userId={userId} />
      case "goals":
        return <GoalManager key={refreshKey} userId={userId} />
      case "priorities":
        return <PriorityDashboard key={refreshKey} userId={userId} />
      case "focus":
        return <FocusModeView key={refreshKey} />
      case "google":
        return <GoogleIntegrations key={refreshKey} userId={userId} />
      case "upload":
        return <DocumentUpload key={refreshKey} userId={userId} />
      case "calendar":
        return <CalendarView key={refreshKey} userId={userId} />
      case "profile":
        return <ProfileSettings key={refreshKey} />
      case "backup":
        return <DataBackupView key={refreshKey} userId={userId} />
      default:
        return <TasksView key={refreshKey} userId={userId} />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        userId={userId}
        onRefresh={handleRefresh}
        onSignOut={signOut}
      />
      <main className="flex-1 overflow-hidden relative">{renderView()}</main>
    </div>
  )
}
