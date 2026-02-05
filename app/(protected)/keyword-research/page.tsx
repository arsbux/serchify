'use client'
import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TextShimmer } from '@/components/ui/text-shimmer'
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from '@/components/ui/chain-of-thought'
import { CheckCircle2, Loader2, Users, TrendingUp } from 'lucide-react'
import { CollapsibleSubNav } from '@/components/CollapsibleSubNav'

type TimeFrame = '1h' | '4h' | '1d' | '7d' | '30d' | '90d' | '12m' | '5y'
type TabType = 'competitor' | 'trends'

interface LogEntry {
  id: string
  message: string
  detail?: string
  timestamp: number
  status: 'active' | 'complete'
}

const timeFrameOptions: { value: TimeFrame; label: string }[] = [
  { value: '1h', label: 'Past hour' },
  { value: '4h', label: 'Past 4 hours' },
  { value: '1d', label: 'Past day' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
  { value: '90d', label: 'Past 90 days' },
  { value: '12m', label: 'Past 12 months' },
  { value: '5y', label: 'Past 5 years' }
]

export default function KeywordResearchPage() {
  const [activeTab, setActiveTab] = useState<TabType>('trends')

  // Competitor Analysis State
  const [competitorInput, setCompetitorInput] = useState('')
  const [competitorResult, setCompetitorResult] = useState<any>(null)
  const [competitorLoading, setCompetitorLoading] = useState(false)
  const [competitorTimeFrame, setCompetitorTimeFrame] = useState<TimeFrame>('12m')
  const [analysisLogs, setAnalysisLogs] = useState<LogEntry[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Keyword Trends State
  const [keyword, setKeyword] = useState('')
  const [searchedKeyword, setSearchedKeyword] = useState('')
  const [trendsTimeFrame, setTrendsTimeFrame] = useState<TimeFrame>('12m')
  const [trendsRegion, setTrendsRegion] = useState('US')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // AI Keyword Suggestions
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [selectedSuggestedKeywords, setSelectedSuggestedKeywords] = useState<string[]>([])
  const [loadingKeywordSuggestions, setLoadingKeywordSuggestions] = useState(false)
  const [keywordSuggestionsError, setKeywordSuggestionsError] = useState<string | null>(null)

  // Competitor Keywords Trends State
  const [selectedCompetitorKeywords, setSelectedCompetitorKeywords] = useState<string[]>([])
  const [competitorTrendsTimeFrame, setCompetitorTrendsTimeFrame] = useState('today 12-m')
  const [competitorTrendsRegion, setCompetitorTrendsRegion] = useState('US')

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [analysisLogs])

  // Initialize selected competitor keywords when results are available
  useEffect(() => {
    if (competitorResult?.keywordResearch?.keywordGaps && competitorResult.keywordResearch.keywordGaps.length > 0) {
      const topKeywords = competitorResult.keywordResearch.keywordGaps.slice(0, 5).map((kw: any) => kw.keyword)
      setSelectedCompetitorKeywords(topKeywords)
    }
  }, [competitorResult])

  // Fetch autocomplete suggestions as user types in Keyword Trends tab
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (keyword.trim().length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setLoadingSuggestions(true)
      try {
        const response = await fetch(`/api/autocomplete?q=${encodeURIComponent(keyword)}`)
        const data = await response.json()
        setSuggestions(data || [])
        setShowSuggestions(data && data.length > 0)
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoadingSuggestions(false)
      }
    }

    const debounceTimer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [keyword])

  // Handle click outside suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCompetitorAnalyze = async () => {
    if (!competitorInput.trim()) return

    setCompetitorLoading(true)
    setCompetitorResult(null)
    setAnalysisLogs([])

    try {
      const response = await fetch('/api/competitor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: competitorInput.trim() })
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
            } else if (data.type === 'complete') {
              setAnalysisLogs(prev => prev.map(log => ({ ...log, status: 'complete' as const })))
              setCompetitorResult(data.data)
              setCompetitorLoading(false)
            } else if (data.type === 'error') {
              setCompetitorResult({ error: data.data.message || 'Analysis failed' })
              setCompetitorLoading(false)
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e)
          }
        }
      }
    } catch (error: any) {
      setCompetitorResult({ error: 'Network error: ' + error.message })
      setCompetitorLoading(false)
    }
  }

  const handleTrendsExplore = async () => {
    if (keyword.trim()) {
      setSearchedKeyword(keyword.trim())
      setShowSuggestions(false)
      setSelectedSuggestedKeywords([])
      setSuggestedKeywords([])
      setKeywordSuggestionsError(null)

      // Fetch AI-powered keyword suggestions
      setLoadingKeywordSuggestions(true)
      try {
        const response = await fetch('/api/keyword-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: keyword.trim() })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestedKeywords(data.suggestions)
            setKeywordSuggestionsError(null)
          } else {
            setSuggestedKeywords([])
            setKeywordSuggestionsError('No keyword suggestions found. Try a different keyword.')
          }
        } else {
          const errorData = await response.json()
          setKeywordSuggestionsError(errorData.error || 'Failed to generate keyword suggestions')
          console.error('API error:', errorData)
        }
      } catch (error: any) {
        console.error('Failed to fetch keyword suggestions:', error)
        setKeywordSuggestionsError('Network error. Please check your connection and try again.')
      } finally {
        setLoadingKeywordSuggestions(false)
      }
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion)
    setSearchedKeyword(suggestion)
    setShowSuggestions(false)
  }

  const toggleSuggestedKeyword = (suggestedKeyword: string) => {
    setSelectedSuggestedKeywords(prev => {
      if (prev.includes(suggestedKeyword)) {
        return prev.filter(k => k !== suggestedKeyword)
      } else {
        // Limit to 4 additional keywords (5 total with main keyword)
        if (prev.length >= 4) {
          return prev
        }
        return [...prev, suggestedKeyword]
      }
    })
  }

  const toggleCompetitorKeyword = (keyword: string) => {
    setSelectedCompetitorKeywords(prev => {
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

  const getGoogleTrendsUrl = (kw: string, timeFrame: TimeFrame, region: string = 'US') => {
    const timeMap: Record<TimeFrame, string> = {
      '1h': 'now%201-H',
      '4h': 'now%204-H',
      '1d': 'now%201-d',
      '7d': 'now%207-d',
      '30d': 'today%201-m',
      '90d': 'today%203-m',
      '12m': 'today%2012-m',
      '5y': 'today%205-y'
    }

    return `https://trends.google.com/trends/embed/explore/TIMESERIES?req=%7B%22comparisonItem%22%3A%5B%7B%22keyword%22%3A%22${encodeURIComponent(kw)}%22%2C%22geo%22%3A%22${region}%22%2C%22time%22%3A%22${timeMap[timeFrame]}%22%7D%5D%2C%22category%22%3A0%2C%22property%22%3A%22%22%7D&tz=0&eq=q%3D${encodeURIComponent(kw)}%26geo%3D${region}`
  }

  const getMultiKeywordTrendsUrlForTrends = (mainKeyword: string, additionalKeywords: string[], timeFrame: TimeFrame, region: string) => {
    const timeMap: Record<TimeFrame, string> = {
      '1h': 'now%201-H',
      '4h': 'now%204-H',
      '1d': 'now%201-d',
      '7d': 'now%207-d',
      '30d': 'today%201-m',
      '90d': 'today%203-m',
      '12m': 'today%2012-m',
      '5y': 'today%205-y'
    }

    const allKeywords = [mainKeyword, ...additionalKeywords]
    const comparisonItems = allKeywords.map(keyword =>
      `%7B%22keyword%22%3A%22${encodeURIComponent(keyword)}%22%2C%22geo%22%3A%22${region}%22%2C%22time%22%3A%22${timeMap[timeFrame]}%22%7D`
    ).join('%2C')

    const queryString = allKeywords.map(k => encodeURIComponent(k)).join('%2C')

    return `https://trends.google.com/trends/embed/explore/TIMESERIES?req=%7B%22comparisonItem%22%3A%5B${comparisonItems}%5D%2C%22category%22%3A0%2C%22property%22%3A%22%22%7D&tz=0&eq=q%3D${queryString}%26geo%3D${region}`
  }

  const getMultiKeywordTrendsUrl = (keywords: string[], timeFrame: TimeFrame) => {
    const timeMap: Record<TimeFrame, string> = {
      '1h': 'now%201-H',
      '4h': 'now%204-H',
      '1d': 'now%201-d',
      '7d': 'now%207-d',
      '30d': 'today%201-m',
      '90d': 'today%203-m',
      '12m': 'today%2012-m',
      '5y': 'today%205-y'
    }

    const comparisonItems = keywords.map(keyword =>
      `%7B%22keyword%22%3A%22${encodeURIComponent(keyword)}%22%2C%22geo%22%3A%22US%22%2C%22time%22%3A%22${timeMap[timeFrame]}%22%7D`
    ).join('%2C')

    const queryString = keywords.map(k => encodeURIComponent(k)).join('%2C')

    return `https://trends.google.com/trends/embed/explore/TIMESERIES?req=%7B%22comparisonItem%22%3A%5B${comparisonItems}%5D%2C%22category%22%3A0%2C%22property%22%3A%22%22%7D&tz=0&eq=q%3D${queryString}%26geo%3DUS`
  }

  const subNavItems = [
    { id: 'trends', label: 'Keyword Trends', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'competitor', label: 'Deep Keyword Analysis', icon: <Users className="w-5 h-5" /> },
  ]

  return (
    <div className="min-h-screen bg-white">
      <div>
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-6 border-b border-gray-200 bg-white text-center">
          <h1 className="text-2xl font-normal text-gray-900 mb-2">Localized Keyword Research</h1>
          <p className="text-sm text-gray-600">
            Find high-value keywords by analyzing competitors or tracking trends directly
          </p>
        </div>

        {/* Main Layout with Sidebar */}
        <div className="flex">
          {/* Collapsible Sub-Navigation */}
          <CollapsibleSubNav
            items={subNavItems}
            activeItem={activeTab}
            onItemClick={(id) => setActiveTab(id as TabType)}
            title="Research Tools"
          />

          {/* Content Area */}
          <div className="flex-1 overflow-auto">

        {/* Competitor Analysis Tab */}
        {activeTab === 'competitor' && (
          <>
            {/* Centered Search Section - Only show when no results */}
            {!competitorResult && !competitorLoading && (
              <div className="flex flex-col items-center justify-center py-12 p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-2">Deep Keyword Analysis</h2>
                <p className="text-sm text-gray-600 mb-6">Enter a product URL or name to discover valuable keywords</p>

                <div className="w-full max-w-2xl">
                  <div className="flex items-center gap-0 bg-white border-2 border-gray-200 rounded-full shadow-sm hover:border-gray-300 focus-within:border-blue-500 focus-within:shadow-md transition-all">
                    <input
                      type="text"
                      placeholder="Enter product URL or name (e.g., wireless earbuds)"
                      value={competitorInput}
                      onChange={(e) => setCompetitorInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCompetitorAnalyze()}
                      className="flex-1 px-6 py-3 text-base bg-transparent border-none outline-none rounded-l-full placeholder:text-gray-400"
                    />
                    <button
                      onClick={handleCompetitorAnalyze}
                      disabled={!competitorInput.trim()}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-base rounded-full transition-colors"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!competitorResult && !competitorLoading && (
              <div className="text-center py-20 p-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start your keyword analysis</h3>
                <p className="text-gray-600 mb-4">Enter a product URL or name above to discover high-value keywords</p>
                <div className="max-w-md mx-auto p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="text-left">
                      <p className="text-sm font-medium text-blue-900 mb-1">AI-powered keyword analysis</p>
                      <p className="text-xs text-blue-700">Discover keyword opportunities and insights for your product niche</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {competitorLoading && (
              <div className="p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <div>
                      <TextShimmer className="text-lg font-medium" duration={2}>
                        Analyzing competitors...
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
                                  <Loader2 className="size-4 text-blue-600 animate-spin" />
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

            {/* Results */}
            {competitorResult && !competitorResult.error && !competitorLoading && (
              <div>
                {/* Keywords & Google Trends */}
                {competitorResult.keywordResearch?.keywordGaps && competitorResult.keywordResearch.keywordGaps.length > 0 && (
                  <div className="p-6 border-b border-gray-200 bg-white space-y-6">
                    {/* Google Trends for Selected Keywords */}
                    {selectedCompetitorKeywords.length > 0 && (
                      <Card className="p-6 bg-white border-2 border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              Search Trends for Selected Keywords
                            </h3>
                            <p className="text-sm text-gray-600">
                              Compare search interest for {selectedCompetitorKeywords.length} keyword{selectedCompetitorKeywords.length !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {/* Time Frame & Region Controls */}
                          <div className="flex gap-3">
                            <select
                              value={competitorTrendsTimeFrame}
                              onChange={(e) => setCompetitorTrendsTimeFrame(e.target.value)}
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
                              value={competitorTrendsRegion}
                              onChange={(e) => setCompetitorTrendsRegion(e.target.value)}
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
                            key={`${selectedCompetitorKeywords.join(',')}-${competitorTrendsTimeFrame}-${competitorTrendsRegion}`}
                            src={`https://trends.google.com/trends/embed/explore/TIMESERIES?req=${encodeURIComponent(
                              JSON.stringify({
                                comparisonItem: selectedCompetitorKeywords.map((kw: string) => ({
                                  keyword: kw,
                                  geo: competitorTrendsRegion,
                                  time: competitorTrendsTimeFrame
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

                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Detected Keywords</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Click keywords to add/remove from trends comparison (max 5)
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {competitorResult.keywordResearch.keywordGaps.map((kw: any, idx: number) => {
                          const isSelected = selectedCompetitorKeywords.includes(kw.keyword)
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleCompetitorKeyword(kw.keyword)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-md'
                                  : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-blue-400 hover:bg-gray-200'
                              }`}
                            >
                              {kw.keyword}
                              {isSelected && <span className="ml-2 text-xs">★</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Cards */}
                {competitorResult.insights && (
                  <div className="p-6 bg-gray-50 border-t border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Analysis Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="p-6 bg-white border border-gray-200">
                        <div className="text-3xl font-normal text-orange-600 mb-1">
                          {competitorResult.insights.keywordOpportunities || 0}
                        </div>
                        <div className="text-sm text-gray-600">New Opportunities</div>
                      </Card>
                      <Card className="p-6 bg-white border border-gray-200">
                        <div className="text-3xl font-normal text-green-600 mb-1">
                          {competitorResult.insights.keywordsAlreadyUsing || 0}
                        </div>
                        <div className="text-sm text-gray-600">Already Using</div>
                      </Card>
                      <Card className="p-6 bg-white border border-gray-200">
                        <div className="text-3xl font-normal text-blue-600 mb-1">
                          {competitorResult.insights.uniqueKeywordsFound}
                        </div>
                        <div className="text-sm text-gray-600">Total Keywords</div>
                      </Card>
                      <Card className="p-6 bg-white border border-gray-200">
                        <div className="text-3xl font-normal text-purple-600 mb-1">
                          {competitorResult.insights.totalCompetitorsAnalyzed}
                        </div>
                        <div className="text-sm text-gray-600">Sites Analyzed</div>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {competitorResult?.error && !competitorLoading && (
              <div className="p-6 py-12 text-center">
                <div className="text-red-600 font-medium mb-2">Analysis Error</div>
                <div className="text-gray-600">{competitorResult.error}</div>
              </div>
            )}
          </>
        )}

        {/* Keyword Trends Tab */}
        {activeTab === 'trends' && (
          <>
            <div className="flex flex-col items-center justify-center py-12 p-6">
              <h2 className="text-xl font-medium text-gray-900 mb-2">Track Keyword Trends</h2>
              <p className="text-sm text-gray-600 mb-6">Monitor search interest for any keyword over time</p>

              <div className="w-full max-w-2xl relative" ref={suggestionsRef}>
                <div className="flex items-center gap-0 bg-white border-2 border-gray-200 rounded-full shadow-sm hover:border-gray-300 focus-within:border-blue-500 focus-within:shadow-md transition-all">
                  <input
                    type="text"
                    placeholder="Enter keyword to track..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleTrendsExplore()}
                    onFocus={() => keyword.trim().length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                    className="flex-1 px-6 py-3 text-base bg-transparent border-none outline-none rounded-l-full placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleTrendsExplore}
                    disabled={!keyword.trim()}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-base rounded-full transition-colors"
                  >
                    Explore
                  </button>
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-xl z-10 overflow-hidden">
                    {loadingSuggestions && (
                      <div className="px-6 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading suggestions...
                      </div>
                    )}
                    {!loadingSuggestions && suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-6 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {searchedKeyword && (
              <div className="p-6 pb-8 space-y-6">
                <Card className="p-6 bg-white border-2 border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Search Trends for "{searchedKeyword}"
                        {selectedSuggestedKeywords.length > 0 && ` +${selectedSuggestedKeywords.length} more`}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Interest over time across Google Search
                      </p>
                    </div>

                    {/* Time Frame & Region Controls */}
                    <div className="flex gap-3">
                      <select
                        value={trendsTimeFrame}
                        onChange={(e) => setTrendsTimeFrame(e.target.value as TimeFrame)}
                        className="px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        {timeFrameOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={trendsRegion}
                        onChange={(e) => setTrendsRegion(e.target.value)}
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

                  <div className="w-full h-[500px] rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      key={`${searchedKeyword}-${selectedSuggestedKeywords.join(',')}-${trendsTimeFrame}-${trendsRegion}`}
                      src={
                        selectedSuggestedKeywords.length > 0
                          ? getMultiKeywordTrendsUrlForTrends(searchedKeyword, selectedSuggestedKeywords, trendsTimeFrame, trendsRegion)
                          : getGoogleTrendsUrl(searchedKeyword, trendsTimeFrame, trendsRegion)
                      }
                      className="w-full h-full"
                      frameBorder="0"
                    />
                  </div>
                </Card>

                {/* AI-Suggested Keywords - Always show after search */}
                <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        AI-Suggested Keywords
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Related keywords that might have higher search volume. Click to add to chart comparison (max 4 additional keywords).
                      </p>

                      {/* Loading State */}
                      {loadingKeywordSuggestions && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
                          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          Analyzing keyword and generating suggestions...
                        </div>
                      )}

                      {/* Error State */}
                      {!loadingKeywordSuggestions && keywordSuggestionsError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800">{keywordSuggestionsError}</p>
                              <button
                                onClick={handleTrendsExplore}
                                className="mt-2 text-xs text-red-700 hover:text-red-900 underline"
                              >
                                Try again
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Success State with Keywords */}
                      {!loadingKeywordSuggestions && !keywordSuggestionsError && suggestedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {suggestedKeywords.map((suggestedKw, idx) => {
                            const isSelected = selectedSuggestedKeywords.includes(suggestedKw)
                            return (
                              <button
                                key={idx}
                                onClick={() => toggleSuggestedKeyword(suggestedKw)}
                                className={`px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-2 border-purple-600 shadow-md'
                                    : 'bg-white text-gray-700 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                                }`}
                              >
                                {suggestedKw}
                                {isSelected && <span className="ml-2 text-xs">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-100">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">About this data</h3>
                      <p className="text-sm text-gray-700">
                        Google Trends shows how often a search term is entered relative to total search volume.
                        Numbers represent search interest relative to the highest point on the chart. A value of 100
                        is the peak popularity for the term.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {!searchedKeyword && (
              <div className="text-center py-20 p-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start tracking a keyword</h3>
                <p className="text-gray-600">Enter a keyword above to see search trends and interest over time</p>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
