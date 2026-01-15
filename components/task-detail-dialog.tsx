"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, Trash2 } from "lucide-react"
import { type Task, type TaskPriority } from "@/lib/tasks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TaskDetailDialogProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onDelete: (taskId: string) => void
}

export function TaskDetailDialog({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailDialogProps) {
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [dueTime, setDueTime] = useState("")
  const [isStarred, setIsStarred] = useState(false)
  const [priorityLevel, setPriorityLevel] = useState<TaskPriority>("medium")
  const [estimatedHours, setEstimatedHours] = useState("")
  const [progressPercent, setProgressPercent] = useState(0)
  const [goal, setGoal] = useState("")
  const [location, setLocation] = useState("")

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setNotes(task.notes || "")
      setDueDate(task.due_date || "")
      setIsStarred(task.is_starred)
      setPriorityLevel(task.priority)
      setEstimatedHours(task.estimated_hours ? String(task.estimated_hours) : "")
      setProgressPercent(task.progress ?? (task.is_completed ? 100 : 0))
      setDueTime(task.due_time || "")
      setGoal(task.goal || "")
      setLocation(task.location || "")
    }
  }, [task])

  const handleSave = () => {
    if (!task) return

    onUpdate(task.id, {
      title: title.trim(),
      notes: notes.trim(),
      due_date: dueDate || null,
      is_starred: isStarred,
      priority: priorityLevel,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      progress: progressPercent,
      due_time: dueTime || null,
      goal: goal.trim() || null,
      location: location.trim() || null,
    })
    onClose()
  }

  const handleDelete = () => {
    if (!task) return
    onDelete(task.id)
  }

  if (!task) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Task</DialogTitle>
            <button
              onClick={() => {
                setIsStarred(!isStarred)
              }}
              className={`p-2 rounded-full transition-colors ${
                isStarred
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-gray-300 hover:text-gray-400"
              }`}
            >
              <Star className={`h-5 w-5 ${isStarred ? "fill-current" : ""}`} />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add detailed notes..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date & Time</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Input
                id="dueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-32"
              />
              {(dueDate || dueTime) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDueDate("")
                    setDueTime("")
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label>Priority level</Label>
            <Select value={priorityLevel} onValueChange={(value) => setPriorityLevel(value as TaskPriority)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimated-hours">Estimated hours</Label>
            <Input
              id="estimated-hours"
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 2.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="goal">Goal</Label>
            <Input
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What is this task driving?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional location"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="progress">Progress (%)</Label>
          <div className="flex items-center gap-4">
            <input
            id="progress"
              type="range"
            min="0"
            max="100"
            value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12 text-right">
              {progressPercent}%
            </span>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
