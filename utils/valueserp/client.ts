import axios from 'axios'

export class ValueSERPClient {
  private apiKey: string
  private baseURL = 'https://api.valueserp.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async searchKeyword(keyword: string, location: string = 'United States') {
    try {
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          api_key: this.apiKey,
          q: keyword,
          location: location,
          google_domain: 'google.com',
          gl: 'us',
          hl: 'en',
          num: 10
        },
        timeout: 30000
      })
      return response.data
    } catch (error: any) {
      console.error('ValueSERP API Error:', error.response?.data || error.message)
      throw new Error(error.response?.data?.error || error.message || 'Failed to fetch keyword data')
    }
  }

  // Simple keyword volume estimation from SERP data
  estimateSearchVolume(serpData: any): number {
    // Use related searches count and shopping results as proxy
    const relatedSearches = serpData.related_searches?.length || 0
    const shoppingResults = serpData.shopping_results?.length || 0
    const organicResults = serpData.organic_results?.length || 0
    const paaResults = serpData.related_questions?.length || 0

    // Simple heuristic (real apps would use Google Keyword Planner API)
    if (shoppingResults > 5 && organicResults === 10 && paaResults > 3) return 15000
    if (shoppingResults > 5 && organicResults === 10) return 10000
    if (shoppingResults > 2) return 5000
    if (relatedSearches > 5) return 2000
    if (organicResults >= 8) return 1000
    return 500
  }

  estimateCompetition(serpData: any): 'low' | 'medium' | 'high' {
    const adCount = serpData.ads?.length || 0
    const shoppingCount = serpData.shopping_results?.length || 0
    const organicResults = serpData.organic_results?.length || 0

    if ((adCount > 3 || shoppingCount > 5) && organicResults === 10) return 'high'
    if (adCount > 0 || shoppingCount > 0 || organicResults > 7) return 'medium'
    return 'low'
  }
}
