import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// TEMPORARY: Feature disabled for debugging __dirname error
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'error',
        data: { message: 'Competitor analysis temporarily unavailable while we fix deployment issues.' }
      })}\n\n`))
      controller.close()
    }
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
