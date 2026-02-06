import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { scrapePageData } from '@/utils/browserless-scraper'

export const maxDuration = 60

function createSSEMessage(type: string, data: any): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`
}

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  if (!url || !url.trim()) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false

      const sendLog = (message: string, detail?: string) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(createSSEMessage('log', {
            message,
            detail,
            timestamp: Date.now()
          })))
        } catch (e) {
          isClosed = true
        }
      }

      const sendProgress = (message: string) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(createSSEMessage('progress', {
            message,
            timestamp: Date.now()
          })))
        } catch (e) {
          isClosed = true
        }
      }

      const sendError = (message: string) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(createSSEMessage('error', { message })))
          controller.close()
          isClosed = true
        } catch (e) {
          isClosed = true
        }
      }

      const sendComplete = (report: string, metadata: any) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(createSSEMessage('complete', { report, metadata })))
          controller.close()
          isClosed = true
        } catch (e) {
          isClosed = true
        }
      }

      try {
        sendLog('Initializing browser', 'Using Browserless API')
        sendLog('Navigating to website', `Loading ${url}`)

        const startTime = Date.now()

        // Use Browserless scraper instead of Puppeteer
        let pageData: any
        try {
          pageData = await scrapePageData(url)
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error'
          if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('not found')) {
            sendError(`Unable to resolve domain "${url}". Please check the URL is correct.`)
          } else if (errorMsg.includes('ECONNREFUSED')) {
            sendError(`Connection refused by "${url}". The server may be down.`)
          } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
            sendError(`Connection timed out for "${url}". The server is not responding.`)
          } else if (errorMsg.includes('SSL') || errorMsg.includes('certificate')) {
            sendError(`SSL certificate error for "${url}". The site may have security issues.`)
          } else {
            sendError(`Failed to load page: ${errorMsg}`)
          }
          return
        }

        const loadTime = Date.now() - startTime

        sendLog('Analyzing page structure', 'Extracting page content and metadata')
        sendLog('Checking page speed', 'Measuring performance metrics')

        // Performance metrics (basic timing data)
        const performanceMetrics: any = {
          loadTime
        }

        sendLog('Analyzing structured data', 'Extracting schema markup')

        // Extract structured data from pageData
        const structuredData: any[] = pageData.structuredData || []

        sendLog('Discovering products', 'Using intelligent multi-method product discovery')

        // Initialize AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const aiModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        })

        // Get base URL for API calls
        const baseUrl = new URL(url)
        const origin = baseUrl.origin

        // ============== METHOD 1: SHOPIFY /products.json API ==============
        sendLog('Method 1: Checking Shopify API', 'Testing /products.json endpoint')

        let shopifyProducts: any[] = []
        try {
          const shopifyApiUrl = `${origin}/products.json?limit=50`
          const shopifyResponse = await fetch(shopifyApiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
          })

          if (shopifyResponse.ok) {
            const data = await shopifyResponse.json()
            if (data.products && Array.isArray(data.products)) {
              shopifyProducts = data.products.map((p: any) => ({
                name: p.title,
                description: p.body_html?.replace(/<[^>]*>/g, '').substring(0, 200),
                image: p.images?.[0]?.src,
                price: p.variants?.[0]?.price,
                currency: 'USD',
                url: `${origin}/products/${p.handle}`,
                sku: p.variants?.[0]?.sku,
                brand: p.vendor
              }))
              sendLog('Shopify API success', `Found ${shopifyProducts.length} products via Shopify API`)
            }
          }
        } catch (e: any) {
          sendLog('Shopify API not available', 'This is not a Shopify store or API is blocked')
        }

        // ============== METHOD 2: SITEMAP EXTRACTION ==============
        let sitemapProducts: any[] = []
        if (shopifyProducts.length === 0) {
          sendLog('Method 2: Checking Sitemap', 'Looking for product URLs in sitemap.xml')

          const sitemapUrls = [
            `${origin}/sitemap.xml`,
            `${origin}/sitemap_index.xml`,
            `${origin}/sitemap_products_1.xml`,
            `${origin}/product-sitemap.xml`
          ]

          for (const sitemapUrl of sitemapUrls) {
            try {
              const sitemapResponse = await fetch(sitemapUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              })

              if (sitemapResponse.ok) {
                const sitemapText = await sitemapResponse.text()

                // Extract product URLs from sitemap
                const urlMatches = sitemapText.match(/<loc>([^<]+)<\/loc>/g) || []
                const productUrls = urlMatches
                  .map(m => m.replace(/<\/?loc>/g, ''))
                  .filter(u => u.match(/\/(product|products|p\/|item|dp\/|detail)/i))
                  .slice(0, 30)

                if (productUrls.length > 0) {
                  sendLog('Sitemap found', `Found ${productUrls.length} potential product URLs`)

                  // Extract product info from URLs
                  sitemapProducts = productUrls.map(productUrl => {
                    const urlParts = productUrl.split('/')
                    const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2]
                    const name = slug.replace(/[-_]/g, ' ').replace(/\.(html|htm|php)$/i, '')

                    return {
                      name: name.charAt(0).toUpperCase() + name.slice(1),
                      url: productUrl
                    }
                  })
                  break
                }
              }
            } catch (e) {
              // Sitemap not available - continue
            }
          }
        }

        // ============== METHOD 3: JSON-LD STRUCTURED DATA ==============
        sendLog('Method 3: Extracting JSON-LD data', 'Looking for Product schema markup')

        let jsonLdProducts: any[] = []
        try {
          // Use structured data from browserless scraper
          const products: any[] = []

          for (const data of structuredData) {
            // Handle single product
            if (data['@type'] === 'Product') {
              products.push({
                name: data.name,
                description: data.description,
                image: Array.isArray(data.image) ? data.image[0] : data.image,
                price: data.offers?.price || data.offers?.[0]?.price,
                currency: data.offers?.priceCurrency || data.offers?.[0]?.priceCurrency,
                url: data.offers?.url || data.url || pageData.url,
                sku: data.sku,
                brand: data.brand?.name || data.brand
              })
            }

            // Handle product lists (ItemList)
            if (data['@type'] === 'ItemList' && data.itemListElement) {
              for (const item of data.itemListElement) {
                if (item['@type'] === 'Product' || item.item?.['@type'] === 'Product') {
                  const prod = item['@type'] === 'Product' ? item : item.item
                  products.push({
                    name: prod.name,
                    description: prod.description,
                    image: Array.isArray(prod.image) ? prod.image[0] : prod.image,
                    price: prod.offers?.price,
                    url: prod.url || prod.offers?.url
                  })
                }
              }
            }

            // Handle nested @graph structure
            if (data['@graph']) {
              for (const item of data['@graph']) {
                if (item['@type'] === 'Product') {
                  products.push({
                    name: item.name,
                    description: item.description,
                    image: Array.isArray(item.image) ? item.image[0] : item.image,
                    price: item.offers?.price,
                    url: item.url || pageData.url
                  })
                }
              }
            }
          }

          jsonLdProducts = products

          if (jsonLdProducts.length > 0) {
            sendLog('JSON-LD found', `Found ${jsonLdProducts.length} products in structured data`)
          }
        } catch (jsonLdError: any) {
          sendLog('JSON-LD extraction failed', 'Continuing with other methods')
        }

        // Skip METHOD 4 and METHOD 5 - they require additional page navigation
        // which is complex with Browserless API
        const aiExtractedProducts: any[] = []
        const crawledProducts: any[] = []

        // ============== COMBINE AND DEDUPLICATE ALL PRODUCTS ==============
        sendLog('Product discovery summary', `Shopify: ${shopifyProducts.length}, Sitemap: ${sitemapProducts.length}, JSON-LD: ${jsonLdProducts.length}, AI: ${aiExtractedProducts.length}, Crawled: ${crawledProducts.length}`)

        const allProducts = [...shopifyProducts, ...jsonLdProducts, ...sitemapProducts, ...aiExtractedProducts, ...crawledProducts]

        // Step 5: Deduplicate products
        const deduplicateProducts = (products: any[]) => {
          const seen = new Map()

          for (const product of products) {
            const key = product.url || product.name?.toLowerCase()
            if (!key) continue

            if (!seen.has(key)) {
              seen.set(key, product)
            } else {
              // Keep the one with more complete data
              const existing = seen.get(key)
              if (product.image && !existing.image) {
                seen.set(key, product)
              }
            }
          }

          return Array.from(seen.values())
        }

        const products = deduplicateProducts(allProducts).slice(0, 50) // Max 50 products

        sendLog('Product discovery complete', `Found ${products.length} unique products across site`)

        sendLog('Preparing AI analysis', 'Sending data to AI agent')

        // Prepare comprehensive analysis data
        const analysisData = {
          url,
          loadTime,
          ...pageData,
          structuredData,
          performance: {
            ...pageData.performance,
            metrics: performanceMetrics
          }
        }

        sendProgress('AI agent is analyzing your website...')

        // Use existing AI model for report generation
        const reportModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `You are a professional SEO analyst conducting a comprehensive website audit. Analyze the following website data and provide a detailed, actionable report.

