'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { CollapsibleSubNav } from '@/components/CollapsibleSubNav'
import { Package, Star, HelpCircle, Building2, CheckCircle2, Loader2, AlertCircle, Download, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type SchemaType = 'product' | 'review' | 'faq' | 'organization'

interface GeneratedSchemaAnalysis {
  overallAnalysis: {
    currentSchemaHealth: string
    missingCritical: string[]
    estimatedSEOImpact: string
    keyRecommendations: string[]
  }
  productSchemas: Array<{
    productName: string
    priority: string
    schemaType: string
    schema: any
    impact: string
    validation: {
      isValid: boolean
      warnings: string[]
      missingOptional: string[]
    }
  }>
  siteWideSchemas: Array<{
    schemaType: string
    priority: string
    schema: any
    impact: string
    implementation: string
  }>
  recommendations: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  }
  expectedImprovements: {
    seoScoreIncrease: number
    richSnippetsEnabled: boolean
    aiAssistantReady: boolean
    voiceSearchOptimized: boolean
  }
}

export default function SchemaGeneratorPage() {
  const searchParams = useSearchParams()
  const fromAudit = searchParams.get('from') === 'audit'
  const auditUrl = searchParams.get('url')
  const hasProducts = searchParams.get('hasProducts') === 'true'

  // Audit data state
  const [auditProducts, setAuditProducts] = useState<any[]>([])
  const [auditMetadata, setAuditMetadata] = useState<any>(null)
  const [auditReport, setAuditReport] = useState<string>('')

  // Auto-generation state
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string>('')
  const [generatedAnalysis, setGeneratedAnalysis] = useState<GeneratedSchemaAnalysis | null>(null)
  const [generationError, setGenerationError] = useState<string>('')

  // UI state
  const [activeType, setActiveType] = useState<SchemaType>('product')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState<number>(0)
  const [copiedIndex, setCopiedIndex] = useState<number | string | null>(null)

  // Manual form state (fallback)
  const [showManualForms, setShowManualForms] = useState(false)

  // Load audit data from sessionStorage
  useEffect(() => {
    if (fromAudit) {
      try {
        const productsData = sessionStorage.getItem('auditProducts')
        const metadataData = sessionStorage.getItem('auditMetadata')
        const reportData = sessionStorage.getItem('auditReport')

        if (productsData) {
          const products = JSON.parse(productsData)
          setAuditProducts(products)
          // Select all products by default
          setSelectedProducts(products.map((_: any, idx: number) => idx))
        }

        if (metadataData) {
          setAuditMetadata(JSON.parse(metadataData))
        }

        if (reportData) {
          setAuditReport(reportData)
        }
      } catch (error) {
        console.error('Failed to load audit data:', error)
        setGenerationError('Failed to load audit data from storage')
      }
    }
  }, [fromAudit])

  // Auto-generate schemas when coming from audit
  useEffect(() => {
    if (fromAudit && auditProducts.length > 0 && !autoGenerating && !generatedAnalysis) {
      autoGenerateSchemas()
    }
  }, [fromAudit, auditProducts])

  const autoGenerateSchemas = async () => {
    setAutoGenerating(true)
    setGenerationError('')

    try {
      setGenerationProgress('Loading audit data...')
      await new Promise(resolve => setTimeout(resolve, 500))

      setGenerationProgress('Analyzing products...')
      await new Promise(resolve => setTimeout(resolve, 500))

      setGenerationProgress('Generating optimized schemas...')

      const selectedProductData = selectedProducts.map(idx => auditProducts[idx])

      const response = await fetch('/api/schema/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProductData,
          auditMetadata,
          auditReport
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate schemas')
      }

      setGenerationProgress('Validating markup...')
      await new Promise(resolve => setTimeout(resolve, 500))

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Schema generation failed')
      }

      setGeneratedAnalysis(data.analysis)
      setGenerationProgress('Complete!')
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error: any) {
      console.error('Auto-generation error:', error)
      setGenerationError(error.message || 'Failed to generate schemas')
    } finally {
      setAutoGenerating(false)
      setGenerationProgress('')
    }
  }

  const toggleProductSelection = (index: number) => {
    setSelectedProducts(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index)
      }
      return [...prev, index]
    })
  }

  const selectAllProducts = () => {
    setSelectedProducts(auditProducts.map((_, idx) => idx))
  }

  const deselectAllProducts = () => {
    setSelectedProducts([])
  }

  const copySchemaToClipboard = (schema: any, index: number | string) => {
    const schemaText = JSON.stringify(schema, null, 2)
    navigator.clipboard.writeText(schemaText)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const downloadAllSchemas = () => {
    if (!generatedAnalysis) return

    const allSchemas = [
      ...generatedAnalysis.productSchemas.map(s => s.schema),
      ...generatedAnalysis.siteWideSchemas.map(s => s.schema)
    ]

    const schemasText = JSON.stringify(allSchemas, null, 2)
    const blob = new Blob([schemasText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schemas-${auditMetadata?.url?.replace(/[^a-z0-9]/gi, '-') || 'generated'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-300'
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'LOW': return 'bg-blue-100 text-blue-700 border-blue-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const subNavItems = [
    { id: 'product', label: 'Product Schema', icon: <Package className="w-5 h-5" /> },
    { id: 'review', label: 'Review Schema', icon: <Star className="w-5 h-5" /> },
    { id: 'faq', label: 'FAQ Schema', icon: <HelpCircle className="w-5 h-5" /> },
    { id: 'organization', label: 'Organization', icon: <Building2 className="w-5 h-5" /> },
  ]

  return (
    <div className="min-h-screen bg-white">
      <div>
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-6 border-b border-gray-200 bg-white text-center">
          <h1 className="text-2xl font-normal text-gray-900 mb-2">AI-Powered Schema Generator</h1>
          <p className="text-sm text-gray-600">
            {fromAudit
              ? 'Automatically generate optimized schema markup based on your site audit'
              : 'Create structured data markup for better visibility in search results'}
          </p>
        </div>

        {/* Audit Context Banner */}
        {fromAudit && auditUrl && (
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-200">
            <div className="max-w-6xl mx-auto flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">
                  Using audit context from <span className="font-bold">{auditUrl}</span>
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  {auditProducts.length > 0
                    ? `Found ${auditProducts.length} products. Generating optimized schema automatically...`
                    : 'Schema recommendations will be based on your site audit results.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Loading State */}
            {autoGenerating && (
              <div className="mb-8">
                <Card className="p-8 bg-gray-50 border-2 border-gray-200">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <div>
                      <TextShimmer className="text-lg font-medium" duration={2}>
                        {generationProgress || 'Generating schemas...'}
                      </TextShimmer>
                      <p className="text-sm text-gray-500">This may take 10-30 seconds</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['Loading audit data...', 'Analyzing products...', 'Generating schemas...', 'Validating markup...'].map((step, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded ${
                        generationProgress === step
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : generationProgress === 'Complete!' || idx < ['Loading audit data...', 'Analyzing products...', 'Generating schemas...', 'Validating markup...'].indexOf(generationProgress)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {step}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Error State */}
            {generationError && (
              <Card className="p-6 bg-red-50 border-2 border-red-200 mb-8">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Generation Error</h3>
                    <p className="text-sm text-red-700">{generationError}</p>
                    <button
                      onClick={autoGenerateSchemas}
                      className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Generated Analysis Results */}
            {generatedAnalysis && !autoGenerating && (
              <div className="space-y-8">
                {/* Overall Analysis Summary */}
                <Card className="p-8 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Schema Analysis Complete</h2>
                      <p className="text-gray-600">
                        Generated {generatedAnalysis.productSchemas.length} product schemas and {generatedAnalysis.siteWideSchemas.length} site-wide schemas
                      </p>
                    </div>
                    <button
                      onClick={downloadAllSchemas}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download All
                    </button>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        +{generatedAnalysis.expectedImprovements.seoScoreIncrease}
                      </div>
                      <div className="text-xs text-gray-600">SEO Score Increase</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {generatedAnalysis.productSchemas.length}
                      </div>
                      <div className="text-xs text-gray-600">Product Schemas</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        {generatedAnalysis.expectedImprovements.richSnippetsEnabled ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-yellow-600" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600">Rich Snippets</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        {generatedAnalysis.expectedImprovements.aiAssistantReady ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-yellow-600" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600">AI Assistant Ready</div>
                    </div>
                  </div>

                  {/* Key Recommendations */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Key Recommendations</h3>
                    <ul className="space-y-2">
                      {generatedAnalysis.overallAnalysis.keyRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>

                {/* Product Schemas */}
                {generatedAnalysis.productSchemas.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Generated Product Schemas</h2>
                    <div className="space-y-4">
                      {generatedAnalysis.productSchemas.map((item, idx) => (
                        <Card key={idx} className="p-6 border-2 border-gray-200 hover:shadow-lg transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{item.productName}</h3>
                                <Badge className={`${getPriorityColor(item.priority)} border`}>
                                  {item.priority}
                                </Badge>
                                {item.validation.isValid && (
                                  <Badge className="bg-green-100 text-green-700 border border-green-300">
                                    ✓ Valid
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{item.impact}</p>
                              {item.validation.warnings.length > 0 && (
                                <div className="mb-3">
                                  {item.validation.warnings.map((warning, wIdx) => (
                                    <p key={wIdx} className="text-xs text-yellow-700 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      {warning}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => copySchemaToClipboard(item.schema, idx)}
                              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>

                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-96">
                            {JSON.stringify(item.schema, null, 2)}
                          </pre>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Site-Wide Schemas */}
                {generatedAnalysis.siteWideSchemas.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Site-Wide Schemas</h2>
                    <div className="space-y-4">
                      {generatedAnalysis.siteWideSchemas.map((item, idx) => (
                        <Card key={idx} className="p-6 border-2 border-gray-200">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{item.schemaType}</h3>
                                <Badge className={`${getPriorityColor(item.priority)} border`}>
                                  {item.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{item.impact}</p>
                              <p className="text-xs text-gray-500 italic">{item.implementation}</p>
                            </div>
                            <button
                              onClick={() => copySchemaToClipboard(item.schema, `site-${idx}`)}
                              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                              {copiedIndex === `site-${idx}` ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>

                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-96">
                            {JSON.stringify(item.schema, null, 2)}
                          </pre>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Implementation Roadmap */}
                <Card className="p-8 bg-blue-50 border-2 border-blue-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Implementation Roadmap</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                        Immediate Actions (Do Now)
                      </h3>
                      <ul className="space-y-2 ml-4">
                        {generatedAnalysis.recommendations.immediate.map((action, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{action}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-bold text-orange-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                        Short-Term (Next 2 Weeks)
                      </h3>
                      <ul className="space-y-2 ml-4">
                        {generatedAnalysis.recommendations.shortTerm.map((action, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{action}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        Long-Term (Ongoing)
                      </h3>
                      <ul className="space-y-2 ml-4">
                        {generatedAnalysis.recommendations.longTerm.map((action, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{action}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>

                {/* How to Use */}
                <Card className="p-6 border-2 border-green-200 bg-green-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">How to Implement These Schemas</h3>
                  <ol className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">1.</span>
                      <span>Copy each schema using the "Copy" button</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">2.</span>
                      <span>Wrap each schema in a <code className="bg-white px-1 rounded">{`<script type="application/ld+json">`}</code> tag</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">3.</span>
                      <span>Add Product schemas to their respective product pages in the <code className="bg-white px-1 rounded">{`<head>`}</code> section</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">4.</span>
                      <span>Add site-wide schemas (Organization, BreadcrumbList) to your homepage or main template</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">5.</span>
                      <span>Test using Google's <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Rich Results Test</a></span>
                    </li>
                  </ol>
                </Card>
              </div>
            )}

            {/* Product Selection UI (shown before generation) */}
            {!autoGenerating && !generatedAnalysis && auditProducts.length > 0 && (
              <div className="space-y-6">
                <Card className="p-6 border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">Products from Site Audit</h2>
                      <p className="text-sm text-gray-600">
                        Select products to generate schema for ({selectedProducts.length} of {auditProducts.length} selected)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllProducts}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllProducts}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {auditProducts.map((product, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleProductSelection(idx)}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                          selectedProducts.includes(idx)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        {product.image && (
                          <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                            <img
                              src={product.image}
                              alt={product.name || 'Product'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">
                            {product.name || 'Untitled Product'}
                          </h3>
                          {selectedProducts.includes(idx) && (
                            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                        {product.price && (
                          <p className="text-sm font-bold text-green-600 mt-2">
                            {product.currency || '$'}{product.price}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={autoGenerateSchemas}
                    disabled={selectedProducts.length === 0}
                    className="w-full mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-lg rounded-lg transition-colors"
                  >
                    Generate Schemas for {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
                  </button>
                </Card>
              </div>
            )}

            {/* Empty State / Manual Form Fallback */}
            {!fromAudit && !autoGenerating && auditProducts.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Audit Data Available</h3>
                <p className="text-gray-600 mb-6">Run a site audit first to automatically generate schemas, or create manual forms</p>
                <div className="flex gap-4 justify-center">
                  <a
                    href="/site-auditor"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Run Site Audit
                  </a>
                  <button
                    onClick={() => setShowManualForms(true)}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    Use Manual Forms
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
