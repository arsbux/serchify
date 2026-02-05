declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword: string | string[]
    startTime?: Date
    endTime?: Date
    geo?: string
    hl?: string
    timezone?: number
    category?: number
  }

  interface RelatedQueriesOptions {
    keyword: string
    startTime?: Date
    endTime?: Date
    geo?: string
    hl?: string
    timezone?: number
    category?: number
  }

  const googleTrends: {
    interestOverTime(options: TrendsOptions): Promise<string>
    interestByRegion(options: TrendsOptions): Promise<string>
    relatedQueries(options: RelatedQueriesOptions): Promise<string>
    relatedTopics(options: RelatedQueriesOptions): Promise<string>
    autoComplete(options: { keyword: string; hl?: string }): Promise<string>
    dailyTrends(options: { geo?: string; trendDate?: Date }): Promise<string>
    realTimeTrends(options: { geo?: string; category?: string }): Promise<string>
  }

  export default googleTrends
}
