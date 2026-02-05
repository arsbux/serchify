'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Badge } from '@/components/ui/badge'

interface TrendDataPoint {
  date: string
  value: number // Google Trends search interest (0-100 scale)
}

interface TrendChartProps {
  keyword: string
  trends: TrendDataPoint[]
  averageInterest?: number
  peakInterest?: number
  currentInterest?: number
  trendDirection?: 'rising' | 'falling' | 'stable'
  compact?: boolean
}

export function TrendChart({ keyword, trends, averageInterest, peakInterest, currentInterest, trendDirection, compact = false }: TrendChartProps) {
  if (!trends || trends.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No trend data available for this keyword
      </div>
    )
  }

  // Format date for display (YYYY-MM-DD -> MM/DD)
  const formattedData = trends.map(item => ({
    ...item,
    displayDate: item.date.substring(5) // Get MM-DD part
  }))

  // Get trend direction color
  const getTrendColor = () => {
    if (trendDirection === 'rising') return '#10b981' // green
    if (trendDirection === 'falling') return '#ef4444' // red
    return '#6366f1' // indigo
  }

  // Get trend icon
  const getTrendIcon = () => {
    if (trendDirection === 'rising') return '📈'
    if (trendDirection === 'falling') return '📉'
    return '📊'
  }

  if (compact) {
    // Compact sparkline version
    return (
      <div className="flex items-center gap-2">
        <ResponsiveContainer width={100} height={30}>
          <LineChart data={formattedData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={getTrendColor()}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {trendDirection && (
          <Badge variant="outline" className="text-xs">
            {getTrendIcon()} {trendDirection}
          </Badge>
        )}
      </div>
    )
  }

  // Full chart version
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-gray-900">{keyword}</h4>
          <p className="text-sm text-gray-500">Google Trends search interest - Past 30 days</p>
        </div>
        <div className="flex gap-2">
          {trendDirection && (
            <Badge variant={
              trendDirection === 'rising' ? 'default' :
              trendDirection === 'falling' ? 'destructive' : 'secondary'
            }>
              {getTrendIcon()} {trendDirection}
            </Badge>
          )}
          {averageInterest !== undefined && (
            <Badge variant="outline">
              Avg: {averageInterest}/100
            </Badge>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id={`colorGradient-${keyword}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getTrendColor()} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={getTrendColor()} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval={Math.floor(formattedData.length / 6)} // Show ~6 labels
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            domain={[0, 100]}
            label={{ value: 'Interest', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
            formatter={(value: number | undefined) => {
              if (value === undefined) return ['N/A', 'Interest']
              return [`${value}/100`, 'Search Interest']
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={getTrendColor()}
            strokeWidth={2}
            fill={`url(#colorGradient-${keyword})`}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-gray-500">
        {peakInterest !== undefined && (
          <span>Peak: {peakInterest}/100</span>
        )}
        {averageInterest !== undefined && (
          <span>30-day average: {averageInterest}/100</span>
        )}
        {currentInterest !== undefined && (
          <span>Current: {currentInterest}/100</span>
        )}
      </div>

      <div className="p-3 bg-blue-50 rounded text-xs text-gray-700">
        <strong>Note:</strong> Values represent search interest relative to the highest point (100) over the time period. A value of 50 means half as popular as the peak.
      </div>
    </div>
  )
}
