import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('GEMINI_API_KEY environment variable is not set')
}

const genAI = new GoogleGenerativeAI(apiKey || '')

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const { keyword } = await request.json()

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
    }

    console.log('Generating keyword suggestions for:', keyword)

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const prompt = `You are an SEO expert specializing in keyword research. Analyze the following keyword and suggest 10 related keywords that typically have higher or similar search volume.

Keyword: "${keyword}"

Requirements:
1. Suggest keywords that are semantically related or variations of the input keyword
2. Focus on keywords that typically have good search volume potential
3. Include a mix of:
   - Longer-tail variations (e.g., "best [keyword]", "buy [keyword]", "[keyword] for sale")
   - Related terms and synonyms
   - Category variations
4. Make suggestions commercially relevant for e-commerce
5. Avoid exact duplicates of the input keyword

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    "suggested keyword 1",
    "suggested keyword 2",
    "suggested keyword 3",
    "suggested keyword 4",
    "suggested keyword 5",
    "suggested keyword 6",
    "suggested keyword 7",
    "suggested keyword 8",
    "suggested keyword 9",
    "suggested keyword 10"
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()

    console.log('AI response received, parsing JSON...')

    const data = JSON.parse(text)

    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      console.error('Invalid response format from AI:', data)
      throw new Error('Invalid response format')
    }

    const suggestions = data.suggestions.slice(0, 10)
    console.log('Successfully generated', suggestions.length, 'keyword suggestions')

    return NextResponse.json({ suggestions })

  } catch (error: any) {
    console.error('Keyword suggestions error:', error)

    // Provide more specific error messages
    let errorMessage = 'Failed to generate keyword suggestions'
    if (error.message?.includes('API key')) {
      errorMessage = 'API authentication failed. Please check configuration.'
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.'
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Failed to parse AI response. Please try again.'
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    )
  }
}
