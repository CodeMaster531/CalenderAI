"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, CheckSquare, Star, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react"
import { getTaskLists, createTaskList, toggleListVisibility, type TaskList } from "@/lib/task-lists"
import { getTasks } from "@/lib/tasks"
import { toast } from "sonner"

interface TaskSidebarProps {
  userId: string
  activeFilter: string
  onFilterChange: (filter: string) => void
}

export function TaskSidebar({ userId, activeFilter, onFilterChange }: TaskSidebarProps) {
  const [lists, setLists] = useState<TaskList[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [isCreatingList, setIsCreatingList] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [isListsExpanded, setIsListsExpanded] = useState(true)
  const [allTasksCount, setAllTasksCount] = useState(0)
  const [starredCount, setStarredCount] = useState(0)

  useEffect(() => {
    loadLists()
    loadCounts()
  }, [userId])

  const loadLists = async () => {
    try {
      const data = await getTaskLists(userId)
      setLists(data)
    } catch (error) {
      console.error('Error loading task lists:', error)
      toast.error('Failed to load task lists')
    }
  }

  const loadCounts = async () => {
    try {
      const allTasks = await getTasks(userId, { isCompleted: false })
      setAllTasksCount(allTasks.length)

      const starredTasks = await getTasks(userId, { isStarred: true, isCompleted: false })
      setStarredCount(starredTasks.length)

      const counts: Record<string, number> = {}
      for (const list of lists) {
        const listTasks = await getTasks(userId, { listId: list.id, isCompleted: false })
        counts[list.id] = listTasks.length
      }
      setTaskCounts(counts)
    } catch (error) {
      console.error('Error loading task counts:', error)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) return

    try {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
      const randomColor = colors[Math.floor(Math.random() * colors.length)]

      await createTaskList(userId, newListName.trim(), randomColor)
      setNewListName("")
      setIsCreatingList(false)
      await loadLists()
      toast.success('List created')
    } catch (error) {
      console.error('Error creating list:', error)
      toast.error('Failed to create list')
    }
  }

  const handleToggleVisibility = async (listId: string, currentVisibility: boolean) => {
    try {
      await toggleListVisibility(listId, !currentVisibility)
      await loadLists()
    } catch (error) {
      console.error('Error toggling visibility:', error)
      toast.error('Failed to update list visibility')
    }
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">Tasks</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={`w-full justify-start text-sm font-normal ${
              activeFilter === "all" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => onFilterChange("all")}
          >
            <CheckSquare className="h-4 w-4 mr-3" />
            All Tasks
            {allTasksCount > 0 && (
              <Badge variant="secondary" className="ml-auto bg-gray-100 text-gray-700">
                {allTasksCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start text-sm font-normal ${
              activeFilter === "starred" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => onFilterChange("starred")}
          >
            <Star className="h-4 w-4 mr-3" />
            Starred
            {starredCount > 0 && (
              <Badge variant="secondary" className="ml-auto bg-gray-100 text-gray-700">
                {starredCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => setIsListsExpanded(!isListsExpanded)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
            >
              {isListsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              My Lists
            </button>
          </div>

          {isListsExpanded && (
            <div className="space-y-1">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    activeFilter === `list:${list.id}` ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    onClick={() => onFilterChange(`list:${list.id}`)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className={`text-sm truncate ${
                      activeFilter === `list:${list.id}` ? "text-blue-700 font-medium" : "text-gray-700"
                    }`}>
                      {list.name}
                    </span>
                    {taskCounts[list.id] > 0 && (
                      <Badge variant="secondary" className="ml-auto bg-gray-100 text-gray-700 text-xs">
                        {taskCounts[list.id]}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(list.id, list.is_visible)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                  >
                    {list.is_visible ? (
                      <Eye className="h-3 w-3 text-gray-500" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                </div>
              ))}

              {isCreatingList ? (
                <div className="px-2 py-1.5">
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateList()
                      if (e.key === 'Escape') {
                        setIsCreatingList(false)
                        setNewListName("")
                      }
                    }}
                    onBlur={() => {
                      if (newListName.trim()) {
                        handleCreateList()
                      } else {
                        setIsCreatingList(false)
                      }
                    }}
                    placeholder="List name"
                    className="h-7 text-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm font-normal text-gray-600 hover:text-gray-900"
                  onClick={() => setIsCreatingList(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New List
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
