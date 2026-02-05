// Use dynamic imports to avoid loading chromium during build time
export async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Vercel/serverless environment - lazy load chromium
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteerCore = (await import('puppeteer-core')).default

    return await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // Local development - use local Chrome
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
