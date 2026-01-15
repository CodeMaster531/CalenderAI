export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ text: string; meta?: Record<string, any> }> {
  const text = buffer.toString('utf-8')
  return {
    text,
    meta: {
      filename,
      mimeType,
      size: buffer.length,
    },
  }
}
