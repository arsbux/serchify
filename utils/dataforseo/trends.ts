import axios from 'axios'

interface TrendDataPoint {
  date: string
  searchVolume: number // Actual search volume estimate
}

interface KeywordTrendData {
  keyword: string
  trends: TrendDataPoint[]
  averageVolume: number
  peakVolume: number
  currentVolume: number
  trendDirection: 'rising' | 'falling' | 'stable'
  monthlySearches: number
}

/**
 * Fetches real search volume trends from DataForSEO API
 * DataForSEO provides Google Trends data and search volume estimates
 * Free tier: 100 API calls/month
 */
export async function fetchKeywordTrends(
  keywords: string[],
  login: string,
  password: string
): Promise<KeywordTrendData[]> {
  try {
    // DataForSEO Google Trends endpoint
    const url = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live'

    const requestData = keywords.map(keyword => ({
      keyword: keyword,
      location_code: 2840, // United States
      language_code: 'en',
      include_serp_info: false,
      limit: 1
    }))

    const response = await axios.post(
      url,
      requestData,
      {
        auth: {
          username: login,
          password: password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    if (response.data.status_code !== 20000) {
      console.error('❌ DataForSEO API error:', response.data.status_message)
      return []
    }

    const results: KeywordTrendData[] = []

    // Process each keyword's data
    for (const task of response.data.tasks || []) {
      if (task.result && task.result.length > 0) {
        const keywordData = task.result[0]

        // Get historical data (monthly search volume trends)
        const monthlySearches = keywordData.keyword_info?.monthly_searches || []

        // Transform to our format
        const trends: TrendDataPoint[] = monthlySearches.map((item: any) => ({
          date: `${item.year}-${String(item.month).padStart(2, '0')}-01`,
          searchVolume: item.search_volume || 0
        }))

        // Calculate metrics
        const volumes = trends.map(t => t.searchVolume)
        const avgVolume = volumes.length > 0
          ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
          : 0
        const peakVolume = volumes.length > 0 ? Math.max(...volumes) : 0
        const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0

        // Calculate trend direction
        const trendDirection = calculateTrendDirection(volumes)

        results.push({
          keyword: keywordData.keyword || '',
          trends,
          averageVolume: avgVolume,
          peakVolume: peakVolume,
          currentVolume: currentVolume,
          trendDirection,
          monthlySearches: keywordData.keyword_info?.search_volume || 0
        })
      }
    }

    return results

  } catch (error: any) {
    console.error('❌ DataForSEO trends error:', error.message)
    return []
  }
}

/**
 * Simplified trends using Google Keyword Planner data from DataForSEO
 */
export async function fetchSearchVolumeTrends(
  keywords: string[],
  login: string,
  password: string
): Promise<KeywordTrendData[]> {
  try {
    // Use Keywords Data endpoint for search volume
    const url = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live'

    const requestData = [{
      keywords: keywords.slice(0, 10), // Limit to 10 keywords
      location_code: 2840, // United States
      language_code: 'en'
    }]

    const response = await axios.post(
      url,
      requestData,
      {
        auth: {
          username: login,
          password: password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    if (response.data.status_code !== 20000) {
      console.error('❌ DataForSEO API error:', response.data.status_message)
      return []
    }

    const results: KeywordTrendData[] = []
    const task = response.data.tasks?.[0]

    if (task?.result) {
      for (const item of task.result) {
        if (item.search_volume === undefined) continue

        // Get monthly searches for trend data
        const monthlySearches = item.monthly_searches || []

        // Create trend data points (last 12 months)
        const trends: TrendDataPoint[] = monthlySearches
          .slice(-12)
          .map((m: any) => ({
            date: `${m.year}-${String(m.month).padStart(2, '0')}-01`,
            searchVolume: m.search_volume || 0
          }))

        const volumes = trends.map(t => t.searchVolume)
        const avgVolume = volumes.length > 0
          ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
          : item.search_volume
        const peakVolume = volumes.length > 0 ? Math.max(...volumes) : item.search_volume
        const currentVolume = volumes.length > 0 ? volumes[volumes.length - 1] : item.search_volume

        results.push({
          keyword: item.keyword || '',
          trends,
          averageVolume: avgVolume,
          peakVolume: peakVolume,
          currentVolume: currentVolume,
          trendDirection: calculateTrendDirection(volumes),
          monthlySearches: item.search_volume
        })
      }
    }

    return results

  } catch (error: any) {
    console.error('❌ DataForSEO search volume error:', error.message)
    return []
  }
}

/**
 * Calculate trend direction from volume data
 */
function calculateTrendDirection(volumes: number[]): 'rising' | 'falling' | 'stable' {
  if (volumes.length < 6) return 'stable'

  // Compare recent 3 months vs previous 3 months
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
 * Format monthly searches into a readable string
 */
export function formatSearchVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
  return volume.toString()
}
