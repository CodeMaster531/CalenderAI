"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Check, Calendar, Clock, MapPin, Repeat } from "lucide-react"
import {
  getRecurringCandidates,
  acceptRecurringCandidate,
  rejectRecurringCandidate,
  detectAndSaveRecurringCandidates
} from "@/lib/recurring-candidates"
import { RecurringCandidate } from "@/lib/recurring-detection"
import { toast } from "sonner"
import { format } from "date-fns"

interface RecurringCandidatesPanelProps {
  userId: string
}

export function RecurringCandidatesPanel({ userId }: RecurringCandidatesPanelProps) {
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    loadCandidates()
  }, [userId])

  const loadCandidates = async () => {
    if (!userId) return
    try {
      setIsLoading(true)
      const data = await getRecurringCandidates(userId, 'pending')
      setCandidates(data)
    } catch (error) {
      console.error('Error loading candidates:', error)
      toast.error('Failed to load recurring event suggestions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDetect = async () => {
    if (!userId) return
    try {
      setIsLoading(true)
      await detectAndSaveRecurringCandidates(userId)
      await loadCandidates()
      toast.success('Detected recurring patterns in your events')
    } catch (error) {
      console.error('Error detecting patterns:', error)
      toast.error('Failed to detect recurring patterns')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async (candidateId: string) => {
    try {
      setProcessingId(candidateId)
      await acceptRecurringCandidate(candidateId)
      setCandidates(prev => prev.filter(c => c.id !== candidateId))
      toast.success('Created repeating event series')
    } catch (error) {
      console.error('Error accepting candidate:', error)
      toast.error('Failed to create series')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (candidateId: string) => {
    try {
      setProcessingId(candidateId)
      await rejectRecurringCandidate(candidateId)
      setCandidates(prev => prev.filter(c => c.id !== candidateId))
      toast.success('Dismissed suggestion')
    } catch (error) {
      console.error('Error rejecting candidate:', error)
      toast.error('Failed to dismiss')
    } finally {
      setProcessingId(null)
    }
  }

  const parseRRule = (rrule: string) => {
    const parts = rrule.split(';')
    let freq = ''
    let byday = ''
    let until = ''

    for (const part of parts) {
      const [key, value] = part.split('=')
      if (key === 'FREQ') freq = value
      else if (key === 'BYDAY') byday = value
      else if (key === 'UNTIL') until = value
    }

    let description = ''
    if (freq === 'WEEKLY') description = 'Every week'
    else if (freq === 'BIWEEKLY') description = 'Every 2 weeks'
    else if (freq === 'DAILY') description = 'Every day'

    if (byday) {
      const days = byday.split(',').map(d => {
        const dayMap: Record<string, string> = {
          'MO': 'Mon', 'TU': 'Tue', 'WE': 'Wed', 'TH': 'Thu', 'FR': 'Fri', 'SA': 'Sat', 'SU': 'Sun'
        }
        return dayMap[d] || d
      })
      description += ` on ${days.join(', ')}`
    }

    if (until) {
      const year = until.substring(0, 4)
      const month = until.substring(4, 6)
      const day = until.substring(6, 8)
      description += ` until ${month}/${day}/${year}`
    }

    return description
  }

  if (candidates.length === 0 && !isLoading) {
    return (
      <Card className="glass-subtle p-6 rounded-2xl">
        <div className="text-center space-y-4">
          <Repeat className="h-12 w-12 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recurring Patterns Found</h3>
            <p className="text-sm text-gray-600 mb-4">
              We analyze your events to detect repeating patterns like weekly meetings or office hours.
            </p>
            <Button
              onClick={handleDetect}
              className="bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl smooth-transition rounded-xl"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Detect Patterns
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recurring Event Suggestions</h3>
          <p className="text-sm text-gray-600">We found patterns in your calendar that could be repeating events</p>
        </div>
        <Button
          onClick={handleDetect}
          variant="outline"
          size="sm"
          className="glass-subtle border-white/40 hover:bg-white/60 smooth-transition rounded-xl"
        >
          <Repeat className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Card className="glass-subtle p-8 rounded-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Analyzing your events...</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <Card
              key={candidate.id}
              className="glass p-6 rounded-2xl hover-lift smooth-transition border border-white/40"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Repeat className="h-5 w-5 text-blue-500" />
                      <h4 className="text-lg font-semibold text-gray-900">{candidate.title}</h4>
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-700 border-blue-200/50 backdrop-blur-sm"
                      >
                        {Math.round(candidate.confidence_score * 100)}% confidence
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{parseRRule(candidate.suggested_rrule)}</span>
                      </div>

                      {candidate.start_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{candidate.start_time}</span>
                        </div>
                      )}

                      {candidate.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{candidate.location}</span>
                        </div>
                      )}

                      <div className="pt-2 text-xs text-gray-600">
                        Found {candidate.event_ids.length} matching events from{' '}
                        {format(new Date(candidate.occurrence_dates[0]), 'MMM d')} to{' '}
                        {format(new Date(candidate.occurrence_dates[candidate.occurrence_dates.length - 1]), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/20">
                  <Button
                    onClick={() => handleAccept(candidate.id)}
                    disabled={processingId === candidate.id}
                    className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl smooth-transition rounded-xl font-semibold"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Convert to Series
                  </Button>
                  <Button
                    onClick={() => handleReject(candidate.id)}
                    disabled={processingId === candidate.id}
                    variant="outline"
                    className="glass-subtle border-white/40 hover:bg-white/60 smooth-transition rounded-xl"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
