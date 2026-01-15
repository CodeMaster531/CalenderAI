"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Sparkles,
  Loader2,
  Calendar,
  CheckSquare,
  Target,
  Mic,
  MicOff,
  ListChecks,
  MapPin,
  Clock3,
} from "lucide-react"
import { parseNaturalLanguageInput, type ParsedInput } from "@/lib/ai-parser"
import { createTask, type TaskPriority } from "@/lib/tasks"
import { getTaskLists, createTaskList, type TaskList } from "@/lib/task-lists"
import { createCalendarEvent } from "@/lib/calendar-events"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface AIQuickCreateProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess?: () => void
}

type TaskFormState = {
  listId: string
  title: string
  description: string
  priority: TaskPriority
  dueDate: string
  dueTime: string
  goal: string
  estimatedHours: string
  location: string
  syncToCalendar: boolean
}

const priorityOptions: Array<{ value: TaskPriority; label: string; badge: string }> = [
  { value: "critical", label: "Critical", badge: "bg-[color:var(--priority-critical)]/10 text-[color:var(--priority-critical)] border border-[color:var(--priority-critical)]/30" },
  { value: "high", label: "High", badge: "bg-[color:var(--priority-high)]/10 text-[color:var(--priority-high)] border border-[color:var(--priority-high)]/30" },
  { value: "medium", label: "Medium", badge: "bg-[color:var(--priority-medium)]/10 text-[color:var(--priority-medium)] border border-[color:var(--priority-medium)]/30" },
  { value: "low", label: "Low", badge: "bg-[color:var(--priority-low)]/15 text-[color:var(--priority-low)] border border-[color:var(--priority-low)]/30" },
]

