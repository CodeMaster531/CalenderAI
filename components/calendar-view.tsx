"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, MapPin, Search, Menu, CircleCheck as CheckCircle2, GripVertical, ChevronDown, ChevronUp, Moon, Sun, Maximize2, Minimize2 } from "lucide-react"
import { getCalendarEvents, updateCalendarEvent, deleteCalendarEvent, type CalendarEvent } from "@/lib/calendar-events"
import { EventDetailPanel } from "@/components/event-detail-panel"
import { getCategoryIcon, formatTimeRange, formatCompactTime, pastelCategoryColors } from "@/lib/event-helpers"
import { getUserPreferences, saveUserPreferences } from "@/lib/user-preferences"
import { toast } from "sonner"
import { format } from "date-fns"

type DragState = {
  eventId: string
  startY: number
  startTop: number
  originalStartTime: string
}

interface CalendarViewProps {
  userId: string
}

export function CalendarView({ userId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week" | "month">("week")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showOvernightHours, setShowOvernightHours] = useState(false)
  const [denseMode, setDenseMode] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [expandedAllDayDays, setExpandedAllDayDays] = useState<Set<string>>(new Set())
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const timeSlots = showOvernightHours
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 18 }, (_, i) => i + 6)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!userId) return
    loadEvents()
    loadUserPreferences()
  }, [userId, currentDate, refreshTrigger])
  
  // Listen for custom events to refresh calendar (e.g., when tasks are created)
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshTrigger(prev => prev + 1)
    }
    
    window.addEventListener('refreshCalendar', handleRefresh)
    return () => window.removeEventListener('refreshCalendar', handleRefresh)
  }, [])

  const loadUserPreferences = async () => {
    if (!userId) return
    const prefs = await getUserPreferences(userId)
    if (prefs) {
      setDarkMode(prefs.dark_mode)
      setDenseMode(prefs.dense_mode)
      setShowOvernightHours(prefs.show_overnight_hours)
    }
  }

  const updatePreference = async (key: 'dark_mode' | 'dense_mode' | 'show_overnight_hours', value: boolean) => {
    if (!userId) return
    await saveUserPreferences(userId, { [key]: value })
  }

  const loadEvents = async () => {
    if (!userId) return
    try {
      setIsLoading(true)
      const startDate = new Date(currentDate)
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date(currentDate)
      endDate.setDate(endDate.getDate() + 30)

      // Load calendar events (includes tasks with due dates as they're now synced to calendar_events)
      const calendarData = await getCalendarEvents(
        userId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )

      setEvents(calendarData)
    } catch (error) {
      console.error('Error loading events:', error)
      toast.error('Failed to load calendar events')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getEventPosition = (time: string, duration: number) => {
    const [hours, minutes] = time.split(":").map(Number)
    const startMinutes = hours * 60 + minutes
    const offsetHours = showOvernightHours ? 0 : 6
    const top = ((startMinutes - offsetHours * 60) / 60) * (denseMode ? 48 : 60)
    const height = (duration / 60) * (denseMode ? 48 : 60)
    return { top, height }
  }

  const getTimeFromPosition = (top: number) => {
    const offsetHours = showOvernightHours ? 0 : 6
    const hourHeight = denseMode ? 48 : 60
    const totalMinutes = Math.round((top / hourHeight) * 60) + offsetHours * 60
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const startTime = event.start_time?.substring(0, 5) || '09:00'
    const { top } = getEventPosition(startTime, 60)

    setDragState({
      eventId: event.id,
      startY: e.clientY,
      startTop: top,
      originalStartTime: event.start_time || '09:00:00'
    })
  }, [showOvernightHours, denseMode])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !gridRef.current) return

    const hourHeight = denseMode ? 48 : 60
    const deltaY = e.clientY - dragState.startY
    const newTop = Math.max(0, dragState.startTop + deltaY)
    const roundedTop = Math.round(newTop / 15) * 15

    const eventElement = document.getElementById(`event-${dragState.eventId}`)
    if (eventElement) {
      const headerHeight = denseMode ? 44 : 52
      eventElement.style.top = `${roundedTop + headerHeight}px`
    }
  }, [dragState, denseMode])

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!dragState) return

    const hourHeight = denseMode ? 48 : 60
    const deltaY = e.clientY - dragState.startY
    const newTop = Math.max(0, dragState.startTop + deltaY)
    const roundedTop = Math.round(newTop / 15) * 15
    const newStartTime = getTimeFromPosition(roundedTop)

    try {
      const event = events.find(e => e.id === dragState.eventId)
      if (!event) return

      let newEndTime = event.end_time
      if (event.start_time && event.end_time) {
        const [oldSH, oldSM] = event.start_time.split(':').map(Number)
        const [oldEH, oldEM] = event.end_time.split(':').map(Number)
        const duration = (oldEH * 60 + oldEM) - (oldSH * 60 + oldSM)

        const [newSH, newSM] = newStartTime.split(':').map(Number)
        const endMinutes = newSH * 60 + newSM + duration
        const endH = Math.floor(endMinutes / 60) % 24
        const endM = endMinutes % 60
        newEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`
      }

      await updateCalendarEvent(dragState.eventId, {
        start_time: newStartTime,
        end_time: newEndTime
      })

      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === dragState.eventId
            ? { ...e, start_time: newStartTime, end_time: newEndTime }
            : e
        )
      )

      toast.success('Event time updated')
    } catch (error) {
      console.error('Error updating event:', error)
      toast.error('Failed to update event time')
      await loadEvents()
    } finally {
      setDragState(null)
    }
  }, [dragState, events, showOvernightHours, denseMode])

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState, handleMouseMove, handleMouseUp])

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }

  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const offsetHours = showOvernightHours ? 0 : 6
    const hourHeight = denseMode ? 48 : 60
    return ((totalMinutes - offsetHours * 60) / 60) * hourHeight
  }

  const toggleAllDayExpansion = (dayString: string) => {
    setExpandedAllDayDays(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayString)) {
        newSet.delete(dayString)
      } else {
        newSet.add(dayString)
      }
      return newSet
    })
  }

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId)
      setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId))
      toast.success('Event deleted')
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    }
  }

  const handleToggleComplete = async (eventId: string, completed: boolean) => {
    try {
      await updateCalendarEvent(eventId, { is_completed: completed })
      setEvents(prevEvents =>
        prevEvents.map(e =>
          e.id === eventId ? { ...e, is_completed: completed } : e
        )
      )
      toast.success(completed ? 'Event marked as complete' : 'Event marked as incomplete')
    } catch (error) {
      console.error('Error updating event:', error)
      toast.error('Failed to update event')
    }
  }

  const containerClasses = darkMode ? 'bg-gray-900/50 text-white' : 'bg-white/50 text-gray-900'
  const borderColor = darkMode ? 'border-white/10' : 'border-gray-200/40'
  const lightBorderColor = darkMode ? 'border-white/5' : 'border-gray-100/30'
  const headerHeight = denseMode ? 44 : 52
  const hourHeight = denseMode ? 48 : 60

  return (
    <div className={`flex flex-col h-full ${containerClasses} animate-in-smooth`}>
      <div className={`flex items-center justify-between px-6 py-2.5 border-b ${borderColor} sticky top-0 z-30 glass-strong rounded-b-2xl shadow-lg`}>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`text-sm font-semibold smooth-transition ${darkMode ? 'glass border-white/20 hover:bg-white/10' : 'glass-subtle border-gray-300/50 hover:bg-white/80'} rounded-xl`}
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const newDate = new Date(currentDate)
                if (view === "day") newDate.setDate(newDate.getDate() - 1)
                else if (view === "week") newDate.setDate(newDate.getDate() - 7)
                else newDate.setMonth(newDate.getMonth() - 1)
                setCurrentDate(newDate)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const newDate = new Date(currentDate)
                if (view === "day") newDate.setDate(newDate.getDate() + 1)
                else if (view === "week") newDate.setDate(newDate.getDate() + 7)
                else newDate.setMonth(newDate.getMonth() + 1)
                setCurrentDate(newDate)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className={`text-xl font-normal ${darkMode ? 'text-gray-100' : 'text-gray-800'} tracking-tight`}>{formatDate(currentDate)}</h2>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 smooth-transition hover:scale-110 rounded-xl"
            onClick={() => {
              const newValue = !darkMode
              setDarkMode(newValue)
              updatePreference('dark_mode', newValue)
            }}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 smooth-transition hover:scale-110 rounded-xl"
            onClick={() => {
              const newValue = !denseMode
              setDenseMode(newValue)
              updatePreference('dense_mode', newValue)
            }}
            title={denseMode ? "Normal mode" : "Dense mode"}
          >
            {denseMode ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 smooth-transition hover:scale-110 rounded-xl">
            <Search className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          </Button>
          <div className={`flex ${darkMode ? 'glass border-white/10' : 'glass-subtle border-gray-300/40'} rounded-2xl overflow-hidden shadow-lg`}>
            {(["day", "week", "month"] as const).map((viewType) => (
              <Button
                key={viewType}
                variant="ghost"
                size="sm"
                className={`capitalize rounded-xl border-0 px-4 smooth-transition ${
                  view === viewType
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                    : darkMode
                      ? "text-gray-300 hover:bg-white/10"
                      : "text-gray-700 hover:bg-white/60"
                }`}
                onClick={() => setView(viewType)}
              >
                {viewType}
              </Button>
            ))}
          </div>
          <Button className="bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl hover:shadow-blue-500/40 smooth-transition hover:scale-105 shadow-lg font-medium rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-scale-in">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className={`mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'} tracking-wide`}>Loading events...</p>
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="h-full overflow-auto">
            <div className="min-w-[900px]">
              {events.filter(event => {
                const weekDays = getWeekDays()
                const eventDate = new Date(event.event_date)
                return weekDays.some(day => day.toDateString() === eventDate.toDateString()) && !event.start_time
              }).length > 0 && (
                <div className={`border-b ${borderColor} glass-subtle rounded-t-2xl overflow-hidden`}>
                  <div className="flex">
                    <div className={`w-14 flex-shrink-0 border-r ${borderColor}`} />
                    {getWeekDays().map((day, index) => {
                      const dayString = day.toDateString()
                      const allDayEvents = events.filter(event => {
                        const eventDate = new Date(event.event_date)
                        return eventDate.toDateString() === dayString && !event.start_time
                      })
                      const isExpanded = expandedAllDayDays.has(dayString)
                      const visibleEvents = isExpanded ? allDayEvents : allDayEvents.slice(0, 2)
                      const hiddenCount = allDayEvents.length - visibleEvents.length

                      return (
                        <div key={index} className={`flex-1 min-w-[120px] border-r ${borderColor} last:border-r-0 px-2 py-3 space-y-1.5`}>
                          {visibleEvents.map(event => {
                            const CategoryIcon = getCategoryIcon(event.category as any)
                            const categoryStyle = pastelCategoryColors[event.category as keyof typeof pastelCategoryColors]
                            return (
                              <button
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`w-full px-3 py-2 rounded-full text-xs font-medium truncate cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow-md ${
                                  categoryStyle.pill
                                } ${event.is_completed ? 'opacity-60 line-through' : ''}`}
                              >
                                <CategoryIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{event.title}</span>
                              </button>
                            )
                          })}
                          {hiddenCount > 0 && (
                            <button
                              onClick={() => toggleAllDayExpansion(dayString)}
                              className={`w-full px-2 py-1.5 rounded-full text-xs font-medium cursor-pointer smooth-transition flex items-center justify-center gap-1 shadow-sm hover:shadow-md ${
                                darkMode ? 'glass-subtle text-gray-300 hover:bg-white/10' : 'glass-subtle text-gray-700 hover:bg-white/80'
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  +{hiddenCount} more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex">
                <div className={`w-14 flex-shrink-0 border-r ${borderColor} glass-subtle sticky left-0 z-20`}>
                  <div style={{ height: `${headerHeight}px` }} className={`border-b ${borderColor}`} />
                  {timeSlots.map((hour, index) => (
                    <div key={hour} style={{ height: `${hourHeight}px` }} className="relative">
                      {index > 0 && (
                        <span
                          className={`absolute -top-2.5 right-1.5 text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'} pr-0.5 font-medium font-mono tabular-nums`}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex-1 flex" ref={gridRef}>
                  {getWeekDays().map((day, dayIndex) => {
                    const isToday = day.toDateString() === new Date().toDateString()
                    const dayEvents = events.filter(event => {
                      const eventDate = new Date(event.event_date)
                      return eventDate.toDateString() === day.toDateString() && event.start_time
                    })

                    return (
                      <div
                        key={dayIndex}
                        className={`flex-1 min-w-[120px] relative border-r ${borderColor} last:border-r-0 smooth-transition ${
                          isToday ? (darkMode ? 'bg-blue-500/10 backdrop-blur-sm' : 'bg-blue-50/40 backdrop-blur-sm') : ''
                        }`}
                      >
                        <div
                          style={{ height: `${headerHeight}px` }}
                          className={`border-b ${borderColor} flex flex-col items-center justify-center sticky top-[57px] z-10 backdrop-blur-md smooth-transition ${
                            isToday ? (darkMode ? 'bg-blue-500/20' : 'bg-blue-50/60') : 'bg-white/30'
                          }`}
                        >
                          <div className={`text-[10px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-widest mb-0.5`}>
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className={`${denseMode ? 'text-lg' : 'text-xl'} font-semibold smooth-transition tabular-nums ${
                            isToday
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg shadow-blue-500/40 animate-glow'
                              : darkMode ? 'text-gray-200' : 'text-gray-800'
                          }`}>
                            {day.getDate()}
                          </div>
                        </div>

                        {timeSlots.map((hour, index) => {
                          const isThirdHour = hour % 3 === 0
                          return (
                            <div
                              key={hour}
                              style={{ height: `${hourHeight}px` }}
                              className={`border-t ${isThirdHour ? borderColor : lightBorderColor} smooth-transition ${
                                darkMode ? 'hover:bg-blue-500/5' : 'hover:bg-blue-50/40'
                              }`}
                            />
                          )
                        })}

                        {isToday && getCurrentTimePosition() >= 0 && (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none"
                            style={{ top: `${getCurrentTimePosition() + headerHeight}px` }}
                          >
                            <div className="flex items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-lg shadow-red-500/50 animate-pulse" />
                              <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-red-400 shadow-sm" />
                            </div>
                          </div>
                        )}

                        {dayEvents.map((event) => {
                          const startTime = event.start_time?.substring(0, 5) || '09:00'
                          const endTime = event.end_time?.substring(0, 5)

                          let duration = 60
                          if (endTime && event.start_time) {
                            const [sh, sm] = event.start_time.split(':').map(Number)
                            const [eh, em] = endTime.split(':').map(Number)
                            duration = (eh * 60 + em) - (sh * 60 + sm)
                          }

                          const { top, height } = getEventPosition(startTime, duration)
                          const isDragging = dragState?.eventId === event.id
                          const CategoryIcon = getCategoryIcon(event.category as any)
                          const categoryStyle = pastelCategoryColors[event.category as keyof typeof pastelCategoryColors]

                          return (
                            <div
                              id={`event-${event.id}`}
                              key={event.id}
                              className={`absolute left-1 right-1 rounded-2xl shadow-lg smooth-transition border-l-4 animate-in-smooth ${
                                categoryStyle.card
                              } ${categoryStyle.bar} ${event.is_completed ? 'opacity-60' : ''} ${
                                isDragging ? 'shadow-2xl cursor-grabbing z-50 scale-[1.03]' : 'cursor-grab hover:shadow-xl z-10'
                              } ${selectedEvent?.id === event.id ? 'ring-2 ring-blue-500/60 ring-offset-2 shadow-blue-500/30' : ''}`}
                              style={{
                                top: `${top + headerHeight}px`,
                                height: `${Math.max(height, denseMode ? 24 : 30)}px`,
                                userSelect: 'none'
                              }}
                              onMouseDown={(e) => handleMouseDown(e, event)}
                              onClick={() => setSelectedEvent(event)}
                            >
                              <div className={`${denseMode ? 'px-1.5 py-0.5' : 'px-2 py-1.5'} h-full flex flex-col relative group`}>
                                <div className="absolute left-0.5 top-0 bottom-0 flex items-center opacity-0 group-hover:opacity-100 smooth-transition">
                                  <GripVertical className={`${denseMode ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-gray-500`} />
                                </div>
                                <div className={denseMode ? 'pl-2.5' : 'pl-3'}>
                                  <div className="flex items-center gap-1.5">
                                    <CategoryIcon className={`${denseMode ? 'h-2.5 w-2.5' : 'h-3 w-3'} flex-shrink-0 ${darkMode ? 'text-gray-700' : 'text-gray-600'} opacity-80`} />
                                    <h4 className={`font-semibold ${denseMode ? 'text-[10px]' : 'text-xs'} ${darkMode ? 'text-gray-900' : 'text-gray-900'} truncate leading-tight flex items-center gap-1 tracking-wide`}>
                                      {event.is_completed && <CheckCircle2 className={`${denseMode ? 'h-2 w-2' : 'h-2.5 w-2.5'} text-green-600`} />}
                                      {event.title}
                                    </h4>
                                  </div>
                                  <div className={`${denseMode ? 'text-[9px]' : 'text-[10px]'} ${darkMode ? 'text-gray-700' : 'text-gray-700'} truncate leading-tight mt-0.5 font-mono tabular-nums opacity-90`}>
                                    {formatTimeRange(startTime, endTime || (() => {
                                      const [h, m] = startTime.split(":").map(Number)
                                      const endMinutes = h * 60 + m + duration
                                      const endH = Math.floor(endMinutes / 60) % 24
                                      const endM = endMinutes % 60
                                      return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`
                                    })())}
                                  </div>
                                  {event.location && height > (denseMode ? 40 : 50) && (
                                    <div className={`flex items-center gap-0.5 mt-0.5 ${denseMode ? 'text-[9px]' : 'text-[10px]'} ${darkMode ? 'text-gray-700' : 'text-gray-600'} opacity-75`}>
                                      <MapPin className={`${denseMode ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} />
                                      <span className="truncate">{event.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {!showOvernightHours && (
                <div className={`border-t ${borderColor} py-3 text-center glass-subtle`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowOvernightHours(true)
                      updatePreference('show_overnight_hours', true)
                    }}
                    className={`text-xs smooth-transition hover:scale-105 rounded-xl ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show overnight hours (12 AM - 6 AM)
                  </Button>
                </div>
              )}
              {showOvernightHours && (
                <div className={`border-t ${borderColor} py-3 text-center glass-subtle`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowOvernightHours(false)
                      updatePreference('show_overnight_hours', false)
                    }}
                    className={`text-xs smooth-transition hover:scale-105 rounded-xl ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide overnight hours
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center glass-subtle rounded-2xl m-4">
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} tracking-wide`}>Day and Month views coming soon</p>
          </div>
        )}
      </div>

      <EventDetailPanel
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
        onToggleComplete={handleToggleComplete}
      />
    </div>
  )
}
