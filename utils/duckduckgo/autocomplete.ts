import axios from 'axios'

export interface DDGSuggestion {
  query: string
  relevance: number
}

export interface DDGIntentData {
  keyword: string
  suggestions: DDGSuggestion[]
  userIntent: string[]
  questionPhrases: string[]
  commercialIntent: string[]
}

/**
 * DuckDuckGo Autocomplete - The Intent Engine
 * Free, no rate limits, real-time user search data
 *
 * Fetches the natural language suggestions that appear when users type
 * This reveals EXACT questions and pain points customers are searching for
 */
export async function fetchDDGIntentData(
  keywords: string[],
  maxKeywords: number = 5
): Promise<DDGIntentData[]> {
  const results: DDGIntentData[] = []
  const keywordsToAnalyze = keywords.slice(0, maxKeywords)

  console.log(`🦆 DuckDuckGo Intent Engine: Analyzing ${keywordsToAnalyze.length} keywords...`)

  for (const keyword of keywordsToAnalyze) {
    try {
      const intentData = await fetchSingleKeywordIntent(keyword)
      if (intentData) {
        results.push(intentData)
        console.log(`✅ Got ${intentData.suggestions.length} suggestions for "${keyword}"`)
      }

      // Small delay to be respectful
      await delay(300)
    } catch (error: any) {
      console.error(`❌ DDG error for "${keyword}":`, error.message)
    }
  }

  console.log(`✅ DDG Intent Engine: Analyzed ${results.length}/${keywordsToAnalyze.length} keywords`)
  return results
}

/**
 * Fetch intent data for a single keyword
 */
async function fetchSingleKeywordIntent(keyword: string): Promise<DDGIntentData | null> {
  try {
    // DuckDuckGo Autocomplete API (public, no auth needed)
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    })

    // DDG returns array format: [query, [suggestions]]
    const data = response.data

    if (!Array.isArray(data) || data.length < 2) {
      return null
    }

    const rawSuggestions = data[1] || []

    // Convert to our format with relevance score (position-based)
    const suggestions: DDGSuggestion[] = rawSuggestions.map((suggestion: string, index: number) => ({
      query: suggestion,
      relevance: 100 - (index * 10) // Higher position = higher relevance
    }))

    // Categorize suggestions by intent
    const userIntent: string[] = []
    const questionPhrases: string[] = []
    const commercialIntent: string[] = []

    suggestions.forEach(s => {
      const query = s.query.toLowerCase()

      // Detect questions
      if (query.match(/^(how|what|why|when|where|who|which|can|should|do|does|is|are)/)) {
        questionPhrases.push(s.query)
      }

      // Detect commercial intent
      if (query.match(/\b(buy|purchase|price|cost|cheap|affordable|best|top|review|vs|compare)\b/)) {
        commercialIntent.push(s.query)
      }

      // Everything is user intent
      userIntent.push(s.query)
    })

    return {
      keyword,
      suggestions,
      userIntent,
      questionPhrases,
      commercialIntent
    }

  } catch (error: any) {
    console.error(`Error fetching DDG data for "${keyword}":`, error.message)
    return null
  }
}

/**
 * Get variations and related searches for keyword expansion
 */
export async function getDDGVariations(keyword: string): Promise<string[]> {
  const intentData = await fetchSingleKeywordIntent(keyword)

  if (!intentData) {
    return []
  }

  // Return all suggestions as potential variations
  return intentData.suggestions.map(s => s.query)
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Batch fetch with intelligent variations
 * Gets base keyword + common prefixes/suffixes
 */
export async function fetchDDGWithVariations(
  keyword: string
): Promise<{ base: DDGIntentData | null; variations: DDGIntentData[] }> {
  const results: DDGIntentData[] = []

  // Get base keyword
  const baseData = await fetchSingleKeywordIntent(keyword)

  // Try common variations for e-commerce
  const variations = [
    `best ${keyword}`,
    `${keyword} review`,
    `buy ${keyword}`,
    `${keyword} price`,
    `cheap ${keyword}`
  ]

  for (const variation of variations) {
    try {
      const varData = await fetchSingleKeywordIntent(variation)
      if (varData) {
        results.push(varData)
      }
      await delay(300)
    } catch (error) {
      // Continue on error
    }
  }

  return {
    base: baseData,
    variations: results
  }
}
