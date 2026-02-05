import googleTrends from 'google-trends-api'

interface TrendDataPoint {
  date: string
  value: number // Search interest (0-100 scale)
}

interface TrendResult {
  keyword: string
  trends: TrendDataPoint[]
  averageInterest: number
  peakInterest: number
  currentInterest: number
}

/**
 * Fetches Google Trends search interest data for a keyword over the past 30 days
 * Uses the unofficial google-trends-api package
 */
export async function fetchGoogleTrends(keyword: string): Promise<TrendResult | null> {
  try {
    // Get date range (past 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Fetch interest over time from Google Trends
    const resultsJson = await googleTrends.interestOverTime({
      keyword: keyword,
      startTime: startDate,
      endTime: endDate,
      geo: 'US' // United States - can be changed to '' for worldwide
    })

    const results = JSON.parse(resultsJson)

    if (!results.default || !results.default.timelineData || results.default.timelineData.length === 0) {
      console.log(`⚠️ No trend data available for "${keyword}"`)
      return null
    }

    // Transform the data
    const trends: TrendDataPoint[] = results.default.timelineData.map((item: any) => {
      // Google Trends returns timestamps, convert to readable format
      const date = new Date(parseInt(item.time) * 1000)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD

      // Extract search interest value (0-100 scale)
      const value = item.value && item.value.length > 0 ? item.value[0] : 0

      return {
        date: dateStr,
        value: value
      }
    })

    // Calculate statistics
    const values = trends.map(t => t.value)
    const totalInterest = values.reduce((sum, val) => sum + val, 0)
    const averageInterest = Math.round(totalInterest / values.length)
    const peakInterest = Math.max(...values)
    const currentInterest = values[values.length - 1] || 0

    return {
      keyword,
      trends,
      averageInterest,
      peakInterest,
      currentInterest
    }
  } catch (error: any) {
    console.error(`❌ Google Trends error for "${keyword}":`, error.message)
    return null
  }
}

/**
 * Fetches trends for multiple keywords with rate limiting
 * Google Trends has rate limits, so we add delays between requests
 */
export async function fetchMultipleKeywordTrends(keywords: string[]): Promise<TrendResult[]> {
  const results: TrendResult[] = []

  // Process keywords with delay to avoid rate limiting
  for (const keyword of keywords) {
    const result = await fetchGoogleTrends(keyword)
    if (result) {
      results.push(result)
    }

    // Add 500ms delay between requests to avoid rate limiting
    if (keywords.indexOf(keyword) < keywords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Fetches comparison trends for multiple keywords at once (more efficient)
 * Google Trends allows comparing up to 5 keywords in one request
 */
export async function fetchComparisonTrends(keywords: string[]): Promise<TrendResult[]> {
  try {
    if (keywords.length === 0 || keywords.length > 5) {
      throw new Error('Must provide 1-5 keywords for comparison')
    }

    // Get date range (past 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Fetch comparison data from Google Trends
    const resultsJson = await googleTrends.interestOverTime({
      keyword: keywords,
      startTime: startDate,
      endTime: endDate,
      geo: 'US'
    })

    // Google Trends sometimes returns HTML (CAPTCHA or rate limit) instead of JSON
    if (resultsJson.trim().startsWith('<')) {
      console.error('❌ Google Trends returned HTML (likely rate limited or blocked)')
      return []
    }

    const results = JSON.parse(resultsJson)

    if (!results.default || !results.default.timelineData || results.default.timelineData.length === 0) {
      console.log(`⚠️ No trend data available for keywords:`, keywords)
      return []
    }

    // Transform the data for each keyword
    const trendResults: TrendResult[] = keywords.map((keyword, keywordIndex) => {
      const trends: TrendDataPoint[] = results.default.timelineData.map((item: any) => {
        const date = new Date(parseInt(item.time) * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const value = item.value && item.value[keywordIndex] !== undefined ? item.value[keywordIndex] : 0

        return {
          date: dateStr,
          value: value
        }
      })

      const values = trends.map(t => t.value)
      const totalInterest = values.reduce((sum, val) => sum + val, 0)
      const averageInterest = Math.round(totalInterest / values.length)
      const peakInterest = Math.max(...values)
      const currentInterest = values[values.length - 1] || 0

      return {
        keyword,
        trends,
        averageInterest,
        peakInterest,
        currentInterest
      }
    })

    return trendResults
  } catch (error: any) {
    console.error(`❌ Google Trends comparison error:`, error.message)
    return []
  }
}

/**
 * Calculates trend direction (rising, falling, stable) based on recent vs previous data
 */
export function calculateTrendDirection(trends: TrendDataPoint[]): 'rising' | 'falling' | 'stable' {
  if (trends.length < 7) return 'stable'

  const recentWeek = trends.slice(-7)
  const previousWeek = trends.slice(-14, -7)

  if (previousWeek.length === 0) return 'stable'

  const recentAvg = recentWeek.reduce((sum, t) => sum + t.value, 0) / recentWeek.length
  const previousAvg = previousWeek.reduce((sum, t) => sum + t.value, 0) / previousWeek.length

  if (previousAvg === 0) return 'stable'

  const change = ((recentAvg - previousAvg) / previousAvg) * 100

  if (change > 15) return 'rising' // 15% increase
  if (change < -15) return 'falling' // 15% decrease
  return 'stable'
}

/**
 * Gets related queries for a keyword from Google Trends
 */
export async function fetchRelatedQueries(keyword: string): Promise<string[]> {
  try {
    const resultsJson = await googleTrends.relatedQueries({ keyword, geo: 'US' })
    const results = JSON.parse(resultsJson)

    const relatedQueries: string[] = []

    if (results.default && results.default.rankedList) {
      for (const list of results.default.rankedList) {
        if (list.rankedKeyword) {
          for (const item of list.rankedKeyword.slice(0, 5)) {
            if (item.query) {
              relatedQueries.push(item.query)
            }
          }
        }
      }
    }

    return relatedQueries
  } catch (error: any) {
    console.error(`❌ Related queries error for "${keyword}":`, error.message)
    return []
  }
}
