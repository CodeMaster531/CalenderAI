"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, MapPin, Clock, Users, Sparkles } from "lucide-react"

interface ParsedEvent {
  title: string
  date: string
  time: string
  location?: string
  attendees?: string[]
  description: string
  confidence: number
  category: "meeting" | "appointment" | "travel" | "personal" | "other"
}

export function EmailParser() {
  const [emailContent, setEmailContent] = useState("")
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const sampleEmails = [
    {
      subject: "Team Meeting Tomorrow",
      content: `Hi everyone,

Just a reminder that we have our weekly team meeting tomorrow (Tuesday, October 1st) at 2:00 PM in Conference Room B. We'll be discussing the Q4 roadmap and project updates.

Please bring your status reports.

Best,
Sarah`,
    },
    {
      subject: "Doctor Appointment Confirmation",
      content: `Dear Patient,

This is to confirm your appointment with Dr. Smith on Friday, September 29th at 10:30 AM.

Location: Medical Center, 123 Health St, Suite 200
Phone: (555) 123-4567

Please arrive 15 minutes early for check-in.

Thank you,
Medical Center Staff`,
    },
  ]

  const parseEmail = async (content: string) => {
    setIsProcessing(true)

    // Simulate AI parsing - in real app, this would call an AI service
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock parsed results based on content
    const mockResults: ParsedEvent[] = []

    if (content.includes("team meeting") || content.includes("meeting")) {
      mockResults.push({
        title: "Team Meeting",
        date: "2024-10-01",
        time: "14:00",
        location: "Conference Room B",
        attendees: ["sarah@company.com", "team@company.com"],
        description: "Weekly team meeting - Q4 roadmap and project updates",
        confidence: 95,
        category: "meeting",
      })
    }

    if (content.includes("appointment") || content.includes("doctor")) {
      mockResults.push({
        title: "Doctor Appointment",
        date: "2024-09-29",
        time: "10:30",
        location: "Medical Center, 123 Health St, Suite 200",
        description: "Appointment with Dr. Smith",
        confidence: 98,
        category: "appointment",
      })
    }

    setParsedEvents(mockResults)
    setIsProcessing(false)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "meeting":
        return "bg-[color:var(--goal-work)]"
      case "appointment":
        return "bg-[color:var(--goal-health)]"
      case "travel":
        return "bg-[color:var(--goal-personal)]"
      case "personal":
        return "bg-[color:var(--goal-personal)]"
      default:
        return "bg-[color:var(--priority-medium)]"
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-[color:var(--priority-low)]"
    if (confidence >= 70) return "text-[color:var(--priority-medium)]"
    return "text-[color:var(--priority-high)]"
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Email Event Parser</h2>
        <p className="text-sm text-muted-foreground">
          Paste email content to automatically extract calendar events using AI
        </p>
      </div>

      {/* Sample Emails */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Try with sample emails:</h3>
        <div className="flex flex-wrap gap-2">
          {sampleEmails.map((sample, index) => (
            <Button key={index} variant="outline" size="sm" onClick={() => setEmailContent(sample.content)}>
              {sample.subject}
            </Button>
          ))}
        </div>
      </div>

      {/* Email Input */}
      <div className="space-y-3">
        <Textarea
          placeholder="Paste your email content here..."
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          className="min-h-[200px]"
        />
        <div className="flex space-x-2">
          <Button
            onClick={() => parseEmail(emailContent)}
            disabled={!emailContent.trim() || isProcessing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isProcessing ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Parse Events
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setEmailContent("")}>
            Clear
          </Button>
        </div>
      </div>

      {/* Parsed Results */}
      {parsedEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Detected Events</h3>
          {parsedEvents.map((event, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-1">
                  <h4 className="font-medium">{event.title}</h4>
                  <div className="flex items-center space-x-2">
                    <Badge className={`${getCategoryColor(event.category)} text-white text-xs`}>{event.category}</Badge>
                    <Badge variant="outline" className={`text-xs ${getConfidenceColor(event.confidence)}`}>
                      {event.confidence}% confident
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{event.time}</span>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{event.location}</span>
                  </div>
                )}

                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{event.attendees.join(", ")}</span>
                  </div>
                )}

                <p>{event.description}</p>
              </div>

              <div className="flex space-x-2 mt-4">
                <Button size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Add to Calendar
                </Button>
                <Button variant="outline" size="sm">
                  Edit Details
                </Button>
                <Button variant="outline" size="sm">
                  Ignore
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