Website Data:
${JSON.stringify(analysisData, null, 2)}

Write a comprehensive SEO audit report that covers:

1. **Executive Summary**
   - Overall SEO health score (0-100)
   - Critical issues that need immediate attention
   - Key opportunities for improvement

2. **Page Load Performance**
   - Analysis of ${loadTime}ms load time
   - Impact on user experience and SEO
   - Specific recommendations

3. **On-Page SEO Analysis**
   - Title tag evaluation (length: ${pageData.title?.length || 0} characters)
   - Meta description evaluation (${pageData.metaDescription ? pageData.metaDescription.length : 0} characters)
   - Heading structure assessment (H1: ${pageData.headings.h1.length}, H2: ${pageData.headings.h2.length})
   - Content quality and length (${pageData.content.wordCount} words)

4. **Technical SEO**
   - Mobile optimization (viewport, responsive design)
   - Structured data implementation (${structuredData.length} schemas found)
   - Canonical tags, robots meta
   - Image optimization (${pageData.images.length} images, alt tags coverage)

5. **Content Analysis**
   - Content depth and relevance
   - Keyword optimization opportunities
   - Readability and user engagement

6. **Action Items**
   - Prioritized list of fixes (Critical → High → Medium → Low)
   - Specific, actionable recommendations
   - Expected impact of each fix

