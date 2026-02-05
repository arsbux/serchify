import puppeteer, { Browser, Page } from 'puppeteer'

interface TrendDataPoint {
  date: string
  searchVolume: number
}

export interface ScrapedTrendData {
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
 * Scrape Google Trends directly using Puppeteer
 * This bypasses API rate limits by acting like a real browser
 */
export async function scrapeGoogleTrends(
  keywords: string[],
  maxKeywords: number = 5
): Promise<ScrapedTrendData[]> {
  let browser: Browser | null = null
  const results: ScrapedTrendData[] = []

  try {
    console.log('🚀 Launching browser for Google Trends scraping...')

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled', // Hide that we're using automation
      ]
    })

    const keywordsToScrape = keywords.slice(0, maxKeywords)

    for (const keyword of keywordsToScrape) {
      try {
        console.log(`📊 Scraping Google Trends for: "${keyword}"`)
        const trendData = await scrapeSingleKeyword(browser, keyword)

        if (trendData) {
          results.push(trendData)
          console.log(`✅ Successfully scraped "${keyword}"`)
        } else {
          console.log(`⚠️ No data found for "${keyword}"`)
        }

        // Random delay between 2-4 seconds to appear more human-like
        await delay(2000 + Math.random() * 2000)
      } catch (error: any) {
        console.error(`❌ Error scraping "${keyword}":`, error.message)
      }
    }

    return results

  } catch (error: any) {
    console.error('❌ Google Trends scraping error:', error.message)
    return results
  } finally {
    if (browser) {
      await browser.close()
      console.log('🔒 Browser closed')
    }
  }
}

/**
 * Scrape trends data for a single keyword
 */
