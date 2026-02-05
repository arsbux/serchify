import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import axios from 'axios'
import { analyzeMultipleKeywords } from '@/utils/keyword-metrics/analyzer'
import { getBrowser } from '@/utils/puppeteer-serverless'

export const maxDuration = 60

// AI-Powered Tool System (MCP-style architecture)
interface Tool {
  name: string
  description: string
  execute: (input: any) => Promise<any>
}

// Helper to send progress updates via SSE
function createSSEMessage(type: string, data: any): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(
      createSSEMessage('error', { message: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const body = await request.json()
  const { input } = body

  if (!input) {
    return new Response(
      createSSEMessage('error', { message: 'Input is required' }),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  // Create a streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendLog = (message: string, detail?: string) => {
        controller.enqueue(encoder.encode(createSSEMessage('log', { message, detail, timestamp: Date.now() })))
      }

      const sendError = (message: string, details?: string) => {
        controller.enqueue(encoder.encode(createSSEMessage('error', { message, details })))
      }

      const sendComplete = (data: any) => {
        controller.enqueue(encoder.encode(createSSEMessage('complete', data)))
        controller.close()
      }

      try {
        sendLog('🤖 AI Agent: Processing user input', input)

        // Check for required API keys
        if (!process.env.GEMINI_API_KEY) {
          sendError('GEMINI_API_KEY not configured')
          return
        }
        if (!process.env.SERPER_API_KEY) {
          sendError('SERPER_API_KEY not configured')
          return
        }

        // Initialize AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

        // STEP 1: AI analyzes user input to determine type and intent
        sendLog('🧠 AI Agent: Analyzing input type and intent...')

        const analysisPrompt = `
You are an intelligent agent that analyzes user input for a competitor keyword analysis tool.

User input: "${input}"

Analyze this input and determine:
1. Type: Is this a URL/domain, or a product/business name?
2. If it's a URL/domain: What type of website is it (e-commerce store, product page, business site)?
3. If it's a product name: What product category and price level does it belong to?
4. Search strategy: Generate 3-5 PRODUCT-FOCUSED search queries to find REAL stores selling similar products

IMPORTANT for search queries:
- DO NOT generate queries like "competitors of X" or "sites like X" or "X alternatives"
- DO generate queries for actual product searches like:
  * "best [product category] online"
  * "[price level] [product category]" (e.g., "luxury golf clubs", "affordable furniture")
  * "buy [product] [location]" (e.g., "buy golf equipment USA")
  * "top [product category] stores"
- Match the apparent price level (luxury/premium → use "luxury", "premium", "high-end"; budget → use "affordable", "cheap", "discount")

Return ONLY valid JSON (no markdown, no explanation):
{
  "inputType": "url" | "product_name" | "business_name",
  "confidence": "high" | "medium" | "low",
  "category": "string",
  "priceLevel": "luxury" | "premium" | "mid-range" | "budget" | "unknown",
  "websiteType": "ecommerce_store" | "product_page" | "business_site" | "other",
  "extractedInfo": {
    "productName": "string or null",
    "domain": "string or null",
    "brandName": "string or null"
  },
  "searchQueries": ["product query 1", "product query 2", "product query 3"]
}
`

        const analysisResult = await model.generateContent(analysisPrompt)
        const analysisText = analysisResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
        const inputAnalysis = JSON.parse(analysisText)

        sendLog('📊 Input Analysis complete', `Type: ${inputAnalysis.inputType}, Category: ${inputAnalysis.category}`)

        let productInfo: any = {}
        let competitors: any[] = []

        // STEP 2: Route to appropriate tool based on AI analysis
        if (inputAnalysis.inputType === 'url') {
          sendLog('🌐 Tool: Website Scraper activated')

          // Normalize URL - add protocol if missing
          let normalizedUrl = input.trim()
          if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = 'https://' + normalizedUrl
            sendLog('🔧 Normalized URL', normalizedUrl)
          }

          // Scrape the URL to find products sold on the site
          let browser
          try {
            browser = await getBrowser()

            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

            sendLog('🔍 Scraping website...', normalizedUrl)
            await page.goto(normalizedUrl, { waitUntil: 'networkidle2', timeout: 30000 })

            // Extract comprehensive page data
            const scrapedData = await page.evaluate(() => ({
          title: document.title,
          h1: (document.querySelector('h1') as HTMLElement)?.innerText,
              metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content'),
              // E-commerce specific selectors
              productTitle: (document.querySelector('[itemprop="name"]') as HTMLElement)?.innerText ||
                           (document.querySelector('.product-title') as HTMLElement)?.innerText ||
                           (document.querySelector('.product-name') as HTMLElement)?.innerText,
              price: document.querySelector('[itemprop="price"]')?.getAttribute('content') ||
                     (document.querySelector('.price') as HTMLElement)?.innerText,
              brand: (document.querySelector('[itemprop="brand"]') as HTMLElement)?.innerText,
              description: (document.querySelector('[itemprop="description"]') as HTMLElement)?.innerText,
              category: (document.querySelector('[itemtype*="BreadcrumbList"]') as HTMLElement)?.innerText,
              // Get all product links
              productLinks: Array.from(document.querySelectorAll('a[href*="/product"], a[href*="/item"], a.product-link'))
                .slice(0, 10)
                .map(a => ({
                  text: (a as HTMLElement).innerText.trim(),
                  href: (a as HTMLAnchorElement).href
                })),
              // Get all headings for context
              headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                .slice(0, 20)
                .map(h => (h as HTMLElement).innerText.trim())
            }))

            await browser.close()
            sendLog('✅ Website scraped successfully')

            // Use AI to analyze scraped data and identify products with deep understanding
        const productAnalysisPrompt = `
Analyze this scraped website data and deeply understand the business:

Title: ${scrapedData.title}
H1: ${scrapedData.h1}
Description: ${scrapedData.metaDescription}
Product Title: ${scrapedData.productTitle}
Price: ${scrapedData.price}
Brand: ${scrapedData.brand}
Category: ${scrapedData.category}
Headings: ${scrapedData.headings.join(', ')}
Product Links: ${scrapedData.productLinks.map(p => p.text).join(', ')}

Analyze and determine:
1. SPECIFIC product niche (e.g., "luxury golf clubs", "budget home furniture", "premium wireless earbuds")
2. Price positioning (luxury/premium, mid-range, budget/affordable)
3. Target market (USA, global, specific region)
4. Product category (be specific, not generic)
5. 3-5 PRODUCT-FOCUSED search queries that would find REAL stores selling similar products
   - DO NOT search for "competitors of X" or "sites like X"
   - DO search for actual product terms like "best luxury golf clubs", "affordable home furniture online"
   - Match the price positioning in queries (luxury → "premium/luxury/high-end", budget → "affordable/cheap/discount")

Return ONLY valid JSON:
{
  "specificNiche": "string (very specific, include price level)",
  "mainProducts": ["product1", "product2"],
  "pricePositioning": "luxury" | "premium" | "mid-range" | "budget" | "affordable",
  "targetMarket": "string",
  "category": "string",
  "brandName": "string",
  "productSearchQueries": ["query1", "query2", "query3", "query4", "query5"]
}
`

            const productAnalysisResult = await model.generateContent(productAnalysisPrompt)
            const productAnalysisText = productAnalysisResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
            const productAnalysis = JSON.parse(productAnalysisText)

            sendLog('🎯 Product Analysis complete', `Niche: ${productAnalysis.specificNiche}`)

            productInfo = {
          ...scrapedData,
          specificNiche: productAnalysis.specificNiche,
          mainProducts: productAnalysis.mainProducts,
          pricePositioning: productAnalysis.pricePositioning,
          targetMarket: productAnalysis.targetMarket,
          category: productAnalysis.category,
          brandName: productAnalysis.brandName,
          productSearchQueries: productAnalysis.productSearchQueries,
          searchQuery: productAnalysis.specificNiche
        }

          } catch (error: any) {
            sendLog('⚠️ Scraping error, using fallback', error.message)
            // Fallback: use domain name for search
        try {
          const urlObj = new URL(normalizedUrl)
          const domain = urlObj.hostname.replace('www.', '').split('.')[0]
          productInfo = {
            searchQuery: domain,
            title: domain,
            domain: normalizedUrl
          }
        } catch {
          // If URL parsing fails, just use the input as-is
          productInfo = {
            searchQuery: input,
            title: input,
            domain: input
          }
        }
      } finally {
        if (browser) await browser.close()
      }

        } else {
          // Product name provided - use AI to enhance understanding
          sendLog('💡 Tool: Product Analyzer activated')

          const productEnhancementPrompt = `
The user entered: "${input}"

This appears to be a product name. Deeply analyze and enhance our understanding:

1. What is the full, detailed product name?
2. What SPECIFIC category does this belong to?
3. What price positioning does this suggest (luxury, premium, mid-range, budget)?
4. What are common variations/synonyms for this product?
5. Generate 3-5 PRODUCT-FOCUSED search queries to find stores selling this

IMPORTANT for search queries:
- DO NOT use "competitors of X" or "alternatives to X"
- DO use actual product searches like:
  * "best [product] online"
  * "[price level] [product]" (match the apparent price level)
  * "buy [product] [context]"
  * "top [product] stores"

Return ONLY valid JSON:
{
  "enhancedName": "string",
  "specificCategory": "string (be very specific)",
  "pricePositioning": "luxury" | "premium" | "mid-range" | "budget" | "unknown",
  "variations": ["var1", "var2"],
  "productSearchQueries": ["query1", "query2", "query3", "query4", "query5"]
}
`

          const enhancementResult = await model.generateContent(productEnhancementPrompt)
          const enhancementText = enhancementResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
          const enhancement = JSON.parse(enhancementText)

          sendLog('✨ Product Enhancement complete', `Category: ${enhancement.specificCategory}`)

          productInfo = {
        originalInput: input,
        enhancedName: enhancement.enhancedName,
        specificCategory: enhancement.specificCategory,
        category: enhancement.specificCategory,
        pricePositioning: enhancement.pricePositioning,
        variations: enhancement.variations,
        productSearchQueries: enhancement.productSearchQueries,
        searchQuery: enhancement.enhancedName
      }
    }

        // STEP 3: Find REAL competitors using product-focused SERP queries
        // Use product-specific queries, not meta-competitor queries
        const productQueries = productInfo.productSearchQueries || inputAnalysis.searchQueries || [`best ${productInfo.searchQuery}`]

        // Use the first product-focused query to find actual stores
        const searchQuery = productQueries[0]
        sendLog('🔎 Tool: SERP Search activated', `Query: "${searchQuery}"`)
        sendLog('📋 Alternative queries available', productQueries.slice(1, 3).join(', '))

        try {
          const serpResponse = await axios.post('https://google.serper.dev/search', {
            q: searchQuery,
            gl: 'us',
            hl: 'en',
            num: 10
          }, {
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY!,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          })

          sendLog('✅ SERP API response received', `Status: ${serpResponse.status}`)

          // Get top 10 competitors for better keyword data (Serper.dev uses 'organic' array)
          competitors = (serpResponse.data.organic || []).slice(0, 10).map((result: any) => ({
            position: result.position,
            title: result.title,
            url: result.link,
            domain: new URL(result.link).hostname,
            snippet: result.snippet
          }))

          sendLog(`📋 Found ${competitors.length} competitors`, 'Ready for keyword extraction')
        } catch (error: any) {
          sendLog('⚠️ SERP API error', error.message)
        }

        // STEP 4: AI analyzes competitor keywords for keyword research
        sendLog('🤖 Tool: Keyword Extractor activated')
        sendLog(`📊 Analyzing top sites for keywords`, `Processing ${Math.min(competitors.length, 8)} competitors...`)

    const competitorKeywords: any[] = []

    // Analyze top 8 competitors for comprehensive keyword data
    for (const competitor of competitors.slice(0, 8)) {
      const keywordPrompt = `
Analyze this competitor and extract keywords they're ranking for:

Title: ${competitor.title}
Snippet: ${competitor.snippet}
Domain: ${competitor.domain}

Extract ALL relevant keywords in these categories:
1. Primary keywords (main product terms)
2. Long-tail keywords (specific phrases)
3. Semantic keywords (related concepts)
4. Category keywords (broader classifications)

Return ONLY valid JSON:
{
  "primaryKeywords": ["kw1", "kw2", "kw3"],
  "longTailKeywords": ["phrase1", "phrase2"],
  "semanticKeywords": ["related1", "related2"],
  "categoryKeywords": ["cat1", "cat2"]
}
`

      try {
        const result = await model.generateContent(keywordPrompt)
        const text = result.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
        const keywords = JSON.parse(text)

        competitorKeywords.push({
          competitor: competitor.title,
          domain: competitor.domain,
          position: competitor.position,
          url: competitor.url,
          keywords
        })
          } catch (error: any) {
            sendLog('⚠️ Keyword extraction error', `${competitor.domain}: ${error.message}`)
          }
        }

        // STEP 5: AI estimates keyword popularity (no external API needed)
        sendLog('📊 Tool: Popularity Estimator activated')

    const allKeywords = competitorKeywords.flatMap(c =>
      [...c.keywords.primaryKeywords || [], ...c.keywords.longTailKeywords || []]
    )
    const uniqueKeywords = [...new Set(allKeywords)]

    // Use AI to estimate popularity instead of Wikipedia
    const popularityPrompt = `
Rate the search popularity of these keywords for e-commerce:

Keywords: ${uniqueKeywords.slice(0, 15).join(', ')}

For EACH keyword, estimate:
- Search volume category (High/Medium/Low)
- Competition level (High/Medium/Low)
- Commercial intent (High/Medium/Low)

Return ONLY valid JSON array:
[
  {
    "keyword": "string",
    "popularity": "High" | "Medium" | "Low",
    "competition": "High" | "Medium" | "Low",
    "commercialIntent": "High" | "Medium" | "Low"
  }
]
`

    let keywordPopularity: any[] = []

        try {
          const popularityResult = await model.generateContent(popularityPrompt)
          const popularityText = popularityResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
          keywordPopularity = JSON.parse(popularityText)
          sendLog('✅ Popularity estimated', `${keywordPopularity.length} keywords analyzed`)
        } catch (error) {
          sendLog('⚠️ Popularity estimation error', 'Using fallback method')
      // Fallback: basic popularity based on frequency
      keywordPopularity = uniqueKeywords.slice(0, 15).map(kw => ({
        keyword: kw,
        popularity: 'Unknown',
        competition: 'Unknown',
        commercialIntent: 'Unknown'
      }))
    }

        // Aggregate results with case-insensitive deduplication
        const keywordFrequency: Record<string, { count: number; originalKeyword: string }> = {}
        competitorKeywords.forEach(c => {
          [...c.keywords.primaryKeywords || [], ...c.keywords.longTailKeywords || []].forEach(kw => {
            const normalizedKey = kw.toLowerCase()
            if (!keywordFrequency[normalizedKey]) {
              keywordFrequency[normalizedKey] = { count: 0, originalKeyword: kw }
            }
            keywordFrequency[normalizedKey].count += 1
          })
        })

        const topKeywords = Object.entries(keywordFrequency)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([normalizedKey, { count, originalKeyword }]) => {
            const popData = keywordPopularity.find(k => k.keyword.toLowerCase() === normalizedKey)
            return {
              keyword: originalKeyword,
              usedByCompetitors: count,
              popularity: popData?.popularity || 'Unknown',
              competition: popData?.competition || 'Unknown',
              commercialIntent: popData?.commercialIntent || 'Unknown'
            }
          })

        // STEP 6: Keyword Gap Analysis
        sendLog('🔬 Tool: Keyword Gap Analyzer activated')

    // Extract keywords from user's site (if URL was provided)
    const userKeywords: string[] = []
    if (inputAnalysis.inputType === 'url' && productInfo.title) {
      // Extract keywords from user's existing content
      const userContent = [
        productInfo.title,
        productInfo.h1,
        productInfo.metaDescription,
        productInfo.productTitle,
        ...(productInfo.headings || [])
      ].filter(Boolean).join(' ').toLowerCase()

      // Check which competitor keywords are already used
      uniqueKeywords.forEach(kw => {
        if (userContent.includes(kw.toLowerCase())) {
          userKeywords.push(kw)
        }
      })
    }

        // Calculate relevance score for each keyword based on similarity to user query
        const calculateRelevanceScore = (keyword: string, searchQuery: string): number => {
          const keywordLower = keyword.toLowerCase()
          const queryLower = searchQuery.toLowerCase()
          const queryWords = queryLower.split(' ')

          let score = 0

          // Exact match gets highest score
          if (keywordLower === queryLower) score += 100

          // Contains full query
          else if (keywordLower.includes(queryLower)) score += 80

          // Query contains keyword
          else if (queryLower.includes(keywordLower)) score += 70

          // Count matching words
          const matchingWords = queryWords.filter(word => keywordLower.includes(word)).length
          score += (matchingWords / queryWords.length) * 50

          // Shorter keywords (more focused) get bonus
          if (keyword.split(' ').length <= 3) score += 10

          return score
        }

        // Add relevance scores to all keywords
        const keywordsWithRelevance = topKeywords.map(kw => ({
          ...kw,
          relevanceScore: calculateRelevanceScore(kw.keyword, productInfo.searchQuery || input)
        }))

        // Sort by relevance score (descending)
        keywordsWithRelevance.sort((a, b) => b.relevanceScore - a.relevanceScore)

        // Identify keyword gaps (keywords competitors use but user doesn't)
        const keywordGaps = keywordsWithRelevance.filter(kw =>
          !userKeywords.some(uk => uk.toLowerCase() === kw.keyword.toLowerCase())
        ) // All missing keywords (frontend will show top 5 in chart, all in list)

        // Identify existing keywords (user already has)
        const existingKeywords = keywordsWithRelevance.filter(kw =>
          userKeywords.some(uk => uk.toLowerCase() === kw.keyword.toLowerCase())
        )

        sendLog('✅ Keyword Research complete!')
        sendLog(`📊 Found ${keywordGaps.length} keyword opportunities`)
        sendLog(`✅ Already using ${existingKeywords.length} keywords`)

        // STEP 7: Analyze keyword metrics using SERP data (more reliable than Google Trends)
        sendLog('📊 Tool: Keyword Metrics Analyzer activated')
        sendLog(`📈 Analyzing SERP data`, `Processing top ${Math.min(10, keywordGaps.length)} keywords...`)

        // Analyze top keywords to get difficulty, volume estimates, and opportunity scores
        const keywordsToAnalyze = keywordGaps.slice(0, 10).map(kw => kw.keyword)
        const keywordMetrics = await analyzeMultipleKeywords(
          keywordsToAnalyze,
          process.env.SERPER_API_KEY!,
          10 // max keywords
        )

        sendLog(`✅ Analyzed ${keywordMetrics.length} keywords`, 'SERP-based metrics complete')

    // Enhance keywords with detailed metrics
    const keywordGapsWithMetrics = keywordGaps.map(kw => {
      const metrics = keywordMetrics.find(m => m.keyword.toLowerCase() === kw.keyword.toLowerCase())

      if (metrics) {
        return {
          ...kw,
          searchVolume: metrics.searchVolume,
          difficulty: metrics.difficulty,
          competitionScore: metrics.competitionScore,
          opportunityScore: metrics.opportunityScore,
          serpFeatures: metrics.serpFeatures,
          relatedKeywords: metrics.relatedKeywords,
          monthlyEstimate: metrics.monthlyEstimate
        }
      }
      return kw
    })

    const existingKeywordsWithMetrics = existingKeywords.map(kw => {
      const metrics = keywordMetrics.find(m => m.keyword.toLowerCase() === kw.keyword.toLowerCase())

      if (metrics) {
        return {
          ...kw,
          searchVolume: metrics.searchVolume,
          difficulty: metrics.difficulty,
          competitionScore: metrics.competitionScore,
          opportunityScore: metrics.opportunityScore,
          serpFeatures: metrics.serpFeatures,
          relatedKeywords: metrics.relatedKeywords,
          monthlyEstimate: metrics.monthlyEstimate
        }
      }
      return kw
    })

        // Send final results
        sendComplete({
          inputAnalysis,
          productInfo,
          keywordResearch: {
            totalKeywordsAnalyzed: uniqueKeywords.length,
            competitorsAnalyzed: competitorKeywords.length,
            keywordGaps: keywordGapsWithMetrics, // Keywords to ADD (with SERP metrics)
            existingKeywords: existingKeywordsWithMetrics, // Keywords already have (with metrics)
            allKeywords: topKeywords, // All validated keywords
          },
          topKeywords: keywordGapsWithMetrics, // Show gaps as primary recommendations
          keywordPopularity,
          keywordMetrics: keywordMetrics, // SERP-based keyword metrics
          insights: {
            totalCompetitorsAnalyzed: competitorKeywords.length,
            uniqueKeywordsFound: uniqueKeywords.length,
            keywordOpportunities: keywordGaps.length,
            keywordsAlreadyUsing: existingKeywords.length,
            mostCommonKeywords: topKeywords.slice(0, 5).map(k => k.keyword),
            searchQuery: searchQuery,
            metricsAvailable: keywordMetrics.length > 0,
            recommendation: keywordGaps.length > 0
              ? `Add ${keywordGaps.length} high-value keywords to improve rankings`
              : 'Great! You\'re using most of the important keywords'
          },
          timestamp: new Date().toISOString()
        })

      } catch (error: any) {
        sendError('Analysis failed', error.message || 'Unknown error occurred')
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
