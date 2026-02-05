/**
 * Get Puppeteer browser instance configured for Vercel/AWS Lambda
 * Uses dynamic imports to prevent __dirname issues in Edge Runtime
 * Uses @sparticuz/chromium for serverless compatibility
 */
export async function getBrowser() {
  // Dynamic imports to avoid loading these packages at module level
  const puppeteer = (await import('puppeteer-core')).default

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'

  if (isProduction) {
    // Production (Vercel/AWS Lambda) - use chromium binary
    const chromium = (await import('@sparticuz/chromium')).default

    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // Local development - use local Chrome/Chromium
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
}
