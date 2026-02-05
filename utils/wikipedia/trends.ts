import axios from 'axios'

interface TrendDataPoint {
  date: string
  views: number
}

interface TrendResult {
  keyword: string
  trends: TrendDataPoint[]
  averageViews: number
  peakViews: number
}

/**
 * Fetches Wikipedia pageview trends for a keyword over the past 30 days
 * Uses the official Wikimedia Pageviews API
 */
export async function fetchWikipediaTrends(keyword: string): Promise<TrendResult | null> {
  try {
    // Convert keyword to Wikipedia article title format (spaces to underscores, capitalize)
    const articleTitle = keyword
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('_')

    // Get date range (past 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '')
    }

    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)

    // Wikipedia Pageviews API endpoint
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(articleTitle)}/daily/${startDateStr}/${endDateStr}`

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'E-Commerce-SEO-Tool/1.0 (Educational Project)',
        'Accept': 'application/json'
      },
      timeout: 10000
    })

    if (response.data && response.data.items && response.data.items.length > 0) {
      const trends: TrendDataPoint[] = response.data.items.map((item: any) => ({
        date: item.timestamp.substring(0, 8), // YYYYMMDD format
        views: item.views
      }))

      const totalViews = trends.reduce((sum, item) => sum + item.views, 0)
      const averageViews = Math.round(totalViews / trends.length)
      const peakViews = Math.max(...trends.map(t => t.views))

      return {
        keyword,
        trends,
        averageViews,
        peakViews
      }
    }

    return null
  } catch (error: any) {
    console.error(`❌ Wikipedia trends error for "${keyword}":`, error.message)
    return null
  }
}

/**
 * Fetches trends for multiple keywords in parallel
 */
export async function fetchMultipleKeywordTrends(keywords: string[]): Promise<TrendResult[]> {
  const promises = keywords.map(kw => fetchWikipediaTrends(kw))
  const results = await Promise.all(promises)
  return results.filter((result): result is TrendResult => result !== null)
}

/**
 * Calculates trend direction (rising, falling, stable)
 */
export function calculateTrendDirection(trends: TrendDataPoint[]): 'rising' | 'falling' | 'stable' {
  if (trends.length < 7) return 'stable'

  const recentWeek = trends.slice(-7)
  const previousWeek = trends.slice(-14, -7)

  if (previousWeek.length === 0) return 'stable'

  const recentAvg = recentWeek.reduce((sum, t) => sum + t.views, 0) / recentWeek.length
  const previousAvg = previousWeek.reduce((sum, t) => sum + t.views, 0) / previousWeek.length

  const change = ((recentAvg - previousAvg) / previousAvg) * 100

  if (change > 10) return 'rising'
  if (change < -10) return 'falling'
  return 'stable'
}
