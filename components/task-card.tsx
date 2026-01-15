"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"
import { type Task, formatDueDate, isTaskOverdue, type TaskPriority } from "@/lib/tasks"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: Task
  onToggleComplete: (taskId: string, isCompleted: boolean) => void
  onToggleStarred: (taskId: string, isStarred: boolean) => void
  onClick: (task: Task) => void
}

export function TaskCard({ task, onToggleComplete, onToggleStarred, onClick }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const dueDateText = formatDueDate(task.due_date, task.due_time)
  const isOverdue = isTaskOverdue(task.due_date, task.due_time)
  const priorityColor = priorityColorMap[task.priority]

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover-lift",
        task.is_completed && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(task)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={(checked) => onToggleComplete(task.id, checked as boolean)}
          className="mt-0.5"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "text-sm font-semibold text-foreground break-words transition-colors duration-200",
              task.is_completed && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleStarred(task.id, !task.is_starred)
            }}
            className={cn(
              "flex-shrink-0 p-1 rounded transition-colors",
              task.is_starred
                ? "text-yellow-500 hover:text-yellow-600"
                : "text-gray-300 hover:text-gray-400",
              !task.is_starred && !isHovered && "opacity-0 group-hover:opacity-100"
            )}
          >
            <Star className={cn("h-4 w-4", task.is_starred && "fill-current")} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className={cn("text-[10px] uppercase tracking-wide", priorityColor.badge)}>
            {task.priority}
          </Badge>
          {task.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 break-words flex-1">{task.notes}</p>
          )}
        </div>

        {(task.goal || (task.estimated_hours && task.estimated_hours > 0) || task.location) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {task.goal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-purple-700 dark:text-purple-300 text-xs font-medium">
                <span role="img" aria-label="goal">🎯</span>
                {task.goal}
              </span>
            )}
            {task.estimated_hours && task.estimated_hours > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs font-medium">
                <span role="img" aria-label="effort">⏱</span>
                {task.estimated_hours}h
              </span>
            )}
            {task.location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <span role="img" aria-label="location">📍</span>
                {task.location}
              </span>
            )}
          </div>
        )}

        {dueDateText && (
          <div className="mt-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs font-medium",
                isOverdue
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {dueDateText}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

const priorityColorMap: Record<TaskPriority, { badge: string }> = {
  critical: { badge: "bg-[color:var(--priority-critical)]/10 text-[color:var(--priority-critical)] border border-[color:var(--priority-critical)]/40" },
  high: { badge: "bg-[color:var(--priority-high)]/10 text-[color:var(--priority-high)] border border-[color:var(--priority-high)]/40" },
  medium: { badge: "bg-[color:var(--priority-medium)]/10 text-[color:var(--priority-medium)] border border-[color:var(--priority-medium)]/40" },
  low: { badge: "bg-[color:var(--priority-low)]/15 text-[color:var(--priority-low)] border border-[color:var(--priority-low)]/40" },
}
