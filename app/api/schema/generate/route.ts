import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { products, auditMetadata, auditReport } = await request.json()

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'No products provided. Please run a site audit first.' },
        { status: 400 }
      )
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    // Prepare AI analysis prompt
    const analysisPrompt = `You are an expert SEO consultant and schema.org specialist. Analyze this e-commerce website data and generate optimized schema markup recommendations.

Website Audit Data:
- SEO Score: ${auditMetadata?.score || 'N/A'}/100
- Page URL: ${auditMetadata?.url || 'N/A'}
- Existing Structured Data: ${auditMetadata?.pageData?.structuredDataCount || 0} schemas found
- Word Count: ${auditMetadata?.pageData?.wordCount || 0} words
- Products Discovered: ${products.length}

Products Data:
${JSON.stringify(products, null, 2)}

Audit Report Summary:
${auditReport?.substring(0, 2000) || 'No report available'}

Your Task:
1. Analyze what schema types would provide the MOST SEO benefit for this e-commerce site
2. For EACH product, generate a complete, valid Product schema
3. Identify opportunities for additional schemas (Organization, Review, FAQ, BreadcrumbList)
4. Prioritize recommendations by SEO impact

Schema Generation Rules:
- Use schema.org vocabulary (JSON-LD format)
- Include ALL available product data (name, description, image, price, brand, etc.)
- If data is missing, use reasonable defaults or mark as optional
- Add offers with InStock availability
- Include brand information if available
- Use proper currency codes (default to USD if not specified)
- Ensure all URLs are absolute, not relative
- Add priceValidUntil date (1 year from now)

Priority Levels:
- CRITICAL: Missing Product schemas (huge SEO impact)
- HIGH: Missing Organization schema, incomplete product data
- MEDIUM: Missing Review aggregation, FAQ schemas
- LOW: Breadcrumbs, additional enhancement schemas

Return ONLY valid JSON in this exact format:
{
  "overallAnalysis": {
    "currentSchemaHealth": "string (Poor/Fair/Good/Excellent)",
    "missingCritical": ["list of critical missing schemas"],
    "estimatedSEOImpact": "string (Low/Medium/High/Critical)",
    "keyRecommendations": ["top 3-5 actionable recommendations"]
  },
  "productSchemas": [
    {
      "productName": "string",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "schemaType": "Product",
      "schema": { /* complete JSON-LD schema object */ },
      "impact": "string (why this helps SEO)",
      "validation": {
        "isValid": boolean,
        "warnings": ["any warnings"],
        "missingOptional": ["optional fields that could be added"]
      }
    }
  ],
  "siteWideSchemas": [
    {
      "schemaType": "Organization" | "BreadcrumbList" | "FAQPage",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "schema": { /* complete JSON-LD schema object */ },
      "impact": "string (why this helps SEO)",
      "implementation": "string (where/how to add this)"
    }
  ],
  "recommendations": {
    "immediate": ["actions to take right now"],
    "shortTerm": ["actions for next 2 weeks"],
    "longTerm": ["ongoing improvements"]
  },
  "expectedImprovements": {
    "seoScoreIncrease": number (0-30 points),
    "richSnippetsEnabled": boolean,
    "aiAssistantReady": boolean,
    "voiceSearchOptimized": boolean
  }
}`

    console.log('Generating schema analysis...')

    const result = await model.generateContent(analysisPrompt)
    const responseText = result.response.text()
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim()

    console.log('AI response received, parsing JSON...')

    const analysisData = JSON.parse(responseText)

    // Validate the response structure
    if (!analysisData.productSchemas || !Array.isArray(analysisData.productSchemas)) {
      throw new Error('Invalid AI response: missing productSchemas array')
    }

    console.log(`Generated ${analysisData.productSchemas.length} product schemas`)

    return NextResponse.json({
      success: true,
      analysis: analysisData,
      timestamp: new Date().toISOString(),
      productsAnalyzed: products.length
    })

  } catch (error: any) {
    console.error('Schema generation error:', error)

    // Provide specific error messages
    let errorMessage = 'Failed to generate schema markup'
    if (error.message?.includes('API key')) {
      errorMessage = 'AI API authentication failed. Please check configuration.'
    } else if (error.message?.includes('quota')) {
      errorMessage = 'AI API quota exceeded. Please try again later.'
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Failed to parse AI response. Please try again.'
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message,
        success: false
      },
      { status: 500 }
    )
  }
}
