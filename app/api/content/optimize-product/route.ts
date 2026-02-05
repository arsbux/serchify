import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { productUrl } = await request.json()

  if (!productUrl) {
    return NextResponse.json(
      { success: false, error: 'Product URL is required' },
      { status: 400 }
    )
  }

  // Validate URL
  let url: string
  try {
    const urlObj = new URL(productUrl)
    url = urlObj.href
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid URL format' },
      { status: 400 }
    )
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendLog = (message: string, detail?: string) => {
        const data = JSON.stringify({
          type: 'log',
          data: {
            message,
            detail,
            timestamp: Date.now(),
          },
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      const sendProgress = (message: string) => {
        const data = JSON.stringify({
          type: 'progress',
          data: {
            message,
            timestamp: Date.now(),
          },
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      const sendComplete = (productData: any, analysis: any, metadata: any) => {
        const data = JSON.stringify({
          type: 'complete',
          data: {
            productData,
            analysis,
            metadata,
          },
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        controller.close()
      }

      const sendError = (error: string) => {
        const data = JSON.stringify({
          type: 'error',
          data: { message: error },
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        controller.close()
      }

      try {
        // Step 1: Initialize browser
        sendLog('Initializing browser', 'Starting headless Chrome instance')
        const browser = await puppeteer.launch({
          headless: true,
          timeout: 60000,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
          ],
        })

        const page = await browser.newPage()
        await page.setViewport({ width: 1920, height: 1080 })
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        // Step 2: Navigate to product page
        sendLog('Navigating to product page', `Loading ${url}`)
        const startTime = Date.now()
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        })
        const loadTime = Date.now() - startTime
        sendLog('Page loaded', `Loaded in ${loadTime}ms`)

        // Step 3: Extract product data
        sendLog('Extracting product data', 'Scanning page for product information')
        const productData = await page.evaluate(() => {
          const data: any = {
            images: [],
            title: '',
            description: '',
            price: '',
            metaTitle: '',
            metaDescription: '',
            metaKeywords: '',
            headings: {
              h1: [],
              h2: [],
              h3: [],
            },
            textContent: '',
            schemaMarkup: [],
            openGraph: {},
            productInfo: {},
            imageCount: 0,
            wordCount: 0,
          }

          // Extract all product images
          const images = Array.from(document.querySelectorAll('img'))
          data.images = images
            .map((img) => ({
              src: img.src,
              alt: img.alt || '',
              width: img.naturalWidth,
              height: img.naturalHeight,
            }))
            .filter((img) => img.src && !img.src.includes('data:image'))
            .slice(0, 20)

          data.imageCount = data.images.length

          // Extract product title
          data.title =
            document.querySelector('h1')?.textContent?.trim() ||
            document.querySelector('[itemprop="name"]')?.textContent?.trim() ||
            document.querySelector('.product-title')?.textContent?.trim() ||
            document.querySelector('.product-name')?.textContent?.trim() ||
            ''

          // Extract product description
          const descriptionSelectors = [
            '[itemprop="description"]',
            '.product-description',
            '.product-desc',
            '#product-description',
            '.description',
          ]
          for (const selector of descriptionSelectors) {
            const elem = document.querySelector(selector)
            if (elem?.textContent) {
              data.description = elem.textContent.trim()
              break
            }
          }

          // Extract price
          const priceSelectors = [
            '[itemprop="price"]',
            '.price',
            '.product-price',
            '[class*="price"]',
          ]
          for (const selector of priceSelectors) {
            const elem = document.querySelector(selector)
            if (elem?.textContent) {
              data.price = elem.textContent.trim()
              break
            }
          }

          // Extract meta tags
          const metaTitleTag = document.querySelector('meta[property="og:title"]') ||
                               document.querySelector('title')
          data.metaTitle = metaTitleTag?.textContent?.trim() ||
                           (metaTitleTag as HTMLMetaElement)?.content || ''

          const metaDescTag = document.querySelector('meta[name="description"]') ||
                              document.querySelector('meta[property="og:description"]')
          data.metaDescription = (metaDescTag as HTMLMetaElement)?.content || ''

          const metaKeywordsTag = document.querySelector('meta[name="keywords"]')
          data.metaKeywords = (metaKeywordsTag as HTMLMetaElement)?.content || ''

          // Extract headings
          data.headings.h1 = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim() || '')
          data.headings.h2 = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim() || '')
          data.headings.h3 = Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim() || '')

          // Extract all text content
          const bodyText = document.body.innerText || ''
          data.textContent = bodyText.slice(0, 5000)
          data.wordCount = bodyText.split(/\s+/).filter(word => word.length > 0).length

          // Extract schema markup
          const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]')
          schemaScripts.forEach((script) => {
            try {
              const schemaData = JSON.parse(script.textContent || '')
              data.schemaMarkup.push(schemaData)
            } catch {
              // Invalid JSON, skip
            }
          })

          // Extract Open Graph tags
          const ogTags = document.querySelectorAll('meta[property^="og:"]')
          ogTags.forEach((tag) => {
            const property = tag.getAttribute('property')?.replace('og:', '') || ''
            const content = (tag as HTMLMetaElement).content || ''
            if (property && content) {
              data.openGraph[property] = content
            }
          })

          // Extract product-specific info from schema
          const productSchema = data.schemaMarkup.find(
            (schema: any) => schema['@type'] === 'Product' || schema['@type']?.includes('Product')
          )
          if (productSchema) {
            data.productInfo = {
              name: productSchema.name || '',
              description: productSchema.description || '',
              image: productSchema.image || [],
              brand: productSchema.brand?.name || '',
              sku: productSchema.sku || '',
              offers: productSchema.offers || {},
              aggregateRating: productSchema.aggregateRating || {},
            }
          }

          return data
        })

        sendLog('Product data extracted', `Found ${productData.imageCount} images, ${productData.wordCount} words`)

        // Step 4: Check meta tags
        sendLog('Analyzing meta tags', 'Checking title, description, and keywords')

        // Step 5: Check structured data
        sendLog('Checking structured data', `Found ${productData.schemaMarkup.length} schema markup${productData.schemaMarkup.length !== 1 ? 's' : ''}`)

        // Step 6: Analyzing images
        sendLog('Analyzing images', `Checking ${productData.imageCount} product images for optimization`)

        await browser.close()

        // Step 7: AI Analysis
        sendLog('Preparing AI analysis', 'Sending data to AI for comprehensive SEO recommendations')

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
          model: 'gemini-3-flash-preview',
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 4096,
          },
        })

        const analysisPrompt = `You are an expert SEO consultant specializing in e-commerce product page optimization. Analyze this product page and provide detailed, actionable SEO recommendations.

**Product Page Data:**
- URL: ${url}
- Page Load Time: ${loadTime}ms
- Title: ${productData.title}
- Description: ${productData.description}
- Price: ${productData.price}
- Meta Title: ${productData.metaTitle}
- Meta Description: ${productData.metaDescription}
- Meta Keywords: ${productData.metaKeywords}
- H1 Tags: ${JSON.stringify(productData.headings.h1)}
- H2 Tags: ${JSON.stringify(productData.headings.h2)}
- H3 Tags: ${JSON.stringify(productData.headings.h3)}
- Image Count: ${productData.imageCount}
- Word Count: ${productData.wordCount}
- Has Schema Markup: ${productData.schemaMarkup.length > 0 ? 'Yes' : 'No'}
- Schema Types: ${productData.schemaMarkup.map((s: any) => s['@type']).join(', ')}
- Open Graph Tags: ${JSON.stringify(productData.openGraph)}
- Product Info from Schema: ${JSON.stringify(productData.productInfo)}

**Sample Images (first 5):**
${JSON.stringify(productData.images.slice(0, 5), null, 2)}

**Text Content Preview:**
${productData.textContent.slice(0, 1000)}

---

**Provide a comprehensive SEO analysis in the following JSON structure:**

{
  "overallScore": <number 0-100>,
  "scoreBreakdown": {
    "contentQuality": <number 0-100>,
    "technicalSEO": <number 0-100>,
    "onPageOptimization": <number 0-100>,
    "userExperience": <number 0-100>
  },
  "criticalIssues": [
    {
      "title": "Issue title",
      "description": "What's wrong and why it matters",
      "impact": "high|medium|low",
      "fix": "Specific step-by-step instructions to fix"
    }
  ],
  "recommendations": {
    "metaTags": {
      "currentTitle": "current title",
      "suggestedTitle": "improved title with keywords",
      "currentDescription": "current description",
      "suggestedDescription": "improved description",
      "reasoning": "Why these changes will help"
    },
    "headings": {
      "issues": ["List of heading structure issues"],
      "suggestions": ["Specific improvements"]
    },
    "content": {
      "issues": ["Content problems"],
      "suggestions": ["How to improve content"],
      "targetWordCount": <number>,
      "keywordDensity": "Analysis of keyword usage"
    },
    "images": {
      "issues": ["Image optimization issues"],
      "suggestions": ["Specific fixes"],
      "missingAltText": <number>,
      "oversizedImages": <number>
    },
    "schema": {
      "hasPresentSchema": <boolean>,
      "missingSchemaTypes": ["List of missing schema types"],
      "seoSchema": {
        "description": "Standard Product schema for traditional search engines (Google, Bing)",
        "code": "Complete JSON-LD Product schema markup"
      },
      "aeoSchema": {
        "description": "Answer Engine Optimization schema for AI assistants (ChatGPT, Claude, Perplexity)",
        "code": "Enhanced schema with detailed Q&A and specifications"
      },
      "geoSchema": {
        "description": "Generative Engine Optimization schema for AI-powered search (SGE, Bing Chat)",
        "code": "Rich schema with extensive context for AI understanding"
      }
    },
    "performance": {
      "loadTimeAssessment": "Assessment of load time",
      "suggestions": ["Performance improvements"]
    }
  },
  "quickWins": [
    {
      "title": "Easy fix title",
      "description": "What to do",
      "expectedImpact": "Expected SEO benefit",
      "effort": "low|medium|high"
    }
  ],
  "competitorInsights": [
    "Insights on what competitors likely do better",
    "Opportunities to outrank competitors"
  ],
  "actionPlan": [
    {
      "priority": 1,
      "task": "First thing to do",
      "timeEstimate": "5 minutes|1 hour|etc",
      "expectedImpact": "What this will achieve"
    }
  ]
}

**Important Guidelines:**
1. Be specific and actionable - no vague advice
2. Focus on e-commerce best practices
3. Consider Google's E-E-A-T principles
4. Prioritize changes by impact vs effort
5. Include exact character counts for meta tags
6. Reference current Google algorithm preferences (2024-2025)
7. Provide copy-paste ready suggestions where possible

**Schema Generation Requirements:**
For the schema recommendations, generate three complete, copy-paste ready JSON-LD schemas:

1. **SEO Schema**: Standard Product schema optimized for traditional search engines
   - Include all required Product schema fields
   - Add offers, availability, ratings if available
   - Follow schema.org/Product specification exactly

2. **AEO Schema**: Enhanced for Answer Engine Optimization (AI assistants)
   - Include FAQ schema with common product questions
   - Add detailed product specifications as additionalProperty
   - Include use cases and benefits
   - Add customer reviews and ratings

3. **GEO Schema**: Rich schema for Generative Engine Optimization (AI search)
   - Combine Product + FAQPage + HowTo schemas
   - Add extensive context about product usage, comparison, alternatives
   - Include rich descriptions and detailed specifications
   - Add brand story and product lifecycle info

Each schema should be complete, valid JSON-LD that can be directly copied into a webpage's <script type="application/ld+json"> tag.

Generate the analysis now:`

        sendLog('Generating SEO recommendations', 'AI is analyzing the product page')

        const result = await model.generateContent(analysisPrompt)
        const responseText = result.response.text()

        sendLog('Parsing AI response', 'Extracting recommendations')

        // Extract JSON from response
        let analysis
        try {
          analysis = JSON.parse(responseText)
        } catch {
          const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[1])
          } else {
            const jsonStart = responseText.indexOf('{')
            const jsonEnd = responseText.lastIndexOf('}')
            if (jsonStart !== -1 && jsonEnd !== -1) {
              analysis = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1))
            } else {
              throw new Error('Could not extract JSON from AI response')
            }
          }
        }

        sendLog('Analysis complete', 'SEO recommendations ready')

        sendComplete(productData, analysis, {
          url,
          analyzedAt: new Date().toISOString(),
          loadTime,
        })

      } catch (error: any) {
        console.error('Product optimization error:', error)
        sendError(error.message || 'Failed to analyze product')
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
