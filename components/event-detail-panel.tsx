"use client"

import { X, MapPin, Clock, Tag, AlertCircle, CheckCircle2, Trash2, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type CalendarEvent } from "@/lib/calendar-events"
import { getCategoryIcon, formatTimeRange, pastelCategoryColors } from "@/lib/event-helpers"
import { format } from "date-fns"

interface EventDetailPanelProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (eventId: string) => void
  onToggleComplete?: (eventId: string, completed: boolean) => void
}

export function EventDetailPanel({
  event,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete
}: EventDetailPanelProps) {
  if (!event) return null

  const CategoryIcon = getCategoryIcon(event.category as any)
  const categoryColor = pastelCategoryColors[event.category as keyof typeof pastelCategoryColors]

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-md z-40 smooth-transition ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 bottom-0 w-[420px] glass-strong shadow-2xl z-50 transition-all duration-500 ease-out border-l border-white/20 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col backdrop-blur-xl">
          <div className="p-6 border-b border-white/20 bg-gradient-to-br from-white/40 to-white/20 rounded-tl-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <CategoryIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                    {event.category}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight tracking-tight">
                  {event.title}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 -mt-1 smooth-transition hover:scale-110 hover:bg-gray-100/80 rounded-xl"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-transparent to-white/10">
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-3 rounded-xl hover:bg-white/40 smooth-transition">
                <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}
                  </div>
                  {event.start_time && event.end_time && (
                    <div className="text-sm text-gray-700 mt-1.5 font-mono font-medium">
                      {formatTimeRange(
                        event.start_time.substring(0, 5),
                        event.end_time.substring(0, 5)
                      )}
                    </div>
                  )}
                </div>
              </div>

              {event.location && (
                <div className="flex items-start gap-3.5 p-3 rounded-xl hover:bg-white/40 smooth-transition">
                  <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{event.location}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3.5 p-3 rounded-xl hover:bg-white/40 smooth-transition">
                <Tag className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs px-3 py-1.5 rounded-full bg-gray-500/10 text-gray-700 font-semibold border border-gray-200/50 backdrop-blur-sm">
                    {event.priority}
                  </span>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border smooth-transition ${
                    event.is_completed
                      ? 'bg-emerald-500/10 text-emerald-800 border-emerald-200/50 backdrop-blur-sm'
                      : 'bg-amber-500/10 text-amber-800 border-amber-200/50 backdrop-blur-sm'
                  }`}>
                    {event.is_completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>

              {event.description && (
                <div className="flex items-start gap-3.5 p-3 rounded-xl hover:bg-white/40 smooth-transition">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">
                      {event.description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/20">
              <div className="text-xs text-gray-600 space-y-1.5 font-medium">
                <div>Source: {event.source}</div>
                <div>Created: {format(new Date(event.created_at), "MMM d, yyyy 'at' h:mm a")}</div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/20 bg-gradient-to-t from-white/40 to-transparent space-y-2.5 rounded-bl-2xl">
            {onToggleComplete && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 glass-subtle border-white/40 hover:bg-white/60 smooth-transition hover:shadow-md rounded-xl font-semibold"
                onClick={() => onToggleComplete(event.id, !event.is_completed)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {event.is_completed ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 glass-subtle border-white/40 hover:bg-white/60 smooth-transition hover:shadow-md rounded-xl font-semibold"
                onClick={() => onEdit(event)}
              >
                <Edit className="h-4 w-4" />
                Edit Event
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-red-600 hover:bg-red-50/80 hover:text-red-700 border-red-200/50 backdrop-blur-sm smooth-transition hover:shadow-md rounded-xl font-semibold"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this event?')) {
                    onDelete(event.id)
                    onClose()
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete Event
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
