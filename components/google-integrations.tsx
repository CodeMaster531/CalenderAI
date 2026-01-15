"use client"

import { useEffect, useState, useCallback } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { CalendarEvent } from "@/lib/calendar-events"
import { deleteIntegration, getGoogleIntegrations, type GoogleIntegrationRecord } from "@/lib/integrations"
import { supabase } from "@/lib/supabase"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  MapPin,
  Plus,
  RefreshCcw,
  Settings,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface GoogleIntegrationsProps {
  userId: string
}

const serviceDefinitions = [
  {
    id: "calendar",
    title: "Google Calendar",
    description: "Two-way sync for meetings, reminders, and schedules.",
  },
  {
    id: "gmail",
    title: "Gmail parsing",
    description: "Auto-extract events and tasks from confirmation emails.",
  },
  {
    id: "meet",
    title: "Google Meet",
    description: "Attach Meet links and manage virtual rooms.",
  },
]

export function GoogleIntegrations({ userId }: GoogleIntegrationsProps) {
  const [integrations, setIntegrations] = useState<GoogleIntegrationRecord[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>(["calendar"])
  const [isConnecting, setIsConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [autoProcessEvents, setAutoProcessEvents] = useState(true)
  const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set())

  const refreshTokens = useCallback(async () => {
    try {
      const response = await fetch("/api/google/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (response.ok) {
        const result = await response.json()
        if (result.refreshed > 0) {
          console.log(`Refreshed ${result.refreshed} token(s) proactively`)
        }
      }
    } catch (error) {
      // Silently fail - this is a background operation
      console.error("Failed to refresh tokens proactively", error)
    }
  }, [userId])

  useEffect(() => {
    loadData()
    // Proactively refresh tokens when component loads
    refreshTokens()
  }, [userId, refreshTokens])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof window === "undefined") return
      if (event.data?.type === "google-integration-success") {
        toast.success(event.data?.message || "Google account connected")
        setIsDialogOpen(false)
        loadData()
      } else if (event.data?.type === "google-integration-error") {
        toast.error(event.data?.message || "Google connection failed")
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [integrationRows, eventsRows] = await Promise.all([
        getGoogleIntegrations(),
        supabase
          .from("calendar_events")
          .select("*")
          .eq("source", "google_calendar")
          .eq("user_id", userId)
          .order("event_date", { ascending: false })
          .limit(10),
      ])

      setIntegrations(integrationRows)
      if (eventsRows.error) {
        throw new Error(eventsRows.error.message)
      }
      setEvents(eventsRows.data || [])
    } catch (error) {
      console.error("Failed to load integrations", error)
      toast.error("Unable to load integration data right now.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    setSelectedServices((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, serviceId]))
      }
      return prev.filter((id) => id !== serviceId)
    })
  }

  const startConnectFlow = async () => {
    if (!selectedServices.length) {
      toast.error("Select at least one Google service to connect.")
      return
    }
    setIsConnecting(true)
    try {
      const response = await fetch("/api/google/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, services: selectedServices }),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const { url } = (await response.json()) as { url: string }
      const popup = window.open(url, "googleOAuth", "width=500,height=700")
      if (!popup) {
        toast.info("Please allow popups for this site to continue.")
      }
    } catch (error) {
      console.error("Failed to start Google OAuth flow", error)
      toast.error("Could not open Google authentication.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSync = async (integrationId: string) => {
    setSyncingId(integrationId)
    try {
      const response = await fetch("/api/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to sync")
      }
      toast.success(`Imported ${payload.imported} events from Google`)
      await loadData()
    } catch (error) {
      console.error("Failed to sync Google events", error)
      toast.error(error instanceof Error ? error.message : "Failed to sync Google events.")
    } finally {
      setSyncingId(null)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    try {
      await deleteIntegration(integrationId)
      toast.success("Integration disconnected")
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect integration.")
    }
  }


  const renderStatus = (integration: GoogleIntegrationRecord) => {
    if (!integration.last_synced_at) return "Never synced"
    return `Last sync ${formatDistanceToNow(parseISO(integration.last_synced_at), { addSuffix: true })}`
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Integrations</p>
          <h1 className="text-3xl font-semibold text-foreground">Google Workspace connections</h1>
          <p className="text-muted-foreground">Securely connect Calendar, Gmail, and Meet to keep CalenderApp in sync.</p>
        </div>
        <Button className="self-start" onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.length === 0 && !isLoading && (
          <Card className="p-6 border-dashed">
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold">No Google integrations yet</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar or Gmail to start importing events automatically.
              </p>
              <Button variant="outline" className="self-start" onClick={() => setIsDialogOpen(true)}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Connect Google Account
              </Button>
            </div>
          </Card>
        )}

        {integrations.map((integration) => (
          <Card key={integration.id} className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Google Workspace</h3>
                </div>
                <p className="text-sm text-muted-foreground">{renderStatus(integration)}</p>
              </div>
              {integration.status === "connected" ? (
                <Badge className="bg-emerald-100 text-emerald-600">Connected</Badge>
                ) : (
                <Badge variant="destructive">Needs attention</Badge>
                )}
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                Services enabled:{" "}
                {integration.services.map((service) => (
                  <Badge key={service} variant="outline" className="mr-1 capitalize">
                    {service}
                  </Badge>
                ))}
              </div>
              <div className="text-xs">
                Token expires {integration.token_expires_at ? formatDistanceToNow(parseISO(integration.token_expires_at), { addSuffix: true }) : "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleSync(integration.id)}
                disabled={syncingId === integration.id}
                className="flex items-center gap-2"
              >
                <RefreshCcw className={`h-4 w-4 ${syncingId === integration.id ? "animate-spin" : ""}`} />
                {syncingId === integration.id ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDisconnect(integration.id)}>
                Disconnect
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Email Event Detection</h2>
            <p className="text-sm text-muted-foreground">Automatically detect and import events from your Gmail</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Auto-process</span>
            <Switch checked={autoProcessEvents} onCheckedChange={setAutoProcessEvents} />
          </div>
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No Google events ingested yet. Connect or sync to pull in upcoming meetings.
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const isProcessed = processedEventIds.has(event.id) || event.is_completed
              const eventDate = new Date(event.event_date)
              const formattedDate = eventDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
              const formattedTime = event.start_time ? event.start_time.slice(0, 5) : null
              
              // Calculate confidence based on event completeness (mock for now)
              const confidence = event.description && event.location && event.start_time ? 95 : event.description || event.location ? 85 : 75
              
              // Mock sender info - in real app this would come from email metadata
              const senderEmail = "calendar@google.com"
              const emailDate = event.created_at ? new Date(event.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : formattedDate

              return (
                <Card key={event.id} className={`p-4 ${isProcessed ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-medium text-base">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        From: {senderEmail} • {emailDate}
                      </p>
                    </div>
                    <Badge variant={isProcessed ? "secondary" : "default"} className="ml-2">
                      {isProcessed ? "Processed" : "New"}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Detected Events:</h4>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <h5 className="font-medium">{event.title}</h5>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center space-x-4 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formattedDate}
                              </span>
                              {formattedTime && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formattedTime}
                                </span>
                              )}
                              {event.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm">{event.description}</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ml-2 ${
                            confidence >= 90
                              ? "border-green-500 text-green-600"
                              : confidence >= 70
                              ? "border-yellow-500 text-yellow-600"
                              : "border-red-500 text-red-600"
                          }`}
                        >
                          {confidence}% confident
                        </Badge>
                      </div>
                    </div>

                    {!isProcessed && (
                      <div className="flex space-x-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setProcessedEventIds((prev) => new Set([...prev, event.id]))
                            toast.success("Event imported to calendar")
                          }}
                        >
                          Import to Calendar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toast.info("Edit events feature coming soon")
                          }}
                        >
                          Edit Events
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProcessedEventIds((prev) => new Set([...prev, event.id]))
                            toast.info("Event ignored")
                          }}
                        >
                          Ignore
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Google integration</DialogTitle>
            <DialogDescription>Select the Google services you want CalenderApp to sync with.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {serviceDefinitions.map((service) => (
              <label
                key={service.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"
              >
                <Checkbox
                  checked={selectedServices.includes(service.id)}
                  onCheckedChange={(checked) => handleServiceToggle(service.id, Boolean(checked))}
                />
                <div>
                  <p className="font-semibold">{service.title}</p>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
            </div>
              </label>
            ))}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Permissions
              </p>
              <p className="text-xs">
                We ask Google for read-only access unless you enable Meet link creation. You can revoke access anytime.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startConnectFlow} disabled={isConnecting}>
              {isConnecting ? "Preparing…" : "Connect with Google"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

