import { type NextRequest, NextResponse } from "next/server"
import { buildICS } from "@/lib/calendar"
import type { EventSuggestion } from "@/lib/types"

interface ICSRequest {
  timezone?: string
  events: EventSuggestion[]
}

export async function POST(request: NextRequest) {
  try {
    const body: ICSRequest = await request.json()
    const { timezone = "America/New_York", events } = body

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events array" }, { status: 400 })
    }

    const icsContent = buildICS(events, timezone)

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": "attachment; filename=events.ics",
      },
    })
  } catch (error: any) {
    console.error("[v0] ICS generation error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate ICS file" }, { status: 500 })
  }
}