Write the report in a natural, conversational tone as if you're personally explaining it to the website owner. Use markdown formatting for structure. Be specific with numbers and examples. Focus on what matters most for a small e-commerce business trying to rank organically.

DO NOT use emojis. Keep it professional but friendly.`

        let report = ''
        try {
          sendLog('Generating SEO report', 'AI is analyzing your website data')
          const result = await reportModel.generateContent(prompt)
          report = result.response.text()
        } catch (aiError: any) {
          sendLog('AI report generation failed', aiError.message || 'Unknown AI error')
          report = `# SEO Audit Report\n\nWe were unable to generate a detailed AI report. Here's a summary:\n\n- **URL**: ${url}\n- **Load Time**: ${loadTime}ms\n- **Products Found**: ${products.length}\n- **Title Length**: ${pageData.title?.length || 0} characters\n- **Meta Description**: ${pageData.metaDescription?.length || 0} characters\n\nPlease try again later for a full AI-powered analysis.`
        }

        sendLog('Analysis complete', 'Generating report')

        // Extract a simple score from the report
        const scoreMatch = report.match(/score[:\s]+(\d+)/i)
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 70

        // AI-Powered Keyword Extraction (category-specific, intelligent analysis)
        sendLog('Extracting keywords', 'Using AI to identify category-specific keywords')

        const keywordExtractionPrompt = `Analyze this website content and extract SEO keywords they're currently targeting.

Website Title: ${pageData.title}
Meta Description: ${pageData.metaDescription}
H1 Headings: ${pageData.headings.h1.map((h: any) => h.text).join(', ')}
H2 Headings: ${pageData.headings.h2.slice(0, 10).map((h: any) => h.text).join(', ')}
Page Content (first 1000 chars): ${pageData.content.readabilityText?.substring(0, 1000) || ''}

Extract ALL relevant keywords currently being used on this page, categorized by type:
1. Primary keywords - Main product/service terms that define the business (e.g., "wireless earbuds", "luxury watches")
2. Long-tail keywords - Specific 3-5 word phrases with commercial intent (e.g., "best noise cancelling headphones", "buy affordable running shoes online")
3. Semantic keywords - Related concepts and synonyms that support the main topic (e.g., "audio quality", "Bluetooth connectivity")
4. Category keywords - Broader industry classifications (e.g., "consumer electronics", "fashion accessories")

IMPORTANT:
- Focus on product/service-specific terms, not generic e-commerce words
- Avoid generic terms like "free shipping", "contact us", "about", "sale"
- Extract ACTUAL PRODUCT NAMES and CATEGORIES from the content
- Be specific and relevant to what this business actually sells
- Return 3-5 keywords per category

Return ONLY valid JSON:
{
  "primaryKeywords": ["keyword1", "keyword2", "keyword3"],
  "longTailKeywords": ["phrase1", "phrase2", "phrase3"],
  "semanticKeywords": ["related1", "related2", "related3"],
  "categoryKeywords": ["category1", "category2"]
}`

        let categorizedKeywords: any = {
          primaryKeywords: [],
          longTailKeywords: [],
          semanticKeywords: [],
          categoryKeywords: []
        }

        try {
          const keywordResult = await reportModel.generateContent(keywordExtractionPrompt)
          const keywordText = keywordResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim()
          categorizedKeywords = JSON.parse(keywordText)
          sendLog('Keywords extracted', `Found ${Object.values(categorizedKeywords).flat().length} total keywords`)
        } catch (error: any) {
          sendLog('⚠️ Keyword extraction error', 'Using fallback method')
          // Fallback: extract simple keywords from title and headings
          const simpleExtract = (text: string) => {
            return text.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3)
          }
          categorizedKeywords.primaryKeywords = simpleExtract(pageData.title || '')
        }

        // Flatten all keywords for backward compatibility
        const keywords = [
          ...categorizedKeywords.primaryKeywords,
          ...categorizedKeywords.longTailKeywords,
          ...categorizedKeywords.semanticKeywords,
          ...categorizedKeywords.categoryKeywords
        ].slice(0, 15)

        // Final summary
        sendLog('Audit complete', `Found ${products.length} products, ${keywords.length} keywords. Score: ${score}/100`)

        sendComplete(report, {
          score,
          url,
          loadTime,
          analyzedAt: new Date().toISOString(),
          keywords, // Flattened list for backward compatibility
          categorizedKeywords, // New: structured keyword categories
          products, // Discovered products
          pageData: {
            titleLength: pageData.title?.length || 0,
            metaDescLength: pageData.metaDescription?.length || 0,
            h1Count: pageData.headings.h1.length,
            wordCount: pageData.content.wordCount,
            imageCount: pageData.images.length,
            structuredDataCount: structuredData.length,
            hasViewport: pageData.mobile.hasViewport
          }
        })

      } catch (error: any) {
        console.error('Site audit error:', error)

        // Provide specific error messages based on error type
        const errorMsg = error.message || ''
        if (errorMsg.includes('Protocol error') || errorMsg.includes('Target closed')) {
          sendError('Browser connection lost. Please try again.')
        } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
          sendError(`Operation timed out: ${errorMsg.substring(0, 100)}`)
        } else if (errorMsg.includes('net::ERR')) {
          sendError(`Network error: ${errorMsg}`)
        } else if (errorMsg.includes('GEMINI') || errorMsg.includes('API key')) {
          sendError('AI service error. Please check API configuration.')
        } else if (errorMsg.includes('JSON')) {
          sendError('Failed to parse response data. The page structure may be unusual.')
        } else {
          sendError(`Analysis failed: ${errorMsg || 'Unknown error occurred'}`)
        }
      }
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
