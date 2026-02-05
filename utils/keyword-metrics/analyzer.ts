import axios from 'axios'

interface KeywordMetrics {
  keyword: string
  searchVolume: 'High' | 'Medium' | 'Low' | 'Very Low'
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard'
  competitionScore: number // 0-100
  opportunityScore: number // 0-100
  serpFeatures: string[]
  relatedKeywords: string[]
  monthlyEstimate?: string
}

/**
 * Analyzes a keyword by fetching SERP data and calculating metrics
 * This is more reliable than Google Trends and provides actionable SEO data
 */
export async function analyzeKeywordMetrics(keyword: string, serperApiKey: string): Promise<KeywordMetrics | null> {
  try {
    // Fetch SERP data for the keyword using Serper.dev
    const serpResponse = await axios.post('https://google.serper.dev/search', {
      q: keyword,
      gl: 'us',
      hl: 'en',
      num: 10
    }, {
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    })

    const serpData = serpResponse.data

    // Calculate metrics from SERP data
    const metrics = calculateMetricsFromSerp(keyword, serpData)
    return metrics

  } catch (error: any) {
    console.error(`❌ Keyword metrics error for "${keyword}":`, error.message)
    return null
  }
}

/**
 * Calculates comprehensive keyword metrics from SERP data
 */
function calculateMetricsFromSerp(keyword: string, serpData: any): KeywordMetrics {
  // 1. Analyze SERP features (indicates high competition)
  const serpFeatures: string[] = []
  if (serpData.knowledgeGraph) serpFeatures.push('Knowledge Graph')
  if (serpData.answerBox) serpFeatures.push('Featured Snippet')
  if (serpData.peopleAlsoAsk) serpFeatures.push('People Also Ask')
  if (serpData.relatedSearches) serpFeatures.push('Related Searches')
  if (serpData.shopping && serpData.shopping.length > 0) serpFeatures.push('Shopping Results')
  if (serpData.ads && serpData.ads.length > 0) serpFeatures.push('Paid Ads')

  // 2. Calculate competition score (0-100)
  let competitionScore = 0

  // High domain authority sites in top 10
  const organicResults = serpData.organic || []
  const topDomains = ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com']
  const bigBrandCount = organicResults.filter((r: any) =>
    topDomains.some(domain => r.link?.includes(domain))
  ).length
  competitionScore += bigBrandCount * 10 // +10 per big brand

  // SERP features indicate high competition
  competitionScore += serpFeatures.length * 5 // +5 per feature

  // Number of ads indicates commercial intent and competition
  const adCount = serpData.ads?.length || 0
  competitionScore += Math.min(adCount * 10, 30) // +10 per ad, max 30

  // Shopping results indicate e-commerce competition
  const shoppingCount = serpData.shopping?.length || 0
  competitionScore += Math.min(shoppingCount * 3, 15) // +3 per shopping result, max 15

  competitionScore = Math.min(competitionScore, 100)

  // 3. Estimate search volume from SERP signals
  let searchVolume: 'High' | 'Medium' | 'Low' | 'Very Low' = 'Very Low'
  let volumeScore = 0

  // More ads = higher search volume (advertisers know the volume)
  volumeScore += adCount * 15

  // Shopping results indicate product searches (usually high volume)
  volumeScore += shoppingCount * 10

  // SERP features indicate popular queries
  volumeScore += serpFeatures.length * 8

  // People Also Ask indicates popular topic
  if (serpData.peopleAlsoAsk) volumeScore += 20

  // Related searches indicate search volume
  if (serpData.relatedSearches && serpData.relatedSearches.length > 5) volumeScore += 15

  if (volumeScore >= 80) searchVolume = 'High'
  else if (volumeScore >= 50) searchVolume = 'Medium'
  else if (volumeScore >= 25) searchVolume = 'Low'
  else searchVolume = 'Very Low'

  // 4. Calculate difficulty (Easy/Medium/Hard/Very Hard)
  let difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard' = 'Easy'
  if (competitionScore >= 75) difficulty = 'Very Hard'
  else if (competitionScore >= 50) difficulty = 'Hard'
  else if (competitionScore >= 25) difficulty = 'Medium'
  else difficulty = 'Easy'

  // 5. Calculate opportunity score (high volume + low competition = high opportunity)
  const volumePoints = volumeScore
  const competitionPenalty = competitionScore
  const opportunityScore = Math.max(0, Math.min(100, volumePoints - competitionPenalty + 50))

  // 6. Extract related keywords
  const relatedKeywords: string[] = []
  if (serpData.relatedSearches) {
    serpData.relatedSearches.slice(0, 5).forEach((rs: any) => {
      if (rs.query) relatedKeywords.push(rs.query)
    })
  }

  // 7. Estimate monthly search volume range
  let monthlyEstimate = 'Unknown'
  if (searchVolume === 'High') monthlyEstimate = '10K - 100K+'
  else if (searchVolume === 'Medium') monthlyEstimate = '1K - 10K'
  else if (searchVolume === 'Low') monthlyEstimate = '100 - 1K'
  else monthlyEstimate = '< 100'

  return {
    keyword,
    searchVolume,
    difficulty,
    competitionScore,
    opportunityScore,
    serpFeatures,
    relatedKeywords,
    monthlyEstimate
  }
}

/**
 * Batches keyword analysis to avoid rate limits
 */
export async function analyzeMultipleKeywords(
  keywords: string[],
  serperApiKey: string,
  maxKeywords: number = 10
): Promise<KeywordMetrics[]> {
  const results: KeywordMetrics[] = []
  const keywordsToAnalyze = keywords.slice(0, maxKeywords)

  for (const keyword of keywordsToAnalyze) {
    const metrics = await analyzeKeywordMetrics(keyword, serperApiKey)
    if (metrics) {
      results.push(metrics)
    }

    // Add delay to respect rate limits
    if (keywordsToAnalyze.indexOf(keyword) < keywordsToAnalyze.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay (Serper is faster)
    }
  }

  return results
}