export function AIQuickCreate({ isOpen, onClose, userId, onSuccess }: AIQuickCreateProps) {
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedInput | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormState | null>(null)
  const [taskLists, setTaskLists] = useState<TaskList[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const recognitionRef = useRef<any>(null)

  const exampleInputs = [
    "Capture project alpha tasks for this week with priorities",
    "Draft thesis outline by Friday 5pm at the library",
    "Call the dentist tomorrow at 2pm to confirm appointment",
    "Plan sprint retro next Monday 9am remote",
    "Log study session tonight for 2 hours at the lab",
  ]

  const ensureLists = useCallback(async (): Promise<TaskList[]> => {
    if (!userId) return []
    if (taskLists.length) return taskLists

    let lists = await getTaskLists(userId)
    if (!lists.length) {
      const defaultList = await createTaskList(userId, "Quick Tasks", "#3b82f6")
      lists = [defaultList]
    }

    setTaskLists(lists)
    return lists
  }, [taskLists, userId])

  useEffect(() => {
    if (isOpen) {
      void ensureLists()
    }
  }, [isOpen, ensureLists])

  useEffect(() => {
    if (taskLists.length && (!taskForm || !taskForm.listId)) {
      setTaskForm((prev) => {
        if (!prev) return null
        return { ...prev, listId: prev.listId || taskLists[0].id }
      })
    }
  }, [taskLists, taskForm])

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any)) {
      if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
        recognitionRef.current.lang = "en-US"

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
          setInput((prev) => prev + (prev ? " " : "") + transcript)
          setVoiceTranscript(transcript)
        setIsListening(false)
      }

      recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error)
        setIsListening(false)
          toast.error("Voice recognition failed. Please try again.")
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition is not supported in your browser")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setVoiceTranscript("")
      recognitionRef.current.start()
      setIsListening(true)
      toast.info("Listening... Speak now")
    }
  }

  const seedTaskForm = useCallback((parsed: ParsedInput, lists: TaskList[]) => {
    const defaultList = lists.find((list) => list.name === "Quick Tasks") || lists[0]

    setTaskForm({
      listId: defaultList?.id || "",
      title: parsed.title || "",
      description: parsed.description || "",
      priority: (parsed.priority as TaskPriority) || "medium",
      dueDate: parsed.dueDate || parsed.date || "",
      dueTime: parsed.time || "",
      goal: parsed.goal || "",
      estimatedHours: parsed.estimatedHours ? String(parsed.estimatedHours) : "",
      location: parsed.location || "",
      syncToCalendar: Boolean(parsed.dueDate || parsed.date),
    })
  }, [])

  const handleParse = async () => {
    if (!input.trim()) return

    try {
      setIsProcessing(true)
      const parsed = await parseNaturalLanguageInput(input)
      setParsedData(parsed)

      if (parsed.type === "task") {
        const lists = await ensureLists()
        seedTaskForm(parsed, lists)
      } else {
        setTaskForm(null)
      }

      toast.success("Parsed successfully! Review and create.")
    } catch (error) {
      console.error("Error parsing input:", error)
      toast.error(error instanceof Error ? error.message : "Failed to parse input")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreate = async () => {
    if (!parsedData) return

    try {
      setIsCreating(true)

      if (parsedData.type === "task") {
        const lists = await ensureLists()
        const targetListId = taskForm?.listId || lists[0]?.id

        if (!targetListId) {
          toast.error("Create a task list first.")
          return
        }

        const estimated = taskForm?.estimatedHours ? Number(taskForm.estimatedHours) : null
        const resolvedPriority: TaskPriority = taskForm?.priority || (parsedData.priority as TaskPriority) || "medium"
        const shouldStar = resolvedPriority === "critical" || resolvedPriority === "high"
        await createTask(userId, targetListId, taskForm?.title || parsedData.title, {
          notes: taskForm?.description || parsedData.description || "",
          dueDate: taskForm?.dueDate || parsedData.dueDate || undefined,
          dueTime: taskForm?.dueTime || parsedData.time || undefined,
          isStarred: shouldStar,
          priority: resolvedPriority,
          goal: taskForm?.goal || undefined,
          estimatedHours: estimated,
          location: taskForm?.location || parsedData.location || undefined,
          metadata: {
            source: "ai_quick_create",
            confidence: parsedData.confidence,
            voiceTranscript: voiceTranscript || undefined,
          },
          syncToCalendar: taskForm?.syncToCalendar ?? true,
        })

        toast.success("Task created!")
        window.dispatchEvent(new CustomEvent("refreshCalendar"))
      } else if (parsedData.type === "event") {
        if (!parsedData.date) {
          throw new Error("Event date is required")
        }

        const eventDate = parsedData.date
        const startTime = parsedData.time || "09:00:00"
        const endTime = parsedData.endTime || (parsedData.time ? `${addHour(parsedData.time)}:00` : "10:00:00")

        await createCalendarEvent({
          user_id: userId,
          title: parsedData.title,
          description: parsedData.description || undefined,
          event_date: eventDate,
          start_time: parsedData.time ? startTime : undefined,
          end_time: parsedData.time ? endTime : undefined,
          location: parsedData.location || undefined,
          category: mapCategoryToValid(parsedData.category),
          priority: (parsedData.priority as TaskPriority) || "medium",
          source: "manual",
          source_id: undefined,
          is_completed: false,
        })
        
        toast.success("Event created!")
        window.dispatchEvent(new CustomEvent("refreshCalendar"))
      } else {
        toast.info("Goal creation coming soon!")
      }

      handleClose()
      onSuccess?.()
    } catch (error) {
      console.error("Error creating:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create")
    } finally {
      setIsCreating(false)
    }
  }

  const handleReset = () => {
    setInput("")
    setParsedData(null)
    setTaskForm(null)
    setVoiceTranscript("")
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const updateTaskForm = (field: keyof TaskFormState, value: string | boolean) => {
    setTaskForm((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value } as TaskFormState
    })
  }

  const addHour = (time: string): string => {
    const [hours, minutes] = time.split(":").map(Number)
    const newHours = (hours + 1) % 24
    return `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }

  const mapCategoryToValid = (
    category: string | undefined,
  ): "assignment" | "exam" | "meeting" | "deadline" | "milestone" | "other" => {
    if (!category) return "other"
    const categoryLower = category.toLowerCase()
    const categoryMap: Record<
      string,
      "assignment" | "exam" | "meeting" | "deadline" | "milestone" | "other"
    > = {
      assignment: "assignment",
      exam: "exam",
      meeting: "meeting",
      deadline: "deadline",
      milestone: "milestone",
      other: "other",
      work: "assignment",
      personal: "other",
      health: "other",
      learning: "assignment",
      study: "assignment",
      class: "meeting",
      lecture: "meeting",
      appointment: "meeting",
      task: "other",
      office_hours: "meeting",
    }
    
    return categoryMap[categoryLower] || "other"
  }

  const renderTaskReview = () => {
    if (!parsedData || parsedData.type !== "task" || !taskForm) return null

  return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <Badge variant="secondary" className="capitalize">
              {parsedData.type}
            </Badge>
            {parsedData.confidence && (
              <span className="text-xs text-muted-foreground">{parsedData.confidence}% confident</span>
            )}
          </div>

          <div className="grid gap-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                Task list
              </Label>
              <Select
                value={taskForm.listId}
                onValueChange={(value) => updateTaskForm("listId", value)}
                disabled={!taskLists.length}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: list.color }} />
                        {list.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => updateTaskForm("title", e.target.value)}
                  className="mt-1"
                  placeholder="Task title"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea
                  value={taskForm.description}
                  onChange={(e) => updateTaskForm("description", e.target.value)}
                  rows={2}
                  className="mt-1"
                  placeholder="Optional notes or context"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {priorityOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={taskForm.priority === option.value ? "default" : "outline"}
                    className={cn(
                      "justify-start border text-left",
                      taskForm.priority === option.value
                        ? option.badge
                        : "bg-transparent hover:bg-muted text-muted-foreground",
                    )}
                    onClick={() => updateTaskForm("priority", option.value)}
                  >
                    <span className="text-xs font-medium">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due date
                </Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => updateTaskForm("dueDate", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Due time
                </Label>
                <Input
                  type="time"
                  value={taskForm.dueTime}
                  onChange={(e) => updateTaskForm("dueTime", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Goal
                </Label>
                <Input
                  value={taskForm.goal}
                  onChange={(e) => updateTaskForm("goal", e.target.value)}
                  className="mt-1"
                  placeholder="Why are you doing this?"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Estimated hours
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  value={taskForm.estimatedHours}
                  onChange={(e) => updateTaskForm("estimatedHours", e.target.value)}
                  className="mt-1"
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location
              </Label>
              <Input
                value={taskForm.location}
                onChange={(e) => updateTaskForm("location", e.target.value)}
                className="mt-1"
                placeholder="Optional location"
              />
                </div>

            <div className="rounded-lg border p-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Sync to calendar</p>
                <p className="text-xs text-muted-foreground">
                  Push this task to your calendar when a due date exists.
                </p>
              </div>
              <Switch
                checked={taskForm.syncToCalendar}
                onCheckedChange={(checked) => updateTaskForm("syncToCalendar", checked)}
              />
              </div>

            <div>
              <Label className="text-xs text-muted-foreground">Voice transcript</Label>
              <Textarea
                value={voiceTranscript || "Voice capture will appear here."}
                readOnly
                rows={2}
                className="mt-1 bg-muted/50"
              />
            </div>
                </div>
              </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setParsedData(null)
              setTaskForm(null)
            }}
            className="flex-1"
          >
            Edit Input
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
          >
            Reset
          </Button>
              <Button
            onClick={handleCreate}
            disabled={isCreating || !taskForm.title.trim()}
            className="flex-1"
              >
            {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
                  </>
                ) : (
              "Save Task"
                )}
              </Button>
        </div>
      </div>
    )
  }

  const renderGenericReview = () => {
    if (!parsedData) return null

    return (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-2">
            {parsedData.type === "event" && <Calendar className="h-4 w-4" />}
            {parsedData.type === "goal" && <Target className="h-4 w-4" />}
                  <Badge variant="secondary" className="capitalize">
                    {parsedData.type}
                  </Badge>
                  {parsedData.confidence && (
              <span className="text-xs text-muted-foreground">{parsedData.confidence}% confident</span>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input
                      value={parsedData.title}
                      onChange={(e) => setParsedData({ ...parsedData, title: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {parsedData.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Textarea
                        value={parsedData.description}
                        onChange={(e) => setParsedData({ ...parsedData, description: e.target.value })}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {parsedData.date && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={parsedData.date}
                          onChange={(e) => setParsedData({ ...parsedData, date: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {parsedData.time && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          type="time"
                          value={parsedData.time}
                          onChange={(e) => setParsedData({ ...parsedData, time: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  {parsedData.priority && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      <Select
                        value={parsedData.priority}
                        onValueChange={(value: any) => setParsedData({ ...parsedData, priority: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {parsedData.location && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Location</Label>
                      <Input
                        value={parsedData.location}
                        onChange={(e) => setParsedData({ ...parsedData, location: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
            onClick={() => {
              setParsedData(null)
              setTaskForm(null)
            }}
                  className="flex-1"
                >
                  Edit Input
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Create ${parsedData.type}`
                  )}
                </Button>
              </div>
            </>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Quick Create with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need. AI will parse it into the new Create Task fields for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!parsedData ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="input">What do you want to create?</Label>
                <div className="relative">
                  <Textarea
                    id="input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., Draft the client recap by Friday 2pm in the project notebook"
                    rows={4}
                    className="resize-none pr-12"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleParse()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={isListening ? "destructive" : "ghost"}
                    className={cn("absolute right-2 top-2", isListening && "animate-pulse")}
                    onClick={toggleVoiceInput}
                    title={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Cmd+Enter to parse • Click <Mic className="h-3 w-3 inline" /> to dictate
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Examples:</Label>
                <div className="flex flex-wrap gap-2">
                  {exampleInputs.map((example) => (
                    <Button
                      key={example}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setInput(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleParse}
                  disabled={!input.trim() || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Parse with AI
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </div>
            </>
          ) : parsedData.type === "task" ? (
            renderTaskReview()
          ) : (
            renderGenericReview()
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

