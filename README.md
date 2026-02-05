# E-Commerce SEO Tool MVP

A powerful SEO platform for e-commerce sellers with keyword research, product page optimization, and AI-readiness checking.

## Features

- **Keyword Research**: Discover high-value keywords with search volume and competition analysis
- **Product Page Optimizer**: Get SEO scores and actionable suggestions for product pages
- **AEO Checker**: Optimize your content for ChatGPT, Claude, and other AI search engines
- **Free Tier**: 20 keyword searches per month

## Tech Stack

- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- Puppeteer (Web Scraping)
- ValueSERP API (Keyword Data)
- Google Gemini API (AI Analysis)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your `Project URL` and `anon/public` key
4. Go to SQL Editor and run the schema from `supabase-schema.sql`

### 3. Get API Keys

#### ValueSERP API (Free Tier: 100 searches/month)
1. Sign up at [valueserp.com](https://www.valueserp.com/)
2. Get your API key from the dashboard

#### Google Gemini API (Free Tier: 60 req/min)
1. Go to [ai.google.dev](https://ai.google.dev/)
2. Get an API key

### 4. Configure Environment Variables

Update `.env.local` with your actual values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Keys
GEMINI_API_KEY=your_gemini_api_key
VALUESERP_API_KEY=your_valueserp_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign Up**: Create an account at `/login`
2. **Research Keywords**: Enter keywords to get search volume and competition data
3. **Analyze Pages**: Enter a product page URL to get SEO score and suggestions
4. **Check AEO**: Verify your page's AI-readiness for ChatGPT and Claude

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- Settings > Environment Variables
- Add all variables from `.env.local`

## Free Tier Limits

- **Keyword Searches**: 20 per month
- **Product Analyses**: Unlimited
- **AEO Checks**: Unlimited
- **ValueSERP**: 100 API calls per month
- **Gemini API**: 60 requests per minute

## Cost Estimate

**Free Tier (0-100 users):**
- Vercel: $0 (free tier)
- Supabase: $0 (free tier)
- ValueSERP: $0 (free tier)
- Gemini: $0 (free tier)

**Total**: $0/month

**Scaling (100+ users):**
- Vercel Pro: $20/month
- ValueSERP Standard: $50-100/month
- Total: ~$70-120/month

## Database Schema

See `supabase-schema.sql` for complete schema.

Tables:
- `profiles`: User profiles and credit tracking
- `keyword_searches`: Keyword research history
- `page_analyses`: Product page analysis results

## API Endpoints

- `POST /api/keyword/search`: Keyword research
- `POST /api/analyze/product`: Product page analysis
- `POST /api/aeo/check`: AEO readiness check

## Troubleshooting

### Puppeteer fails on Vercel

If Puppeteer timeouts on Vercel:
1. Upgrade to Vercel Pro for longer execution times (300s)
2. Or use a dedicated scraping service like ScrapingBee

### ValueSERP rate limits

If you hit rate limits:
1. Implement request queuing
2. Cache results in database
3. Upgrade to paid tier

### Authentication issues

If users can't sign in:
1. Check Supabase URL and keys
2. Verify RLS policies are enabled
3. Check browser console for errors

## Next Steps (Phase 2)

- Shopify OAuth integration
- AI-powered keyword clustering
- Stripe payment integration
- Email notifications
- Historical tracking
- Competitor analysis

## License

MIT

## Support

For issues, please open a GitHub issue or contact support.
