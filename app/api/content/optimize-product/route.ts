import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// TEMPORARY: Feature disabled for debugging __dirname error
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Content optimization temporarily unavailable while we fix deployment issues.'
  }, { status: 503 })
}
