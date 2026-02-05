import axios from 'axios'

interface TrendDataPoint {
  date: string
  searchVolume: number
}

interface KeywordTrendData {
  keyword: string
  trends: TrendDataPoint[]
  averageVolume: number
  peakVolume: number
  currentVolume: number
  trendDirection: 'rising' | 'falling' | 'stable'
  monthlySearches: number
  source: 'google_trends' | 'wikipedia' | 'estimated'
}

/**
 * Multi-source trend fetcher - Uses free APIs with smart fallbacks
 * 1. Try Wikipedia Pageviews (free, reliable, no rate limits)
 * 2. Fallback to estimated data (always works)
 *
 * Note: Google Trends scraping removed - too fragile and unreliable
 */
export async function fetchFreeSearchTrends(
  keywords: string[],
  maxKeywords: number = 5
): Promise<KeywordTrendData[]> {
  const keywordsToAnalyze = keywords.slice(0, maxKeywords)
  const results: KeywordTrendData[] = []

  console.log(`🔍 Fetching trends for ${keywordsToAnalyze.length} keywords...`)

  // Method 1: Try Wikipedia Pageviews (fast and reliable)
  console.log('📖 Method 1: Trying Wikipedia Pageviews API...')

  for (const keyword of keywordsToAnalyze) {
    const wikipediaData = await tryWikipediaPageviews(keyword)
    if (wikipediaData) {
      results.push(wikipediaData)
      console.log(`✅ Got Wikipedia data for "${keyword}"`)
    }
    await delay(500) // Small delay to be polite
  }

  // Method 2: Generate estimates for remaining keywords
  const successfulKeywords = results.map(r => r.keyword.toLowerCase())
  const remainingKeywords = keywordsToAnalyze.filter(
    kw => !successfulKeywords.includes(kw.toLowerCase())
  )

  if (remainingKeywords.length > 0) {
    console.log(`📈 Method 2: Generating estimates for ${remainingKeywords.length} remaining keywords...`)

    for (const keyword of remainingKeywords) {
      const estimatedData = generateEstimatedTrends(keyword)
      results.push(estimatedData)
      console.log(`✅ Generated estimate for "${keyword}"`)
    }
  }

  console.log(`✅ Final results: ${results.length}/${keywordsToAnalyze.length} keywords with data`)

  // Log source breakdown
  const wikiCount = results.filter(r => r.source === 'wikipedia').length
  const estCount = results.filter(r => r.source === 'estimated').length
  console.log(`📊 Sources: ${wikiCount} Wikipedia, ${estCount} Estimated`)

  return results
}

// Note: Google Trends scraping is now handled by google-trends-scraper.ts
// which uses Puppeteer to avoid API rate limits

/**
 * Try to fetch data from Wikipedia Pageviews API (free, reliable)
 */
async function tryWikipediaPageviews(keyword: string): Promise<KeywordTrendData | null> {
  try {
    // Convert keyword to Wikipedia article format
    const articleTitle = keyword
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_')

    // Get past 12 months
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 12)

    const startStr = formatWikipediaDate(startDate)
    const endStr = formatWikipediaDate(endDate)

    // Wikipedia Pageviews API - completely free, no auth needed
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(articleTitle)}/monthly/${startStr}/${endStr}`

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'SEO-Tool/1.0 (Educational Purpose)'
      }
    })

    if (!response.data?.items || response.data.items.length === 0) {
      return null
    }

    const trends: TrendDataPoint[] = response.data.items.map((item: any) => ({
      date: `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-01`,
      searchVolume: item.views || 0
    }))

    const volumes = trends.map(t => t.searchVolume)

    return {
      keyword,
      trends,
      averageVolume: calculateAverage(volumes),
      peakVolume: Math.max(...volumes),
      currentVolume: volumes[volumes.length - 1] || 0,
      trendDirection: calculateTrendDirection(volumes),
      monthlySearches: volumes[volumes.length - 1] || 0,
      source: 'wikipedia'
    }
  } catch (error: any) {
    console.log(`⚠️ Wikipedia error for "${keyword}":`, error.message)
    return null
  }
}

/**
 * Generate estimated trends based on keyword characteristics
 * Used as last resort when APIs fail
 */
function generateEstimatedTrends(keyword: string): KeywordTrendData {
  // Estimate base volume from keyword characteristics
  let baseVolume = 1000 // Default

  // Longer keywords typically have lower volume
  if (keyword.length > 30) baseVolume = 500
  else if (keyword.length > 20) baseVolume = 1500
  else if (keyword.length < 10) baseVolume = 5000

  // Check for commercial intent keywords
  const commercialTerms = ['buy', 'best', 'top', 'review', 'cheap', 'affordable', 'price']
  if (commercialTerms.some(term => keyword.toLowerCase().includes(term))) {
    baseVolume *= 1.5
  }

  // Generate 12 months of synthetic data with realistic variation
  const trends: TrendDataPoint[] = []
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    const dateStr = date.toISOString().slice(0, 7) + '-01'

    // Add seasonal variation and random noise
    const seasonalFactor = 1 + Math.sin((date.getMonth() / 12) * 2 * Math.PI) * 0.2
    const randomNoise = 0.8 + Math.random() * 0.4
    const volume = Math.round(baseVolume * seasonalFactor * randomNoise)

    trends.push({ date: dateStr, searchVolume: volume })
  }

  const volumes = trends.map(t => t.searchVolume)

  return {
    keyword,
    trends,
    averageVolume: calculateAverage(volumes),
    peakVolume: Math.max(...volumes),
    currentVolume: volumes[volumes.length - 1] || 0,
    trendDirection: calculateTrendDirection(volumes),
    monthlySearches: volumes[volumes.length - 1] || 0,
    source: 'estimated'
  }
}

/**
 * Group daily data into monthly aggregates
 */
function groupByMonth(trends: TrendDataPoint[]): TrendDataPoint[] {
  const monthlyData = new Map<string, number[]>()

  trends.forEach(point => {
    const monthKey = point.date.slice(0, 7) + '-01' // YYYY-MM-01
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, [])
    }
    monthlyData.get(monthKey)!.push(point.searchVolume)
  })

  return Array.from(monthlyData.entries())
    .map(([date, volumes]) => ({
      date,
      searchVolume: Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calculate trend direction
 */
function calculateTrendDirection(volumes: number[]): 'rising' | 'falling' | 'stable' {
  if (volumes.length < 6) return 'stable'

  const recent = volumes.slice(-3)
  const previous = volumes.slice(-6, -3)

  if (recent.length === 0 || previous.length === 0) return 'stable'

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length

  if (previousAvg === 0) return 'stable'

  const change = ((recentAvg - previousAvg) / previousAvg) * 100

  if (change > 15) return 'rising'
  if (change < -15) return 'falling'
  return 'stable'
}

/**
 * Calculate average of array
 */
function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
}

/**
 * Format date for Wikipedia API (YYYYMMDD00)
 */
function formatWikipediaDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}00`
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Format volume for display
 */
export function formatSearchVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
  return volume.toString()
}
