'use client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendDataPoint {
  date: string
  searchVolume: number
}

interface SearchVolumeTrendChartProps {
  keyword: string
  trends: TrendDataPoint[]
  averageVolume?: number
  peakVolume?: number
  currentVolume?: number
  trendDirection?: 'rising' | 'falling' | 'stable'
  monthlySearches?: number
  source?: 'google_trends' | 'wikipedia' | 'estimated'
  compact?: boolean
}

export function SearchVolumeTrendChart({
  keyword,
  trends,
  averageVolume,
  peakVolume,
  currentVolume,
  trendDirection,
  monthlySearches,
  source,
  compact = false
}: SearchVolumeTrendChartProps) {
  if (!trends || trends.length === 0) {
    return null
  }

  // Format data for Recharts
  const chartData = trends.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    volume: point.searchVolume
  }))

  // Get trend direction color
  const getTrendColor = () => {
    if (trendDirection === 'rising') return 'text-green-600 bg-green-100'
    if (trendDirection === 'falling') return 'text-red-600 bg-red-100'
    return 'text-gray-600 bg-gray-100'
  }

  const getTrendIcon = () => {
    if (trendDirection === 'rising') return '↗'
    if (trendDirection === 'falling') return '↘'
    return '→'
  }

  // Format large numbers
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  // Get data source label
  const getSourceLabel = () => {
    if (source === 'google_trends') return 'Google Trends (estimated volume)'
    if (source === 'wikipedia') return 'Wikipedia Pageviews'
    if (source === 'estimated') return 'Estimated based on keyword characteristics'
    return 'Free public data sources'
  }

  // Get source badge color
  const getSourceBadgeColor = () => {
    if (source === 'google_trends') return 'bg-blue-100 text-blue-700'
    if (source === 'wikipedia') return 'bg-green-100 text-green-700'
    if (source === 'estimated') return 'bg-gray-100 text-gray-700'
    return 'bg-gray-100 text-gray-700'
  }

  if (compact) {
    // Compact sparkline view
    return (
      <div className="flex items-center gap-2">
        {trendDirection && (
          <Badge variant="outline" className={`text-xs ${getTrendColor()}`}>
            {getTrendIcon()} {trendDirection}
          </Badge>
        )}
        {monthlySearches && (
          <span className="text-xs text-gray-600">
            {formatVolume(monthlySearches)}/mo
          </span>
        )}
      </div>
    )
  }

  // Full chart view
  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{keyword}</h3>
          <div className="flex items-center gap-2">
            {source && (
              <Badge variant="outline" className={`text-xs ${getSourceBadgeColor()}`}>
                {source === 'google_trends' ? '📊 Google' : source === 'wikipedia' ? '📖 Wiki' : '📈 Est.'}
              </Badge>
            )}
            {trendDirection && (
              <Badge className={getTrendColor()}>
                {getTrendIcon()} {trendDirection}
              </Badge>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {monthlySearches !== undefined && (
            <div>
              <p className="text-sm text-gray-500">Current Volume</p>
              <p className="text-2xl font-bold text-blue-600">{formatVolume(monthlySearches)}</p>
              <p className="text-xs text-gray-400">/month</p>
            </div>
          )}
          {averageVolume !== undefined && (
            <div>
              <p className="text-sm text-gray-500">12-Month Avg</p>
              <p className="text-2xl font-bold text-gray-700">{formatVolume(averageVolume)}</p>
            </div>
          )}
          {peakVolume !== undefined && (
            <div>
              <p className="text-sm text-gray-500">Peak Volume</p>
              <p className="text-2xl font-bold text-green-600">{formatVolume(peakVolume)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`colorVolume-${keyword}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              tickFormatter={(value) => formatVolume(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px'
              }}
              formatter={(value: any) => [formatVolume(value), 'Search Volume']}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#3b82f6"
              strokeWidth={2}
              fill={`url(#colorVolume-${keyword})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Data Source Note */}
      <p className="text-xs text-gray-500 mt-4">
        📊 Data from {getSourceLabel()}. Shows last 12 months of search trends. 100% free, no API keys required.
      </p>
    </Card>
  )
}
