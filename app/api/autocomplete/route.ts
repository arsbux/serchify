import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.trim().length === 0) {
    return NextResponse.json([])
  }

  try {
    const response = await fetch(
      `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    )

    if (!response.ok) {
      return NextResponse.json([])
    }

    const data = await response.json()

    // DuckDuckGo returns an array with [query, [suggestions]]
    const suggestions = Array.isArray(data) && data.length > 1 ? data[1] : []

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Autocomplete error:', error)
    return NextResponse.json([])
  }
}
