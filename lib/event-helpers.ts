import {
  BookOpen,
  ClipboardList,
  Users,
  Flag,
  Trophy,
  Calendar,
  type LucideIcon
} from "lucide-react"

export type EventCategory = 'assignment' | 'exam' | 'meeting' | 'deadline' | 'milestone' | 'other'

export const pastelCategoryColors = {
  assignment: {
    pill: "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 backdrop-blur-sm border border-blue-200/30 smooth-transition",
    card: "bg-gradient-to-br from-blue-50/30 to-blue-100/20 border-l-blue-400 backdrop-blur-md hover-lift",
    bar: "border-l-blue-400 shadow-blue-200/50"
  },
  exam: {
    pill: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 backdrop-blur-sm border border-rose-200/30 smooth-transition",
    card: "bg-gradient-to-br from-rose-50/30 to-rose-100/20 border-l-rose-400 backdrop-blur-md hover-lift",
    bar: "border-l-rose-400 shadow-rose-200/50"
  },
  meeting: {
    pill: "bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 backdrop-blur-sm border border-cyan-200/30 smooth-transition",
    card: "bg-gradient-to-br from-cyan-50/30 to-cyan-100/20 border-l-cyan-400 backdrop-blur-md hover-lift",
    bar: "border-l-cyan-400 shadow-cyan-200/50"
  },
  deadline: {
    pill: "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 backdrop-blur-sm border border-amber-200/30 smooth-transition",
    card: "bg-gradient-to-br from-amber-50/30 to-amber-100/20 border-l-amber-400 backdrop-blur-md hover-lift",
    bar: "border-l-amber-400 shadow-amber-200/50"
  },
  milestone: {
    pill: "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 backdrop-blur-sm border border-emerald-200/30 smooth-transition",
    card: "bg-gradient-to-br from-emerald-50/30 to-emerald-100/20 border-l-emerald-400 backdrop-blur-md hover-lift",
    bar: "border-l-emerald-400 shadow-emerald-200/50"
  },
  other: {
    pill: "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20 backdrop-blur-sm border border-slate-200/30 smooth-transition",
    card: "bg-gradient-to-br from-slate-50/30 to-slate-100/20 border-l-slate-400 backdrop-blur-md hover-lift",
    bar: "border-l-slate-400 shadow-slate-200/50"
  }
}

export const categoryIcons: Record<EventCategory, LucideIcon> = {
  assignment: ClipboardList,
  exam: BookOpen,
  meeting: Users,
  deadline: Flag,
  milestone: Trophy,
  other: Calendar
}

export function getCategoryIcon(category: EventCategory): LucideIcon {
  return categoryIcons[category] || Calendar
}

export function formatCompactTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const start = formatCompactTime(startTime)
  const end = formatCompactTime(endTime)
  const [startHourMin, startPeriod] = start.split(' ')
  const [endHourMin, endPeriod] = end.split(' ')

  if (startPeriod === endPeriod) {
    return `${startHourMin}–${endHourMin} ${endPeriod}`
  }
  return `${start}–${end}`
}
