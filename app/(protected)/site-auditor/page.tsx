'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { TextShimmer } from '@/components/ui/text-shimmer'
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from '@/components/ui/chain-of-thought'
import { CheckCircle2, Loader2, AlertCircle, AlertTriangle, Info, TrendingUp, Zap, Image, FileText, Globe, Smartphone, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface LogEntry {
  id: string
  message: string
  detail?: string
  timestamp: number
  status: 'active' | 'complete'
}

export default function SiteAuditorPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [auditReport, setAuditReport] = useState<string>('')
  const [auditMetadata, setAuditMetadata] = useState<any>(null)
  const [analysisLogs, setAnalysisLogs] = useState<LogEntry[]>([])
  const [inputError, setInputError] = useState<string>('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Trends chart controls
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [timeFrame, setTimeFrame] = useState('today 12-m')
  const [region, setRegion] = useState('US')

  // Products display control
  const [showAllProducts, setShowAllProducts] = useState(false)

  // Convert exact score to range
  const getScoreRange = (score: number): string => {
    const rangeSize = 10
    const lowerBound = Math.floor(score / rangeSize) * rangeSize
    const upperBound = lowerBound + rangeSize
    return `${lowerBound}-${upperBound}`
  }

  // Parse report sections for visual display
  const parseReportSections = (report: string) => {
    const sections = report.split(/(?=^##\s)/m)
    return sections.map(section => {
      const lines = section.trim().split('\n')
      const title = lines[0]?.replace(/^##\s/, '') || ''
      const content = lines.slice(1).join('\n')
      return { title, content }
    }).filter(s => s.title)
  }

  // Get score color and label
  const getScoreInfo = (score: number) => {
    if (score >= 80) return { color: 'green', label: 'Excellent', gradient: 'from-green-500 to-emerald-600' }
    if (score >= 60) return { color: 'yellow', label: 'Good', gradient: 'from-yellow-500 to-orange-500' }
    return { color: 'red', label: 'Needs Work', gradient: 'from-red-500 to-rose-600' }
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [analysisLogs])

  // Initialize selected keywords when audit completes
  useEffect(() => {
    if (auditMetadata?.keywords && auditMetadata.keywords.length > 0) {
      setSelectedKeywords(auditMetadata.keywords.slice(0, 5))
    }
  }, [auditMetadata])

  // Toggle keyword selection
  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword)
      } else {
        // Limit to 5 keywords for better chart readability
        if (prev.length >= 5) {
          return prev
        }
        return [...prev, keyword]
      }
    })
  }

  // Validate URL or domain name
  const validateAndNormalizeUrl = (input: string): { isValid: boolean; url?: string; error?: string } => {
    const trimmed = input.trim()

    if (!trimmed) {
      return { isValid: false, error: 'Please enter a URL or domain name' }
    }

    // Check if it's a full URL
    try {
      const urlObj = new URL(trimmed)
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return { isValid: true, url: trimmed }
      }
    } catch {
      // Not a valid URL, check if it's a domain name
    }

    // Check if it looks like a domain name (e.g., example.com, subdomain.example.com)
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    if (domainRegex.test(trimmed)) {
      return { isValid: true, url: `https://${trimmed}` }
    }

    // Invalid input
    return {
      isValid: false,
      error: 'Please enter a valid URL (e.g., https://mystore.com) or domain name (e.g., mystore.com)'
    }
  }

  const handleAudit = async () => {
    if (!url.trim()) return

    // Validate input
    const validation = validateAndNormalizeUrl(url)
    if (!validation.isValid) {
      setInputError(validation.error || 'Invalid input')
      return
    }

    setInputError('')
    setLoading(true)
    setAuditReport('')
    setAuditMetadata(null)
    setAnalysisLogs([])

    try {
      const response = await fetch('/api/site/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validation.url })
      })

      if (!response.ok || !response.body) {
        throw new Error('Failed to start audit')
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
              setAuditReport(data.data.report)
              setAuditMetadata(data.data.metadata)
              setLoading(false)
            } else if (data.type === 'error') {
              setAnalysisLogs(prev => [...prev, {
                id: `error-${Date.now()}`,
                message: 'Error: ' + data.data.message,
                timestamp: Date.now(),
                status: 'complete' as const
              }])
              setLoading(false)
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e)
          }
        }
      }
    } catch (error: any) {
      setAnalysisLogs(prev => [...prev, {
        id: `error-${Date.now()}`,
        message: 'Network error: ' + error.message,
        timestamp: Date.now(),
        status: 'complete' as const
      }])
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="px-6 py-8 text-center">
          <h1 className="text-2xl font-normal text-gray-900 mb-2">Automated Site Auditor</h1>
          <p className="text-sm text-gray-600">
            Scan your site for technical SEO issues and get actionable fixes
          </p>
        </div>

        {/* URL Input */}
        <div className="px-6 py-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className={`flex items-center gap-0 bg-white border-2 rounded-full shadow-sm transition-all ${
              inputError ? 'border-red-300 focus-within:border-red-500' : 'border-gray-200 hover:border-gray-300 focus-within:border-blue-500 focus-within:shadow-md'
            }`}>
              <input
                type="text"
                placeholder="Enter URL (https://mystore.com) or domain (mystore.com)"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setInputError('')
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleAudit()}
                className="flex-1 px-6 py-3 text-base bg-transparent border-none outline-none rounded-l-full placeholder:text-gray-400"
              />
              <button
                onClick={handleAudit}
                disabled={loading || !url.trim()}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-base rounded-full transition-colors"
              >
                {loading ? 'Scanning...' : 'Run Audit'}
              </button>
            </div>

            {/* Error Message */}
            {inputError && (
              <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {inputError}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Loading State with Real-Time Logs */}
        {loading && (
          <div className="px-6 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <TextShimmer className="text-lg font-medium" duration={2}>
                    Analyzing your website...
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

        {/* AI-Generated Report */}
        {auditReport && !loading && (
          <div className="px-6 py-8 bg-gradient-to-b from-white to-gray-50">
            <div className="max-w-6xl mx-auto">
              {/* Hero Score Section */}
              {auditMetadata && (
                <div className="mb-8">
                  <Card className="relative overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-white via-gray-50 to-blue-50">
                    <div className="p-8 flex items-center justify-between">
                      <div className="flex-1">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">SEO Audit Report</h2>
                        <p className="text-sm text-gray-600 mb-4">
                          {auditMetadata.url}
                        </p>
                        <p className="text-xs text-gray-500">
                          Analyzed on {new Date(auditMetadata.analyzedAt).toLocaleDateString()} at {new Date(auditMetadata.analyzedAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Circular Score Gauge */}
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-white shadow-lg flex items-center justify-center relative">
                          <svg className="absolute inset-0 w-32 h-32 -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="#e5e7eb"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke={`${auditMetadata.score >= 80 ? '#10b981' : auditMetadata.score >= 60 ? '#f59e0b' : '#ef4444'}`}
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${(auditMetadata.score / 100) * 351.86} 351.86`}
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <div className="text-center z-10">
                            <div className={`text-3xl font-bold ${
                              auditMetadata.score >= 80 ? 'text-green-600' :
                              auditMetadata.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {auditMetadata.score}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              {getScoreInfo(auditMetadata.score).label}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Badge */}
                    <div className="absolute top-4 right-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        auditMetadata.score >= 80 ? 'bg-green-100 text-green-700' :
                        auditMetadata.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {auditMetadata.score >= 80 ? '✓ Optimized' : auditMetadata.score >= 60 ? '⚡ Needs Improvement' : '⚠️ Critical Issues'}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Generate Schema Button */}
              {auditMetadata && (
                <div className="mb-8">
                  <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to Generate Schema Markup?</h3>
                        <p className="text-sm text-gray-600">
                          Based on your site audit results, we can generate optimized schema markup to improve your search visibility and help AI assistants understand your content better.
                        </p>
                      </div>
                      <a
                        href={`/schema-generator?from=audit&url=${encodeURIComponent(auditMetadata.url)}&hasProducts=${auditMetadata.products ? 'true' : 'false'}`}
                        onClick={() => {
                          // Store audit data in sessionStorage for schema generator
                          if (auditMetadata.products) {
                            sessionStorage.setItem('auditProducts', JSON.stringify(auditMetadata.products))
                            sessionStorage.setItem('auditReport', auditReport)
                            sessionStorage.setItem('auditMetadata', JSON.stringify(auditMetadata))
                          }
                        }}
                        className="ml-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Generate Schema
                      </a>
                    </div>
                  </Card>
                </div>
              )}

              {/* Visual Metrics Grid */}
              {auditMetadata?.pageData && (
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-5 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        auditMetadata.loadTime < 2000 ? 'bg-green-100 text-green-700' :
                        auditMetadata.loadTime < 4000 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {auditMetadata.loadTime < 2000 ? 'Fast' : auditMetadata.loadTime < 4000 ? 'OK' : 'Slow'}
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{auditMetadata.loadTime}ms</div>
                    <div className="text-xs text-gray-600 font-medium mt-1">Page Load Time</div>
                  </Card>

                  <Card className="p-5 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        auditMetadata.pageData.wordCount >= 300 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {auditMetadata.pageData.wordCount >= 300 ? 'Good' : 'Low'}
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{auditMetadata.pageData.wordCount}</div>
                    <div className="text-xs text-gray-600 font-medium mt-1">Words</div>
                  </Card>

                  <Card className="p-5 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Image className="w-5 h-5 text-blue-600" />
                      </div>
                      <Info className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{auditMetadata.pageData.imageCount}</div>
                    <div className="text-xs text-gray-600 font-medium mt-1">Images</div>
                  </Card>

                  <Card className="p-5 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        auditMetadata.pageData.structuredDataCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {auditMetadata.pageData.structuredDataCount > 0 ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{auditMetadata.pageData.structuredDataCount}</div>
                    <div className="text-xs text-gray-600 font-medium mt-1">Schema Markups</div>
                  </Card>
                </div>
              )}

              {/* SEO Health Indicators */}
              {auditMetadata?.pageData && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Quick Health Check
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          auditMetadata.pageData.titleLength > 0 && auditMetadata.pageData.titleLength <= 60
                            ? 'bg-green-50'
                            : 'bg-red-50'
                        }`}>
                          {auditMetadata.pageData.titleLength > 0 && auditMetadata.pageData.titleLength <= 60 ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-900 mb-1">Title Tag</div>
                          <div className="text-xs text-gray-600">
                            {auditMetadata.pageData.titleLength} characters
                            <span className={`ml-2 ${
                              auditMetadata.pageData.titleLength > 0 && auditMetadata.pageData.titleLength <= 60
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {auditMetadata.pageData.titleLength > 60 && '(too long)'}
                              {auditMetadata.pageData.titleLength === 0 && '(missing)'}
                              {auditMetadata.pageData.titleLength > 0 && auditMetadata.pageData.titleLength <= 60 && '(optimal)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          auditMetadata.pageData.metaDescLength >= 120 && auditMetadata.pageData.metaDescLength <= 160
                            ? 'bg-green-50'
                            : 'bg-yellow-50'
                        }`}>
                          {auditMetadata.pageData.metaDescLength >= 120 && auditMetadata.pageData.metaDescLength <= 160 ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-900 mb-1">Meta Description</div>
                          <div className="text-xs text-gray-600">
                            {auditMetadata.pageData.metaDescLength} characters
                            <span className={`ml-2 ${
                              auditMetadata.pageData.metaDescLength >= 120 && auditMetadata.pageData.metaDescLength <= 160
                                ? 'text-green-600'
                                : 'text-yellow-600'
                            }`}>
                              {auditMetadata.pageData.metaDescLength === 0 && '(missing)'}
                              {auditMetadata.pageData.metaDescLength > 0 && auditMetadata.pageData.metaDescLength < 120 && '(too short)'}
                              {auditMetadata.pageData.metaDescLength > 160 && '(too long)'}
                              {auditMetadata.pageData.metaDescLength >= 120 && auditMetadata.pageData.metaDescLength <= 160 && '(optimal)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-white border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          auditMetadata.pageData.hasViewport ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          {auditMetadata.pageData.hasViewport ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-900 mb-1 flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            Mobile Friendly
                          </div>
                          <div className="text-xs text-gray-600">
                            {auditMetadata.pageData.hasViewport ? (
                              <span className="text-green-600">Viewport configured</span>
                            ) : (
                              <span className="text-red-600">No viewport tag</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Detailed Report with Enhanced Styling */}
              <Card className="p-8 md:p-12 bg-white shadow-xl border-2 border-gray-200">
                <div className="prose prose-gray prose-lg max-w-none
                  prose-headings:font-bold prose-headings:text-gray-900
                  prose-h1:text-3xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b-2 prose-h1:border-blue-200
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-blue-900 prose-h2:flex prose-h2:items-center prose-h2:gap-2
                  prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-5 prose-h3:text-gray-800
                  prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-6
                  prose-ul:my-6 prose-ul:space-y-3
                  prose-ol:my-6 prose-ol:space-y-3
                  prose-li:text-gray-700 prose-li:leading-relaxed
                  prose-strong:text-gray-900 prose-strong:font-semibold prose-strong:bg-yellow-50 prose-strong:px-1
                  prose-code:text-sm prose-code:bg-blue-50 prose-code:text-blue-700 prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:font-mono
                  prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:my-6 prose-pre:rounded-lg
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:my-6
                ">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      h2: ({children}) => (
                        <h2 className="flex items-center gap-2">
                          <span className="text-blue-600">▸</span>
                          {children}
                        </h2>
                      ),
                      p: ({children}) => <p className="mb-5">{children}</p>,
                      li: ({children}) => (
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{children}</span>
                        </li>
                      ),
                      br: () => <br className="my-2" />
                    }}
                  >
                    {auditReport}
                  </ReactMarkdown>
                </div>
              </Card>

              {/* Discovered Products Section */}
              {auditMetadata?.products && auditMetadata.products.length > 0 && (
                <div className="mt-8">
                  <Card className="p-8 bg-white border-2 border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Discovered Products</h3>
                        <p className="text-sm text-gray-600">
                          Found {auditMetadata.products.length} product{auditMetadata.products.length !== 1 ? 's' : ''} on your website
                          {auditMetadata.products.length > 6 && !showAllProducts && (
                            <span className="text-gray-500"> (showing top 6)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(showAllProducts ? auditMetadata.products : auditMetadata.products.slice(0, 6)).map((product: any, idx: number) => (
                        <Link
                          key={idx}
                          href={`/content-optimizer?productUrl=${encodeURIComponent(product.url || '')}&from=audit`}
                          onClick={() => {
                            // Store selected product in sessionStorage for Content Optimizer
                            sessionStorage.setItem('selectedProduct', JSON.stringify(product))
                          }}
                          className="block group cursor-pointer"
                        >
                          <Card className="overflow-hidden border-2 border-gray-200 hover:border-blue-500 hover:shadow-xl transition-all duration-300 h-full">
                            {product.image && (
                              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                <img
                                  src={product.image}
                                  alt={product.name || 'Product'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                                {/* Optimize Overlay */}
                                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors duration-300 flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                                    Optimize SEO →
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="p-4">
                              <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                {product.name || 'Untitled Product'}
                              </h4>
                              {product.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                                  {product.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                {product.price && (
                                  <p className="text-lg font-bold text-green-600">
                                    {product.currency || '$'}{product.price}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  {product.url && (
                                    <span className="text-sm text-gray-400 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                      </svg>
                                      Analyze
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>

                    {/* Show More/Less Button */}
                    {auditMetadata.products.length > 6 && (
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => setShowAllProducts(!showAllProducts)}
                          className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full transition-colors"
                        >
                          {showAllProducts ? (
                            <>
                              <ChevronUp className="w-5 h-5" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-5 h-5" />
                              Show All {auditMetadata.products.length} Products
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Keywords & Google Trends */}
              {auditMetadata?.keywords && auditMetadata.keywords.length > 0 && (
                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Detected Keywords</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Click keywords to add/remove from trends comparison (max 5)
                    </p>
                    <div className="flex flex-wrap gap-3 mb-6">
                      {auditMetadata.keywords.map((keyword: string, idx: number) => {
                        const isSelected = selectedKeywords.includes(keyword)
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleKeyword(keyword)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-md'
                                : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-blue-400 hover:bg-gray-200'
                            }`}
                          >
                            {keyword}
                            {isSelected && <span className="ml-2 text-xs">★</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Google Trends for Selected Keywords */}
                  {selectedKeywords.length > 0 && (
                    <Card className="p-6 bg-white border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            Search Trends for Top Keywords
                          </h3>
                          <p className="text-sm text-gray-600">
                            Compare search interest for {selectedKeywords.length} keyword{selectedKeywords.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Time Frame & Region Controls */}
                        <div className="flex gap-3">
                          <select
                            value={timeFrame}
                            onChange={(e) => setTimeFrame(e.target.value)}
                            className="px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                          >
                            <option value="now 1-H">Past hour</option>
                            <option value="now 4-H">Past 4 hours</option>
                            <option value="now 1-d">Past day</option>
                            <option value="now 7-d">Past 7 days</option>
                            <option value="today 1-m">Past 30 days</option>
                            <option value="today 3-m">Past 3 months</option>
                            <option value="today 12-m">Past 12 months</option>
                            <option value="today 5-y">Past 5 years</option>
                          </select>

                          <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                          >
                            <option value="">Worldwide</option>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="CA">Canada</option>
                            <option value="AU">Australia</option>
                            <option value="DE">Germany</option>
                            <option value="FR">France</option>
                            <option value="ES">Spain</option>
                            <option value="IT">Italy</option>
                            <option value="IN">India</option>
                            <option value="BR">Brazil</option>
                            <option value="MX">Mexico</option>
                            <option value="JP">Japan</option>
                            <option value="KR">South Korea</option>
                            <option value="CN">China</option>
                          </select>
                        </div>
                      </div>

                      <div className="w-full h-[450px] rounded-lg overflow-hidden border border-gray-200">
                        <iframe
                          key={`${selectedKeywords.join(',')}-${timeFrame}-${region}`}
                          src={`https://trends.google.com/trends/embed/explore/TIMESERIES?req=${encodeURIComponent(
                            JSON.stringify({
                              comparisonItem: selectedKeywords.map((kw: string) => ({
                                keyword: kw,
                                geo: region,
                                time: timeFrame
                              })),
                              category: 0,
                              property: ''
                            })
                          )}&tz=0`}
                          className="w-full h-full"
                          frameBorder="0"
                        />
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!auditReport && !loading && (
          <div className="px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to audit your site</h3>
              <p className="text-gray-600 mb-8">Enter your website URL above to scan for technical SEO issues</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <Card className="p-6 border-2 border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">What Gets Checked</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Page load speed and performance</li>
                    <li>• Mobile responsiveness</li>
                    <li>• Broken internal and external links</li>
                    <li>• Missing or duplicate meta tags</li>
                    <li>• Image optimization and alt text</li>
                    <li>• Structured data validation</li>
                  </ul>
                </Card>

                <Card className="p-6 border-2 border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">What You Get</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Overall SEO health score</li>
                    <li>• Prioritized list of issues</li>
                    <li>• Clear, actionable fix instructions</li>
                    <li>• One-click fixes for common issues</li>
                    <li>• Performance benchmarks</li>
                    <li>• Mobile optimization report</li>
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
