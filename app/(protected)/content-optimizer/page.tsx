'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { TextShimmer } from '@/components/ui/text-shimmer'
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from '@/components/ui/chain-of-thought'
import { CheckCircle2, Loader2, AlertCircle, AlertTriangle, Copy, Check, Zap, TrendingUp, Image, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogEntry {
  id: string
  message: string
  detail?: string
  timestamp: number
  status: 'active' | 'complete'
}

export default function ContentOptimizerPage() {
  const searchParams = useSearchParams()
  const productUrl = searchParams.get('productUrl')
  const fromAudit = searchParams.get('from') === 'audit'

  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [productData, setProductData] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [analysisLogs, setAnalysisLogs] = useState<LogEntry[]>([])
  const [previewProduct, setPreviewProduct] = useState<any>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [analysisLogs])

  // Load product from sessionStorage if coming from audit
  useEffect(() => {
    if (fromAudit) {
      const storedProduct = sessionStorage.getItem('selectedProduct')
      if (storedProduct) {
        const product = JSON.parse(storedProduct)
        setPreviewProduct(product)
        console.log('Loaded product from audit:', product)
      }
    }

    // Auto-analyze if we have a product URL
    if (productUrl && !analyzing && !productData) {
      analyzeProduct()
    }
  }, [fromAudit, productUrl])

  const analyzeProduct = async () => {
    if (!productUrl) {
      setError('No product URL provided')
      return
    }

    setLoading(true)
    setAnalyzing(true)
    setError('')
    setAnalysisLogs([])

    try {
      const response = await fetch('/api/content/optimize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Failed to start analysis')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'log') {
              const logId = `log-${data.data.timestamp}`

              setAnalysisLogs(prev => {
                const updated = prev.map(log => ({ ...log, status: 'complete' as const }))
                return [...updated, {
                  id: logId,
                  message: data.data.message,
                  detail: data.data.detail,
                  timestamp: data.data.timestamp,
                  status: 'active' as const
                }]
              })
            } else if (data.type === 'progress') {
              const logId = `progress-${data.data.timestamp}`
              setAnalysisLogs(prev => {
                const updated = prev.map(log => ({ ...log, status: 'complete' as const }))
                return [...updated, {
                  id: logId,
                  message: data.data.message,
                  timestamp: data.data.timestamp,
                  status: 'active' as const
                }]
              })
            } else if (data.type === 'complete') {
              setAnalysisLogs(prev => prev.map(log => ({ ...log, status: 'complete' as const })))
              setProductData(data.data.productData)
              setAnalysis(data.data.analysis)
              setMetadata(data.data.metadata)
              setLoading(false)
            } else if (data.type === 'error') {
              setAnalysisLogs(prev => [...prev, {
                id: `error-${Date.now()}`,
                message: 'Error: ' + data.data.message,
                timestamp: Date.now(),
                status: 'complete' as const
              }])
              setError(data.data.message)
              setLoading(false)
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e)
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze product')
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getImpactBadge = (impact: string) => {
    const colors: any = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300',
    }
    return colors[impact] || colors.medium
  }

  const getEffortBadge = (effort: string) => {
    const colors: any = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700',
    }
    return colors[effort] || colors.medium
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="px-6 py-8 text-center border-b border-gray-200">
          <h1 className="text-2xl font-normal text-gray-900 mb-2">Product Content Optimizer</h1>
          <p className="text-sm text-gray-600">
            AI-powered SEO analysis and recommendations for your product page
          </p>
        </div>

        {/* Loading State with Real-Time Logs */}
        {loading && (
          <div className="px-6 py-8">
            <div className="max-w-4xl mx-auto">
              {/* Product Preview Card during Loading */}
              {previewProduct && (
                <Card className="overflow-hidden border-2 border-gray-200 mb-6">
                  <div className="flex flex-col sm:flex-row">
                    {/* Product Image */}
                    {previewProduct.image && (
                      <div className="w-full sm:w-48 flex-shrink-0 bg-gray-100 relative overflow-hidden">
                        <div className="aspect-square">
                          <img
                            src={previewProduct.image}
                            alt={previewProduct.name || 'Product'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Product Info */}
                    <div className="flex-1 p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {previewProduct.name || 'Analyzing Product...'}
                      </h3>
                      {previewProduct.price && (
                        <p className="text-lg font-bold text-green-600 mb-2">
                          {previewProduct.currency || '$'}{previewProduct.price}
                        </p>
                      )}
                      {previewProduct.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{previewProduct.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <TextShimmer className="text-lg font-medium" duration={2}>
                    Analyzing product page...
                  </TextShimmer>
                  <p className="text-sm text-gray-500">This may take 30-60 seconds</p>
                </div>
              </div>

              {analysisLogs.length > 0 && (
                <Card className="p-6 bg-gray-50 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Analysis Progress</h3>
                  <ChainOfThought className="space-y-0">
                    {analysisLogs.map((log, index) => (
                      <ChainOfThoughtStep
                        key={log.id}
                        isLast={index === analysisLogs.length - 1}
                        defaultOpen={log.status === 'active'}
                      >
                        <ChainOfThoughtTrigger
                          leftIcon={
                            log.status === 'complete' ? (
                              <CheckCircle2 className="size-4 text-green-600" />
                            ) : (
                              <Loader2 className="size-4 text-purple-600 animate-spin" />
                            )
                          }
                          swapIconOnHover={false}
                        >
                          {log.message}
                        </ChainOfThoughtTrigger>
                        {log.detail && (
                          <ChainOfThoughtContent>
                            <ChainOfThoughtItem className="text-xs text-gray-600">
                              {log.detail}
                            </ChainOfThoughtItem>
                          </ChainOfThoughtContent>
                        )}
                      </ChainOfThoughtStep>
                    ))}
                  </ChainOfThought>
                  <div ref={logsEndRef} />
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="px-6 py-8">
            <div className="max-w-4xl mx-auto">
              {/* Product Preview Card in Error State */}
              {previewProduct && (
                <Card className="overflow-hidden border-2 border-gray-200 mb-6">
                  <div className="flex flex-col sm:flex-row">
                    {/* Product Image */}
                    {previewProduct.image && (
                      <div className="w-full sm:w-48 flex-shrink-0 bg-gray-100 relative overflow-hidden">
                        <div className="aspect-square">
                          <img
                            src={previewProduct.image}
                            alt={previewProduct.name || 'Product'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Product Info */}
                    <div className="flex-1 p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {previewProduct.name || 'Product'}
                      </h3>
                      {previewProduct.price && (
                        <p className="text-lg font-bold text-green-600 mb-2">
                          {previewProduct.currency || '$'}{previewProduct.price}
                        </p>
                      )}
                      {previewProduct.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{previewProduct.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6 bg-red-50 border-2 border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-red-900 mb-1">Analysis Failed</h3>
                    <p className="text-sm text-red-700 mb-4">{error}</p>
                    <Button
                      onClick={analyzeProduct}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Results */}
        {analysis && productData && !loading && (
          <div className="px-6 py-8 space-y-8">
            {/* Product Overview */}
            <div className="max-w-6xl mx-auto">
              <Card className="overflow-hidden border-2 border-gray-200">
                <div className="flex flex-col md:flex-row">
                  {/* Product Image - Large Display */}
                  {(() => {
                    // Get the best available image source
                    const apiImageSrc = productData.images?.[0]?.src
                    const previewImageSrc = previewProduct?.image
                    const imageSrc = apiImageSrc || previewImageSrc
                    const imageAlt = productData.images?.[0]?.alt || previewProduct?.name || 'Product'

                    if (!imageSrc) return null

                    return (
                      <div className="w-full md:w-80 flex-shrink-0 bg-gray-100 relative overflow-hidden">
                        <div className="aspect-square">
                          <img
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If the primary image fails, try the preview image
                              const target = e.target as HTMLImageElement
                              if (target.src !== previewImageSrc && previewImageSrc) {
                                target.src = previewImageSrc
                              } else {
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23e5e7eb" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E'
                              }
                            }}
                          />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Product Info & Score */}
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{productData.title || 'Product'}</h2>
                      {productData.price && (
                        <p className="text-2xl font-bold text-green-600 mb-4">{productData.price}</p>
                      )}
                      {productData.description && (
                        <p className="text-sm text-gray-600 line-clamp-4 mb-4">{productData.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Image className="w-4 h-4" />
                          {productData.imageCount} images
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {productData.wordCount} words
                        </span>
                      </div>
                    </div>

                    {/* Overall Score */}
                    <div className="mt-6 flex items-center gap-4">
                      <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${getScoreColor(analysis.overallScore)}`}>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{analysis.overallScore}</div>
                          <div className="text-xs font-medium">Score</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">SEO Health Score</p>
                        <p>{analysis.overallScore >= 80 ? 'Great job! Your product page is well optimized.' : analysis.overallScore >= 60 ? 'Good start, but there\'s room for improvement.' : 'Needs attention - see recommendations below.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Score Breakdown */}
            {analysis.scoreBreakdown && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Score Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Content Quality</div>
                    <div className={`text-2xl font-bold ${analysis.scoreBreakdown.contentQuality >= 80 ? 'text-green-600' : analysis.scoreBreakdown.contentQuality >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {analysis.scoreBreakdown.contentQuality}
                    </div>
                  </Card>
                  <Card className="p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Technical SEO</div>
                    <div className={`text-2xl font-bold ${analysis.scoreBreakdown.technicalSEO >= 80 ? 'text-green-600' : analysis.scoreBreakdown.technicalSEO >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {analysis.scoreBreakdown.technicalSEO}
                    </div>
                  </Card>
                  <Card className="p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">On-Page Optimization</div>
                    <div className={`text-2xl font-bold ${analysis.scoreBreakdown.onPageOptimization >= 80 ? 'text-green-600' : analysis.scoreBreakdown.onPageOptimization >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {analysis.scoreBreakdown.onPageOptimization}
                    </div>
                  </Card>
                  <Card className="p-4 border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">User Experience</div>
                    <div className={`text-2xl font-bold ${analysis.scoreBreakdown.userExperience >= 80 ? 'text-green-600' : analysis.scoreBreakdown.userExperience >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {analysis.scoreBreakdown.userExperience}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Critical Issues */}
            {analysis.criticalIssues && analysis.criticalIssues.length > 0 && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Critical Issues
                </h3>
                <div className="space-y-4">
                  {analysis.criticalIssues.map((issue: any, idx: number) => (
                    <Card key={idx} className="p-6 border-2 border-red-200 bg-red-50">
                      <div className="flex items-start gap-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getImpactBadge(issue.impact)}`}>
                          {issue.impact.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">{issue.title}</h4>
                          <p className="text-sm text-gray-700 mb-3">{issue.description}</p>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-sm font-medium text-gray-900 mb-1">How to Fix:</p>
                            <p className="text-sm text-gray-700">{issue.fix}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Wins */}
            {analysis.quickWins && analysis.quickWins.length > 0 && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Quick Wins
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.quickWins.map((win: any, idx: number) => (
                    <Card key={idx} className="p-5 border border-gray-200 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">{win.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEffortBadge(win.effort)}`}>
                          {win.effort}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{win.description}</p>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-blue-900">Expected Impact:</p>
                        <p className="text-sm text-blue-700">{win.expectedImpact}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Meta Tags Recommendations */}
            {analysis.recommendations?.metaTags && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Meta Tags Optimization</h3>
                <Card className="p-6 border-2 border-gray-200">
                  {/* Title Tag */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Title Tag</h4>
                    <div className="space-y-3">
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-red-700">CURRENT</span>
                          <span className="text-xs text-red-600">
                            {analysis.recommendations.metaTags.currentTitle?.length || 0} characters
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{analysis.recommendations.metaTags.currentTitle || 'None'}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-green-700">SUGGESTED</span>
                          <button
                            onClick={() => copyToClipboard(analysis.recommendations.metaTags.suggestedTitle, 'title')}
                            className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1"
                          >
                            {copiedField === 'title' ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{analysis.recommendations.metaTags.suggestedTitle}</p>
                        <p className="text-xs text-green-600 mt-2">
                          {analysis.recommendations.metaTags.suggestedTitle?.length || 0} characters
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Meta Description */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Meta Description</h4>
                    <div className="space-y-3">
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-red-700">CURRENT</span>
                          <span className="text-xs text-red-600">
                            {analysis.recommendations.metaTags.currentDescription?.length || 0} characters
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{analysis.recommendations.metaTags.currentDescription || 'None'}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-green-700">SUGGESTED</span>
                          <button
                            onClick={() => copyToClipboard(analysis.recommendations.metaTags.suggestedDescription, 'description')}
                            className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1"
                          >
                            {copiedField === 'description' ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-gray-800">{analysis.recommendations.metaTags.suggestedDescription}</p>
                        <p className="text-xs text-green-600 mt-2">
                          {analysis.recommendations.metaTags.suggestedDescription?.length || 0} characters
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-1">Why These Changes Help:</p>
                    <p className="text-sm text-blue-800">{analysis.recommendations.metaTags.reasoning}</p>
                  </div>
                </Card>
              </div>
            )}

            {/* Action Plan */}
            {analysis.actionPlan && analysis.actionPlan.length > 0 && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Prioritized Action Plan
                </h3>
                <div className="space-y-3">
                  {analysis.actionPlan.map((action: any, idx: number) => (
                    <Card key={idx} className="p-5 border-l-4 border-l-blue-600">
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {action.priority}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">{action.task}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {action.timeEstimate}
                            </span>
                            <span className="text-green-600 font-medium">{action.expectedImpact}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Recommendations Accordion */}
            {analysis.recommendations && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Additional Recommendations</h3>
                <div className="space-y-4">
                  {/* Content Recommendations */}
                  {analysis.recommendations.content && (
                    <Card className="p-5 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Content Optimization</h4>
                      {analysis.recommendations.content.issues && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Issues:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                            {analysis.recommendations.content.issues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.recommendations.content.suggestions && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Suggestions:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                            {analysis.recommendations.content.suggestions.map((suggestion: string, idx: number) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.recommendations.content.targetWordCount && (
                        <p className="text-sm text-gray-700">
                          <strong>Target Word Count:</strong> {analysis.recommendations.content.targetWordCount}
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Image Recommendations */}
                  {analysis.recommendations.images && (
                    <Card className="p-5 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Image Optimization</h4>
                      {analysis.recommendations.images.issues && (
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-3">
                          {analysis.recommendations.images.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      {analysis.recommendations.images.suggestions && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Fixes:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                            {analysis.recommendations.images.suggestions.map((suggestion: string, idx: number) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Schema Recommendations */}
                  {analysis.recommendations.schema && (
                    <Card className="p-5 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Schema Markup</h4>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-700">
                          <strong>Has Schema:</strong>{' '}
                          <span className={analysis.recommendations.schema.hasPresentSchema ? 'text-green-600' : 'text-red-600'}>
                            {analysis.recommendations.schema.hasPresentSchema ? 'Yes' : 'No'}
                          </span>
                        </p>
                        {analysis.recommendations.schema.missingSchemaTypes && analysis.recommendations.schema.missingSchemaTypes.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Missing Schema Types:</p>
                            <div className="flex flex-wrap gap-2">
                              {analysis.recommendations.schema.missingSchemaTypes.map((type: string, idx: number) => (
                                <span key={idx} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                  {type}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Copy-Paste Ready Schemas */}
            {analysis.recommendations?.schema && (analysis.recommendations.schema.seoSchema || analysis.recommendations.schema.aeoSchema || analysis.recommendations.schema.geoSchema) && (
              <div className="max-w-6xl mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Copy-Paste Ready Schemas</h3>
                <div className="space-y-4">
                  {/* SEO Schema */}
                  {analysis.recommendations.schema.seoSchema && (
                    <Card className="p-5 border-2 border-blue-200 bg-blue-50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            SEO Schema (Traditional Search)
                          </h4>
                          <p className="text-xs text-gray-600">{analysis.recommendations.schema.seoSchema.description}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(analysis.recommendations.schema.seoSchema.code, 'seo-schema')}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                          {copiedField === 'seo-schema' ? (
                            <>
                              <Check className="w-4 h-4" />
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
                      <pre className="bg-white p-4 rounded-lg border border-gray-300 overflow-x-auto text-xs">
                        <code>{analysis.recommendations.schema.seoSchema.code}</code>
                      </pre>
                    </Card>
                  )}

                  {/* AEO Schema */}
                  {analysis.recommendations.schema.aeoSchema && (
                    <Card className="p-5 border-2 border-purple-200 bg-purple-50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AEO Schema (AI Assistants)
                          </h4>
                          <p className="text-xs text-gray-600">{analysis.recommendations.schema.aeoSchema.description}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(analysis.recommendations.schema.aeoSchema.code, 'aeo-schema')}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                          {copiedField === 'aeo-schema' ? (
                            <>
                              <Check className="w-4 h-4" />
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
                      <pre className="bg-white p-4 rounded-lg border border-gray-300 overflow-x-auto text-xs">
                        <code>{analysis.recommendations.schema.aeoSchema.code}</code>
                      </pre>
                    </Card>
                  )}

                  {/* GEO Schema */}
                  {analysis.recommendations.schema.geoSchema && (
                    <Card className="p-5 border-2 border-green-200 bg-green-50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            GEO Schema (AI-Powered Search)
                          </h4>
                          <p className="text-xs text-gray-600">{analysis.recommendations.schema.geoSchema.description}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(analysis.recommendations.schema.geoSchema.code, 'geo-schema')}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                          {copiedField === 'geo-schema' ? (
                            <>
                              <Check className="w-4 h-4" />
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
                      <pre className="bg-white p-4 rounded-lg border border-gray-300 overflow-x-auto text-xs">
                        <code>{analysis.recommendations.schema.geoSchema.code}</code>
                      </pre>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State - No Product URL */}
        {!productUrl && !loading && (
          <div className="px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Selected</h3>
              <p className="text-gray-600 mb-4">
                Navigate here from the Site Auditor by clicking on a product, or provide a product URL
              </p>
              <a
                href="/site-auditor"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Site Auditor
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
