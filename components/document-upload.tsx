"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useDropzone } from "react-dropzone"
import { Upload, Calendar, Trash2, Sparkles, FileText, ChevronRight, CircleCheck as CheckCircle2, Circle, X, Zap, Key, Settings } from "lucide-react"
import { supabase, type Document, type ExtractedEvent } from "@/lib/supabase"
import {
  uploadDocument,
  processDocument,
  getDocuments,
  getExtractedEvents,
  deleteDocument,
  importEventToCalendar,
  deleteExtractedEvent,
  deleteExtractedEvents
} from "@/lib/document-processor"
import { toast } from "sonner"

interface ProcessedDocument extends Document {
  events: ExtractedEvent[]
}

interface DocumentUploadProps {
  userId: string
}

const categoryColors: Record<string, string> = {
  assignment: "bg-blue-500",
  exam: "bg-red-500",
  meeting: "bg-purple-500",
  deadline: "bg-orange-500",
  milestone: "bg-green-500",
  other: "bg-gray-500",
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
}

function dateFromISODateOnly(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatEventDate(eventDateISO: string): string {
  const date = dateFromISODateOnly(eventDateISO);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

// Helper function to format date range with day pattern
function formatEventDateInfo(event: ExtractedEvent): string {
  const metadata = event.metadata || {}
  
  // If it's a range with day pattern, show the full range info
  if (metadata.is_range_with_day && metadata.normalized_date && metadata.normalized_end_date && metadata.day_of_week) {
    const startDate = formatEventDate(metadata.normalized_date)
    const endDate = formatEventDate(metadata.normalized_end_date)
    const dayPattern = metadata.day_of_week
      .split(',')
      .map(d => d.trim())
      .map(d => {
        const dayMap: Record<string, string> = {
          'sunday': 'Sun', 'sun': 'Sun',
          'monday': 'Mon', 'mon': 'Mon',
          'tuesday': 'Tue', 'tue': 'Tue', 'tues': 'Tue',
          'wednesday': 'Wed', 'wed': 'Wed',
          'thursday': 'Thu', 'thu': 'Thu', 'thur': 'Thu', 'thurs': 'Thu',
          'friday': 'Fri', 'fri': 'Fri',
          'saturday': 'Sat', 'sat': 'Sat',
        }
        return dayMap[d.toLowerCase()] || d
      })
      .join(', ')
    
    // Show original date text if available, otherwise formatted dates
    if (metadata.date_text) {
      return `${metadata.date_text} (${startDate} to ${endDate} on ${dayPattern})`
    }
    return `${startDate} to ${endDate} on ${dayPattern}`
  }
  
  // If it's a date range (without day pattern)
  if (metadata.normalized_end_date && metadata.normalized_end_date !== event.event_date) {
    const startDate = formatEventDate(event.event_date)
    const endDate = formatEventDate(metadata.normalized_end_date)
    // Show original date text if available
    if (metadata.date_text) {
      return `${metadata.date_text} (${startDate} to ${endDate})`
    }
    return `${startDate} to ${endDate}`
  }
  
  // Show original date text from document if available, otherwise formatted date
  if (metadata.date_text) {
    // Show both original text and formatted date for clarity
    return `${metadata.date_text} (${formatEventDate(event.event_date)})`
  }
  
  // Default: just formatted date
  return formatEventDate(event.event_date)
}

export function DocumentUpload({ userId }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([])
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      await loadDocuments(userId)
      await checkApiKey()
    })()
  }, [userId])

  const checkApiKey = async () => {
    try {
      const { data } = await supabase
        .from('api_keys')
        .select('id')
        .eq('service_name', 'openai')
        .eq('user_id', userId)
        .maybeSingle()

      setHasApiKey(!!data)
    } catch (error) {
      console.error('Error checking API key:', error)
    }
  }

  const saveApiKey = async () => {
    if (!openaiApiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    try {
      const { error } = await supabase
        .from('api_keys')
        .upsert(
          {
            user_id: userId,
            service_name: 'openai',
            api_key: openaiApiKey.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,service_name' }
        )

      if (error) {
        throw error
      }

      setHasApiKey(true)
      setApiKeyDialogOpen(false)
      setOpenaiApiKey('')
      toast.success('OpenAI API key saved successfully')
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key')
    }
  }

  const loadDocuments = async (userId: string) => {
    try {
      const docs = await getDocuments(userId)
      const docsWithEvents = await Promise.all(
        docs.map(async (doc) => {
          const events = await getExtractedEvents(doc.id)
          return { ...doc, events }
        })
      )
      setDocuments(docsWithEvents)
    } catch (error) {
      console.error('Error loading documents:', error)
      toast.error("Failed to load documents")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('document-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            setDocuments((prev) =>
              prev.map((doc) =>
                doc.id === payload.new.id
                  ? { ...doc, ...payload.new }
                  : doc
              )
            )

            if (payload.new.status === 'completed') {
              const events = await getExtractedEvents(payload.new.id)
              setDocuments((prev) =>
                prev.map((doc) =>
                  doc.id === payload.new.id
                    ? { ...doc, events }
                    : doc
                )
              )
            }
          } else if (payload.eventType === 'INSERT') {
            console.log('Realtime INSERT detected:', payload.new)
            const events = await getExtractedEvents(payload.new.id)
            setDocuments((prev) => {
              const exists = prev.some(doc => doc.id === payload.new.id)
              if (exists) {
                console.log('Document already exists, skipping duplicate')
                return prev
              }
              console.log('Adding new document to state')
              return [{ ...payload.new, events }, ...prev]
            })
          } else if (payload.eventType === 'DELETE') {
            setDocuments((prev) => prev.filter((doc) => doc.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!userId) {
      toast.error('Please wait for initialization...')
      return
    }

    if (acceptedFiles.length === 0) {
      return
    }

    toast.info(`Uploading ${acceptedFiles.length} file${acceptedFiles.length > 1 ? 's' : ''}...`)

    for (const file of acceptedFiles) {
      try {
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type)
        const document = await uploadDocument(file, userId)
        console.log('Document uploaded:', document)

        setDocuments((prev) => [{...document, events: []}, ...prev])

        toast.success(`${file.name} uploaded successfully`)
        await processDocument(document.id)
      } catch (error) {
        console.error('Error uploading file:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`)
      }
    }
  }, [userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const { file, errors } = rejection
        errors.forEach((error) => {
          if (error.code === 'file-too-large') {
            toast.error(`${file.name} is too large. Max size is 10MB`)
          } else if (error.code === 'file-invalid-type') {
            toast.error(`${file.name} has an invalid file type`)
          } else {
            toast.error(`${file.name}: ${error.message}`)
          }
        })
      })
    },
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleImportEvents = async (eventIds: string[]) => {
    try {
      const results = await Promise.all(eventIds.map(id => importEventToCalendar(id)))
      
      // Count total calendar events created (may be more than extracted events if ranges expanded)
      const totalCalendarEvents = results.reduce((count, result) => {
        // Result can be a single event or an array of events (when expanded)
        return count + (Array.isArray(result) ? result.length : 1)
      }, 0)
      
      toast.success(`Imported ${totalCalendarEvents} event${totalCalendarEvents > 1 ? 's' : ''} to calendar`)

      setDocuments((prev) =>
        prev.map((doc) => ({
          ...doc,
          events: doc.events.map((event) =>
            eventIds.includes(event.id) ? { ...event, is_imported: true } : event
          ),
        }))
      )
      setSelectedEvents(new Set())
      
      // Trigger calendar refresh to show new events
      window.dispatchEvent(new CustomEvent('refreshCalendar'))
    } catch (error) {
      console.error('Error importing events:', error)
      toast.error(`Failed to import events: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocument(docId)
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
      toast.success('Document deleted successfully')
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  const handleDeleteEvents = async (eventIds: string[]) => {
    try {
      await deleteExtractedEvents(eventIds)
      toast.success(`Deleted ${eventIds.length} event${eventIds.length > 1 ? 's' : ''}`)

      setDocuments((prev) =>
        prev.map((doc) => ({
          ...doc,
          events: doc.events.filter((event) => !eventIds.includes(event.id)),
        }))
      )
      setSelectedEvents(new Set())
    } catch (error) {
      console.error('Error deleting events:', error)
      toast.error(`Failed to delete events`)
    }
  }

  const handleDeleteSingleEvent = async () => {
    if (!eventToDelete) return

    try {
      await deleteExtractedEvent(eventToDelete)
      toast.success('Event deleted successfully')

      setDocuments((prev) =>
        prev.map((doc) => ({
          ...doc,
          events: doc.events.filter((event) => event.id !== eventToDelete),
        }))
      )

      if (selectedEvents.has(eventToDelete)) {
        const newSelected = new Set(selectedEvents)
        newSelected.delete(eventToDelete)
        setSelectedEvents(newSelected)
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    } finally {
      setDeleteDialogOpen(false)
      setEventToDelete(null)
    }
  }

  const openDeleteDialog = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEventToDelete(eventId)
    setDeleteDialogOpen(true)
  }

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return "📄"
    if (type.includes("word")) return "📝"
    if (type.includes("sheet")) return "📊"
    if (type.includes("image")) return "🖼️"
    return "📄"
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Sparkles className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading your documents...</p>
        </div>
      </div>
    )
  }

  const allEvents = documents
    .filter(doc => doc.status === 'completed')
    .flatMap(doc => doc.events.map(event => ({ ...event, documentName: doc.name, documentId: doc.id })))

  const processingDocs = documents.filter(doc => doc.status === 'processing')
  const completedDocs = documents.filter(doc => doc.status === 'completed')

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Uploads Library</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setApiKeyDialogOpen(true)}
            >
              <Key className={`h-4 w-4 ${hasApiKey ? 'text-green-600' : 'text-muted-foreground'}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{completedDocs.length} documents</p>
          {!hasApiKey && (
            <p className="text-xs text-orange-600 mt-1">Add API key for AI extraction</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              {isDragActive ? "Drop files" : "Add files"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Up to 10MB</p>
          </div>

          {processingDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">Processing</p>
              {processingDocs.map((doc) => (
                <div key={doc.id} className="bg-accent/50 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
                    <p className="text-xs font-medium truncate flex-1">{doc.name}</p>
                  </div>
                  <Progress value={doc.progress} className="h-1" />
                  <p className="text-xs text-muted-foreground">{doc.progress}%</p>
                </div>
              ))}
            </div>
          )}

          {completedDocs.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-1 mt-3">Documents</p>
              {completedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`w-full text-left rounded-lg p-2.5 transition-all group ${
                    selectedDocument?.id === doc.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-accent"
                  }`}
                >
                  <div 
                    className="flex items-start gap-2 cursor-pointer"
                    onClick={() => setSelectedDocument(selectedDocument?.id === doc.id ? null : doc)}
                  >
                    <span className="text-base flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-foreground">{doc.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-xs text-muted-foreground">{doc.events.length} events</p>
                        {doc.events.filter(e => e.is_imported).length > 0 && (
                          <span className="text-xs text-muted-foreground">·</span>
                        )}
                        {doc.events.filter(e => e.is_imported).length > 0 && (
                          <p className="text-xs text-green-600">{doc.events.filter(e => e.is_imported).length} imported</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteDocument(doc.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {selectedDocument ? selectedDocument.name : "All Events"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedDocument
                  ? `${selectedDocument.events.length} events extracted`
                  : `${allEvents.length} events from ${completedDocs.length} documents`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedEvents.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEvents(Array.from(selectedEvents))}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedEvents.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const eventsToImport = Array.from(selectedEvents).filter(id => {
                        const event = allEvents.find(e => e.id === id)
                        return event && !event.is_imported
                      })
                      if (eventsToImport.length > 0) {
                        handleImportEvents(eventsToImport)
                      }
                    }}
                    disabled={Array.from(selectedEvents).every(id => {
                      const event = allEvents.find(e => e.id === id)
                      return event?.is_imported
                    })}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Import ({selectedEvents.size})
                  </Button>
                </>
              )}
              {selectedEvents.size === 0 && allEvents.filter(e => !e.is_imported).length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const topEvents = allEvents
                        .filter(e => !e.is_imported)
                        .filter(e => e.priority === 'critical' || e.priority === 'high')
                        .sort((a, b) => {
                          const priorityOrder = { critical: 2, high: 1 };
                          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
                        })
                        .slice(0, 5)
                        .map(e => e.id);
                      if (topEvents.length > 0) {
                        handleImportEvents(topEvents);
                      }
                    }}
                    disabled={allEvents.filter(e => !e.is_imported && (e.priority === 'critical' || e.priority === 'high')).length === 0}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Quick Import Top
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleImportEvents(allEvents.filter(e => !e.is_imported).map(e => e.id))}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Import All
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {allEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-sm">
                <div className="bg-accent/50 rounded-full h-20 w-20 mx-auto flex items-center justify-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">No documents yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload PDFs, documents, or syllabi to extract calendar events
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="max-w-3xl mx-auto space-y-2">
                {(selectedDocument ? selectedDocument.events.map(e => ({ ...e, documentName: selectedDocument.name, documentId: selectedDocument.id })) : allEvents).map((event) => (
                  <div
                    key={event.id}
                    className={`group rounded-lg border transition-all ${
                      selectedEvents.has(event.id)
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-accent-foreground/20 hover:shadow-sm"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEvents.has(event.id)}
                          onCheckedChange={() => toggleEventSelection(event.id)}
                          className="mt-1"
                        />
                        <button
                          className="flex-1 text-left space-y-2"
                          onClick={() => toggleEventSelection(event.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground text-sm sm:text-base leading-tight">
                                {event.title}
                              </h3>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                              <Badge
                                className={`${categoryColors[event.category] || categoryColors.other} text-white text-xs px-2 py-0.5`}
                              >
                                {event.category}
                              </Badge>
                              <Badge
                                className={`${priorityColors[event.priority] || priorityColors.medium} text-white text-xs px-2 py-0.5`}
                              >
                                {event.priority}
                              </Badge>
                              {event.is_imported && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 border-green-500 text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Imported
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium text-foreground">
                                  {formatEventDateInfo(event)}
                                </span>
                              </div>
                              {event.start_time && (
                                <div className="flex items-center gap-1.5">
                                  <span>🕐</span>
                                  <span>{event.start_time.substring(0, 5)}</span>
                                  {event.end_time && event.end_time !== event.start_time && (
                                    <span> - {event.end_time.substring(0, 5)}</span>
                                  )}
                                </div>
                              )}
                              {event.location && (
                                <div className="flex items-center gap-1.5">
                                  <span>📍</span>
                                  <span className="truncate max-w-xs">{event.location}</span>
                                </div>
                              )}
                              {!selectedDocument && (
                                <div className="flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5" />
                                  <span className="truncate max-w-xs">{event.documentName}</span>
                                </div>
                              )}
                            </div>
                            {event.metadata?.is_range_with_day && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500 text-blue-600">
                                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                                  Will expand to multiple events on import
                                </Badge>
                              </div>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity self-start"
                          onClick={(e) => openDeleteDialog(event.id, e)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setEventToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSingleEvent}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure OpenAI API Key</DialogTitle>
            <DialogDescription>
              Add your OpenAI API key to enable AI-powered event extraction. The AI will automatically detect all dates, times, meetings, assignments, and deadlines from your documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">OpenAI API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
            </div>
            {hasApiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>API key is configured</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyDialogOpen(false)
                setOpenaiApiKey('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveApiKey}>
              Save API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
