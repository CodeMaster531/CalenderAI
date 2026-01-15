import { type NextRequest, NextResponse } from "next/server"
import { extractText } from "@/lib/textify"
import { extractEventSuggestions } from "@/lib/nlp"
import type { UploadResponse } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Upload API called")
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.log("[v0] No file provided in request")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[v0] File received:", { name: file.name, type: file.type, size: file.size })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log("[v0] Buffer created, size:", buffer.length)

    if (buffer.length === 0) {
      console.log("[v0] Empty buffer received")
      return NextResponse.json({ error: "File is empty" }, { status: 400 })
    }

    // 1) Text extraction (OCR / PDF / DOCX / Plain)
    console.log("[v0] Starting text extraction")
    const { text, meta } = await extractText(buffer, file.name, file.type)
    console.log("[v0] Text extraction complete, text length:", text.length)

    if (!text || !text.trim()) {
      console.log("[v0] No text extracted from file")
      return NextResponse.json(
        { error: "No text could be extracted. Try a clearer scan or another format." },
        { status: 400 },
      )
    }

    // 2) NLP → suggested events
    console.log("[v0] Extracting event suggestions from text")
    const suggestions = extractEventSuggestions(text)
    console.log("[v0] Found", suggestions.length, "event suggestions")

    const payload: UploadResponse = {
      source: {
        filename: file.name,
        contentType: file.type,
        bytes: file.size,
        meta,
      },
      suggestions,
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: error.message || "Failed to process file" }, { status: 500 })
  }
}
