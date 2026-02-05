// Browserless.io integration for serverless Chrome
export async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Production: Use Browserless.io hosted Chrome
    const puppeteerCore = (await import('puppeteer-core')).default

    const browserWSEndpoint = `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`

    return await puppeteerCore.connect({
      browserWSEndpoint
    })
  } else {
    // Local development: Use local Chrome
    const puppeteerLocal = await import('puppeteer')
    return await puppeteerLocal.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled'
      ]
    })
  }
}