async function scrapeSingleKeyword(
  browser: Browser,
  keyword: string
): Promise<ScrapedTrendData | null> {
  const page = await browser.newPage()

  try {
    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 })

    // Enable request interception to capture API calls
    await page.setRequestInterception(true)
    let trendsApiData: any = null

    page.on('request', (request) => {
      request.continue()
    })

    // Intercept responses to capture the trends data
    page.on('response', async (response) => {
      const url = response.url()

      // Google Trends loads data via API calls to /api/explore or /api/widgetdata
      if (url.includes('/api/explore') || url.includes('/api/widgetdata')) {
        try {
          const data = await response.json()
          if (data && !trendsApiData) {
            trendsApiData = data
            console.log('📥 Captured trends API data')
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
    })

    // Navigate to Google Trends with the keyword
    const encodedKeyword = encodeURIComponent(keyword)
    const url = `https://trends.google.com/trends/explore?q=${encodedKeyword}&geo=US&date=today%2012-m`

    console.log(`🌐 Navigating to: ${url}`)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Wait for the page to be interactive (don't wait for specific selectors that may change)
    console.log('⏳ Waiting for page to load...')
    await delay(5000) // Give Google Trends time to render

    // Check if page loaded successfully
    const pageContent = await page.content()
    if (pageContent.includes('trends.embed.renderExploreWidget')) {
      console.log('✅ Page loaded successfully')
    } else {
      console.log('⚠️ Page may not have loaded correctly')
    }

    // Method 1: Try to extract data from the page's embedded script
    const scriptData = await page.evaluate(() => {
      // Google Trends embeds data in window scope or script tags
      const scripts = Array.from(document.querySelectorAll('script'))

      for (const script of scripts) {
        const content = script.textContent || ''

        // Look for the widget data which contains timeline information
        if (content.includes('TIMESERIES_GRAPH') || content.includes('timelineData')) {
          console.log('Found script with timeline data')

          // Try to find JSON structure
          try {
            // Look for widget data structure
            const widgetMatch = content.match(/"widgets":\s*(\[[\s\S]*?\])\s*[,}]/);
            if (widgetMatch) {
              return widgetMatch[1]
            }

            // Alternative: look for timeline data directly
            const timelineMatch = content.match(/"timelineData":\s*(\[[\s\S]*?\])/);
            if (timelineMatch) {
              return `{"timelineData":${timelineMatch[1]}}`
            }
          } catch (e) {
            console.log('Error parsing script:', e)
          }
        }
      }
      return null
    })

    // Method 2: Extract data from rendered chart elements
    const chartData = await page.evaluate(() => {
      const dataPoints: { date: string; value: number }[] = []

      // Try to find data point elements (Google uses various selectors)
      const points = document.querySelectorAll('[data-value], .lv-label, [aria-label*="Interest"]')

      points.forEach((point) => {
        const ariaLabel = point.getAttribute('aria-label') || ''
        const dataValue = point.getAttribute('data-value') || ''

        // Parse aria-label like "Week of Jan 1, 2024: 75"
        const match = ariaLabel.match(/(\d+)$/)
        if (match) {
          const value = parseInt(match[1])
          if (!isNaN(value)) {
            dataPoints.push({
              date: new Date().toISOString().split('T')[0],
              value
            })
          }
        }
      })

      return dataPoints.length > 0 ? dataPoints : null
    })

    // Method 3: Look for data in window._docs or similar
    const windowData = await page.evaluate(() => {
      // @ts-ignore
      if (typeof window._docs !== 'undefined') {
        // @ts-ignore
        return JSON.stringify(window._docs)
      }
      return null
    })

    // Process the extracted data
    let trends: TrendDataPoint[] = []

    if (trendsApiData) {
      console.log('📊 Processing API data...')
      trends = parseApiData(trendsApiData)
    } else if (scriptData) {
      console.log('📊 Processing script data...')
      try {
        const parsed = JSON.parse(scriptData)
        trends = parseScriptData(parsed)
      } catch (e) {
        console.log('⚠️ Failed to parse script data')
      }
    } else if (chartData) {
      console.log('📊 Processing chart data...')
      trends = processChartData(chartData as any)
    } else if (windowData) {
      console.log('📊 Processing window data...')
      try {
        const parsed = JSON.parse(windowData)
        trends = parseWindowData(parsed)
      } catch (e) {
        console.log('⚠️ Failed to parse window data')
      }
    }

    // If we got data, convert it to our format
    if (trends.length > 0) {
      const volumes = trends.map(t => t.searchVolume)

      return {
        keyword,
        trends,
        averageVolume: calculateAverage(volumes),
        peakVolume: Math.max(...volumes),
        currentVolume: volumes[volumes.length - 1] || 0,
        trendDirection: calculateTrendDirection(volumes),
        monthlySearches: volumes[volumes.length - 1] || 0,
        source: 'google_trends'
      }
    }

    console.log('⚠️ No trend data extracted')
    return null

  } catch (error: any) {
    console.error(`❌ Error processing "${keyword}":`, error.message)
    return null
  } finally {
    await page.close()
  }
}

/**
 * Parse data from intercepted API responses
 */
function parseApiData(data: any): TrendDataPoint[] {
  const trends: TrendDataPoint[] = []

  try {
    // Navigate the complex API response structure
    if (data.widgets) {
      for (const widget of data.widgets) {
        if (widget.request?.requestOptions?.property === '') {
          // This is the main interest over time widget
          const timelineData = widget.lineChart?.timelineData
          if (timelineData) {
            timelineData.forEach((point: any) => {
              const timestamp = point.time
              const value = point.value?.[0] || 0

              // Convert timestamp to date
              const date = new Date(parseInt(timestamp) * 1000)
              const dateStr = date.toISOString().split('T')[0]

              trends.push({
                date: dateStr,
                searchVolume: value * 100 // Convert 0-100 to estimated volume
              })
            })
          }
        }
      }
    }

    // Group by month if we have daily data
    if (trends.length > 12) {
      return groupByMonth(trends)
    }

    return trends
  } catch (error) {
    console.error('Error parsing API data:', error)
    return []
  }
}

/**
 * Parse data from script tags
 */
function parseScriptData(data: any): TrendDataPoint[] {
  try {
    if (data.timelineData && Array.isArray(data.timelineData)) {
      return data.timelineData.map((item: any) => ({
        date: item.formattedTime || item.date,
        searchVolume: (item.value?.[0] || 0) * 100
      }))
    }
  } catch (error) {
    console.error('Error parsing script data:', error)
  }
  return []
}

/**
 * Parse data from window._docs
 */
function parseWindowData(data: any): TrendDataPoint[] {
  try {
    // Navigate the _docs structure
    if (Array.isArray(data)) {
      for (const doc of data) {
        if (doc.widgets) {
          return parseApiData({ widgets: doc.widgets })
        }
      }
    }
  } catch (error) {
    console.error('Error parsing window data:', error)
  }
  return []
}

/**
 * Process chart data extracted from DOM
 */
function processChartData(chartData: { date: string; value: number }[]): TrendDataPoint[] {
  return chartData.map(point => ({
    date: point.date,
    searchVolume: point.value * 100
  }))
}

/**
 * Group daily data into monthly aggregates
 */
function groupByMonth(trends: TrendDataPoint[]): TrendDataPoint[] {
  const monthlyData = new Map<string, number[]>()

  trends.forEach(point => {
    const monthKey = point.date.slice(0, 7) + '-01'
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
 * Calculate average
 */
function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
