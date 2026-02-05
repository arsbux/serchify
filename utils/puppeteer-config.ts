import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

/**
 * Get Puppeteer browser instance configured for Vercel/AWS Lambda
 * Uses @sparticuz/chromium for serverless compatibility
 */
export async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Production (Vercel/AWS Lambda) - use chromium binary
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
