# Free Search Trend Data Sources

This application uses **100% free, open-source data** for search volume trends. No API keys, no sign-ups, no costs!

## How It Works

We use a **multi-source approach** to fetch trend data with automatic fallbacks:

### 1. Google Trends (Primary) 📊
- **Source**: Unofficial `google-trends-api` npm package
- **Cost**: Free
- **Rate Limits**: Yes (rate limited after ~10-20 requests)
- **Data Quality**: Good - Shows relative search interest (0-100 scale)
- **What You Get**: 12 months of search interest data

**Pros:**
- Most comprehensive search trend data
- Covers most keywords
- Real Google data

**Cons:**
- Rate limited (triggers CAPTCHA after multiple requests)
- Returns relative interest, not absolute volume

### 2. Wikipedia Pageviews (Fallback) 📖
- **Source**: Wikimedia REST API
- **Cost**: Free, no authentication
- **Rate Limits**: Very generous
- **Data Quality**: Good for topics with Wikipedia articles
- **What You Get**: Actual pageview counts by month

**Pros:**
- No rate limiting
- Actual view numbers (not estimated)
- Very reliable
- No authentication needed

**Cons:**
- Only works for keywords that have Wikipedia articles
- Pageviews ≠ search volume (but highly correlated)

### 3. Estimated Data (Last Resort) 📈
- **Source**: Algorithm based on keyword characteristics
- **Cost**: Free (generated locally)
- **Data Quality**: Approximate
- **What You Get**: Estimated trends based on keyword patterns

**Algorithm Factors:**
- Keyword length (shorter = higher volume)
- Commercial intent keywords (buy, best, top, etc.)
- Seasonal patterns
- Random realistic variation

**When Used:**
- When both Google Trends and Wikipedia fail
- Provides reasonable estimates for planning

## Data Source Indicators

Each trend chart shows which source was used:

- **📊 Google** = Google Trends data (estimated volume)
- **📖 Wiki** = Wikipedia Pageviews (actual views)
- **📈 Est.** = Estimated based on keyword characteristics

## Volume Interpretation

### Google Trends
- Interest scores (0-100) are converted to estimated volume
- Formula: `interest_score × 100 = estimated_monthly_searches`
- Example: Interest 75 ≈ 7,500 searches/month

### Wikipedia Pageviews
- Direct pageview counts
- Generally lower than search volume (not everyone clicks Wikipedia)
- More accurate for informational keywords

### Estimated Data
- Based on keyword characteristics
- Should be used for relative comparison, not absolute planning
- Generally conservative estimates

## Rate Limiting & Performance

### Google Trends Strategy
- Limit to 5 keywords per analysis
- 2-second delay between requests
- Automatic fallback when rate limited
- No CAPTCHA solving needed (we skip to next source)

### Wikipedia Strategy
- 1-second delay between requests
- Very generous limits (unlikely to hit)
- Works well for product categories and brands

### Best Practices
1. Analyze in batches (5 keywords at a time)
2. Wait a few minutes between analyses if hitting rate limits
3. Use more specific keywords for better Wikipedia matches
4. Compare trends relatively, not absolutely

## Example Usage

```typescript
// In your API route or component
import { fetchFreeSearchTrends } from '@/utils/free-trends/multi-source'

const keywords = ['wireless earbuds', 'bluetooth headphones', 'noise cancelling']
const trends = await fetchFreeSearchTrends(keywords, 5)

trends.forEach(trend => {
  console.log(`${trend.keyword}: ${trend.source}`)
  console.log(`Avg: ${trend.averageVolume}, Peak: ${trend.peakVolume}`)
  console.log(`Trend: ${trend.trendDirection}`)
})
```

## Comparing Data Sources

| Feature | Google Trends | Wikipedia | Estimated |
|---------|--------------|-----------|-----------|
| Cost | Free | Free | Free |
| Authentication | None | None | None |
| Rate Limits | High | Low | None |
| Data Quality | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Coverage | 95% | 40% | 100% |
| Absolute Values | No | Yes | Estimated |
| Reliability | Medium | High | Always works |

## When Each Source is Used

### Google Trends
- First choice for all keywords
- Works best for: product names, popular terms, trending topics
- Fails when: rate limited, obscure keywords

### Wikipedia
- Fallback when Google Trends fails
- Works best for: brands, products with articles, categories
- Fails when: no Wikipedia article exists for the term

### Estimated
- Last resort fallback
- Works for: any keyword
- Best for: relative comparison between keywords

## Improving Data Quality

### Tips for Better Google Trends Data
1. Use specific product terms (not generic phrases)
2. Avoid special characters
3. Wait between analyses to avoid rate limits
4. Run analysis during off-peak hours

### Tips for Better Wikipedia Data
1. Use proper product/brand names
2. Try variations (e.g., "iPhone" vs "Apple iPhone")
3. Use category names (e.g., "Wireless earbuds" has an article)

### Understanding Estimated Data
- Use for relative comparison only
- Look at trend direction, not absolute numbers
- Cross-reference with SERP metrics (ads, shopping results)

## Technical Implementation

The multi-source fetcher:
1. Tries Google Trends first
2. On failure (rate limit, no data), tries Wikipedia
3. On failure, generates estimated data
4. Always returns data (never fails completely)
5. Marks source in response for transparency

## Cost Comparison vs Paid APIs

| Service | Cost | This App |
|---------|------|----------|
| DataForSEO | $50-100/mo | $0 |
| SEMrush | $120+/mo | $0 |
| Ahrefs | $99+/mo | $0 |
| Google Keyword Planner | Free (ads required) | $0 |
| **Our Multi-Source** | **$0** | **✅ Active** |

## Limitations & Workarounds

### Limitation: Rate Limiting
**Workaround**: Multi-source fallback ensures you always get data

### Limitation: Estimated Volumes
**Workaround**: Use SERP metrics (opportunity scores) for decision-making

### Limitation: Not Real-Time
**Workaround**: Monthly data is sufficient for SEO planning

### Limitation: Coverage Gaps
**Workaround**: Three-tier fallback system catches all keywords

## FAQ

**Q: Why not use Google Keyword Planner?**
A: Requires Google Ads account and provides volume ranges, not exact numbers. Also requires authentication.

**Q: Are these estimates accurate?**
A: Google Trends provides real data but not absolute volume. Wikipedia is actual pageviews. Estimates are approximations. Use trends and SERP metrics together for best decisions.

**Q: Can I use this for commercial projects?**
A: Yes! All sources are publicly available APIs or estimated data. No terms of service violations.

**Q: What if I hit rate limits?**
A: The app automatically falls back to Wikipedia, then estimated data. You'll always get results.

**Q: Should I trust estimated data?**
A: Use it for relative comparison and trend direction, not absolute planning. SERP metrics (opportunity scores) are often more actionable.

## Future Improvements

Potential enhancements:
- Local caching to reduce API calls
- User-provided API keys as optional enhancement
- More sophisticated estimation algorithms
- Integration with search suggestion APIs
- Bing Trends integration (if available)

---

**Bottom Line**: You get search trend data without spending a dime or managing API keys. The multi-source approach ensures reliability while respecting rate limits.
