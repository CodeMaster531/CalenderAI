"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Clock, CheckCircle2, TrendingUp, Filter, Calendar, MapPin } from "lucide-react"
import { toast } from "sonner"
import { computePriorityStats, getPrioritySnapshot, sortPriorityTasks, type PriorityTask, type PriorityFilter } from "@/lib/priorities"
import { toggleTaskComplete } from "@/lib/tasks"
import { cn } from "@/lib/utils"

const emptyStats = {
  total: 0,
  completed: 0,
  overdue: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
}

const priorityIcons = {
  critical: AlertTriangle,
  high: TrendingUp,
  medium: Clock,
  low: CheckCircle2,
}

const priorityAccent = {
  critical: {
    cardBorder: "border-[color:var(--priority-critical)]/50 bg-[color:var(--priority-critical)]/5",
    badge: "bg-[color:var(--priority-critical)]/15 text-[color:var(--priority-critical)] border border-[color:var(--priority-critical)]/30",
  },
  high: {
    cardBorder: "border-[color:var(--priority-high)]/40 bg-[color:var(--priority-high)]/5",
    badge: "bg-[color:var(--priority-high)]/15 text-[color:var(--priority-high)] border border-[color:var(--priority-high)]/30",
  },
  medium: {
    cardBorder: "border-[color:var(--priority-medium)]/40 bg-[color:var(--priority-medium)]/5",
    badge: "bg-[color:var(--priority-medium)]/15 text-[color:var(--priority-medium)] border border-[color:var(--priority-medium)]/30",
  },
  low: {
    cardBorder: "border-[color:var(--priority-low)]/30 bg-[color:var(--priority-low)]/10",
    badge: "bg-[color:var(--priority-low)]/20 text-[color:var(--priority-low)] border border-[color:var(--priority-low)]/30",
  },
}

interface PriorityDashboardProps {
  userId: string
}

export function PriorityDashboard({ userId }: PriorityDashboardProps) {
  const [tasks, setTasks] = useState<PriorityTask[]>([])
  const [stats, setStats] = useState(emptyStats)
  const [filter, setFilter] = useState<PriorityFilter>("all")
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) return
    try {
      setIsLoading(true)
      const snapshot = await getPrioritySnapshot(userId)
      setTasks(snapshot.tasks)
      setStats(snapshot.stats)
    } catch (error) {
      console.error("Failed to load priority data", error)
      toast.error("Unable to load priority data right now.")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadData()
  }, [userId, loadData])

  // Listen for task creation/update events to refresh the dashboard
  useEffect(() => {
    const handleRefresh = () => {
      loadData()
    }
    
    window.addEventListener('refreshCalendar', handleRefresh)
    window.addEventListener('refreshTasks', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshCalendar', handleRefresh)
      window.removeEventListener('refreshTasks', handleRefresh)
    }
  }, [loadData])

  const updateTasksState = useCallback((updater: (prev: PriorityTask[]) => PriorityTask[]) => {
    setTasks((prev) => {
      const next = updater(prev)
      setStats(computePriorityStats(next))
      return next
    })
  }, [])

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    updateTasksState((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, is_completed: completed, progress: completed ? 100 : 0 } : task,
      ),
    )

    try {
      await toggleTaskComplete(taskId, completed)
    } catch (error) {
      console.error("Failed to update task completion", error)
      toast.error("Could not update task. Restoring previous state.")
      await loadData()
    }
  }

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks
    return tasks.filter((task) => task.priority === filter)
  }, [tasks, filter])

  const sortedTasks = useMemo(() => sortPriorityTasks(filteredTasks), [filteredTasks])

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const today = new Date()
    const diffTime = due.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const formatDueTime = (date: string | null, time: string | null) => {
    if (!date || !time) return null
    try {
      const iso = `${date}T${time.length === 5 ? `${time}:00` : time}`
      return format(parseISO(iso), "p")
    } catch {
      return null
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Priority Dashboard</h1>
          <p className="text-muted-foreground">Focus on what matters most</p>
        </div>
        <div className="flex items-center space-x-2">
          {isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Refreshing…</span>
          )}
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as PriorityFilter)}
            className="bg-background border border-border rounded-md px-3 py-1 text-sm"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[color:var(--priority-critical)]/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-[color:var(--priority-critical)]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold">{stats.critical}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold">{stats.overdue}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-muted rounded-lg">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Priority Tasks */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Priority Tasks</h2>
        <div className="space-y-3">
          {isLoading && tasks.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Loading priority data…</Card>
          ) : sortedTasks.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {filter === "all" ? "No tasks available yet." : `No ${filter} tasks to show.`}
            </Card>
          ) : (
            sortedTasks.map((task) => {
              const daysLeft = getDaysUntilDue(task.due_date)
              const PriorityIcon = priorityIcons[task.priority]
              const isOverdue = typeof daysLeft === "number" && daysLeft < 0 && !task.is_completed
              const dueCopy =
                daysLeft === null
                  ? "No due date"
                  : isOverdue
                    ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue`
                    : daysLeft === 0
                      ? "Due today"
                      : daysLeft === 1
                        ? "Due tomorrow"
                        : `${daysLeft} days left`
              const dueTimeLabel = formatDueTime(task.due_date, task.due_time)
              const progressValue = Math.min(100, Math.max(0, task.progress ?? (task.is_completed ? 100 : 0)))
              const accent = priorityAccent[task.priority]

              return (
                <Card
                  key={task.id}
                  className={cn(
                    "p-5 rounded-2xl border-2 shadow-sm transition-all hover:shadow-lg",
                    accent.cardBorder,
                    task.is_completed && "opacity-60",
                    isOverdue && "border-destructive/70",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      className="mt-1 rounded border-border"
                      onChange={(e) => handleToggleComplete(task.id, e.target.checked)}
                    />

                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                          <h3
                              className={cn(
                                "text-base font-semibold text-foreground",
                                task.is_completed && "line-through text-muted-foreground",
                              )}
                          >
                            {task.title}
                          </h3>
                          </div>
                          {task.notes && (
                            <p className="text-sm text-muted-foreground max-w-3xl">{task.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Goal:</span>{" "}
                            {task.goal || task.task_lists?.name || "Personal"}
                          </p>
                        </div>

                        <Badge className={cn("capitalize text-xs font-semibold px-3 py-1 rounded-full", accent.badge)}>
                            <PriorityIcon className="h-3 w-3 mr-1" />
                          {task.priority}
                          </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>Progress</span>
                          <span>{progressValue}%</span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              isOverdue && "text-destructive font-medium",
                            )}
                          >
                            <Calendar className="h-3 w-3" />
                            {dueCopy}
                            {dueTimeLabel && <span className="text-muted-foreground">• {dueTimeLabel}</span>}
                          </span>
                          {task.estimated_hours && task.estimated_hours > 0 && (
                            <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                              {task.estimated_hours}h estimated
                            </span>
                          )}
                          {task.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {task.location}
                            </span>
                          )}
                        </div>

                        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-medium">
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
