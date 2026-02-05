'use client'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface KeywordMetrics {
  keyword: string
  searchVolume?: 'High' | 'Medium' | 'Low' | 'Very Low'
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Very Hard'
  competitionScore?: number
  opportunityScore?: number
  serpFeatures?: string[]
  relatedKeywords?: string[]
  monthlyEstimate?: string
}

interface KeywordMetricsCardProps {
  keyword: string
  metrics?: KeywordMetrics
  compact?: boolean
}

export function KeywordMetricsCard({ keyword, metrics, compact = false }: KeywordMetricsCardProps) {
  if (!metrics) {
    return null
  }

  // Get color for opportunity score
  const getOpportunityColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-100'
    if (score >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  // Get color for difficulty
  const getDifficultyVariant = (difficulty: string) => {
    if (difficulty === 'Easy') return 'default'
    if (difficulty === 'Medium') return 'secondary'
    if (difficulty === 'Hard') return 'destructive'
    return 'destructive'
  }

  // Get color for search volume
  const getVolumeVariant = (volume: string) => {
    if (volume === 'High') return 'default'
    if (volume === 'Medium') return 'secondary'
    return 'outline'
  }

  if (compact) {
    // Compact badge view
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {metrics.opportunityScore !== undefined && (
          <Badge variant="outline" className={`text-xs ${getOpportunityColor(metrics.opportunityScore)}`}>
            {metrics.opportunityScore}% opportunity
          </Badge>
        )}
        {metrics.searchVolume && (
          <Badge variant={getVolumeVariant(metrics.searchVolume)} className="text-xs">
            {metrics.searchVolume} vol
          </Badge>
        )}
      </div>
    )
  }

  // Full metrics view
  return (
    <div className="space-y-4">
      {/* Scores Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Opportunity Score</span>
            <span className="text-xs text-gray-500">Higher = Better</span>
          </div>
          <div className={`text-3xl font-bold ${metrics.opportunityScore && metrics.opportunityScore >= 70 ? 'text-green-600' : metrics.opportunityScore && metrics.opportunityScore >= 40 ? 'text-yellow-600' : 'text-gray-600'}`}>
            {metrics.opportunityScore || 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.opportunityScore && metrics.opportunityScore >= 70 ? 'Excellent opportunity' :
             metrics.opportunityScore && metrics.opportunityScore >= 40 ? 'Good opportunity' : 'Competitive'}
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Competition</span>
            <span className="text-xs text-gray-500">Lower = Easier</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {metrics.competitionScore || 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.difficulty || 'Unknown'} difficulty
          </p>
        </div>
      </div>

      {/* Volume and Estimate */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium text-gray-700">Search Volume</span>
            <Badge variant={getVolumeVariant(metrics.searchVolume || 'Very Low')} className="ml-2">
              {metrics.searchVolume || 'Unknown'}
            </Badge>
          </div>
          {metrics.monthlyEstimate && (
            <span className="text-sm text-gray-600">{metrics.monthlyEstimate} searches/month</span>
          )}
        </div>
      </div>

      {/* SERP Features */}
      {metrics.serpFeatures && metrics.serpFeatures.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">SERP Features ({metrics.serpFeatures.length})</p>
          <div className="flex flex-wrap gap-2">
            {metrics.serpFeatures.map((feature, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-purple-50">
                {feature}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These features indicate competitive keywords with rich search results
          </p>
        </div>
      )}

      {/* Related Keywords */}
      {metrics.relatedKeywords && metrics.relatedKeywords.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Related Keywords</p>
          <div className="flex flex-wrap gap-2">
            {metrics.relatedKeywords.map((related, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {related}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="p-3 bg-blue-50 rounded text-xs text-gray-700">
        <strong>How to use:</strong> Opportunity Score combines search volume and competition.
        Higher scores (70+) = high volume with manageable competition. Target these first!
      </div>
    </div>
  )
}
